// ─────────────────────────────────────────────────────────────────
// CORE TYPES
// ─────────────────────────────────────────────────────────────────

export * from './money';
export * from './geo';
export * from './stakeholder';
export * from './compliance';
export * from './address';
export * from './contact';

// ─────────────────────────────────────────────────────────────────
// FUNDING TYPES (Modular)
// ─────────────────────────────────────────────────────────────────

export * from './funding-category';
export * from './funding-instrument';
export * from './funding-terms';
export * from './funder';
export * from './funding';
export * from './disbursement';
export { 
  analyzeBlendedFinance,
  getConcessionLevelDisplay,
  getConcessionLevelColor,
  getConcessionLevelDescription,
  requiresBlendedFinanceReporting,
  calculateGrantElement,
  createEmptyLayer,
} from './blended-finance';
export type {
  BlendedFinanceStructure,
  ConcessionLevel,
  LayerAnalysis,
  FundingSourceRef as BlendedFundingSourceRef,
} from './blended-finance';

// ─────────────────────────────────────────────────────────────────
// ENGAGEMENT TYPES
// ─────────────────────────────────────────────────────────────────

export * from './engagement';
export * from './engagement-domain';
export * from './engagement-modules';
export * from './engagement-status';
export * from './engagement-team';

// ─────────────────────────────────────────────────────────────────
// CLIENT TYPES
// ─────────────────────────────────────────────────────────────────

export * from './client';
export * from './client-types';
export * from './client-profile';
export * from './client-compliance';

// ─────────────────────────────────────────────────────────────────
// RE-EXPORT COMMONLY USED TYPES
// ─────────────────────────────────────────────────────────────────

// Engagement
export type {
  Engagement,
  CreateEngagementData,
  UpdateEngagementData,
  EngagementSummary,
  EngagementWithEntities,
  EngagementFilter,
} from './engagement';

// Engagement Domain
export type {
  EngagementDomain,
  EngagementType,
  Sector,
} from './engagement-domain';

// Engagement Modules
export type {
  EngagementModules,
} from './engagement-modules';

// Engagement Status
export type {
  EngagementStatus,
  EngagementTimeline,
  Milestone,
  MilestoneStatus,
} from './engagement-status';

// Engagement Team
export type {
  TeamAssignment,
  TeamMember,
  TeamRole,
} from './engagement-team';

// Money
export type {
  Money,
  CurrencyCode,
} from './money';

// Geography
export type {
  GeoPoint,
  GeoLocation,
  Address,
  Country,
  LocationType,
} from './geo';

// Stakeholder
export type {
  StakeholderRef,
  StakeholderType,
  ContactRef,
  StakeholderRelationship,
  StakeholderRelationshipType,
} from './stakeholder';

// Funding Category & Instrument
export type {
  FundingCategory,
} from './funding-category';

export type {
  FundingInstrument,
  InstrumentInfo,
} from './funding-instrument';

// Funding Terms
export type {
  FundingTerms,
  GrantTerms,
  DebtTerms,
  EquityTerms,
  GuaranteeTerms,
  InterestRateType,
  RepaymentFrequency,
  GuaranteeRiskType,
} from './funding-terms';

// Funder
export type {
  Funder,
  FunderRef,
  FunderType,
  FunderSummary,
} from './funder';

// Funding Source
export type {
  FundingSource,
  FundingSourceStatus,
  FundingSummary,
  CreateFundingSourceData,
  FundingSourceRef,
} from './funding';

// Disbursement
export type {
  Disbursement,
  DisbursementStatus,
  DisbursementSchedule,
  DisbursementScheduleItem,
  DisbursementSummary,
} from './disbursement';

// Reporting
export type {
  ReportingRequirement,
  ReportSubmission,
  ReportingSchedule,
  ReportType,
  ReportingFrequency,
  ScheduledReport,
} from './reporting';

// Covenant
export type {
  Covenant,
  CovenantMeasurement,
  CovenantWaiver,
  CovenantType,
  CovenantStatus,
  CovenantBreachConsequence,
} from './covenant';

// Approval
export type {
  ApprovalRequest,
  ApprovalStep,
  ApprovalDecision,
  ApprovalType,
  ApprovalStatus,
  ApprovalCondition,
} from './approval';

// Approval Chain
export type {
  ApprovalConfig,
  ApprovalRule,
  AmountThreshold,
  FunderApprovalRequirement,
} from './approval-chain';

// Compliance State
export type {
  EngagementComplianceState,
  ComplianceIssue,
  ComplianceSummary,
  CovenantWithMeasurements,
} from './compliance';
