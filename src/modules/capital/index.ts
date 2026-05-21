// ============================================================================
// CAPITAL HUB MODULE INDEX
// ZeusOS v2.0 — Capital seeking, readiness, application tracking & facilities
// ============================================================================

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export type {
  // Capital Need
  CapitalNeed,
  CapitalNeedType,
  CapitalNeedUrgency,
  CapitalNeedStatus,
  CapitalNeedFilters,
  DetectionSource,
  AffordabilityAnalysis,
  CashFlowGapDetails,

  // Capital Product
  CapitalProduct,
  CapitalProductType,
  ProviderType,
  InterestType,
  ProductStatus,
  ProductRequirement,
  CapitalProductFilters,

  // Capital Application
  CapitalApplication,
  ApplicationStage,
  ApplicationOutcome,
  ApplicationDocument,
  ApplicationCommunication,
  StageChange,
  FacilityTerms,
  CapitalApplicationFilters,

  // Capital Facility
  CapitalFacility,
  FacilityStatus,
  RepaymentEntry,
  Covenant,
  CapitalFacilityFilters,

  // Readiness
  ReadinessAssessment,
  ChecklistItem,
  ChecklistItemStatus,
  FinancialHealthMetrics,

  // Dashboard
  CapitalDashboardData,

  // Provider Research
  ProviderSearchResult,
  ProviderSearchResultProduct,
  ProviderSearchResponse,
  EnrichedProviderProfile,
  EnrichedProductDetail,
  ProviderMatchResult,
  ProviderMatchResponse,
} from './types/capital.types';

// ────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────────

export {
  // Collections
  CAPITAL_NEEDS_COLLECTION,
  CAPITAL_PRODUCTS_COLLECTION,
  CAPITAL_APPLICATIONS_COLLECTION,
  CAPITAL_FACILITIES_COLLECTION,
  CAPITAL_READINESS_COLLECTION,

  // Module
  MODULE_COLOR,
  DEFAULT_EXCHANGE_RATE,

  // Need types
  NEED_TYPES,
  NEED_TYPE_LABELS,
  NEED_TYPE_COLORS,

  // Urgency
  URGENCY_LEVELS,
  URGENCY_LABELS,
  URGENCY_COLORS,

  // Need status
  NEED_STATUSES,
  NEED_STATUS_LABELS,
  NEED_STATUS_COLORS,

  // Product types
  PRODUCT_TYPES,
  PRODUCT_TYPE_LABELS,
  PRODUCT_TYPE_COLORS,

  // Provider types
  PROVIDER_TYPES,
  PROVIDER_TYPE_LABELS,

  // Application stages
  APPLICATION_STAGES,
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGE_COLORS,
  ACTIVE_APPLICATION_STAGES,

  // Facility status
  FACILITY_STATUSES,
  FACILITY_STATUS_LABELS,
  FACILITY_STATUS_COLORS,

  // Product status
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,

  // Checklist
  CHECKLIST_ITEM_STATUSES,
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_STATUS_COLORS,

  // Templates
  DOCUMENT_CHECKLIST_TEMPLATE,
  COMPLIANCE_CHECKLIST_TEMPLATE,

  // Uganda DFIs
  UGANDA_DFIS,

  // Currencies
  SUPPORTED_CURRENCIES,

  // Interest & repayment
  INTEREST_TYPES,
  INTEREST_TYPE_LABELS,
  REPAYMENT_FREQUENCIES,
  REPAYMENT_FREQUENCY_LABELS,

  // Readiness
  READINESS_THRESHOLDS,
  READINESS_LEVEL_LABELS,
  READINESS_LEVEL_COLORS,
} from './constants/capital.constants';

// ────────────────────────────────────────────────────────────────────────────
// SCHEMAS
// ────────────────────────────────────────────────────────────────────────────

export {
  capitalNeedSchema,
  capitalNeedUpdateSchema,
  capitalProductSchema,
  capitalProductUpdateSchema,
  facilityTermsSchema,
  capitalApplicationSchema,
  capitalApplicationUpdateSchema,
  capitalFacilitySchema,
  capitalFacilityUpdateSchema,
  checklistItemUpdateSchema,
  productRequirementSchema,
  applicationDocumentSchema,
  applicationCommunicationSchema,
  covenantSchema,
} from './schemas/capital.schemas';

export type {
  CapitalNeedInput,
  CapitalNeedUpdateInput,
  CapitalProductInput,
  CapitalProductUpdateInput,
  FacilityTermsInput,
  CapitalApplicationInput,
  CapitalApplicationUpdateInput,
  CapitalFacilityInput,
  CapitalFacilityUpdateInput,
  ChecklistItemUpdateInput,
} from './schemas/capital.schemas';

// ────────────────────────────────────────────────────────────────────────────
// SERVICES
// ────────────────────────────────────────────────────────────────────────────

export { capitalNeedsService } from './services/capitalNeedsService';
export { capitalProductsService } from './services/capitalProductsService';
export { readinessService, getReadinessLevel } from './services/readinessService';
export { applicationService } from './services/applicationService';
export { facilityService, generateAmortizationSchedule } from './services/facilityService';
export {
  searchProviders,
  enrichProvider,
  enrichProduct,
  matchProviders,
  saveProductToCatalog,
  saveProviderProducts,
} from './services/providerResearchService';
export type { SearchProvidersParams, BusinessMatchProfile } from './services/providerResearchService';

// ────────────────────────────────────────────────────────────────────────────
// HOOKS
// ────────────────────────────────────────────────────────────────────────────

export { useCapitalDashboard } from './hooks/useCapitalDashboard';
export { useCapitalNeeds } from './hooks/useCapitalNeeds';
export { useCapitalProducts } from './hooks/useCapitalProducts';
export { useReadiness } from './hooks/useReadiness';
export { useApplications } from './hooks/useApplications';
export { useFacilities } from './hooks/useFacilities';
export { useProviderResearch } from './hooks/useProviderResearch';
export type { UseProviderResearchReturn } from './hooks/useProviderResearch';

// ────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ────────────────────────────────────────────────────────────────────────────

export { CurrencyDisplay, formatCurrency } from './components/shared/CurrencyDisplay';
export { StatusChip } from './components/shared/StatusChip';
export { ScoreGauge } from './components/shared/ScoreGauge';
export { CapitalLayout } from './components/CapitalLayout';
export { ProviderSearchPanel, ProviderSearchResults, EnrichmentPanel } from './components/research';
