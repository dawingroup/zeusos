/**
 * Manufacturing Order Service
 * CRUD, stage transitions, material reservation/consumption, and BOM management
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc as _updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type QueryConstraint,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ManufacturingOrder,
  ManufacturingOrderStatus,
  MOStage,
  BOMEntry,
  MOPartEntry,
  MOStageTransition,
  MaterialReservation,
  MaterialConsumption,
  QualityCheck,
  MOFilters,
} from '../types';
import {
  reserveStock,
  consumeStock,
  releaseStock,
} from '@/modules/inventory/services/stockLevelService';
import {
  checkMaterialAvailability,
  generateProcurementFromShortages,
} from './inventoryIntegrationService';

const MO_COLLECTION = 'manufacturingOrders';
const BUSINESS_EVENTS_COLLECTION = 'businessEvents';
const INVENTORY_ITEMS_COLLECTION = 'inventoryItems';

/**
 * Deep-clean any value for Firestore — recursively strips `undefined` from
 * objects and arrays at every nesting level. Firestore rejects explicit `undefined`.
 */
export function cleanForFirestore<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value;
  // Preserve Firestore sentinel values (serverTimestamp, increment, etc.)
  if (typeof value === 'object' && '_methodName' in (value as object)) return value;

  if (Array.isArray(value)) {
    return value.map(item => cleanForFirestore(item)) as unknown as T;
  }

  if (typeof value === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        cleaned[k] = cleanForFirestore(v);
      }
    }
    return cleaned as unknown as T;
  }

  return value;
}

/** Clean an array of objects for Firestore (strip undefined values recursively) */
export function cleanArrayForFirestore<T>(arr: T[]): T[] {
  return cleanForFirestore(arr);
}

/** Safe updateDoc wrapper — deep-cleans data to strip undefined before writing */
async function updateDoc(ref: DocumentReference, data: Record<string, unknown>) {
  return _updateDoc(ref, cleanForFirestore(data));
}

// ============================================
// Auto-numbering
// ============================================

async function generateMONumber(subsidiaryId: string): Promise<string> {
  const year = new Date().getFullYear();
  const q = query(
    collection(db, MO_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  const nextNum = snap.size + 1;
  return `MO-${year}-${String(nextNum).padStart(4, '0')}`;
}

// ============================================
// Business Event Emission
// ============================================

async function emitBusinessEvent(
  eventType: string,
  mo: Partial<ManufacturingOrder>,
  userId: string,
  extraData?: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
    eventType,
    category: 'workflow_transition',
    severity: eventType.includes('shortage') || eventType.includes('failed') ? 'high' : 'medium',
    sourceModule: 'manufacturing',
    subsidiary: 'finishes',
    entityType: 'manufacturing_order',
    entityId: mo.id ?? '',
    entityName: mo.moNumber ?? '',
    projectId: mo.projectId ?? null,
    projectName: mo.projectCode ?? null,
    title: `Manufacturing order ${eventType.replace(/_/g, ' ')}`,
    description: `MO ${mo.moNumber} for ${mo.designItemName ?? 'unknown item'}`,
    triggeredBy: userId,
    triggeredAt: serverTimestamp(),
    status: 'pending',
    metadata: extraData ?? {},
    createdAt: serverTimestamp(),
  });
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a manufacturing order (typically called by handoverService)
 */
export async function createManufacturingOrder(
  data: {
    designItemId?: string;
    designProjectId?: string;
    projectId?: string;
    projectCode?: string;
    salesOrderId?: string;
    projectPhase?: string;
    designItemName?: string;
    itemName?: string;
    itemDescription?: string;
    sourceType?: import('../types').MOSourceType;
    quantity: number;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    bom: BOMEntry[];
    parts: MOPartEntry[];
    instructions: string;
    handoverNotes: string;
    subsidiaryId: string;
    productionRank?: number;
  },
  userId: string,
): Promise<string> {
  const moNumber = await generateMONumber(data.subsidiaryId);

  // Calculate cost summary from BOM
  const materialCost = data.bom.reduce((sum, entry) => sum + entry.totalCost, 0);

  // Derive display name: design item name for handovers, itemName for standalone
  const displayName = data.designItemName || data.itemName || 'Untitled';

  const moData: Record<string, unknown> = {
    moNumber,
    status: 'draft' as ManufacturingOrderStatus,
    itemName: displayName,
    sourceType: data.sourceType ?? (data.designItemId ? 'design_handover' : 'manual'),
    ...(data.designItemId && { designItemId: data.designItemId }),
    ...(data.designProjectId && { designProjectId: data.designProjectId }),
    ...(data.projectId && { projectId: data.projectId }),
    ...(data.projectCode && { projectCode: data.projectCode }),
    ...(data.salesOrderId && { salesOrderId: data.salesOrderId }),
    ...(data.projectPhase && { projectPhase: data.projectPhase }),
    ...(data.designItemName && { designItemName: data.designItemName }),
    ...(data.itemDescription && { itemDescription: data.itemDescription }),
    quantity: data.quantity,
    priority: data.priority,
    productionRank: data.productionRank ?? 0,
    bom: data.bom,
    parts: data.parts,
    instructions: data.instructions,
    handoverNotes: data.handoverNotes,
    scheduling: {},
    materialReservations: [],
    materialConsumptions: [],
    stageHistory: [
      {
        fromStage: null,
        toStage: 'queued' as MOStage,
        transitionedAt: new Date(),
        transitionedBy: userId,
        notes: 'Manufacturing order created',
      },
    ],
    currentStage: 'queued' as MOStage,
    stageEnteredAt: serverTimestamp(),
    costSummary: {
      materialCost,
      laborCost: 0,
      totalCost: materialCost,
      currency: 'UGX',
    },
    subsidiaryId: data.subsidiaryId,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  // Clean nested arrays to strip undefined values — Firestore rejects undefined
  moData.bom = cleanArrayForFirestore(moData.bom as unknown as BOMEntry[]);
  moData.parts = cleanArrayForFirestore(moData.parts as unknown as MOPartEntry[]);

  const docRef = await addDoc(collection(db, MO_COLLECTION), moData);
  await emitBusinessEvent(
    'manufacturing_order_created',
    { ...moData, id: docRef.id } as unknown as Partial<ManufacturingOrder>,
    userId,
  );

  return docRef.id;
}

/**
 * Get a single manufacturing order
 */
export async function getManufacturingOrder(
  moId: string,
): Promise<ManufacturingOrder | null> {
  const snap = await getDoc(doc(db, MO_COLLECTION, moId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ManufacturingOrder;
}

// ============================================
// Status Transitions
// ============================================

/**
 * Approve a manufacturing order (Draft → Approved)
 * Triggers material reservation
 */
export async function approveManufacturingOrder(
  moId: string,
  userId: string,
  defaultWarehouseId: string,
): Promise<{ success: boolean; shortages: Array<{ itemName: string; required: number; available: number }> }> {
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('MO not found');

  const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;
  if (mo.status !== 'draft' && mo.status !== 'pending-approval')
    throw new Error('MO must be in draft or pending-approval status to approve');

  // ── Release any existing reservations from a prior failed approval attempt ──
  if (mo.materialReservations && mo.materialReservations.length > 0) {
    for (const res of mo.materialReservations) {
      if (res.status === 'active') {
        try {
          const warehouseId = res.warehouseId ?? defaultWarehouseId;
          await releaseStock(res.inventoryItemId, warehouseId, res.quantityReserved, moId, userId);
        } catch (err) {
          console.warn(`Failed to release prior reservation for ${res.inventoryItemId}:`, (err as Error).message);
        }
      }
    }
    // Clear stale reservations before re-reserving
    await updateDoc(moRef, { materialReservations: [] });
  }

  // ── Resolve unlinked BOM entries by name/SKU before reserving ──
  const resolvedBom: BOMEntry[] = [];
  const bomUpdates: Record<number, string> = {}; // index → resolved inventoryItemId

  for (let i = 0; i < mo.bom.length; i++) {
    const entry = mo.bom[i];
    if (entry.offcutId || (entry.inventoryItemId && !entry.inventoryItemId.includes(':'))) {
      resolvedBom.push(entry);
      continue;
    }

    // Try to resolve by name, displayName, then SKU
    let resolvedId: string | null = null;
    if (entry.itemName) {
      const nameQ = query(
        collection(db, INVENTORY_ITEMS_COLLECTION),
        where('name', '==', entry.itemName),
      );
      const nameSnap = await getDocs(nameQ);
      if (!nameSnap.empty) {
        resolvedId = nameSnap.docs[0].id;
      } else {
        const dnQ = query(
          collection(db, INVENTORY_ITEMS_COLLECTION),
          where('displayName', '==', entry.itemName),
        );
        const dnSnap = await getDocs(dnQ);
        if (!dnSnap.empty) resolvedId = dnSnap.docs[0].id;
      }
    }
    if (!resolvedId && entry.sku) {
      const skuQ = query(
        collection(db, INVENTORY_ITEMS_COLLECTION),
        where('sku', '==', entry.sku),
      );
      const skuSnap = await getDocs(skuQ);
      if (!skuSnap.empty) resolvedId = skuSnap.docs[0].id;
    }

    if (resolvedId) {
      bomUpdates[i] = resolvedId;
      resolvedBom.push({ ...entry, inventoryItemId: resolvedId });
    } else {
      resolvedBom.push(entry);
    }
  }

  // Persist resolved inventoryItemIds back to the BOM so future lookups don't need re-resolution
  if (Object.keys(bomUpdates).length > 0) {
    const updatedBom = mo.bom.map((entry, idx) =>
      bomUpdates[idx] ? { ...entry, inventoryItemId: bomUpdates[idx] } : entry,
    );
    await updateDoc(moRef, { bom: cleanArrayForFirestore(updatedBom) });
    mo.bom = updatedBom;
  }

  // Reserve materials from inventory
  const reservations: MaterialReservation[] = [];
  const shortages: Array<{ itemName: string; required: number; available: number }> = [];

  for (const bomEntry of resolvedBom) {
    // Skip non-material entries (labor, subcontracted services don't need inventory reservation)
    if (bomEntry.category === 'labor' || bomEntry.category === 'subcontracted') continue;
    // Skip entries without a valid inventory item ID (unmapped materials, etc.)
    // Offcut-backed entries are handled separately — don't reserve from inventory
    if (bomEntry.offcutId) continue;
    if (!bomEntry.inventoryItemId || bomEntry.inventoryItemId.includes(':')) continue;

    const warehouseId = bomEntry.warehouseId ?? defaultWarehouseId;
    try {
      const result = await reserveStock(
        bomEntry.inventoryItemId,
        warehouseId,
        bomEntry.sku,
        bomEntry.itemName,
        bomEntry.quantityRequired,
        moId,
        userId,
      );

      if (result.success) {
        reservations.push({
          id: `RES-${Date.now()}-${bomEntry.id}`,
          inventoryItemId: bomEntry.inventoryItemId,
          stockLevelId: result.stockLevelId,
          warehouseId,
          quantityReserved: bomEntry.quantityRequired,
          reservedAt: new Date() as any,
          reservedBy: userId,
          status: 'active',
        });
      } else {
        shortages.push({
          itemName: bomEntry.itemName,
          required: bomEntry.quantityRequired,
          available: result.availableQty,
        });
      }
    } catch (err) {
      // Item not found, not active, or family item — treat as shortage
      console.warn(`Could not reserve "${bomEntry.itemName}":`, (err as Error).message);
      shortages.push({
        itemName: bomEntry.itemName,
        required: bomEntry.quantityRequired,
        available: 0,
      });
    }
  }

  // If there are shortages, rollback ALL partial reservations to prevent phantom "out of stock"
  if (shortages.length > 0) {
    for (const res of reservations) {
      try {
        const warehouseId = res.warehouseId ?? defaultWarehouseId;
        await releaseStock(res.inventoryItemId, warehouseId, res.quantityReserved, moId, userId);
      } catch (err) {
        console.warn(`Failed to rollback reservation for ${res.inventoryItemId}:`, (err as Error).message);
      }
    }

    // Auto-generate procurement requirements for shortage items
    try {
      const availability = await checkMaterialAvailability(mo, defaultWarehouseId);
      const shortageItems = availability.items.filter(item => item.shortageQty > 0);
      if (shortageItems.length > 0) {
        await generateProcurementFromShortages(mo, shortageItems, userId);
      }
    } catch (procErr) {
      console.warn('Failed to auto-generate procurement requirements:', (procErr as Error).message);
    }

    // Keep MO in draft with NO reservations (all rolled back)
    await updateDoc(moRef, {
      status: 'draft',
      materialReservations: [],
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  } else {
    // All materials available — approve the MO with active reservations
    await updateDoc(moRef, {
      status: 'approved',
      materialReservations: reservations,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  }

  // Emit business events — non-critical, don't let failures block the approval result
  try {
    if (shortages.length > 0) {
      await emitBusinessEvent('material_shortage_detected', mo, userId, {
        shortages,
        reservedCount: reservations.length,
      });
    } else {
      await emitBusinessEvent('manufacturing_order_approved', mo, userId);
    }
  } catch (eventErr) {
    console.warn('Failed to emit business event:', (eventErr as Error).message);
  }

  return { success: shortages.length === 0, shortages };
}

/**
 * Start production (Approved → In Progress)
 * Also advances currentStage from 'queued' to 'cutting' so production actually begins.
 */
export async function startProduction(moId: string, userId: string): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('MO not found');

  const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;
  if (mo.status !== 'approved') throw new Error('MO must be approved to start production');

  const updateData: Record<string, unknown> = {
    status: 'in-progress',
    'scheduling.actualStart': serverTimestamp(),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  // Auto-advance stage from 'queued' to 'cutting' when production starts
  if (mo.currentStage === 'queued') {
    const transition: MOStageTransition = {
      fromStage: 'queued',
      toStage: 'cutting',
      transitionedAt: new Date() as any,
      transitionedBy: userId,
      notes: 'Auto-advanced on production start',
    };
    updateData.currentStage = 'cutting';
    updateData.stageEnteredAt = serverTimestamp();
    updateData.stageHistory = [...(mo.stageHistory || []), transition];
  }

  await updateDoc(moRef, updateData);
}

/**
 * Completion data for the final stage (ready) disposition
 */
export interface CompletionData {
  disposition: 'site_installation' | 'finished_goods';
  warehouseLocation?: string;
  installationNotes?: string;
  installationDate?: Date;
}

/**
 * Advance manufacturing stage
 */
export async function advanceStage(
  moId: string,
  userId: string,
  notes?: string,
  completionData?: CompletionData,
): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('MO not found');

  const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;
  if (mo.status !== 'in-progress') throw new Error('MO must be in-progress');

  const stageOrder: MOStage[] = ['queued', 'cutting', 'assembly', 'finishing', 'qc', 'ready'];
  const currentIdx = stageOrder.indexOf(mo.currentStage);
  if (currentIdx === -1 || currentIdx >= stageOrder.length - 1) {
    throw new Error('Cannot advance past final stage');
  }

  const nextStage = stageOrder[currentIdx + 1];
  const transition: MOStageTransition = {
    fromStage: mo.currentStage,
    toStage: nextStage,
    transitionedAt: new Date() as any,
    transitionedBy: userId,
    notes,
  };

  const updateData: Record<string, unknown> = {
    currentStage: nextStage,
    stageEnteredAt: serverTimestamp(),
    stageHistory: [...mo.stageHistory, transition],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  // If reaching 'ready', mark as completed with disposition
  if (nextStage === 'ready') {
    updateData.status = 'completed';
    updateData['scheduling.actualEnd'] = serverTimestamp();

    if (completionData) {
      updateData.completionDisposition = completionData.disposition;
      if (completionData.disposition === 'site_installation') {
        updateData.installationStatus = 'pending_scheduling';
        if (completionData.installationNotes) {
          updateData.installationNotes = completionData.installationNotes;
        }
        if (completionData.installationDate) {
          updateData.installationDate = completionData.installationDate;
        }
      } else if (completionData.disposition === 'finished_goods') {
        if (completionData.warehouseLocation) {
          updateData.warehouseLocation = completionData.warehouseLocation;
        }
      }
    }
  }

  await updateDoc(moRef, updateData);

  await emitBusinessEvent('manufacturing_order_stage_changed', mo, userId, {
    fromStage: mo.currentStage,
    toStage: nextStage,
  });

  if (nextStage === 'ready') {
    await emitBusinessEvent('manufacturing_order_completed', { ...mo, id: moId }, userId);

    // Mark offcuts as used now that production is complete
    const offcutBomEntries = mo.bom.filter((b: BOMEntry) => b.offcutId);
    if (offcutBomEntries.length > 0) {
      try {
        const { markOffcutUsed } = await import('@/shared/services/offcutLibraryService');
        await Promise.all(
          offcutBomEntries.map((b: BOMEntry) =>
            markOffcutUsed(b.offcutId!, mo.projectId || moId)
          )
        );
      } catch (err) {
        console.warn('Failed to mark offcuts as used on MO completion:', (err as Error).message);
      }
    }
  }
}

/**
 * Record material consumption during a manufacturing stage.
 * Each item is linked to a BOM entry for planned vs actual tracking.
 */
export async function recordMaterialConsumption(
  moId: string,
  items: Array<{
    bomEntryId: string;
    inventoryItemId: string;
    warehouseId: string;
    quantity: number;
    notes?: string;
  }>,
  userId: string,
): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('MO not found');

  const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;
  const newConsumptions: MaterialConsumption[] = [];

  for (const item of items) {
    await consumeStock(
      item.inventoryItemId,
      item.warehouseId,
      item.quantity,
      moId,
      userId,
    );

    const consumption: MaterialConsumption = {
      id: `CON-${Date.now()}-${item.bomEntryId}`,
      bomEntryId: item.bomEntryId,
      inventoryItemId: item.inventoryItemId,
      stockLevelId: '',
      warehouseId: item.warehouseId,
      quantityConsumed: item.quantity,
      unitCost: 0,
      totalCost: 0,
      consumedAt: new Date() as any,
      consumedBy: userId,
      moStage: mo.currentStage,
    };

    // Resolve unit cost from BOM entry, falling back to inventory item cost
    const bomEntry = mo.bom.find((b) => b.id === item.bomEntryId);
    let resolvedCost = bomEntry?.unitCost || 0;

    if (!resolvedCost && item.inventoryItemId) {
      try {
        const invSnap = await getDoc(doc(db, 'inventoryItems', item.inventoryItemId));
        if (invSnap.exists()) {
          resolvedCost = invSnap.data().costPerUnit || invSnap.data().unitCost || 0;
        }
      } catch (e) {
        console.warn(`[MO] Failed to fetch inventory item cost for ${item.inventoryItemId}:`, e);
      }
    }

    consumption.unitCost = resolvedCost;
    consumption.totalCost = item.quantity * resolvedCost;

    if (item.notes) consumption.notes = item.notes;

    newConsumptions.push(consumption);
  }

  await updateDoc(moRef, {
    materialConsumptions: [...mo.materialConsumptions, ...newConsumptions],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Record QC inspection
 */
export async function recordQualityCheck(
  moId: string,
  qc: QualityCheck,
  userId: string,
): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('MO not found');

  const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

  await updateDoc(moRef, {
    qualityCheck: qc,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  if (!qc.passed) {
    await emitBusinessEvent('qc_inspection_failed', mo, userId, {
      defects: qc.defects,
      notes: qc.notes,
    });
  }
}

/**
 * Put MO on hold
 */
export async function putOnHold(
  moId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, moId);
  await updateDoc(moRef, {
    status: 'on-hold',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  const mo = await getManufacturingOrder(moId);
  if (mo) {
    await emitBusinessEvent('manufacturing_order_on_hold', mo, userId, { reason });
  }
}

/**
 * Resume MO from hold
 */
export async function resumeFromHold(moId: string, userId: string): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, moId);
  await updateDoc(moRef, {
    status: 'in-progress',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Permanently delete a manufacturing order.
 * Only allowed for draft or cancelled MOs with no material consumption history.
 */
export async function deleteManufacturingOrder(
  moId: string,
  userId: string,
): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('MO not found');

  const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

  // Safety: only draft or cancelled MOs can be deleted
  const mesStatus = moSnap.data()?.mesStatus as string | undefined;
  const deletable = ['draft', 'cancelled'];
  if (!deletable.includes(mo.status) && !deletable.includes(mesStatus ?? '')) {
    throw new Error(
      `Cannot delete MO in "${mesStatus ?? mo.status}" status. Only draft or cancelled orders can be deleted.`,
    );
  }

  // Safety: cannot delete if materials have been consumed
  if (mo.materialConsumptions && mo.materialConsumptions.length > 0) {
    throw new Error(
      'Cannot delete MO with material consumption history. Cancel it instead.',
    );
  }

  // Release any active reservations before deleting
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
    } catch (err) {
      console.warn('Failed to release reservation during delete:', (err as Error).message);
    }
  }

  // If linked to a design item, clear the handover link
  if (mo.designItemId && mo.projectId) {
    try {
      const itemRef = doc(db, 'designProjects', mo.projectId, 'designItems', mo.designItemId);
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists() && itemSnap.data()?.manufacturingOrderId === moId) {
        // P7 phase 3 — clearing `manufacturingOrderId` alone flips the
        // derived handover status back to 'pending'. The previous
        // `handoverStatus: null` mirror has been removed; the derivation
        // reads the FK, not the flat field.
        await updateDoc(itemRef, {
          manufacturingOrderId: null,
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        });
      }
    } catch (err) {
      console.warn('Failed to unlink design item during MO delete:', (err as Error).message);
    }
  }

  await deleteDoc(moRef);

  await emitBusinessEvent('manufacturing_order_deleted', mo, userId);
}

/**
 * Cancel MO and release all material reservations
 */
export async function cancelManufacturingOrder(
  moId: string,
  userId: string,
  _reason: string,
): Promise<void> {
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('MO not found');

  const mo = { id: moId, ...moSnap.data() } as ManufacturingOrder;

  // Release all active reservations
  for (const reservation of mo.materialReservations) {
    if (reservation.status !== 'active') continue;
    await releaseStock(
      reservation.inventoryItemId,
      reservation.warehouseId,
      reservation.quantityReserved,
      moId,
      userId,
    );
  }

  const updatedReservations = mo.materialReservations.map((r) =>
    r.status === 'active' ? { ...r, status: 'released' as const } : r,
  );

  await updateDoc(moRef, {
    status: 'cancelled',
    materialReservations: updatedReservations,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

// ============================================
// Queries & Subscriptions
// ============================================

/**
 * Default safety cap for subscribeToManufacturingOrders. Caller may pass
 * filters.maxResults to override; filters.unbounded=true disables the cap.
 */
const DEFAULT_SUBSCRIBE_MO_LIMIT = 500;

/**
 * Subscribe to manufacturing orders with filters (real-time)
 */
export function subscribeToManufacturingOrders(
  filters: MOFilters & { subsidiaryId: string; maxResults?: number; unbounded?: boolean },
  callback: (orders: ManufacturingOrder[]) => void,
): () => void {
  const constraints: QueryConstraint[] = [
    where('subsidiaryId', '==', filters.subsidiaryId),
  ];

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length === 1) {
      constraints.push(where('status', '==', statuses[0]));
    }
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const effectiveLimit = filters.unbounded
    ? undefined
    : (filters.maxResults ?? DEFAULT_SUBSCRIBE_MO_LIMIT);
  if (effectiveLimit !== undefined) {
    constraints.push(limit(effectiveLimit));
  }

  const q = query(collection(db, MO_COLLECTION), ...constraints);

  return onSnapshot(q, (snapshot) => {
    let orders = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as ManufacturingOrder),
    );

    if (filters.search) {
      const term = filters.search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.moNumber.toLowerCase().includes(term) ||
          (o.designItemName ?? o.itemName ?? '').toLowerCase().includes(term),
      );
    }

    if (filters.projectId) {
      orders = orders.filter((o) => o.projectId === filters.projectId);
    }

    if (filters.salesOrderId) {
      orders = orders.filter((o) => o.salesOrderId === filters.salesOrderId);
    }

    if (filters.currentStage) {
      const stages = Array.isArray(filters.currentStage)
        ? filters.currentStage
        : [filters.currentStage];
      orders = orders.filter((o) => stages.includes(o.currentStage));
    }

    if (filters.batchId) {
      orders = orders.filter((o) => o.batchId === filters.batchId);
    }

    if (effectiveLimit !== undefined && snapshot.size >= effectiveLimit) {
      console.warn(
        `[manufacturing] subscribeToManufacturingOrders hit the ${effectiveLimit}-row cap. ` +
        `Pass unbounded=true or raise maxResults if intentional.`,
      );
    }

    callback(orders);
  });
}

/**
 * Subscribe to a single MO (real-time)
 */
export function subscribeToManufacturingOrder(
  moId: string,
  callback: (order: ManufacturingOrder | null) => void,
): () => void {
  const docRef = doc(db, MO_COLLECTION, moId);
  return onSnapshot(docRef, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...snap.data() } as ManufacturingOrder);
  });
}

/**
 * Get MOs linked to a specific design item
 */
export async function getMOsByDesignItem(
  designItemId: string,
): Promise<ManufacturingOrder[]> {
  const q = query(
    collection(db, MO_COLLECTION),
    where('designItemId', '==', designItemId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ManufacturingOrder));
}

// ============================================
// Parametric BOM Enrichment (Phase 5)
// ============================================

/**
 * Enrich a BOM with parametric hardware selections.
 *
 * Given project-level parametric defaults and optional design-item overrides,
 * resolves matching rules and appends the selected items/kits as new BOM entries.
 *
 * This should be called before `createManufacturingOrder()` to inject
 * parametric hardware into the BOM that will be handed over to manufacturing.
 *
 * The kit expansion (Phase 4) will then expand any kit entries during
 * availability checks and procurement.
 */
export async function enrichBomWithParametricSelections(
  bom: BOMEntry[],
  projectDefaults: import('@/modules/inventory/types/parametricMatrix').ProjectParametricDefaults,
  itemOverrides?: import('@/modules/inventory/types/parametricMatrix').DesignItemParametricOverrides,
  options?: { subsidiaryId?: string; quantity?: number },
): Promise<BOMEntry[]> {
  // Lazy import to avoid circular dependency
  const { resolveAllParametricSelections } = await import(
    '@/modules/inventory/services/parametricMatrixService'
  );

  const selections = await resolveAllParametricSelections(
    projectDefaults,
    itemOverrides,
    options?.subsidiaryId,
  );

  if (selections.length === 0) return bom;

  const qty = options?.quantity ?? 1;
  const enriched = [...bom];

  for (const selection of selections) {
    const entryQty = selection.quantityPerUnit * qty;

    enriched.push({
      id: `param-${selection.ruleId}-${Date.now()}`,
      inventoryItemId: selection.resultItemId,
      sku: selection.resultSku,
      itemName: selection.resultName,
      category: 'hardware',
      quantityRequired: entryQty,
      unit: 'ea',
      unitCost: 0, // Will be resolved from inventory during availability check
      totalCost: 0,
      notes: `Auto-selected by parametric rule: ${selection.ruleName}`,
    });
  }

  return enriched;
}

// ============================================
// Production Schedule Reordering
// ============================================

/**
 * Batch-update productionRank for manufacturing orders.
 * Same pattern as design-manager's updateDesignItemOrder().
 */
export async function updateProductionScheduleOrder(
  items: { id: string; productionRank: number }[],
): Promise<void> {
  const { writeBatch } = await import('firebase/firestore');
  const batch = writeBatch(db);

  for (const item of items) {
    const ref = doc(db, MO_COLLECTION, item.id);
    batch.update(ref, { productionRank: item.productionRank });
  }

  await batch.commit();
}
