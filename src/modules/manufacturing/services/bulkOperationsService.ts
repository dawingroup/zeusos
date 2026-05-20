/**
 * Bulk Operations Service
 *
 * Batch operations for manufacturing orders:
 * - Bulk approval with material reservation
 * - Bulk stage advancement
 * - Bulk status changes (hold, cancel)
 * - Batch procurement requirement generation
 * - Priority reassignment
 */

import {
  collection,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ManufacturingOrder, MOStage, MOStageTransition } from '../types';
import {
  reserveStock,
  releaseStock,
} from '@/modules/inventory/services/stockLevelService';
import { checkMaterialAvailability, generateProcurementFromShortages } from './inventoryIntegrationService';
import { generateRequirementsFromMO } from '@/modules/procurement/services/procurementRequirementService';

const MO_COLLECTION = 'manufacturingOrders';
const BUSINESS_EVENTS_COLLECTION = 'businessEvents';

// ============================================
// Types
// ============================================

export interface BulkOperationResult {
  totalProcessed: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    moId: string;
    moNumber: string;
    success: boolean;
    error?: string;
    details?: Record<string, unknown>;
  }>;
}

export interface BulkApprovalOptions {
  defaultWarehouseId: string;
  autoProcureShortages?: boolean;
  continueOnShortage?: boolean;
}

export interface BulkStageAdvanceOptions {
  notes?: string;
  skipValidation?: boolean;
}

// ============================================
// Bulk Approval
// ============================================

/**
 * Approve multiple manufacturing orders in batch.
 * Handles material reservations and optionally generates procurement for shortages.
 */
export async function bulkApproveOrders(
  moIds: string[],
  userId: string,
  options: BulkApprovalOptions,
): Promise<BulkOperationResult> {
  const { defaultWarehouseId, autoProcureShortages = false, continueOnShortage = false } = options;

  const result: BulkOperationResult = {
    totalProcessed: moIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
  };

  for (const moId of moIds) {
    try {
      const moRef = doc(db, MO_COLLECTION, moId);
      const moSnap = await getDoc(moRef);

      if (!moSnap.exists()) {
        result.results.push({
          moId,
          moNumber: 'N/A',
          success: false,
          error: 'Manufacturing order not found',
        });
        result.failureCount++;
        continue;
      }

      const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

      if (mo.status !== 'draft') {
        result.results.push({
          moId,
          moNumber: mo.moNumber,
          success: false,
          error: `MO must be in draft status (current: ${mo.status})`,
        });
        result.failureCount++;
        continue;
      }

      // Check material availability
      const availability = await checkMaterialAvailability(mo, defaultWarehouseId);

      if (availability.overallStatus === 'blocked' && !continueOnShortage) {
        // Handle shortages
        if (autoProcureShortages) {
          const shortages = availability.items.filter(
            i => i.status === 'unavailable' || i.status === 'partial' || i.status === 'no-inventory'
          );
          await generateProcurementFromShortages(mo, shortages, userId, { autoCreatePO: false });
        }

        result.results.push({
          moId,
          moNumber: mo.moNumber,
          success: false,
          error: 'Insufficient materials',
          details: {
            shortageCount: availability.unavailableItems + availability.noInventoryItems,
            estimatedShortageValue: availability.estimatedShortageValue,
            procurementGenerated: autoProcureShortages,
          },
        });
        result.failureCount++;
        continue;
      }

      // Reserve available materials
      const reservations = [];
      const shortages = [];

      for (const bomEntry of mo.bom) {
        if (!bomEntry.inventoryItemId) continue;

        const warehouseId = bomEntry.warehouseId ?? defaultWarehouseId;
        const reserveResult = await reserveStock(
          bomEntry.inventoryItemId,
          warehouseId,
          bomEntry.sku,
          bomEntry.itemName,
          bomEntry.quantityRequired,
          moId,
          userId,
        );

        if (reserveResult.success) {
          reservations.push({
            id: `RES-${Date.now()}-${bomEntry.id}`,
            inventoryItemId: bomEntry.inventoryItemId,
            stockLevelId: reserveResult.stockLevelId,
            warehouseId,
            quantityReserved: bomEntry.quantityRequired,
            reservedAt: new Date(),
            reservedBy: userId,
            status: 'active' as const,
          });
        } else {
          shortages.push({
            itemName: bomEntry.itemName,
            required: bomEntry.quantityRequired,
            available: reserveResult.availableQty,
          });
        }
      }

      // Update MO status
      const batch = writeBatch(db);
      batch.update(moRef, {
        status: shortages.length > 0 && !continueOnShortage ? 'draft' : 'approved',
        materialReservations: reservations,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
      await batch.commit();

      if (shortages.length === 0 || continueOnShortage) {
        // Emit approval event
        await emitBusinessEvent('manufacturing_order_approved', mo, userId, {
          bulk: true,
          reservationCount: reservations.length,
        });

        result.results.push({
          moId,
          moNumber: mo.moNumber,
          success: true,
          details: {
            reservationsCreated: reservations.length,
            shortageCount: shortages.length,
          },
        });
        result.successCount++;
      } else {
        result.results.push({
          moId,
          moNumber: mo.moNumber,
          success: false,
          error: 'Partial shortage',
          details: { shortages },
        });
        result.failureCount++;
      }
    } catch (err) {
      result.results.push({
        moId,
        moNumber: 'N/A',
        success: false,
        error: `Unexpected error: ${err}`,
      });
      result.failureCount++;
    }
  }

  return result;
}

// ============================================
// Bulk Stage Advancement
// ============================================

/**
 * Advance multiple MOs to the next stage in their pipeline
 */
export async function bulkAdvanceStage(
  moIds: string[],
  userId: string,
  options: BulkStageAdvanceOptions = {},
): Promise<BulkOperationResult> {
  const { notes, skipValidation = false } = options;
  const stageOrder: MOStage[] = ['queued', 'cutting', 'assembly', 'finishing', 'qc', 'ready'];

  const result: BulkOperationResult = {
    totalProcessed: moIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
  };

  for (const moId of moIds) {
    try {
      const moRef = doc(db, MO_COLLECTION, moId);
      const moSnap = await getDoc(moRef);

      if (!moSnap.exists()) {
        result.results.push({
          moId,
          moNumber: 'N/A',
          success: false,
          error: 'Manufacturing order not found',
        });
        result.failureCount++;
        continue;
      }

      const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

      if (mo.status !== 'in-progress' && !skipValidation) {
        result.results.push({
          moId,
          moNumber: mo.moNumber,
          success: false,
          error: `MO must be in-progress (current: ${mo.status})`,
        });
        result.failureCount++;
        continue;
      }

      const currentIdx = stageOrder.indexOf(mo.currentStage);
      if (currentIdx === -1 || currentIdx >= stageOrder.length - 1) {
        result.results.push({
          moId,
          moNumber: mo.moNumber,
          success: false,
          error: `Cannot advance past ${mo.currentStage} stage`,
        });
        result.failureCount++;
        continue;
      }

      const nextStage = stageOrder[currentIdx + 1];
      const transition: MOStageTransition = {
        fromStage: mo.currentStage,
        toStage: nextStage,
        transitionedAt: new Date() as any,
        transitionedBy: userId,
        notes: notes ?? 'Bulk stage advancement',
      };

      const updateData: Record<string, unknown> = {
        currentStage: nextStage,
        stageEnteredAt: serverTimestamp(),
        stageHistory: [...mo.stageHistory, transition],
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      };

      // Mark completed if reaching ready stage
      if (nextStage === 'ready') {
        updateData.status = 'completed';
        updateData['scheduling.actualEnd'] = serverTimestamp();
      }

      await writeBatch(db).update(moRef, updateData).commit();

      await emitBusinessEvent('manufacturing_order_stage_changed', mo, userId, {
        bulk: true,
        fromStage: mo.currentStage,
        toStage: nextStage,
      });

      result.results.push({
        moId,
        moNumber: mo.moNumber,
        success: true,
        details: {
          fromStage: mo.currentStage,
          toStage: nextStage,
          completed: nextStage === 'ready',
        },
      });
      result.successCount++;
    } catch (err) {
      result.results.push({
        moId,
        moNumber: 'N/A',
        success: false,
        error: `Unexpected error: ${err}`,
      });
      result.failureCount++;
    }
  }

  return result;
}

// ============================================
// Bulk Status Changes
// ============================================

/**
 * Put multiple MOs on hold
 */
export async function bulkPutOnHold(
  moIds: string[],
  userId: string,
  reason: string,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    totalProcessed: moIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
  };

  const batch = writeBatch(db);
  const validMOs: ManufacturingOrder[] = [];

  for (const moId of moIds) {
    const moRef = doc(db, MO_COLLECTION, moId);
    const moSnap = await getDoc(moRef);

    if (!moSnap.exists()) {
      result.results.push({
        moId,
        moNumber: 'N/A',
        success: false,
        error: 'Manufacturing order not found',
      });
      result.failureCount++;
      continue;
    }

    const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

    if (!['approved', 'in-progress'].includes(mo.status)) {
      result.results.push({
        moId,
        moNumber: mo.moNumber,
        success: false,
        error: `Cannot put on hold from ${mo.status} status`,
      });
      result.failureCount++;
      continue;
    }

    batch.update(moRef, {
      status: 'on-hold',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    validMOs.push(mo);
    result.results.push({
      moId,
      moNumber: mo.moNumber,
      success: true,
    });
    result.successCount++;
  }

  if (validMOs.length > 0) {
    await batch.commit();

    for (const mo of validMOs) {
      await emitBusinessEvent('manufacturing_order_on_hold', mo, userId, {
        bulk: true,
        reason,
      });
    }
  }

  return result;
}

/**
 * Resume multiple MOs from hold
 */
export async function bulkResumeFromHold(
  moIds: string[],
  userId: string,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    totalProcessed: moIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
  };

  const batch = writeBatch(db);
  const validMOs: ManufacturingOrder[] = [];

  for (const moId of moIds) {
    const moRef = doc(db, MO_COLLECTION, moId);
    const moSnap = await getDoc(moRef);

    if (!moSnap.exists()) {
      result.results.push({
        moId,
        moNumber: 'N/A',
        success: false,
        error: 'Manufacturing order not found',
      });
      result.failureCount++;
      continue;
    }

    const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

    if (mo.status !== 'on-hold') {
      result.results.push({
        moId,
        moNumber: mo.moNumber,
        success: false,
        error: `MO is not on hold (current: ${mo.status})`,
      });
      result.failureCount++;
      continue;
    }

    batch.update(moRef, {
      status: 'in-progress',
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    validMOs.push(mo);
    result.results.push({
      moId,
      moNumber: mo.moNumber,
      success: true,
    });
    result.successCount++;
  }

  if (validMOs.length > 0) {
    await batch.commit();
  }

  return result;
}

/**
 * Cancel multiple MOs and release their material reservations
 */
export async function bulkCancelOrders(
  moIds: string[],
  userId: string,
  reason: string,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    totalProcessed: moIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
  };

  for (const moId of moIds) {
    try {
      const moRef = doc(db, MO_COLLECTION, moId);
      const moSnap = await getDoc(moRef);

      if (!moSnap.exists()) {
        result.results.push({
          moId,
          moNumber: 'N/A',
          success: false,
          error: 'Manufacturing order not found',
        });
        result.failureCount++;
        continue;
      }

      const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

      if (['completed', 'cancelled'].includes(mo.status)) {
        result.results.push({
          moId,
          moNumber: mo.moNumber,
          success: false,
          error: `Cannot cancel MO in ${mo.status} status`,
        });
        result.failureCount++;
        continue;
      }

      // Release active reservations
      let releasedCount = 0;
      for (const reservation of mo.materialReservations) {
        if (reservation.status !== 'active') continue;
        try {
          await releaseStock(
            reservation.inventoryItemId,
            reservation.warehouseId,
            reservation.quantityReserved,
            moId,
            userId,
          );
          releasedCount++;
        } catch {
          // Continue with cancellation even if release fails
        }
      }

      const updatedReservations = mo.materialReservations.map(r =>
        r.status === 'active' ? { ...r, status: 'released' as const } : r
      );

      await writeBatch(db)
        .update(moRef, {
          status: 'cancelled',
          materialReservations: updatedReservations,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        })
        .commit();

      result.results.push({
        moId,
        moNumber: mo.moNumber,
        success: true,
        details: {
          reservationsReleased: releasedCount,
          reason,
        },
      });
      result.successCount++;
    } catch (err) {
      result.results.push({
        moId,
        moNumber: 'N/A',
        success: false,
        error: `Unexpected error: ${err}`,
      });
      result.failureCount++;
    }
  }

  return result;
}

// ============================================
// Bulk Priority Reassignment
// ============================================

/**
 * Update priority for multiple MOs
 */
export async function bulkUpdatePriority(
  moIds: string[],
  newPriority: 'low' | 'medium' | 'high' | 'urgent',
  userId: string,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    totalProcessed: moIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
  };

  const batch = writeBatch(db);

  for (const moId of moIds) {
    const moRef = doc(db, MO_COLLECTION, moId);
    const moSnap = await getDoc(moRef);

    if (!moSnap.exists()) {
      result.results.push({
        moId,
        moNumber: 'N/A',
        success: false,
        error: 'Manufacturing order not found',
      });
      result.failureCount++;
      continue;
    }

    const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

    batch.update(moRef, {
      priority: newPriority,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    result.results.push({
      moId,
      moNumber: mo.moNumber,
      success: true,
      details: {
        previousPriority: mo.priority,
        newPriority,
      },
    });
    result.successCount++;
  }

  if (result.successCount > 0) {
    await batch.commit();
  }

  return result;
}

// ============================================
// Batch Procurement Generation
// ============================================

/**
 * Generate procurement requirements for multiple MOs at once
 */
export async function bulkGenerateProcurement(
  moIds: string[],
  userId: string,
): Promise<BulkOperationResult & { totalRequirements: number }> {
  const result: BulkOperationResult & { totalRequirements: number } = {
    totalProcessed: moIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
    totalRequirements: 0,
  };

  for (const moId of moIds) {
    try {
      const reqIds = await generateRequirementsFromMO(moId, userId);
      result.totalRequirements += reqIds.length;

      const moRef = doc(db, MO_COLLECTION, moId);
      const moSnap = await getDoc(moRef);
      const moNumber = moSnap.exists() ? (moSnap.data() as ManufacturingOrder).moNumber : moId;

      result.results.push({
        moId,
        moNumber,
        success: true,
        details: {
          requirementsCreated: reqIds.length,
        },
      });
      result.successCount++;
    } catch (err) {
      result.results.push({
        moId,
        moNumber: 'N/A',
        success: false,
        error: `Failed to generate requirements: ${err}`,
      });
      result.failureCount++;
    }
  }

  return result;
}

// ============================================
// Batch Start Production
// ============================================

/**
 * Start production for multiple approved MOs
 */
export async function bulkStartProduction(
  moIds: string[],
  userId: string,
): Promise<BulkOperationResult> {
  const result: BulkOperationResult = {
    totalProcessed: moIds.length,
    successCount: 0,
    failureCount: 0,
    results: [],
  };

  const batch = writeBatch(db);
  const validMOs: ManufacturingOrder[] = [];

  for (const moId of moIds) {
    const moRef = doc(db, MO_COLLECTION, moId);
    const moSnap = await getDoc(moRef);

    if (!moSnap.exists()) {
      result.results.push({
        moId,
        moNumber: 'N/A',
        success: false,
        error: 'Manufacturing order not found',
      });
      result.failureCount++;
      continue;
    }

    const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

    if (mo.status !== 'approved') {
      result.results.push({
        moId,
        moNumber: mo.moNumber,
        success: false,
        error: `MO must be approved to start (current: ${mo.status})`,
      });
      result.failureCount++;
      continue;
    }

    batch.update(moRef, {
      status: 'in-progress',
      'scheduling.actualStart': serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    validMOs.push(mo);
    result.results.push({
      moId,
      moNumber: mo.moNumber,
      success: true,
    });
    result.successCount++;
  }

  if (validMOs.length > 0) {
    await batch.commit();
  }

  return result;
}

// ============================================
// Helper Functions
// ============================================

async function emitBusinessEvent(
  eventType: string,
  mo: ManufacturingOrder,
  userId: string,
  extraData?: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
    eventType,
    category: 'workflow_transition',
    severity: 'medium',
    sourceModule: 'manufacturing',
    subsidiary: 'finishes',
    entityType: 'manufacturing_order',
    entityId: mo.id,
    entityName: mo.moNumber,
    projectId: mo.projectId,
    projectName: mo.projectCode,
    title: `Manufacturing order ${eventType.replace(/_/g, ' ')}`,
    description: `MO ${mo.moNumber} for ${mo.designItemName}`,
    triggeredBy: userId,
    triggeredAt: serverTimestamp(),
    status: 'pending',
    metadata: extraData ?? {},
    createdAt: serverTimestamp(),
  });
}
