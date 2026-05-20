/**
 * Advisory Client Types - Barrel Export
 */

// Client types
export type {
  AdvisoryClient,
  ClientStatus,
  ClientSource,
  ClientSummary,
  ClientJurisdiction,
  RegulatoryStatus,
  InvestorProfile,
  InvestmentHorizon,
  LiquidityNeeds,
  IncomeRequirements,
  ESGRequirements,
  ESGScreeningCriteria,
  ImpactTarget,
  InvestmentExclusion,
  RelationshipManager,
  CommunicationPreferences,
  Address,
  ExperienceLevel,
  ESGReportingRequirement,
  MoneyAmount,
  ConcentrationLimit
} from './client';

export type {
  ClientType,
  InstitutionType,
  ClientTier,
  KYCDocumentType,
  ClientTypeConfig
} from './client-type';
export { CLIENT_TYPE_CONFIGS, getClientTypeConfig } from './client-type';

export type {
  InvestmentMandate,
  MandateConstraints,
  MandateType,
  MandateStatus,
  InstrumentType,
  ReportType,
  DealStage,
  DateRange,
  AssetAllocationConstraint,
  GeographyConstraint,
  SectorConstraint,
  SectorAllocation,
  InvestmentSizeConstraint,
  RiskConstraint,
  ESGConstraint,
  InstrumentConstraint,
  SubordinationLimit,
  CurrencyConstraint,
  LiquidityConstraint,
  DistributionRequirement,
  FeeStructure,
  FeeComponent,
  FeeTier,
  PerformanceFee,
  TransactionFee,
  OtherFee,
  FeeOffset,
  ApprovalProcess,
  ApprovalThreshold,
  ReportingRequirement
} from './mandate';

export type {
  RiskProfile,
  RiskTolerance,
  RiskCapacity,
  RiskAssessment,
  RiskScores,
  RiskAssessmentHistory,
  InvestmentObjective,
  TimeHorizonProfile,
  LiquidityNeedsProfile,
  WithdrawalExpectation,
  FinancialCapacityProfile,
  ExperienceProfile,
  AssetClassExperience,
  SuitabilityAssessment,
  ProductSuitability,
  SuitabilityWarning,
  QuestionnaireResponse,
  ObjectiveType,
  WealthBand,
  IncomeBand
} from './risk-profile';

export type {
  ComplianceStatus,
  ClientCompliance,
  KYCStatus,
  KYCDocument,
  AMLStatus,
  PEPStatus,
  SanctionsCheck,
  AdverseMediaCheck,
  TaxComplianceStatus,
  AccreditationStatus,
  ComplianceIssue,
  KYCRecord,
  VerificationEvent,
  AMLCheck,
  AMLCheckDetails
} from './compliance';

export type {
  ClientContact,
  ContactRole,
  ContactAddress,
  ContactCommunicationPrefs
} from './contact';

// Portfolio types
export type {
  Portfolio,
  PortfolioType,
  PortfolioStatus,
  PortfolioStrategy,
  PortfolioStructure,
  Currency,
  PortfolioLegalStructure,
  PortfolioInvestmentFocus,
  PortfolioCapitalStructure,
  PortfolioAllocations,
  AllocationBreakdown,
  AllocationItem,
  AllocationVariance,
  VarianceItem,
  DriftAlert,
  PortfolioNAV,
  NAVComponents,
  ValuationPolicy,
  ValuationLevel,
  ValuationMethodology,
  CashPosition,
  CashAccountBalance,
  CurrencyPosition,
  PerformanceSummary,
  PortfolioLifecycle,
  PortfolioFeeStructure,
  HoldingsSummary,
  PortfolioLinkedEntities,
  ReportingConfig,
  PortfolioStatusChange,
  CapitalTransaction,
  CapitalTransactionType,
  CreatePortfolioInput,
  UpdatePortfolioInput,
  PortfolioSummary
} from './portfolio';

// NAV types
export type {
  NAVHistory,
  ValuationRecord,
  ValuationInput,
  ValuationAdjustment,
  NAVCalculationResult,
  HoldingValuationSummary,
  NAVReconciliation,
  NAVMovement
} from './nav';

// Allocation types
export type {
  StrategicAllocation,
  AllocationTargets,
  AllocationTarget,
  RebalancingPolicy,
  AllocationAnalysis,
  ActualAllocation,
  ActualAllocationItem,
  CategoryVariance,
  RebalancingRecommendation,
  ConcentrationAnalysis,
  ConcentrationBreach,
  RiskContribution,
  AllocationChange
} from './allocation';

// Cash management types
export type {
  CashForecast,
  CashFlowProjection,
  CashForecastPeriod,
  BankAccount,
  CashMovement,
  CashReconciliation,
  ReconciliationItem,
  CashAllocationRule
} from './cash-management';

// Holding types (excluding duplicates already exported from mandate/portfolio)
export type {
  Holding,
  HoldingType,
  HoldingStatus,
  HoldingStage,
  UnderlyingAsset,
  InvestmentStructure,
  OwnershipDetails,
  CostBasis,
  HoldingValuation,
  IncomeSummary,
  RealizationSummary,
  HoldingReturnMetrics,
  HoldingRiskAssessment,
  HoldingESGProfile,
  HoldingKeyDates,
  HoldingLinkedEntities,
  HoldingStatusChange,
  CreateHoldingInput,
  UpdateHoldingInput,
  HoldingSummary
} from './holding';

// Holding transaction types
export type {
  TransactionType,
  TransactionStatus,
  HoldingTransaction,
  TransactionCreateInput,
  TransactionSummary,
  TransactionApproval
} from './holding-transaction';

// Holding valuation types
export type {
  ValuationHistory,
  ValuationComparable,
  ValuationSensitivity,
  ValuationApproval,
  ValuationReport
} from './holding-valuation';

// Holding income types
export type {
  IncomeType,
  IncomeStatus,
  HoldingIncome,
  IncomeSchedule,
  IncomeForecast,
  IncomeAnalysis
} from './holding-income';

// Performance types
export type {
  ReturnCalculationMethod,
  ReturnPeriod,
  ReturnType,
  AnnualizationMethod,
  CashFlowType,
  CashFlow,
  ReturnMetrics,
  PeriodReturns,
  ReturnCalculationMethodology,
  RiskAdjustedReturns,
  PerformanceScope,
  PerformanceSnapshot,
  BenchmarkComparisonResult,
  PerformanceAttributionSummary,
  PeerRankingSummary,
  VintageAnalysisSummary,
  PerformanceHistory,
  PerformanceDataPoint,
  JCurveAnalysis,
  JCurveDataPoint,
  PerformanceCalculationInput,
  PerformanceCalculationResult
} from './performance';

// Benchmark types
export type {
  BenchmarkType,
  BenchmarkCategory,
  Benchmark,
  BenchmarkData,
  BenchmarkComparison,
  PmeMethod,
  PmeAnalysis,
  PmeTimeSeriesPoint,
  BenchmarkAssignment,
  BenchmarkSummary,
  BenchmarkPerformance
} from './benchmark';

// Attribution types
export type {
  AttributionType,
  ValueCreationDriver,
  PerformanceAttribution,
  ValueCreationAttribution,
  ValueCreationComponent,
  BrinsonAttribution,
  BrinsonSectorAttribution,
  FactorAttribution,
  FactorContribution,
  FeeAttribution,
  CurrencyAttribution,
  CurrencyImpact,
  AttributionByDimension,
  AttributionSummary
} from './attribution';

// Peer comparison types
export type {
  PeerUniverseCategory,
  PeerUniverse,
  PeerStatistics,
  PercentileDistribution,
  PeerRanking,
  MetricRanking,
  RankingHistoryPoint,
  VintageAnalysis,
  CustomPeerGroup,
  PeerGroupMember,
  PeerComparisonSummary
} from './peer-comparison';

// Integration types
export type {
  LinkableEntityType,
  CrossModuleLinkType,
  CrossModuleLink,
  DealConversionStatus,
  DealConversionTarget,
  DealConversionApproval,
  DealConversion,
  CapitalDeploymentType,
  CapitalDeploymentStatus,
  CapitalDeployment,
  AllocationStatus,
  PortfolioDealAllocation,
  ProjectHoldingLinkType,
  ProjectHoldingLinkStatus,
  ProjectHoldingLink,
  InitiateDealConversionInput,
  CreateCapitalDeploymentInput
} from './integration';

// Co-investment types
export type {
  CoInvestorType,
  RelationshipStatus,
  CoInvestor,
  CoInvestmentOpportunityStatus,
  InvitationStatus,
  CommitmentStatus,
  CoInvestmentInvitation,
  CoInvestmentCommitment,
  CoInvestmentOpportunity,
  VehicleType,
  VehicleStatus,
  ShareClass,
  VehicleParticipant,
  CoInvestmentVehicle,
  SyndicationStage,
  SyndicationStatus,
  SyndicationWorkflow,
  CreateCoInvestorInput,
  CreateCoInvestmentOpportunityInput
} from './co-investment';

// Asset view types
export type {
  UnifiedAssetType,
  InfrastructureSector,
  AssetStatus,
  OperationalStatus,
  ScheduleStatus,
  ValuationMethod,
  ProgressMethod,
  DataFreshness,
  AssetFinancials,
  AssetProgress,
  UnifiedAssetView,
  AggregationGroupBy,
  AssetAggregation,
  ActivityType,
  AlertSeverity,
  ModuleType,
  DashboardActivity,
  DashboardAlert,
  CrossModuleDashboard,
  BuildAssetViewInput,
  AssetAggregationQuery
} from './asset-view';
