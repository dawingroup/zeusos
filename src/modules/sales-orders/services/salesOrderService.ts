/**
 * Sales Order Service
 * Core CRUD, lifecycle transitions, gate management, risk detection, production release.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  runTransaction,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  SalesOrder,
  SalesOrderStatus,
  SalesOrderItem,
  ApprovalGates,
  ApprovalGateId,
  GateStatus,
  GateStatusValue,
  RiskFlag,
  RiskType,
  RiskSeverity,
  StatusChange,
  Discount,
  GateReadiness,
  ReleaseResult,
  SalesOrderFilters,
  ActionableSalesOrder,
  SalesOrderDashboardStats,
  PaymentTerms,
  PaymentRecord,
  PaymentType,
  PaymentMethod,
} from '../types';
import {
  SO_COLLECTION,
  BUSINESS_EVENTS_COLLECTION,
  STATUS_TRANSITIONS,
  GATE_REQUIREMENTS,
  INTERNAL_REVIEW_THRESHOLD,
  MAX_CHANGE_ORDERS_BEFORE_RISK,
  DEFAULT_PAYMENT_TERMS,
} from '../constants';
import { partyRef, type PartyRef } from '@/shared/types/party';

// ============================================================================
// FIRESTORE HELPERS
// ============================================================================

/** Remove undefined values from an object (Firestore rejects undefined). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) return obj;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== undefined),
  ) as unknown as T;
}

/** Strip undefined values from all gates in an ApprovalGates object. */
function stripUndefinedFromGates(gates: ApprovalGates): ApprovalGates {
  const cleaned: Record<string, unknown> = {};
  for (const [key, gate] of Object.entries(gates)) {
    cleaned[key] = stripUndefined(gate);
  }
  return cleaned as unknown as ApprovalGates;
}

// ============================================================================
// AUTO-NUMBERING
// ============================================================================
//
// Monotonic **org-wide** per calendar year via `counters/so_global_{year}` + transactions.
// Before each allocation we reconcile the counter to max existing `SO-{year}-*` in Firestore so
// stale values (imports, scripts, legacy per-subsidiary counters) cannot issue duplicates.

const COUNTERS_COLLECTION = 'counters';

/**
 * Bump `counters/so_global_{year}` so `value` is at least the max existing
 * `SO-{year}-{nnnn}` in `salesOrders`. Without this, a stale counter (imports,
 * dedupe, older per-subsidiary counters, manual edits) keeps issuing numbers that
 * already exist.
 */
async function reconcileGlobalSoCounterFromOrders(year: number): Promise<void> {
  const yearLo = `SO-${year}-`;
  const yearHi = `SO-${year + 1}-`;
  const q = query(
    collection(db, SO_COLLECTION),
    where('orderNumber', '>=', yearLo),
    where('orderNumber', '<', yearHi),
  );
  const snap = await getDocs(q);
  let maxFromOrders = 0;
  const numRe = new RegExp(`^SO-${year}-(\\d+)$`);
  for (const d of snap.docs) {
    const on = d.data().orderNumber as string | undefined;
    if (!on) continue;
    const m = on.match(numRe);
    if (m) {
      const seq = parseInt(m[1], 10);
      if (!Number.isNaN(seq) && seq > maxFromOrders) maxFromOrders = seq;
    }
  }

  const counterRef = doc(db, COUNTERS_COLLECTION, `so_global_${year}`);
  const counterSnap = await getDoc(counterRef);
  const cur = counterSnap.exists() ? ((counterSnap.data() as { value?: number }).value ?? 0) : 0;
  const target = Math.max(cur, maxFromOrders);
  if (target > cur || !counterSnap.exists()) {
    await setDoc(
      counterRef,
      { value: target, prefix: 'SO', year, scheme: 'global' },
      { merge: true },
    );
  }
}

/** Next `SO-{year}-{nnnn}`; sequence is **org-wide** so IDs never collide across subsidiaries. */
async function generateSONumber(_subsidiaryId: string): Promise<string> {
  const year = new Date().getFullYear();
  await reconcileGlobalSoCounterFromOrders(year);

  const counterRef = doc(db, COUNTERS_COLLECTION, `so_global_${year}`);

  const nextNum = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    let current = 0;
    if (counterSnap.exists()) {
      current = (counterSnap.data() as { value?: number }).value ?? 0;
    }
    const next = current + 1;
    transaction.set(
      counterRef,
      { value: next, prefix: 'SO', year, scheme: 'global' },
      { merge: true },
    );
    return next;
  });

  return `SO-${year}-${String(nextNum).padStart(4, '0')}`;
}

// ============================================================================
// BUSINESS EVENTS
// ============================================================================

async function emitBusinessEvent(
  eventType: string,
  so: Partial<SalesOrder>,
  userId: string,
  extraData?: Record<string, unknown>,
): Promise<void> {
  try {
    await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
      eventType,
      category: 'workflow_transition',
      severity: eventType.includes('risk') ? 'high' : 'medium',
      sourceModule: 'sales_orders',
      entityType: 'sales_order',
      entityId: so.id ?? '',
      triggeredBy: userId,
      triggeredAt: serverTimestamp(),
      status: 'pending',
      metadata: {
        orderNumber: so.orderNumber,
        customerName: so.customerName,
        currentAmount: so.currentAmount,
        soStatus: so.status,
        ...extraData,
      },
      createdAt: serverTimestamp(),
    });
  } catch {
    // Non-critical — don't block the main operation
  }
}

// ============================================================================
// GATE INITIALIZATION
// ============================================================================

function initializeGates(orderAmount: number, hasDiscounts: boolean, depositRequired: boolean): ApprovalGates {
  const defaultGate: GateStatus = {
    required: true,
    status: 'not_started',
  };

  return {
    clientAcceptance: { ...defaultGate },
    discountApproval: {
      ...defaultGate,
      required: hasDiscounts,
      status: hasDiscounts ? 'not_started' : 'approved',
    },
    designSignOff: { ...defaultGate },
    scopeFreeze: { ...defaultGate },
    internalReview: {
      ...defaultGate,
      required: orderAmount >= INTERNAL_REVIEW_THRESHOLD,
      status: orderAmount >= INTERNAL_REVIEW_THRESHOLD ? 'not_started' : 'approved',
    },
    depositReceived: {
      ...defaultGate,
      required: depositRequired,
      status: depositRequired ? 'not_started' : 'approved',
    },
  };
}

// ============================================================================
// CRUD
// ============================================================================

export interface CreateFromQuoteData {
  designProjectId: string;
  quoteId?: string;
  /**
   * P16/F13 — canonical CRM deal FK. Required on the persisted record;
   * allowed to be omitted on the create input only for the unusual
   * design-manager-direct path where no deal exists yet.
   */
  dealId?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  /**
   * P8/F1 — optional cross-subsidiary party ref. When the caller has
   * one (e.g. `dealToSalesOrderService` forwards `deal.party`) it's
   * stored verbatim so kind information survives. When omitted we
   * default to `finishes_customer` — every SO today originates from
   * a finishes CRMDeal / quote, so that's the correct default.
   */
  party?: PartyRef;
  title: string;
  description?: string;
  originalQuoteAmount: number;
  currency: 'UGX' | 'USD';
  lineItems: Omit<SalesOrderItem, 'id' | 'lineNumber' | 'fromQuoteVersion' | 'isActive'>[];
  paymentTerms?: Partial<PaymentTerms>;
  expectedDeliveryDate?: Date;
  deliveryAddress?: string;
  deliveryNotes?: string;
  installationRequired?: boolean;
  expiresAt?: Date;
}

export async function createFromQuote(
  data: CreateFromQuoteData,
  userId: string,
  subsidiaryId: string,
): Promise<string> {
  const orderNumber = await generateSONumber(subsidiaryId);

  const scopeItems: SalesOrderItem[] = data.lineItems.map((item, idx) => ({
    ...item,
    id: `item-${idx + 1}`,
    lineNumber: idx + 1,
    fromQuoteVersion: 1,
    isActive: true,
    totalPrice: item.quantity * item.unitPrice,
  }));

  const totalAmount = scopeItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const paymentTerms: PaymentTerms = {
    ...DEFAULT_PAYMENT_TERMS,
    ...data.paymentTerms,
  };

  if (paymentTerms.depositPercent && paymentTerms.depositRequired) {
    paymentTerms.depositAmount = Math.round(totalAmount * (paymentTerms.depositPercent / 100));
  }

  const gates = initializeGates(
    data.originalQuoteAmount,
    false,
    paymentTerms.depositRequired,
  );

  const now = Timestamp.now();

  const soData: Omit<SalesOrder, 'id'> = {
    subsidiaryId,
    orderNumber,
    title: data.title,
    description: data.description,
    designProjectId: data.designProjectId,
    // P16/F13 — canonical CRM deal FK. Legacy `crmDealId` was dropped
    // post-backfill (2026-04-18).
    dealId: data.dealId,
    customerId: data.customerId,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    // P8/F1 — store the cross-subsidiary party ref alongside the
    // legacy `customerId`. Forward the caller's value if present
    // (preserves advisory_client kind when that's ever plumbed
    // through), otherwise default to finishes_customer.
    party: data.party ?? partyRef('finishes_customer', data.customerId),
    quoteId: data.quoteId,
    originalQuoteAmount: data.originalQuoteAmount,
    currentAmount: totalAmount,
    currency: data.currency,
    discounts: [],
    totalDiscountAmount: 0,
    totalDiscountPercent: 0,
    scopeVersion: 1,
    scopeDescription: data.title,
    scopeItems,
    scopeFrozen: false,
    changeOrders: [],
    totalChangeOrderValue: 0,
    pendingChangeOrders: 0,
    gates,
    paymentTerms,
    expectedDeliveryDate: data.expectedDeliveryDate
      ? Timestamp.fromDate(data.expectedDeliveryDate)
      : undefined,
    deliveryAddress: data.deliveryAddress,
    deliveryNotes: data.deliveryNotes,
    installationRequired: data.installationRequired ?? false,
    status: 'draft',
    statusHistory: [
      {
        fromStatus: null,
        toStatus: 'draft',
        changedAt: now,
        changedBy: userId,
        notes: 'Sales order created from quote',
      },
    ],
    attachments: [],
    riskFlags: [],
    // Payment tracking — initialised at creation; updated as payments are recorded
    payments: [],
    totalPaid: 0,
    balanceRemaining: totalAmount,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
    expiresAt: data.expiresAt ? Timestamp.fromDate(data.expiresAt) : undefined,
  };

  const docRef = await addDoc(collection(db, SO_COLLECTION), cleanUndefined(soData));

  await emitBusinessEvent('sales_order_created', { ...soData, id: docRef.id }, userId);

  return docRef.id;
}

/** Line payload when appending quotation rows to an existing SO. */
export type AppendScopeLineInput = Omit<
  SalesOrderItem,
  'id' | 'lineNumber' | 'fromQuoteVersion' | 'isActive'
>;

/**
 * Append approved quote lines to an existing sales order (progressive approval
 * / multiple tranches from the same quotation).
 */
export async function appendQuoteLinesToSalesOrder(
  salesOrderId: string,
  lines: AppendScopeLineInput[],
  userId: string,
): Promise<void> {
  if (lines.length === 0) return;
  const soRef = doc(db, SO_COLLECTION, salesOrderId);
  const snap = await getDoc(soRef);
  if (!snap.exists()) throw new Error('Sales order not found');
  const so = { id: snap.id, ...snap.data() } as SalesOrder;

  let maxLine = 0;
  let maxItemSuffix = 0;
  for (const item of so.scopeItems) {
    if (item.lineNumber > maxLine) maxLine = item.lineNumber;
    const m = item.id.match(/^item-(\d+)$/);
    if (m) maxItemSuffix = Math.max(maxItemSuffix, parseInt(m[1], 10));
  }

  const additions: SalesOrderItem[] = lines.map((item, idx) => ({
    ...item,
    id: `item-${maxItemSuffix + idx + 1}`,
    lineNumber: maxLine + idx + 1,
    fromQuoteVersion: so.scopeVersion,
    isActive: true,
    totalPrice: item.quantity * item.unitPrice,
  }));

  const scopeItems = [...so.scopeItems, ...additions];
  const newScopeVersion = so.scopeVersion + 1;
  const grossActive = scopeItems.filter((i) => i.isActive).reduce((sum, i) => sum + i.totalPrice, 0);
  const currentAmount = grossActive - (so.totalDiscountAmount ?? 0);

  const paymentTerms = { ...so.paymentTerms };
  if (paymentTerms.depositPercent && paymentTerms.depositRequired) {
    paymentTerms.depositAmount = Math.round(currentAmount * (paymentTerms.depositPercent / 100));
  }

  const updatedGates = { ...so.gates };
  if (updatedGates.designSignOff.status === 'approved') {
    updatedGates.designSignOff = {
      ...updatedGates.designSignOff,
      status: 'not_started',
      notes: `Invalidated — additional quote line(s) added (scope v${so.scopeVersion} → v${newScopeVersion})`,
    };
  }

  const now = Timestamp.now();
  await updateDoc(soRef, {
    scopeItems,
    scopeVersion: newScopeVersion,
    currentAmount,
    balanceRemaining: currentAmount - (so.totalPaid ?? 0),
    paymentTerms,
    gates: stripUndefinedFromGates(updatedGates),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
    statusHistory: [
      ...so.statusHistory,
      {
        fromStatus: so.status,
        toStatus: so.status,
        changedAt: now,
        changedBy: userId,
        notes: `Added ${lines.length} approved quotation line(s) to scope`,
      },
    ],
  });

  await emitBusinessEvent(
    'sales_order_scope_extended',
    { id: salesOrderId, orderNumber: so.orderNumber },
    userId,
    { linesAdded: lines.length, newScopeVersion },
  );
}

export async function getSalesOrder(orderId: string): Promise<SalesOrder | null> {
  const docSnap = await getDoc(doc(db, SO_COLLECTION, orderId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as SalesOrder;
}

/**
 * Find a sales order linked to a CRM deal.
 * Queries by the canonical `dealId`; returns the most recent match or null.
 */
export async function getSalesOrderForDeal(dealId: string): Promise<SalesOrder | null> {
  const q = query(
    collection(db, SO_COLLECTION),
    where('dealId', '==', dealId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as SalesOrder;
}

export async function getSalesOrders(
  subsidiaryId: string,
  filters?: SalesOrderFilters,
): Promise<SalesOrder[]> {
  // Match both 'zeus-the-agency' and legacy 'finishes' subsidiary IDs
  const subsidiaryIds = subsidiaryId === 'zeus-the-agency'
    ? ['zeus-the-agency', 'finishes']
    : [subsidiaryId];

  const constraints: QueryConstraint[] = [
    where('subsidiaryId', 'in', subsidiaryIds),
  ];

  if (filters?.status && filters.status.length > 0) {
    if (filters.status.length === 1) {
      constraints.push(where('status', '==', filters.status[0]));
    } else if (filters.status.length <= 10) {
      constraints.push(where('status', 'in', filters.status));
    }
  }

  if (filters?.customerId) {
    constraints.push(where('customerId', '==', filters.customerId));
  }

  if (filters?.createdBy) {
    constraints.push(where('createdBy', '==', filters.createdBy));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, SO_COLLECTION), ...constraints);
  const snap = await getDocs(q);

  let orders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SalesOrder));

  // Client-side filtering for complex queries
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    orders = orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(term) ||
        o.title.toLowerCase().includes(term) ||
        o.customerName.toLowerCase().includes(term),
    );
  }

  if (filters?.hasRiskFlags) {
    orders = orders.filter((o) => o.riskFlags.length > 0);
  }

  return orders;
}

export async function getSalesOrderByProject(designProjectId: string): Promise<SalesOrder | null> {
  const q = query(
    collection(db, SO_COLLECTION),
    where('designProjectId', '==', designProjectId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as SalesOrder;
}

// ============================================================================
// CANCEL & DELETE
// ============================================================================

/**
 * Cancel a sales order (soft delete — sets status to 'cancelled').
 * Allowed from any pre-production status.
 */
export async function cancelSalesOrder(
  orderId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const soRef = doc(db, SO_COLLECTION, orderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error('Sales order not found');

  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;
  const allowed = STATUS_TRANSITIONS[so.status];

  if (!allowed.includes('cancelled')) {
    throw new Error(
      `Cannot cancel an order in "${so.status}" status. Only pre-production orders can be cancelled.`,
    );
  }

  const now = Timestamp.now();
  const statusEntry = stripUndefined({
    fromStatus: so.status,
    toStatus: 'cancelled',
    changedAt: now,
    changedBy: userId,
    notes: reason,
  } as StatusChange);

  await updateDoc(soRef, {
    status: 'cancelled',
    statusHistory: [...so.statusHistory.map(stripUndefined), statusEntry],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await emitBusinessEvent('sales_order_cancelled', so, userId, { reason });
}

/**
 * Cancel specific line items on a sales order.
 * Marks selected active scope rows as inactive and recalculates totals.
 */
export async function cancelSalesOrderLineItems(
  orderId: string,
  lineItemIds: string[],
  userId: string,
  reason?: string,
): Promise<void> {
  if (lineItemIds.length === 0) return;

  await runTransaction(db, async (transaction) => {
    const soRef = doc(db, SO_COLLECTION, orderId);
    const soSnap = await transaction.get(soRef);
    if (!soSnap.exists()) throw new Error('Sales order not found');

    const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;
    if (['released_to_production', 'in_progress', 'completed', 'cancelled'].includes(so.status)) {
      throw new Error(`Cannot cancel line items when order status is "${so.status}"`);
    }

    const selectedIds = new Set(lineItemIds);
    const activeItems = so.scopeItems.filter((item) => item.isActive);
    const cancellableItems = activeItems.filter((item) => selectedIds.has(item.id));
    if (cancellableItems.length === 0) {
      throw new Error('No active line items selected for cancellation');
    }
    if (cancellableItems.length === activeItems.length) {
      throw new Error('Cannot cancel all line items. Cancel the sales order instead.');
    }

    const cancellableIds = new Set(cancellableItems.map((item) => item.id));
    const cancellationLabel = reason?.trim() ? `Cancelled: ${reason.trim()}` : 'Cancelled';
    const updatedScopeItems = so.scopeItems.map((item) => {
      if (!item.isActive || !cancellableIds.has(item.id)) return item;
      return {
        ...item,
        isActive: false,
        removedByChangeOrder: cancellationLabel,
      };
    });

    const newScopeVersion = so.scopeVersion + 1;
    const grossActive = updatedScopeItems
      .filter((item) => item.isActive)
      .reduce((sum, item) => sum + item.totalPrice, 0);
    const currentAmount = Math.max(0, grossActive - (so.totalDiscountAmount ?? 0));
    const paymentTerms = { ...so.paymentTerms };
    if (paymentTerms.depositPercent && paymentTerms.depositRequired) {
      paymentTerms.depositAmount = Math.round(currentAmount * (paymentTerms.depositPercent / 100));
    }

    const updatedGates = { ...so.gates };
    if (updatedGates.designSignOff.status === 'approved') {
      updatedGates.designSignOff = {
        ...updatedGates.designSignOff,
        status: 'not_started',
        notes: `Invalidated — line-item cancellation changed scope v${so.scopeVersion} to v${newScopeVersion}`,
      };
    }

    const now = Timestamp.now();
    const changeNote = reason?.trim()
      ? `Cancelled ${cancellableItems.length} line item(s): ${reason.trim()}`
      : `Cancelled ${cancellableItems.length} line item(s)`;

    transaction.update(soRef, {
      scopeItems: updatedScopeItems,
      scopeVersion: newScopeVersion,
      currentAmount,
      balanceRemaining: Math.max(0, currentAmount - (so.totalPaid ?? 0)),
      paymentTerms: stripUndefined(paymentTerms),
      gates: stripUndefinedFromGates(updatedGates),
      statusHistory: [
        ...so.statusHistory.map(stripUndefined),
        stripUndefined({
          fromStatus: so.status,
          toStatus: so.status,
          changedAt: now,
          changedBy: userId,
          notes: changeNote,
        } as StatusChange),
      ],
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  });

  await emitBusinessEvent('sales_order_scope_items_cancelled', { id: orderId }, userId, {
    lineItemIds,
    reason: reason?.trim() || undefined,
  });
}

/**
 * Permanently delete a sales order. Only allowed for draft orders.
 */
export async function deleteSalesOrder(
  orderId: string,
): Promise<void> {
  const soRef = doc(db, SO_COLLECTION, orderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error('Sales order not found');

  const so = soSnap.data() as SalesOrder;
  if (so.status !== 'draft' && so.status !== 'cancelled') {
    throw new Error(
      'Only draft or cancelled orders can be permanently deleted. Cancel the order first.',
    );
  }

  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(soRef);
}

// ============================================================================
// STATUS LIFECYCLE
// ============================================================================

export async function advanceStatus(
  orderId: string,
  targetStatus: SalesOrderStatus,
  userId: string,
  notes?: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const soRef = doc(db, SO_COLLECTION, orderId);
    const soSnap = await transaction.get(soRef);

    if (!soSnap.exists()) throw new Error('Sales order not found');

    const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;
    const validTargets = STATUS_TRANSITIONS[so.status];

    if (!validTargets.includes(targetStatus)) {
      throw new Error(
        `Invalid transition: ${so.status} → ${targetStatus}. Allowed: ${validTargets.join(', ')}`,
      );
    }

    // Check gate requirements for this target status
    const requiredGates = GATE_REQUIREMENTS[targetStatus];
    if (requiredGates) {
      const blockingGates: string[] = [];
      for (const gateId of requiredGates) {
        const gate = so.gates[gateId];
        if (gate.required && gate.status !== 'approved' && gate.status !== 'waived') {
          blockingGates.push(gateId);
        }
      }
      if (blockingGates.length > 0) {
        throw new Error(
          `Cannot transition to ${targetStatus}. Blocked by gates: ${blockingGates.join(', ')}`,
        );
      }
    }

    const now = Timestamp.now();
    const statusChange = stripUndefined({
      fromStatus: so.status,
      toStatus: targetStatus,
      changedAt: now,
      changedBy: userId,
      notes,
    } as StatusChange);

    transaction.update(soRef, {
      status: targetStatus,
      statusHistory: [...so.statusHistory.map(stripUndefined), statusChange],
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  });

  await emitBusinessEvent('sales_order_status_changed', { id: orderId, status: targetStatus }, userId, {
    targetStatus,
  });
}

export async function checkGateReadiness(
  orderId: string,
  targetStatus: SalesOrderStatus,
): Promise<GateReadiness> {
  const so = await getSalesOrder(orderId);
  if (!so) return { ready: false, blockedBy: [{ gate: 'n/a', reason: 'Sales order not found' }], warnings: [] };

  const requiredGates = GATE_REQUIREMENTS[targetStatus];
  if (!requiredGates) return { ready: true, blockedBy: [], warnings: [] };

  const blockedBy: { gate: string; reason: string }[] = [];
  const warnings: string[] = [];

  for (const gateId of requiredGates) {
    const gate = so.gates[gateId];
    if (!gate.required) continue;

    if (gate.status === 'waived') {
      warnings.push(`Gate "${gateId}" was waived — this is logged as a risk`);
    } else if (gate.status !== 'approved') {
      blockedBy.push({
        gate: gateId,
        reason: `Gate "${gateId}" status is "${gate.status}" — must be approved or waived`,
      });
    }
  }

  return {
    ready: blockedBy.length === 0,
    blockedBy,
    warnings,
  };
}

// ============================================================================
// GATE MANAGEMENT
// ============================================================================

export async function passGate(
  orderId: string,
  gate: ApprovalGateId,
  userId: string,
  evidence?: string,
  notes?: string,
): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const soRef = doc(db, SO_COLLECTION, orderId);
    const soSnap = await transaction.get(soRef);

    if (!soSnap.exists()) throw new Error('Sales order not found');

    const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;
    const now = Timestamp.now();

    const updatedGate: GateStatus = {
      required: so.gates[gate].required,
      status: 'approved' as GateStatusValue,
      approvedBy: userId,
      approvedAt: now,
      ...(evidence ? { evidence } : {}),
      ...(notes ? { notes } : {}),
    };

    const cleanGates = stripUndefinedFromGates({ ...so.gates, [gate]: updatedGate });

    transaction.update(soRef, {
      gates: cleanGates,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    });
  });

  await emitBusinessEvent('gate_passed', { id: orderId }, userId, { gate });
}

export async function waiveGate(
  orderId: string,
  gate: ApprovalGateId,
  userId: string,
  reason: string,
): Promise<void> {
  const so = await getSalesOrder(orderId);
  if (!so) throw new Error('Sales order not found');

  const now = Timestamp.now();

  const updatedGate: GateStatus = {
    required: so.gates[gate].required,
    status: 'waived' as GateStatusValue,
    approvedBy: userId,
    approvedAt: now,
    notes: `WAIVED: ${reason}`,
  };

  const cleanGates = stripUndefinedFromGates({ ...so.gates, [gate]: updatedGate });

  // Add risk flag for waived gate
  const riskFlag: RiskFlag = {
    id: `risk-waiver-${gate}-${Date.now()}`,
    type: 'verbal_agreement_only',
    severity: 'high',
    message: `Gate "${gate}" was waived: ${reason}`,
    createdAt: now,
    autoDetected: true,
  };

  const cleanRiskFlags = [...so.riskFlags, riskFlag].map(stripUndefined);

  await updateDoc(doc(db, SO_COLLECTION, orderId), {
    gates: cleanGates,
    riskFlags: cleanRiskFlags,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await emitBusinessEvent('gate_waived', { id: orderId }, userId, { gate, reason });
}

// ============================================================================
// DISCOUNT MANAGEMENT
// ============================================================================

export async function requestDiscount(
  orderId: string,
  discountInput: {
    type: Discount['type'];
    value: number;
    reason: string;
    lineItemId?: string;
  },
  userId: string,
): Promise<Discount> {
  const so = await getSalesOrder(orderId);
  if (!so) throw new Error('Sales order not found');

  const now = Timestamp.now();

  // Calculate discount amount
  let amount: number;
  if (discountInput.type === 'percentage') {
    amount = Math.round(so.currentAmount * (discountInput.value / 100));
  } else if (discountInput.type === 'line_item' && discountInput.lineItemId) {
    const lineItem = so.scopeItems.find((i) => i.id === discountInput.lineItemId);
    if (!lineItem) throw new Error('Line item not found');
    amount = Math.round(lineItem.totalPrice * (discountInput.value / 100));
  } else {
    amount = discountInput.value;
  }

  const discount: Discount = {
    id: `disc-${Date.now()}`,
    type: discountInput.type,
    value: discountInput.value,
    amount,
    reason: discountInput.reason,
    lineItemId: discountInput.lineItemId,
    requestedBy: userId,
    requestedAt: now,
    approvalStatus: 'pending',
    exceedsPolicy: false,
    policyThreshold: 0,
  };

  const discounts = [...so.discounts, discount];
  const totalDiscountAmount = discounts
    .filter((d) => d.approvalStatus === 'approved' || d.approvalStatus === 'pending')
    .reduce((sum, d) => sum + d.amount, 0);
  const totalDiscountPercent =
    so.originalQuoteAmount > 0 ? (totalDiscountAmount / so.originalQuoteAmount) * 100 : 0;

  await updateDoc(doc(db, SO_COLLECTION, orderId), {
    discounts,
    totalDiscountAmount,
    totalDiscountPercent,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return discount;
}

export async function resolveDiscount(
  orderId: string,
  discountId: string,
  approved: boolean,
  userId: string,
  notes?: string,
): Promise<void> {
  const so = await getSalesOrder(orderId);
  if (!so) throw new Error('Sales order not found');

  const now = Timestamp.now();

  const discounts = so.discounts.map((d) => {
    if (d.id !== discountId) return d;
    const updated = {
      ...d,
      approvalStatus: approved ? ('approved' as const) : ('rejected' as const),
      approvedBy: userId,
      approvedAt: now,
    };
    if (!approved && notes) {
      (updated as Record<string, unknown>).rejectionReason = notes;
    }
    return updated;
  }).map(stripUndefined);

  const approvedDiscounts = discounts.filter((d) => d.approvalStatus === 'approved');
  const totalDiscountAmount = approvedDiscounts.reduce((sum, d) => sum + d.amount, 0);
  const totalDiscountPercent =
    so.originalQuoteAmount > 0 ? (totalDiscountAmount / so.originalQuoteAmount) * 100 : 0;
  const currentAmount = so.originalQuoteAmount - totalDiscountAmount + so.totalChangeOrderValue;

  // Update discount approval gate if all discounts are resolved
  const allResolved = discounts.every((d) => d.approvalStatus !== 'pending');
  const gatesCopy = { ...so.gates };
  if (allResolved) {
    gatesCopy.discountApproval = {
      required: gatesCopy.discountApproval.required,
      status: 'approved' as GateStatusValue,
      approvedBy: userId,
      approvedAt: now,
    };
  }
  const cleanGates = stripUndefinedFromGates(gatesCopy);

  await updateDoc(doc(db, SO_COLLECTION, orderId), {
    discounts,
    totalDiscountAmount,
    totalDiscountPercent,
    currentAmount,
    gates: cleanGates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await emitBusinessEvent(
    approved ? 'discount_approved' : 'discount_rejected',
    { id: orderId, currentAmount },
    userId,
    { discountId, amount: discounts.find((d) => d.id === discountId)?.amount },
  );
}

// ============================================================================
// SCOPE FREEZE
// ============================================================================

export async function freezeScope(orderId: string, userId: string): Promise<void> {
  const so = await getSalesOrder(orderId);
  if (!so) throw new Error('Sales order not found');

  if (so.scopeFrozen) throw new Error('Scope is already frozen');

  const now = Timestamp.now();

  const updatedGates = stripUndefinedFromGates({
    ...so.gates,
    scopeFreeze: {
      required: so.gates.scopeFreeze.required,
      status: 'approved' as GateStatusValue,
      approvedBy: userId,
      approvedAt: now,
    },
  });

  await updateDoc(doc(db, SO_COLLECTION, orderId), {
    scopeFrozen: true,
    scopeFrozenAt: now,
    scopeFrozenBy: userId,
    gates: updatedGates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await emitBusinessEvent('scope_frozen', { id: orderId, orderNumber: so.orderNumber }, userId);
}

// ============================================================================
// RISK DETECTION
// ============================================================================

export async function detectRisks(orderId: string): Promise<RiskFlag[]> {
  const so = await getSalesOrder(orderId);
  if (!so) return [];

  const now = Timestamp.now();
  const newRisks: RiskFlag[] = [];

  const addRisk = (type: RiskType, severity: RiskSeverity, message: string) => {
    // Don't duplicate active risks of the same type
    const existing = so.riskFlags.find((r) => r.type === type && !r.resolvedAt);
    if (!existing) {
      newRisks.push({
        id: `risk-${type}-${Date.now()}`,
        type,
        severity,
        message,
        createdAt: now,
        autoDetected: true,
      });
    }
  };

  // 1. Discount exceeds margin
  if (so.totalDiscountPercent > 20) {
    addRisk('discount_exceeds_margin', 'high', `Total discount of ${so.totalDiscountPercent.toFixed(1)}% may erode profit margin`);
  }

  // 2. Scope change after freeze
  if (so.scopeFrozen && so.pendingChangeOrders > 0) {
    addRisk('scope_change_after_freeze', 'critical', 'Change orders pending after scope was frozen');
  }

  // 3. Unsigned design — production without sign-off
  if (
    (so.status === 'released_to_production' || so.status === 'in_progress') &&
    so.gates.designSignOff.status !== 'approved' &&
    so.gates.designSignOff.status !== 'waived'
  ) {
    addRisk('unsigned_design', 'critical', 'Production started without design sign-off');
  }

  // 4. No deposit
  if (
    (so.status === 'released_to_production' || so.status === 'in_progress') &&
    so.paymentTerms.depositRequired &&
    so.gates.depositReceived.status !== 'approved' &&
    so.gates.depositReceived.status !== 'waived'
  ) {
    addRisk('no_deposit', 'high', 'Work started without required deposit');
  }

  // 5. Expired quote
  if (so.expiresAt && so.expiresAt.toMillis() < Date.now() && so.status !== 'completed' && so.status !== 'cancelled') {
    addRisk('expired_quote', 'medium', 'Quote validity period has expired');
  }

  // 6. Multiple revisions (scope creep)
  if (so.changeOrders.length > MAX_CHANGE_ORDERS_BEFORE_RISK) {
    addRisk('multiple_revisions', 'medium', `${so.changeOrders.length} change orders — possible scope creep`);
  }

  // 7. Verbal agreement only
  if (
    so.status !== 'draft' &&
    so.status !== 'sent_to_client' &&
    so.gates.clientAcceptance.status !== 'approved' &&
    so.gates.clientAcceptance.status !== 'waived'
  ) {
    addRisk('verbal_agreement_only', 'high', 'No formal written acceptance on file');
  }

  // 8. Missing specifications
  const itemsWithoutSpec = so.scopeItems.filter((i) => i.isActive && !i.specification);
  if (itemsWithoutSpec.length > 0) {
    addRisk('missing_specifications', 'low', `${itemsWithoutSpec.length} items lack detailed specifications`);
  }

  if (newRisks.length > 0) {
    const allRisks = [...so.riskFlags, ...newRisks].map(stripUndefined);
    await updateDoc(doc(db, SO_COLLECTION, orderId), {
      riskFlags: allRisks,
      updatedAt: serverTimestamp(),
    });
  }

  return newRisks;
}

export async function createManualRiskFlag(
  orderId: string,
  input: { type: RiskType; severity: RiskSeverity; message: string },
  userId: string,
): Promise<RiskFlag> {
  const so = await getSalesOrder(orderId);
  if (!so) throw new Error('Sales order not found');
  if (!input.message.trim()) throw new Error('Risk message is required');

  const now = Timestamp.now();
  const risk: RiskFlag = {
    id: `risk-manual-${Date.now()}`,
    type: input.type,
    severity: input.severity,
    message: input.message.trim(),
    createdAt: now,
    createdBy: userId,
    autoDetected: false,
  };

  const statusEntry = stripUndefined({
    fromStatus: so.status,
    toStatus: so.status,
    changedAt: now,
    changedBy: userId,
    notes: `Risk added (${input.severity}): ${risk.message}`,
  } as StatusChange);

  await updateDoc(doc(db, SO_COLLECTION, orderId), {
    riskFlags: [...so.riskFlags.map(stripUndefined), stripUndefined(risk)],
    statusHistory: [...so.statusHistory.map(stripUndefined), statusEntry],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await emitBusinessEvent('risk_flag_added', so, userId, {
    riskId: risk.id,
    type: risk.type,
    severity: risk.severity,
    autoDetected: false,
  });

  return risk;
}

export async function resolveRiskFlag(
  orderId: string,
  riskId: string,
  userId: string,
  resolutionNotes?: string,
): Promise<void> {
  const so = await getSalesOrder(orderId);
  if (!so) throw new Error('Sales order not found');

  const existing = so.riskFlags.find((r) => r.id === riskId);
  if (!existing) throw new Error('Risk flag not found');
  if (existing.resolvedAt) return;

  const now = Timestamp.now();
  const riskFlags = so.riskFlags.map((risk) => {
    if (risk.id !== riskId) return stripUndefined(risk);
    return stripUndefined({
      ...risk,
      resolvedAt: now,
      resolvedBy: userId,
      resolutionNotes: resolutionNotes?.trim() || undefined,
    } as RiskFlag);
  });

  const statusEntry = stripUndefined({
    fromStatus: so.status,
    toStatus: so.status,
    changedAt: now,
    changedBy: userId,
    notes: `Risk resolved: ${existing.message}`,
  } as StatusChange);

  await updateDoc(doc(db, SO_COLLECTION, orderId), {
    riskFlags,
    statusHistory: [...so.statusHistory.map(stripUndefined), statusEntry],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await emitBusinessEvent('risk_flag_resolved', so, userId, {
    riskId,
    type: existing.type,
    severity: existing.severity,
  });
}

export async function reopenRiskFlag(
  orderId: string,
  riskId: string,
  userId: string,
): Promise<void> {
  const so = await getSalesOrder(orderId);
  if (!so) throw new Error('Sales order not found');

  const existing = so.riskFlags.find((r) => r.id === riskId);
  if (!existing) throw new Error('Risk flag not found');
  if (!existing.resolvedAt) return;

  const now = Timestamp.now();
  const riskFlags = so.riskFlags.map((risk) => {
    if (risk.id !== riskId) return stripUndefined(risk);
    const reopened: RiskFlag = {
      ...risk,
      resolvedAt: undefined,
      resolvedBy: undefined,
      resolutionNotes: undefined,
    };
    return stripUndefined(reopened);
  });

  const statusEntry = stripUndefined({
    fromStatus: so.status,
    toStatus: so.status,
    changedAt: now,
    changedBy: userId,
    notes: `Risk reopened: ${existing.message}`,
  } as StatusChange);

  await updateDoc(doc(db, SO_COLLECTION, orderId), {
    riskFlags,
    statusHistory: [...so.statusHistory.map(stripUndefined), statusEntry],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  await emitBusinessEvent('risk_flag_reopened', so, userId, {
    riskId,
    type: existing.type,
    severity: existing.severity,
  });
}

// ============================================================================
// RELEASE TO PRODUCTION
// ============================================================================

export async function releaseToProduction(
  orderId: string,
  userId: string,
): Promise<ReleaseResult> {
  const so = await getSalesOrder(orderId);
  if (!so) return { success: false, errors: ['Sales order not found'], warnings: [], gatesBlocking: [] };

  // Check all required gates
  const readiness = await checkGateReadiness(orderId, 'released_to_production');
  if (!readiness.ready) {
    return {
      success: false,
      errors: ['Not all required gates are passed'],
      warnings: readiness.warnings,
      gatesBlocking: readiness.blockedBy.map((b) => b.gate),
    };
  }

  // Check for critical unresolved risks
  const criticalRisks = so.riskFlags.filter(
    (r) => r.severity === 'critical' && !r.resolvedAt,
  );
  if (criticalRisks.length > 0) {
    return {
      success: false,
      errors: criticalRisks.map((r) => `Unresolved critical risk: ${r.message}`),
      warnings: [],
      gatesBlocking: [],
    };
  }

  // Check scope is frozen
  if (!so.scopeFrozen) {
    return {
      success: false,
      errors: ['Scope must be frozen before production release'],
      warnings: [],
      gatesBlocking: ['scopeFreeze'],
    };
  }

  // Auto-advance through intermediate statuses to released_to_production.
  // The status chain requires stepping through each intermediate state.
  const statusPath: SalesOrderStatus[] = [
    'design_review',
    'awaiting_design_signoff',
    'design_approved',
    'scope_frozen',
    'released_to_production',
  ];

  try {
    // Re-read current status (may have changed from freeze above)
    const current = await getSalesOrder(orderId);
    if (!current) throw new Error('Sales order not found');

    let currentStatus = current.status;
    for (const nextStatus of statusPath) {
      if (currentStatus === 'released_to_production') break;
      // Skip statuses we've already passed
      if (statusPath.indexOf(currentStatus as SalesOrderStatus) >= statusPath.indexOf(nextStatus)) continue;
      // Check if this transition is valid from current status
      const validTargets = STATUS_TRANSITIONS[currentStatus];
      if (!validTargets.includes(nextStatus)) continue;
      await advanceStatus(orderId, nextStatus, userId, 'Auto-advanced for production release');
      currentStatus = nextStatus;
    }

    if (currentStatus !== 'released_to_production') {
      throw new Error(`Could not advance to released_to_production. Stopped at: ${currentStatus}`);
    }
  } catch (err) {
    return {
      success: false,
      errors: [(err as Error).message],
      warnings: [],
      gatesBlocking: [],
    };
  }

  await emitBusinessEvent('sales_order_released_to_production', so, userId);

  return {
    success: true,
    errors: [],
    warnings: readiness.warnings,
    gatesBlocking: [],
  };
}

// ============================================================================
// QUERIES
// ============================================================================

export async function getOrdersAwaitingAction(
  subsidiaryId: string,
): Promise<ActionableSalesOrder[]> {
  const activeStatuses: SalesOrderStatus[] = [
    'draft',
    'sent_to_client',
    'negotiation',
    'client_accepted',
    'design_review',
    'awaiting_design_signoff',
    'design_approved',
    'scope_frozen',
    'awaiting_deposit',
    'deposit_received',
  ];

  const orders = await getSalesOrders(subsidiaryId, { status: activeStatuses });
  const actionable: ActionableSalesOrder[] = [];

  for (const so of orders) {
    const daysPending = Math.floor(
      (Date.now() - so.updatedAt.toMillis()) / (1000 * 60 * 60 * 24),
    );

    let requiredAction: ActionableSalesOrder['requiredAction'] | null = null;
    let urgency: RiskSeverity = 'low';

    switch (so.status) {
      case 'draft':
        requiredAction = 'send_to_client';
        urgency = daysPending > 3 ? 'medium' : 'low';
        break;
      case 'sent_to_client':
      case 'negotiation':
        requiredAction = 'send_to_client';
        urgency = daysPending > 7 ? 'high' : 'medium';
        break;
      case 'awaiting_design_signoff':
        requiredAction = 'collect_design_signoff';
        urgency = daysPending > 14 ? 'high' : 'medium';
        break;
      case 'awaiting_deposit':
        requiredAction = 'collect_deposit';
        urgency = daysPending > 14 ? 'high' : 'medium';
        break;
      case 'deposit_received':
      case 'scope_frozen':
        requiredAction = 'release_to_production';
        urgency = 'medium';
        break;
      default:
        break;
    }

    // Check for pending discounts
    if (so.discounts.some((d) => d.approvalStatus === 'pending')) {
      requiredAction = 'approve_discount';
      urgency = 'high';
    }

    // Check for risk flags
    if (so.riskFlags.some((r) => !r.resolvedAt && r.severity === 'critical')) {
      requiredAction = 'resolve_risk';
      urgency = 'critical';
    }

    if (requiredAction) {
      actionable.push({ salesOrder: so, requiredAction, urgency, daysPending });
    }
  }

  // Sort by urgency
  const urgencyOrder: Record<RiskSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  actionable.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return actionable;
}

export function computeDashboardStats(orders: SalesOrder[]): SalesOrderDashboardStats {
  const byStatus: Partial<Record<SalesOrderStatus, number>> = {};
  let totalPipelineValue = 0;
  let awaitingClientResponse = 0;
  let readyToRelease = 0;
  let pendingDiscounts = 0;
  let activeRiskFlags = 0;

  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;

    if (o.status !== 'completed' && o.status !== 'cancelled') {
      totalPipelineValue += o.currentAmount;
    }

    if (o.status === 'sent_to_client' || o.status === 'awaiting_design_signoff' || o.status === 'awaiting_deposit') {
      awaitingClientResponse++;
    }

    if (o.status === 'deposit_received' || (o.status === 'scope_frozen' && !o.paymentTerms.depositRequired)) {
      readyToRelease++;
    }

    pendingDiscounts += o.discounts.filter((d) => d.approvalStatus === 'pending').length;
    activeRiskFlags += o.riskFlags.filter((r) => !r.resolvedAt).length;
  }

  return {
    totalOrders: orders.length,
    byStatus,
    totalPipelineValue,
    awaitingClientResponse,
    readyToRelease,
    pendingDiscounts,
    activeRiskFlags,
    averageDaysToRelease: 0, // Would need historical data
  };
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

export function subscribeToSalesOrders(
  subsidiaryId: string,
  filters: SalesOrderFilters,
  callback: (orders: SalesOrder[]) => void,
): Unsubscribe {
  // Match both 'zeus-the-agency' and legacy 'finishes' subsidiary IDs
  const subsidiaryIds = subsidiaryId === 'zeus-the-agency'
    ? ['zeus-the-agency', 'finishes']
    : [subsidiaryId];

  const constraints: QueryConstraint[] = [
    where('subsidiaryId', 'in', subsidiaryIds),
  ];

  if (filters.status && filters.status.length === 1) {
    constraints.push(where('status', '==', filters.status[0]));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, SO_COLLECTION), ...constraints);

  return onSnapshot(q, (snapshot) => {
    let orders = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as SalesOrder),
    );

    // Client-side filtering
    if (filters.status && filters.status.length > 1) {
      orders = orders.filter((o) => filters.status!.includes(o.status));
    }

    if (filters.search) {
      const term = filters.search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(term) ||
          o.title.toLowerCase().includes(term) ||
          o.customerName.toLowerCase().includes(term),
      );
    }

    if (filters.hasRiskFlags) {
      orders = orders.filter((o) => o.riskFlags.some((r) => !r.resolvedAt));
    }

    callback(orders);
  });
}

export function subscribeToSalesOrder(
  orderId: string,
  callback: (order: SalesOrder | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, SO_COLLECTION, orderId), (docSnap) => {
    if (!docSnap.exists()) {
      callback(null);
      return;
    }
    callback({ id: docSnap.id, ...docSnap.data() } as SalesOrder);
  });
}

// ============================================================================
// ATTACHMENT MANAGEMENT
// ============================================================================

export async function addAttachment(
  orderId: string,
  attachment: Omit<import('../types').OrderAttachment, 'id' | 'uploadedAt'>,
  userId: string,
): Promise<void> {
  const so = await getSalesOrder(orderId);
  if (!so) throw new Error('Sales order not found');

  const newAttachment: import('../types').OrderAttachment = {
    ...attachment,
    id: `att-${Date.now()}`,
    uploadedBy: userId,
    uploadedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, SO_COLLECTION, orderId), {
    attachments: [...so.attachments, newAttachment],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

// ============================================================================
// PAYMENT RECORDING
// ============================================================================

/**
 * Record a payment against a Sales Order.
 * Updates the SO's payments array, totalPaid, and balanceRemaining.
 */
export async function recordPayment(
  orderId: string,
  payment: {
    type: PaymentType;
    method: PaymentMethod;
    amount: number;
    currency: string;
    paymentDate?: string;          // ISO date string (YYYY-MM-DD) — defaults to today
    receiptRef?: string;
    receiptDocumentNumber?: string;
    receiptPdfUrl?: string;
    sharedViaWhatsApp?: boolean;
    whatsAppPhone?: string;
  },
  userId: string,
): Promise<PaymentRecord> {
  const soRef = doc(db, SO_COLLECTION, orderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error(`Sales Order ${orderId} not found`);

  const so = soSnap.data() as SalesOrder;
  const existingPayments: PaymentRecord[] = so.payments || [];
  const existingTotalPaid = so.totalPaid || 0;

  // Parse payment date or default to now
  const pmtDate = payment.paymentDate
    ? Timestamp.fromDate(new Date(payment.paymentDate + 'T12:00:00'))
    : Timestamp.now();

  const newPayment: PaymentRecord = {
    id: `pmt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    type: payment.type,
    method: payment.method,
    amount: payment.amount,
    currency: payment.currency,
    paymentDate: pmtDate,
    receiptRef: payment.receiptRef,
    receiptDocumentNumber: payment.receiptDocumentNumber,
    receiptPdfUrl: payment.receiptPdfUrl,
    sharedViaWhatsApp: payment.sharedViaWhatsApp ?? false,
    whatsAppPhone: payment.whatsAppPhone,
    recordedAt: Timestamp.now(),
    recordedBy: userId,
  };

  const newTotalPaid = existingTotalPaid + payment.amount;
  const newBalance = (so.currentAmount || 0) - newTotalPaid;

  await updateDoc(soRef, {
    payments: [...existingPayments, cleanUndefined(newPayment as unknown as Record<string, unknown>)],
    totalPaid: newTotalPaid,
    balanceRemaining: Math.max(0, newBalance),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  // Emit business event
  try {
    await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
      type: 'payment_recorded',
      entityType: 'salesOrder',
      entityId: orderId,
      data: cleanUndefined({
        orderNumber: so.orderNumber,
        customerName: so.customerName,
        paymentType: payment.type,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        receiptRef: payment.receiptRef,
        paymentDate: payment.paymentDate,
        totalPaid: newTotalPaid,
        balanceRemaining: Math.max(0, newBalance),
      } as unknown as Record<string, unknown>),
      userId,
      timestamp: serverTimestamp(),
    });
  } catch (eventError) {
    console.error('[SalesOrderService] Failed to emit payment business event:', eventError);
  }

  return newPayment;
}

/**
 * Update an existing payment line on a Sales Order.
 * Recomputes totalPaid and balanceRemaining. Drops QBO link fields on the
 * edited row so QuickBooks can be re-synced.
 */
export async function updatePayment(
  orderId: string,
  paymentId: string,
  payment: {
    type: PaymentType;
    method: PaymentMethod;
    amount: number;
    currency: string;
    paymentDate?: string;
    receiptRef?: string;
  },
  userId: string,
): Promise<PaymentRecord> {
  const soRef = doc(db, SO_COLLECTION, orderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error(`Sales Order ${orderId} not found`);

  const so = soSnap.data() as SalesOrder;
  const existingPayments: PaymentRecord[] = so.payments || [];
  const idx = existingPayments.findIndex((p) => p.id === paymentId);
  if (idx < 0) throw new Error(`Payment ${paymentId} not found on this order`);

  const prev = existingPayments[idx];
  const pmtDate = payment.paymentDate
    ? Timestamp.fromDate(new Date(payment.paymentDate + 'T12:00:00'))
    : prev.paymentDate;

  const updated: PaymentRecord = {
    id: prev.id,
    type: payment.type,
    method: payment.method,
    amount: payment.amount,
    currency: payment.currency,
    paymentDate: pmtDate,
    receiptRef: payment.receiptRef,
    receiptDocumentNumber: prev.receiptDocumentNumber,
    receiptPdfUrl: prev.receiptPdfUrl,
    sharedViaWhatsApp: prev.sharedViaWhatsApp,
    whatsAppPhone: prev.whatsAppPhone,
    recordedAt: prev.recordedAt,
    recordedBy: prev.recordedBy,
  };

  const newPayments = [...existingPayments];
  newPayments[idx] = cleanUndefined(updated as unknown as Record<string, unknown>) as unknown as PaymentRecord;

  const newTotalPaid = newPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const newBalance = (so.currentAmount || 0) - newTotalPaid;

  await updateDoc(soRef, {
    payments: newPayments,
    totalPaid: newTotalPaid,
    balanceRemaining: Math.max(0, newBalance),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  try {
    await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
      type: 'payment_updated',
      entityType: 'salesOrder',
      entityId: orderId,
      data: cleanUndefined({
        orderNumber: so.orderNumber,
        customerName: so.customerName,
        paymentId,
        paymentType: payment.type,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        totalPaid: newTotalPaid,
        balanceRemaining: Math.max(0, newBalance),
      } as unknown as Record<string, unknown>),
      userId,
      timestamp: serverTimestamp(),
    });
  } catch (eventError) {
    console.error('[SalesOrderService] Failed to emit payment update event:', eventError);
  }

  return updated;
}

/**
 * Remove a payment line from a Sales Order and recompute totals.
 * Does not delete any QuickBooks payment — remove or adjust that in QBO if needed.
 */
export async function deletePayment(
  orderId: string,
  paymentId: string,
  userId: string,
): Promise<void> {
  const soRef = doc(db, SO_COLLECTION, orderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error(`Sales Order ${orderId} not found`);

  const so = soSnap.data() as SalesOrder;
  const existingPayments: PaymentRecord[] = so.payments || [];
  const idx = existingPayments.findIndex((p) => p.id === paymentId);
  if (idx < 0) throw new Error(`Payment ${paymentId} not found on this order`);

  const removed = existingPayments[idx];
  const newPayments = existingPayments.filter((p) => p.id !== paymentId);
  const newTotalPaid = newPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const newBalance = (so.currentAmount || 0) - newTotalPaid;

  await updateDoc(soRef, {
    payments: newPayments,
    totalPaid: newTotalPaid,
    balanceRemaining: Math.max(0, newBalance),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  try {
    await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
      type: 'payment_deleted',
      entityType: 'salesOrder',
      entityId: orderId,
      data: cleanUndefined({
        orderNumber: so.orderNumber,
        customerName: so.customerName,
        paymentId,
        removedAmount: removed.amount,
        removedType: removed.type,
        totalPaid: newTotalPaid,
        balanceRemaining: Math.max(0, newBalance),
        hadQboPaymentId: !!removed.qboPaymentId,
      } as unknown as Record<string, unknown>),
      userId,
      timestamp: serverTimestamp(),
    });
  } catch (eventError) {
    console.error('[SalesOrderService] Failed to emit payment delete event:', eventError);
  }
}

/** Update WhatsApp / receipt artifact fields on an existing payment row (no amount changes). */
export async function patchPaymentWhatsAppDelivery(
  orderId: string,
  paymentId: string,
  patch: {
    receiptPdfUrl?: string;
    sharedViaWhatsApp?: boolean;
    whatsAppPhone?: string;
  },
  userId: string,
): Promise<void> {
  const soRef = doc(db, SO_COLLECTION, orderId);
  const soSnap = await getDoc(soRef);
  if (!soSnap.exists()) throw new Error(`Sales Order ${orderId} not found`);

  const so = soSnap.data() as SalesOrder;
  const payments = [...(so.payments || [])];
  const idx = payments.findIndex((p) => p.id === paymentId);
  if (idx < 0) throw new Error(`Payment ${paymentId} not found on this order`);

  const prev = payments[idx];
  const updated: PaymentRecord = { ...prev };
  if (patch.receiptPdfUrl !== undefined) updated.receiptPdfUrl = patch.receiptPdfUrl;
  if (patch.sharedViaWhatsApp === true) updated.sharedViaWhatsApp = true;
  if (patch.whatsAppPhone !== undefined) updated.whatsAppPhone = patch.whatsAppPhone;

  payments[idx] = cleanUndefined(updated as unknown as Record<string, unknown>) as unknown as PaymentRecord;

  await updateDoc(soRef, {
    payments,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/** Remove undefined fields to prevent Firestore errors */
function cleanUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}
