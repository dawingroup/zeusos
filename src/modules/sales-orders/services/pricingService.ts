/**
 * Pricing Service — Change Order impact calculator.
 *
 * Computes the delta revenue, estimated delta cost, and margin impact
 * of a change order against its parent sales order. Cost estimates
 * reach into the Design Manager's DesignItem rollups when available;
 * items without a linked design item or cost rollup mark the estimate
 * as incomplete (so the UI can warn before leaning on the number).
 *
 * This is the single source of truth for "what does this CO do to the
 * deal's margin?" and is called by:
 *   - CO creation wizard (Phase 2) — live preview before saving
 *   - CO detail panel (Phase 2) — recompute on open
 *   - Manufacturing cascade (Phase 4) — to confirm cost expectations
 */

import { doc, getDoc } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  ChangeOrder,
  ChangeOrderPriceImpact,
  SalesOrder,
  SalesOrderItem,
} from '../types';
import { CHANGE_ORDERS_COLLECTION, SO_COLLECTION } from '../constants';
import { getPolicy } from './discountPolicyService';
import type { DesignItem } from '@/modules/design-manager/types';

const DEFAULT_MIN_MARGIN_PERCENT = 15;

/**
 * Compute the full pricing impact of a change order. Safe to call for
 * any CO status — the math is based on item deltas, not on whether the
 * CO has been applied yet.
 */
export async function recalculateChangeOrderImpact(
  coId: string,
): Promise<ChangeOrderPriceImpact> {
  const coSnap = await getDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId));
  if (!coSnap.exists()) throw new Error('Change order not found');
  const co = { id: coSnap.id, ...coSnap.data() } as ChangeOrder;

  const soSnap = await getDoc(doc(db, SO_COLLECTION, co.salesOrderId));
  if (!soSnap.exists()) throw new Error('Sales order not found');
  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;

  return computeImpact(co, so);
}

/**
 * Compute impact against an in-memory CO + SO pair (no Firestore reads
 * except for design items). Use this in the creation wizard where the
 * CO hasn't been saved yet.
 */
export async function previewChangeOrderImpact(
  draft: Pick<
    ChangeOrder,
    | 'itemsAdded'
    | 'itemsRemoved'
    | 'itemsModified'
    | 'priceImpact'
    | 'salesOrderId'
    | 'negotiatedPriceAdjustment'
  > & { id?: string },
): Promise<ChangeOrderPriceImpact> {
  const soSnap = await getDoc(doc(db, SO_COLLECTION, draft.salesOrderId));
  if (!soSnap.exists()) throw new Error('Sales order not found');
  const so = { id: soSnap.id, ...soSnap.data() } as SalesOrder;

  const pseudo = { ...draft, id: draft.id ?? 'preview' } as ChangeOrder;
  return computeImpact(pseudo, so);
}

// ============================================================================
// CORE MATH
// ============================================================================

async function computeImpact(
  co: ChangeOrder,
  so: SalesOrder,
): Promise<ChangeOrderPriceImpact> {
  const warnings: string[] = [];

  // ── Revenue side ────────────────────────────────────────────────────────
  const addedRevenue = co.itemsAdded.reduce((sum, i) => sum + i.totalPrice, 0);
  const removedRevenue = co.itemsRemoved.reduce((sum, i) => sum + i.amount, 0);
  const modifiedRevenue = co.itemsModified.reduce((sum, m) => sum + m.priceImpact, 0);
  const negotiatedAdjustmentRevenue = co.negotiatedPriceAdjustment ?? 0;
  const deltaRevenue = addedRevenue - removedRevenue + modifiedRevenue + negotiatedAdjustmentRevenue;

  const previousOrderTotal = so.currentAmount;
  const newOrderTotal = previousOrderTotal + deltaRevenue;

  // ── Cost side (best-effort from design items) ──────────────────────────
  const missingCostItemIds: string[] = [];
  const designItemCache = new Map<string, DesignItem | null>();

  const resolveCostForDesignItem = async (
    designItemId: string,
    quantity: number,
  ): Promise<number | null> => {
    const di = await loadDesignItem(so.designProjectId, designItemId, designItemCache);
    if (!di) return null;
    const perUnit =
      di.manufacturingRollup?.costPerUnit ??
      di.manufacturing?.costPerUnit ??
      null;
    if (perUnit == null) return null;
    return perUnit * quantity;
  };

  let addedCost = 0;
  let removedCost = 0;
  let modifiedCost = 0;
  let costEstimateIsComplete = true;

  // Added items — iterate with design item lookup
  for (const added of co.itemsAdded) {
    if (!added.designItemId) {
      missingCostItemIds.push(added.id);
      costEstimateIsComplete = false;
      continue;
    }
    const cost = await resolveCostForDesignItem(added.designItemId, added.quantity);
    if (cost == null) {
      missingCostItemIds.push(added.id);
      costEstimateIsComplete = false;
      continue;
    }
    addedCost += cost;
  }

  // Removed items — look up SO scope item by id, use its designItemId
  for (const removal of co.itemsRemoved) {
    const soItem = so.scopeItems.find((i) => i.id === removal.itemId);
    if (!soItem?.designItemId) {
      missingCostItemIds.push(removal.itemId);
      costEstimateIsComplete = false;
      continue;
    }
    const cost = await resolveCostForDesignItem(soItem.designItemId, soItem.quantity);
    if (cost == null) {
      missingCostItemIds.push(removal.itemId);
      costEstimateIsComplete = false;
      continue;
    }
    removedCost += cost;
  }

  // Modified items — delta cost from quantity changes only (spec changes
  // don't move unit cost until Design Manager re-estimates, which is Phase 3).
  for (const mod of co.itemsModified) {
    if (mod.field !== 'quantity') continue;
    const soItem = so.scopeItems.find((i) => i.id === mod.itemId);
    if (!soItem?.designItemId) {
      missingCostItemIds.push(mod.itemId);
      costEstimateIsComplete = false;
      continue;
    }
    const perUnit = await perUnitCost(so.designProjectId, soItem.designItemId, designItemCache);
    if (perUnit == null) {
      missingCostItemIds.push(mod.itemId);
      costEstimateIsComplete = false;
      continue;
    }
    const oldQty = Number(mod.oldValue) || soItem.quantity;
    const newQty = Number(mod.newValue);
    modifiedCost += perUnit * (newQty - oldQty);
  }

  const deltaEstimatedCost = costEstimateIsComplete
    ? addedCost - removedCost + modifiedCost
    : null;

  // ── Margin side ─────────────────────────────────────────────────────────
  let previousMargin: number | null = null;
  let newMargin: number | null = null;
  let marginDelta: number | null = null;

  let previousCostTotal: number | null = null;
  if (costEstimateIsComplete) {
    previousCostTotal = await estimateSOCostTotal(so, designItemCache);
  }
  if (
    previousCostTotal !== null &&
    deltaEstimatedCost !== null &&
    previousOrderTotal > 0 &&
    newOrderTotal > 0
  ) {
    previousMargin = ((previousOrderTotal - previousCostTotal) / previousOrderTotal) * 100;
    const newCostTotal = previousCostTotal + deltaEstimatedCost;
    newMargin = ((newOrderTotal - newCostTotal) / newOrderTotal) * 100;
    marginDelta = newMargin - previousMargin;
  } else if (!costEstimateIsComplete) {
    warnings.push(
      `Cost estimate incomplete — ${missingCostItemIds.length} item(s) missing design-item cost data`,
    );
  }

  // ── Minimum margin check ────────────────────────────────────────────────
  const policy = await getPolicy(so.subsidiaryId).catch(() => null);
  const minimumMarginPercent = policy?.minimumMarginPercent ?? DEFAULT_MIN_MARGIN_PERCENT;
  const marginBelowMinimum =
    newMargin !== null && newMargin < minimumMarginPercent;
  if (marginBelowMinimum) {
    warnings.push(
      `New margin ${newMargin?.toFixed(1)}% is below the ${minimumMarginPercent}% minimum`,
    );
  }

  if (deltaRevenue < 0) {
    warnings.push('Net revenue impact is negative — client will be credited');
  }

  return {
    changeOrderId: co.id,
    salesOrderId: so.id,
    addedRevenue,
    removedRevenue,
    modifiedRevenue,
    negotiatedAdjustmentRevenue,
    deltaRevenue,
    previousOrderTotal,
    newOrderTotal,
    deltaEstimatedCost,
    costEstimateIsComplete,
    missingCostItemIds,
    previousMargin,
    newMargin,
    marginDelta,
    marginBelowMinimum,
    minimumMarginPercent,
    warnings,
    computedAt: Timestamp.now(),
  };
}

// ============================================================================
// DESIGN ITEM LOOKUP
// ============================================================================

async function loadDesignItem(
  projectId: string,
  designItemId: string,
  cache: Map<string, DesignItem | null>,
): Promise<DesignItem | null> {
  if (cache.has(designItemId)) return cache.get(designItemId)!;
  const snap = await getDoc(
    doc(db, 'designProjects', projectId, 'designItems', designItemId),
  );
  const item = snap.exists()
    ? ({ id: snap.id, ...snap.data() } as DesignItem)
    : null;
  cache.set(designItemId, item);
  return item;
}

async function perUnitCost(
  projectId: string,
  designItemId: string,
  cache: Map<string, DesignItem | null>,
): Promise<number | null> {
  const di = await loadDesignItem(projectId, designItemId, cache);
  if (!di) return null;
  return di.manufacturingRollup?.costPerUnit ?? di.manufacturing?.costPerUnit ?? null;
}

async function estimateSOCostTotal(
  so: SalesOrder,
  cache: Map<string, DesignItem | null>,
): Promise<number | null> {
  let total = 0;
  for (const item of so.scopeItems) {
    if (!item.isActive) continue;
    if (!item.designItemId) return null;
    const perUnit = await perUnitCost(so.designProjectId, item.designItemId, cache);
    if (perUnit == null) return null;
    total += perUnit * item.quantity;
  }
  return total;
}

// ============================================================================
// Utility exports for UI layer
// ============================================================================

/**
 * Convenience: given a draft CO item list, return the gross revenue
 * delta without hitting Firestore. Useful for real-time UI updates in
 * the Phase 2 creation wizard before the user commits.
 */
export function computeRevenueDelta(args: {
  itemsAdded: Pick<SalesOrderItem, 'totalPrice'>[];
  itemsRemoved: { amount: number }[];
  itemsModified: { priceImpact: number }[];
}): { added: number; removed: number; modified: number; net: number } {
  const added = args.itemsAdded.reduce((s, i) => s + i.totalPrice, 0);
  const removed = args.itemsRemoved.reduce((s, i) => s + i.amount, 0);
  const modified = args.itemsModified.reduce((s, i) => s + i.priceImpact, 0);
  return { added, removed, modified, net: added - removed + modified };
}
