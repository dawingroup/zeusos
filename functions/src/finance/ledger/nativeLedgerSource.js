/**
 * Native ledger source — Phase 1.1.
 *
 * Reconstructs P&L / Balance Sheet / Cash Flow bases from Zeus's OWN ledger:
 *   - gl_postings/{id}        : double-entry postings ({entityOrgId, currency,
 *                               postedAt, lines:[{accountCode,debitMinor,creditMinor}]})
 *   - client_invoices/{id}    : external AR (total/paidMinor/status/clientId)
 *   - intercompany_invoices/* : inter-entity AP/AR (amount/fromOrgId/toOrgId/status)
 *
 * Where DawinOS trusted pre-totalled QBO report trees, here we bucket each GL
 * line by accountCode (accountRanges.classifyAccount) and net debits vs credits
 * with the account's normal sign. P&L lines accumulate movements DATED IN the
 * period; Balance-Sheet lines accumulate CUMULATIVE balances as of month-end.
 *
 * Returns amounts in the entity's OWN base_currency. The caller (groupRollup)
 * does the FX step to a group presentation currency.
 */

const { getFirestore } = require('firebase-admin/firestore');
const { classifyAccount } = require('../accountRanges');

const GL_POSTINGS = 'gl_postings';
const CLIENT_INVOICES = 'client_invoices';
const IC_INVOICES = 'intercompany_invoices';

// Short-lived per-invocation cache so a 13-period rollup loads each org's
// postings ONCE rather than per-period. Keyed by orgId.
const POSTINGS_TTL_MS = 60 * 1000;
const _postingsCache = new Map(); // orgId -> { rows, fetchedAt }

function zeroPnLBase() {
  return { revenue: 0, otherIncome: 0, costOfSales: 0, operatingExpenses: 0, otherExpenses: 0, taxExpense: 0 };
}
function zeroBSBase() {
  return { cash: 0, ar: 0, inventory: 0, prepaidOtherCA: 0, nonCurrentAssets: 0, ap: 0, taxPayable: 0, accruedOtherCL: 0, longTermLiabilities: 0, shareCapital: 0, reserves: 0, retainedEarnings: 0 };
}
function zeroCFBase() {
  return { operatingCashFlow: 0, investingCashFlow: 0, financingCashFlow: 0, netIncome: 0, depreciation: 0, measuredCashChange: 0, openingCash: 0, closingCash: 0 };
}

/** Resolve a posting's period key 'YYYY-MM' from `date` (string) or `postedAt`. */
function postingPeriodKey(doc) {
  if (typeof doc.date === 'string' && doc.date.length >= 7) return doc.date.slice(0, 7);
  const ts = doc.postedAt;
  let d = null;
  if (ts && typeof ts.toDate === 'function') d = ts.toDate();
  else if (ts && typeof ts._seconds === 'number') d = new Date(ts._seconds * 1000);
  else if (ts instanceof Date) d = ts;
  if (!d) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function loadOrgBaseCurrency(db, orgId) {
  try {
    const snap = await db.doc(`organizations/${orgId}`).get();
    if (snap.exists) return snap.data().base_currency || 'UGX';
  } catch (_) { /* fall through */ }
  return 'UGX';
}

async function loadPostings(db, orgId) {
  const cached = _postingsCache.get(orgId);
  if (cached && Date.now() - cached.fetchedAt < POSTINGS_TTL_MS) return cached.rows;
  const snap = await db.collection(GL_POSTINGS).where('entityOrgId', '==', orgId).get();
  const rows = snap.docs.map((d) => {
    const data = d.data() || {};
    return { period: postingPeriodKey(data), currency: data.currency || null, lines: data.lines || [] };
  });
  _postingsCache.set(orgId, { rows, fetchedAt: Date.now() });
  return rows;
}

/** Signed magnitude for a line: positive in the account's normal direction. */
function signedMinor(line, creditNormal) {
  const debit = line.debitMinor || 0;
  const credit = line.creditMinor || 0;
  return creditNormal ? credit - debit : debit - credit;
}

/**
 * Build {pnlBase, bsBase, cfBase, currency} for an org + period from raw GL.
 * @param {{orgId:string, periodKey:string}} params
 */
async function getStatementBases({ orgId, periodKey }) {
  const db = getFirestore();
  const [rows, currency] = await Promise.all([
    loadPostings(db, orgId),
    loadOrgBaseCurrency(db, orgId),
  ]);

  const pnlBase = zeroPnLBase();
  const bsBase = zeroBSBase();

  // Track cash cumulative to this period-end and to the previous period-end
  // so the cash-flow base has opening/closing without a second query.
  let closingCash = 0;
  let openingCash = 0;

  for (const row of rows) {
    if (!row.period) continue;
    const inPeriod = row.period === periodKey;
    const cumulativeToDate = row.period <= periodKey;
    const cumulativeToPrev = row.period < periodKey;
    for (const line of row.lines) {
      const cls = classifyAccount(line.accountCode);
      if (!cls) continue;
      const amt = signedMinor(line, cls.creditNormal);
      if (cls.statement === 'pnl') {
        // P&L statement = period FLOW.
        if (inPeriod) pnlBase[cls.line] += amt;
        // Balance sheet = trial balance: current-year P&L must fold into
        // equity (credit-normal: credit−debit) cumulatively, or the
        // reconstructed BS won't balance (every posting balances, so
        // assets = liabilities + equity + retained current earnings).
        if (cumulativeToDate) {
          bsBase.retainedEarnings += (line.creditMinor || 0) - (line.debitMinor || 0);
        }
      } else {
        // Balance sheet — cumulative balances.
        if (cumulativeToDate) bsBase[cls.line] += amt;
        if (cls.line === 'cash') {
          if (cumulativeToDate) closingCash += amt;
          if (cumulativeToPrev) openingCash += amt;
        }
      }
    }
  }

  // Cash-flow base — first-cut: treat all in-period cash movement as operating
  // (no capex/financing tagging in GL yet). netCashChange then reconciles to
  // the measured opening→closing delta. Investing/financing split is a later
  // refinement once accounts carry a cash-flow category.
  const measuredCashChange = closingCash - openingCash;
  const cfBase = zeroCFBase();
  cfBase.openingCash = openingCash;
  cfBase.closingCash = closingCash;
  cfBase.measuredCashChange = measuredCashChange;
  cfBase.operatingCashFlow = measuredCashChange;
  // netIncome filled by the caller from finalisePnL(pnlBase) — leave 0 here.

  return { pnlBase, bsBase, cfBase, currency };
}

/** Open external receivables for aging / DSO. */
async function getArInvoices({ orgId, asOf } = {}) {
  const db = getFirestore();
  // client_invoices are issued by the parent (issuerOrgId: 'zeus-group'); a
  // brand's slice is identified via line sourceSubsidiaryId. For the group
  // (orgId zeus-group / undefined) we take all open invoices.
  const snap = await db
    .collection(CLIENT_INVOICES)
    .where('status', 'in', ['ISSUED', 'PART_PAID'])
    .get();
  const out = [];
  for (const d of snap.docs) {
    const inv = d.data() || {};
    if (d.id.endsWith(':active')) continue; // skip the UNIQUE lock doc
    const total = (inv.total && inv.total.amountMinor) || 0;
    const balanceMinor = total - (inv.paidMinor || 0);
    if (balanceMinor <= 0) continue;
    out.push({
      id: d.id,
      counterparty: inv.clientId || null,
      balanceMinor,
      currency: (inv.total && inv.total.currency) || 'UGX',
      issuedAt: inv.issuedAt || null,
      dueDate: inv.dueDate || null,
      status: inv.status,
      sourceSubsidiaryId: Array.isArray(inv.lines) && inv.lines[0]
        ? inv.lines[0].sourceSubsidiaryId
        : null,
    });
  }
  return out;
}

/** Open payables for aging / DPO. Group/parent AP = IC invoices it owes subs. */
async function getApBills({ orgId } = {}) {
  const db = getFirestore();
  const snap = await db
    .collection(IC_INVOICES)
    .where('status', 'in', ['RAISED', 'POSTED'])
    .get();
  const out = [];
  for (const d of snap.docs) {
    const inv = d.data() || {};
    // toOrgId is the payer. When scoping to a specific org, filter; group view
    // (zeus-group / undefined) keeps all.
    if (orgId && orgId !== 'zeus-group' && inv.toOrgId !== orgId) continue;
    const amountMinor = (inv.amount && inv.amount.amountMinor) || 0;
    if (amountMinor <= 0) continue;
    out.push({
      id: d.id,
      counterparty: inv.fromOrgId || null,
      balanceMinor: amountMinor,
      currency: (inv.amount && inv.amount.currency) || 'UGX',
      raisedAt: inv.raisedAt || inv.createdAt || null,
      dueDate: inv.dueDate || null,
      status: inv.status,
    });
  }
  return out;
}

/** Current cash & equivalents balance (GL cash accounts). */
async function getCashPosition({ orgId } = {}) {
  const db = getFirestore();
  const [rows, currency] = await Promise.all([
    loadPostings(db, orgId),
    loadOrgBaseCurrency(db, orgId),
  ]);
  let balanceMinor = 0;
  for (const row of rows) {
    for (const line of row.lines) {
      const cls = classifyAccount(line.accountCode);
      if (cls && cls.line === 'cash') balanceMinor += signedMinor(line, cls.creditNormal);
    }
  }
  return { balanceMinor, currency };
}

/** Pending expenditure queue (passthrough for the optimizer). */
async function getExpenditureQueue({ orgId } = {}) {
  const db = getFirestore();
  const path = orgId ? `companies/${orgId}/expenditure_queue` : 'companies/zeus-group/expenditure_queue';
  const snap = await db.collection(path).where('status', '==', 'pending').get().catch(() => null);
  if (!snap) return [];
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Test/maintenance hook to clear the postings cache. */
function _clearCache() {
  _postingsCache.clear();
}

module.exports = {
  getStatementBases,
  getArInvoices,
  getApBills,
  getCashPosition,
  getExpenditureQueue,
  // internals for unit tests
  _internals: {
    zeroPnLBase,
    zeroBSBase,
    zeroCFBase,
    postingPeriodKey,
    signedMinor,
    _clearCache,
  },
};
