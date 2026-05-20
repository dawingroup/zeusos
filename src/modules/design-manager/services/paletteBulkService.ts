/**
 * Palette Bulk Service
 * Batch operations for Material Palette entries within a project document.
 * Mirrors inventory/services/inventoryBulkService.ts pattern.
 *
 * Key difference: palette entries live inside project.materialPalette.entries[]
 * (a single Firestore document), not as separate documents.
 */

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { Project, MaterialType } from '@/shared/types';
import { releaseOffcut } from '@/shared/services/offcutLibraryService';

const PROJECTS_COLLECTION = 'designProjects';

// ============================================
// Result Types
// ============================================

export interface PaletteBulkResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  entries: Array<{
    entryId: string;
    entryName: string;
    success: boolean;
    error?: string;
  }>;
}

export interface PaletteUpdateFields {
  materialType?: MaterialType;
}

// ============================================
// Helpers
// ============================================

/** Recursively strip undefined values before writing to Firestore */
function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (typeof obj === 'object' && !(obj instanceof FirestoreTimestamp)) {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        cleaned[k] = typeof v === 'object' && v !== null ? stripUndefined(v) : v;
      }
    }
    return cleaned;
  }
  return obj;
}

async function invalidateEstimation(
  projectId: string,
  userId: string,
  reason: string
): Promise<void> {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) return;

  const project = projectSnap.data() as Project;

  if (project.optimizationState?.estimation && !project.optimizationState.estimation.invalidatedAt) {
    const now = FirestoreTimestamp.now();

    await updateDoc(projectRef, {
      'optimizationState.estimation.invalidatedAt': {
        seconds: now.seconds,
        nanoseconds: now.nanoseconds,
      },
      'optimizationState.estimation.invalidationReasons': [reason],
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }
}

/** Stock config fields that should be cleared when material type changes */
const STOCK_FIELDS_BY_TYPE: Record<MaterialType, string[]> = {
  PANEL: ['stockSheets'],
  SOLID: ['stockSheets'],
  VENEER: ['stockSheets'],
  EDGE: [],
  TIMBER: ['timberStock'],
  GLASS: ['glassStock'],
  METAL_BAR: ['linearStock'],
  ALUMINIUM: ['linearStock'],
  STONE: ['stockSheets'],
  FABRIC: ['fabricStock'],
  COMPONENT: [],
};

// ============================================
// Bulk Reclassify (Update materialType)
// ============================================

export async function bulkUpdatePaletteEntries(
  projectId: string,
  entryIds: string[],
  updates: PaletteUpdateFields,
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<PaletteBulkResult> {
  const result: PaletteBulkResult = {
    totalProcessed: entryIds.length,
    successCount: 0,
    failureCount: 0,
    entries: [],
  };

  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
    const palette = project.materialPalette;

    if (!palette) {
      throw new Error('Material palette not initialized');
    }

    const timestamp = FirestoreTimestamp.now();
    const entryIdSet = new Set(entryIds);

    for (let i = 0; i < palette.entries.length; i++) {
      const entry = palette.entries[i];
      if (!entryIdSet.has(entry.id)) continue;

      try {
        if (updates.materialType) {
          const newType = updates.materialType;
          const oldType = entry.materialType;

          // Apply new type
          palette.entries[i] = { ...entry, materialType: newType, updatedAt: timestamp };

          // Clear incompatible stock config from old type
          if (oldType !== newType) {
            // Clear all stock fields not relevant to the new type
            const keepFields = STOCK_FIELDS_BY_TYPE[newType];
            if (!keepFields.includes('stockSheets')) {
              palette.entries[i].stockSheets = [];
            }
            if (!keepFields.includes('timberStock')) {
              delete (palette.entries[i] as any).timberStock;
            }
            if (!keepFields.includes('glassStock')) {
              delete (palette.entries[i] as any).glassStock;
            }
            if (!keepFields.includes('linearStock')) {
              delete (palette.entries[i] as any).linearStock;
            }
          }
        }

        result.entries.push({ entryId: entry.id, entryName: entry.designName, success: true });
        result.successCount++;
      } catch (err) {
        result.entries.push({
          entryId: entry.id,
          entryName: entry.designName,
          success: false,
          error: (err as Error).message,
        });
        result.failureCount++;
      }

      onProgress?.(result.successCount + result.failureCount, entryIds.length);
    }

    // Write back
    await updateDoc(projectRef, {
      materialPalette: stripUndefined(palette),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Invalidate estimation since material types changed
    await invalidateEstimation(
      projectId,
      userId,
      `Bulk reclassified ${result.successCount} palette entries`
    );
  } catch (err) {
    // Top-level failure — mark all remaining as failed
    const processed = result.successCount + result.failureCount;
    for (let i = processed; i < entryIds.length; i++) {
      result.entries.push({
        entryId: entryIds[i],
        entryName: '',
        success: false,
        error: (err as Error).message,
      });
      result.failureCount++;
    }
  }

  return result;
}

// ============================================
// Bulk Unmap
// ============================================

export async function bulkUnmapPaletteEntries(
  projectId: string,
  entryIds: string[],
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<PaletteBulkResult> {
  const result: PaletteBulkResult = {
    totalProcessed: entryIds.length,
    successCount: 0,
    failureCount: 0,
    entries: [],
  };

  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
    const palette = project.materialPalette;

    if (!palette) {
      throw new Error('Material palette not initialized');
    }

    const timestamp = FirestoreTimestamp.now();
    const entryIdSet = new Set(entryIds);
    let unmappedCount = 0;

    for (let i = 0; i < palette.entries.length; i++) {
      const entry = palette.entries[i];
      if (!entryIdSet.has(entry.id)) continue;

      try {
        const wasMapped = !!entry.inventoryId;

        // Release any reserved offcuts
        if (entry.offcutIds && entry.offcutIds.length > 0) {
          await Promise.all(
            entry.offcutIds.map(id =>
              releaseOffcut(id).catch(err =>
                console.warn(`[PaletteBulkService] Failed to release offcut ${id}:`, err)
              )
            )
          );
        }

        // Clear mapping fields (destructure to omit, same as unmapMaterial)
        const {
          inventoryId, inventoryName, inventorySku, unitCost,
          mappedAt, mappedBy, offcutIds,
          timberStock, linearStock, glassStock,
          ...rest
        } = entry;

        palette.entries[i] = {
          ...rest,
          stockSheets: [],
          updatedAt: timestamp,
        };

        if (wasMapped) {
          unmappedCount++;
        }

        result.entries.push({ entryId: entry.id, entryName: entry.designName, success: true });
        result.successCount++;
      } catch (err) {
        result.entries.push({
          entryId: entry.id,
          entryName: entry.designName,
          success: false,
          error: (err as Error).message,
        });
        result.failureCount++;
      }

      onProgress?.(result.successCount + result.failureCount, entryIds.length);
    }

    // Update counts
    palette.unmappedCount += unmappedCount;
    palette.mappedCount = Math.max(0, palette.mappedCount - unmappedCount);

    // Write back
    await updateDoc(projectRef, {
      materialPalette: stripUndefined(palette),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Invalidate estimation
    await invalidateEstimation(
      projectId,
      userId,
      `Bulk unmapped ${result.successCount} palette entries`
    );
  } catch (err) {
    const processed = result.successCount + result.failureCount;
    for (let i = processed; i < entryIds.length; i++) {
      result.entries.push({
        entryId: entryIds[i],
        entryName: '',
        success: false,
        error: (err as Error).message,
      });
      result.failureCount++;
    }
  }

  return result;
}

// ============================================
// Bulk Delete
// ============================================

export async function bulkDeletePaletteEntries(
  projectId: string,
  entryIds: string[],
  userId: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<PaletteBulkResult> {
  const result: PaletteBulkResult = {
    totalProcessed: entryIds.length,
    successCount: 0,
    failureCount: 0,
    entries: [],
  };

  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const projectSnap = await getDoc(projectRef);

    if (!projectSnap.exists()) {
      throw new Error('Project not found');
    }

    const project = { id: projectSnap.id, ...projectSnap.data() } as Project;
    const palette = project.materialPalette;

    if (!palette) {
      throw new Error('Material palette not initialized');
    }

    const entryIdSet = new Set(entryIds);
    const entriesToRemove = palette.entries.filter(e => entryIdSet.has(e.id));

    // Release offcuts on entries being deleted
    for (const entry of entriesToRemove) {
      if (entry.offcutIds && entry.offcutIds.length > 0) {
        await Promise.all(
          entry.offcutIds.map(id =>
            releaseOffcut(id).catch(err =>
              console.warn(`[PaletteBulkService] Failed to release offcut ${id}:`, err)
            )
          )
        );
      }

      result.entries.push({ entryId: entry.id, entryName: entry.designName, success: true });
      result.successCount++;
      onProgress?.(result.successCount, entryIds.length);
    }

    // Remove entries
    const removedMapped = entriesToRemove.filter(e => !!e.inventoryId).length;
    const removedUnmapped = entriesToRemove.length - removedMapped;

    palette.entries = palette.entries.filter(e => !entryIdSet.has(e.id));
    palette.mappedCount = Math.max(0, palette.mappedCount - removedMapped);
    palette.unmappedCount = Math.max(0, palette.unmappedCount - removedUnmapped);

    // Write back
    await updateDoc(projectRef, {
      materialPalette: stripUndefined(palette),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    // Invalidate estimation
    await invalidateEstimation(
      projectId,
      userId,
      `Bulk deleted ${result.successCount} palette entries`
    );
  } catch (err) {
    const processed = result.successCount + result.failureCount;
    for (let i = processed; i < entryIds.length; i++) {
      result.entries.push({
        entryId: entryIds[i],
        entryName: '',
        success: false,
        error: (err as Error).message,
      });
      result.failureCount++;
    }
  }

  return result;
}
