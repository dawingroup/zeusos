/**
 * Variance Types
 * Types for planned vs actual analysis and variance tracking
 */

// Variance Types for MatFlow Planned vs Actual Analysis

// ============================================================================
// VARIANCE STATUS AND ALERTS
// ============================================================================

export type VarianceStatus = 
  | 'on-track'
  | 'under-procured'
  | 'over-procured'
  | 'cost-overrun'
  | 'cost-savings'
  | 'at-risk';

export type VarianceAlertType =
  | 'quantity-overrun'
  | 'quantity-shortage'
  | 'cost-overrun'
  | 'unit-price-spike'
  | 'high-rejection-rate'
  | 'delivery-delay'
  | 'supplier-concentration';

export interface VarianceAlert {
  id: string;
  type: VarianceAlertType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  threshold: number;
  actualValue: number;
  createdAt: Date;
}

// ============================================================================
// MATERIAL VARIANCE
// ============================================================================

export interface MaterialInfo {
  id: string;
  name: string;
  category?: string;
}

export interface MaterialVariance {
  materialId: string;
  materialInfo: MaterialInfo;
  
  planned: {
    quantity: number;
    unitCost: number;
    totalCost: number;
    unit: string;
  };
  
  actual: {
    quantityOrdered: number;
    quantityAccepted: number;
    quantityRejected: number;
    averageUnitCost: number;
    totalCost: number;
    pendingQuantity: number;
  };
  
  variance: {
    quantityDelta: number;
    quantityPercent: number;
    costDelta: number;
    costPercent: number;
    fulfillmentPercent: number;
  };
  
  status: VarianceStatus;
  alerts: VarianceAlert[];
}

// ============================================================================
// STAGE VARIANCE
// ============================================================================

export interface StageVariance {
  stageId: string;
  stageName: string;
  stageOrder: number;
  
  totalPlannedCost: number;
  totalActualCost: number;
  costVariancePercent: number;
  
  materialsCount: number;
  fullyProcured: number;
  partiallyProcured: number;
  notStarted: number;
  overProcured: number;
  
  fulfillmentPercent: number;
  status: VarianceStatus;
  
  materials: MaterialVariance[];
}

// ============================================================================
// PROJECT VARIANCE SUMMARY
// ============================================================================

export interface ProjectVarianceSummary {
  projectId: string;
  calculatedAt: Date;
  
  totalPlannedCost: number;
  totalActualCost: number;
  totalCommittedCost: number;
  costVariance: number;
  costVariancePercent: number;
  
  totalMaterialsPlanned: number;
  materialsFullyProcured: number;
  materialsPartiallyProcured: number;
  materialsNotStarted: number;
  materialsOverProcured: number;
  overallFulfillmentPercent: number;
  
  totalAccepted: number;
  totalRejected: number;
  overallAcceptanceRate: number;
  
  stages: StageVariance[];
  
  topCostOverruns: MaterialVariance[];
  topShortages: MaterialVariance[];
  recentAlerts: VarianceAlert[];
}

// ============================================================================
// TREND DATA
// ============================================================================

export interface VarianceTrend {
  date: Date;
  plannedCumulative: number;
  actualCumulative: number;
  variancePercent: number;
}

export interface CostTrend {
  date: Date;
  budgetedCumulative: number;
  actualCumulative: number;
  committedCumulative: number;
  variancePercent: number;
}

// ============================================================================
// FILTERS AND THRESHOLDS
// ============================================================================

export interface VarianceFilters {
  stageIds?: string[];
  materialIds?: string[];
  status?: VarianceStatus[];
  minVariancePercent?: number;
  maxVariancePercent?: number;
  showOnlyAlerts?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface VarianceThresholds {
  quantityOverrunPercent: number;
  quantityShortagePercent: number;
  costOverrunPercent: number;
  costSavingsPercent: number;
  unitPriceSpikePercent: number;
  rejectionRatePercent: number;
  supplierConcentrationPercent: number;
}

export const DEFAULT_THRESHOLDS: VarianceThresholds = {
  quantityOverrunPercent: 5,
  quantityShortagePercent: 20,
  costOverrunPercent: 10,
  costSavingsPercent: 10,
  unitPriceSpikePercent: 15,
  rejectionRatePercent: 10,
  supplierConcentrationPercent: 80,
};
