/**
 * Optimization Services
 * Exports all optimization-related services
 */

export * from './InvalidationDetector';
export * from './OptimizationService';
export * from './TimberOptimizationService';
export * from './LinearStockOptimizationService';
export * from './GlassOptimizationService';
export * from './projectOptimization';
export * from './changeDetection';
export {
  InvalidationDetector,
  invalidationDetector,
  createHash,
  createProjectSnapshot,
  type InvalidationTrigger,
  type InvalidationResult,
} from './InvalidationDetector';

export {
  runProjectEstimation,
  runProjectProduction,
  runItemProduction,
  aggregatePartsFromProject,
  aggregateStandardPartsFromProject,
  aggregateSpecialPartsFromProject,
  needsReOptimization,
  getOptimizationStatus,
  updateProjectConfig,
  clearEstimation,
  clearProduction,
  type CutlistPart,
  type MaterialBreakdown,
  type Remnant,
  type EdgeBandItem,
} from './projectOptimization';
