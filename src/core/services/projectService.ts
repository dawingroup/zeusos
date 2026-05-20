/**
 * Project Service with Optimization Invalidation Detection
 * Handles project saves with automatic invalidation of optimization results
 */

import { 
  doc, 
  updateDoc, 
  getDoc,
  serverTimestamp,
  Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  Project,
  ProjectSnapshot,
  OptimizationConfig,
  EstimationResult,
  ProductionResult,
} from '@/shared/types';
import { 
  invalidationDetector, 
  createProjectSnapshot,
  type InvalidationResult,
} from './optimization/InvalidationDetector';
import { updateOptimizationRAG } from './ragService';

// Collection name
const PROJECTS_COLLECTION = 'designProjects';

// ============================================
// Project Save with Invalidation Detection
// ============================================

export interface SaveProjectOptions {
  /** Skip invalidation detection (for bulk operations) */
  skipInvalidation?: boolean;
  /** Force invalidation regardless of changes */
  forceInvalidation?: boolean;
  /** Custom invalidation reasons to add */
  customReasons?: string[];
}

export interface SaveProjectResult {
  success: boolean;
  invalidation?: InvalidationResult;
  error?: string;
}

/**
 * Save project with automatic invalidation detection
 */
export async function saveProjectWithInvalidation(
  project: Project,
  previousSnapshot: ProjectSnapshot | undefined,
  currentParts: Array<{ id: string; length: number; width: number; thickness: number; materialId?: string; quantity: number }>,
  designItemIds: string[],
  materialMappings: Record<string, string>,
  userId: string,
  options: SaveProjectOptions = {}
): Promise<SaveProjectResult> {
  try {
    // Create current snapshot
    const currentSnapshot = createProjectSnapshot(
      currentParts,
      designItemIds,
      materialMappings,
      project.optimizationState?.config || {}
    );

    // Detect invalidation if we have a previous snapshot
    let invalidation: InvalidationResult | undefined;
    
    if (!options.skipInvalidation && previousSnapshot) {
      invalidation = invalidationDetector.detect(
        previousSnapshot,
        currentSnapshot,
        project.optimizationState
      );

      // Apply invalidation to optimization state
      if (invalidation.estimationInvalidated || invalidation.productionInvalidated || options.forceInvalidation) {
        project = applyInvalidation(project, invalidation, options.customReasons);
      }
    }

    // Update RAG status
    if (project.optimizationState) {
      project.optimizationRAG = updateOptimizationRAG(project);
    }

    // Store current snapshot for next comparison
    project.lastSnapshot = currentSnapshot;

    // Save to Firestore
    const docRef = doc(db, PROJECTS_COLLECTION, project.id);
    await updateDoc(docRef, {
      optimizationState: project.optimizationState || null,
      optimizationRAG: project.optimizationRAG || null,
      lastSnapshot: project.lastSnapshot,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    return {
      success: true,
      invalidation,
    };
  } catch (error) {
    console.error('Error saving project with invalidation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save project',
    };
  }
}

/**
 * Apply invalidation to optimization state
 */
function applyInvalidation(
  project: Project,
  invalidation: InvalidationResult,
  customReasons?: string[]
): Project {
  const timestamp = FirestoreTimestamp.now();

  const reasons = [
    ...invalidation.reasons,
    ...(customReasons || []),
  ];

  if (!project.optimizationState) {
    return project;
  }

  // Invalidate estimation if needed
  if (invalidation.estimationInvalidated && project.optimizationState.estimation) {
    project.optimizationState.estimation = {
      ...project.optimizationState.estimation,
      invalidatedAt: timestamp,
      invalidationReasons: reasons,
    };
  }

  // Invalidate production if needed
  if (invalidation.productionInvalidated && project.optimizationState.production) {
    project.optimizationState.production = {
      ...project.optimizationState.production,
      invalidatedAt: timestamp,
      invalidationReasons: reasons,
    };
  }

  return project;
}

/**
 * Get project with optimization state
 */
export async function getProjectWithOptimization(
  projectId: string
): Promise<Project | null> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  return { id: docSnap.id, ...docSnap.data() } as Project;
}

/**
 * Update project optimization config
 */
export async function updateOptimizationConfig(
  projectId: string,
  config: OptimizationConfig,
  userId: string
): Promise<void> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  
  await updateDoc(docRef, {
    'optimizationState.config': config,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Clear invalidation (after re-running optimization)
 */
export async function clearEstimationInvalidation(
  projectId: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  
  await updateDoc(docRef, {
    'optimizationState.estimation.invalidatedAt': null,
    'optimizationState.estimation.invalidationReasons': null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function clearProductionInvalidation(
  projectId: string,
  userId: string
): Promise<void> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  
  await updateDoc(docRef, {
    'optimizationState.production.invalidatedAt': null,
    'optimizationState.production.invalidationReasons': null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Mark estimation as complete
 */
export async function saveEstimationResult(
  projectId: string,
  estimation: EstimationResult,
  userId: string
): Promise<void> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  const now = FirestoreTimestamp.now();
  
  await updateDoc(docRef, {
    'optimizationState.estimation': estimation,
    'optimizationState.lastEstimationRun': {
      seconds: now.seconds,
      nanoseconds: now.nanoseconds,
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Mark production as complete
 */
export async function saveProductionResult(
  projectId: string,
  production: ProductionResult,
  userId: string
): Promise<void> {
  const docRef = doc(db, PROJECTS_COLLECTION, projectId);
  const now = FirestoreTimestamp.now();
  
  await updateDoc(docRef, {
    'optimizationState.production': production,
    'optimizationState.lastProductionRun': {
      seconds: now.seconds,
      nanoseconds: now.nanoseconds,
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

