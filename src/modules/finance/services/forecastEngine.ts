// ============================================================================
// FORECAST ENGINE — Pure Calculation Functions
// DawinOS v2.0 - Finance Module
// No Firestore I/O. All functions are deterministic and testable.
// Spec reference: §5–8 of Forecasting & Variance Analysis Module spec
// ============================================================================

import type {
  ValueRule,
  ValueRuleType,
  SmartPredictionParams,
  ConstantGrowingParams,
  DirectEntryParams,
  LinkToBudgetParams,
  WorkingCapitalDrivers,
  PLForecast,
  BSForecast,
  CFSForecast,
  ForecastPeriod,
  ForecastMetadata,
  MicroForecastInputs,
  MicroForecastEffects,
} from '../types/forecast.types';
import { DEFAULT_WC_DRIVERS, periodRange, periodDiff, isDividendDue } from '../types/forecast.types';

// Re-export DEFAULT_WC_DRIVERS so consumers can import from this module
export { DEFAULT_WC_DRIVERS };

// ============================================================================
// VALUE RULE EVALUATION (spec §9)
// ============================================================================

// ── Linear Regression (OLS) ───────────────────────────────────────────────────

/** Ordinary least-squares: returns slope (m) and intercept (b) for y = mx + b */
export function olsRegression(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: y[0] };

  const sumX  = (n * (n - 1)) / 2;          // 0+1+2+…+(n-1)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  const sumY  = y.reduce((a, b) => a + b, 0);
  const sumXY = y.reduce((acc, yi, i) => acc + i * yi, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Predict the next value via linear regression, extrapolated `monthsAhead` beyond the last history point.
 * monthsAhead = 1 → next month after history ends.
 */
export function linearRegressionPredict(
  history: number[],
  lookbackMonths: number,
  monthsAhead = 1
): number {
  const window = history.slice(-lookbackMonths);
  if (window.length === 0) return 0;
  const { slope, intercept } = olsRegression(window);
  const x = window.length - 1 + monthsAhead;
  return Math.max(0, intercept + slope * x);  // clamp to 0 (no negative revenue)
}

/**
 * Smart Prediction — dispatches to linear regression (default) or rolling average.
 * For multi-period calls, pass monthsAhead = 1,2,3,… for each forecast period.
 */
export function smartPrediction(
  history: number[],
  lookbackMonths: number,
  method: 'linear_regression' | 'rolling_average' = 'linear_regression',
  monthsAhead = 1
): number {
  if (history.length === 0) return 0;
  if (method === 'linear_regression') {
    return linearRegressionPredict(history, lookbackMonths, monthsAhead);
  }
  // Rolling average
  const window = history.slice(-lookbackMonths);
  if (window.length === 0) return 0;
  return window.reduce((a, b) => a + b, 0) / window.length;
}

/**
 * Constant / Growing: compound annual growth from a base amount.
 * monthsAhead = months elapsed since startPeriod (0 = first forecast month).
 */
export function constantGrowing(
  baseAmount: number,
  annualGrowthRate: number,
  monthsAhead: number
): number {
  if (annualGrowthRate === 0) return baseAmount;
  const monthlyRate = Math.pow(1 + annualGrowthRate, 1 / 12) - 1;
  return baseAmount * Math.pow(1 + monthlyRate, monthsAhead);
}

/**
 * Direct Entry: return the manually entered amount for this period.
 */
export function directEntry(values: Record<string, number>, period: string): number {
  return values[period] ?? 0;
}

/**
 * Apply a single value rule to produce an amount for the given period.
 *
 * @param rule          The ValueRule document
 * @param period        YYYY-MM target period
 * @param history       Ordered array of historical actuals (oldest first)
 * @param budgetValues  Map of period → budget amount (for link_to_budget rule)
 * @param monthsAhead   How many months ahead of the last history point this period is (for regression)
 */
export function applyValueRule(
  rule: ValueRule,
  period: string,
  history: number[],
  budgetValues: Record<string, number>,
  monthsAhead = 1
): number {
  switch (rule.ruleType) {
    case 'smart_prediction': {
      const p = rule.params as SmartPredictionParams;
      return smartPrediction(history, p.lookbackMonths, p.method, monthsAhead);
    }
    case 'constant_growing': {
      const p = rule.params as ConstantGrowingParams;
      const [sy, sm] = p.startPeriod.split('-').map(Number);
      const [py, pm] = period.split('-').map(Number);
      const monthsAhead = (py * 12 + pm) - (sy * 12 + sm);
      return constantGrowing(p.baseAmount, p.annualGrowthRate, Math.max(0, monthsAhead));
    }
    case 'direct_entry': {
      const p = rule.params as DirectEntryParams;
      return directEntry(p.values, period);
    }
    case 'link_to_budget': {
      const p = rule.params as LinkToBudgetParams;
      const budgetBase = budgetValues[period] ?? 0;
      return budgetBase * (1 + p.adjustmentPct);
    }
    default:
      return 0;
  }
}

/**
 * Find the active ValueRule for a given accountId and period.
 * Returns null if no rule matches (caller should use a sensible default).
 */
export function findActiveRule(
  rules: ValueRule[],
  accountId: string,
  period: string
): ValueRule | null {
  for (const rule of rules) {
    if (rule.accountId !== accountId) continue;
    if (rule.startPeriod > period) continue;
    if (rule.endPeriod !== null && rule.endPeriod < period) continue;
    return rule;
  }
  return null;
}

// ============================================================================
// P&L CALCULATION (spec §5)
// ============================================================================

export interface PLInputs {
  /** Map of accountId → { history: number[], budgetValues: Record<string,number> } */
  accounts: Record<string, {
    history: number[];
    budgetValues: Record<string, number>;
    defaultRule: ValueRuleType;
  }>;
  /** Classification of each accountId */
  classifications: Record<string, 'revenue' | 'cogs' | 'opex' | 'depreciation' | 'interest' | 'tax'>;
  rules: ValueRule[];
  period: string;
}

/**
 * Calculate the P&L forecast for a single period.
 * Default: linear regression over 12-month lookback.
 */
export function calculatePL(inputs: PLInputs, monthsAhead = 1): PLForecast {
  let revenue = 0;
  let cogs = 0;
  let opex = 0;
  let depreciation = 0;
  let interest = 0;
  let tax = 0;
  const accountValues: Record<string, number> = {};

  for (const [accountId, data] of Object.entries(inputs.accounts)) {
    const classification = inputs.classifications[accountId];
    if (!classification) continue;

    const rule = findActiveRule(inputs.rules, accountId, inputs.period);
    let amount: number;

    if (rule) {
      amount = applyValueRule(rule, inputs.period, data.history, data.budgetValues, monthsAhead);
    } else {
      // Default: linear regression over 12-month lookback
      amount = smartPrediction(data.history, 12, 'linear_regression', monthsAhead);
    }

    accountValues[accountId] = amount;

    switch (classification) {
      case 'revenue':      revenue      += amount; break;
      case 'cogs':         cogs         += amount; break;
      case 'opex':         opex         += amount; break;
      case 'depreciation': depreciation += amount; break;
      case 'interest':     interest     += amount; break;
      case 'tax':          tax          += amount; break;
    }
  }

  const grossProfit = revenue - cogs;
  const ebitda = grossProfit - opex;
  const ebit = ebitda - depreciation;
  const netProfit = ebit - interest - tax;

  return { revenue, cogs, grossProfit, opex, ebitda, depreciation, interest, ebit, tax, netProfit, accountValues };
}

// ============================================================================
// MICRO FORECAST EFFECTS (Phase 2)
// ============================================================================

const EMPTY_MICRO: MicroForecastInputs = { capex: [], loans: [], capitalEvents: [], dividends: [] };

/**
 * Compute per-period effects from micro-forecast schedules.
 * Pure function — no side effects.
 */
export function computeMicroForecastEffects(
  micro: MicroForecastInputs,
  period: string
): MicroForecastEffects {
  let capexAdditions = 0;
  let microDepreciation = 0;
  let loanPrincipalRepayment = 0;
  let loanInterest = 0;
  let newLoanDrawdown = 0;
  let shareCapitalChange = 0;
  let dividendsPaid = 0;

  // ── CapEx: additions + depreciation ──
  for (const item of micro.capex) {
    // Addition in the purchase period
    if (item.period === period) capexAdditions += item.amount;

    // Monthly depreciation if active
    if (item.depreciationMethod === 'straight_line' && period >= item.period) {
      const months = periodDiff(item.period, period);
      if (months < item.usefulLifeMonths) {
        microDepreciation += (item.amount - item.residualValue) / item.usefulLifeMonths;
      }
    }
  }

  // ── Loans: principal repayment + interest ──
  for (const loan of micro.loans) {
    // New loan drawdown in the start period
    if (loan.type === 'new_loan' && loan.startPeriod === period) {
      newLoanDrawdown += loan.principal;
    }

    // Ongoing payments
    if (period >= loan.startPeriod) {
      const monthsElapsed = periodDiff(loan.startPeriod, period);
      const monthlyRate = loan.annualRate / 12;
      const balance = loan.type === 'existing' && loan.existingBalance != null
        ? loan.existingBalance
        : loan.principal;

      if (loan.paymentType === 'amortising' && monthsElapsed < loan.termMonths && monthlyRate > 0) {
        // Standard amortisation: fixed payment, declining interest
        const pmt = balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -loan.termMonths));
        // Remaining balance at start of this period
        const remaining = balance *
          (Math.pow(1 + monthlyRate, loan.termMonths) - Math.pow(1 + monthlyRate, monthsElapsed)) /
          (Math.pow(1 + monthlyRate, loan.termMonths) - 1);
        const interestThisMonth = remaining * monthlyRate;
        const principalThisMonth = pmt - interestThisMonth;
        loanPrincipalRepayment += Math.max(0, principalThisMonth);
        loanInterest += Math.max(0, interestThisMonth);
      } else if (loan.paymentType === 'interest_only' && monthsElapsed < loan.termMonths) {
        loanInterest += balance * monthlyRate;
        // Bullet principal repayment at maturity
        if (monthsElapsed === loan.termMonths - 1) {
          loanPrincipalRepayment += balance;
        }
      } else if (loan.paymentType === 'bullet') {
        loanInterest += balance * monthlyRate;
        // Full principal at end of term
        if (monthsElapsed === loan.termMonths - 1) {
          loanPrincipalRepayment += balance;
        }
      }
    }
  }

  // ── Capital Events ──
  for (const event of micro.capitalEvents) {
    if (event.period === period) {
      shareCapitalChange += event.type === 'equity_raise' ? event.amount : -event.amount;
    }
  }

  // ── Dividends ──
  for (const div of micro.dividends) {
    if (isDividendDue(div.startPeriod, div.frequency, period, div.endPeriod)) {
      dividendsPaid += div.amount;
    }
  }

  return {
    capexAdditions,
    microDepreciation,
    loanPrincipalRepayment,
    loanInterest,
    newLoanDrawdown,
    shareCapitalChange,
    dividendsPaid,
  };
}

// ============================================================================
// BALANCE SHEET CALCULATION (spec §6)
// ============================================================================

/**
 * Derive the forecasted Balance Sheet from P&L + working-capital drivers.
 * priorBS = closing BS of the immediately preceding period.
 *
 * Key rules:
 * - Working-capital accounts are derived from P&L amounts via driver ratios.
 * - Net profit accumulates in Retained Earnings.
 * - Accumulated Depreciation increases by P&L depreciation + micro-forecast D&A.
 * - Cash is the balancing plug (spec §6.6).
 * - Micro-forecasts override static assumptions for PPE, ltDebt, shareCapital.
 */
export function calculateBS(
  pl: PLForecast,
  priorBS: BSForecast,
  drivers: WorkingCapitalDrivers,
  microEffects?: MicroForecastEffects
): BSForecast {
  const fx = microEffects ?? {
    capexAdditions: 0, microDepreciation: 0, loanPrincipalRepayment: 0,
    loanInterest: 0, newLoanDrawdown: 0, shareCapitalChange: 0, dividendsPaid: 0,
  };

  // ── Working-capital assets (closing balance = P&L × driver) ──
  const receivables = pl.revenue * (drivers.receivableDays / 30);
  const inventory   = pl.cogs    * (drivers.inventoryDays  / 30);
  const prepaid     = pl.opex    * drivers.prepaidPctOfOpex;

  // ── Non-current assets (micro-forecast: capex additions + depreciation) ──
  const ppe              = priorBS.ppe + fx.capexAdditions;
  const accDepreciation  = priorBS.accDepreciation + pl.depreciation + fx.microDepreciation;

  // ── Liabilities (micro-forecast: loan drawdown/repayment) ──
  const payables   = (pl.cogs + pl.opex) * (drivers.payableDays / 30);
  const accrued    = pl.opex * drivers.accruedPctOfOpex;
  const taxPayable = pl.tax;
  const ltDebt     = priorBS.ltDebt + fx.newLoanDrawdown - fx.loanPrincipalRepayment;

  // ── Equity (micro-forecast: capital events + dividends) ──
  const shareCapital      = priorBS.shareCapital + fx.shareCapitalChange;
  const retainedEarnings  = priorBS.retainedEarnings + pl.netProfit - fx.dividendsPaid;

  // ── Compute totals ──
  const netPPE = ppe - accDepreciation;
  const totalCurrentAssets    = 0 + receivables + inventory + prepaid; // cash added after plug
  const totalNonCurrentAssets = Math.max(0, netPPE);
  const totalCurrentLiabilities    = payables + accrued + taxPayable;
  const totalNonCurrentLiabilities = Math.max(0, ltDebt);
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
  const totalEquity      = shareCapital + retainedEarnings;

  // ── Cash as balancing plug (spec §6.6) ──
  const nonCashAssets = totalCurrentAssets + totalNonCurrentAssets;
  let cash = (totalLiabilities + totalEquity) - nonCashAssets;

  // Recompute totals with cash included
  const totalCurrentAssetsFinal = cash + receivables + inventory + prepaid;
  const totalAssets = totalCurrentAssetsFinal + totalNonCurrentAssets;

  return {
    cash,
    receivables,
    inventory,
    prepaid,
    ppe,
    accDepreciation,
    payables,
    accrued,
    taxPayable,
    ltDebt: Math.max(0, ltDebt),
    shareCapital,
    retainedEarnings,
    totalCurrentAssets: totalCurrentAssetsFinal,
    totalNonCurrentAssets,
    totalAssets,
    totalCurrentLiabilities,
    totalNonCurrentLiabilities,
    totalLiabilities,
    totalEquity,
  };
}

// ============================================================================
// CASH FLOW STATEMENT DERIVATION (spec §7, indirect method)
// ============================================================================

/**
 * Derive the Cash Flow Statement from P&L and BS movements.
 * NEVER directly editable — always derived (spec §7.1).
 *
 * @param pl           Forecasted P&L for this period
 * @param bs           Forecasted BS for this period (closing)
 * @param priorBS      BS closing position from the prior period
 * @param microEffects Optional micro-forecast effects for explicit CFS treatment
 */
export function calculateCFS(
  pl: PLForecast,
  bs: BSForecast,
  priorBS: BSForecast,
  microEffects?: MicroForecastEffects
): CFSForecast {
  const fx = microEffects;

  // ── Operating Activities ──
  const deltaReceivables  = -(bs.receivables - priorBS.receivables);
  const deltaInventory    = -(bs.inventory   - priorBS.inventory);
  const deltaPrepaid      = -(bs.prepaid     - priorBS.prepaid);
  const deltaPayables     =   bs.payables    - priorBS.payables;
  const deltaAccrued      =   bs.accrued     - priorBS.accrued;
  const deltaTaxPayable   =   bs.taxPayable  - priorBS.taxPayable;

  // Add back micro-forecast depreciation (non-cash add-back, same as P&L depreciation)
  const microDeprAddBack = fx?.microDepreciation ?? 0;

  const operating = (
    pl.netProfit + pl.depreciation + microDeprAddBack
    + deltaReceivables + deltaInventory + deltaPrepaid
    + deltaPayables    + deltaAccrued   + deltaTaxPayable
  );

  // ── Investing Activities ──
  // Δ Gross PPE (negative = capex outflow)
  const deltaGrossPPE = -(bs.ppe - priorBS.ppe);
  const investing = deltaGrossPPE;

  // ── Financing Activities ──
  const deltaLtDebt       = bs.ltDebt       - priorBS.ltDebt;
  const deltaShareCapital = bs.shareCapital - priorBS.shareCapital;
  const dividendsPaid     = fx?.dividendsPaid ?? 0;
  const financing = deltaLtDebt + deltaShareCapital - dividendsPaid;

  // ── Totals ──
  const netChange    = operating + investing + financing;
  const openingCash  = priorBS.cash;
  const closingCash  = openingCash + netChange;

  // Validation (in development, log a warning if this drifts)
  const drift = Math.abs(closingCash - bs.cash);
  if (drift > 0.05) {
    console.warn(
      `[ForecastEngine] CFS closing cash (${closingCash.toFixed(2)}) ≠ BS cash (${bs.cash.toFixed(2)}) — drift: ${drift.toFixed(2)}`
    );
  }

  return { operating, investing, financing, netChange, openingCash, closingCash };
}

// ============================================================================
// THREE-WAY FORECAST ENGINE (spec §8.3)
// ============================================================================

export interface EngineInputs {
  metadata: Pick<ForecastMetadata, 'horizon' | 'firstForecastPeriod' | 'drivers' | 'openingBS'>;
  plInputs: Omit<PLInputs, 'period'>;
  microForecasts?: MicroForecastInputs;
}

/**
 * Run the complete three-way forecast engine over the full horizon.
 * Computes periods sequentially (each period depends on the prior period's BS).
 * Micro-forecasts inject capex, loan, capital, and dividend effects into BS/CFS.
 *
 * Returns an array of ForecastPeriod objects in chronological order.
 */
export function runForecastEngine(inputs: EngineInputs): ForecastPeriod[] {
  const { metadata, plInputs, microForecasts } = inputs;
  const periods = periodRange(metadata.firstForecastPeriod, metadata.horizon);
  const drivers = metadata.drivers;
  const micro = microForecasts ?? EMPTY_MICRO;

  // Seed the opening BS (from last QBO actual, or zeroes if none)
  const zeroBS: BSForecast = {
    cash: 0, receivables: 0, inventory: 0, prepaid: 0,
    ppe: 0, accDepreciation: 0,
    payables: 0, accrued: 0, taxPayable: 0, ltDebt: 0,
    shareCapital: 0, retainedEarnings: 0,
    totalCurrentAssets: 0, totalNonCurrentAssets: 0, totalAssets: 0,
    totalCurrentLiabilities: 0, totalNonCurrentLiabilities: 0,
    totalLiabilities: 0, totalEquity: 0,
  };

  let priorBS: BSForecast = metadata.openingBS
    ? computeBSTotals({ ...zeroBS, ...metadata.openingBS })
    : zeroBS;

  const results: ForecastPeriod[] = [];

  for (const period of periods) {
    // 0. Compute micro-forecast effects for this period
    const fx = computeMicroForecastEffects(micro, period);

    // 1. Calculate P&L (loan interest from micro forecasts adds to interest expense)
    const basePL = calculatePL({ ...plInputs, period });
    const pl: PLForecast = fx.loanInterest > 0 ? {
      ...basePL,
      interest: basePL.interest + fx.loanInterest,
      ebit: basePL.ebit,  // unchanged (before interest)
      netProfit: basePL.netProfit - fx.loanInterest,
    } : basePL;

    // 2. Derive Balance Sheet with micro-forecast effects
    const bs = calculateBS(pl, priorBS, drivers, fx);

    // 3. Derive Cash Flow Statement with micro-forecast effects
    const cfs = calculateCFS(pl, bs, priorBS, fx);

    results.push({ period, pl, bs, cfs });
    priorBS = bs;
  }

  return results;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Fill in computed BS total fields from raw fields */
function computeBSTotals(bs: BSForecast): BSForecast {
  const netPPE = bs.ppe - bs.accDepreciation;
  const totalCurrentAssets    = bs.cash + bs.receivables + bs.inventory + bs.prepaid;
  const totalNonCurrentAssets = Math.max(0, netPPE);
  const totalCurrentLiabilities    = bs.payables + bs.accrued + bs.taxPayable;
  const totalNonCurrentLiabilities = bs.ltDebt;
  const totalLiabilities = totalCurrentLiabilities + totalNonCurrentLiabilities;
  const totalEquity      = bs.shareCapital + bs.retainedEarnings;
  const totalAssets      = totalCurrentAssets + totalNonCurrentAssets;

  return {
    ...bs,
    totalCurrentAssets,
    totalNonCurrentAssets,
    totalAssets,
    totalCurrentLiabilities,
    totalNonCurrentLiabilities,
    totalLiabilities,
    totalEquity,
  };
}

/** Format a number with thousands separators, no currency sign, no decimals */
export function fmtUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
}

/** Full number format — no currency sign, no decimals */
export function fmtFull(amount: number, _currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount);
}
