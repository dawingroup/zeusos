/**
 * Optimization Services
 * Exports all optimization-related services
 */

export * from './InvalidationDetector';
export * from '@/shared/services/optimization/OptimizationService';
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
  aggregatePartsFromProject,
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
