/**
 * Launch Pipeline Constants
 */

// Note: STAGE_ORDER is excluded to avoid duplicate export with design-manager
// when re-exported through finishes/index.ts.
export { PIPELINE_STAGES, getStageConfig, getNextStage, getPreviousStage } from './stages';
