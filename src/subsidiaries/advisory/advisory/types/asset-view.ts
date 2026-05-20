/**
 * Unified Asset View Types
 * 
 * Provides a consolidated view of infrastructure assets
 * across all modules - Advisory, Investment, and Delivery.
 */

import { Timestamp } from 'firebase/firestore';
import type { MoneyAmount } from './portfolio';

// ============================================================================
// UNIFIED ASSET VIEW
// ============================================================================

export type UnifiedAssetType =
  | 'greenfield'
  | 'brownfield'
  | 'operational'
  | 'development_stage'
  | 'mixed';

export type InfrastructureSector =
  | 'healthcare'
  | 'education'
  | 'energy'
  | 'transport'
  | 'water'
  | 'ict'
  | 'housing'
  | 'agriculture'
  | 'industrial'
  | 'social'
  | 'mixed_use';

export type AssetStatus =
  | 'pipeline'
  | 'development'
  | 'construction'
  | 'commissioning'
  | 'operational'
  | 'distressed'
  | 'exited';

export type OperationalStatus =
  | 'pre_operational'
  | 'ramp_up'
  | 'stabilized'
  | 'mature'
  | 'declining'
  | 'turnaround';

export type ScheduleStatus =
  | 'ahead'
  | 'on_track'
  | 'behind'
  | 'critical';

export type ValuationMethod =
  | 'cost'
  | 'dcf'
  | 'comparable'
  | 'nav'
  | 'appraisal';

export type ProgressMethod =
  | 'milestone'
  | 'earned_value'
  | 'units'
  | 'manual';

export type DataFreshness =
  | 'real_time'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'stale';

// ============================================================================
// ASSET FINANCIALS
// ============================================================================

export interface AssetFinancials {
  totalInvestment: MoneyAmount;
  equityInvested: MoneyAmount;
  debtOutstanding: MoneyAmount;
  
  currentValuation: MoneyAmount;
  valuationMethod: ValuationMethod;
  valuationDate: Timestamp;
  
  unrealizedValue: MoneyAmount;
  realizedValue: MoneyAmount;
  totalValue: MoneyAmount;
  moic: number;
  irr?: number;
  
  cumulativeDistributions: MoneyAmount;
  cumulativeContributions: MoneyAmount;
  netCashFlow: MoneyAmount;
  
  budgetedCost?: MoneyAmount;
  actualCost?: MoneyAmount;
  costVariance?: MoneyAmount;
  costVariancePercent?: number;
}

// ============================================================================
// ASSET PROGRESS
// ============================================================================

export interface AssetProgress {
  physicalProgress: number;
  physicalProgressMethod: ProgressMethod;
  
  financialProgress: number;
  
  scheduledProgress: number;
  scheduleVariance: number;
  scheduleStatus: ScheduleStatus;
  
  lastProgressUpdate: Timestamp;
  nextMilestone?: {
    name: string;
    targetDate: Timestamp;
    description?: string;
  };
  
  activeIssues: number;
  criticalIssues: number;
  
  qualityScore?: number;
  defectsOpen?: number;
}

// ============================================================================
// UNIFIED ASSET VIEW
// ============================================================================

export interface UnifiedAssetView {
  id: string;
  
  assetType: UnifiedAssetType;
  assetName: string;
  assetDescription?: string;
  
  location: {
    country: string;
    region?: string;
    city?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  
  sector: InfrastructureSector;
  subSector?: string;
  
  linkedEntities: {
    portfolioIds: string[];
    holdingIds: string[];
    clientIds: string[];
    dealIds: string[];
    projectIds: string[];
    engagementIds: string[];
    programIds: string[];
  };
  
  financials: AssetFinancials;
  progress?: AssetProgress;
  
  status: AssetStatus;
  operationalStatus?: OperationalStatus;
  
  timeline: {
    conceptDate?: Timestamp;
    developmentStartDate?: Timestamp;
    constructionStartDate?: Timestamp;
    expectedCompletionDate?: Timestamp;
    actualCompletionDate?: Timestamp;
    operationalDate?: Timestamp;
  };
  
  lastUpdated: Timestamp;
  dataFreshness: DataFreshness;
}

// ============================================================================
// ASSET AGGREGATION
// ============================================================================

export type AggregationGroupBy =
  | 'sector'
  | 'country'
  | 'status'
  | 'client'
  | 'portfolio';

export interface AssetAggregation {
  groupBy: AggregationGroupBy;
  groupValue: string;
  
  assetCount: number;
  
  totalInvestment: MoneyAmount;
  totalValuation: MoneyAmount;
  totalEquity: MoneyAmount;
  totalDebt: MoneyAmount;
  
  weightedMOIC: number;
  weightedIRR?: number;
  
  averagePhysicalProgress?: number;
  averageFinancialProgress?: number;
  
  statusBreakdown: {
    status: AssetStatus;
    count: number;
    value: MoneyAmount;
  }[];
}

// ============================================================================
// CROSS-MODULE DASHBOARD DATA
// ============================================================================

export type ActivityType =
  | 'deal_closed'
  | 'holding_created'
  | 'project_milestone'
  | 'capital_deployed';

export type AlertSeverity =
  | 'info'
  | 'warning'
  | 'critical';

export type ModuleType =
  | 'advisory'
  | 'investment'
  | 'delivery';

export interface DashboardActivity {
  type: ActivityType;
  entityId: string;
  entityName: string;
  description: string;
  timestamp: Timestamp;
}

export interface DashboardAlert {
  severity: AlertSeverity;
  module: ModuleType;
  message: string;
  entityId?: string;
  timestamp: Timestamp;
}

export interface CrossModuleDashboard {
  summary: {
    totalAUM: MoneyAmount;
    totalClientsServed: number;
    totalActiveDeals: number;
    totalActiveProjects: number;
    totalAssets: number;
  };
  
  pipeline: {
    dealsInPipeline: number;
    pipelineValue: MoneyAmount;
    expectedCloses30Days: number;
    expectedClosesValue30Days: MoneyAmount;
  };
  
  portfolioPerformance: {
    aggregateIRR: number;
    aggregateMOIC: number;
    tvpi: number;
    dpi: number;
    rvpi: number;
  };
  
  deliveryStatus: {
    activeProjects: number;
    onTrackProjects: number;
    atRiskProjects: number;
    delayedProjects: number;
    totalBudget: MoneyAmount;
    totalSpent: MoneyAmount;
  };
  
  recentActivity: DashboardActivity[];
  alerts: DashboardAlert[];
  
  lastUpdated: Timestamp;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface BuildAssetViewInput {
  projectId: string;
  includeFinancials?: boolean;
  includeProgress?: boolean;
}

export interface AssetAggregationQuery {
  groupBy: AggregationGroupBy;
  groupValue: string;
  includeBreakdown?: boolean;
}
