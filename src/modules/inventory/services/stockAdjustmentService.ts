/**
 * Stock Adjustment Service
 * CRUD operations for stock adjustments with Firestore.
 */

import {
  fetchCollection,
  fetchDocument,
  updateDocument,
  subscribeToCollection,
  where,
  orderBy,
  limit,
  type QueryConstraint,
} from '@/shared/services/firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import {
  collection,
  Timestamp,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import type {
  StockAdjustment,
  AdjustmentStatus,
  AdjustmentType,
  StockAdjustmentLineItem,
} from '../types/stockAdjustment';
import type { StockAdjustmentFormData } from '../schemas/stockAdjustment.schema';

const COLLECTION = 'stock_adjustments';

// ── Read Operations ──────────────────────────────────────────────────────────

export async function getStockAdjustmentById(id: string): Promise<StockAdjustment | null> {
  const data = await fetchDocument<StockAdjustment>(COLLECTION, id);
  if (!data) return null;
  return { ...data, id };
}

export interface StockAdjustmentFilters {
  status?: AdjustmentStatus;
  adjustmentType?: AdjustmentType;
  dateFrom?: Date;
  dateTo?: Date;
  itemId?: string;
}

export async function getStockAdjustments(
  organizationId: string,
  filters?: StockAdjustmentFilters,
  maxResults = 100
): Promise<StockAdjustment[]> {
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
  ];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.adjustmentType) {
    constraints.push(where('adjustmentType', '==', filters.adjustmentType));
  }
  if (filters?.dateFrom) {
    constraints.push(where('createdAt', '>=', Timestamp.fromDate(filters.dateFrom)));
  }
  if (filters?.dateTo) {
    constraints.push(where('createdAt', '<=', Timestamp.fromDate(filters.dateTo)));
  }
  if (filters?.itemId) {
    constraints.push(where('itemIds', 'array-contains', filters.itemId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(maxResults));

  return fetchCollection<StockAdjustment>(COLLECTION, constraints);
}

export async function getAdjustmentsByItem(
  organizationId: string,
  itemId: string,
  maxResults = 50
): Promise<StockAdjustment[]> {
  return fetchCollection<StockAdjustment>(COLLECTION, [
    where('organizationId', '==', organizationId),
    where('itemIds', 'array-contains', itemId),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  ]);
}

// ── Subscription ─────────────────────────────────────────────────────────────

export function subscribeToStockAdjustments(
  organizationId: string,
  callback: (adjustments: StockAdjustment[]) => void,
  filters?: Pick<StockAdjustmentFilters, 'status'>,
  onError?: (error: Error) => void
) {
  const constraints: QueryConstraint[] = [
    where('organizationId', '==', organizationId),
  ];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(200));

  return subscribeToCollection<StockAdjustment>(
    COLLECTION,
    callback,
    constraints,
    onError
  );
}

// ── Write Operations ─────────────────────────────────────────────────────────

function computeTotals(lineItems: StockAdjustmentLineItem[]) {
  const totalIncreaseValue = lineItems
    .filter(l => l.direction === 'increase')
    .reduce((sum, l) => sum + l.totalValue, 0);
  const totalDecreaseValue = lineItems
    .filter(l => l.direction === 'decrease')
    .reduce((sum, l) => sum + l.totalValue, 0);
  return {
    totalIncreaseValue,
    totalDecreaseValue,
    netValueImpact: totalIncreaseValue - totalDecreaseValue,
    lineCount: lineItems.length,
  };
}

export async function createStockAdjustment(
  data: StockAdjustmentFormData,
  userId: string,
  organizationId: string,
  subsidiaryId?: string
): Promise<string> {
  const totals = computeTotals(data.lineItems as StockAdjustmentLineItem[]);
  const itemIds = [...new Set(data.lineItems.map(l => l.itemId).filter(Boolean))];
  const offcutIds = [...new Set(data.lineItems.map(l => (l as any).offcutId).filter(Boolean))];

  // Strip undefined values — Firestore rejects them
  const stripUndefined = (obj: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(obj)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) =>
          v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && typeof (v as any).toDate !== 'function'
            ? [k, stripUndefined(v as Record<string, unknown>)]
            : [k, v],
        ),
    );

  const docData = stripUndefined({
    ...data,
    organizationId,
    subsidiaryId: subsidiaryId || null,
    status: 'draft' as AdjustmentStatus,
    adjustmentNumber: '', // Set by Cloud Function on create
    isAutoApproved: false,
    qboSyncStatus: 'pending' as const,
    itemIds,
    ...(offcutIds.length > 0 ? { offcutIds } : {}),
    ...totals,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const colRef = collection(db, COLLECTION);
  const docRef = await addDoc(colRef, docData as any);
  return docRef.id;
}

export async function updateStockAdjustment(
  id: string,
  data: Partial<StockAdjustmentFormData>,
  userId: string
): Promise<void> {
  const updates: Record<string, unknown> = {
    ...data,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  };

  // Recompute totals if lineItems changed
  if (data.lineItems) {
    const totals = computeTotals(data.lineItems as StockAdjustmentLineItem[]);
    Object.assign(updates, totals);
    updates.itemIds = [...new Set(data.lineItems.map(l => l.itemId).filter(Boolean))];
    const updatedOffcutIds = [...new Set(data.lineItems.map(l => (l as any).offcutId).filter(Boolean))];
    if (updatedOffcutIds.length > 0) updates.offcutIds = updatedOffcutIds;
  }

  await updateDocument(COLLECTION, id, updates);
}

// ── Status Transitions ───────────────────────────────────────────────────────

export async function submitStockAdjustment(id: string, userId: string): Promise<void> {
  await updateDocument(COLLECTION, id, {
    status: 'submitted',
    submittedAt: serverTimestamp(),
    submittedBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function approveStockAdjustment(id: string, userId: string): Promise<void> {
  // Fetch the adjustment to validate status
  const adjustment = await getStockAdjustmentById(id);
  if (!adjustment) throw new Error('Adjustment not found');
  // Idempotent: if already approved (e.g. auto-approved by cloud function), skip
  if (adjustment.status === 'approved') return;
  if (adjustment.status !== 'submitted') throw new Error('Only submitted adjustments can be approved');

  // Mark as approved — the cloud function (handleApproved) will apply
  // stock changes to inventoryItems, stockLevels, and record movements.
  // Do NOT apply stock here to avoid double-counting.
  await updateDocument(COLLECTION, id, {
    status: 'approved',
    approvedAt: serverTimestamp(),
    approvedBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function rejectStockAdjustment(
  id: string,
  userId: string,
  reason: string
): Promise<void> {
  await updateDocument(COLLECTION, id, {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
    rejectedBy: userId,
    rejectionReason: reason,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

export async function cancelStockAdjustment(id: string, userId: string): Promise<void> {
  await updateDocument(COLLECTION, id, {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}
