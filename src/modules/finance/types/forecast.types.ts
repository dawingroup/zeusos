// ============================================================================
// FORECAST TYPES
// ZeusOS v2.0 - Finance Module
// Three-Way Forecast Engine: P&L → Balance Sheet → Cash Flow Statement
// Spec reference: §5–8 of Forecasting & Variance Analysis Module spec
// ============================================================================

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// VALUE RULE TYPES
// ============================================================================

export type ValueRuleType =
  | 'smart_prediction'
  | 'constant_growing'
  | 'direct_entry'
  | 'link_to_budget';

/** Smart Prediction — linear regression (default) or rolling average */
export interface SmartPredictionParams {
  method: 'linear_regression' | 'rolling_average';
  lookbackMonths: 3 | 6 | 12 | 24;
}

/**
 * Cash timing allocation — when does a P&L amount actually hit the bank?
 * 0 = same month as recognised, 1 = next month, etc.
 */
export interface CashTimingAllocation {
  lagMonths: 0 | 1 | 2 | 3;
}

/** Constant amount that optionally grows at an annual compound rate */
export interface ConstantGrowingParams {
  baseAmount: number;
  annualGrowthRate: number;   // e.g. 0.05 for 5%; 0 for flat
  startPeriod: string;        // YYYY-MM — anchor for compound calculation
}

/** Manual cell-by-cell entry per period */
export interface DirectEntryParams {
  values: Record<string, number>;  // { 'YYYY-MM': amount }
}

/** Pull amounts from an existing ZeusOS budget */
export interface LinkToBudgetParams {
  budgetId: string;
  adjustmentPct: number;   // 0 for no adjustment; 0.05 = +5% over budget
}

export type ValueRuleParams =
  | SmartPredictionParams
  | ConstantGrowingParams
  | DirectEntryParams
  | LinkToBudgetParams;

/**
 * A rule applied to a specific account (or heading / classification) over a
 * date range. The most specific rule wins (account > heading > classification).
 */
export interface ValueRule {
  id: string;
  forecastId: string;
  accountId: string;        // QBO account id (or synthetic heading/classification key)
  ruleType: ValueRuleType;
  params: ValueRuleParams;
  cashTiming?: CashTimingAllocation; // when cash actually moves; defaults to same month (lag 0)
  startPeriod: string;      // YYYY-MM inclusive
  endPeriod: string | null; // YYYY-MM inclusive; null = perpetual
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// WORKING CAPITAL DRIVERS
// ============================================================================

/** Controls how Balance Sheet accounts are derived from P&L forecasts */
export interface WorkingCapitalDrivers {
  receivableDays: number;      // default 30 — AR as days of revenue
  payableDays: number;         // default 45 — AP as days of (COGS + Opex)
  inventoryDays: number;       // default 60 — Inventory as days of COGS
  prepaidPctOfOpex: number;    // default 0.08 — Prepaid as % of Opex
  accruedPctOfOpex: number;    // default 0.10 — Accrued exp as % of Opex
  taxPaymentLagMonths: number; // default 3 — months before tax is paid
}

export const DEFAULT_WC_DRIVERS: WorkingCapitalDrivers = {
  receivableDays: 30,
  payableDays: 45,
  inventoryDays: 60,
  prepaidPctOfOpex: 0.08,
  accruedPctOfOpex: 0.10,
  taxPaymentLagMonths: 3,
};

// ============================================================================
// FORECAST STATEMENT TYPES (per period)
// ============================================================================

export interface PLForecast {
  revenue: number;
  cogs: number;
  grossProfit: number;        // revenue - cogs
  opex: number;               // operating expenses
  ebitda: number;             // grossProfit - opex (before D&A and interest)
  depreciation: number;
  interest: number;
  ebit: number;               // ebitda - depreciation
  tax: number;
  netProfit: number;          // ebit - interest - tax
  /** Per-account breakdown: { accountId → forecasted amount } */
  accountValues?: Record<string, number>;
}

// ============================================================================
// DETAILED P&L ACCOUNT ROW (for per-account display)
// ============================================================================

export type PLSection = 'income' | 'costOfGoodsSold' | 'expenses' | 'otherIncome' | 'otherExpenses';

/**
 * An individual P&L account extracted from QBO with historical values.
 * Used to display detail accounts in the Forecast table.
 */
export interface PLAccountDetail {
  id: string;                  // stable ID: e.g. "income__design_services"
  label: string;               // display name from QBO
  section: PLSection;
  classification: 'revenue' | 'cogs' | 'opex' | 'depreciation' | 'interest' | 'tax';
  parentGroup?: string;        // if nested under a sub-section
  values: Record<string, number>;  // { 'YYYY-MM': amount }
}

// ============================================================================
// DETAILED BS ACCOUNT (for per-account display)
// ============================================================================

export type BSSection = 'currentAssets' | 'nonCurrentAssets' | 'currentLiabilities' | 'nonCurrentLiabilities' | 'equity';

/** An individual BS account from QBO chart of accounts */
export interface BSAccountDetail {
  id: string;
  label: string;
  section: BSSection;
  accountType: string;        // QBO accountType: 'Bank', 'Accounts Receivable', etc.
  bsEngineKey: string;        // maps to BSForecast field for proportional distribution
  parentGroup?: string;       // from QBO fullyQualifiedName hierarchy
  currentBalance: number;
}

export interface BSForecast {
  // Current Assets
  cash: number;
  receivables: number;        // Accounts Receivable
  inventory: number;
  prepaid: number;            // Prepaid Expenses
  // Non-Current Assets
  ppe: number;                // PPE gross (user-entered or static from actuals)
  accDepreciation: number;    // Accumulated Depreciation (increases by D&A each month)
  // Current Liabilities
  payables: number;           // Accounts Payable
  accrued: number;            // Accrued Expenses
  taxPayable: number;
  // Non-Current Liabilities
  ltDebt: number;             // Long-term Debt (static unless microforecast in Phase 2)
  // Equity
  shareCapital: number;       // Static unless capital raise (Phase 2)
  retainedEarnings: number;   // Cumulative: prior + net profit
  // Computed totals
  totalCurrentAssets: number;
  totalNonCurrentAssets: number;
  totalAssets: number;
  totalCurrentLiabilities: number;
  totalNonCurrentLiabilities: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface CFSForecast {
  // Operating Activities (indirect method)
  operating: number;
  // Investing Activities
  investing: number;
  // Financing Activities
  financing: number;
  // Totals
  netChange: number;          // operating + investing + financing
  openingCash: number;        // = prior period BS cash
  closingCash: number;        // = openingCash + netChange (must equal BS cash)
}

/** One fully-calculated forecast period */
export interface ForecastPeriod {
  period: string;             // YYYY-MM
  pl: PLForecast;
  bs: BSForecast;
  cfs: CFSForecast;
}

// ============================================================================
// FORECAST DOCUMENT
// ============================================================================

export interface ForecastMetadata {
  id: string;
  companyId: string;
  name: string;
  horizon: number;            // months to forecast (e.g. 12)
  fiscalYearStart: number;    // 1-12 (month number)
  currency: string;
  drivers: WorkingCapitalDrivers;
  // Opening BS positions (seeded from last QBO actual BS)
  openingBS: Omit<BSForecast, 'totalCurrentAssets' | 'totalNonCurrentAssets' | 'totalAssets' | 'totalCurrentLiabilities' | 'totalNonCurrentLiabilities' | 'totalLiabilities' | 'totalEquity'> | null;
  firstForecastPeriod: string; // YYYY-MM
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// VARIANCE TYPES (Forecast vs Actual vs Budget)
// ============================================================================

export interface VarianceCell {
  actual: number | null;
  budget: number | null;
  forecast: number;
  vsActual: number | null;       // forecast - actual
  vsActualPct: number | null;
  vsBudget: number | null;       // forecast - budget
  vsBudgetPct: number | null;
}

export interface PLVariancePeriod {
  period: string;
  revenue: VarianceCell;
  cogs: VarianceCell;
  grossProfit: VarianceCell;
  opex: VarianceCell;
  netProfit: VarianceCell;
}

// ============================================================================
// MICRO FORECAST TYPES (Phase 2)
// Individual BS line-item schedules that override static assumptions
// ============================================================================

export type MicroForecastType = 'capex' | 'loan' | 'capital_event' | 'dividend';

/**
 * Capital Expenditure — planned asset purchases.
 * Adds to PPE in the purchase period; generates monthly depreciation.
 */
export interface CapExItem {
  id: string;
  forecastId: string;
  name: string;                     // e.g., "New CNC Machine"
  amount: number;                   // purchase price
  period: string;                   // YYYY-MM when purchased
  usefulLifeMonths: number;         // for straight-line depreciation
  depreciationMethod: 'straight_line' | 'none';
  residualValue: number;            // salvage value at end of life
  category?: string;                // optional grouping, e.g., "Equipment", "Vehicles"
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Loan / Debt Schedule — new or existing amortising loans.
 * Generates monthly principal repayment (reduces ltDebt) and interest (P&L expense).
 */
export interface LoanScheduleItem {
  id: string;
  forecastId: string;
  name: string;                     // e.g., "Equipment Loan"
  principal: number;                // original loan amount
  annualRate: number;               // e.g., 0.08 for 8%
  termMonths: number;               // e.g., 60 for 5-year loan
  startPeriod: string;              // YYYY-MM when loan starts / was taken
  type: 'new_loan' | 'existing';
  existingBalance?: number;         // remaining balance for existing loans
  paymentType: 'amortising' | 'interest_only' | 'bullet';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Capital Event — equity raise, buyback, or other one-off equity change.
 */
export interface CapitalEvent {
  id: string;
  forecastId: string;
  name: string;                     // e.g., "Series A", "Share Buyback"
  type: 'equity_raise' | 'equity_buyback';
  amount: number;
  period: string;                   // YYYY-MM
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Dividend Schedule — recurring or one-off cash distributions.
 */
export interface DividendSchedule {
  id: string;
  forecastId: string;
  name: string;
  amount: number;                   // per-event amount
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'once';
  startPeriod: string;              // YYYY-MM
  endPeriod: string | null;         // null = perpetual (until forecast horizon)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Aggregated micro-forecast inputs passed into the engine */
export interface MicroForecastInputs {
  capex: CapExItem[];
  loans: LoanScheduleItem[];
  capitalEvents: CapitalEvent[];
  dividends: DividendSchedule[];
}

/** Per-period micro-forecast effects computed by the engine */
export interface MicroForecastEffects {
  capexAdditions: number;           // PPE additions this period
  microDepreciation: number;        // additional depreciation from capex items
  loanPrincipalRepayment: number;   // debt principal paid this period
  loanInterest: number;             // interest expense from loans this period
  newLoanDrawdown: number;          // new loan proceeds received this period
  shareCapitalChange: number;       // equity raise (+) or buyback (-)
  dividendsPaid: number;            // cash dividend outflow this period
}

// ============================================================================
// HELPER — Period utilities
// ============================================================================

/** Returns YYYY-MM string for a given year + month (1-based) */
export function periodStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Returns an array of N consecutive YYYY-MM strings starting from startPeriod */
export function periodRange(startPeriod: string, count: number): string[] {
  const [y, m] = startPeriod.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const totalMonths = (m - 1) + i;
    return periodStr(y + Math.floor(totalMonths / 12), (totalMonths % 12) + 1);
  });
}

/** Returns YYYY-MM string for the period N months before/after a given period */
export function offsetPeriod(period: string, offsetMonths: number): string {
  const [y, m] = period.split('-').map(Number);
  const totalMonths = (y * 12 + (m - 1)) + offsetMonths;
  return periodStr(Math.floor(totalMonths / 12), (totalMonths % 12) + 1);
}

/** Format a YYYY-MM period as "Jan 2026" */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

/** Returns the number of whole months between two YYYY-MM periods (b - a) */
export function periodDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by * 12 + bm) - (ay * 12 + am);
}

/** Check if a dividend is due in the given period based on its frequency and start */
export function isDividendDue(
  startPeriod: string,
  frequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual' | 'once',
  period: string,
  endPeriod: string | null
): boolean {
  if (period < startPeriod) return false;
  if (endPeriod && period > endPeriod) return false;
  if (frequency === 'once') return period === startPeriod;
  if (frequency === 'monthly') return true;
  const diff = periodDiff(startPeriod, period);
  switch (frequency) {
    case 'quarterly':   return diff % 3 === 0;
    case 'semi_annual': return diff % 6 === 0;
    case 'annual':      return diff % 12 === 0;
    default: return false;
  }
}
