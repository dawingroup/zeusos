/**
 * Group Financial Rollup — consolidated materialised statements (Phase 1.2).
 *
 * Ported from DawinOS functions/src/finance/groupRollup.js, but the data half
 * is rebuilt for ZeusOS:
 *   - DawinOS consolidated pre-totalled QuickBooks report snapshots in ONE
 *     currency (UGX). ZeusOS has NO QBO; it reconstructs each brand's P&L / BS
 *     / CF from its OWN gl_postings via the native ledger source, in the
 *     brand's own base_currency, then FX-converts to a group presentation
 *     currency before summing.
 *   - DawinOS read manual elimination rows. ZeusOS AUTO-derives eliminations
 *     from `intercompany_invoices` (every IC invoice is a sub→parent flow that
 *     must net out at group), and still reads
 *     companies/zeus-group/eliminations/{period} for manual supplements.
 *
 * Reused verbatim from DawinOS (pure math): buildPeriods, prevPeriodKey,
 * round2, num, addInto, finalisePnL, finaliseBalanceSheet, finaliseCashFlow,
 * applyEliminations.
 *
 * Output: one read-only doc per period at companies/zeus-group/rollups/{YYYY-MM}.
 * The Group statement pages read it; they never recompute.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertParentOrgPrincipal } = require('../assignment/lib/auth');
const { getLedgerSource } = require('./ledger');
const { resolveFxRate, convertMinor } = require('./lib/fx');

if (!admin.apps.length) {
  admin.initializeApp();
}

const GROUP_COMPANY_ID = 'zeus-group';
// The five sibling brands (single source of truth: src/core/settings/types.ts).
// zeus-group (the parent) is the consolidation target, not a contributor.
const BRAND_ORG_IDS = [
  'zeus-the-agency',
  'zeus-digital',
  'labyrinth',
  'odd-gorilla',
  'house-of-zeus',
];
const DEFAULT_PRESENTATION_CURRENCY = 'UGX';
const TRAILING_PERIODS = 13; // current month + 12 trailing
const DATA_SOURCE = 'native_ledger';

// ──────────────────────────────────────────────────────────────────────────
// PERIOD + NUMERIC HELPERS (ported verbatim).
// ──────────────────────────────────────────────────────────────────────────

function periodKeyOf(year, monthIndex0) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, '0')}`;
}
function buildPeriods(now, count) {
  const periods = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    periods.push(periodKeyOf(d.getUTCFullYear(), d.getUTCMonth()));
  }
  return periods;
}
function prevPeriodKey(periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return periodKeyOf(d.getUTCFullYear(), d.getUTCMonth());
}
/** Month-end date 'YYYY-MM-DD' for a period key — the FX rate date. */
function periodEndDate(periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0)); // day 0 of next month = last day of this month
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function num(v, fallback = 0) { return Number.isFinite(Number(v)) ? Number(v) : fallback; }
function addInto(acc, obj) {
  for (const k of Object.keys(obj)) acc[k] = (acc[k] || 0) + num(obj[k]);
}

// ──────────────────────────────────────────────────────────────────────────
// FINALISE — derive totals/margins (ported verbatim from DawinOS).
// ──────────────────────────────────────────────────────────────────────────

function finalisePnL(base) {
  const grossProfit = base.revenue - base.costOfSales;
  const operatingProfit = grossProfit - base.operatingExpenses;
  const profitBeforeTax = operatingProfit + base.otherIncome - base.otherExpenses;
  const netProfit = profitBeforeTax - base.taxExpense;
  const denom = base.revenue || 0;
  const pct = (n) => (denom ? round2((n / denom) * 100) : 0);
  return {
    revenue: round2(base.revenue),
    otherIncome: round2(base.otherIncome),
    costOfSales: round2(base.costOfSales),
    operatingExpenses: round2(base.operatingExpenses),
    otherExpenses: round2(base.otherExpenses),
    taxExpense: round2(base.taxExpense),
    grossProfit: round2(grossProfit),
    operatingProfit: round2(operatingProfit),
    profitBeforeTax: round2(profitBeforeTax),
    netProfit: round2(netProfit),
    grossMargin: pct(grossProfit),
    operatingMargin: pct(operatingProfit),
    netMargin: pct(netProfit),
  };
}

function finaliseBalanceSheet(base) {
  const currentAssets = base.cash + base.ar + base.inventory + base.prepaidOtherCA;
  const totalAssets = currentAssets + base.nonCurrentAssets;
  const currentLiabilities = base.ap + base.taxPayable + base.accruedOtherCL;
  const totalLiabilities = currentLiabilities + base.longTermLiabilities;
  const totalEquity = base.shareCapital + base.reserves + base.retainedEarnings + (base.translationReserve || 0);
  const totalLiabilitiesEquity = totalLiabilities + totalEquity;
  const difference = totalAssets - totalLiabilitiesEquity;
  return {
    cash: round2(base.cash),
    accountsReceivable: round2(base.ar),
    inventory: round2(base.inventory),
    prepaidAndOtherCurrentAssets: round2(base.prepaidOtherCA),
    currentAssets: round2(currentAssets),
    nonCurrentAssets: round2(base.nonCurrentAssets),
    totalAssets: round2(totalAssets),
    accountsPayable: round2(base.ap),
    taxPayable: round2(base.taxPayable),
    accruedAndOtherCurrentLiabilities: round2(base.accruedOtherCL),
    currentLiabilities: round2(currentLiabilities),
    nonCurrentLiabilities: round2(base.longTermLiabilities),
    totalLiabilities: round2(totalLiabilities),
    shareCapital: round2(base.shareCapital),
    reserves: round2(base.reserves),
    retainedEarnings: round2(base.retainedEarnings),
    translationReserve: round2(base.translationReserve || 0),
    totalEquity: round2(totalEquity),
    totalLiabilitiesEquity: round2(totalLiabilitiesEquity),
    difference: round2(difference),
    isBalanced: Math.abs(difference) < 1,
  };
}

function finaliseCashFlow(base) {
  const netCashChange = base.operatingCashFlow + base.investingCashFlow + base.financingCashFlow;
  const reconciliationDifference = base.measuredCashChange - netCashChange;
  return {
    netIncome: round2(base.netIncome),
    depreciation: round2(base.depreciation),
    operatingCashFlow: round2(base.operatingCashFlow),
    investingCashFlow: round2(base.investingCashFlow),
    financingCashFlow: round2(base.financingCashFlow),
    netCashChange: round2(netCashChange),
    measuredCashChange: round2(base.measuredCashChange),
    reconciliationDifference: round2(reconciliationDifference),
    isReconciled: Math.abs(reconciliationDifference) < 1,
    openingCash: round2(base.openingCash),
    closingCash: round2(base.closingCash),
  };
}

/**
 * Apply elimination rows to the base accumulators. Each row:
 *   { statement: 'pnl'|'balanceSheet'|'cashFlow', line: <baseKey>, amount, memo? }
 * (ported verbatim).
 */
function applyEliminations(rows, pnlBase, bsBase, cfBase) {
  const applied = [];
  if (!Array.isArray(rows)) return applied;
  for (const row of rows) {
    const amount = num(row.amount);
    if (!amount) continue;
    const target = row.statement === 'pnl' ? pnlBase
      : row.statement === 'balanceSheet' ? bsBase
        : row.statement === 'cashFlow' ? cfBase : null;
    if (!target || !(row.line in target)) {
      logger.warn(`[GroupRollup] elimination row skipped (unknown ${row.statement}.${row.line})`);
      continue;
    }
    target[row.line] += amount;
    applied.push({ statement: row.statement, line: row.line, amount, memo: row.memo || null, source: row.source || null });
  }
  return applied;
}

// ──────────────────────────────────────────────────────────────────────────
// FX — convert a whole base accumulator by one rate (all lines monetary).
// Using a single per-entity rate keeps each entity's already-balanced BS
// balanced after translation (no CTA residual). Average-rate P&L vs
// closing-rate BS — which introduces a genuine translation reserve — is a
// later refinement; the translationReserve field is reserved for it.
// ──────────────────────────────────────────────────────────────────────────

function convertBase(base, rate) {
  const out = {};
  for (const k of Object.keys(base)) out[k] = convertMinor(base[k], rate);
  return out;
}

async function loadPresentationCurrency(db) {
  try {
    const snap = await db.doc('finance_config/group').get();
    if (snap.exists && snap.data().presentationCurrency) return snap.data().presentationCurrency;
  } catch (_) { /* default */ }
  return DEFAULT_PRESENTATION_CURRENCY;
}

// ──────────────────────────────────────────────────────────────────────────
// ELIMINATIONS — auto-derive from intercompany_invoices + manual supplements.
// ──────────────────────────────────────────────────────────────────────────

/** IC invoice period key from postedAt/raisedAt/createdAt. */
function icInvoicePeriod(inv) {
  const ts = inv.postedAt || inv.raisedAt || inv.createdAt;
  if (typeof ts === 'string' && ts.length >= 7) return ts.slice(0, 7);
  let d = null;
  if (ts && typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts && typeof ts._seconds === 'number') d = new Date(ts._seconds * 1000);
  else if (ts instanceof Date) d = ts;
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Build elimination rows for a period from intercompany_invoices. Each POSTED/
 * SETTLED IC invoice booked sub-side IC revenue (4000) + parent-side IC cost
 * (5000), and sub-side IC AR (1200) + parent-side IC AP (2000). At group these
 * net to zero — subtract the (FX-converted) amount from each line. Symmetric so
 * the consolidated P&L gross profit and the BS both stay balanced.
 */
async function buildAutoEliminations(db, periodKey, presentationCurrency, fxDate) {
  const snap = await db.collection('intercompany_invoices').get().catch(() => null);
  if (!snap) return [];
  const rows = [];
  for (const doc of snap.docs) {
    const inv = doc.data() || {};
    if (!['POSTED', 'SETTLED'].includes(inv.status)) continue;
    if (icInvoicePeriod(inv) !== periodKey) continue;
    const amountMinor = (inv.amount && inv.amount.amountMinor) || 0;
    const currency = (inv.amount && inv.amount.currency) || presentationCurrency;
    if (!amountMinor) continue;
    let converted = amountMinor;
    if (currency !== presentationCurrency) {
      try {
        const { rate } = await resolveFxRate(db, currency, presentationCurrency, fxDate);
        converted = convertMinor(amountMinor, rate);
      } catch (err) {
        logger.warn(`[GroupRollup] IC elimination FX gap ${currency}->${presentationCurrency}: ${err.message}`);
        continue;
      }
    }
    const memo = `IC auto-elim — invoice ${doc.id} (${inv.fromOrgId}→${inv.toOrgId})`;
    rows.push({ statement: 'pnl', line: 'revenue', amount: -converted, memo, source: 'ic-auto' });
    rows.push({ statement: 'pnl', line: 'costOfSales', amount: -converted, memo, source: 'ic-auto' });
    rows.push({ statement: 'balanceSheet', line: 'ar', amount: -converted, memo, source: 'ic-auto' });
    rows.push({ statement: 'balanceSheet', line: 'ap', amount: -converted, memo, source: 'ic-auto' });
  }
  return rows;
}

/** Manual elimination supplements (operator-curated gaps the auto pass misses). */
async function readManualEliminations(db, periodKey) {
  try {
    const doc = await db.doc(`companies/${GROUP_COMPANY_ID}/eliminations/${periodKey}`).get();
    if (!doc.exists) return [];
    const data = doc.data() || {};
    const rows = Array.isArray(data.rows) ? data.rows : [];
    return rows.map((r) => ({ ...r, source: 'manual' }));
  } catch (err) {
    logger.warn(`[GroupRollup] manual eliminations read failed for ${periodKey}: ${err.message}`);
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────

async function runGroupRollup({ asOf = new Date(), count = TRAILING_PERIODS } = {}) {
  const db = admin.firestore();
  const periods = buildPeriods(asOf, count);
  const presentationCurrency = await loadPresentationCurrency(db);
  const ledger = await getLedgerSource(GROUP_COMPANY_ID);

  const summary = [];

  for (const periodKey of periods) {
    const fxDate = periodEndDate(periodKey);

    const pnlBase = { revenue: 0, otherIncome: 0, costOfSales: 0, operatingExpenses: 0, otherExpenses: 0, taxExpense: 0 };
    const bsBase = { cash: 0, ar: 0, inventory: 0, prepaidOtherCA: 0, nonCurrentAssets: 0, ap: 0, taxPayable: 0, accruedOtherCL: 0, longTermLiabilities: 0, shareCapital: 0, reserves: 0, retainedEarnings: 0, translationReserve: 0 };
    const cfBase = { operatingCashFlow: 0, investingCashFlow: 0, financingCashFlow: 0, netIncome: 0, depreciation: 0, measuredCashChange: 0, openingCash: 0, closingCash: 0 };
    const bySubsidiary = {};
    const contributors = [];
    const fxRates = {};
    const fxGaps = [];

    for (const orgId of BRAND_ORG_IDS) {
      let bases;
      try {
        bases = await ledger.getStatementBases({ orgId, periodKey });
      } catch (err) {
        logger.warn(`[GroupRollup] getStatementBases failed ${orgId} ${periodKey}: ${err.message}`);
        continue;
      }
      const { pnlBase: subPnl, bsBase: subBs, cfBase: subCf, currency } = bases;

      // netIncome for the cash-flow statement comes from this brand's P&L.
      const subPnlFinal = finalisePnL(subPnl);
      subCf.netIncome = subPnlFinal.netProfit;

      // Skip entities with no activity this period.
      const hasActivity = Object.values(subPnl).some((v) => v) || Object.values(subBs).some((v) => v);
      if (!hasActivity) continue;

      // FX to presentation currency.
      let rate = 1;
      if (currency !== presentationCurrency) {
        try {
          ({ rate } = await resolveFxRate(db, currency, presentationCurrency, fxDate));
        } catch (err) {
          fxGaps.push({ orgId, currency, message: err.message });
          logger.warn(`[GroupRollup] FX gap ${orgId} ${currency}->${presentationCurrency}: ${err.message}`);
          continue;
        }
      }
      fxRates[currency] = rate;

      const cPnl = convertBase(subPnl, rate);
      const cBs = convertBase(subBs, rate);
      const cCf = convertBase(subCf, rate);

      addInto(pnlBase, cPnl);
      addInto(bsBase, cBs);
      addInto(cfBase, cCf);
      contributors.push(orgId);

      const subBsFinal = finaliseBalanceSheet(cBs);
      const subCfFinal = finaliseCashFlow(cCf);
      const subPnlConverted = finalisePnL(cPnl);
      bySubsidiary[orgId] = {
        baseCurrency: currency,
        fxRateToPresentation: rate,
        revenue: subPnlConverted.revenue,
        netProfit: subPnlConverted.netProfit,
        totalAssets: subBsFinal.totalAssets,
        cash: subBsFinal.cash,
        netCashChange: subCfFinal.netCashChange,
      };
    }

    // Eliminations: auto (from IC invoices) + manual supplements.
    const autoRows = await buildAutoEliminations(db, periodKey, presentationCurrency, fxDate);
    const manualRows = await readManualEliminations(db, periodKey);
    const eliminationsApplied = applyEliminations([...autoRows, ...manualRows], pnlBase, bsBase, cfBase);

    const pnl = finalisePnL(pnlBase);
    const balanceSheet = finaliseBalanceSheet(bsBase);
    const cashFlow = finaliseCashFlow(cfBase);

    await db.doc(`companies/${GROUP_COMPANY_ID}/rollups/${periodKey}`)
      .set({
        period: periodKey,
        presentationCurrency,
        dataSource: DATA_SOURCE,
        pnl,
        balanceSheet,
        cashFlow,
        bySubsidiary,
        sourceSubsidiaries: contributors,
        eliminationsApplied,
        fxRates,
        fxGaps,
        computedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    summary.push({
      period: periodKey,
      contributors: contributors.length,
      revenue: pnl.revenue,
      netProfit: pnl.netProfit,
      totalAssets: balanceSheet.totalAssets,
      balanced: balanceSheet.isBalanced,
      eliminations: eliminationsApplied.length,
      fxGaps: fxGaps.length,
    });
  }

  summary.sort((a, b) => a.period.localeCompare(b.period));
  return { periods, presentationCurrency, summary };
}

// ──────────────────────────────────────────────────────────────────────────
// SCHEDULED — daily 06:00 Africa/Nairobi.
// ──────────────────────────────────────────────────────────────────────────

exports.groupFinancialRollup = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'Africa/Nairobi',
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async () => {
    try {
      const { periods, summary } = await runGroupRollup();
      const latest = summary[summary.length - 1] || {};
      logger.info(`[GroupRollup] wrote ${periods.length} rollups; latest balanced=${latest.balanced}`);
    } catch (err) {
      logger.error('[GroupRollup] run failed:', err);
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────
// ON-DEMAND — "Recompute now". Parent-org principals only (commercial scope).
// ──────────────────────────────────────────────────────────────────────────

exports.runGroupRollupNow = onCall(
  {
    cors: ALLOWED_ORIGINS,
    region: 'europe-west1',
    timeoutSeconds: 540,
    memory: '512MiB',
  },
  async (request) => {
    await assertParentOrgPrincipal(request.auth);
    const { count } = request.data || {};
    const periodCount = Number.isInteger(count) && count > 0 && count <= 24 ? count : TRAILING_PERIODS;
    const result = await runGroupRollup({ count: periodCount });
    return { ranAt: Date.now(), ...result };
  },
);

// Exported for unit testing / reuse.
exports.runGroupRollup = runGroupRollup;
exports._internals = {
  BRAND_ORG_IDS,
  buildPeriods,
  prevPeriodKey,
  periodEndDate,
  finalisePnL,
  finaliseBalanceSheet,
  finaliseCashFlow,
  applyEliminations,
  convertBase,
  buildAutoEliminations,
  icInvoicePeriod,
};
