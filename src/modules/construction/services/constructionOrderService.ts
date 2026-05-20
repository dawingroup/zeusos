/**
 * Construction Order Service
 *
 * CRUD + lifecycle transitions for ConstructionOrder documents. Mirrors
 * the shape of `manufacturingOrderService` — the source of truth for CO
 * state is its Firestore doc under `constructionOrders/{coId}`.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ConstructionOrder,
  COStage,
  COStageTransition,
  ConstructionOrderStatus,
  ConstructionSnag,
} from '../types';
import { CO_STAGES } from '../types';

export const CONSTRUCTION_ORDERS_COLLECTION = 'constructionOrders';
const DESIGN_PROJECTS_COLLECTION = 'designProjects';
const DESIGN_ITEMS_SUBCOLLECTION = 'designItems';

// ============================================
// Helpers
// ============================================

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item !== null && typeof item === 'object' && !(item instanceof Date)
          ? stripUndefined(item as Record<string, unknown>)
          : item,
      );
    } else if (
      value !== null &&
      typeof value === 'object' &&
      !(value instanceof Date) &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      result[key] = stripUndefined(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

// ============================================
// Read helpers
// ============================================

export async function getConstructionOrder(
  coId: string,
): Promise<ConstructionOrder | null> {
  const snap = await getDoc(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ConstructionOrder;
}

export function subscribeToConstructionOrder(
  coId: string,
  callback: (co: ConstructionOrder | null) => void,
): () => void {
  return onSnapshot(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...snap.data() } as ConstructionOrder);
  });
}

export function subscribeToConstructionOrders(
  callback: (orders: ConstructionOrder[]) => void,
  filters?: { status?: ConstructionOrderStatus; projectId?: string },
): () => void {
  const constraints = [] as Parameters<typeof query>[1][];
  if (filters?.status) constraints.push(where('status', '==', filters.status));
  if (filters?.projectId) constraints.push(where('projectId', '==', filters.projectId));
  constraints.push(orderBy('createdAt', 'desc'));
  const q = query(collection(db, CONSTRUCTION_ORDERS_COLLECTION), ...constraints);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ConstructionOrder));
  });
}

export async function listConstructionOrdersForProject(
  projectId: string,
): Promise<ConstructionOrder[]> {
  const q = query(
    collection(db, CONSTRUCTION_ORDERS_COLLECTION),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ConstructionOrder);
}

// ============================================
// Stage transitions
// ============================================

/**
 * Advance (or move) a CO to a target stage. Stamps the appropriate
 * execution timestamp and back-propagates to the linked DesignItem:
 *
 *   mobilisation → execution : stamp siteHandoverAt + kickoffAt;
 *                              DesignItem → const-in-progress.
 *   execution    → qc        : stamp inspectionPassedAt (inspection starts);
 *                              DesignItem → const-inspection.
 *   qc           → handover  : (stage only; signoff stamped separately).
 *
 * Final completion (DesignItem → const-complete) is handled when the
 * `construction-signoff` approval lands + `execution.signoffAt` is
 * stamped — not purely from stage movement.
 */
export async function transitionCOStage(
  coId: string,
  targetStage: COStage,
  userId: string,
  notes?: string,
): Promise<void> {
  const co = await getConstructionOrder(coId);
  if (!co) throw new Error('Construction Order not found');

  const now = Timestamp.now();
  const transition: COStageTransition = {
    fromStage: co.currentStage,
    toStage: targetStage,
    at: now,
    by: userId,
    notes,
  };

  const execution = { ...(co.execution || {}) };
  let derivedStatus: ConstructionOrderStatus = co.status;

  if (co.currentStage === 'mobilisation' && targetStage === 'execution') {
    if (!execution.siteHandoverAt) {
      execution.siteHandoverAt = now;
      execution.siteHandoverBy = userId;
    }
    if (!execution.kickoffAt) {
      execution.kickoffAt = now;
      execution.kickoffBy = userId;
    }
    derivedStatus = 'in-progress';
  } else if (co.currentStage === 'execution' && targetStage === 'qc') {
    if (!execution.inspectionPassedAt) {
      execution.inspectionPassedAt = now;
      execution.inspectedBy = userId;
    }
  } else if (targetStage === 'handover') {
    // Handover stage reached — sign-off is a separate action.
  }

  await updateDoc(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId), stripUndefined({
    currentStage: targetStage,
    status: derivedStatus,
    stageHistory: [...(co.stageHistory || []), transition],
    execution,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  // Back-propagate to DesignItem — derivation reads CO.currentStage via
  // `deriveConstructionStatus`, but for UX we also push the DesignItem
  // stage forward so the project-level overview lights up correctly.
  try {
    const itemRef = doc(
      db,
      DESIGN_PROJECTS_COLLECTION,
      co.projectId,
      DESIGN_ITEMS_SUBCOLLECTION,
      co.designItemId,
    );
    let nextDesignStage: string | null = null;
    if (targetStage === 'execution') nextDesignStage = 'const-in-progress';
    else if (targetStage === 'qc') nextDesignStage = 'const-inspection';
    // `const-complete` is only reached once the construction-signoff
    // approval lands — handled by `markSignoff`.
    if (nextDesignStage) {
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        const existing = itemSnap.data();
        const stageHistory = Array.isArray(existing.stageHistory) ? existing.stageHistory : [];
        await updateDoc(itemRef, stripUndefined({
          currentStage: nextDesignStage,
          stageEnteredAt: serverTimestamp(),
          stageHistory: [
            ...stageHistory,
            {
              fromStage: existing.currentStage,
              toStage: nextDesignStage,
              transitionedAt: now,
              transitionedBy: userId,
              notes: `[CO ${co.coNumber}] ${notes || `CO moved to ${targetStage}`}`,
            },
          ],
          updatedAt: serverTimestamp(),
          updatedBy: userId,
        }));
      }
    }
  } catch (err) {
    // Non-fatal — CO progressed but DesignItem wasn't found/updated.
    // eslint-disable-next-line no-console
    console.warn('[constructionOrderService] Could not back-propagate CO stage to DesignItem', err);
  }
}

export function getNextCOStage(current: COStage): COStage | null {
  const idx = CO_STAGES.indexOf(current);
  if (idx < 0 || idx >= CO_STAGES.length - 1) return null;
  return CO_STAGES[idx + 1];
}

// ============================================
// Signoff / completion
// ============================================

/**
 * Stamp `execution.signoffAt` on the CO. Typically called after a
 * `construction-signoff` approval is approved. Also flips the CO status
 * to 'completed' and the DesignItem stage to 'const-complete' (where
 * the `construction-signoff` approval gate is enforced on the way in).
 */
export async function markSignoff(
  coId: string,
  userId: string,
  notes?: string,
): Promise<void> {
  const co = await getConstructionOrder(coId);
  if (!co) throw new Error('Construction Order not found');

  const now = Timestamp.now();
  const execution = {
    ...(co.execution || {}),
    signoffAt: now,
    signedOffBy: userId,
    completedAt: now,
    completedBy: userId,
  };

  await updateDoc(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId), stripUndefined({
    currentStage: 'handover' as COStage,
    status: 'completed' as ConstructionOrderStatus,
    execution,
    stageHistory: [
      ...(co.stageHistory || []),
      {
        fromStage: co.currentStage,
        toStage: 'handover' as COStage,
        at: now,
        by: userId,
        notes: notes || 'Final signoff recorded',
      },
    ],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  // Advance DesignItem to const-complete.
  try {
    const itemRef = doc(
      db,
      DESIGN_PROJECTS_COLLECTION,
      co.projectId,
      DESIGN_ITEMS_SUBCOLLECTION,
      co.designItemId,
    );
    const itemSnap = await getDoc(itemRef);
    if (itemSnap.exists()) {
      const existing = itemSnap.data();
      const stageHistory = Array.isArray(existing.stageHistory) ? existing.stageHistory : [];
      await updateDoc(itemRef, stripUndefined({
        currentStage: 'const-complete',
        stageEnteredAt: serverTimestamp(),
        stageHistory: [
          ...stageHistory,
          {
            fromStage: existing.currentStage,
            toStage: 'const-complete',
            transitionedAt: now,
            transitionedBy: userId,
            notes: `[CO ${co.coNumber}] Final signoff`,
          },
        ],
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      }));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[constructionOrderService] Could not advance DesignItem to const-complete', err);
  }
}

// ============================================
// Snag list
// ============================================

export async function addSnag(
  coId: string,
  snag: Omit<ConstructionSnag, 'id' | 'raisedAt' | 'raisedBy'>,
  userId: string,
): Promise<void> {
  const co = await getConstructionOrder(coId);
  if (!co) throw new Error('Construction Order not found');
  const now = Timestamp.now();
  const next: ConstructionSnag = {
    ...snag,
    id: `snag-${Date.now()}`,
    raisedAt: now,
    raisedBy: userId,
  };
  const list = [...(co.execution?.snagList || []), next];
  await updateDoc(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId), {
    'execution.snagList': list,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function resolveSnag(
  coId: string,
  snagId: string,
  userId: string,
  notes?: string,
): Promise<void> {
  const co = await getConstructionOrder(coId);
  if (!co) throw new Error('Construction Order not found');
  const now = Timestamp.now();
  const list = (co.execution?.snagList || []).map((s) =>
    s.id === snagId ? { ...s, resolvedAt: now, resolvedBy: userId, resolutionNotes: notes } : s,
  );
  await updateDoc(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId), stripUndefined({
    execution: { ...(co.execution || {}), snagList: list },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));
}

// ============================================
// Status + delete
// ============================================

export async function putCOOnHold(coId: string, userId: string, reason?: string) {
  const co = await getConstructionOrder(coId);
  if (!co) return;
  await updateDoc(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId), stripUndefined({
    status: 'on-hold',
    stageHistory: [
      ...(co.stageHistory || []),
      {
        fromStage: co.currentStage,
        toStage: co.currentStage,
        at: Timestamp.now(),
        by: userId,
        notes: `On hold${reason ? `: ${reason}` : ''}`,
      },
    ],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));
}

export async function resumeCO(coId: string, userId: string) {
  const co = await getConstructionOrder(coId);
  if (!co) return;
  await updateDoc(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId), {
    status: co.currentStage === 'mobilisation' ? 'released' : 'in-progress',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function cancelCO(coId: string, userId: string, reason?: string) {
  const co = await getConstructionOrder(coId);
  if (!co) return;
  await updateDoc(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId), stripUndefined({
    status: 'cancelled',
    stageHistory: [
      ...(co.stageHistory || []),
      {
        fromStage: co.currentStage,
        toStage: co.currentStage,
        at: Timestamp.now(),
        by: userId,
        notes: `Cancelled${reason ? `: ${reason}` : ''}`,
      },
    ],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));
}

export async function deleteConstructionOrder(coId: string) {
  await deleteDoc(doc(db, CONSTRUCTION_ORDERS_COLLECTION, coId));
}
