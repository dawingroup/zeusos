/**
 * Cutlist Processor Utilities
 * Helper functions and utilities for the cutlist processor module
 * 
 * Re-exports from existing utils during migration
 */

// CSV Parser
export { 
  parseCSV, 
  expandMultiPartLabels,
  extractUniqueMaterials,
  normalizeEdgeValue,
  processEdgeData,
  calculateProjectEdgeTotals,
  materialHasGrain,
  getGrainDisplay
} from '../../../utils/csvParser';

// Material utilities
export { analyzeMaterials } from '../../../utils/materialUtils';

// Optimization engine
export { 
  optimizePanelLayout, 
  calculateStatistics,
  groupByMaterialAndThickness,
  findMatchingStock
} from '../../../utils/optimizationEngine';

// PDF utilities (generateCuttingPatternPDF was renamed to exportOptimizationPDF)
export { exportOptimizationPDF as generateCuttingPatternPDF } from '../../../utils/pdfExport';
