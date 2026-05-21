/**
 * Intelligence Module - ZeusOS v2.0
 * 
 * Provides cross-cutting intelligence capabilities:
 * - Business event processing
 * - Task generation engine
 * - Role-based routing
 * - Grey area detection
 * - Workload analysis
 */

// Config exports - selective to avoid conflicts
export { 
  COLLECTIONS,
  SUBSIDIARY_IDS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  EVENT_CATEGORIES,
  GREY_AREA_TYPES,
  JOB_LEVELS,
  DEFAULTS,
  FEATURE_FLAGS,
} from './config/constants';
export type {
  SubsidiaryId,
  DepartmentId,
  TaskPriority,
  TaskStatus,
  GreyAreaType,
  JobLevel,
} from './config/constants';
export * from './config/event-catalog';
export * from './config/role-profile.constants';
export * from './config/detection-rules';

// Type exports
export * from './types/index';

// Utility exports
export * from './utils/index';

// Service exports
export * from './services/index';

// Hook exports
export * from './hooks/index';

// ============================================================================
// COMPETITOR ANALYSIS MODULE (7.1)
// ============================================================================

// Competitor Constants
export * from './constants/competitor.constants';

// Competitor Types
export type {
  Competitor,
  SWOTAnalysis,
  CompetitiveMove,
  WinLossRecord,
  MarketShareData,
  PricingIntelligence,
  CompetitorAnalytics,
  CompetitorFormInput,
  SWOTFormInput,
  CompetitiveMoveFormInput,
  WinLossFormInput,
  CompetitorFilters,
  MoveFilters,
  WinLossFilters,
} from './types/competitor.types';

// Competitor Schemas
export {
  competitorFormInputSchema,
  swotFormInputSchema,
  swotFactorInputSchema,
  competitiveMoveFormInputSchema,
  winLossFormInputSchema,
  marketShareFormInputSchema,
  pricingIntelligenceFormInputSchema,
} from './schemas/competitor.schemas';

// Competitor Services
export {
  competitorService,
  swotService,
  competitiveMoveService,
  winLossService,
  competitorAnalyticsService,
} from './services/competitorService';

// Competitor Hook
export { useCompetitor } from './hooks/useCompetitor';

// Competitor Components
export {
  CompetitorCard,
  SWOTAnalysis as SWOTAnalysisComponent,
  CompetitiveMoveTracker,
  WinLossAnalysis,
  CompetitorDashboard,
  AddCompetitorDialog,
} from './components/competitor';

// ============================================================================
// DIGITAL PROFILE DISCOVERY (7.2)
// ============================================================================

export type {
  DigitalProfile,
  DigitalPlatform,
  ProfileSnapshot,
  ProfileDiscoveryResult,
  DigitalProfileFormInput,
} from './types/digitalProfile.types';

export {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  PLATFORM_ICONS,
} from './types/digitalProfile.types';

export { digitalProfileService } from './services/digitalProfileService';

// ============================================================================
// TOPIC TRACKING (7.3)
// ============================================================================

export type {
  TrackedTopic,
  TrackedTopicFormInput,
  TopicMention,
  TopicAnalytics,
  TopicScope,
  TopicStatus,
} from './types/topicTracking.types';

export {
  TOPIC_CATEGORIES,
  TOPIC_SCOPE_LABELS,
} from './types/topicTracking.types';

export { topicTrackingService } from './services/topicTrackingService';
