// ============================================================================
// PROFITABILITY ENGINE — Pure Calculation Functions
// ZeusOS v2.0 - Finance Module
// Breakeven analysis + Goal Seek solver (all algebraic, closed-form)
// ============================================================================

import type { PLActuals } from './forecastService';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ProfitabilityMetrics {
  revenue: number;
  cogs: number;
  opex: number;
  depreciation: number;
  interest: number;
  tax: number;
  grossProfit: number;
  operatingProfit: number;
  ebitda: number;
  ebit: number;
  ebt: number;
  netProfit: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
}

export interface BreakevenResult {
  fixedCosts: number;
  variableCostRatio: number;
  variableCosts: number;
  totalCosts: number;
  breakevenRevenue: number;
  marginOfSafety: number;
  marginOfSafetyPct: number;
  chartData: BreakevenChartPoint[];
}

export interface BreakevenChartPoint {
  revenue: number;
  revenueLine: number;
  variableCosts: number;
  fixedCosts: number;
  totalCosts: number;
}

// ── Goal Seek Types ────────────────────────────────────────────────────────────

export type GoalMetricId =
  | 'grossProfit'
  | 'grossProfitMargin'
  | 'operatingProfit'
  | 'operatingProfitMargin'
  | 'profitabilityRatio'
  | 'ebt'
  | 'netProfitMargin';

export interface GoalMetricDefinition {
  id: GoalMetricId;
  label: string;
  isPercentage: boolean;
  compute: (a: PLActuals) => number;
}

export type SensitivityLeverId = 'price' | 'volume' | 'fixedExpenses' | 'variableCOS';

export interface SensitivityResult {
  leverId: SensitivityLeverId;
  label: string;
  requiredChangePct: number;
  sensitivity: 'HIGH' | 'MEDIUM' | 'LOW';
  currentValue: number;
}

// ── Profitability Computation ──────────────────────────────────────────────────

export function computeProfitability(a: PLActuals): ProfitabilityMetrics {
  const grossProfit = a.revenue - a.cogs;
  const operatingProfit = grossProfit - a.opex;
  const ebitda = operatingProfit;
  const ebit = ebitda - a.depreciation;
  const ebt = ebit - a.interest;
  const netProfit = ebt - a.tax;

  return {
    revenue: a.revenue,
    cogs: a.cogs,
    opex: a.opex,
    depreciation: a.depreciation,
    interest: a.interest,
    tax: a.tax,
    grossProfit,
    operatingProfit,
    ebitda,
    ebit,
    ebt,
    netProfit,
    grossMargin: a.revenue !== 0 ? grossProfit / a.revenue : 0,
    operatingMargin: a.revenue !== 0 ? operatingProfit / a.revenue : 0,
    netMargin: a.revenue !== 0 ? netProfit / a.revenue : 0,
  };
}

// ── Breakeven Computation ──────────────────────────────────────────────────────

/**
 * Variable costs = COGS (scales linearly with revenue)
 * Fixed costs = opex + depreciation + interest (do not scale)
 * Tax excluded from breakeven (function of profit, not revenue)
 *
 * Breakeven Revenue = Fixed Costs / (1 - Variable Cost Ratio)
 */
export function computeBreakeven(a: PLActuals): BreakevenResult {
  const fixedCosts = a.opex + a.depreciation + a.interest;
  const variableCostRatio = a.revenue > 0 ? a.cogs / a.revenue : 0;
  const variableCosts = a.cogs;
  const totalCosts = fixedCosts + variableCosts;

  const contributionMarginRatio = 1 - variableCostRatio;
  const breakevenRevenue = contributionMarginRatio > 0
    ? fixedCosts / contributionMarginRatio
    : Infinity;

  const marginOfSafety = a.revenue - breakevenRevenue;
  const marginOfSafetyPct = a.revenue > 0 ? marginOfSafety / a.revenue : 0;

  // Chart data: 0 to ~2× revenue (or 1.5× breakeven), 20 steps
  const maxRevenue = Math.max(a.revenue * 2, isFinite(breakevenRevenue) ? breakevenRevenue * 1.5 : a.revenue * 2);
  const steps = 20;
  const chartData: BreakevenChartPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const rev = (maxRevenue / steps) * i;
    chartData.push({
      revenue: rev,
      revenueLine: rev,
      variableCosts: variableCostRatio * rev,
      fixedCosts,
      totalCosts: fixedCosts + variableCostRatio * rev,
    });
  }

  return {
    fixedCosts,
    variableCostRatio,
    variableCosts,
    totalCosts,
    breakevenRevenue,
    marginOfSafety,
    marginOfSafetyPct,
    chartData,
  };
}

// ── Goal Metric Registry ───────────────────────────────────────────────────────

export const GOAL_METRICS: GoalMetricDefinition[] = [
  {
    id: 'grossProfit',
    label: 'Gross Profit',
    isPercentage: false,
    compute: (a) => a.revenue - a.cogs,
  },
  {
    id: 'grossProfitMargin',
    label: 'Gross Profit Margin',
    isPercentage: true,
    compute: (a) => a.revenue > 0 ? (a.revenue - a.cogs) / a.revenue : 0,
  },
  {
    id: 'operatingProfit',
    label: 'Operating Profit',
    isPercentage: false,
    compute: (a) => a.revenue - a.cogs - a.opex,
  },
  {
    id: 'operatingProfitMargin',
    label: 'Operating Profit Margin',
    isPercentage: true,
    compute: (a) => a.revenue > 0 ? (a.revenue - a.cogs - a.opex) / a.revenue : 0,
  },
  {
    id: 'profitabilityRatio',
    label: 'Profitability Ratio',
    isPercentage: true,
    compute: (a) => {
      const net = a.revenue - a.cogs - a.opex - a.depreciation - a.interest - a.tax;
      return a.revenue > 0 ? net / a.revenue : 0;
    },
  },
  {
    id: 'ebt',
    label: 'EBT (Earnings Before Tax)',
    isPercentage: false,
    compute: (a) => a.revenue - a.cogs - a.opex - a.depreciation - a.interest,
  },
  {
    id: 'netProfitMargin',
    label: 'Net Profit After Tax Margin',
    isPercentage: true,
    compute: (a) => {
      const net = a.revenue - a.cogs - a.opex - a.depreciation - a.interest - a.tax;
      return a.revenue > 0 ? net / a.revenue : 0;
    },
  },
];

// ── Goal Seek Solver ───────────────────────────────────────────────────────────

export function solveGoalSeek(
  actuals: PLActuals,
  metricId: GoalMetricId,
  targetValue: number,
): SensitivityResult[] {
  const { revenue: R, cogs: C, opex: E, depreciation: D, interest: I, tax: X } = actuals;

  const results: SensitivityResult[] = [];

  // 1. PRICE: R' = R(1+p), C/E unchanged
  results.push({
    leverId: 'price',
    label: 'Price',
    requiredChangePct: solvePriceLever(R, C, E, D, I, X, metricId, targetValue),
    sensitivity: 'HIGH',
    currentValue: 0,
  });

  // 2. VOLUME: R' = R(1+v), C' = C(1+v), E unchanged
  results.push({
    leverId: 'volume',
    label: 'Volume',
    requiredChangePct: solveVolumeLever(R, C, E, D, I, X, metricId, targetValue),
    sensitivity: 'HIGH',
    currentValue: 0,
  });

  // 3. FIXED EXPENSES: E' = E(1+f)
  results.push({
    leverId: 'fixedExpenses',
    label: 'Fixed Expenses',
    requiredChangePct: solveFixedExpenseLever(R, C, E, D, I, X, metricId, targetValue),
    sensitivity: 'MEDIUM',
    currentValue: 0,
  });

  // 4. VARIABLE COS: C' = C(1+c)
  results.push({
    leverId: 'variableCOS',
    label: 'Variable COS',
    requiredChangePct: solveVariableCOSLever(R, C, E, D, I, X, metricId, targetValue),
    sensitivity: 'MEDIUM',
    currentValue: 0,
  });

  // Classify sensitivity by required change magnitude
  for (const r of results) {
    r.sensitivity = categorizeSensitivity(r.requiredChangePct);
  }

  // Sort: HIGH first, then MEDIUM, then LOW
  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  results.sort((a, b) => order[a.sensitivity] - order[b.sensitivity]);

  return results;
}

// ── Individual lever solvers ───────────────────────────────────────────────────

function solvePriceLever(
  R: number, C: number, E: number, D: number, I: number, X: number,
  metricId: GoalMetricId, T: number,
): number {
  if (R === 0) return Infinity;
  switch (metricId) {
    case 'grossProfit':          return (T - R + C) / R;
    case 'grossProfitMargin':    return T >= 1 ? Infinity : C / (R * (1 - T)) - 1;
    case 'operatingProfit':      return (T + C + E - R) / R;
    case 'operatingProfitMargin': return T >= 1 ? Infinity : (C + E) / (R * (1 - T)) - 1;
    case 'ebt':                  return (T + C + E + D + I - R) / R;
    case 'profitabilityRatio':
    case 'netProfitMargin':      return T >= 1 ? Infinity : (C + E + D + I + X) / (R * (1 - T)) - 1;
    default: return 0;
  }
}

function solveVolumeLever(
  R: number, C: number, E: number, D: number, I: number, X: number,
  metricId: GoalMetricId, T: number,
): number {
  const GP = R - C;
  if (GP === 0) return Infinity;
  switch (metricId) {
    case 'grossProfit':          return T / GP - 1;
    case 'grossProfitMargin':    return Infinity; // volume cannot change gross margin
    case 'operatingProfit':      return (T + E) / GP - 1;
    case 'operatingProfitMargin': {
      const denom = R * (T - 1) + C;
      return denom === 0 ? Infinity : -E / denom - 1;
    }
    case 'ebt':                  return (T + E + D + I) / GP - 1;
    case 'profitabilityRatio':
    case 'netProfitMargin': {
      const k = E + D + I + X;
      const denom = R * (T - 1) + C;
      return denom === 0 ? Infinity : -k / denom - 1;
    }
    default: return 0;
  }
}

function solveFixedExpenseLever(
  R: number, C: number, E: number, D: number, I: number, X: number,
  metricId: GoalMetricId, T: number,
): number {
  if (E === 0) return Infinity;
  switch (metricId) {
    case 'grossProfit':
    case 'grossProfitMargin':    return Infinity; // fixed exp doesn't affect GP
    case 'operatingProfit':      return (R - C - E - T) / E;
    case 'operatingProfitMargin': return (R - C - T * R) / E - 1;
    case 'ebt':                  return (R - C - E - D - I - T) / E;
    case 'profitabilityRatio':
    case 'netProfitMargin':      return (R - C - D - I - X - T * R) / E - 1;
    default: return 0;
  }
}

function solveVariableCOSLever(
  R: number, C: number, E: number, D: number, I: number, X: number,
  metricId: GoalMetricId, T: number,
): number {
  if (C === 0) return Infinity;
  switch (metricId) {
    case 'grossProfit':          return (R - C - T) / C;
    case 'grossProfitMargin':    return R * (1 - T) / C - 1;
    case 'operatingProfit':      return (R - C - E - T) / C;
    case 'operatingProfitMargin': return (R - T * R - E) / C - 1;
    case 'ebt':                  return (R - C - E - D - I - T) / C;
    case 'profitabilityRatio':
    case 'netProfitMargin':      return (R - T * R - E - D - I - X) / C - 1;
    default: return 0;
  }
}

/**
 * Given all four lever positions, compute the resulting metric value.
 * Used for interactive slider preview.
 */
export function computeMetricWithLevers(
  actuals: PLActuals,
  metricId: GoalMetricId,
  pricePct: number,
  volumePct: number,
  fixedExpPct: number,
  variableCOSPct: number,
): number {
  const R = actuals.revenue * (1 + pricePct) * (1 + volumePct);
  const C = actuals.cogs * (1 + volumePct) * (1 + variableCOSPct);
  const E = actuals.opex * (1 + fixedExpPct);
  const adjusted: PLActuals = {
    revenue: R, cogs: C, opex: E,
    depreciation: actuals.depreciation,
    interest: actuals.interest,
    tax: actuals.tax,
  };
  const metric = GOAL_METRICS.find(m => m.id === metricId)!;
  return metric.compute(adjusted);
}

function categorizeSensitivity(changePct: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  const abs = Math.abs(changePct);
  if (!isFinite(abs)) return 'LOW';
  if (abs <= 0.50) return 'HIGH';
  if (abs <= 1.50) return 'MEDIUM';
  return 'LOW';
}
