/**
 * Allocation Management Types
 * 
 * Manages portfolio allocation:
 * - Strategic asset allocation
 * - Tactical adjustments
 * - Rebalancing rules
 * - Drift monitoring
 */

import { Timestamp } from 'firebase/firestore';
import type { MoneyAmount } from './portfolio';

export interface StrategicAllocation {
  id: string;
  portfolioId: string;
  
  effectiveDate: Timestamp;
  expiryDate?: Timestamp;
  
  status: 'draft' | 'proposed' | 'approved' | 'active' | 'expired';
  
  targets: AllocationTargets;
  rebalancingPolicy: RebalancingPolicy;
  
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  notes?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy?: string;
  updatedAt?: Timestamp;
}

export interface AllocationTargets {
  bySector: AllocationTarget[];
  byGeography: AllocationTarget[];
  byStage: AllocationTarget[];
  byInstrument: AllocationTarget[];
  byCurrency?: AllocationTarget[];
  byVintage?: AllocationTarget[];
  byRiskProfile?: AllocationTarget[];
  byLiquidity?: AllocationTarget[];
}

export interface AllocationTarget {
  category: string;
  targetWeight: number;
  minWeight: number;
  maxWeight: number;
  priority: 'must_have' | 'should_have' | 'nice_to_have';
}

export interface RebalancingPolicy {
  approach: 'calendar' | 'threshold' | 'hybrid' | 'none';
  
  calendarFrequency?: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  
  driftThresholds?: {
    warning: number;
    breach: number;
    absoluteMax?: number;
  };
  
  rebalancingBands?: {
    narrow: number;
    wide: number;
  };
  
  constraints?: {
    minTradeSize?: MoneyAmount;
    maxTurnover?: number;
    taxEfficiency?: boolean;
    transactionCostLimit?: MoneyAmount;
  };
  
  autoRebalance?: boolean;
  approvalRequired?: boolean;
  approvalThreshold?: MoneyAmount;
}

export interface AllocationAnalysis {
  portfolioId: string;
  analysisDate: Timestamp;
  
  currentAllocation: ActualAllocation;
  targetAllocation: AllocationTargets;
  
  varianceAnalysis: CategoryVariance[];
  
  overallDriftStatus: 'in_range' | 'warning' | 'breach';
  
  rebalancingNeeded: boolean;
  recommendations?: RebalancingRecommendation[];
  
  concentrationAnalysis: ConcentrationAnalysis;
  
  riskContribution?: RiskContribution[];
}

export interface ActualAllocation {
  bySector: ActualAllocationItem[];
  byGeography: ActualAllocationItem[];
  byStage: ActualAllocationItem[];
  byInstrument: ActualAllocationItem[];
  byCurrency?: ActualAllocationItem[];
}

export interface ActualAllocationItem {
  category: string;
  value: MoneyAmount;
  weight: number;
  holdingCount: number;
  holdingIds?: string[];
}

export interface CategoryVariance {
  dimension: 'sector' | 'geography' | 'stage' | 'instrument' | 'currency';
  category: string;
  targetWeight: number;
  actualWeight: number;
  variance: number;
  absoluteVariance: number;
  status: 'in_range' | 'warning' | 'breach';
  minWeight: number;
  maxWeight: number;
}

export interface RebalancingRecommendation {
  action: 'increase' | 'decrease' | 'maintain';
  dimension: string;
  category: string;
  currentWeight: number;
  targetWeight: number;
  suggestedChange: number;
  estimatedTradeSize?: MoneyAmount;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
}

export interface ConcentrationAnalysis {
  largestHolding: { holdingId: string; weight: number };
  top5Holdings: { holdingId: string; weight: number }[];
  top10Holdings: { holdingId: string; weight: number }[];
  
  herfindahlIndex: number;
  effectiveNumberOfHoldings: number;
  
  breaches: ConcentrationBreach[];
}

export interface ConcentrationBreach {
  type: 'single_asset' | 'sector' | 'geography' | 'counterparty';
  entity: string;
  limit: number;
  actual: number;
  excess: number;
}

export interface RiskContribution {
  category: string;
  marginalContribution: number;
  percentContribution: number;
  beta?: number;
  tracking_error?: number;
}

export interface AllocationChange {
  id: string;
  portfolioId: string;
  changeDate: Timestamp;
  
  previousAllocation: AllocationTargets;
  newAllocation: AllocationTargets;
  
  reason: string;
  approvedBy?: string;
  approvedAt?: Timestamp;
  
  createdBy: string;
  createdAt: Timestamp;
}
