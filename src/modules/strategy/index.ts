/**
 * Strategy Module
 * 
 * AI-powered design strategy generation with trend analysis
 * and production feasibility assessment
 * 
 * Also includes CEO Strategy Command - Strategy Document System
 * for executive-level strategic planning and alignment tracking
 * 
 * @module strategy
 */

// ============================================================================
// DESIGN STRATEGY (Original)
// ============================================================================

// Types
export * from './types';

// Components
export { StrategyPDF, StrategyGenerator } from './components';

// ============================================================================
// CEO STRATEGY COMMAND - Strategy Document System
// ============================================================================

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
export {
  // Document Types
  STRATEGY_DOCUMENT_TYPE,
  STRATEGY_DOCUMENT_TYPE_LABELS,
  STRATEGY_DOCUMENT_TYPE_ICONS,
  // Document Status
  STRATEGY_DOCUMENT_STATUS,
  STRATEGY_DOCUMENT_STATUS_LABELS,
  STRATEGY_DOCUMENT_STATUS_COLORS,
  // Strategy Scope
  STRATEGY_SCOPE,
  STRATEGY_SCOPE_LABELS,
  STRATEGY_SCOPE_ORDER,
  // Time Horizons
  TIME_HORIZON,
  TIME_HORIZON_LABELS,
  TIME_HORIZON_MONTHS,
  // Pillar Categories
  PILLAR_CATEGORY,
  PILLAR_CATEGORY_LABELS,
  PILLAR_CATEGORY_COLORS,
  PILLAR_CATEGORY_ICONS,
  // Review Frequency
  REVIEW_FREQUENCY,
  REVIEW_FREQUENCY_LABELS,
  REVIEW_FREQUENCY_DAYS,
  // Approval Levels
  STRATEGY_APPROVAL_LEVEL,
  STRATEGY_APPROVAL_LEVEL_LABELS,
  // Objective Priority & Status
  OBJECTIVE_PRIORITY,
  OBJECTIVE_PRIORITY_LABELS,
  OBJECTIVE_PRIORITY_COLORS,
  OBJECTIVE_STATUS,
  OBJECTIVE_STATUS_LABELS,
  OBJECTIVE_STATUS_COLORS,
  // Pillar Status
  PILLAR_STATUS,
  PILLAR_STATUS_LABELS,
  PILLAR_STATUS_COLORS,
  // Risk
  RISK_LIKELIHOOD,
  RISK_IMPACT,
  RISK_STATUS,
  // Alignment
  ALIGNMENT_ENTITY_TYPE,
  ALIGNMENT_STRENGTH,
  // Metric Direction
  METRIC_DIRECTION,
  // Collections & Defaults
  STRATEGY_COLLECTIONS,
  STRATEGY_DEFAULTS,
  // Dawin Subsidiaries
  DAWIN_SUBSIDIARIES,
  DAWIN_SUBSIDIARY_LABELS,
} from './constants/strategy.constants';

export type {
  StrategyDocumentType,
  StrategyDocumentStatus,
  StrategyScope,
  TimeHorizon,
  PillarCategory,
  PillarStatus,
  ReviewFrequency,
  StrategyApprovalLevel,
  ObjectivePriority,
  ObjectiveStatus,
  RiskLikelihood,
  RiskImpact,
  RiskStatus,
  AlignmentEntityType,
  AlignmentStrength,
  MetricDirection,
  DawinSubsidiary,
} from './constants/strategy.constants';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export type {
  // Core Document Types
  StrategyDocument,
  StrategyDocumentContent,
  StrategicPillar,
  PillarOwner,
  StrategicObjective,
  PillarMetric,
  StrategyRisk,
  StrategyAttachment,
  // Version & History
  StrategyVersion,
  // Alignment
  StrategyAlignment,
  // Review
  StrategyReview,
  PillarUpdate,
  // Summary Types
  StrategySummary,
  PillarSummary,
  MilestoneSummary,
  // Input Types
  CreateStrategyDocumentInput,
  UpdateStrategyDocumentInput,
  CreatePillarInput,
  UpdatePillarInput,
  CreateObjectiveInput,
  UpdateObjectiveInput,
  CreateMetricInput,
  UpdateMetricInput,
  CreateRiskInput,
  UpdateRiskInput,
  CreateAlignmentInput,
  CreateReviewInput,
  // Filter Types
  StrategyDocumentFilters,
  AlignmentFilters,
  // Hierarchy Types
  StrategyHierarchy,
  StrategyTreeNode,
  // Business Strategy Review Types
  BusinessModelCanvas,
  CanvasItem,
  SWOTAnalysis,
  SWOTItem,
  MarketAnalysis,
  MarketSegment,
  CompetitiveAnalysis,
  CompetitorProfile,
  FinancialProjections,
  FinancialTarget,
  ImplementationRoadmap,
  RoadmapPhase,
  RoadmapMilestone,
  SectionReview,
  ReviewSectionStatus,
  StrategyReviewData,
  UploadedStrategyDocument,
  GeneratedOKR,
  GeneratedKeyResult,
  GeneratedKPI,
  StrategyActionItem,
  AIMessage,
  AISuggestion,
  AIStrategyAnalysisRequest,
  AIStrategyAnalysisResponse,
} from './types/strategy.types';

// ----------------------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------------------
export {
  // Risk & Content
  strategyRiskSchema,
  strategyContentSchema,
  // Pillar & Objective
  pillarMetricSchema,
  strategicObjectiveSchema,
  strategicPillarSchema,
  // Document Schemas
  createStrategyDocumentSchema,
  updateStrategyDocumentSchema,
  // Pillar Schemas
  createPillarSchema,
  updatePillarSchema,
  // Objective Schemas
  createObjectiveSchema,
  updateObjectiveSchema,
  // Metric Schemas
  createMetricSchema,
  updateMetricSchema,
  // Risk Schemas
  createRiskSchema,
  updateRiskSchema,
  // Alignment & Review
  createAlignmentSchema,
  createReviewSchema,
  // Validation Functions
  validateCreateStrategyDocument,
  validateUpdateStrategyDocument,
  validateCreatePillar,
  validateCreateObjective,
  validateCreateAlignment,
  validateCreateReview,
} from './schemas/strategy.schemas';

export type {
  CreateStrategyDocumentSchemaType,
  UpdateStrategyDocumentSchemaType,
  CreatePillarSchemaType,
  UpdatePillarSchemaType,
  CreateObjectiveSchemaType,
  UpdateObjectiveSchemaType,
  CreateMetricSchemaType,
  UpdateMetricSchemaType,
  CreateRiskSchemaType,
  UpdateRiskSchemaType,
  CreateAlignmentSchemaType,
  CreateReviewSchemaType,
  StrategyRiskSchemaType,
  StrategyContentSchemaType,
  PillarMetricSchemaType,
  StrategicObjectiveSchemaType,
  StrategicPillarSchemaType,
} from './schemas/strategy.schemas';

// ----------------------------------------------------------------------------
// Services
// ----------------------------------------------------------------------------
export { strategyDocumentService } from './services/strategyDocument.service';
export { strategyReviewService } from './services/strategyReview.service';

// ----------------------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------------------
export {
  useStrategyDocuments,
  useSubsidiaryStrategies,
  useActiveStrategies,
  useFiscalYearStrategies,
} from './hooks/useStrategyDocuments';

export type {
  UseStrategyDocumentsOptions,
  UseStrategyDocumentsReturn,
} from './hooks/useStrategyDocuments';

export {
  useStrategyDocument,
  useStrategyAlignments,
  useStrategyVersions,
} from './hooks/useStrategyDocument';

export type {
  UseStrategyDocumentOptions,
  UseStrategyDocumentReturn,
} from './hooks/useStrategyDocument';

// ============================================================================
// OKR (Objectives and Key Results) System
// ============================================================================

// ----------------------------------------------------------------------------
// OKR Constants
// ----------------------------------------------------------------------------
export {
  // OKR Level
  OKR_LEVEL,
  OKR_LEVEL_LABELS,
  OKR_LEVEL_ORDER,
  OKR_LEVEL_ICONS,
  // OKR Status
  OKR_STATUS,
  OKR_STATUS_LABELS,
  OKR_STATUS_COLORS,
  // Key Result Type
  KEY_RESULT_TYPE,
  KEY_RESULT_TYPE_LABELS,
  KEY_RESULT_TYPE_ICONS,
  // Confidence Level
  CONFIDENCE_LEVEL,
  CONFIDENCE_LEVEL_LABELS,
  CONFIDENCE_LEVEL_COLORS,
  CONFIDENCE_LEVEL_RANGES,
  // OKR Cycle
  OKR_CYCLE,
  OKR_CYCLE_LABELS,
  QUARTER_MONTHS,
  // OKR Cycle Status
  OKR_CYCLE_STATUS,
  OKR_CYCLE_STATUS_LABELS,
  // OKR Scoring
  OKR_SCORE_RANGE,
  getScoreRange,
  getScoreLabel,
  getScoreColor,
  // Check-In Frequency
  CHECK_IN_FREQUENCY,
  CHECK_IN_FREQUENCY_LABELS,
  CHECK_IN_FREQUENCY_DAYS,
  // Alignment Type
  OKR_ALIGNMENT_TYPE,
  OKR_ALIGNMENT_TYPE_LABELS,
  // Visibility
  OKR_VISIBILITY,
  OKR_VISIBILITY_LABELS,
  // Owner Type
  OKR_OWNER_TYPE,
  // Scoring Method
  OKR_SCORING_METHOD,
  // Collections & Defaults
  OKR_COLLECTIONS,
  OKR_DEFAULTS,
  // Utility Functions
  getCurrentQuarter,
  getQuarterDates,
  formatScore,
  formatProgress,
} from './constants/okr.constants';

export type {
  OKRLevel,
  OKRStatus,
  KeyResultType,
  ConfidenceLevel,
  OKRCycle,
  OKRCycleStatus,
  OKRScoreRangeKey,
  CheckInFrequency,
  OKRAlignmentType,
  OKRVisibility,
  OKROwnerType,
  OKRScoringMethod,
} from './constants/okr.constants';

// ----------------------------------------------------------------------------
// OKR Types
// ----------------------------------------------------------------------------
export type {
  // Core Types
  OKRObjective,
  KeyResult,
  KeyResultMilestone,
  KeyResultCheckIn,
  // Cycle Types
  OKRCyclePeriod,
  OKRCycleSettings,
  // Alignment
  OKRAlignment,
  // Score History
  OKRScoreHistory,
  KeyResultScoreSnapshot,
  // Analytics
  OKRAnalytics,
  OKRScoreDistribution,
  // Summary Types
  OKRSummary,
  OKRTreeNode,
  // Input Types (renamed to avoid conflict with Strategy types)
  CreateObjectiveInput as CreateOKRObjectiveInput,
  UpdateObjectiveInput as UpdateOKRObjectiveInput,
  CreateKeyResultInput,
  UpdateKeyResultInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
  CheckInInput,
  BulkCheckInInput,
  CreateCycleInput,
  UpdateCycleInput,
  // Filter Types
  OKRFilters,
  CycleFilters,
  // Progress Types
  OKRProgressUpdate,
  OKRProgressTrend,
  // Dashboard Types
  OKRDashboardData,
  OKRLeaderboard,
} from './types/okr.types';

// ----------------------------------------------------------------------------
// OKR Schemas (renamed to avoid conflicts with Strategy schemas)
// ----------------------------------------------------------------------------
export {
  // Milestone
  milestoneSchema as okrMilestoneSchema,
  // Key Result
  createKeyResultSchema,
  updateKeyResultSchema,
  // Objective
  createObjectiveSchema as createOKRObjectiveSchema,
  updateObjectiveSchema as updateOKRObjectiveSchema,
  // Check-In
  checkInSchema,
  bulkCheckInSchema,
  // Milestone Update
  updateMilestoneSchema,
  // Cycle
  cycleSettingsSchema,
  createCycleSchema,
  updateCycleSchema,
  // Alignment
  createAlignmentSchema as createOKRAlignmentSchema,
  // Validation Functions
  validateCreateObjective as validateCreateOKRObjective,
  validateUpdateObjective as validateUpdateOKRObjective,
  validateCreateKeyResult,
  validateUpdateKeyResult,
  validateCheckIn,
  validateBulkCheckIn,
  validateCreateCycle,
  validateUpdateCycle,
  validateCreateAlignment as validateCreateOKRAlignment,
} from './schemas/okr.schemas';

export type {
  MilestoneSchemaType as OKRMilestoneSchemaType,
  CreateKeyResultSchemaType,
  UpdateKeyResultSchemaType,
  CreateObjectiveSchemaType as CreateOKRObjectiveSchemaType,
  UpdateObjectiveSchemaType as UpdateOKRObjectiveSchemaType,
  CheckInSchemaType,
  BulkCheckInSchemaType,
  UpdateMilestoneSchemaType,
  CycleSettingsSchemaType,
  CreateCycleSchemaType,
  UpdateCycleSchemaType,
  CreateAlignmentSchemaType as CreateOKRAlignmentSchemaType,
} from './schemas/okr.schemas';

// ----------------------------------------------------------------------------
// OKR Service
// ----------------------------------------------------------------------------
export { okrService } from './services/okr.service';

// ----------------------------------------------------------------------------
// OKR Hooks
// ----------------------------------------------------------------------------
export {
  useOKRs,
  useMyOKRs,
  useCompanyOKRs,
  useTeamOKRs,
  useOKRAlignmentTree,
} from './hooks/useOKRs';

export type {
  UseOKRsOptions,
  UseOKRsReturn,
} from './hooks/useOKRs';

export {
  useOKRCycles,
  useOKRCycle,
  useActiveCycle,
} from './hooks/useOKRCycle';

export type {
  UseOKRCyclesOptions,
  UseOKRCyclesReturn,
  UseOKRCycleOptions,
  UseOKRCycleReturn,
} from './hooks/useOKRCycle';

// ============================================================================
// KPI (Key Performance Indicator) Framework
// ============================================================================

// ----------------------------------------------------------------------------
// KPI Constants
// ----------------------------------------------------------------------------
export {
  // Category
  KPI_CATEGORY,
  KPI_CATEGORY_LABELS,
  KPI_CATEGORY_COLORS,
  KPI_CATEGORY_ICONS,
  // Type
  KPI_TYPE,
  KPI_TYPE_LABELS,
  // Status
  KPI_STATUS as KPI_DEFINITION_STATUS,
  KPI_STATUS_LABELS as KPI_DEFINITION_STATUS_LABELS,
  KPI_STATUS_COLORS as KPI_DEFINITION_STATUS_COLORS,
  // Scope
  KPI_SCOPE,
  KPI_SCOPE_LABELS,
  // Direction
  KPI_DIRECTION,
  KPI_DIRECTION_LABELS,
  // Frequency
  KPI_FREQUENCY,
  KPI_FREQUENCY_LABELS,
  KPI_FREQUENCY_DAYS,
  // Performance
  KPI_PERFORMANCE,
  KPI_PERFORMANCE_LABELS,
  KPI_PERFORMANCE_COLORS,
  // Data Source
  KPI_DATA_SOURCE,
  KPI_DATA_SOURCE_LABELS,
  // Aggregation
  KPI_AGGREGATION_METHOD,
  KPI_AGGREGATION_METHOD_LABELS,
  // Scorecard
  KPI_SCORECARD_TYPE,
  KPI_SCORECARD_TYPE_LABELS,
  // Threshold
  KPI_THRESHOLD_TYPE,
  // BSC Perspective
  BSC_PERSPECTIVE,
  BSC_PERSPECTIVE_LABELS,
  BSC_PERSPECTIVE_COLORS,
  // Alert
  KPI_ALERT_TYPE,
  KPI_ALERT_SEVERITY,
  // Collections & Defaults
  KPI_COLLECTIONS,
  KPI_DEFAULTS,
  // Templates
  KPI_TEMPLATES,
  // Utility Functions
  getPerformanceColor,
  getCategoryColor,
  formatKPIValue,
} from './constants/kpi.constants';

export type {
  KPICategory,
  KPIType,
  KPIStatus as KPIDefinitionStatus,
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
} from './constants/kpi.constants';

// ----------------------------------------------------------------------------
// KPI Types
// ----------------------------------------------------------------------------
export type {
  // Definition
  KPIDefinition,
  KPITarget,
  KPIThreshold,
  KPIDataSourceConfig,
  KPICalculation,
  KPICalculationVariable,
  KPIAggregationConfig,
  KPIAggregationFilter,
  // Data Point
  KPIDataPoint,
  // Scorecard
  KPIScorecard,
  ScorecardSection,
  // Trend
  KPITrend,
  KPITrendPeriod,
  // Alert
  KPIAlert,
  KPIAlertNotification,
  // Analytics
  KPIAnalytics,
  KPIPerformanceSummary,
  KPISummary,
  // Input Types
  CreateKPIInput,
  UpdateKPIInput,
  CreateDataPointInput,
  CreateScorecardInput,
  UpdateScorecardInput,
  CreateScorecardSectionInput,
  UpdateScorecardSectionInput,
  // Filter Types
  KPIFilters,
  ScorecardFilters,
  DataPointFilters,
  // Dashboard Types
  KPIDashboardData,
  KPIComparisonData,
} from './types/kpi.types';

// ----------------------------------------------------------------------------
// KPI Schemas
// ----------------------------------------------------------------------------
export {
  // Enum Schemas
  kpiCategorySchema,
  kpiTypeSchema,
  kpiStatusSchema as kpiDefinitionStatusSchema,
  kpiScopeSchema,
  kpiDirectionSchema,
  kpiFrequencySchema,
  kpiDataSourceSchema,
  kpiAggregationMethodSchema,
  kpiScorecardTypeSchema,
  kpiThresholdTypeSchema,
  bscPerspectiveSchema,
  // Object Schemas
  kpiTargetSchema,
  kpiThresholdSchema,
  kpiDataSourceConfigSchema,
  createKPISchema,
  updateKPISchema,
  createDataPointSchema,
  scorecardSectionSchema,
  createScorecardSchema,
  updateScorecardSchema,
  updateScorecardSectionSchema,
  // Validation Functions
  validateCreateKPI,
  validateUpdateKPI,
  validateCreateDataPoint,
  validateCreateScorecard,
  validateUpdateScorecard,
  validateKPITarget,
  validateKPIThreshold,
} from './schemas/kpi.schemas';

export type {
  KPICategorySchemaType,
  KPITypeSchemaType,
  KPIStatusSchemaType as KPIDefinitionStatusSchemaType,
  KPIScopeSchemaType,
  KPIDirectionSchemaType,
  KPIFrequencySchemaType,
  KPITargetSchemaType,
  KPIThresholdSchemaType,
  CreateKPISchemaType,
  UpdateKPISchemaType,
  CreateDataPointSchemaType,
  ScorecardSectionSchemaType,
  CreateScorecardSchemaType,
  UpdateScorecardSchemaType,
  UpdateScorecardSectionSchemaType,
} from './schemas/kpi.schemas';

// ----------------------------------------------------------------------------
// KPI Services
// ----------------------------------------------------------------------------
export { kpiService } from './services/kpi.service';
export { kpiDataService } from './services/kpiData.service';

// ----------------------------------------------------------------------------
// KPI Hooks
// ----------------------------------------------------------------------------
export {
  useKPIs,
  useKPIsByCategory,
  useKPIsByStrategyPillar,
  useFavoriteKPIs,
} from './hooks/useKPIs';

export type {
  UseKPIsOptions,
  UseKPIsReturn,
} from './hooks/useKPIs';

export {
  useKPIData,
  useKPIComparison,
} from './hooks/useKPIData';

export type {
  UseKPIDataOptions,
  UseKPIDataReturn,
  UseKPIComparisonOptions,
  UseKPIComparisonReturn,
} from './hooks/useKPIData';

export {
  useKPIScorecards,
  useKPIScorecard,
  useKPIAlerts,
} from './hooks/useKPIScorecard';

export type {
  UseKPIScorecardsOptions,
  UseKPIScorecardsReturn,
  UseKPIScorecardOptions,
  UseKPIScorecardReturn,
  UseKPIAlertsOptions,
  UseKPIAlertsReturn,
} from './hooks/useKPIScorecard';

// ============================================================================
// Performance Aggregation System
// ============================================================================

// ----------------------------------------------------------------------------
// Aggregation Constants
// ----------------------------------------------------------------------------
export {
  // Levels
  AGGREGATION_LEVELS,
  AGGREGATION_LEVEL_LABELS,
  AGGREGATION_LEVEL_ORDER,
  // Domains
  PERFORMANCE_DOMAINS,
  PERFORMANCE_DOMAIN_LABELS,
  PERFORMANCE_DOMAIN_WEIGHTS,
  // Ratings
  PERFORMANCE_RATINGS,
  PERFORMANCE_RATING_LABELS,
  PERFORMANCE_RATING_COLORS,
  PERFORMANCE_RATING_THRESHOLDS,
  // Snapshots
  SNAPSHOT_FREQUENCIES,
  SNAPSHOT_FREQUENCY_LABELS,
  // Trends
  TREND_INDICATORS,
  TREND_INDICATOR_LABELS,
  TREND_INDICATOR_COLORS,
  TREND_THRESHOLDS,
  // Comparison
  COMPARISON_PERIODS,
  COMPARISON_PERIOD_LABELS,
  // Methods
  AGGREGATION_METHODS,
  AGGREGATION_METHOD_LABELS,
  // Health
  HEALTH_INDICATORS,
  HEALTH_INDICATOR_LABELS,
  HEALTH_INDICATOR_COLORS,
  // Collections & Defaults
  AGGREGATION_COLLECTIONS,
  AGGREGATION_DEFAULTS,
  // Utility Functions
  getRatingFromScore,
  getTrendFromChange,
  getHealthFromScore,
  getRatingColor,
  getTrendColor,
  getHealthColor,
  getChildLevel,
  getParentLevel,
} from './constants/aggregation.constants';

export type {
  AggregationLevel,
  PerformanceDomain,
  PerformanceRating,
  SnapshotFrequency,
  TrendIndicator,
  ComparisonPeriod,
  AggregationMethod,
  HealthIndicator,
} from './constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Aggregation Types
// ----------------------------------------------------------------------------
export type {
  // Aggregated Performance
  AggregatedPerformance,
  PerformanceWeights,
  PerformanceHealth,
  ChildAggregationSummary,
  // Domain Aggregations
  StrategyAggregation,
  PillarProgress,
  OKRAggregation,
  OKRLevelSummary,
  KPIAggregation,
  KPICategorySummary,
  // Snapshots
  PerformanceSnapshot,
  SnapshotComparison,
  // Trends
  PerformanceTrend,
  TrendDataPoint,
  // Hierarchy
  PerformanceHierarchy as PerformanceHierarchyData,
  PerformanceNode,
  // Comparison
  PerformanceComparison as PerformanceComparisonData,
  ComparisonEntity,
  EntityRanking,
  // Heatmap
  PerformanceHeatmap as PerformanceHeatmapData,
  HeatmapRow,
  HeatmapColumn,
  HeatmapCell,
  // Config
  AggregationConfig,
  AggregationInput,
  // Responses
  AggregationResponse,
  TrendResponse,
  ComparisonResponse,
  // Filters
  SnapshotFilters,
  AggregationFilters,
} from './types/aggregation.types';

// ----------------------------------------------------------------------------
// Aggregation Schemas
// ----------------------------------------------------------------------------
export {
  // Base Schemas
  aggregationLevelSchema,
  performanceDomainSchema,
  performanceRatingSchema,
  trendIndicatorSchema,
  comparisonPeriodSchema,
  aggregationMethodSchema,
  healthIndicatorSchema,
  snapshotFrequencySchema,
  // Object Schemas
  performanceWeightsSchema,
  aggregationInputSchema,
  aggregationConfigSchema,
  comparisonRequestSchema,
  trendRequestSchema,
  heatmapRequestSchema,
  snapshotRequestSchema,
  snapshotFiltersSchema,
  // Validation Functions
  validateAggregationInput,
  validateAggregationConfig,
  validateComparisonRequest,
  validateTrendRequest,
  validateHeatmapRequest,
  validateSnapshotRequest,
  validatePerformanceWeights,
} from './schemas/aggregation.schemas';

export type {
  AggregationLevelSchemaType,
  PerformanceDomainSchemaType,
  PerformanceRatingSchemaType,
  TrendIndicatorSchemaType,
  ComparisonPeriodSchemaType,
  AggregationMethodSchemaType,
  HealthIndicatorSchemaType,
  SnapshotFrequencySchemaType,
  PerformanceWeightsSchemaType,
  AggregationInputSchemaType,
  AggregationConfigSchemaType,
  ComparisonRequestSchemaType,
  TrendRequestSchemaType,
  HeatmapRequestSchemaType,
  SnapshotRequestSchemaType,
  SnapshotFiltersSchemaType,
} from './schemas/aggregation.schemas';

// ----------------------------------------------------------------------------
// Aggregation Services
// ----------------------------------------------------------------------------
export { aggregationService } from './services/aggregation.service';
export { performanceSnapshotService } from './services/performanceSnapshot.service';

// ----------------------------------------------------------------------------
// Aggregation Hooks
// ----------------------------------------------------------------------------
export {
  usePerformanceAggregation,
  usePerformanceHierarchy,
  usePerformanceComparison,
  usePerformanceHeatmap,
  useGroupPerformance,
} from './hooks/usePerformanceAggregation';

export type {
  UsePerformanceAggregationOptions,
  UsePerformanceAggregationReturn,
  UsePerformanceHierarchyOptions,
  UsePerformanceHierarchyReturn,
  UsePerformanceComparisonOptions,
  UsePerformanceComparisonReturn,
  UsePerformanceHeatmapOptions,
  UsePerformanceHeatmapReturn,
} from './hooks/usePerformanceAggregation';

export {
  usePerformanceSnapshots,
  usePerformanceSnapshot,
  useEntitySnapshots,
} from './hooks/usePerformanceSnapshot';

export type {
  UsePerformanceSnapshotsOptions,
  UsePerformanceSnapshotsReturn,
  UsePerformanceSnapshotOptions,
  UsePerformanceSnapshotReturn,
  UseEntitySnapshotsOptions,
} from './hooks/usePerformanceSnapshot';

export {
  usePerformanceTrends,
  useMultiEntityTrends,
} from './hooks/usePerformanceTrends';

export type {
  UsePerformanceTrendsOptions,
  UsePerformanceTrendsReturn,
  UseMultiEntityTrendsOptions,
  UseMultiEntityTrendsReturn,
} from './hooks/usePerformanceTrends';

// ----------------------------------------------------------------------------
// Aggregation Components
// ----------------------------------------------------------------------------
export {
  PerformanceOverview,
  PerformanceHierarchy,
  PerformanceComparison,
  PerformanceHeatmap,
  PerformanceTimeline,
} from './components/aggregation';

// ----------------------------------------------------------------------------
// Dashboard Components
// ----------------------------------------------------------------------------
export {
  DashboardHeader,
  PerformanceSummaryCard,
  StrategicPrioritiesWidget,
  OKRProgressWidget,
  KPIHealthWidget,
  AlertsWidget,
  QuickActionsWidget,
  TrendSparkline,
} from './components/dashboard';

// ----------------------------------------------------------------------------
// Pages
// ----------------------------------------------------------------------------
export {
  ExecutiveDashboard,
  StrategyOverview,
  OKRDashboard,
  KPIDashboard,
  PerformanceDeepDive,
} from './pages';

// ----------------------------------------------------------------------------
// Layout
// ----------------------------------------------------------------------------
export { DashboardLayout } from './layouts/DashboardLayout';

// ----------------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------------
export { strategyRoutes } from './routes/strategyRoutes';
