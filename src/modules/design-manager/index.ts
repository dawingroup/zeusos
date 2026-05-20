/**
 * Design Manager Module
 * 
 * Public API for the design manager module.
 * This module handles design workflow, traffic light status, and stage gate progression.
 * 
 * @module design-manager
 */

// Public types
export * from './types';

// Public components
export * from './components';

// Public hooks
export * from './hooks';

// Public utilities (for use by consumers)
export {
  calculateOverallReadiness,
  getWorstStatus,
  createInitialRAGStatus,
  STAGE_ORDER,
  STAGE_LABELS,
  CATEGORY_LABELS,
  RAG_COLORS,
  RAG_BG_COLORS,
  canAdvanceToStage,
  formatProjectCode,
  formatItemCode,
} from './utils';

// Public services
export {
  createProject,
  updateProject,
  getProject,
  createDesignItem,
  updateDesignItem,
  deleteDesignItem,
  getDesignItem,
  updateRAGAspect,
  transitionStage,
} from './services';
