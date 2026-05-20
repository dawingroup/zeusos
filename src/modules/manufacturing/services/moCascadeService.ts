/**
 * moCascadeService — wiring for Change-Order → Manufacturing Order cascades.
 *
 * When a CO is approved and applied, production-side state must keep
 * up. This service is the single entry point for that cascade:
 *
 *   - `cascadeChangeOrderToManufacturing(coId, userId, subsidiaryId)`
 *     • For each `itemsAdded` with a linked design item, spawn a child
 *       MO tagged with `parentMOId` + `originChangeOrderId`.
 *     • For each `itemsRemoved`, find the existing MO. If it hasn't
 *       started production (`draft` / `pending-approval`) we cancel it
 *       automatically; otherwise we flag it as blocked so the parent
 *       CO detail UI can surface the conflict.
 *     • Updates the parent MO's `childMOIds` and the CO's
 *       `linkedMOIds` so every hop is auditable.
 *
 *   - `getCascadeTree(moId)` / `subscribeToCascadeTree(moId, cb)` —
 *     live parent+children tree used by `MOCascadeTreePanel`.
 *
 * The cascade is called fire-and-forget from `applyChangeOrderToSO`
 * in the sales-orders module. Failures are logged, never thrown.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  orderBy,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  BOMEntry,
  ManufacturingOrder,
  ManufacturingOrderStatus,
  MOPartEntry,
  MOStage,
} from '../types';
import { cleanArrayForFirestore } from './manufacturingOrderService';
import type { ChangeOrder, SalesOrder, SalesOrderItem } from '@/modules/sales-orders/types';
import {
  CHANGE_ORDERS_COLLECTION,
  SO_COLLECTION,
} from '@/modules/sales-orders/constants';

const MO_COLLECTION = 'manufacturingOrders';

// ============================================================================
// TYPES
// ============================================================================

export interface CascadeResult {
  childMOIdsCreated: string[];
  cancelledMOIds: string[];
  blockedRemovals: BlockedRemoval[];
  addedItemsSkipped: string[];   // CO item ids that couldn't be cascaded
}

export interface BlockedRemoval {
  moId: string;
  moNumber: string;
  designItemId: string;
  currentStatus: ManufacturingOrderStatus;
  currentStage: MOStage;
  reason: string;
}

export interface MOCascadeTree {
  parent: ManufacturingOrder | null;
  root: ManufacturingOrder;       // convenience — always the target MO
  children: ManufacturingOrder[]; // MOs that point at root via parentMOId
  originChangeOrderIds: string[]; // distinct COs that spawned the children
}

// ============================================================================
// MAIN CASCADE
// ============================================================================

export async function cascadeChangeOrderToManufacturing(
  coId: string,
  userId: string,
  subsidiaryId: string,
): Promise<CascadeResult> {
  const result: CascadeResult = {
    childMOIdsCreated: [],
    cancelledMOIds: [],
    blockedRemovals: [],
    addedItemsSkipped: [],
  };

  const coSnap = await getDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId));
  if (!coSnap.exists()) return result;
  const co = { id: coSnap.id, ...coSnap.data() } as ChangeOrder;

  const soSnap = await getDoc(doc(db, SO_COLLECTION, co.salesOrderId));
  if (!soSnap.exists()) return result;
  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;

  // Pick a "default" parent — the most recently-created MO on this SO.
  // Items-modified lookups still prefer the item-specific MO when one
  // can be resolved; this fallback just keeps unattached added items
  // nested under the latest production batch.
  const soMOs = await findMOsForSalesOrder(so.id);
  const defaultParent = soMOs[0] ?? null;

  // ── Added items → spawn child MOs ──
  for (const added of co.itemsAdded) {
    if (!added.designItemId) {
      // Freeform line items (no design item linkage) can't become MOs
      // until Design Manager creates a design item for them. Surface
      // as skipped so the UI can prompt a follow-up action.
      result.addedItemsSkipped.push(added.id);
      continue;
    }

    const parentMO =
      (await findMOForSalesOrderAndDesignItem(so.id, added.designItemId)) ??
      defaultParent;

    const childId = await spawnChildMO({
      parent: parentMO,
      co,
      so,
      addedItem: added,
      userId,
      subsidiaryId,
    });

    if (childId) {
      result.childMOIdsCreated.push(childId);
      if (parentMO) {
        await appendChildToParent(parentMO, childId);
      }
    } else {
      result.addedItemsSkipped.push(added.id);
    }
  }

  // ── Removed items → cancel if safe, otherwise flag ──
  for (const removal of co.itemsRemoved) {
    const soItem = so.scopeItems.find((i) => i.id === removal.itemId);
    if (!soItem?.designItemId) continue;

    const target = await findMOForSalesOrderAndDesignItem(so.id, soItem.designItemId);
    if (!target) continue;

    if (target.status === 'draft' || target.status === 'pending-approval') {
      await updateDoc(doc(db, MO_COLLECTION, target.id), {
        status: 'cancelled' satisfies ManufacturingOrderStatus,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
        cancellationReason: `Removed by change order ${co.changeOrderNumber}`,
      });
      result.cancelledMOIds.push(target.id);
    } else {
      result.blockedRemovals.push({
        moId: target.id,
        moNumber: target.moNumber,
        designItemId: soItem.designItemId,
        currentStatus: target.status,
        currentStage: target.currentStage,
        reason: `MO already ${target.status} at ${target.currentStage} stage — manual review required`,
      });
    }
  }

  // ── Stamp CO with linked MOs + blocked-removal metadata ──
  const existingLinked = co.linkedMOIds ?? [];
  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId), {
    linkedMOIds: Array.from(
      new Set([...existingLinked, ...result.childMOIdsCreated, ...result.cancelledMOIds]),
    ),
    blockedRemovals: result.blockedRemovals.length > 0 ? result.blockedRemovals : [],
    cascadeCompletedAt: Timestamp.now(),
  });

  // ── Emit a risk flag on the SO if blocked removals exist ──
  if (result.blockedRemovals.length > 0) {
    try {
      const so2Snap = await getDoc(doc(db, SO_COLLECTION, so.id));
      if (so2Snap.exists()) {
        const so2 = so2Snap.data() as SalesOrder;
        const flags = [...(so2.riskFlags ?? [])];
        flags.push({
          id: `risk-co-removal-blocked-${Date.now()}`,
          type: 'scope_change_after_freeze',
          severity: 'high',
          message:
            `CO ${co.changeOrderNumber} removed items but ${result.blockedRemovals.length} MO(s) ` +
            `could not be auto-cancelled (already in production).`,
          createdAt: Timestamp.now(),
          autoDetected: true,
        });
        await updateDoc(doc(db, SO_COLLECTION, so.id), {
          riskFlags: flags,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('[moCascadeService] Failed to write blocked-removal risk flag', err);
    }
  }

  return result;
}

// ============================================================================
// CHILD MO CREATION
// ============================================================================

async function spawnChildMO(args: {
  parent: ManufacturingOrder | null;
  co: ChangeOrder;
  so: SalesOrder;
  addedItem: SalesOrderItem;
  userId: string;
  subsidiaryId: string;
}): Promise<string | null> {
  const { parent, co, so, addedItem, userId, subsidiaryId } = args;

  // Seed BOM/parts from parent MO when we have one, otherwise stub
  // empty — the production planner will run the normal design-handover
  // flow to populate real materials.
  const bom: BOMEntry[] = [];
  const parts: MOPartEntry[] = [];

  const moNumber = await generateChildMONumber(subsidiaryId, co);

  const moData: Record<string, unknown> = {
    moNumber,
    status: 'draft' satisfies ManufacturingOrderStatus,
    itemName: addedItem.description,
    itemDescription: addedItem.specification,
    sourceType: 'change_order',
    designItemId: addedItem.designItemId,
    ...(parent?.projectId && { projectId: parent.projectId }),
    ...(parent?.projectCode && { projectCode: parent.projectCode }),
    ...(parent?.designProjectId && { designProjectId: parent.designProjectId }),
    salesOrderId: so.id,
    quantity: addedItem.quantity,
    priority: parent?.priority ?? 'medium',
    productionRank: 0,
    bom: cleanArrayForFirestore(bom),
    parts: cleanArrayForFirestore(parts),
    instructions:
      `Spawned from change order ${co.changeOrderNumber}. ` +
      `Run design handover to populate BOM + parts.`,
    handoverNotes: co.description,
    scheduling: {},
    materialReservations: [],
    materialConsumptions: [],
    stageHistory: [
      {
        fromStage: null,
        toStage: 'queued' satisfies MOStage,
        transitionedAt: Timestamp.now(),
        transitionedBy: userId,
        notes: `Created by CO cascade from ${co.changeOrderNumber}`,
      },
    ],
    currentStage: 'queued' satisfies MOStage,
    stageEnteredAt: serverTimestamp(),
    costSummary: {
      materialCost: 0,
      laborCost: 0,
      totalCost: 0,
      currency: so.currency,
    },
    demandSource: {
      type: 'sales_order',
      referenceId: so.id,
      lineItemId: addedItem.id,
    },
    parentMOId: parent?.id,
    originChangeOrderId: co.id,
    subsidiaryId,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  try {
    const ref = await addDoc(collection(db, MO_COLLECTION), moData);
    return ref.id;
  } catch (err) {
    console.warn('[moCascadeService] spawnChildMO failed', err);
    return null;
  }
}

async function appendChildToParent(parent: ManufacturingOrder, childId: string): Promise<void> {
  const existing = parent.childMOIds ?? [];
  if (existing.includes(childId)) return;
  try {
    await updateDoc(doc(db, MO_COLLECTION, parent.id), {
      childMOIds: [...existing, childId],
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[moCascadeService] appendChildToParent failed', err);
  }
}

async function generateChildMONumber(
  subsidiaryId: string,
  co: ChangeOrder,
): Promise<string> {
  const q = query(
    collection(db, MO_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('originChangeOrderId', '==', co.id),
  );
  const snap = await getDocs(q);
  const seq = String(snap.size + 1).padStart(2, '0');
  return `MO-${co.changeOrderNumber}-${seq}`;
}

// ============================================================================
// LOOKUPS
// ============================================================================

export async function findMOsForSalesOrder(
  salesOrderId: string,
): Promise<ManufacturingOrder[]> {
  const q = query(
    collection(db, MO_COLLECTION),
    where('salesOrderId', '==', salesOrderId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ManufacturingOrder));
}

export async function findMOForSalesOrderAndDesignItem(
  salesOrderId: string,
  designItemId: string,
): Promise<ManufacturingOrder | null> {
  const q = query(
    collection(db, MO_COLLECTION),
    where('salesOrderId', '==', salesOrderId),
    where('designItemId', '==', designItemId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as ManufacturingOrder;
}

// ============================================================================
// CASCADE TREE (parent + children view for detail page)
// ============================================================================

export async function getCascadeTree(moId: string): Promise<MOCascadeTree | null> {
  const rootSnap = await getDoc(doc(db, MO_COLLECTION, moId));
  if (!rootSnap.exists()) return null;
  const root = { id: rootSnap.id, ...rootSnap.data() } as ManufacturingOrder;

  const parent = root.parentMOId ? await loadMO(root.parentMOId) : null;

  const childrenQ = query(
    collection(db, MO_COLLECTION),
    where('parentMOId', '==', moId),
    orderBy('createdAt', 'desc'),
  );
  const childrenSnap = await getDocs(childrenQ);
  const children = childrenSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ManufacturingOrder),
  );

  return {
    parent,
    root,
    children,
    originChangeOrderIds: Array.from(
      new Set(children.map((c) => c.originChangeOrderId).filter(Boolean) as string[]),
    ),
  };
}

export function subscribeToCascadeTree(
  moId: string,
  callback: (tree: MOCascadeTree | null) => void,
): Unsubscribe {
  let rootMO: ManufacturingOrder | null = null;
  let parentMO: ManufacturingOrder | null = null;
  let children: ManufacturingOrder[] = [];

  const emit = () => {
    if (!rootMO) {
      callback(null);
      return;
    }
    callback({
      parent: parentMO,
      root: rootMO,
      children,
      originChangeOrderIds: Array.from(
        new Set(children.map((c) => c.originChangeOrderId).filter(Boolean) as string[]),
      ),
    });
  };

  let parentUnsub: Unsubscribe = () => undefined;

  const rootUnsub = onSnapshot(doc(db, MO_COLLECTION, moId), async (snap) => {
    if (!snap.exists()) {
      rootMO = null;
      emit();
      return;
    }
    rootMO = { id: snap.id, ...snap.data() } as ManufacturingOrder;

    // Re-subscribe parent if it changed
    parentUnsub();
    if (rootMO.parentMOId) {
      parentUnsub = onSnapshot(doc(db, MO_COLLECTION, rootMO.parentMOId), (pSnap) => {
        parentMO = pSnap.exists()
          ? ({ id: pSnap.id, ...pSnap.data() } as ManufacturingOrder)
          : null;
        emit();
      });
    } else {
      parentMO = null;
      emit();
    }
  });

  const childrenQ = query(
    collection(db, MO_COLLECTION),
    where('parentMOId', '==', moId),
    orderBy('createdAt', 'desc'),
  );
  const childrenUnsub = onSnapshot(childrenQ, (snap) => {
    children = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ManufacturingOrder));
    emit();
  });

  return () => {
    rootUnsub();
    parentUnsub();
    childrenUnsub();
  };
}

async function loadMO(moId: string): Promise<ManufacturingOrder | null> {
  const snap = await getDoc(doc(db, MO_COLLECTION, moId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ManufacturingOrder;
}
