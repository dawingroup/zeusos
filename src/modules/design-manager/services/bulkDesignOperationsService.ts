/**
 * Bulk Design Operations Service
 * Handles batch operations on design items: bulk stage advancement
 * and bulk file upload with multi-item assignment.
 */

import {
  doc,
  writeBatch,
  serverTimestamp,
  Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  DesignItem,
  DesignStage,
  StageTransition,
  DeliverableType,
  RAGStatusValue,
} from '../types';
import {
  getNextStageForItem,
  isAtFinalStageForItem,
  canAdvanceToStage,
} from '../utils/stage-gate';
import {
  getDesignItem,
  createDeliverable,
  batchUpdateRAGAspects,
} from './firestore';
import { uploadSharedDeliverableFile, type UploadProgress } from './storage';

// ============================================
// Types
// ============================================

export interface BulkDesignOperationResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    itemId: string;
    itemName: string;
    success: boolean;
    error?: string;
    details?: Record<string, unknown>;
  }>;
}

export interface BulkStageValidationResult {
  eligible: Array<{
    item: DesignItem;
    nextStage: DesignStage;
    warnings: string[];
  }>;
  blocked: Array<{
    item: DesignItem;
    nextStage: DesignStage | null;
    failures: string[];
    warnings: string[];
  }>;
  atFinalStage: Array<{
    item: DesignItem;
  }>;
}

export interface BulkFileUploadRequest {
  file: File;
  deliverableType: DeliverableType;
  name: string;
  description?: string;
  coversTypes?: DeliverableType[];
  ragAspectUpdates?: Array<{
    aspectPath: string;
    status: RAGStatusValue;
    notes?: string;
  }>;
}

export interface BulkFileUploadResult extends BulkDesignOperationResult {
  storageUrl: string;
  storagePath: string;
  fileSize: number;
}

// ============================================
// Feature 1: Bulk Stage Advancement
// ============================================

/**
 * Validate which items can advance to their next stage.
 * Groups items into eligible, blocked, and at-final-stage.
 */
export async function validateBulkStageAdvance(
  projectId: string,
  itemIds: string[]
): Promise<BulkStageValidationResult> {
  const result: BulkStageValidationResult = {
    eligible: [],
    blocked: [],
    atFinalStage: [],
  };

  for (const itemId of itemIds) {
    let item: DesignItem | null;
    try {
      item = await getDesignItem(projectId, itemId);
    } catch {
      continue;
    }
    if (!item) continue;

    if (isAtFinalStageForItem(item)) {
      result.atFinalStage.push({ item });
      continue;
    }

    const nextStage = getNextStageForItem(item);
    if (!nextStage) {
      result.atFinalStage.push({ item });
      continue;
    }

    const gateCheck = canAdvanceToStage(item, nextStage);
    if (gateCheck.canAdvance) {
      result.eligible.push({
        item,
        nextStage,
        warnings: gateCheck.warnings,
      });
    } else {
      result.blocked.push({
        item,
        nextStage,
        failures: gateCheck.failures,
        warnings: gateCheck.warnings,
      });
    }
  }

  return result;
}

/**
 * Advance multiple design items to their next stage.
 * Re-validates each item before advancing. Uses a single batch write.
 */
export async function bulkAdvanceDesignStage(
  projectId: string,
  itemIds: string[],
  userId: string,
  notes?: string
): Promise<BulkDesignOperationResult> {
  const results: BulkDesignOperationResult['results'] = [];
  const batch = writeBatch(db);
  let successCount = 0;

  for (const itemId of itemIds) {
    let item: DesignItem | null;
    try {
      item = await getDesignItem(projectId, itemId);
    } catch (err) {
      results.push({
        itemId,
        itemName: 'Unknown',
        success: false,
        error: 'Failed to fetch item',
      });
      continue;
    }

    if (!item) {
      results.push({
        itemId,
        itemName: 'Unknown',
        success: false,
        error: 'Item not found',
      });
      continue;
    }

    if (isAtFinalStageForItem(item)) {
      results.push({
        itemId,
        itemName: item.name,
        success: false,
        error: 'Already at final stage',
      });
      continue;
    }

    const nextStage = getNextStageForItem(item);
    if (!nextStage) {
      results.push({
        itemId,
        itemName: item.name,
        success: false,
        error: 'No next stage available',
      });
      continue;
    }

    const gateCheck = canAdvanceToStage(item, nextStage);
    if (!gateCheck.canAdvance) {
      results.push({
        itemId,
        itemName: item.name,
        success: false,
        error: gateCheck.failures.join('; '),
      });
      continue;
    }

    const transition: StageTransition = {
      fromStage: item.currentStage,
      toStage: nextStage,
      transitionedAt: FirestoreTimestamp.now(),
      transitionedBy: userId,
      ...(notes ? { notes } : {}),
    };

    const itemRef = doc(db, 'designProjects', projectId, 'designItems', itemId);
    batch.update(itemRef, {
      currentStage: nextStage,
      stageEnteredAt: serverTimestamp(),
      stageHistory: [...item.stageHistory, transition],
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    successCount++;
    results.push({
      itemId,
      itemName: item.name,
      success: true,
      details: {
        fromStage: item.currentStage,
        toStage: nextStage,
        warnings: gateCheck.warnings,
      },
    });
  }

  if (successCount > 0) {
    await batch.commit();
  }

  return {
    totalProcessed: itemIds.length,
    successCount,
    failureCount: itemIds.length - successCount,
    results,
  };
}

// ============================================
// Feature 2: Bulk File Upload
// ============================================

/**
 * Upload a file once and assign it as a deliverable to multiple design items.
 * Creates a deliverable record in each item's subcollection pointing to the
 * same storage URL. Auto-updates RAG status via ragAutoUpdateService for
 * the deliverable type and any covered types.
 */
export async function uploadFileForMultipleItems(
  projectId: string,
  itemIds: string[],
  request: BulkFileUploadRequest,
  userId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<BulkFileUploadResult> {
  // 1. Upload the file once to shared storage path
  const { promise } = uploadSharedDeliverableFile(
    request.file,
    projectId,
    request.deliverableType,
    onProgress
  );
  const uploadResult = await promise;

  // 2. Create deliverable in each item's subcollection
  const results: BulkDesignOperationResult['results'] = [];
  let successCount = 0;

  for (const itemId of itemIds) {
    let item: DesignItem | null;
    try {
      item = await getDesignItem(projectId, itemId);
    } catch {
      results.push({
        itemId,
        itemName: 'Unknown',
        success: false,
        error: 'Failed to fetch item',
      });
      continue;
    }

    if (!item) {
      results.push({
        itemId,
        itemName: 'Unknown',
        success: false,
        error: 'Item not found',
      });
      continue;
    }

    try {
      // createDeliverable auto-calls ragAutoUpdateService for the deliverable type
      await createDeliverable(
        projectId,
        itemId,
        {
          name: request.name,
          type: request.deliverableType,
          description: request.description,
          fileName: request.file.name,
          fileType: request.file.type || request.file.name.split('.').pop() || 'unknown',
          fileSize: request.file.size,
          storageUrl: uploadResult.storageUrl,
          storagePath: uploadResult.storagePath,
          mimeType: uploadResult.mimeType,
          coversTypes: request.coversTypes,
        },
        userId,
        item.currentStage
      );

      successCount++;
      results.push({
        itemId,
        itemName: item.name,
        success: true,
      });
    } catch (err) {
      results.push({
        itemId,
        itemName: item.name,
        success: false,
        error: err instanceof Error ? err.message : 'Failed to create deliverable',
      });
    }
  }

  // 3. Apply any additional user-specified RAG aspect updates
  if (request.ragAspectUpdates?.length) {
    const ragUpdates: Array<{
      itemId: string;
      aspectPath: string;
      value: { status: RAGStatusValue; notes: string };
    }> = [];

    for (const itemId of itemIds) {
      // Only update items that succeeded
      const itemResult = results.find(r => r.itemId === itemId && r.success);
      if (!itemResult) continue;

      for (const update of request.ragAspectUpdates) {
        ragUpdates.push({
          itemId,
          aspectPath: update.aspectPath,
          value: {
            status: update.status,
            notes: update.notes || `Bulk upload: ${request.name}`,
          },
        });
      }
    }

    if (ragUpdates.length > 0) {
      try {
        await batchUpdateRAGAspects(projectId, ragUpdates, userId);
      } catch (err) {
        console.warn('[bulkDesignOps] RAG batch update failed:', err);
      }
    }
  }

  return {
    totalProcessed: itemIds.length,
    successCount,
    failureCount: itemIds.length - successCount,
    results,
    storageUrl: uploadResult.storageUrl,
    storagePath: uploadResult.storagePath,
    fileSize: uploadResult.fileSize,
  };
}
