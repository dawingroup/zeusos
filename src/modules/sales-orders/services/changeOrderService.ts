/**
 * Change Order Service
 * CRUD, state machine, approval history, apply to SO, CRM propagation.
 *
 * State machine (see `CO_STATUS_TRANSITIONS` in constants):
 *   draft → pending_internal → pending_client → approved
 *                           ↘ approved (when client approval not required)
 *                           ↘ rejected
 *         ↘ pending_client (when internal approval not required)
 *         ↘ withdrawn
 *
 * Every transition writes a row to
 *   `changeOrders/{coId}/approvalEvents/{eventId}`
 * so the full approval trail is auditable regardless of channel
 * (internal dashboard, client portal, WhatsApp button, email link).
 *
 * When a CO becomes `approved`, its item changes are applied to the
 * parent SO (`applyChangeOrderToSO`). Manufacturing cascade is Phase 4
 * and is intentionally not wired here yet.
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  ChangeOrder,
  ChangeOrderStatus,
  ChangeOrderApprovalEvent,
  ChangeOrderApprovalAction,
  ChangeOrderApprovalChannel,
  SalesOrder,
  SendVia,
} from '../types';
import type { CreateChangeOrderInput } from '../schemas';
import {
  CHANGE_ORDERS_COLLECTION,
  CHANGE_ORDER_APPROVAL_EVENTS_SUBCOLLECTION,
  CO_STATUS_TRANSITIONS,
  CO_OPEN_STATUSES,
  SO_COLLECTION,
} from '../constants';
import { logActivity } from '@/modules/crm/services/crmActivityService';
import type { CRMActivityType, DealChangeOrderSummary } from '@/modules/crm/types';
import { CRM_DEALS_COLLECTION } from '@/modules/crm/constants/crm.constants';
import { deepStripUndefined } from '@/subsidiaries/advisory/core/firebase/converters';

// ============================================================================
// AUTO-NUMBERING
// ============================================================================

async function generateCONumber(soNumber: string): Promise<string> {
  const q = query(
    collection(db, CHANGE_ORDERS_COLLECTION),
    where('salesOrderId', '!=', ''),
  );
  const snap = await getDocs(q);
  const nextNum = snap.size + 1;
  return `CO-${soNumber}-${String(nextNum).padStart(3, '0')}`;
}

// ============================================================================
// STATE MACHINE HELPERS
// ============================================================================

export class InvalidChangeOrderTransitionError extends Error {
  constructor(
    public readonly from: ChangeOrderStatus,
    public readonly to: ChangeOrderStatus,
  ) {
    super(
      `Invalid change-order transition: ${from} → ${to}. ` +
        `Allowed targets from ${from}: ${CO_STATUS_TRANSITIONS[from].join(', ') || '(none — terminal)'}`,
    );
    this.name = 'InvalidChangeOrderTransitionError';
  }
}

function assertTransitionAllowed(
  from: ChangeOrderStatus,
  to: ChangeOrderStatus,
): void {
  const allowed = CO_STATUS_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new InvalidChangeOrderTransitionError(from, to);
  }
}

async function writeApprovalEvent(
  coId: string,
  event: Omit<ChangeOrderApprovalEvent, 'id' | 'changeOrderId' | 'createdAt'>,
): Promise<string> {
  const eventsRef = collection(
    db,
    CHANGE_ORDERS_COLLECTION,
    coId,
    CHANGE_ORDER_APPROVAL_EVENTS_SUBCOLLECTION,
  );
  const docRef = await addDoc(eventsRef, deepStripUndefined({
    ...event,
    changeOrderId: coId,
    createdAt: Timestamp.now(),
  }));
  return docRef.id;
}

// ============================================================================
// CRUD
// ============================================================================

export async function createChangeOrder(
  input: CreateChangeOrderInput,
  userId: string,
  subsidiaryId: string,
  userName?: string,
): Promise<string> {
  const soRef = doc(db, SO_COLLECTION, input.salesOrderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error('Sales order not found');

  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;
  const coNumber = await generateCONumber(so.orderNumber);

  // Calculate price impact
  const addedTotal = input.itemsAdded.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const removedTotal = input.itemsRemoved.reduce((sum, item) => sum + item.amount, 0);
  const modifiedTotal = input.itemsModified.reduce(
    (sum, item) => sum + item.priceImpact,
    0,
  );
  const negotiatedAdjustment = input.negotiatedPriceAdjustment ?? 0;
  const priceImpact = addedTotal - removedTotal + modifiedTotal + negotiatedAdjustment;

  const now = Timestamp.now();

  const coData: Omit<ChangeOrder, 'id'> = {
    subsidiaryId,
    salesOrderId: input.salesOrderId,
    changeOrderNumber: coNumber,
    type: input.type,
    title: input.title,
    description: input.description,
    reason: input.reason,
    ...(input.negotiatedAdjustmentNote?.trim()
      ? { negotiatedAdjustmentNote: input.negotiatedAdjustmentNote.trim() }
      : {}),
    requestedBy: input.requestedBy,
    negotiatedPriceAdjustment: negotiatedAdjustment,
    priceImpact,
    previousOrderTotal: so.currentAmount,
    newOrderTotal: so.currentAmount + priceImpact,
    itemsAdded: input.itemsAdded.map((item, idx) => ({
      id: `co-item-${Date.now()}-${idx}`,
      lineNumber: so.scopeItems.length + idx + 1,
      description: item.description,
      specification: item.specification,
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      unitPrice: item.unitPrice,
      totalPrice: item.quantity * item.unitPrice,
      category: item.category,
      fromQuoteVersion: so.scopeVersion,
      addedByChangeOrder: coNumber,
      isActive: true,
    })),
    itemsRemoved: input.itemsRemoved,
    itemsModified: input.itemsModified.map((m) => ({
      itemId: m.itemId ?? '',
      field: m.field ?? '',
      oldValue: m.oldValue ?? '',
      newValue: m.newValue ?? '',
      priceImpact: m.priceImpact,
    })),
    deliveryDateImpact: input.deliveryDateImpact,
    status: 'draft',
    internalApprovalRequired: input.internalApprovalRequired,
    clientApprovalRequired: input.clientApprovalRequired,
    isPostScopeFreeze: so.scopeFrozen,
    scopeVersionBefore: so.scopeVersion,
    scopeVersionAfter: so.scopeVersion + 1,
    linkedMOIds: [],
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
  };

  const docRef = await addDoc(collection(db, CHANGE_ORDERS_COLLECTION), deepStripUndefined(coData));

  // Seed the audit trail with the creation event
  await writeApprovalEvent(docRef.id, {
    action: 'created',
    fromStatus: null,
    toStatus: 'draft',
    channel: 'internal',
    actorId: userId,
    actorName: userName,
    notes: `Change order ${coNumber} created — ${input.type}`,
  });

  // Update SO with reference, pending count, and post-freeze risk flag
  const riskFlags = [...so.riskFlags];
  if (so.scopeFrozen) {
    riskFlags.push({
      id: `risk-co-freeze-${Date.now()}`,
      type: 'scope_change_after_freeze',
      severity: 'critical',
      message: `Change order ${coNumber} created after scope freeze`,
      createdAt: now,
      autoDetected: true,
    });
  }

  await updateDoc(soRef, {
    changeOrders: [...so.changeOrders, docRef.id],
    pendingChangeOrders: so.pendingChangeOrders + 1,
    riskFlags,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // CRM side-effects (best-effort; do not fail CO creation if they error)
  await propagateToCRM({
    so,
    coNumber,
    coId: docRef.id,
    activityType: 'change_order_requested',
    activityTitle: `Change order ${coNumber} requested`,
    activityDescription: input.title,
    userId,
    userName,
  });
  await refreshDealCOSummary(so);

  return docRef.id;
}

/**
 * Update a draft change order in place. Used by the wizard's edit-mode
 * when a user re-opens an existing draft CO to continue working on it.
 *
 * Only callable on CO status === 'draft'; anything else must go through
 * the state-machine helpers. Recomputes `priceImpact` and
 * `newOrderTotal` from the incoming inputs so the denorms stay in sync.
 *
 * Does not write an approval event — updating an in-flight draft is not
 * a state transition. The CO's `updatedAt / updatedBy` metadata is the
 * audit trail for content churn.
 */
export async function updateChangeOrderDraft(
  coId: string,
  input: CreateChangeOrderInput,
  userId: string,
  userName?: string,
): Promise<void> {
  const existing = await getChangeOrder(coId);
  if (!existing) throw new Error('Change order not found');
  if (existing.status !== 'draft') {
    throw new Error(
      `Cannot edit a change order in ${existing.status} status — use the state-machine actions instead.`,
    );
  }

  const soRef = doc(db, SO_COLLECTION, input.salesOrderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error('Sales order not found');
  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;

  const addedTotal = input.itemsAdded.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const removedTotal = input.itemsRemoved.reduce((sum, item) => sum + item.amount, 0);
  const modifiedTotal = input.itemsModified.reduce(
    (sum, item) => sum + item.priceImpact,
    0,
  );
  const negotiatedAdjustment = input.negotiatedPriceAdjustment ?? 0;
  const priceImpact = addedTotal - removedTotal + modifiedTotal + negotiatedAdjustment;

  const now = Timestamp.now();

  const patch: Partial<ChangeOrder> = {
    type: input.type,
    title: input.title,
    description: input.description,
    reason: input.reason,
    ...(input.negotiatedAdjustmentNote?.trim()
      ? { negotiatedAdjustmentNote: input.negotiatedAdjustmentNote.trim() }
      : {}),
    requestedBy: input.requestedBy,
    negotiatedPriceAdjustment: negotiatedAdjustment,
    priceImpact,
    previousOrderTotal: so.currentAmount,
    newOrderTotal: so.currentAmount + priceImpact,
    itemsAdded: input.itemsAdded.map((item, idx) => ({
      id: `co-item-${Date.now()}-${idx}`,
      lineNumber: so.scopeItems.length + idx + 1,
      description: item.description,
      specification: item.specification,
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      unitPrice: item.unitPrice,
      totalPrice: item.quantity * item.unitPrice,
      category: item.category,
      fromQuoteVersion: so.scopeVersion,
      addedByChangeOrder: existing.changeOrderNumber,
      isActive: true,
    })),
    itemsRemoved: input.itemsRemoved,
    itemsModified: input.itemsModified.map((m) => ({
      itemId: m.itemId ?? '',
      field: m.field ?? '',
      oldValue: m.oldValue ?? '',
      newValue: m.newValue ?? '',
      priceImpact: m.priceImpact,
    })),
    deliveryDateImpact: input.deliveryDateImpact,
    internalApprovalRequired: input.internalApprovalRequired,
    clientApprovalRequired: input.clientApprovalRequired,
    updatedAt: now,
  };

  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId), deepStripUndefined({
    ...patch,
    updatedBy: userId,
  }));

  // Keep the deal's CO denorm fresh — `pendingValue` tracks open
  // drafts, so an edit can shift the pending roll-up even without a
  // state transition.
  await refreshDealCOSummary(so);

  // Best-effort CRM log — lets sales see ongoing edit activity on the
  // deal timeline without needing to open the SO.
  await propagateToCRM({
    so,
    coNumber: existing.changeOrderNumber,
    coId,
    activityType: 'change_order_requested',
    activityTitle: `Draft ${existing.changeOrderNumber} updated`,
    activityDescription: input.title,
    userId,
    userName,
  });
}

export async function getChangeOrder(coId: string): Promise<ChangeOrder | null> {
  const snap = await getDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ChangeOrder;
}

export async function getChangeOrdersForSO(salesOrderId: string): Promise<ChangeOrder[]> {
  const q = query(
    collection(db, CHANGE_ORDERS_COLLECTION),
    where('salesOrderId', '==', salesOrderId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChangeOrder));
}

export async function getApprovalEvents(
  coId: string,
): Promise<ChangeOrderApprovalEvent[]> {
  const q = query(
    collection(db, CHANGE_ORDERS_COLLECTION, coId, CHANGE_ORDER_APPROVAL_EVENTS_SUBCOLLECTION),
    orderBy('createdAt', 'asc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChangeOrderApprovalEvent));
}

// ============================================================================
// STATE TRANSITIONS — ENTRY POINTS
// ============================================================================

/**
 * Submit a draft CO for internal approval.
 * draft → pending_internal
 */
export async function submitForInternalApproval(
  coId: string,
  userId: string,
  userName?: string,
  notes?: string,
): Promise<void> {
  const co = await getChangeOrder(coId);
  if (!co) throw new Error('Change order not found');

  assertTransitionAllowed(co.status, 'pending_internal');

  const now = Timestamp.now();
  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId), {
    status: 'pending_internal' satisfies ChangeOrderStatus,
    submittedForInternalAt: now,
    submittedForInternalBy: userId,
    updatedAt: now,
  });

  await writeApprovalEvent(coId, {
    action: 'submitted_for_internal',
    fromStatus: co.status,
    toStatus: 'pending_internal',
    channel: 'internal',
    actorId: userId,
    actorName: userName,
    notes,
  });
}

/**
 * Send CO to client for approval via one or more channels.
 * Valid from: draft (if internal approval not required) or pending_internal.
 */
export async function submitToClient(
  coId: string,
  userId: string,
  channels: SendVia[],
  userName?: string,
  notes?: string,
): Promise<void> {
  const co = await getChangeOrder(coId);
  if (!co) throw new Error('Change order not found');

  assertTransitionAllowed(co.status, 'pending_client');

  const now = Timestamp.now();
  const existingVias = co.sentToClientVia ?? [];
  const mergedVias = Array.from(new Set([...existingVias, ...channels]));

  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId), {
    status: 'pending_client' satisfies ChangeOrderStatus,
    submittedToClientAt: now,
    submittedToClientBy: userId,
    sentToClientVia: mergedVias,
    updatedAt: now,
  });

  await writeApprovalEvent(coId, {
    action: 'submitted_to_client',
    fromStatus: co.status,
    toStatus: 'pending_client',
    channel: 'internal',
    actorId: userId,
    actorName: userName,
    notes: notes ?? `Sent via ${channels.join(', ')}`,
    rawMetadata: { channels: channels.join(',') },
  });

  // CRM: log that CO went out to client
  const so = await loadSO(co.salesOrderId);
  if (so) {
    await propagateToCRM({
      so,
      coNumber: co.changeOrderNumber,
      coId,
      activityType: 'change_order_submitted_to_client',
      activityTitle: `Change order ${co.changeOrderNumber} sent to client`,
      activityDescription: `Delivered via ${channels.join(', ')}`,
      userId,
      userName,
    });
    await refreshDealCOSummary(so);
  }
}

/**
 * Approve a CO. `approvalType` selects which gate is being satisfied;
 * `channel` captures how the approval arrived (portal click, WhatsApp
 * button, in-person signature, etc.). The CO may land on `approved`
 * immediately or on `pending_client` depending on which gates remain.
 *
 * Kept backwards-compatible with the original two-arg form used by
 * existing callers (ChangeOrderDetailPage).
 */
export async function approveChangeOrder(
  coId: string,
  approvalType: 'internal' | 'client',
  userId: string,
  evidence?: string,
  options?: {
    channel?: ChangeOrderApprovalChannel;
    userName?: string;
    notes?: string;
    evidenceType?: ChangeOrderApprovalEvent['evidenceType'];
    rawMetadata?: Record<string, string | number | boolean>;
  },
): Promise<void> {
  const co = await getChangeOrder(coId);
  if (!co) throw new Error('Change order not found');

  const now = Timestamp.now();
  const updates: Partial<ChangeOrder> = { updatedAt: now };

  let toStatus: ChangeOrderStatus;

  if (approvalType === 'internal') {
    updates.internalApprovedBy = userId;
    updates.internalApprovedAt = now;
    toStatus = co.clientApprovalRequired ? 'pending_client' : 'approved';
  } else {
    updates.clientApprovedAt = now;
    if (evidence !== undefined) updates.clientApprovalEvidence = evidence;
    // If internal approval wasn't required, or was already recorded, CO is fully approved
    toStatus = (!co.internalApprovalRequired || co.internalApprovedBy)
      ? 'approved'
      : 'pending_internal';
  }

  assertTransitionAllowed(co.status, toStatus);
  updates.status = toStatus;

  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId), updates);

  await writeApprovalEvent(coId, {
    action: approvalType === 'internal' ? 'internal_approved' : 'client_approved',
    fromStatus: co.status,
    toStatus,
    channel: options?.channel ?? (approvalType === 'internal' ? 'internal' : 'portal'),
    actorId: userId,
    actorName: options?.userName,
    notes: options?.notes,
    evidence,
    evidenceType: options?.evidenceType,
    rawMetadata: options?.rawMetadata,
  });

  // Terminal: apply item changes to the SO
  if (toStatus === 'approved') {
    await applyChangeOrderToSO(coId, userId);
    const soAfter = await loadSO(co.salesOrderId);
    if (soAfter) {
      await propagateToCRM({
        so: soAfter,
        coNumber: co.changeOrderNumber,
        coId,
        activityType: 'change_order_approved',
        activityTitle: `Change order ${co.changeOrderNumber} approved`,
        activityDescription:
          approvalType === 'client'
            ? `Client approved via ${options?.channel ?? 'portal'}`
            : 'Internally approved',
        userId,
        userName: options?.userName,
      });
      await refreshDealCOSummary(soAfter);
    }
  }
}

/**
 * Reject a CO. Accepts optional `approvalType` and `channel` so client-
 * side rejections (via portal/WhatsApp) are attributed correctly.
 */
export async function rejectChangeOrder(
  coId: string,
  userId: string,
  reason: string,
  options?: {
    approvalType?: 'internal' | 'client';
    channel?: ChangeOrderApprovalChannel;
    userName?: string;
    evidence?: string;
    evidenceType?: ChangeOrderApprovalEvent['evidenceType'];
    rawMetadata?: Record<string, string | number | boolean>;
  },
): Promise<void> {
  const co = await getChangeOrder(coId);
  if (!co) throw new Error('Change order not found');

  assertTransitionAllowed(co.status, 'rejected');

  const now = Timestamp.now();
  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId), {
    status: 'rejected' satisfies ChangeOrderStatus,
    rejectionReason: reason,
    rejectedBy: userId,
    rejectedAt: now,
    updatedAt: now,
  });

  await writeApprovalEvent(coId, {
    action: options?.approvalType === 'client' ? 'client_rejected' : 'internal_rejected',
    fromStatus: co.status,
    toStatus: 'rejected',
    channel: options?.channel ?? (options?.approvalType === 'client' ? 'portal' : 'internal'),
    actorId: userId,
    actorName: options?.userName,
    notes: reason,
    evidence: options?.evidence,
    evidenceType: options?.evidenceType,
    rawMetadata: options?.rawMetadata,
  });

  // Decrement pending count on SO
  const so = await loadSO(co.salesOrderId);
  if (so) {
    const soRef = doc(db, SO_COLLECTION, so.id);
    await updateDoc(soRef, {
      pendingChangeOrders: Math.max(0, so.pendingChangeOrders - 1),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });

    await propagateToCRM({
      so,
      coNumber: co.changeOrderNumber,
      coId,
      activityType: 'change_order_rejected',
      activityTitle: `Change order ${co.changeOrderNumber} rejected`,
      activityDescription: reason,
      userId,
      userName: options?.userName,
    });
    await refreshDealCOSummary(so);
  }
}

/**
 * Withdraw a CO before it reaches a terminal state. Used when the
 * requester (client or internal) rescinds the request.
 */
export async function withdrawChangeOrder(
  coId: string,
  userId: string,
  reason: string,
  options?: {
    userName?: string;
    channel?: ChangeOrderApprovalChannel;
  },
): Promise<void> {
  const co = await getChangeOrder(coId);
  if (!co) throw new Error('Change order not found');

  assertTransitionAllowed(co.status, 'withdrawn');

  const now = Timestamp.now();
  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId), {
    status: 'withdrawn' satisfies ChangeOrderStatus,
    withdrawnAt: now,
    withdrawnBy: userId,
    withdrawnReason: reason,
    updatedAt: now,
  });

  await writeApprovalEvent(coId, {
    action: 'withdrawn',
    fromStatus: co.status,
    toStatus: 'withdrawn',
    channel: options?.channel ?? 'internal',
    actorId: userId,
    actorName: options?.userName,
    notes: reason,
  });

  // Decrement pending count on SO if the CO was open
  const so = await loadSO(co.salesOrderId);
  if (so) {
    if (CO_OPEN_STATUSES.includes(co.status)) {
      await updateDoc(doc(db, SO_COLLECTION, so.id), {
        pendingChangeOrders: Math.max(0, so.pendingChangeOrders - 1),
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      });
    }
    await propagateToCRM({
      so,
      coNumber: co.changeOrderNumber,
      coId,
      activityType: 'change_order_withdrawn',
      activityTitle: `Change order ${co.changeOrderNumber} withdrawn`,
      activityDescription: reason,
      userId,
      userName: options?.userName,
    });
    await refreshDealCOSummary(so);
  }
}

/**
 * @deprecated — prefer the named transition helpers
 * (`submitForInternalApproval`, `submitToClient`, `approveChangeOrder`,
 * `rejectChangeOrder`, `withdrawChangeOrder`). Kept for one release so
 * callers that hand-roll status changes keep working; validates the
 * transition and writes an audit event.
 */
export async function advanceChangeOrderStatus(
  coId: string,
  targetStatus: ChangeOrderStatus,
  userId: string,
): Promise<void> {
  const co = await getChangeOrder(coId);
  if (!co) throw new Error('Change order not found');

  assertTransitionAllowed(co.status, targetStatus);

  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId), {
    status: targetStatus,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await writeApprovalEvent(coId, {
    action: mapStatusToAction(targetStatus),
    fromStatus: co.status,
    toStatus: targetStatus,
    channel: 'internal',
    actorId: userId,
    notes: 'Status advanced via legacy helper',
  });
}

function mapStatusToAction(status: ChangeOrderStatus): ChangeOrderApprovalAction {
  switch (status) {
    case 'pending_internal':
      return 'submitted_for_internal';
    case 'pending_client':
      return 'submitted_to_client';
    case 'approved':
      return 'client_approved';
    case 'rejected':
      return 'internal_rejected';
    case 'withdrawn':
      return 'withdrawn';
    default:
      return 'created';
  }
}

// ============================================================================
// APPLY CHANGE ORDER TO SO
// ============================================================================

async function applyChangeOrderToSO(coId: string, userId: string): Promise<void> {
  const co = await getChangeOrder(coId);
  if (!co) throw new Error('Change order not found');

  const soRef = doc(db, SO_COLLECTION, co.salesOrderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error('Sales order not found');

  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;

  // Apply item changes
  let scopeItems = [...so.scopeItems];

  // Add new items
  for (const item of co.itemsAdded) {
    scopeItems.push(item);
  }

  // Remove items
  for (const removal of co.itemsRemoved) {
    scopeItems = scopeItems.map((item) =>
      item.id === removal.itemId
        ? { ...item, isActive: false, removedByChangeOrder: co.changeOrderNumber }
        : item,
    );
  }

  // Modify items
  for (const mod of co.itemsModified) {
    scopeItems = scopeItems.map((item) => {
      if (item.id !== mod.itemId) return item;
      // Apply field-level change
      const updated = { ...item };
      if (mod.field === 'quantity') updated.quantity = Number(mod.newValue);
      if (mod.field === 'unitPrice') updated.unitPrice = Number(mod.newValue);
      if (mod.field === 'description') updated.description = mod.newValue;
      if (mod.field === 'specification') updated.specification = mod.newValue;
      updated.totalPrice = updated.quantity * updated.unitPrice;
      return updated;
    });
  }

  const newScopeVersion = so.scopeVersion + 1;
  const currentAmount = Math.max(0, so.currentAmount + co.priceImpact);
  const totalChangeOrderValue = so.totalChangeOrderValue + co.priceImpact;

  // Invalidate design sign-off gate if it was already approved
  const updatedGates = { ...so.gates };
  if (updatedGates.designSignOff.status === 'approved') {
    updatedGates.designSignOff = {
      ...updatedGates.designSignOff,
      status: 'not_started',
      notes: `Invalidated by change order ${co.changeOrderNumber} — scope version changed from ${so.scopeVersion} to ${newScopeVersion}`,
    };
  }

  const now = Timestamp.now();
  await updateDoc(soRef, {
    scopeItems,
    scopeVersion: newScopeVersion,
    currentAmount,
    totalChangeOrderValue,
    pendingChangeOrders: Math.max(0, so.pendingChangeOrders - 1),
    gates: updatedGates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Stamp the CO with the applied-at metadata
  await updateDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId), {
    appliedAt: now,
    appliedBy: userId,
  });

  await writeApprovalEvent(coId, {
    action: 'applied_to_so',
    fromStatus: 'approved',
    toStatus: 'approved',
    channel: 'internal',
    actorId: userId,
    notes: `Scope v${so.scopeVersion} → v${newScopeVersion}; new SO total ${currentAmount}`,
  });

  // Best-effort: re-estimate design item costs on the linked project so
  // manufacturing rollups stay in sync with the new scope. We fire this
  // without awaiting to avoid blocking the CO approval UI on a
  // potentially slow batch recalc. Errors are logged only.
  void (async () => {
    try {
      const { recalculateCostsAfterChangeOrder } = await import(
        '@/modules/design-manager/services/changeOrderContextService'
      );
      await recalculateCostsAfterChangeOrder(coId, userId);
    } catch (err) {
      console.warn('[changeOrderService] post-apply cost recalc failed', err);
    }
  })();

  // Best-effort: cascade the CO to manufacturing — spawn child MOs for
  // added items, cancel MOs for removals when safe, flag blocked
  // removals back onto the SO as risk flags. Fire-and-forget.
  void (async () => {
    try {
      const { cascadeChangeOrderToManufacturing } = await import(
        '@/modules/manufacturing/services/moCascadeService'
      );
      const result = await cascadeChangeOrderToManufacturing(
        coId,
        userId,
        so.subsidiaryId,
      );
      if (result.blockedRemovals.length > 0) {
        console.warn(
          `[changeOrderService] CO ${co.changeOrderNumber} had ${result.blockedRemovals.length} blocked removal(s) — see SO risk flags`,
        );
      }
    } catch (err) {
      console.warn('[changeOrderService] post-apply MO cascade failed', err);
    }
  })();
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export function subscribeToChangeOrders(
  salesOrderId: string,
  callback: (orders: ChangeOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, CHANGE_ORDERS_COLLECTION),
    where('salesOrderId', '==', salesOrderId),
    orderBy('createdAt', 'desc'),
  );

  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChangeOrder));
    callback(orders);
  });
}

export function subscribeToApprovalEvents(
  coId: string,
  callback: (events: ChangeOrderApprovalEvent[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, CHANGE_ORDERS_COLLECTION, coId, CHANGE_ORDER_APPROVAL_EVENTS_SUBCOLLECTION),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChangeOrderApprovalEvent));
    callback(events);
  });
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function loadSO(salesOrderId: string): Promise<SalesOrder | null> {
  const snap = await getDoc(doc(db, SO_COLLECTION, salesOrderId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SalesOrder;
}

/** Log a CRM activity if the SO is linked to a deal. Best-effort; swallows errors. */
async function propagateToCRM(args: {
  so: SalesOrder;
  coNumber: string;
  coId: string;
  activityType: CRMActivityType;
  activityTitle: string;
  activityDescription?: string;
  userId: string;
  userName?: string;
}): Promise<void> {
  const { so, coNumber, coId, activityType, activityTitle, activityDescription, userId, userName } = args;
  if (!so.dealId) return;
  try {
    await logActivity({
      dealId: so.dealId,
      customerId: so.customerId,
      projectId: so.designProjectId,
      party: so.party,
      type: activityType,
      title: activityTitle,
      description: activityDescription,
      source: 'auto_system',
      sourceModule: 'sales-orders',
      sourceEntityId: coId,
      sourceEntityType: 'change_order',
      performedBy: userId,
      performedByName: userName ?? 'System',
      performedAt: Timestamp.now(),
      outcome: coNumber,
    });
  } catch (err) {
    console.warn('[changeOrderService] CRM activity log failed', err);
  }
}

/**
 * Recompute the linked deal's `changeOrderSummary` denorm. Safe to call
 * repeatedly; absent deal is a no-op. Errors are swallowed so CO flows
 * aren't blocked by CRM read issues.
 */
export async function refreshDealCOSummary(so: SalesOrder): Promise<void> {
  if (!so.dealId) return;
  try {
    const cos = await getChangeOrdersForSO(so.id);

    const approved = cos.filter((c) => c.status === 'approved');
    const pending = cos.filter(
      (c) => c.status === 'pending_internal' || c.status === 'pending_client',
    );
    const rejected = cos.filter((c) => c.status === 'rejected');
    const open = cos.filter(
      (c) =>
        c.status === 'draft' || c.status === 'pending_internal' || c.status === 'pending_client',
    );

    const mostRecent = cos[0]; // getChangeOrdersForSO orders desc by createdAt

    const summary: DealChangeOrderSummary = {
      count: cos.length,
      openCount: open.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      approvedValue: approved.reduce((sum, c) => sum + c.priceImpact, 0),
      pendingValue: pending.reduce((sum, c) => sum + c.priceImpact, 0),
      hasPostFreezeCO: cos.some((c) => c.isPostScopeFreeze),
      lastChangeOrderAt: mostRecent?.createdAt,
      lastChangeOrderNumber: mostRecent?.changeOrderNumber,
      lastChangeOrderStatus: mostRecent?.status,
      updatedAt: Timestamp.now(),
    };

    await setDoc(
      doc(db, CRM_DEALS_COLLECTION, so.dealId),
      { changeOrderSummary: summary },
      { merge: true },
    );
  } catch (err) {
    console.warn('[changeOrderService] deal CO summary refresh failed', err);
  }
}
