// ============================================================================
// KPI AUTO-MEASUREMENT SERVICE
// DawinOS v2.0 — CEO Strategy Command
//
// Pulls live values for active KPIs whose library entry is marked
// `autoComputable: true`, writes them as KPIDataPoints with a stable
// `sourceReference` so subsequent syncs upsert in place (so corrections
// to the underlying finance/manufacturing data flow into the same
// measurement record rather than stacking duplicates).
//
// Supported library codes:
//   Finance (from QBO `pl_*` synced docs):
//     REV, GPM, OPM, NPM, RG, COSC, EXPC, GPG, OPG, NIG
//   Manufacturing (from `manufacturingOrders` collection):
//     DIFOT, REWORK, OCT
//
// Anything else (autoComputable: false) is left alone — those KPIs still
// require manual entry or a future module connector.
// ============================================================================

import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { kpiService } from './kpi.service';
import { kpiDataService } from './kpiData.service';
import { KPI_LIBRARY, type KPILibraryEntry } from '../constants/kpiLibrary.constants';
import { KPI_DATA_SOURCE, KPI_STATUS } from '../constants/kpi.constants';
import type { KPIDefinition } from '../types/kpi.types';

// ----------------------------------------------------------------------------
// Period helpers
// ----------------------------------------------------------------------------

interface Period {
  /** YYYY-MM key, used for sourceReference idempotency */
  key: string;
  date: Date;
  periodStart: Date;
  periodEnd: Date;
  fiscalYear: number;
  fiscalQuarter: number;
  fiscalMonth: number;
}

function currentMonthPeriod(now = new Date()): Period {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return {
    key: `${y}-${String(m + 1).padStart(2, '0')}`,
    date: end,
    periodStart: start,
    periodEnd: end,
    fiscalYear: y,
    fiscalQuarter: Math.floor(m / 3) + 1,
    fiscalMonth: m + 1,
  };
}

// ----------------------------------------------------------------------------
// QBO P&L loader — reuse path the strategy aggregator already uses
// ----------------------------------------------------------------------------

interface PLSnapshot {
  id: string;            // e.g. "pl_2026-05"
  startDate?: string;
  endDate?: string;
  income: any[];
  expenses: any[];
  costOfGoodsSold?: any[];
  otherIncome?: any[];
  otherExpenses?: any[];
  netIncome?: number;
  grossProfit?: number;
}

function sumRows(rows: any[] | undefined): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((s, r) => s + (Number(r?.amount) || 0), 0);
}

let plCache: { companyId: string; snaps: PLSnapshot[] } | null = null;

async function loadPLSnapshots(companyId: string): Promise<PLSnapshot[]> {
  if (plCache && plCache.companyId === companyId) return plCache.snaps;
  const snap = await getDocs(collection(db, 'companies', companyId, 'qbo_synced_data'));
  const snaps = snap.docs
    .filter(d => d.id.startsWith('pl_'))
    .map(d => ({ id: d.id, ...d.data() } as PLSnapshot))
    .sort((a, b) => a.id.localeCompare(b.id));
  plCache = { companyId, snaps };
  return snaps;
}

/** Reset the P&L cache. Call when finance data is known to have changed. */
export function invalidateAutoMeasurementCache(): void {
  plCache = null;
  mfgCache = null;
}

interface PLRollup {
  revenue: number;
  cogs: number;
  opex: number;
  grossProfit: number;
  operatingProfit: number;
  netIncome: number;
}

function rollupPL(pl: PLSnapshot | undefined): PLRollup | null {
  if (!pl) return null;
  const revenue = sumRows(pl.income) + sumRows(pl.otherIncome);
  const cogs = sumRows(pl.costOfGoodsSold);
  const opex = sumRows(pl.expenses) + sumRows(pl.otherExpenses);
  const grossProfit = pl.grossProfit ?? (revenue - cogs);
  const operatingProfit = grossProfit - opex;
  const netIncome = pl.netIncome ?? operatingProfit;
  return { revenue, cogs, opex, grossProfit, operatingProfit, netIncome };
}

// ----------------------------------------------------------------------------
// Manufacturing orders loader
// ----------------------------------------------------------------------------

interface MORollup {
  total: number;
  difot: number;   // delivered in full + on time
  rework: number;  // scrapQuantity > 0
  cycleSumDays: number;
  cycleCount: number;
}

let mfgCache: { companyId: string; rollup: MORollup; periodKey: string } | null = null;

async function loadMORollup(companyId: string, period: Period): Promise<MORollup> {
  if (mfgCache && mfgCache.companyId === companyId && mfgCache.periodKey === period.key) {
    return mfgCache.rollup;
  }

  const startTs = Timestamp.fromDate(period.periodStart);
  const endTs = Timestamp.fromDate(period.periodEnd);

  // Try the company-scoped path first, then fall back to top-level
  let docs: any[] = [];
  try {
    const q = query(
      collection(db, 'manufacturingOrders'),
      where('companyId', '==', companyId),
    );
    const snap = await getDocs(q);
    docs = snap.docs.map(d => d.data());
  } catch {
    /* ignore */
  }
  if (docs.length === 0) {
    try {
      const snap = await getDocs(collection(db, 'manufacturingOrders'));
      docs = snap.docs.map(d => d.data());
    } catch {
      /* ignore */
    }
  }

  // Filter to orders completed within the period
  const inPeriod = docs.filter(o => {
    const completed = o.completedAt;
    if (!completed) return false;
    return completed >= startTs && completed <= endTs;
  });

  let difot = 0;
  let rework = 0;
  let cycleSumDays = 0;
  let cycleCount = 0;

  inPeriod.forEach(o => {
    const qty = Number(o.quantity) || 0;
    const completedQty = Number(o.completedQuantity) || 0;
    const scrap = Number(o.scrapQuantity) || 0;
    const inFull = completedQty >= qty && qty > 0;
    const due = o.dueDate;
    const completed = o.completedAt;
    const onTime = !due || (completed && due && completed.toMillis() <= due.toMillis());
    if (inFull && onTime) difot++;
    if (scrap > 0) rework++;

    const orderDate = o.orderDate || o.createdAt;
    if (orderDate && completed) {
      const ms = completed.toMillis() - orderDate.toMillis();
      if (ms > 0) {
        cycleSumDays += ms / (1000 * 60 * 60 * 24);
        cycleCount++;
      }
    }
  });

  const rollup: MORollup = {
    total: inPeriod.length,
    difot,
    rework,
    cycleSumDays,
    cycleCount,
  };
  mfgCache = { companyId, rollup, periodKey: period.key };
  return rollup;
}

// ----------------------------------------------------------------------------
// Per-code compute
// ----------------------------------------------------------------------------

export interface AutoComputeResult {
  value: number;
  /** Stable key — same period + same code = same data point */
  sourceReference: string;
  period: Period;
  note?: string;
}

async function computeFinanceValue(
  code: string,
  companyId: string,
  period: Period,
): Promise<AutoComputeResult | null> {
  const snaps = await loadPLSnapshots(companyId);
  if (snaps.length === 0) return null;

  // Pick the latest P&L (most recent)
  const latest = snaps[snaps.length - 1];
  const prev = snaps.length > 1 ? snaps[snaps.length - 2] : undefined;

  const current = rollupPL(latest);
  const previous = rollupPL(prev);
  if (!current) return null;

  const periodKey = latest.id; // e.g. pl_2026-05 — anchor to the source doc
  const sourceReference = `auto:finance:${periodKey}:${code}`;
  const baseNote = `Auto-computed from ${latest.id}${latest.startDate ? ` (${latest.startDate} → ${latest.endDate})` : ''}`;

  const pct = (numerator: number, denominator: number) =>
    denominator !== 0 ? (numerator / denominator) * 100 : 0;
  const growth = (cur: number, prv: number) =>
    prv !== 0 ? ((cur - prv) / Math.abs(prv)) * 100 : 0;

  let value: number;
  switch (code) {
    case 'REV': value = current.revenue; break;
    case 'GPM': value = pct(current.grossProfit, current.revenue); break;
    case 'OPM': value = pct(current.operatingProfit, current.revenue); break;
    case 'NPM': value = pct(current.netIncome, current.revenue); break;
    case 'RG':  if (!previous) return null; value = growth(current.revenue, previous.revenue); break;
    case 'COSC': if (!previous) return null; value = growth(current.cogs, previous.cogs); break;
    case 'EXPC': if (!previous) return null; value = growth(current.opex, previous.opex); break;
    case 'GPG':  if (!previous) return null; value = growth(current.grossProfit, previous.grossProfit); break;
    case 'OPG':  if (!previous) return null; value = growth(current.operatingProfit, previous.operatingProfit); break;
    case 'NIG':  if (!previous) return null; value = growth(current.netIncome, previous.netIncome); break;
    default: return null;
  }

  // Anchor the period record to the QBO snapshot's date range when available
  let finalPeriod = period;
  if (latest.startDate && latest.endDate) {
    const start = new Date(latest.startDate);
    const end = new Date(latest.endDate);
    finalPeriod = {
      key: latest.id.replace(/^pl_/, ''),
      date: end,
      periodStart: start,
      periodEnd: end,
      fiscalYear: end.getFullYear(),
      fiscalQuarter: Math.floor(end.getMonth() / 3) + 1,
      fiscalMonth: end.getMonth() + 1,
    };
  }

  return { value, sourceReference, period: finalPeriod, note: baseNote };
}

async function computeManufacturingValue(
  code: string,
  companyId: string,
  period: Period,
): Promise<AutoComputeResult | null> {
  const rollup = await loadMORollup(companyId, period);
  if (rollup.total === 0) return null;

  let value: number;
  let label = '';
  switch (code) {
    case 'DIFOT':
      value = (rollup.difot / rollup.total) * 100;
      label = `${rollup.difot}/${rollup.total} orders delivered in-full & on-time`;
      break;
    case 'REWORK':
      value = (rollup.rework / rollup.total) * 100;
      label = `${rollup.rework}/${rollup.total} orders required rework (scrap > 0)`;
      break;
    case 'OCT':
      if (rollup.cycleCount === 0) return null;
      value = rollup.cycleSumDays / rollup.cycleCount;
      label = `Mean cycle across ${rollup.cycleCount} completed orders`;
      break;
    default:
      return null;
  }

  return {
    value,
    sourceReference: `auto:manufacturing:${period.key}:${code}`,
    period,
    note: `Auto-computed for ${period.key} — ${label}`,
  };
}

/**
 * Look up a KPI's library entry. Falls back to matching by code when
 * libraryEntryId is missing (legacy KPIs created before the link existed).
 */
function findLibraryEntry(kpi: KPIDefinition): KPILibraryEntry | null {
  if (kpi.libraryEntryId) {
    const byId = KPI_LIBRARY.find(e => e.id === kpi.libraryEntryId);
    if (byId) return byId;
  }
  return KPI_LIBRARY.find(e => e.code === kpi.code) ?? null;
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

export function isKPIAutoComputable(kpi: KPIDefinition): boolean {
  const entry = findLibraryEntry(kpi);
  return !!entry?.moduleLinkage?.autoComputable;
}

export async function computeAutoValueFor(
  companyId: string,
  kpi: KPIDefinition,
  period: Period = currentMonthPeriod(),
): Promise<AutoComputeResult | null> {
  const entry = findLibraryEntry(kpi);
  if (!entry?.moduleLinkage?.autoComputable) return null;

  switch (entry.moduleLinkage.module) {
    case 'finance':
      return computeFinanceValue(entry.code, companyId, period);
    case 'manufacturing':
      return computeManufacturingValue(entry.code, companyId, period);
    // Future: 'hr', 'sales', 'operations'
    default:
      return null;
  }
}

export interface AutoSyncResult {
  kpiId: string;
  code: string;
  status: 'updated' | 'inserted' | 'skipped' | 'error';
  value?: number;
  reason?: string;
}

/**
 * Sync a single KPI. Returns 'skipped' if the KPI isn't auto-computable
 * or its compute function returned null (no source data yet).
 */
export async function syncSingleKPI(
  companyId: string,
  kpi: KPIDefinition,
  userId: string,
  userName?: string,
): Promise<AutoSyncResult> {
  try {
    if (!isKPIAutoComputable(kpi)) {
      return { kpiId: kpi.id, code: kpi.code, status: 'skipped', reason: 'not auto-computable' };
    }

    const compute = await computeAutoValueFor(companyId, kpi);
    if (!compute) {
      return { kpiId: kpi.id, code: kpi.code, status: 'skipped', reason: 'no source data' };
    }

    // Detect whether the data point already exists (for status reporting)
    const existing = await kpiDataService.getDataPoints(companyId, kpi.id, { maxResults: 50 });
    const matched = existing.find(dp => dp.sourceReference === compute.sourceReference);

    await kpiDataService.recordDataPoint(
      companyId,
      {
        kpiId: kpi.id,
        date: compute.period.date,
        periodStart: compute.period.periodStart,
        periodEnd: compute.period.periodEnd,
        fiscalYear: compute.period.fiscalYear,
        fiscalQuarter: compute.period.fiscalQuarter,
        fiscalMonth: compute.period.fiscalMonth,
        value: compute.value,
        note: compute.note,
        sourceReference: compute.sourceReference,
        dataSourceOverride: KPI_DATA_SOURCE.CALCULATED,
      },
      userId,
      userName,
    );

    return {
      kpiId: kpi.id,
      code: kpi.code,
      status: matched ? 'updated' : 'inserted',
      value: compute.value,
    };
  } catch (err) {
    console.warn(`[kpiAutoMeasurement] sync failed for ${kpi.code}:`, err);
    return {
      kpiId: kpi.id,
      code: kpi.code,
      status: 'error',
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Sync all auto-computable active KPIs in one pass. Invalidates the
 * source-data cache first so corrections are picked up.
 */
export async function syncAllAutoKPIs(
  companyId: string,
  userId: string,
  userName?: string,
): Promise<AutoSyncResult[]> {
  invalidateAutoMeasurementCache();
  const kpis = await kpiService.getKPIs(companyId, { status: KPI_STATUS.ACTIVE });
  const autoOnly = kpis.filter(isKPIAutoComputable);
  // Serialise to avoid hammering Firestore with parallel reads, but cache
  // takes care of repeated source loads.
  const results: AutoSyncResult[] = [];
  for (const kpi of autoOnly) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await syncSingleKPI(companyId, kpi, userId, userName));
  }
  return results;
}

/**
 * One-shot helper for callers that just want the auto-pipeline to refresh
 * the denormalised `currentValue` on every active KPI. Safe to fire-and-forget
 * from page mounts.
 */
export async function refreshActiveKPIsInBackground(
  companyId: string,
  userId: string,
  userName?: string,
): Promise<void> {
  try {
    await syncAllAutoKPIs(companyId, userId, userName);
  } catch (err) {
    console.warn('[kpiAutoMeasurement] background refresh failed:', err);
  }
}
