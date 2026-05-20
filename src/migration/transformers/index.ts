/**
 * Transformers Index
 * Export all transformation utilities
 */

export {
  transformProgramToEngagement,
  transformDealToEngagement,
  applyTransformationMaps,
  PROGRAM_TRANSFORMATION_MAPS,
  DEAL_TRANSFORMATION_MAPS,
} from './engagement-transformer';

export {
  createFundingConfig,
  createMultiSourceFunding,
  resolveFundingType,
  mergeFundingConfigs,
  validateFundingConfig,
  formatFundingDisplay,
} from './funding-transformer';
