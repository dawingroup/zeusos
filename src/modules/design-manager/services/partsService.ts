/**
 * Parts Service
 * CRUD operations for design item parts
 */

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  increment,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { nanoid } from 'nanoid';
import type { PartEntry, PartsSummary, PartEdgeBanding } from '../types';
import { syncPartBackToScene } from '@/subsidiaries/finishes/design-studio/services/partReverseSyncService';
import type { ScenePart } from '@/subsidiaries/finishes/design-studio/types/assembly.types';

/**
 * P6: fields every `parts`-touching write must stamp so design-studio's
 * sync path can detect design-manager edits via `partsVersion` drift.
 * `increment(1)` is a Firestore sentinel, expanded atomically server-side,
 * so two concurrent design-manager writes still produce distinct versions.
 */
function partsVersionBump(): Record<string, unknown> {
  return {
    partsVersion: increment(1),
    partsLastSyncedAt: serverTimestamp(),
  };
}

const PROJECTS_COLLECTION = 'designProjects';

/**
 * Helper to remove undefined values from objects (Firestore doesn't accept undefined)
 */
export function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  if (typeof obj !== 'object') return obj;
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' && value !== null ? cleanUndefined(value) : value;
    }
  }
  return cleaned;
}

/**
 * Generate a unique part ID
 */
export function generatePartId(): string {
  return nanoid(10);
}

/**
 * Generate part number (sequential within item)
 */
export function generatePartNumber(existingParts: PartEntry[]): string {
  const maxNumber = existingParts.reduce((max, part) => {
    const match = part.partNumber.match(/P(\d+)/);
    if (match) {
      return Math.max(max, parseInt(match[1], 10));
    }
    return max;
  }, 0);
  return `P${String(maxNumber + 1).padStart(3, '0')}`;
}

/**
 * Calculate parts summary
 */
export function calculatePartsSummary(parts: PartEntry[]): PartsSummary {
  const uniqueMaterials = new Set(parts.map((p) => p.materialId || p.materialName));
  
  // Calculate total area in square meters
  const totalArea = parts.reduce((sum, part) => {
    const areaPerPart = (part.length * part.width) / 1_000_000; // mm² to m²
    return sum + areaPerPart * part.quantity;
  }, 0);

  const isComplete = parts.every((p) => p.materialId || p.materialName);

  return {
    totalParts: parts.reduce((sum, p) => sum + p.quantity, 0),
    uniqueMaterials: uniqueMaterials.size,
    totalArea: Math.round(totalArea * 1000) / 1000, // Round to 3 decimals
    lastUpdated: Timestamp.now(),
    isComplete,
  };
}

/**
 * Default edge banding
 */
export const DEFAULT_EDGE_BANDING: PartEdgeBanding = {
  top: false,
  bottom: false,
  left: false,
  right: false,
};

function toSceneEdgeBanding(part: PartEntry): ScenePart['edgeBanding'] | undefined {
  const edgeBanding = part.edgeBanding;
  if (!edgeBanding) return undefined;

  const resolveEdgeType = (side: 'top' | 'bottom' | 'left' | 'right' | 'front'): string =>
    edgeBanding.edges?.[side]?.material || edgeBanding.material || 'EDGE';

  return {
    top: edgeBanding.top ? {
      type: resolveEdgeType('top'),
      length: edgeBanding.edges?.top?.length ?? part.length,
    } : null,
    bottom: edgeBanding.bottom ? {
      type: resolveEdgeType('bottom'),
      length: edgeBanding.edges?.bottom?.length ?? part.length,
    } : null,
    left: edgeBanding.left ? {
      type: resolveEdgeType('left'),
      length: edgeBanding.edges?.left?.length ?? part.width,
    } : null,
    right: edgeBanding.right ? {
      type: resolveEdgeType('right'),
      length: edgeBanding.edges?.right?.length ?? part.width,
    } : null,
    front: edgeBanding.front ? {
      type: resolveEdgeType('front'),
      length: edgeBanding.edges?.front?.length ?? part.length,
    } : null,
  };
}

/**
 * Create a new part entry
 */
export function createPartEntry(
  data: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>,
  existingParts: PartEntry[] = []
): PartEntry {
  const part: PartEntry = {
    id: generatePartId(),
    partNumber: data.partNumber || generatePartNumber(existingParts),
    name: data.name || '',
    length: data.length || 0,
    width: data.width || 0,
    thickness: data.thickness || 18,
    quantity: data.quantity || 1,
    materialName: data.materialName || '',
    grainDirection: data.grainDirection || 'none',
    edgeBanding: data.edgeBanding || DEFAULT_EDGE_BANDING,
    hasCNCOperations: data.hasCNCOperations || false,
    source: data.source || 'manual',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
  
  // Add optional fields only if they have values
  if (data.partType) part.partType = data.partType;
  if (data.barProfile) part.barProfile = data.barProfile;
  if (data.materialId) part.materialId = data.materialId;
  if (data.materialCode) part.materialCode = data.materialCode;
  if (data.cncProgramRef) part.cncProgramRef = data.cncProgramRef;
  if (data.notes) part.notes = data.notes;
  if (data.importedFrom) part.importedFrom = data.importedFrom;

  return part;
}

/**
 * Get design item document reference
 */
function getDesignItemRef(projectId: string, itemId: string) {
  return doc(db, 'designProjects', projectId, 'designItems', itemId);
}

/**
 * Add a part to a design item
 */
export async function addPart(
  projectId: string,
  itemId: string,
  partData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>,
  existingParts: PartEntry[],
  userId: string
): Promise<PartEntry> {
  const part = cleanUndefined(createPartEntry(partData, existingParts));
  const docRef = getDesignItemRef(projectId, itemId);

  // Clean all parts to remove any undefined values
  const newParts = [...existingParts.map(cleanUndefined), part];
  const summary = calculatePartsSummary(newParts);

  await updateDoc(docRef, {
    parts: newParts,
    partsSummary: summary,
    ...partsVersionBump(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Fire-and-forget: non-critical side effects run in background
  invalidateProjectOptimization(projectId, userId, 'Part added').catch(err => console.warn('[PartsService] Optimization invalidation failed:', err));
  checkAndAutoUpdatePartsRAG(projectId, itemId, newParts, userId).catch(err => console.warn('[PartsService] RAG auto-update failed:', err));

  return part;
}

/**
 * Update a part in a design item
 */
export async function updatePart(
  projectId: string,
  itemId: string,
  partId: string,
  updates: Partial<Omit<PartEntry, 'id' | 'createdAt'>>,
  currentParts: PartEntry[],
  userId: string
): Promise<void> {
  const docRef = getDesignItemRef(projectId, itemId);

  // Clean undefined values from updates before applying
  const cleanedUpdates = cleanUndefined(updates);
  
  const updatedParts = currentParts.map((part) =>
    part.id === partId
      ? cleanUndefined({ ...part, ...cleanedUpdates, updatedAt: Timestamp.now() })
      : cleanUndefined(part)
  );

  const summary = calculatePartsSummary(updatedParts);

  await updateDoc(docRef, {
    parts: updatedParts,
    partsSummary: summary,
    ...partsVersionBump(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Fire-and-forget: non-critical side effects run in background
  invalidateProjectOptimization(projectId, userId, 'Part modified').catch(err => console.warn('[PartsService] Optimization invalidation failed:', err));
  checkAndAutoUpdatePartsRAG(projectId, itemId, updatedParts, userId).catch(err => console.warn('[PartsService] RAG auto-update failed:', err));

  // P3.1: reverse-sync material/dims/notes edits back to the source ScenePart
  // so the 3D viewport re-renders with the corrected finish.
  const updatedPart = updatedParts.find(p => p.id === partId);
  if (updatedPart?.sceneId && updatedPart?.cabinetId && (updatedPart?.meshNodeId || partId)) {
    syncPartBackToScene({
      target: {
        sceneId: updatedPart.sceneId,
        cabinetId: updatedPart.cabinetId,
        meshNodeId: updatedPart.meshNodeId,
        partId,
      },
      fields: {
        finishLibraryId: cleanedUpdates.finishLibraryId ?? cleanedUpdates.materialId,
        materialDescription: cleanedUpdates.materialDescription ?? cleanedUpdates.material,
        inventoryItemId: cleanedUpdates.inventoryItemId,
        inventoryItemName: cleanedUpdates.inventoryItemName,
        dimensions: cleanedUpdates.length != null || cleanedUpdates.width != null || cleanedUpdates.thickness != null
          ? {
              length: cleanedUpdates.length ?? updatedPart.length,
              width: cleanedUpdates.width ?? updatedPart.width,
              thickness: cleanedUpdates.thickness ?? updatedPart.thickness,
              grainDirection: cleanedUpdates.grainDirection ?? updatedPart.grainDirection,
            }
          : undefined,
        notes: cleanedUpdates.notes,
        edgeBanding: cleanedUpdates.edgeBanding !== undefined
          ? toSceneEdgeBanding(updatedPart)
          : undefined,
      },
      changedBy: userId,
    }).catch(err => console.warn('[PartsService] Reverse sync to scene failed:', err));
  }
}

/**
 * Bulk update multiple parts (for reclassification, batch edits)
 */
export async function bulkUpdateParts(
  projectId: string,
  itemId: string,
  updates: Array<{ partId: string; changes: Partial<PartEntry> }>,
  currentParts: PartEntry[],
  userId: string
): Promise<void> {
  const docRef = getDesignItemRef(projectId, itemId);
  const updateMap = new Map(updates.map(u => [u.partId, cleanUndefined(u.changes)]));

  const updatedParts = currentParts.map(part => {
    const changes = updateMap.get(part.id);
    return changes
      ? cleanUndefined({ ...part, ...changes, updatedAt: Timestamp.now() })
      : cleanUndefined(part);
  });

  const summary = calculatePartsSummary(updatedParts);

  await updateDoc(docRef, {
    parts: updatedParts,
    partsSummary: summary,
    ...partsVersionBump(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Fire-and-forget: non-critical side effects run in background
  invalidateProjectOptimization(projectId, userId, 'Parts reclassified').catch(err => console.warn('[PartsService] Optimization invalidation failed:', err));
  checkAndAutoUpdatePartsRAG(projectId, itemId, updatedParts, userId).catch(err => console.warn('[PartsService] RAG auto-update failed:', err));
}

/**
 * Delete a part from a design item
 */
export async function deletePart(
  projectId: string,
  itemId: string,
  partId: string,
  currentParts: PartEntry[],
  userId: string
): Promise<void> {
  const docRef = getDesignItemRef(projectId, itemId);

  const remainingParts = currentParts.filter((p) => p.id !== partId).map(cleanUndefined);
  const summary = calculatePartsSummary(remainingParts);

  await updateDoc(docRef, {
    parts: remainingParts,
    partsSummary: summary,
    ...partsVersionBump(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Fire-and-forget
  invalidateProjectOptimization(projectId, userId, 'Part deleted').catch(err => console.warn('[PartsService] Optimization invalidation failed:', err));
}

/**
 * Bulk delete multiple parts from a design item in a single write
 */
export async function bulkDeleteParts(
  projectId: string,
  itemId: string,
  partIds: string[],
  currentParts: PartEntry[],
  userId: string
): Promise<void> {
  const docRef = getDesignItemRef(projectId, itemId);
  const idsToDelete = new Set(partIds);

  const remainingParts = currentParts.filter((p) => !idsToDelete.has(p.id)).map(cleanUndefined);
  const summary = calculatePartsSummary(remainingParts);

  await updateDoc(docRef, {
    parts: remainingParts,
    partsSummary: summary,
    ...partsVersionBump(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Fire-and-forget
  invalidateProjectOptimization(projectId, userId, `${partIds.length} parts deleted`).catch(err => console.warn('[PartsService] Optimization invalidation failed:', err));
}

/**
 * Bulk add parts (for CSV import)
 */
export async function bulkAddParts(
  projectId: string,
  itemId: string,
  partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[],
  existingParts: PartEntry[],
  userId: string
): Promise<PartEntry[]> {
  const docRef = getDesignItemRef(projectId, itemId);

  let allParts = existingParts.map(cleanUndefined);
  const newParts: PartEntry[] = [];

  for (const partData of partsData) {
    const part = cleanUndefined(createPartEntry(partData, allParts));
    newParts.push(part);
    allParts.push(part);
  }

  const summary = calculatePartsSummary(allParts);

  await updateDoc(docRef, {
    parts: allParts,
    partsSummary: summary,
    ...partsVersionBump(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Fire-and-forget: non-critical side effects run in background
  invalidateProjectOptimization(projectId, userId, 'Parts imported').catch(err => console.warn('[PartsService] Optimization invalidation failed:', err));
  checkAndAutoUpdatePartsRAG(projectId, itemId, allParts, userId).catch(err => console.warn('[PartsService] RAG auto-update failed:', err));

  return newParts;
}

/**
 * Replace all parts (for re-import)
 */
export async function replaceAllParts(
  projectId: string,
  itemId: string,
  partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[],
  userId: string
): Promise<PartEntry[]> {
  const docRef = getDesignItemRef(projectId, itemId);

  const parts: PartEntry[] = [];
  for (const partData of partsData) {
    const part = cleanUndefined(createPartEntry(partData, parts));
    parts.push(part);
  }

  const summary = calculatePartsSummary(parts);

  await updateDoc(docRef, {
    parts,
    partsSummary: summary,
    ...partsVersionBump(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Fire-and-forget: non-critical side effects run in background
  invalidateProjectOptimization(projectId, userId, 'Parts replaced').catch(err => console.warn('[PartsService] Optimization invalidation failed:', err));
  checkAndAutoUpdatePartsRAG(projectId, itemId, parts, userId).catch(err => console.warn('[PartsService] RAG auto-update failed:', err));

  return parts;
}

// ============================================
// Invalidation Helper
// ============================================

/**
 * Invalidate project optimization and cutlist when parts change
 * Integrates with ChangeDetectionService for dependency tracking
 */
export async function invalidateProjectOptimization(
  projectId: string,
  userId: string,
  reason: string
): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);
  
  if (!projectSnap.exists()) return;
  
  const project = projectSnap.data();
  const now = Timestamp.now();
  const timestamp = { seconds: now.seconds, nanoseconds: now.nanoseconds };
  
  // Get current optimization status
  const currentStatus = project.optimizationStatus;
  // Filter out any undefined/null entries from existing reasons (defensive)
  const currentReasons = (currentStatus?.invalidationReasons || []).filter((r: unknown) => r != null);
  const updatedReasons = currentReasons.includes(reason)
    ? currentReasons
    : [...currentReasons, reason];
  
  const updates: Record<string, unknown> = {
    // Mark cutlist as stale
    'consolidatedCutlist.isStale': true,
    'consolidatedCutlist.staleReason': reason,
    // Update optimization status for change detection
    'optimizationStatus.status': 'stale',
    'optimizationStatus.invalidationReasons': updatedReasons,
    'optimizationStatus.version': (currentStatus?.version || 0) + 1,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };
  
  // Invalidate estimation if it exists
  if (project.optimizationState?.estimation && !project.optimizationState.estimation.invalidatedAt) {
    updates['optimizationState.estimation.invalidatedAt'] = timestamp;
    updates['optimizationState.estimation.invalidationReasons'] = [reason];
  }
  
  // Invalidate production if it exists
  if (project.optimizationState?.production && !project.optimizationState.production.invalidatedAt) {
    updates['optimizationState.production.invalidatedAt'] = timestamp;
    updates['optimizationState.production.invalidationReasons'] = [reason];
  }
  
  await updateDoc(projectRef, updates);
  console.log(`Project ${projectId} marked stale: ${reason}`);
}

// ============================================
// RAG Auto-Update Helper
// ============================================

/**
 * Check if all parts are fully defined and auto-update RAG aspects.
 * Non-blocking — failures are logged and swallowed.
 */
async function checkAndAutoUpdatePartsRAG(
  projectId: string,
  itemId: string,
  parts: PartEntry[],
  userId: string
): Promise<void> {
  try {
    const { arePartsFullyDefined, autoUpdateRAGForItems } = await import('./ragAutoUpdateService');
    if (arePartsFullyDefined(parts)) {
      await autoUpdateRAGForItems(projectId, 'parts-fully-defined', [itemId], userId);

      // Auto-generate deliverable documents (Cut List, BOM, Material Spec) from parts data
      try {
        const { autoGenerateDeliverables } = await import('./deliverableAutoGenService');
        await autoGenerateDeliverables(projectId, itemId, parts, userId);
      } catch (err) {
        console.warn('[PartsService] Auto-deliverable generation failed:', err);
      }
    }
  } catch (err) {
    console.warn('[PartsService] Auto-RAG update failed:', err);
  }
}
