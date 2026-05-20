// ============================================================================
// FORECAST SERVICE
// DawinOS v2.0 - Finance Module
// Firestore CRUD for forecasts + triggers the forecast engine
// ============================================================================

import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  collection, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ForecastMetadata,
  ForecastPeriod,
  ValueRule,
  WorkingCapitalDrivers,
  BSForecast,
  PLAccountDetail,
  PLSection,
  BSAccountDetail,
  BSSection,
  CapExItem,
  LoanScheduleItem,
  CapitalEvent,
  DividendSchedule,
  MicroForecastInputs,
} from '../types/forecast.types';
import { offsetPeriod, DEFAULT_WC_DRIVERS } from '../types/forecast.types';
import {
  runForecastEngine,
  type PLInputs,
} from './forecastEngine';
import {
  getQBOBalanceSheet, getQBOAccounts, getAvailablePLReports,
  getMonthlyPLReports, getMonthlyBSReports, getMonthlyCFReports,
} from './qboSyncService';
import type { QBOProfitAndLoss } from '../types/integrations.types';

// ============================================================================
// FORECAST CRUD
// ============================================================================

/** Create a new forecast document. Returns the new forecastId. */
export async function createForecast(
  companyId: string,
  name: string,
  horizon = 12,
  fiscalYearStart = 7,
  currency = 'USD'
): Promise<string> {
  const now = new Date();
  // First forecast period = current month
  const firstPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const metadata: Omit<ForecastMetadata, 'id'> = {
    companyId,
    name,
    horizon,
    fiscalYearStart,
    currency,
    drivers: DEFAULT_WC_DRIVERS,
    openingBS: null,
    firstForecastPeriod: firstPeriod,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const ref = await addDoc(
    collection(db, 'companies', companyId, 'forecasts'),
    metadata
  );
  return ref.id;
}

/** Load forecast metadata. Returns null if not found. */
export async function getForecastMetadata(
  companyId: string,
  forecastId: string
): Promise<ForecastMetadata | null> {
  const snap = await getDoc(doc(db, 'companies', companyId, 'forecasts', forecastId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ForecastMetadata;
}

/** List all forecasts for a company */
export async function listForecasts(companyId: string): Promise<ForecastMetadata[]> {
  const snap = await getDocs(
    query(
      collection(db, 'companies', companyId, 'forecasts'),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as ForecastMetadata);
}

/** Update working-capital drivers (triggers re-calculation on next load) */
export async function updateDrivers(
  companyId: string,
  forecastId: string,
  drivers: WorkingCapitalDrivers
): Promise<void> {
  await updateDoc(
    doc(db, 'companies', companyId, 'forecasts', forecastId),
    { drivers, updatedAt: serverTimestamp() }
  );
}

/** Delete a forecast and all its sub-collections */
export async function deleteForecast(companyId: string, forecastId: string): Promise<void> {
  // Note: sub-collections (rules, periods) are NOT auto-deleted by Firestore client SDK.
  // For production, a Cloud Function trigger handles deep deletion.
  await deleteDoc(doc(db, 'companies', companyId, 'forecasts', forecastId));
}

// ============================================================================
// VALUE RULE CRUD
// ============================================================================

/** Upsert a value rule for an account within this forecast */
export async function saveValueRule(
  companyId: string,
  forecastId: string,
  rule: Omit<ValueRule, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const rulesCol = collection(
    db, 'companies', companyId, 'forecasts', forecastId, 'value_rules'
  );
  // Check if a rule already exists for this accountId
  const existing = await getDocs(rulesCol);
  const existingDoc = existing.docs.find(
    d => (d.data() as ValueRule).accountId === rule.accountId
  );

  const data = {
    ...rule,
    forecastId,
    updatedAt: serverTimestamp(),
  };

  if (existingDoc) {
    await updateDoc(existingDoc.ref, data);
    return existingDoc.id;
  }

  const ref = await addDoc(rulesCol, { ...data, createdAt: serverTimestamp() });
  return ref.id;
}

/** Load all value rules for a forecast */
export async function getValueRules(
  companyId: string,
  forecastId: string
): Promise<ValueRule[]> {
  const snap = await getDocs(
    collection(db, 'companies', companyId, 'forecasts', forecastId, 'value_rules')
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as ValueRule);
}

/** Delete a single value rule */
export async function deleteValueRule(
  companyId: string,
  forecastId: string,
  ruleId: string
): Promise<void> {
  await deleteDoc(
    doc(db, 'companies', companyId, 'forecasts', forecastId, 'value_rules', ruleId)
  );
}

// ============================================================================
// MICRO FORECAST CRUD (Phase 2)
// ============================================================================

function microCol(companyId: string, forecastId: string, type: string) {
  return collection(db, 'companies', companyId, 'forecasts', forecastId, `micro_${type}`);
}

// ── CapEx ──

export async function getCapExItems(companyId: string, forecastId: string): Promise<CapExItem[]> {
  const snap = await getDocs(microCol(companyId, forecastId, 'capex'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as CapExItem);
}

export async function saveCapExItem(
  companyId: string, forecastId: string,
  item: Omit<CapExItem, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(microCol(companyId, forecastId, 'capex'), {
    ...item, forecastId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCapExItem(
  companyId: string, forecastId: string, itemId: string,
  data: Partial<Omit<CapExItem, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await updateDoc(
    doc(db, 'companies', companyId, 'forecasts', forecastId, 'micro_capex', itemId),
    { ...data, updatedAt: serverTimestamp() }
  );
}

export async function deleteCapExItem(companyId: string, forecastId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'companies', companyId, 'forecasts', forecastId, 'micro_capex', itemId));
}

// ── Loans ──

export async function getLoanItems(companyId: string, forecastId: string): Promise<LoanScheduleItem[]> {
  const snap = await getDocs(microCol(companyId, forecastId, 'loans'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as LoanScheduleItem);
}

export async function saveLoanItem(
  companyId: string, forecastId: string,
  item: Omit<LoanScheduleItem, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(microCol(companyId, forecastId, 'loans'), {
    ...item, forecastId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateLoanItem(
  companyId: string, forecastId: string, itemId: string,
  data: Partial<Omit<LoanScheduleItem, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  await updateDoc(
    doc(db, 'companies', companyId, 'forecasts', forecastId, 'micro_loans', itemId),
    { ...data, updatedAt: serverTimestamp() }
  );
}

export async function deleteLoanItem(companyId: string, forecastId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'companies', companyId, 'forecasts', forecastId, 'micro_loans', itemId));
}

// ── Capital Events ──

export async function getCapitalEvents(companyId: string, forecastId: string): Promise<CapitalEvent[]> {
  const snap = await getDocs(microCol(companyId, forecastId, 'capital_events'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as CapitalEvent);
}

export async function saveCapitalEvent(
  companyId: string, forecastId: string,
  item: Omit<CapitalEvent, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(microCol(companyId, forecastId, 'capital_events'), {
    ...item, forecastId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteCapitalEvent(companyId: string, forecastId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'companies', companyId, 'forecasts', forecastId, 'micro_capital_events', itemId));
}

// ── Dividends ──

export async function getDividendSchedules(companyId: string, forecastId: string): Promise<DividendSchedule[]> {
  const snap = await getDocs(microCol(companyId, forecastId, 'dividends'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as DividendSchedule);
}

export async function saveDividendSchedule(
  companyId: string, forecastId: string,
  item: Omit<DividendSchedule, 'id' | 'forecastId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const ref = await addDoc(microCol(companyId, forecastId, 'dividends'), {
    ...item, forecastId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteDividendSchedule(companyId: string, forecastId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(db, 'companies', companyId, 'forecasts', forecastId, 'micro_dividends', itemId));
}

// ── Load all micro forecasts at once ──

export async function loadMicroForecasts(companyId: string, forecastId: string): Promise<MicroForecastInputs> {
  const [capex, loans, capitalEvents, dividends] = await Promise.all([
    getCapExItems(companyId, forecastId),
    getLoanItems(companyId, forecastId),
    getCapitalEvents(companyId, forecastId),
    getDividendSchedules(companyId, forecastId),
  ]);
  return { capex, loans, capitalEvents, dividends };
}

// ============================================================================
// STORED FORECAST PERIODS
// ============================================================================

/** Persist calculated forecast periods to Firestore */
async function storeForecastPeriods(
  companyId: string,
  forecastId: string,
  periods: ForecastPeriod[]
): Promise<void> {
  for (const fp of periods) {
    await setDoc(
      doc(db, 'companies', companyId, 'forecasts', forecastId, 'periods', fp.period),
      { pl: fp.pl, bs: fp.bs, cfs: fp.cfs }
    );
  }
}

/** Load stored forecast periods */
export async function loadForecastPeriods(
  companyId: string,
  forecastId: string
): Promise<ForecastPeriod[]> {
  const snap = await getDocs(
    collection(db, 'companies', companyId, 'forecasts', forecastId, 'periods')
  );
  return snap.docs
    .map(d => ({ period: d.id, ...d.data() }) as ForecastPeriod)
    .sort((a, b) => a.period.localeCompare(b.period));
}

// ============================================================================
// QBO ACTUALS EXTRACTION
// ============================================================================

export type PLActuals = { revenue: number; cogs: number; opex: number; depreciation: number; interest: number; tax: number };

export interface BSActuals {
  cash: number;
  receivables: number;
  inventory: number;
  prepaid: number;
  ppe: number;
  accDepreciation: number;
  payables: number;
  accrued: number;
  taxPayable: number;
  ltDebt: number;
  shareCapital: number;
  retainedEarnings: number;
  totalCurrentAssets: number;
  totalNonCurrentAssets: number;
  totalAssets: number;
  totalCurrentLiabilities: number;
  totalNonCurrentLiabilities: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface CFSActuals {
  operating: number;
  investing: number;
  financing: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
  // QBO CF detail fields (for historical line-item display)
  // Operating
  netIncome?: number;
  depreciation?: number;
  adjustments?: number;
  cashTaxPaid?: number;
  changeInAccountsPayable?: number;
  changeInOtherCurrentLiabilities?: number;
  changeInAccountsReceivable?: number;
  changeInInventory?: number;
  changeInWorkInProgress?: number;
  changeInOtherCurrentAssets?: number;
  // Investing
  changeInFixedAssets?: number;
  changeInIntangibleAssets?: number;
  changeInInvestments?: number;
  // Financing
  changeInRetainedEarnings?: number;
  dividends?: number;
  changeInNonCurrentLiabilities?: number;
  netInterest?: number;
}

export interface HistoricalPeriodData {
  pl: PLActuals;
  bs: BSActuals | null;
  cfs: CFSActuals | null;
  /** Per-account P&L values: { accountId → amount } */
  plAccounts?: Record<string, number>;
}

// ============================================================================
// DETAILED P&L ACCOUNT EXTRACTION
// ============================================================================

/** Classify an individual P&L account label into the engine's classification buckets */
function classifyPLAccount(
  label: string,
  section: PLSection
): PLAccountDetail['classification'] {
  const lbl = label.toLowerCase();

  // Check for special classifications within expenses
  if (section === 'expenses') {
    if (lbl.includes('depreciation') || lbl.includes('amortis') || lbl.includes('amortiz')) return 'depreciation';
    if (lbl.includes('interest') && !lbl.includes('interest income')) return 'interest';
    if (lbl.includes('income tax') || lbl === 'tax' || lbl.includes('tax expense') || lbl.includes('tax provision')) return 'tax';
  }

  // Section-based classification
  switch (section) {
    case 'income':         return 'revenue';
    case 'otherIncome':    return 'revenue';
    case 'costOfGoodsSold': return 'cogs';
    case 'expenses':       return 'opex';
    case 'otherExpenses':  return 'opex';
    default:               return 'opex';
  }
}

/** Create a stable account ID from section + label */
function makeAccountId(section: string, label: string, parentGroup?: string): string {
  const parts = [section];
  if (parentGroup) parts.push(parentGroup);
  parts.push(label);
  return parts
    .join('__')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

/** Map QBO accountType to PLSection */
function accountTypeToPLSection(accountType: string): PLSection | null {
  const map: Record<string, PLSection> = {
    'Income': 'income',
    'Cost of Goods Sold': 'costOfGoodsSold',
    'Expense': 'expenses',
    'Other Income': 'otherIncome',
    'Other Expense': 'otherExpenses',
  };
  return map[accountType] ?? null;
}

// ============================================================================
// BS ACCOUNT MAPPING
// ============================================================================

const ACCOUNT_TYPE_TO_BS_SECTION: Record<string, BSSection> = {
  'Bank': 'currentAssets',
  'Accounts Receivable': 'currentAssets',
  'Other Current Asset': 'currentAssets',
  'Fixed Asset': 'nonCurrentAssets',
  'Other Asset': 'nonCurrentAssets',
  'Accounts Payable': 'currentLiabilities',
  'Credit Card': 'currentLiabilities',
  'Other Current Liability': 'currentLiabilities',
  'Long Term Liability': 'nonCurrentLiabilities',
  'Equity': 'equity',
};

/** Map a QBO account to the forecast engine's BS field for proportional distribution */
function guessBSEngineKey(accountType: string, name: string): string {
  const n = name.toLowerCase();
  switch (accountType) {
    case 'Bank': return 'cash';
    case 'Accounts Receivable': return 'receivables';
    case 'Other Current Asset':
      if (n.includes('inventor')) return 'inventory';
      return 'prepaid';
    case 'Fixed Asset': return 'ppe';
    case 'Other Asset': return 'ppe';
    case 'Accounts Payable': return 'payables';
    case 'Credit Card': return 'payables';
    case 'Other Current Liability':
      if (n.includes('tax')) return 'taxPayable';
      return 'accrued';
    case 'Long Term Liability': return 'ltDebt';
    case 'Equity':
      if (n.includes('retained') || n.includes('earning')) return 'retainedEarnings';
      return 'shareCapital';
    default: return 'cash';
  }
}

/** Fetch BS account details from QBO chart of accounts */
export async function getBSAccountDetails(companyId: string): Promise<BSAccountDetail[]> {
  const qboAccounts = await getQBOAccounts(companyId);
  return qboAccounts
    .filter(a => a.active && ['Asset', 'Liability', 'Equity'].includes(a.classification))
    .map(a => {
      const parts = a.fullyQualifiedName.split(':');
      return {
        id: `bs__${a.accountType.toLowerCase().replace(/\s+/g, '_')}__${a.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')}`,
        label: a.name,
        section: (ACCOUNT_TYPE_TO_BS_SECTION[a.accountType] || 'currentAssets') as BSSection,
        accountType: a.accountType,
        bsEngineKey: guessBSEngineKey(a.accountType, a.name),
        parentGroup: parts.length > 1 ? parts[0] : undefined,
        currentBalance: Math.abs(a.currentBalance),
      };
    });
}

/** Recursively flatten QBOReportRow[] into individual account rows */
function flattenQBORows(
  rows: Array<{ label?: string; group?: string; value: number; subRows?: Array<{ label?: string; group?: string; value: number; subRows?: any[] }> }>,
  section: PLSection,
  parentGroup?: string
): Array<{ id: string; label: string; section: PLSection; classification: PLAccountDetail['classification']; parentGroup?: string; value: number }> {
  const result: Array<{ id: string; label: string; section: PLSection; classification: PLAccountDetail['classification']; parentGroup?: string; value: number }> = [];

  for (const row of rows) {
    const label = (row.label || row.group || '').trim();
    if (!label) continue;

    if (Array.isArray(row.subRows) && row.subRows.length > 0) {
      // This is a group — recurse into sub-rows
      const children = flattenQBORows(row.subRows as typeof rows, section, label);
      result.push(...children);
    } else {
      // Leaf account
      result.push({
        id: makeAccountId(section, label, parentGroup),
        label,
        section,
        classification: classifyPLAccount(label, section),
        parentGroup,
        value: typeof row.value === 'number' ? row.value : 0,
      });
    }
  }

  return result;
}

/**
 * Fetch detailed per-account P&L history from QBO.
 * Returns a unified list of PLAccountDetail with values per period,
 * plus full HistoricalPeriodData (aggregate P&L, BS, CFS) per period.
 */
export async function getDetailedPLHistory(
  companyId: string,
  lookbackMonths: number,
  firstForecastPeriod: string
): Promise<{
  accounts: PLAccountDetail[];
  periodData: Record<string, HistoricalPeriodData>;
}> {
  const accountMap = new Map<string, PLAccountDetail>();
  const periodData: Record<string, HistoricalPeriodData> = {};

  const SECTIONS: Array<{ key: PLSection; field: keyof Pick<QBOProfitAndLoss, 'income' | 'costOfGoodsSold' | 'expenses' | 'otherIncome' | 'otherExpenses'> }> = [
    { key: 'income',          field: 'income' },
    { key: 'costOfGoodsSold', field: 'costOfGoodsSold' },
    { key: 'expenses',        field: 'expenses' },
    { key: 'otherIncome',     field: 'otherIncome' },
    { key: 'otherExpenses',   field: 'otherExpenses' },
  ];

  // ── Pre-compute all periods and batch-fetch monthly data in parallel ──
  const lookbackPeriods: Array<{ period: string; start: string; end: string }> = [];
  for (let i = lookbackMonths; i >= 1; i--) {
    const period = offsetPeriod(firstForecastPeriod, -i);
    const [y, m] = period.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    lookbackPeriods.push({
      period,
      start: `${period}-01`,
      end: `${period}-${String(lastDay).padStart(2, '0')}`,
    });
  }

  // Batch-fetch all monthly P&L, BS, CF docs in parallel

  const [plMap, bsMap, cfMap] = await Promise.all([
    getMonthlyPLReports(companyId, lookbackPeriods.map(p => ({ start: p.start, end: p.end }))),
    getMonthlyBSReports(companyId, lookbackPeriods.map(p => p.end)),
    getMonthlyCFReports(companyId, lookbackPeriods.map(p => ({ start: p.start, end: p.end }))),
  ]);

  console.log(`[ForecastService] Monthly docs found — P&L: ${plMap.size}/${lookbackPeriods.length}, BS: ${bsMap.size}/${lookbackPeriods.length}, CF: ${cfMap.size}/${lookbackPeriods.length}`);
  if (plMap.size > 0) {
    try {
      const firstPL = Array.from(plMap.values())[0];
      console.log('[ForecastService] Sample P&L — COGS:', (firstPL.costOfGoodsSold||[]).length,
        'Income:', (firstPL.income||[]).length, 'Expenses:', (firstPL.expenses||[]).length);
    } catch (e) { /* ignore */ }
  }
  if (bsMap.size > 0) {
    try {
      const firstBS = Array.from(bsMap.values())[0];
      console.log('[ForecastService] Sample BS — assets:', (firstBS.assets||[]).length,
        'liabs:', (firstBS.liabilities||[]).length, 'equity:', (firstBS.equity||[]).length);
    } catch (e) { /* ignore */ }
  }

  // Process each period from the pre-fetched maps
  for (const { period } of lookbackPeriods) {
    const pl = plMap.get(period) ?? null;
    const bs = bsMap.get(period) ?? null;
    const cfs = cfMap.get(period) ?? null;

    // ── Extract per-account P&L detail ──
    const periodAccountValues: Record<string, number> = {};
    if (pl) {
      for (const { key: section, field } of SECTIONS) {
        const rows = pl[field] || [];
        const flattened = flattenQBORows(rows as any, section);
        for (const acct of flattened) {
          // Upsert into master account list
          if (!accountMap.has(acct.id)) {
            accountMap.set(acct.id, {
              id: acct.id,
              label: acct.label,
              section: acct.section,
              classification: acct.classification,
              parentGroup: acct.parentGroup,
              values: {},
            });
          }
          accountMap.get(acct.id)!.values[period] = acct.value;
          periodAccountValues[acct.id] = acct.value;
        }
      }
    }

    // ── Aggregate P&L ──
    const plActuals: PLActuals = pl ? {
      revenue:      sumRows(pl.income) + sumRows(pl.otherIncome),
      cogs:         sumRows(pl.costOfGoodsSold),
      opex:         sumRows(pl.expenses) + sumRows(pl.otherExpenses),
      depreciation: 0,
      interest:     0,
      tax:          0,
    } : { revenue: 0, cogs: 0, opex: 0, depreciation: 0, interest: 0, tax: 0 };

    // ── Extract Balance Sheet ──
    let bsActuals: BSActuals | null = null;
    if (bs) {
      const cash        = sumLabelRows(bs.assets, ['cash', 'bank']);
      const receivables = sumLabelRows(bs.assets, ['receivable', 'debtor']);
      const inventory   = sumLabelRows(bs.assets, ['inventor']);
      const prepaid     = sumLabelRows(bs.assets, ['prepaid']);
      const ppe         = sumLabelRows(bs.assets, ['property', 'equipment', 'vehicle', 'plant', 'machinery']);
      const accDeprec   = Math.abs(sumLabelRows(bs.assets, ['depreciation', 'amortis', 'amortiz']));
      const payables    = sumLabelRows(bs.liabilities, ['payable', 'creditor', 'accounts pay']);
      const accrued     = sumLabelRows(bs.liabilities, ['accrued', 'accrual']);
      const taxPayable  = sumLabelRows(bs.liabilities, ['tax payable', 'gst', 'vat', 'income tax']);
      const ltDebt      = sumLabelRows(bs.liabilities, ['loan', 'borrowing', 'long-term', 'mortgage', 'note pay']);
      const stDebt      = sumLabelRows(bs.liabilities, ['overdraft', 'line of credit', 'current port']);
      const shareCapital     = sumLabelRows(bs.equity, ['capital', 'share', 'paid-in', 'common stock']);
      const retainedEarnings = sumLabelRows(bs.equity, ['retained', 'earnings', 'accumulated']);

      const totalCurrentAssets     = cash + receivables + inventory + prepaid;
      const totalNonCurrentAssets  = (ppe - accDeprec);
      const totalAssets            = bs.totalAssets || (totalCurrentAssets + totalNonCurrentAssets);
      const totalCurrentLiab       = payables + accrued + taxPayable + stDebt;
      const totalNonCurrentLiab    = ltDebt;
      const totalLiabilities       = bs.totalLiabilities || (totalCurrentLiab + totalNonCurrentLiab);
      const totalEquity            = bs.totalEquity || (shareCapital + retainedEarnings);

      bsActuals = {
        cash, receivables, inventory, prepaid, ppe, accDepreciation: accDeprec,
        payables, accrued, taxPayable, ltDebt,
        shareCapital, retainedEarnings,
        totalCurrentAssets, totalNonCurrentAssets, totalAssets,
        totalCurrentLiabilities: totalCurrentLiab,
        totalNonCurrentLiabilities: totalNonCurrentLiab,
        totalLiabilities, totalEquity,
      };
    }

    // ── Extract Cash Flow ──
    let cfsActuals: CFSActuals | null = null;
    if (cfs) {
      const netChange    = cfs.netCashFlow;
      const closingCash  = sumLabelRows(bs?.assets ?? [], ['cash', 'bank']);
      const openingCash  = closingCash - netChange;

      // Compute net income from P&L actuals
      const netIncome = plActuals.revenue - plActuals.cogs - plActuals.opex - plActuals.depreciation - plActuals.interest - plActuals.tax;

      cfsActuals = {
        operating:   cfs.operatingCashFlow,
        investing:   cfs.freeCashFlow - cfs.operatingCashFlow,
        financing:   netChange - (cfs.freeCashFlow - cfs.operatingCashFlow) - cfs.operatingCashFlow,
        netChange,
        openingCash,
        closingCash,
        // Operating detail fields
        netIncome,
        depreciation: plActuals.depreciation,  // Only from actual P&L depreciation accounts
        adjustments: cfs.adjustments || 0,
        cashTaxPaid: cfs.cashTaxPaid,
        changeInAccountsPayable: cfs.changeInAccountsPayable,
        changeInOtherCurrentLiabilities: cfs.changeInOtherCurrentLiabilities,
        changeInAccountsReceivable: cfs.changeInAccountsReceivable,
        changeInInventory: cfs.changeInInventory,
        changeInWorkInProgress: cfs.changeInWorkInProgress,
        changeInOtherCurrentAssets: cfs.changeInOtherCurrentAssets,
        // Investing detail fields
        changeInFixedAssets: cfs.changeInFixedAssets,
        changeInIntangibleAssets: cfs.changeInIntangibleAssets,
        changeInInvestments: cfs.changeInInvestments,
        // Financing detail fields
        changeInRetainedEarnings: cfs.changeInRetainedEarnings,
        dividends: cfs.dividends,
        changeInNonCurrentLiabilities: cfs.changeInOtherNonCurrentLiabilities,
        netInterest: cfs.netInterest,
      };
    }

    periodData[period] = { pl: plActuals, bs: bsActuals, cfs: cfsActuals, plAccounts: periodAccountValues };
  }

  // Debug: account extraction + BS aggregate variation
  const sectionCounts: Record<string, number> = {};
  for (const acct of accountMap.values()) {
    sectionCounts[acct.section] = (sectionCounts[acct.section] || 0) + 1;
  }
  console.log('[ForecastService] Accounts by section:', JSON.stringify(sectionCounts), '| total:', accountMap.size);
  // Check BS variation across months — flag if QBO returns identical snapshots
  const bsPeriods = Object.entries(periodData).filter(([, d]) => d.bs);
  if (bsPeriods.length >= 2) {
    const [, first] = bsPeriods[0];
    const [, second] = bsPeriods[1];
    const b1 = first.bs!;
    const b2 = second.bs!;
    if (b1.cash === b2.cash && b1.receivables === b2.receivables && b1.inventory === b2.inventory && b1.payables === b2.payables) {
      console.warn('[ForecastService] ⚠ BS data is IDENTICAL across months — QBO is returning the same cumulative snapshot for all as_of_date values. This is a QBO data characteristic (transactions may not be backdated to individual months). BS historical will show the same values across all periods.');
    }
  }

  // Log CFS detail for first period to verify field mapping
  const firstCFS = Object.entries(periodData).find(([, d]) => d.cfs);
  if (firstCFS) {
    const [p, d] = firstCFS;
    const c = d.cfs!;
    console.log(`[ForecastService] CFS ${p}: netIncome=${c.netIncome} adj=${c.adjustments} dAR=${c.changeInAccountsReceivable} dInv=${c.changeInInventory} dAP=${c.changeInAccountsPayable} dOCL=${c.changeInOtherCurrentLiabilities} taxPaid=${c.cashTaxPaid} operating=${c.operating}`);
  }

  // ── FALLBACK: If no accounts extracted from monthly P&L docs, use available P&L reports ──
  if (accountMap.size === 0) {
    console.warn('[ForecastService] ⚠ FALLBACK ACTIVE: No monthly P&L data found. Using fiscal-year proration. Trigger a full QBO sync from Finance > Integrations to get real monthly data.');
    const [qboAccounts, plReports] = await Promise.all([
      getQBOAccounts(companyId),
      getAvailablePLReports(companyId),
    ]);

    // Build name → QBOAccount lookup for parentGroup enrichment
    const qboNameMap = new Map<string, { fullyQualifiedName: string; accountType: string }>();
    for (const a of qboAccounts) {
      if (a.active) qboNameMap.set(a.name.toLowerCase().trim(), a);
    }

    const REPORT_SECTIONS: Array<{ key: PLSection; field: keyof Pick<QBOProfitAndLoss, 'income' | 'costOfGoodsSold' | 'expenses' | 'otherIncome' | 'otherExpenses'> }> = [
      { key: 'income',          field: 'income' },
      { key: 'costOfGoodsSold', field: 'costOfGoodsSold' },
      { key: 'expenses',        field: 'expenses' },
      { key: 'otherIncome',     field: 'otherIncome' },
      { key: 'otherExpenses',   field: 'otherExpenses' },
    ];

    // Compute the report period bounds (used for limiting historical months)
    let reportStartPeriod = '';
    let reportEndPeriod = '';
    let reportMonthSpan = 1;

    if (plReports.length > 0) {
      // Pick the report with the widest date range
      const report = plReports.reduce((best, r) => {
        const span = (d: QBOProfitAndLoss) => {
          const s = new Date(d.startDate);
          const e = new Date(d.endDate);
          return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
        };
        return span(r) > span(best) ? r : best;
      });

      const rStart = new Date(report.startDate);
      const rEnd = new Date(report.endDate);
      reportMonthSpan = Math.max(1,
        (rEnd.getFullYear() - rStart.getFullYear()) * 12 + (rEnd.getMonth() - rStart.getMonth()) + 1
      );
      reportStartPeriod = `${rStart.getFullYear()}-${String(rStart.getMonth() + 1).padStart(2, '0')}`;
      reportEndPeriod = `${rEnd.getFullYear()}-${String(rEnd.getMonth() + 1).padStart(2, '0')}`;

      // Extract accounts DIRECTLY from the P&L report — real QBO values, no name matching
      for (const { key: section, field } of REPORT_SECTIONS) {
        const rows = report[field] || [];
        const flattened = flattenQBORows(rows as any, section);
        for (const acct of flattened) {
          if (acct.value === 0) continue; // Skip zero-activity accounts

          // Enrich parentGroup from QBO chart of accounts fullyQualifiedName
          let parentGroup = acct.parentGroup;
          if (!parentGroup) {
            const qboMatch = qboNameMap.get(acct.label.toLowerCase().trim());
            if (qboMatch) {
              const fqnParts = qboMatch.fullyQualifiedName.split(':');
              if (fqnParts.length > 1) parentGroup = fqnParts[0];
            }
          }

          const id = makeAccountId(section, acct.label, parentGroup);
          const monthlyEstimate = acct.value / reportMonthSpan;

          const values: Record<string, number> = {};
          for (let i = lookbackMonths; i >= 1; i--) {
            const period = offsetPeriod(firstForecastPeriod, -i);
            // Only populate months within the report period
            if (period >= reportStartPeriod && period <= reportEndPeriod) {
              values[period] = monthlyEstimate;

              if (!periodData[period]) {
                periodData[period] = {
                  pl: { revenue: 0, cogs: 0, opex: 0, depreciation: 0, interest: 0, tax: 0 },
                  bs: null, cfs: null,
                };
              }
              if (!periodData[period].plAccounts) periodData[period].plAccounts = {};
              periodData[period].plAccounts![id] = monthlyEstimate;
            }
          }

          accountMap.set(id, {
            id,
            label: acct.label,
            section,
            classification: acct.classification,
            parentGroup,
            values,
          });
        }
      }
    }

    // Supplement: add QBO chart-of-accounts P&L accounts not found in the report
    // This ensures COGS and other accounts are included even if the report section is empty
    const existingLabels = new Set(
      Array.from(accountMap.values()).map(a => a.label.toLowerCase().trim())
    );
    const plTypeAccounts = qboAccounts.filter(
      a => a.active && accountTypeToPLSection(a.accountType) !== null
    );
    for (const acct of plTypeAccounts) {
      if (existingLabels.has(acct.name.toLowerCase().trim())) continue;
      const section = accountTypeToPLSection(acct.accountType)!;
      const fqnParts = acct.fullyQualifiedName.split(':');
      const parentGroup = fqnParts.length > 1 ? fqnParts[0] : undefined;
      const id = makeAccountId(section, acct.name, parentGroup);
      const totalValue = Math.abs(acct.currentBalance);
      if (totalValue === 0) continue;
      const monthlyEstimate = totalValue / Math.max(1, reportMonthSpan);

      const values: Record<string, number> = {};
      for (let i = lookbackMonths; i >= 1; i--) {
        const period = offsetPeriod(firstForecastPeriod, -i);
        // Only populate months within the report period (or all if no report)
        if (!reportStartPeriod || (period >= reportStartPeriod && period <= reportEndPeriod)) {
          values[period] = monthlyEstimate;

          if (!periodData[period]) {
            periodData[period] = {
              pl: { revenue: 0, cogs: 0, opex: 0, depreciation: 0, interest: 0, tax: 0 },
              bs: null, cfs: null,
            };
          }
          if (!periodData[period].plAccounts) periodData[period].plAccounts = {};
          periodData[period].plAccounts![id] = monthlyEstimate;
        }
      }

      accountMap.set(id, {
        id,
        label: acct.name,
        section,
        classification: classifyPLAccount(acct.name, section),
        parentGroup,
        values,
      });
    }

    // Update aggregate P&L totals in periodData from individual accounts
    const allAccounts = Array.from(accountMap.values());
    for (const [period, pd] of Object.entries(periodData)) {
      pd.pl.revenue = allAccounts
        .filter(a => a.classification === 'revenue')
        .reduce((sum, a) => sum + (a.values[period] ?? 0), 0);
      pd.pl.cogs = allAccounts
        .filter(a => a.classification === 'cogs')
        .reduce((sum, a) => sum + (a.values[period] ?? 0), 0);
      pd.pl.opex = allAccounts
        .filter(a => a.classification === 'opex')
        .reduce((sum, a) => sum + (a.values[period] ?? 0), 0);
      pd.pl.depreciation = allAccounts
        .filter(a => a.classification === 'depreciation')
        .reduce((sum, a) => sum + (a.values[period] ?? 0), 0);
      pd.pl.interest = allAccounts
        .filter(a => a.classification === 'interest')
        .reduce((sum, a) => sum + (a.values[period] ?? 0), 0);
      pd.pl.tax = allAccounts
        .filter(a => a.classification === 'tax')
        .reduce((sum, a) => sum + (a.values[period] ?? 0), 0);
    }
  }

  return {
    accounts: Array.from(accountMap.values()),
    periodData,
  };
}

/** Legacy wrapper — still used by some consumers */
export async function getHistoricalActuals(
  companyId: string,
  lookbackMonths: number,
  firstForecastPeriod: string
): Promise<Record<string, PLActuals>> {
  const { periodData } = await getDetailedPLHistory(companyId, lookbackMonths, firstForecastPeriod);
  const result: Record<string, PLActuals> = {};
  for (const [period, data] of Object.entries(periodData)) {
    result[period] = data.pl;
  }
  return result;
}

/** Legacy wrapper — returns comprehensive data */
export async function getHistoricalFinancialData(
  companyId: string,
  lookbackMonths: number,
  firstForecastPeriod: string
): Promise<Record<string, HistoricalPeriodData>> {
  const { periodData } = await getDetailedPLHistory(companyId, lookbackMonths, firstForecastPeriod);
  return periodData;
}

/** Sum rows whose label or group contains any of the keywords (case-insensitive).
 *  Searches recursively through ALL levels of subRows. */
function sumLabelRows(
  rows: Array<{ label?: string; group?: string; value: number; subRows?: Array<{ label?: string; group?: string; value: number; subRows?: any[] }> }>,
  keywords: string[]
): number {
  let total = 0;
  for (const r of rows) {
    const text = ((r.label ?? '') + ' ' + (r.group ?? '')).toLowerCase();
    const matches = keywords.some(k => text.includes(k));
    if (matches) {
      // Row matches — sum its value + all children
      let v = typeof r.value === 'number' ? r.value : 0;
      if (Array.isArray(r.subRows)) v += sumRows(r.subRows as typeof rows);
      total += v;
    } else if (Array.isArray(r.subRows) && r.subRows.length > 0) {
      // Row doesn't match — recurse into children to find matches deeper
      total += sumLabelRows(r.subRows as typeof rows, keywords);
    }
  }
  return total;
}

function sumRows(rows: Array<{ value: number; subRows?: Array<{ value: number }> }>): number {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((acc, r) => {
    let v = typeof r.value === 'number' ? r.value : 0;
    if (Array.isArray(r.subRows)) v += sumRows(r.subRows as typeof rows);
    return acc + v;
  }, 0);
}

/**
 * Extract opening BS positions from the most recent QBO Balance Sheet.
 */
async function loadOpeningBS(
  companyId: string,
  firstForecastPeriod: string
): Promise<Omit<BSForecast, 'totalCurrentAssets' | 'totalNonCurrentAssets' | 'totalAssets' | 'totalCurrentLiabilities' | 'totalNonCurrentLiabilities' | 'totalLiabilities' | 'totalEquity'> | null> {
  // Try the end of the month before the first forecast period
  const priorPeriod = offsetPeriod(firstForecastPeriod, -1);
  const [y, m] = priorPeriod.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const asOfDate = `${priorPeriod}-${lastDay}`;

  const bs = await getQBOBalanceSheet(companyId, asOfDate);
  if (!bs) return null;

  // Map QBO BS structure to engine's flat named fields (recursive search through all nesting levels)
  const cash        = sumLabelRows(bs.assets, ['cash', 'bank']);
  const receivables = sumLabelRows(bs.assets, ['receivable', 'debtor']);
  const inventory   = sumLabelRows(bs.assets, ['inventor']);
  const prepaid     = sumLabelRows(bs.assets, ['prepaid']);
  const ppe         = sumLabelRows(bs.assets, ['property', 'equipment', 'vehicle', 'plant', 'machinery']);
  const accDepreciation = Math.abs(sumLabelRows(bs.assets, ['depreciation', 'amortis', 'amortiz']));
  const payables    = sumLabelRows(bs.liabilities, ['payable', 'creditor', 'accounts pay']);
  const accrued     = sumLabelRows(bs.liabilities, ['accrued', 'accrual']);
  const taxPayable  = sumLabelRows(bs.liabilities, ['tax payable', 'gst', 'vat', 'income tax']);
  const ltDebt      = sumLabelRows(bs.liabilities, ['loan', 'borrowing', 'long-term', 'mortgage', 'note pay']);
  const shareCapital     = sumLabelRows(bs.equity, ['capital', 'share', 'paid-in', 'common stock']);
  const retainedEarnings = sumLabelRows(bs.equity, ['retained', 'earnings', 'accumulated']);

  return {
    cash: cash || bs.totalAssets * 0.1,  // fallback: 10% of assets
    receivables, inventory, prepaid, ppe,
    accDepreciation: Math.abs(accDepreciation),
    payables, accrued, taxPayable, ltDebt,
    shareCapital, retainedEarnings,
  };
}

// ============================================================================
// MAIN: RECALCULATE FORECAST
// ============================================================================

/**
 * Full pipeline: load inputs, run engine, store results.
 * Call this whenever value rules or drivers change.
 * Now uses individual QBO accounts instead of 6 aggregates.
 */
export async function recalculateForecast(
  companyId: string,
  forecastId: string
): Promise<ForecastPeriod[]> {
  // 1. Load forecast metadata (includes drivers + horizon)
  const metadata = await getForecastMetadata(companyId, forecastId);
  if (!metadata) throw new Error(`Forecast ${forecastId} not found`);

  // 2. Load value rules and micro forecasts in parallel
  const [rules, microForecasts] = await Promise.all([
    getValueRules(companyId, forecastId),
    loadMicroForecasts(companyId, forecastId),
  ]);

  // 3. Load detailed per-account P&L actuals from QBO
  const { accounts: detailedAccounts, periodData } = await getDetailedPLHistory(
    companyId, 12, metadata.firstForecastPeriod
  );

  // 4. Seed opening BS from QBO if not already stored
  let openingBS = metadata.openingBS;
  if (!openingBS) {
    openingBS = await loadOpeningBS(companyId, metadata.firstForecastPeriod);
    if (openingBS) {
      await updateDoc(
        doc(db, 'companies', companyId, 'forecasts', forecastId),
        { openingBS, updatedAt: serverTimestamp() }
      );
    }
  }

  // 5. Build PLInputs from individual QBO accounts
  const sortedPeriods = Object.keys(periodData).sort();
  const accounts: PLInputs['accounts'] = {};
  const classifications: PLInputs['classifications'] = {};

  for (const acct of detailedAccounts) {
    // Build ordered history array from period values
    const history = sortedPeriods.map(p => acct.values[p] ?? 0);
    accounts[acct.id] = {
      history,
      budgetValues: {},
      defaultRule: 'smart_prediction',
    };
    classifications[acct.id] = acct.classification;
  }

  // If no detailed accounts were found, fall back to aggregate approach
  if (detailedAccounts.length === 0) {
    const aggAccounts = ['__revenue__', '__cogs__', '__opex__', '__depreciation__', '__interest__', '__tax__'] as const;
    const aggClassifications: Record<string, 'revenue' | 'cogs' | 'opex' | 'depreciation' | 'interest' | 'tax'> = {
      __revenue__: 'revenue', __cogs__: 'cogs', __opex__: 'opex',
      __depreciation__: 'depreciation', __interest__: 'interest', __tax__: 'tax',
    };
    for (const key of aggAccounts) {
      const cls = aggClassifications[key] as keyof PLActuals;
      accounts[key] = {
        history: sortedPeriods.map(p => periodData[p]?.pl[cls] ?? 0),
        budgetValues: {},
        defaultRule: 'smart_prediction',
      };
      classifications[key] = aggClassifications[key];
    }
  }

  const plInputs: Omit<PLInputs, 'period'> = {
    accounts,
    classifications,
    rules,
  };

  // 6. Run the engine (with micro-forecast schedules)
  const periods = runForecastEngine({
    metadata: {
      horizon: metadata.horizon,
      firstForecastPeriod: metadata.firstForecastPeriod,
      drivers: metadata.drivers,
      openingBS: openingBS ?? null,
    },
    plInputs,
    microForecasts,
  });

  // 7. Store results
  await storeForecastPeriods(companyId, forecastId, periods);

  // Update timestamp
  await updateDoc(
    doc(db, 'companies', companyId, 'forecasts', forecastId),
    { updatedAt: serverTimestamp() }
  );

  return periods;
}

/**
 * Load or calculate forecast periods.
 * Returns cached periods from Firestore if available; recalculates otherwise.
 */
export async function getForecastPeriods(
  companyId: string,
  forecastId: string,
  forceRecalculate = false
): Promise<ForecastPeriod[]> {
  if (!forceRecalculate) {
    const cached = await loadForecastPeriods(companyId, forecastId);
    if (cached.length > 0) return cached;
  }
  return recalculateForecast(companyId, forecastId);
}
