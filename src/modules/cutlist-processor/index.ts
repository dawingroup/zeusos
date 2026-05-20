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

// Public utilities (for use by other modules if needed)
export { parseCSV, optimizePanelLayout, calculateStatistics } from './utils';

// Public services
export { 
  generateOptimizationPDF, 
  downloadOptimizationPDF,
  createWorkInstance,
  getWorkInstance,
  getProjectInstances
} from './services';

// Public context providers
export { 
  ConfigProvider, 
  useConfig,
  OffcutProvider,
  useOffcuts,
  WorkInstanceProvider,
  useWorkInstance
} from './context';

// Note: The main CutlistProcessor component will be created in Phase 5
// when we set up routing. For now, the existing App.jsx continues to work.
