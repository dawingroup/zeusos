// ============================================================================
// INTELLIGENCE LAYER MODULE INDEX
// DawinOS v2.0 - Intelligence Layer
// Barrel exports for all module components
// ============================================================================

// Constants (main file)
export {
  MODULE_COLOR,
  MODULE_COLOR_LIGHT,
  MODULE_COLOR_DARK,
  AI_MODELS,
  INTELLIGENCE_FEATURES,
  SUGGESTION_TYPES,
  ANOMALY_SEVERITY,
  SOURCE_MODULES,
  CONFIDENCE_THRESHOLDS,
  ASSISTANT_MODES,
} from './constants';

export type {
  AIModelId,
  IntelligenceFeatureId,
  SuggestionType,
  AnomalySeverityId,
  SourceModuleId,
  AssistantModeId,
} from './constants';

// Business Event Constants
export {
  MODULE_CONFIGS,
  DESIGN_MANAGER_TASK_TEMPLATES,
  ADVISORY_TASK_TEMPLATES,
  ALL_TASK_TEMPLATES,
  COLLECTION_EVENT_MAPPINGS,
} from './constants/businessEvents';

// Types (main file)
export type {
  SmartSuggestion,
  SuggestionContext,
  Anomaly,
  AnomalyMetric,
  AffectedEntity,
  Prediction,
  PredictionFactor,
  PredictionScenario,
  DocumentAnalysis,
  ExtractedEntity,
  NLQuery,
  NLQueryResponse,
  AssistantConversation,
  AssistantMessage,
  MessageAttachment,
  MessageAction,
  AssistantContext,
  IntelligenceOverview,
  ActivityItem,
  FeatureUsage,
  CategorySuggestion,
  CrossModuleInsight,
  InsightDataPoint,
} from './types';

// Business Event Types
export type {
  SubsidiaryId,
  ModuleConfig,
  BusinessEventCategory,
  BusinessEventSeverity,
  BusinessEvent,
  TaskPriority,
  TaskStatus,
  TaskChecklistItem,
  TaskTemplate,
  TaskTriggerCondition,
  GeneratedTask,
  TaskDependency,
  ModuleIntegrationConfig,
  EventMapping,
  FieldMapping,
} from './types/businessEvents';

// Services
export {
  businessEventService,
  taskGenerationService,
  intelligenceIntegrationService,
} from './services';

// Hooks
export * from './hooks';

// Components
export * from './components';

// Pages
export * from './pages';
