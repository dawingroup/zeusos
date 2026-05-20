/**
 * Performance Tracking - Returns Calculation & Analytics
 * 
 * Comprehensive performance measurement system:
 * - Time-weighted returns (TWR) for manager comparison
 * - Money-weighted returns (IRR) for investor returns
 * - Multiple on invested capital (MOIC/TVPI)
 * - Distribution metrics (DPI, RVPI)
 * - Risk-adjusted returns (Sharpe, Sortino)
 */

import { Timestamp } from 'firebase/firestore';
import type { Currency, MoneyAmount } from './portfolio';

// ============================================================================
// RETURN CALCULATION TYPES
// ============================================================================

export type ReturnCalculationMethod =
  | 'irr'
  | 'twr'
  | 'mwr'
  | 'moic'
  | 'dpi'
  | 'rvpi'
  | 'tvpi';

export type ReturnPeriod =
  | 'mtd'
  | 'qtd'
  | 'ytd'
  | 'since_inception'
  | 'trailing_1m'
  | 'trailing_3m'
  | 'trailing_6m'
  | 'trailing_1y'
  | 'trailing_3y'
  | 'trailing_5y'
  | 'trailing_10y'
  | 'custom';

export type ReturnType =
  | 'gross'
  | 'net'
  | 'gross_of_mgmt'
  | 'net_of_mgmt'
  | 'net_of_carry';

export type AnnualizationMethod =
  | 'compound'
  | 'simple'
  | 'actual'
  | 'linear';

// ============================================================================
// CASH FLOW TYPES
// ============================================================================

export type CashFlowType =
  | 'capital_call'
  | 'distribution'
  | 'recallable_distribution'
  | 'investment'
  | 'realization'
  | 'income'
  | 'fee_payment'
  | 'expense'
  | 'fx_adjustment'
  | 'transfer'
  | 'other';

export interface CashFlow {
  id: string;
  date: Timestamp;
  type: CashFlowType;
  amount: MoneyAmount;
  direction: 'inflow' | 'outflow';
  
  portfolioId?: string;
  holdingId?: string;
  transactionId?: string;
  
  category: 'capital' | 'income' | 'expense' | 'other';
  isRecurring: boolean;
  
  includeInIrr: boolean;
  includeInTwr: boolean;
  
  description?: string;
  counterparty?: string;
  reference?: string;
  
  createdAt: Timestamp;
  createdBy: string;
}

// ============================================================================
// RETURN METRICS TYPES
// ============================================================================

export interface ReturnMetrics {
  grossIrr: number | null;
  netIrr: number | null;
  grossTwr: number | null;
  netTwr: number | null;
  
  grossMoic: number | null;
  netMoic: number | null;
  dpi: number | null;
  rvpi: number | null;
  tvpi: number | null;
  
  currentYield: number | null;
  yieldOnCost: number | null;
  cashOnCash: number | null;
  
  periodReturns: PeriodReturns;
  
  asOfDate: Timestamp;
  calculationDate: Timestamp;
  methodology: ReturnCalculationMethodology;
}

export interface PeriodReturns {
  mtd: number | null;
  qtd: number | null;
  ytd: number | null;
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
  tenYear: number | null;
  sinceInception: number | null;
  sinceInceptionCumulative: number | null;
}

export interface ReturnCalculationMethodology {
  irrMethod: 'newton_raphson' | 'bisection' | 'excel_xirr';
  twrMethod: 'daily' | 'modified_dietz' | 'linked_modified_dietz' | 'true_twr';
  annualizationMethod: AnnualizationMethod;
  dayCountConvention: '30/360' | 'actual/360' | 'actual/365' | 'actual/actual';
  
  feesTreatment: 'deducted_from_nav' | 'separate_cash_flow' | 'accrued';
  uncommittedCapitalTreatment: 'excluded' | 'included_at_zero' | 'included_at_rate';
  recallableDistributionTreatment: 'distribution' | 'not_counted' | 'conditional';
  
  currencyTreatment: 'local' | 'reporting' | 'hedged';
  reportingCurrency: Currency;
  fxRateSource: string;
}

// ============================================================================
// RISK-ADJUSTED RETURNS
// ============================================================================

export interface RiskAdjustedReturns {
  volatility: number | null;
  downsideDeviation: number | null;
  maxDrawdown: number | null;
  maxDrawdownDuration: number | null;
  maxDrawdownPeak: Timestamp | null;
  maxDrawdownTrough: Timestamp | null;
  maxDrawdownRecovery: Timestamp | null;
  
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  treynorRatio: number | null;
  informationRatio: number | null;
  
  alpha: number | null;
  beta: number | null;
  trackingError: number | null;
  
  var95: number | null;
  var99: number | null;
  cvar95: number | null;
  
  riskFreeRate: number;
  benchmarkReturn: number;
  calculationPeriod: ReturnPeriod;
  dataFrequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

// ============================================================================
// PERFORMANCE SNAPSHOT
// ============================================================================

export type PerformanceScope =
  | 'holding'
  | 'portfolio'
  | 'client'
  | 'engagement'
  | 'strategy'
  | 'sector'
  | 'geography'
  | 'vintage'
  | 'firm';

export interface PerformanceSnapshot {
  id: string;
  
  scope: PerformanceScope;
  scopeId: string;
  
  asOfDate: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  period: ReturnPeriod;
  
  capitalMetrics: {
    totalCommitment: MoneyAmount;
    paidInCapital: MoneyAmount;
    uncalledCapital: MoneyAmount;
    distributions: MoneyAmount;
    recallableDistributions: MoneyAmount;
    netContributions: MoneyAmount;
    currentNav: MoneyAmount;
    totalValue: MoneyAmount;
  };
  
  returnMetrics: ReturnMetrics;
  
  riskAdjustedReturns?: RiskAdjustedReturns;
  benchmarkComparison?: BenchmarkComparisonResult[];
  attribution?: PerformanceAttributionSummary;
  peerComparison?: PeerRankingSummary;
  vintageAnalysis?: VintageAnalysisSummary;
  
  status: 'draft' | 'preliminary' | 'final' | 'audited';
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  calculatedAt: Timestamp;
  calculatedBy: string;
  methodology: ReturnCalculationMethodology;
  notes?: string;
}

export interface BenchmarkComparisonResult {
  benchmarkId: string;
  benchmarkName: string;
  portfolioReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
}

export interface PerformanceAttributionSummary {
  totalReturn: number;
  valueCreation: number;
  feeImpact: number;
  currencyImpact: number;
}

export interface PeerRankingSummary {
  universeId: string;
  irrQuartile: 1 | 2 | 3 | 4;
  tvpiQuartile: 1 | 2 | 3 | 4;
  percentileRank: number;
}

export interface VintageAnalysisSummary {
  vintage: number;
  vintageMedianIrr: number;
  vintageMedianTvpi: number;
  portfolioIrrRank: number;
}

// ============================================================================
// PERFORMANCE HISTORY
// ============================================================================

export interface PerformanceHistory {
  id: string;
  scope: PerformanceScope;
  scopeId: string;
  
  dataPoints: PerformanceDataPoint[];
  
  statistics: {
    avgReturn: number;
    medianReturn: number;
    bestPeriod: { date: Timestamp; return: number };
    worstPeriod: { date: Timestamp; return: number };
    positivePeriods: number;
    negativePeriods: number;
    winRate: number;
  };
  
  startDate: Timestamp;
  endDate: Timestamp;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  
  generatedAt: Timestamp;
  methodology: ReturnCalculationMethodology;
}

export interface PerformanceDataPoint {
  date: Timestamp;
  
  nav: MoneyAmount;
  previousNav: MoneyAmount;
  cashFlows: MoneyAmount;
  
  periodReturn: number;
  cumulativeReturn: number;
  
  irr?: number;
  moic?: number;
  tvpi?: number;
  
  benchmarkReturn?: number;
  excessReturn?: number;
}

// ============================================================================
// J-CURVE ANALYSIS
// ============================================================================

export interface JCurveAnalysis {
  portfolioId: string;
  asOfDate: Timestamp;
  
  dataPoints: JCurveDataPoint[];
  
  jCurveBottom: {
    quarter: number;
    irr: number;
    moic: number;
    date: Timestamp;
  } | null;
  
  breakeven: {
    quarterToBreakeven: number | null;
    dateOfBreakeven: Timestamp | null;
    hasReachedBreakeven: boolean;
  };
  
  currentPosition: {
    quartersSinceInception: number;
    irr: number;
    moic: number;
    dpi: number;
    rvpi: number;
  };
  
  projection?: {
    targetIrr: number;
    targetMoic: number;
    projectedExitQuarter: number;
    confidenceLevel: 'high' | 'medium' | 'low';
  };
}

export interface JCurveDataPoint {
  quarter: number;
  date: Timestamp;
  paidInCapital: MoneyAmount;
  distributions: MoneyAmount;
  nav: MoneyAmount;
  irr: number;
  moic: number;
  dpi: number;
  rvpi: number;
  tvpi: number;
}

// ============================================================================
// PERFORMANCE CALCULATION INPUT
// ============================================================================

export interface PerformanceCalculationInput {
  portfolioId: string;
  asOfDate: Date;
  methodology: ReturnCalculationMethodology;
  includeBenchmarks?: string[];
  includePeerComparison?: string;
  calculateAttribution?: boolean;
}

export interface PerformanceCalculationResult {
  returnMetrics: ReturnMetrics;
  riskAdjustedReturns?: RiskAdjustedReturns;
  benchmarkComparisons?: BenchmarkComparisonResult[];
  peerRanking?: PeerRankingSummary;
  attribution?: PerformanceAttributionSummary;
  calculatedAt: Timestamp;
}
