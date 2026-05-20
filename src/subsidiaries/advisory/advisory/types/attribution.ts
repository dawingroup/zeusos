/**
 * Performance Attribution Analysis
 * 
 * Decompose returns into constituent factors:
 * - Entry multiple / Initial valuation
 * - Value creation (revenue, margin, other)
 * - Multiple expansion / Exit multiple
 * - Leverage effect
 * - Currency impact
 * - Fee drag
 */

import { Timestamp } from 'firebase/firestore';
import type { Currency, MoneyAmount } from './portfolio';
import type { ReturnPeriod } from './performance';

// ============================================================================
// ATTRIBUTION TYPES
// ============================================================================

export type AttributionType =
  | 'value_creation'
  | 'brinson'
  | 'factor'
  | 'risk'
  | 'transaction_cost';

export type ValueCreationDriver =
  | 'entry_multiple'
  | 'revenue_growth'
  | 'margin_expansion'
  | 'multiple_expansion'
  | 'leverage_effect'
  | 'fx_impact'
  | 'fee_drag'
  | 'other';

// ============================================================================
// PERFORMANCE ATTRIBUTION
// ============================================================================

export interface PerformanceAttribution {
  id: string;
  
  scope: 'holding' | 'portfolio' | 'client';
  scopeId: string;
  
  period: ReturnPeriod;
  startDate: Timestamp;
  endDate: Timestamp;
  
  totalReturn: number;
  totalReturnAmount: MoneyAmount;
  
  valueCreationAttribution: ValueCreationAttribution;
  brinsonAttribution?: BrinsonAttribution;
  factorAttribution?: FactorAttribution;
  feeAttribution: FeeAttribution;
  currencyAttribution: CurrencyAttribution;
  
  byHolding?: AttributionByDimension[];
  bySector?: AttributionByDimension[];
  byGeography?: AttributionByDimension[];
  byVintage?: AttributionByDimension[];
  byStrategy?: AttributionByDimension[];
  
  calculatedAt: Timestamp;
  methodology: string;
  notes?: string;
}

// ============================================================================
// VALUE CREATION ATTRIBUTION
// ============================================================================

export interface ValueCreationAttribution {
  entryValue: MoneyAmount;
  entryMultiple?: number;
  
  exitValue: MoneyAmount;
  exitMultiple?: number;
  
  components: ValueCreationComponent[];
  
  totalValueCreated: MoneyAmount;
  totalValueCreatedPercent: number;
}

export interface ValueCreationComponent {
  driver: ValueCreationDriver;
  
  amount: MoneyAmount;
  percentContribution: number;
  absoluteContribution: number;
  
  details?: {
    startValue?: number;
    endValue?: number;
    change?: number;
    changePercent?: number;
    description?: string;
  };
}

// ============================================================================
// BRINSON ATTRIBUTION (Portfolio Level)
// ============================================================================

export interface BrinsonAttribution {
  totalActiveReturn: number;
  
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  
  bySector: BrinsonSectorAttribution[];
  
  benchmarkId: string;
  benchmarkReturn: number;
}

export interface BrinsonSectorAttribution {
  sector: string;
  sectorName: string;
  
  portfolioWeight: number;
  benchmarkWeight: number;
  weightDifference: number;
  
  portfolioReturn: number;
  benchmarkSectorReturn: number;
  
  allocationEffect: number;
  selectionEffect: number;
  interactionEffect: number;
  totalEffect: number;
}

// ============================================================================
// FACTOR ATTRIBUTION
// ============================================================================

export interface FactorAttribution {
  model: 'capm' | 'fama_french_3' | 'fama_french_5' | 'custom';
  
  totalReturn: number;
  factorReturn: number;
  specificReturn: number;
  
  factors: FactorContribution[];
  
  residual: {
    return: number;
    rSquared: number;
    standardError: number;
  };
}

export interface FactorContribution {
  factor: string;
  
  exposure: number;
  exposureChange: number;
  
  factorReturn: number;
  
  contribution: number;
  contributionPercent: number;
  
  tStatistic?: number;
  isSignificant?: boolean;
}

// ============================================================================
// FEE ATTRIBUTION
// ============================================================================

export interface FeeAttribution {
  totalFeeDrag: number;
  totalFeeAmount: MoneyAmount;
  
  managementFee: {
    amount: MoneyAmount;
    basisPoints: number;
    impact: number;
  };
  
  performanceFee: {
    amount: MoneyAmount;
    effectiveRate: number;
    impact: number;
  };
  
  transactionCosts: {
    amount: MoneyAmount;
    impact: number;
  };
  
  otherFees: {
    amount: MoneyAmount;
    breakdown: { type: string; amount: MoneyAmount }[];
    impact: number;
  };
  
  grossReturn: number;
  netReturn: number;
  feeDrag: number;
}

// ============================================================================
// CURRENCY ATTRIBUTION
// ============================================================================

export interface CurrencyAttribution {
  totalCurrencyImpact: number;
  totalCurrencyAmount: MoneyAmount;
  
  byCurrency: CurrencyImpact[];
  
  hedgingAnalysis?: {
    hedgedReturn: number;
    unhedgedReturn: number;
    hedgingCost: number;
    hedgingBenefit: number;
    hedgeRatio: number;
  };
}

export interface CurrencyImpact {
  currency: Currency;
  
  weight: number;
  
  startFxRate: number;
  endFxRate: number;
  fxChange: number;
  
  localReturn: number;
  fxContribution: number;
  totalReturnInBase: number;
}

// ============================================================================
// ATTRIBUTION BY DIMENSION
// ============================================================================

export interface AttributionByDimension {
  dimension: string;
  dimensionId?: string;
  
  avgWeight: number;
  startWeight: number;
  endWeight: number;
  
  return: number;
  
  contribution: number;
  contributionPercent: number;
  
  benchmarkWeight?: number;
  benchmarkReturn?: number;
  activeWeight?: number;
  activeReturn?: number;
}

// ============================================================================
// ATTRIBUTION SUMMARY
// ============================================================================

export interface AttributionSummary {
  portfolioId: string;
  period: ReturnPeriod;
  
  totalReturn: number;
  
  topContributors: {
    name: string;
    contribution: number;
    return: number;
  }[];
  
  bottomContributors: {
    name: string;
    contribution: number;
    return: number;
  }[];
  
  allocationVsSelection: {
    allocation: number;
    selection: number;
    interaction: number;
  };
  
  feeImpact: number;
  currencyImpact: number;
}
