/**
 * MatFlow Types - Central Export
 */

export * from './core';
export * from './customer';
export * from './variance';
export * from './stageProgress';
// Extended BOQ document types (separate from core BOQItem)
export type {
  BOQDocument,
  BOQDocumentStatus,
  BOQSource,
  ParsingStatus,
  ParsingResults,
  BOQSummary,
  BOQApproval,
  BOQSection,
  BOQCategory,
  BOQVariation,
  VariationReason,
  BOQItemModification,
  BOQTemplate,
  BOQMoney,
  BOQAuditFields,
  CreateBOQInput,
  CreateSectionInput,
  CreateItemInput,
} from './boq';

// Extended Material types
export type {
  Material,
  MaterialCategoryExtended,
  MaterialSpecification,
  UnitConversion,
  MaterialRateHistory,
  MaterialCatalog,
  ProjectMaterial,
  ProjectMaterialStatus,
  MaterialTransfer,
  MaterialTransferItem,
  CreateMaterialInput,
  CreateProjectMaterialInput,
} from './material';

// Requisition types
export type {
  Requisition,
  RequisitionPriority,
  RequisitionStatus,
  RequisitionWorkflow,
  RequisitionItem,
  RequisitionItemStatus,
  RequisitionTemplate,
  CreateRequisitionInput,
  CreateRequisitionItemInput,
} from './requisition';

// Supplier types
export type {
  Supplier,
  SupplierStatus,
  SupplierAddress,
  BankDetails,
  SupplierDocument,
  SupplierRating,
  SupplierQuotation,
  QuotationItem,
  RequestForQuotation,
  RFQItem,
  CreateSupplierInput,
  UpdateSupplierInput,
} from './supplier';

// Re-export commonly used types for convenience
export type {
  MatFlowProject,
  BOQItem,
  StandardFormula,
  ProcurementEntry,
  MaterialRequirement,
  MaterialVariance,
  BOQParsingJob,
  MatFlowCapability,
  MatFlowRole,
} from './core';

// Re-export enums (must use export, not export type)
export { MaterialCategory, MeasurementUnit } from './core';

export type {
  SharedCustomer,
  MatFlowCustomerSummary,
  ContactPerson,
  CustomerAddress,
  SubsidiaryEngagement,
  CustomerType,
  CustomerStatus,
} from './customer';

export type {
  StageProgress,
  StageStatus,
  StageHealth,
  StageMilestone,
  StageBlocker,
  StageTimelineEvent,
  ProjectStageOverview,
} from './stageProgress';

// Offline types
export * from './offline';

export type {
  NetworkStatus,
  NetworkState,
  SyncStatus,
  SyncState,
  SyncError,
  OfflineOperation,
  OfflineOperationType,
  ConflictStrategy,
  DataConflict,
  CacheConfig,
} from './offline';

// Mobile breakpoint constants
export { BREAKPOINTS } from '../hooks/useMediaQuery';

// EFRIS types
export * from './efris';

// AI Parsing types
export type {
  ParsingJob,
  ParsingJobStatus,
  SourceFile,
  ExcelSheetInfo,
  ParsingProgress,
  ParsedSection,
  ParsedItem,
  ItemReviewStatus,
  ConfidenceScore,
  ConfidenceFactor,
  ConfidenceLevel,
  MaterialMatch,
  MaterialMatchType,
  AlternativeMatch,
  SourceLocation,
  ExtractedField,
  AISuggestion,
  SuggestionType,
  UserEdit,
  ParsingMetadata,
  SourceAnalysis,
  ParsingReview,
  ParsingError,
  ParsingTemplate,
  ExpectedFormat,
  ColumnMapping,
  ColumnPattern,
  SectionPattern,
  UnitMapping,
  ValidationRule,
  CreateParsingJobInput,
  StartParsingInput,
  UpdateItemReviewInput,
} from './parsing';
export { getConfidenceLevel, CONFIDENCE_THRESHOLDS } from './parsing';

// Export and reporting types (excluding VarianceTrend which is already exported from ./variance)
export type {
  ExportFormat,
  ReportType,
  ReportStatus,
  ReportConfig,
  ReportFilter,
  ReportRecord,
  ReportTemplate,
  BOQSummaryReportData,
  BOQStageSection,
  BOQItemRow,
  MaterialRequirementsReportData,
  MaterialRequirementRow,
  CategorySummary,
  VarianceAnalysisReportData,
  StageVarianceSection,
  VarianceItem,
  ProcurementLogReportData,
  DeliveryLogRow,
  SupplierSummary,
  TaxComplianceReportData,
  TaxInvoiceRow,
  SupplierTaxSummary,
  ProjectOverviewReportData,
  StageProgressRow,
  ActivityItem,
  ProjectIssue,
  ExportJob,
  DataExportConfig,
  ScheduledReport,
  ReportData,
} from './export';

// Re-export ConstructionStage from review helpers
// Note: MeasurementUnit and MaterialCategory are already exported from ./core above
export { ConstructionStage } from '../utils/reviewHelpers';
