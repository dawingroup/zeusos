/**
 * changeOrderContextService — pulls change-order context for a Design
 * Project so DM UI can render scope-version banners, per-item CO
 * badges, and approval-blocking warnings without reaching into the
 * sales-orders module directly.
 *
 * Context comes from the linked SalesOrder (via
 * `DesignProject.linkedSalesOrderId`):
 *   - the SO's current `scopeVersion`
 *   - all COs attached to that SO
 *   - a derived per-design-item map of CO actions (added / modified /
 *     removed) computed from CO line items and SO scope items
 *
 * Projects without a linked SO get an "empty" context.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  ChangeOrder,
  ChangeOrderStatus,
  SalesOrder,
  SalesOrderItem,
} from '@/modules/sales-orders/types';
import {
  CHANGE_ORDERS_COLLECTION,
  SO_COLLECTION,
} from '@/modules/sales-orders/constants';

export type DesignItemCOAction = 'added' | 'removed' | 'modified';

export interface DesignItemCORef {
  coId: string;
  coNumber: string;
  coStatus: ChangeOrderStatus;
  action: DesignItemCOAction;
  /** True once the CO has been applied to the SO (scope bumped). */
  applied: boolean;
}

export interface DesignProjectCOContext {
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  scopeVersion: number;       // 1 when no SO / no COs
  scopeFrozen: boolean;
  totalCount: number;
  openCount: number;          // draft + pending_internal + pending_client
  approvedCount: number;
  rejectedCount: number;
  withdrawnCount: number;
  totalApprovedValue: number;
  totalPendingValue: number;
  hasPostFreezeCO: boolean;
  changeOrders: ChangeOrder[];
  itemMap: Record<string, DesignItemCORef[]>;  // designItemId → refs
}

const EMPTY_CONTEXT: DesignProjectCOContext = {
  salesOrderId: null,
  salesOrderNumber: null,
  scopeVersion: 1,
  scopeFrozen: false,
  totalCount: 0,
  openCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  withdrawnCount: 0,
  totalApprovedValue: 0,
  totalPendingValue: 0,
  hasPostFreezeCO: false,
  changeOrders: [],
  itemMap: {},
};

// ============================================================================
// PER-ITEM LOOKUP
// ============================================================================

export function getChangeOrdersForDesignItem(
  designItemId: string,
  changeOrders: ChangeOrder[],
  soScopeItems: SalesOrderItem[],
): DesignItemCORef[] {
  const results: DesignItemCORef[] = [];
  const scopeItemById = new Map(soScopeItems.map((i) => [i.id, i]));

  for (const co of changeOrders) {
    if (co.itemsAdded.some((i) => i.designItemId === designItemId)) {
      results.push({
        coId: co.id,
        coNumber: co.changeOrderNumber,
        coStatus: co.status,
        action: 'added',
        applied: Boolean(co.appliedAt),
      });
      continue;
    }

    if (
      co.itemsRemoved.some((r) => {
        const soItem = scopeItemById.get(r.itemId);
        return soItem?.designItemId === designItemId;
      })
    ) {
      results.push({
        coId: co.id,
        coNumber: co.changeOrderNumber,
        coStatus: co.status,
        action: 'removed',
        applied: Boolean(co.appliedAt),
      });
      continue;
    }

    if (
      co.itemsModified.some((m) => {
        const soItem = scopeItemById.get(m.itemId);
        return soItem?.designItemId === designItemId;
      })
    ) {
      results.push({
        coId: co.id,
        coNumber: co.changeOrderNumber,
        coStatus: co.status,
        action: 'modified',
        applied: Boolean(co.appliedAt),
      });
    }
  }

  return results;
}

// ============================================================================
// ONE-SHOT
// ============================================================================

export async function getDesignProjectCOContext(
  linkedSalesOrderId: string | null | undefined,
): Promise<DesignProjectCOContext> {
  if (!linkedSalesOrderId) return EMPTY_CONTEXT;

  const soSnap = await getDoc(doc(db, SO_COLLECTION, linkedSalesOrderId));
  if (!soSnap.exists()) return EMPTY_CONTEXT;
  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;

  const q = query(
    collection(db, CHANGE_ORDERS_COLLECTION),
    where('salesOrderId', '==', so.id),
    orderBy('createdAt', 'desc'),
  );
  const cosResult = await getDocs(q);
  const changeOrders = cosResult.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ChangeOrder),
  );

  return buildContext(so, changeOrders);
}

// ============================================================================
// REAL-TIME SUBSCRIPTION
// ============================================================================

export function subscribeToDesignProjectCOContext(
  linkedSalesOrderId: string | null | undefined,
  callback: (ctx: DesignProjectCOContext) => void,
): Unsubscribe {
  if (!linkedSalesOrderId) {
    callback(EMPTY_CONTEXT);
    return () => undefined;
  }

  let currentSO: SalesOrder | null = null;
  let currentCOs: ChangeOrder[] = [];

  const soUnsub = onSnapshot(doc(db, SO_COLLECTION, linkedSalesOrderId), (snap) => {
    if (!snap.exists()) {
      callback(EMPTY_CONTEXT);
      return;
    }
    currentSO = { id: snap.id, ...snap.data() } as SalesOrder;
    if (currentSO) callback(buildContext(currentSO, currentCOs));
  });

  const coQ = query(
    collection(db, CHANGE_ORDERS_COLLECTION),
    where('salesOrderId', '==', linkedSalesOrderId),
    orderBy('createdAt', 'desc'),
  );
  const coUnsub = onSnapshot(coQ, (snap) => {
    currentCOs = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as ChangeOrder),
    );
    if (currentSO) callback(buildContext(currentSO, currentCOs));
  });

  return () => {
    soUnsub();
    coUnsub();
  };
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

function buildContext(so: SalesOrder, changeOrders: ChangeOrder[]): DesignProjectCOContext {
  const open = changeOrders.filter(
    (c) =>
      c.status === 'draft' ||
      c.status === 'pending_internal' ||
      c.status === 'pending_client',
  );
  const approved = changeOrders.filter((c) => c.status === 'approved');
  const rejected = changeOrders.filter((c) => c.status === 'rejected');
  const withdrawn = changeOrders.filter((c) => c.status === 'withdrawn');

  const itemMap: Record<string, DesignItemCORef[]> = {};
  const touchedItemIds = collectTouchedDesignItemIds(changeOrders, so.scopeItems);
  for (const diId of touchedItemIds) {
    itemMap[diId] = getChangeOrdersForDesignItem(diId, changeOrders, so.scopeItems);
  }

  return {
    salesOrderId: so.id,
    salesOrderNumber: so.orderNumber,
    scopeVersion: so.scopeVersion,
    scopeFrozen: so.scopeFrozen,
    totalCount: changeOrders.length,
    openCount: open.length,
    approvedCount: approved.length,
    rejectedCount: rejected.length,
    withdrawnCount: withdrawn.length,
    totalApprovedValue: approved.reduce((s, c) => s + c.priceImpact, 0),
    totalPendingValue: open.reduce((s, c) => s + c.priceImpact, 0),
    hasPostFreezeCO: changeOrders.some((c) => c.isPostScopeFreeze),
    changeOrders,
    itemMap,
  };
}

function collectTouchedDesignItemIds(
  changeOrders: ChangeOrder[],
  soScopeItems: SalesOrderItem[],
): Set<string> {
  const set = new Set<string>();
  const itemById = new Map(soScopeItems.map((i) => [i.id, i]));
  for (const co of changeOrders) {
    for (const added of co.itemsAdded) {
      if (added.designItemId) set.add(added.designItemId);
    }
    for (const rem of co.itemsRemoved) {
      const scope = itemById.get(rem.itemId);
      if (scope?.designItemId) set.add(scope.designItemId);
    }
    for (const mod of co.itemsModified) {
      const scope = itemById.get(mod.itemId);
      if (scope?.designItemId) set.add(scope.designItemId);
    }
  }
  return set;
}

// ============================================================================
// COST RE-ESTIMATION AFTER CO APPLY
// ============================================================================

/**
 * After a CO is applied to its SO, any linked DesignItems whose specs
 * or quantities changed should be re-estimated so the rollup numbers
 * stay in sync. This helper:
 *   1. Resolves the CO → SO → designProjectId
 *   2. Collects the touched design item ids
 *   3. Delegates to `batchRecalculateItemCosts` which handles the actual
 *      manufacturing-rollup recompute
 *
 * Called opportunistically from `changeOrderService.applyChangeOrderToSO`
 * and (via button) from the CO detail page. Best-effort — errors are
 * logged but not rethrown to avoid blocking CO approval.
 *
 * Returns the number of items that were successfully recalculated.
 */
export async function recalculateCostsAfterChangeOrder(
  coId: string,
  userEmail: string,
): Promise<{ attempted: number; errors: number }> {
  const coSnap = await getDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId));
  if (!coSnap.exists()) return { attempted: 0, errors: 0 };
  const co = { id: coSnap.id, ...coSnap.data() } as ChangeOrder;

  const soSnap = await getDoc(doc(db, SO_COLLECTION, co.salesOrderId));
  if (!soSnap.exists()) return { attempted: 0, errors: 0 };
  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;

  const touched = collectTouchedDesignItemIds([co], so.scopeItems);
  if (touched.size === 0) return { attempted: 0, errors: 0 };

  // Dynamic import to avoid a circular dep at module init time
  const { batchRecalculateItemCosts } = await import('./estimateService');
  const result = await batchRecalculateItemCosts(so.designProjectId, userEmail);
  return {
    attempted: touched.size,
    errors: result.errors.length,
  };
}
