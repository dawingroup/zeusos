/**
 * Launch Pipeline Types
 */

// Note: DeliverableType is excluded from stage.types to avoid duplicate export
// with design-manager when re-exported through finishes/index.ts.
export type {
  PipelineStage,
  StageConfig,
  GateRequirement,
  AIAssistanceType,
  GateCheckResult,
} from './stage.types';

export * from './ai.types';
export * from './audit.types';
export * from './shopify.types';

// Note: StageTransition is excluded from product.types to avoid duplicate export
// with design-manager when re-exported through finishes/index.ts.
export type {
  LaunchProduct,
  ProductCategory,
  ProductDeliverable,
  ProductSpecifications,
  SEOMetadata,
  AIDiscoveryData,
} from './product.types';
