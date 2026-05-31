// ============================================================================
// KPI TYPES - ZeusOS CEO Strategy Command
// TypeScript interfaces for KPI management
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  KPICategory,
  KPIType,
  KPIStatus,
  KPIScope,
  KPIDirection,
  KPIFrequency,
  KPIPerformance,
  KPIDataSource,
  KPIAggregationMethod,
  KPIScorecardType,
  KPIThresholdType,
  BSCPerspective,
  KPIAlertType,
  KPIAlertSeverity,
} from '../constants/kpi.constants';

// ----------------------------------------------------------------------------
// KPI Definition
// ----------------------------------------------------------------------------
export interface KPIDefinition {
  id: string;
  companyId: string;

  // Basic Information
  code: string;
  name: string;
  description: string;
  category: KPICategory;
  type: KPIType;
  status: KPIStatus;

  // Scope & Ownership
  scope: KPIScope;
  subsidiaryId?: string;
  departmentId?: string;
  teamId?: string;
  projectId?: string;
  ownerId: string;
  ownerName?: string;

  // Measurement Configuration
  unit: string;
  direction: KPIDirection;
  frequency: KPIFrequency;
  decimalPlaces: number;

  // Targets & Thresholds
  target: KPITarget;
  thresholds: KPIThreshold[];

  // Data Source
  dataSource: KPIDataSourceConfig;

  // Calculation (for derived KPIs)
  calculation?: KPICalculation;

  // Aggregation (for composite KPIs)
  aggregation?: KPIAggregationConfig;

  // Relationships
  linkedStrategyPillarId?: string;
  linkedOKRKeyResultIds?: string[];
  parentKPIId?: string;
  childKPIIds: string[];

  // BSC Perspective
  bscPerspective?: BSCPerspective;

  // Library Reference
  libraryEntryId?: string;

  // Tags & Metadata
  tags: string[];
  isPublic: boolean;
  isFavorite?: boolean;
  order?: number;

  // Current Performance (denormalized for quick access)
  currentValue?: number;
  currentPerformance?: KPIPerformance;
  lastDataPointDate?: Timestamp;
  trendDirection?: 'up' | 'down' | 'stable';

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ----------------------------------------------------------------------------
// KPI Target
// ----------------------------------------------------------------------------
export interface KPITarget {
  value: number;
  stretchValue?: number;
  minimumValue?: number;
  rangeMin?: number;
  rangeMax?: number;
  fiscalYear?: number;
  quarter?: number;
  effectiveFrom?: Timestamp;
  effectiveTo?: Timestamp;
  baselineValue?: number;
  baselineDate?: Timestamp;
}

// ----------------------------------------------------------------------------
// KPI Threshold
// ----------------------------------------------------------------------------
export interface KPIThreshold {
  id: string;
  level: number;
  name: string;
  type: KPIThresholdType;
  value: number;
  comparison: 'above' | 'below' | 'equals' | 'between';
  upperValue?: number;
  color: string;
  alertEnabled: boolean;
  alertRecipients?: string[];
}

// ----------------------------------------------------------------------------
// KPI Data Source Config
// ----------------------------------------------------------------------------
export interface KPIDataSourceConfig {
  type: KPIDataSource;
  entryInstructions?: string;
  approvalRequired?: boolean;
  approverIds?: string[];
  formula?: string;
  inputKPIIds?: string[];
  apiEndpoint?: string;
  apiMapping?: Record<string, string>;
  queryDefinition?: string;
  fileFormat?: string;
  columnMapping?: Record<string, string>;
  aggregateFromKPIIds?: string[];
  aggregationMethod?: KPIAggregationMethod;
}

// ----------------------------------------------------------------------------
// KPI Calculation
// ----------------------------------------------------------------------------
export interface KPICalculation {
  formula: string;
  variables: KPICalculationVariable[];
  evaluationOrder?: number;
  cacheResult?: boolean;
}

export interface KPICalculationVariable {
  name: string;
  sourceType: 'kpi' | 'constant' | 'parameter';
  sourceId?: string;
  constantValue?: number;
  parameterKey?: string;
}

// ----------------------------------------------------------------------------
// KPI Aggregation Config
// ----------------------------------------------------------------------------
export interface KPIAggregationConfig {
  method: KPIAggregationMethod;
  sourceKPIIds: string[];
  weights?: Record<string, number>;
  filters?: KPIAggregationFilter[];
}

export interface KPIAggregationFilter {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'in';
  value: string | string[];
}

// ----------------------------------------------------------------------------
// KPI Data Point
// ----------------------------------------------------------------------------
export interface KPIDataPoint {
  id: string;
  kpiId: string;
  companyId: string;

  date: Timestamp;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  fiscalYear: number;
  fiscalQuarter?: number;
  fiscalMonth?: number;

  value: number;
  previousValue?: number;
  target?: number;
  variance?: number;
  variancePercent?: number;

  performanceStatus: KPIPerformance;
  score?: number;

  note?: string;
  attachments?: string[];

  dataSource: KPIDataSource;
  sourceReference?: string;

  enteredBy: string;
  enteredByName?: string;
  enteredAt: Timestamp;
  verifiedBy?: string;
  verifiedAt?: Timestamp;
  isAdjusted?: boolean;
  adjustmentReason?: string;
}

// ----------------------------------------------------------------------------
// KPI Scorecard
// ----------------------------------------------------------------------------
export interface KPIScorecard {
  id: string;
  companyId: string;

  name: string;
  description?: string;
  type: KPIScorecardType;
  status: KPIStatus;

  scope: KPIScope;
  subsidiaryId?: string;
  departmentId?: string;
  teamId?: string;

  fiscalYear: number;
  quarter?: number;

  sections: ScorecardSection[];

  overallScore?: number;
  overallPerformance?: KPIPerformance;

  showTrends: boolean;
  showTargets: boolean;
  showVariance: boolean;
  refreshFrequency: KPIFrequency;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ScorecardSection {
  id: string;
  name: string;
  description?: string;
  category?: KPICategory;
  bscPerspective?: BSCPerspective;
  kpiIds: string[];
  weight: number;
  order: number;
  color?: string;
}

// ----------------------------------------------------------------------------
// KPI Trend
// ----------------------------------------------------------------------------
export interface KPITrend {
  kpiId: string;
  periods: KPITrendPeriod[];
  trendDirection: 'up' | 'down' | 'stable';
  trendStrength: number;
  projectedValue?: number;
  projectedDate?: Timestamp;
}

export interface KPITrendPeriod {
  date: Timestamp;
  value: number;
  target?: number;
  performance: KPIPerformance;
}

// ----------------------------------------------------------------------------
// KPI Alert
// ----------------------------------------------------------------------------
export interface KPIAlert {
  id: string;
  kpiId: string;
  kpiCode: string;
  kpiName: string;
  companyId: string;

  type: KPIAlertType;
  severity: KPIAlertSeverity;

  title: string;
  message: string;

  thresholdId?: string;
  currentValue?: number;
  thresholdValue?: number;

  triggeredAt: Timestamp;
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
  resolvedAt?: Timestamp;
  resolvedBy?: string;

  notificationsSent: KPIAlertNotification[];
}

export interface KPIAlertNotification {
  userId: string;
  channel: 'email' | 'sms' | 'push' | 'in_app';
  sentAt: Timestamp;
  status: 'sent' | 'delivered' | 'failed';
}

// ----------------------------------------------------------------------------
// KPI Analytics
// ----------------------------------------------------------------------------
export interface KPIAnalytics {
  companyId: string;
  asOfDate: Timestamp;

  totalKPIs: number;
  byCategory: Record<KPICategory, number>;
  byStatus: Record<KPIStatus, number>;
  byPerformance: Record<KPIPerformance, number>;
  byScope: Record<KPIScope, number>;

  overallHealthScore: number;
  exceedingCount: number;
  onTargetCount: number;
  belowTargetCount: number;
  criticalCount: number;
  noDataCount: number;

  staleKPIsCount: number;
  averageScore: number;

  topPerformers: KPIPerformanceSummary[];
  underPerformers: KPIPerformanceSummary[];

  trends: {
    improving: number;
    declining: number;
    stable: number;
  };
}

export interface KPIPerformanceSummary {
  kpiId: string;
  kpiName: string;
  kpiCode: string;
  category: KPICategory;
  currentValue: number;
  target: number;
  variance: number;
  variancePercent: number;
  performance: KPIPerformance;
  trend: 'up' | 'down' | 'stable';
}

// ----------------------------------------------------------------------------
// KPI Summary (For cards/lists)
// ----------------------------------------------------------------------------
export interface KPISummary {
  id: string;
  code: string;
  name: string;
  category: KPICategory;
  type: KPIType;
  currentValue?: number;
  targetValue?: number;
  unit: string;
  performance: KPIPerformance;
  trend: 'up' | 'down' | 'stable';
  variance?: number;
  variancePercent?: number;
  lastUpdated?: Timestamp;
  isStale: boolean;
}

// ----------------------------------------------------------------------------
// Form Input Types
// ----------------------------------------------------------------------------
export interface CreateKPIInput {
  code: string;
  name: string;
  description?: string;
  libraryEntryId?: string;
  category: KPICategory;
  type: KPIType;
  scope: KPIScope;
  subsidiaryId?: string;
  departmentId?: string;
  teamId?: string;
  projectId?: string;
  ownerId: string;
  ownerName?: string;
  unit: string;
  direction: KPIDirection;
  frequency: KPIFrequency;
  decimalPlaces?: number;
  target: KPITarget;
  thresholds?: Omit<KPIThreshold, 'id'>[];
  dataSourceType: KPIDataSource;
  formula?: string;
  linkedStrategyPillarId?: string;
  linkedOKRKeyResultIds?: string[];
  bscPerspective?: BSCPerspective;
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdateKPIInput {
  code?: string;
  name?: string;
  description?: string;
  category?: KPICategory;
  type?: KPIType;
  ownerId?: string;
  ownerName?: string;
  unit?: string;
  direction?: KPIDirection;
  frequency?: KPIFrequency;
  decimalPlaces?: number;
  linkedStrategyPillarId?: string | null;
  linkedOKRKeyResultIds?: string[];
  bscPerspective?: BSCPerspective | null;
  tags?: string[];
  isPublic?: boolean;
  isFavorite?: boolean;
}

export interface CreateDataPointInput {
  kpiId: string;
  date: Date;
  periodStart?: Date;
  periodEnd?: Date;
  fiscalYear: number;
  fiscalQuarter?: number;
  fiscalMonth?: number;
  value: number;
  note?: string;
  /**
   * Stable key identifying the upstream record that produced this value
   * (e.g. `auto:finance:2026-05`). When set, the data service upserts
   * instead of inserting on a matching (kpiId, sourceReference). Used by
   * the auto-measurement pipeline so source corrections flow through.
   */
  sourceReference?: string;
  /** Override KPI's configured data source (e.g. `calculated` for auto). */
  dataSourceOverride?: KPIDataSource;
}

export interface CreateScorecardInput {
  name: string;
  description?: string;
  type: KPIScorecardType;
  scope: KPIScope;
  subsidiaryId?: string;
  departmentId?: string;
  teamId?: string;
  fiscalYear: number;
  quarter?: number;
  sections: CreateScorecardSectionInput[];
  showTrends?: boolean;
  showTargets?: boolean;
  showVariance?: boolean;
  refreshFrequency?: KPIFrequency;
}

export interface UpdateScorecardInput {
  name?: string;
  description?: string;
  status?: KPIStatus;
  showTrends?: boolean;
  showTargets?: boolean;
  showVariance?: boolean;
  refreshFrequency?: KPIFrequency;
}

export interface CreateScorecardSectionInput {
  name: string;
  description?: string;
  category?: KPICategory;
  bscPerspective?: BSCPerspective;
  kpiIds: string[];
  weight: number;
  color?: string;
}

export interface UpdateScorecardSectionInput {
  name?: string;
  description?: string;
  category?: KPICategory;
  bscPerspective?: BSCPerspective;
  kpiIds?: string[];
  weight?: number;
  color?: string;
}

// ----------------------------------------------------------------------------
// Filter Types
// ----------------------------------------------------------------------------
export interface KPIFilters {
  category?: KPICategory;
  scope?: KPIScope;
  status?: KPIStatus;
  subsidiaryId?: string;
  departmentId?: string;
  teamId?: string;
  ownerId?: string;
  linkedStrategyPillarId?: string;
  bscPerspective?: BSCPerspective;
  performance?: KPIPerformance;
  tags?: string[];
  searchQuery?: string;
  favoritesOnly?: boolean;
}

export interface ScorecardFilters {
  type?: KPIScorecardType;
  scope?: KPIScope;
  status?: KPIStatus;
  fiscalYear?: number;
  quarter?: number;
  subsidiaryId?: string;
  departmentId?: string;
}

export interface DataPointFilters {
  startDate?: Date;
  endDate?: Date;
  fiscalYear?: number;
  fiscalQuarter?: number;
  maxResults?: number;
}

// ----------------------------------------------------------------------------
// Dashboard Types
// ----------------------------------------------------------------------------
export interface KPIDashboardData {
  analytics: KPIAnalytics;
  topKPIs: KPISummary[];
  criticalAlerts: KPIAlert[];
  recentDataPoints: KPIDataPoint[];
  scorecards: KPIScorecard[];
  categoryBreakdown: {
    category: KPICategory;
    count: number;
    avgPerformance: number;
  }[];
}

export interface KPIComparisonData {
  kpiId: string;
  kpiName: string;
  periods: {
    label: string;
    value: number;
    target: number;
    performance: KPIPerformance;
  }[];
  periodOverPeriodChange: number;
  yearOverYearChange?: number;
}
