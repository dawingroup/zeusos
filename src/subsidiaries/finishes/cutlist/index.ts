/**
 * Cutlist Processor Module
 *
 * Public API for the cutlist processor module.
 * This module handles CSV upload, material mapping, nesting optimization, and PDF output.
 *
 * @module cutlist-processor
 */

// Public types
export * from './types';

// Public utilities - Removed: module was migrated
// export { parseCSV, optimizePanelLayout, calculateStatistics } from './utils';

// Public services - Removed: module was migrated
// export {
//   generateOptimizationPDF,
//   downloadOptimizationPDF,
//   createWorkInstance,
//   getWorkInstance,
//   getProjectInstances
// } from './services';

// Public context providers - Removed: module was migrated
// export {
//   ConfigProvider,
//   useConfig,
//   OffcutProvider,
//   useOffcuts,
//   WorkInstanceProvider,
//   useWorkInstance
// } from './context';

// Public hooks
export { useCutlistAggregation } from './hooks';

// Public components — the legacy .jsx component barrel was retired in the
// dead-code sweep; CutlistTab is consumed directly from design-manager.
