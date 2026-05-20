/**
 * RAG Calculation Utilities
 * Functions for calculating readiness and status from RAG values
 */

import { Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import type { RAGStatus, RAGStatusValue, RAGValue } from '../types';

function isUncheckedAspect(aspect: RAGValue): boolean {
  // Default untouched aspects are seeded as red with `checked !== true`.
  // Exclude them from readiness so blank checklists don't drag progress.
  return aspect.status === 'red' && aspect.checked !== true;
}

/**
 * Calculate overall readiness percentage from RAG status
 * @param ragStatus - Complete RAG status object
 * @returns Percentage 0-100
 */
export function calculateOverallReadiness(ragStatus: RAGStatus): number {
  if (!ragStatus) return 0;
  const allAspects = [
    ...Object.values(ragStatus.designCompleteness || {}),
    ...Object.values(ragStatus.manufacturingReadiness || {}),
    ...Object.values(ragStatus.qualityGates || {}),
  ];
  
  const applicable = allAspects.filter(
    (a) => a.status !== 'not-applicable' && !isUncheckedAspect(a),
  );
  if (applicable.length === 0) return 0;
  
  const scores: number[] = applicable.map(a => {
    switch (a.status) {
      case 'green': return 100;
      case 'amber': return 50;
      case 'red': return 0;
      default: return 0;
    }
  });
  
  return Math.round(scores.reduce((sum, val) => sum + val, 0) / applicable.length);
}

/**
 * Get the worst status across all RAG aspects
 * @param ragStatus - Complete RAG status object
 * @returns Worst status value
 */
export function getWorstStatus(ragStatus: RAGStatus): RAGStatusValue {
  if (!ragStatus) return 'red';
  const allStatuses = [
    ...Object.values(ragStatus.designCompleteness || {}),
    ...Object.values(ragStatus.manufacturingReadiness || {}),
    ...Object.values(ragStatus.qualityGates || {}),
  ]
    .filter(a => a.status !== 'not-applicable')
    .map(a => a.status);
  
  if (allStatuses.includes('red')) return 'red';
  if (allStatuses.includes('amber')) return 'amber';
  if (allStatuses.length === 0) return 'not-applicable';
  return 'green';
}

/**
 * Get the best status across all RAG aspects
 * @param ragStatus - Complete RAG status object
 * @returns Best status value
 */
export function getBestStatus(ragStatus: RAGStatus): RAGStatusValue {
  if (!ragStatus) return 'red';
  const allStatuses = [
    ...Object.values(ragStatus.designCompleteness || {}),
    ...Object.values(ragStatus.manufacturingReadiness || {}),
    ...Object.values(ragStatus.qualityGates || {}),
  ]
    .filter(a => a.status !== 'not-applicable')
    .map(a => a.status);
  
  if (allStatuses.includes('green')) return 'green';
  if (allStatuses.includes('amber')) return 'amber';
  if (allStatuses.length === 0) return 'not-applicable';
  return 'red';
}

/**
 * Count aspects by status
 * @param ragStatus - Complete RAG status object
 * @returns Count of each status type
 */
export function countByStatus(ragStatus: RAGStatus): Record<RAGStatusValue, number> {
  if (!ragStatus) return { green: 0, amber: 0, red: 0, 'not-applicable': 0 };
  const allAspects = [
    ...Object.values(ragStatus.designCompleteness || {}),
    ...Object.values(ragStatus.manufacturingReadiness || {}),
    ...Object.values(ragStatus.qualityGates || {}),
  ];
  
  const counts: Record<RAGStatusValue, number> = {
    'red': 0,
    'amber': 0,
    'green': 0,
    'not-applicable': 0,
  };
  
  allAspects.forEach(aspect => {
    const status = aspect.status as RAGStatusValue;
    counts[status] = (counts[status] || 0) + 1;
  });
  
  return counts;
}

/**
 * Get total number of applicable aspects
 * @param ragStatus - Complete RAG status object
 * @returns Count of applicable aspects
 */
export function getApplicableCount(ragStatus: RAGStatus): number {
  if (!ragStatus) return 0;
  const allAspects = [
    ...Object.values(ragStatus.designCompleteness || {}),
    ...Object.values(ragStatus.manufacturingReadiness || {}),
    ...Object.values(ragStatus.qualityGates || {}),
  ];
  
  return allAspects.filter(a => a.status !== 'not-applicable').length;
}

/**
 * Create a single RAG value with default status
 * @param userId - User creating the value
 * @param status - Initial status (default: red)
 * @returns New RAG value
 */
export function createRAGValue(
  userId: string, 
  status: RAGStatusValue = 'red'
): RAGValue {
  return {
    status,
    notes: '',
    updatedAt: FirestoreTimestamp.now(),
    updatedBy: userId,
    checked: false,
  };
}

/**
 * Create initial RAG status with all aspects set to red
 * @param userId - User creating the status
 * @returns Complete RAG status with all red values
 */
export function createInitialRAGStatus(userId: string): RAGStatus {
  const createValue = (): RAGValue => createRAGValue(userId, 'red');

  return {
    designCompleteness: {
      overallDimensions: createValue(),
      model3D: createValue(),
      productionDrawings: createValue(),
      materialSpecs: createValue(),
      hardwareSpecs: createValue(),
      finishSpecs: createValue(),
      joineryDetails: createValue(),
      tolerances: createValue(),
      assemblyInstructions: createValue(),
    },
    manufacturingReadiness: {
      materialAvailability: createValue(),
      hardwareAvailability: createValue(),
      toolingReadiness: createValue(),
      processDocumentation: createValue(),
      qualityCriteria: createValue(),
      costValidation: createValue(),
    },
    qualityGates: {
      internalDesignReview: createValue(),
      manufacturingReview: createValue(),
      clientApproval: createValue(),
      prototypeValidation: createValue(),
    },
  };
}

/**
 * Update a specific aspect in the RAG status
 * @param ragStatus - Current RAG status
 * @param path - Dot-notation path to aspect (e.g., 'designCompleteness.model3D')
 * @param value - New RAG value
 * @returns Updated RAG status
 */
export function updateRAGAspect(
  ragStatus: RAGStatus,
  path: string,
  value: RAGValue
): RAGStatus {
  const [category, aspect] = path.split('.') as [keyof RAGStatus, string];
  
  if (!ragStatus[category] || !(aspect in ragStatus[category])) {
    console.warn(`Invalid RAG path: ${path}`);
    return ragStatus;
  }
  
  return {
    ...ragStatus,
    [category]: {
      ...ragStatus[category],
      [aspect]: value,
    },
  };
}

/**
 * Check if all aspects in a category are green
 * @param ragStatus - Complete RAG status
 * @param category - Category to check
 * @returns True if all applicable aspects are green
 */
export function isCategoryComplete(
  ragStatus: RAGStatus,
  category: keyof RAGStatus
): boolean {
  const aspects = Object.values(ragStatus[category]);
  const applicable = aspects.filter(a => a.status !== 'not-applicable');
  
  if (applicable.length === 0) return true;
  return applicable.every(a => a.status === 'green');
}

/**
 * Get readiness percentage for a specific category
 * @param ragStatus - Complete RAG status
 * @param category - Category to calculate
 * @returns Percentage 0-100
 */
export function getCategoryReadiness(
  ragStatus: RAGStatus,
  category: keyof RAGStatus
): number {
  const aspects = Object.values(ragStatus[category]);
  const applicable = aspects.filter(
    (a) => a.status !== 'not-applicable' && !isUncheckedAspect(a),
  );
  
  if (applicable.length === 0) return 100;
  
  const scores: number[] = applicable.map(a => {
    switch (a.status) {
      case 'green': return 100;
      case 'amber': return 50;
      case 'red': return 0;
      default: return 0;
    }
  });
  
  return Math.round(scores.reduce((sum, val) => sum + val, 0) / applicable.length);
}
