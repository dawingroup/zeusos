/**
 * Design Manager Utilities
 * Helper functions and utilities for the design manager module
 */

// RAG Calculation utilities
export {
  calculateOverallReadiness,
  getWorstStatus,
  getBestStatus,
  countByStatus,
  getApplicableCount,
  createRAGValue,
  createInitialRAGStatus,
  updateRAGAspect,
  isCategoryComplete,
  getCategoryReadiness,
} from './rag-calculations';

// Stage Gate utilities
export {
  GATE_CRITERIA,
  STAGE_ORDER,
  canAdvanceToStage,
  getNextStage,
  getNextStageForItem,
  getPreviousStage,
  getPreviousStageForItem,
  getFinalStageForItem,
  isAtFinalStageForItem,
  getStageIndex,
  isStageBeforeOrEqual,
  getStagesUpTo,
  getStageProgress,
  type GateCheckResult,
} from './stage-gate';

// Formatting utilities
export {
  STAGE_LABELS,
  STAGE_SHORT_LABELS,
  STAGE_ICONS,
  CATEGORY_LABELS,
  RAG_COLORS,
  RAG_BG_COLORS,
  RAG_TEXT_COLORS,
  RAG_BORDER_COLORS,
  RAG_LABELS,
  formatProjectCode,
  formatItemCode,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatPercentage,
  getInitials,
  truncate,
} from './formatting';

// CSV Splitter utilities
export {
  splitByCabinet,
  parsePolyboardCSV,
  getSplitSummary,
  type PolyboardRow,
  type CabinetGroup,
  type SplitResult,
} from './csvSplitter';

// DesignItem cost helpers (P9c-2)
export {
  getDesignItemTotalCost,
  computeCostDivergence,
  DESIGN_ITEM_COST_SOURCE_LABELS,
  type DesignItemCost,
  type DesignItemCostSource,
  type CostDivergence,
} from './designItemCost';
