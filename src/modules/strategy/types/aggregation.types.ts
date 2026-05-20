// ============================================================================
// AGGREGATION TYPES
// DawinOS v2.0 - CEO Strategy Command Module
// Type definitions for performance aggregation
// ============================================================================

import { Timestamp } from 'firebase/firestore';
import {
  AggregationLevel,
  PerformanceDomain,
  PerformanceRating,
  TrendIndicator,
  ComparisonPeriod,
  AggregationMethod,
  HealthIndicator,
  SnapshotFrequency,
} from '../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// AGGREGATED PERFORMANCE
// ----------------------------------------------------------------------------

export interface AggregatedPerformance {
  id: string;
  companyId: string;
  
  // Scope
  level: AggregationLevel;
  entityId: string;
  entityName: string;
  parentEntityId?: string;
  
  // Time Period
  fiscalYear: number;
  quarter?: number;
  month?: number;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  
  // Domain Scores (0-100)
  strategyScore: number;
  okrScore: number;
  kpiScore: number;
  combinedScore: number;
  
  // Weights Used
  weights: PerformanceWeights;
  
  // Rating
  rating: PerformanceRating;
  
  // Trend
  trend: TrendIndicator;
  previousScore?: number;
  scoreChange?: number;
  scoreChangePercent?: number;
  
  // Component Counts
  strategyCount: number;
  okrCount: number;
  kpiCount: number;
  
  // Health Summary
  health: PerformanceHealth;
  
  // Child Aggregations
  childAggregations?: ChildAggregationSummary[];
  
  // Metadata
  calculatedAt: Timestamp;
  calculatedBy: string;
  isSnapshot: boolean;
}

export interface PerformanceWeights {
  strategy: number;
  okr: number;
  kpi: number;
}

export interface PerformanceHealth {
  overall: HealthIndicator;
  strategyHealth: HealthIndicator;
  okrHealth: HealthIndicator;
  kpiHealth: HealthIndicator;
  
  // Detailed counts
  criticalIssues: number;
  warningIssues: number;
  healthyItems: number;
  noDataItems: number;
}

export interface ChildAggregationSummary {
  entityId: string;
  entityName: string;
  level: AggregationLevel;
  combinedScore: number;
  rating: PerformanceRating;
  trend: TrendIndicator;
}

// ----------------------------------------------------------------------------
// STRATEGY AGGREGATION
// ----------------------------------------------------------------------------

export interface StrategyAggregation {
  totalPlans: number;
  activePlans: number;
  completedPlans: number;
  
  // Pillar Progress
  pillarProgress: PillarProgress[];
  averagePillarProgress: number;
  
  // Objective Status
  totalObjectives: number;
  completedObjectives: number;
  onTrackObjectives: number;
  atRiskObjectives: number;
  
  // Initiative Status
  totalInitiatives: number;
  completedInitiatives: number;
  onTrackInitiatives: number;
  delayedInitiatives: number;
  
  // Overall Score (0-100)
  score: number;
}

export interface PillarProgress {
  pillarId: string;
  pillarName: string;
  progress: number;
  objectivesCount: number;
  completedObjectives: number;
  status: 'on_track' | 'at_risk' | 'delayed' | 'completed';
}

// ----------------------------------------------------------------------------
// OKR AGGREGATION
// ----------------------------------------------------------------------------

export interface OKRAggregation {
  // Objective Counts
  totalObjectives: number;
  completedObjectives: number;
  onTrackObjectives: number;
  atRiskObjectives: number;
  notStartedObjectives: number;
  
  // Key Result Counts
  totalKeyResults: number;
  completedKeyResults: number;
  onTrackKeyResults: number;
  atRiskKeyResults: number;
  
  // Scores (0.0 - 1.0 Google style)
  averageObjectiveScore: number;
  averageKeyResultScore: number;
  
  // Converted to 0-100 for aggregation
  score: number;
  
  // By Level
  byLevel: Record<string, OKRLevelSummary>;
  
  // Alignment
  alignmentScore: number;
  cascadingDepth: number;
}

export interface OKRLevelSummary {
  level: string;
  objectivesCount: number;
  averageScore: number;
  completionRate: number;
}

// ----------------------------------------------------------------------------
// KPI AGGREGATION
// ----------------------------------------------------------------------------

export interface KPIAggregation {
  // Counts
  totalKPIs: number;
  activeKPIs: number;
  
  // Performance Distribution
  exceedingCount: number;
  onTargetCount: number;
  belowTargetCount: number;
  criticalCount: number;
  noDataCount: number;
  
  // Scores
  averageScore: number;
  healthScore: number;
  
  // Converted to 0-100 for aggregation
  score: number;
  
  // By Category
  byCategory: Record<string, KPICategorySummary>;
  
  // Trend
  improvingCount: number;
  decliningCount: number;
  stableCount: number;
}

export interface KPICategorySummary {
  category: string;
  kpiCount: number;
  averageScore: number;
  performanceStatus: string;
}

// ----------------------------------------------------------------------------
// PERFORMANCE SNAPSHOT
// ----------------------------------------------------------------------------

export interface PerformanceSnapshot {
  id: string;
  companyId: string;
  
  // Scope
  level: AggregationLevel;
  entityId: string;
  entityName: string;
  
  // Time
  snapshotDate: Timestamp;
  fiscalYear: number;
  fiscalQuarter: number;
  fiscalMonth: number;
  frequency: SnapshotFrequency;
  
  // Scores
  strategyScore: number;
  okrScore: number;
  kpiScore: number;
  combinedScore: number;
  
  // Rating
  rating: PerformanceRating;
  
  // Detailed Data
  strategyData: StrategyAggregation;
  okrData: OKRAggregation;
  kpiData: KPIAggregation;
  
  // Comparison
  comparison?: SnapshotComparison;
  
  // Metadata
  createdAt: Timestamp;
  createdBy: string;
}

export interface SnapshotComparison {
  period: ComparisonPeriod;
  previousScore: number;
  currentScore: number;
  change: number;
  changePercent: number;
  trend: TrendIndicator;
}

// ----------------------------------------------------------------------------
// PERFORMANCE TREND
// ----------------------------------------------------------------------------

export interface PerformanceTrend {
  entityId: string;
  entityName: string;
  level: AggregationLevel;
  domain: PerformanceDomain;
  
  // Data Points
  dataPoints: TrendDataPoint[];
  
  // Analysis
  trend: TrendIndicator;
  trendStrength: number;
  volatility: number;
  
  // Projections
  projectedScore?: number;
  projectedRating?: PerformanceRating;
  confidenceLevel?: number;
  
  // Period Info
  periodStart: Timestamp;
  periodEnd: Timestamp;
  dataPointCount: number;
}

export interface TrendDataPoint {
  date: Timestamp;
  score: number;
  rating: PerformanceRating;
  strategyScore?: number;
  okrScore?: number;
  kpiScore?: number;
}

// ----------------------------------------------------------------------------
// PERFORMANCE HIERARCHY
// ----------------------------------------------------------------------------

export interface PerformanceHierarchy {
  root: PerformanceNode;
  depth: number;
  totalNodes: number;
  aggregationMethod: AggregationMethod;
}

export interface PerformanceNode {
  id: string;
  name: string;
  level: AggregationLevel;
  
  // Scores
  combinedScore: number;
  strategyScore: number;
  okrScore: number;
  kpiScore: number;
  
  // Status
  rating: PerformanceRating;
  trend: TrendIndicator;
  health: HealthIndicator;
  
  // Hierarchy
  children: PerformanceNode[];
  childCount: number;
  
  // Contribution to parent
  weight?: number;
  contributionPercent?: number;
}

// ----------------------------------------------------------------------------
// PERFORMANCE COMPARISON
// ----------------------------------------------------------------------------

export interface PerformanceComparison {
  entities: ComparisonEntity[];
  domain: PerformanceDomain;
  period: {
    fiscalYear: number;
    quarter?: number;
    month?: number;
  };
  
  // Rankings
  rankings: EntityRanking[];
  
  // Statistics
  average: number;
  median: number;
  standardDeviation: number;
  topPerformer: string;
  bottomPerformer: string;
}

export interface ComparisonEntity {
  entityId: string;
  entityName: string;
  level: AggregationLevel;
  score: number;
  rating: PerformanceRating;
  trend: TrendIndicator;
  rank: number;
  percentile: number;
}

export interface EntityRanking {
  rank: number;
  entityId: string;
  entityName: string;
  score: number;
  previousRank?: number;
  rankChange?: number;
}

// ----------------------------------------------------------------------------
// HEATMAP DATA
// ----------------------------------------------------------------------------

export interface PerformanceHeatmap {
  rows: HeatmapRow[];
  columns: HeatmapColumn[];
  cells: HeatmapCell[];
  
  // Scale
  minValue: number;
  maxValue: number;
  
  // Metadata
  rowType: 'entity' | 'category' | 'time';
  columnType: 'domain' | 'metric' | 'time';
}

export interface HeatmapRow {
  id: string;
  label: string;
  level?: AggregationLevel;
}

export interface HeatmapColumn {
  id: string;
  label: string;
  domain?: PerformanceDomain;
}

export interface HeatmapCell {
  rowId: string;
  columnId: string;
  value: number;
  rating: PerformanceRating;
  trend?: TrendIndicator;
  tooltip?: string;
}

// ----------------------------------------------------------------------------
// AGGREGATION CONFIGURATION
// ----------------------------------------------------------------------------

export interface AggregationConfig {
  id: string;
  companyId: string;
  name: string;
  
  // Weights
  weights: PerformanceWeights;
  
  // Levels to Include
  includeLevels: AggregationLevel[];
  
  // Aggregation Method
  method: AggregationMethod;
  
  // Snapshot Settings
  snapshotFrequency: SnapshotFrequency;
  snapshotRetentionDays: number;
  
  // Thresholds
  ratingThresholds: Record<PerformanceRating, number>;
  
  // Active
  isActive: boolean;
  isDefault: boolean;
  
  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ----------------------------------------------------------------------------
// CALCULATION INPUT
// ----------------------------------------------------------------------------

export interface AggregationInput {
  level: AggregationLevel;
  entityId: string;
  entityName: string;
  fiscalYear: number;
  quarter?: number;
  month?: number;
  weights?: PerformanceWeights;
  includeChildren?: boolean;
}

// ----------------------------------------------------------------------------
// API RESPONSES
// ----------------------------------------------------------------------------

export interface AggregationResponse {
  success: boolean;
  data: AggregatedPerformance;
  calculationTime: number;
  warnings?: string[];
}

export interface TrendResponse {
  success: boolean;
  data: PerformanceTrend;
  dataPointsAnalyzed: number;
}

export interface ComparisonResponse {
  success: boolean;
  data: PerformanceComparison;
  entitiesCompared: number;
}

// ----------------------------------------------------------------------------
// FILTER TYPES
// ----------------------------------------------------------------------------

export interface SnapshotFilters {
  level?: AggregationLevel;
  entityId?: string;
  frequency?: SnapshotFrequency;
  fiscalYear?: number;
  quarter?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface AggregationFilters {
  level?: AggregationLevel;
  entityIds?: string[];
  fiscalYear?: number;
  quarter?: number;
  month?: number;
  includeChildren?: boolean;
}
