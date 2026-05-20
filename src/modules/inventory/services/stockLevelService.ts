/**
 * Stock Level Service
 * Multi-location stock tracking with reservations, consumption, transfers, and audit trail
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  increment,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  StockLevel,
  StockMovement,
  StockMovementType,
  StockMovementReferenceType,
  CostHistoryEntry,
  CostChangeSource,
  StockTransferRequest,
} from '../types/warehouse';
import { validateTransactableItem } from './transactionGuard';

const STOCK_LEVELS_COLLECTION = 'stockLevels';
const MOVEMENTS_SUBCOLLECTION = 'movements';
const COST_HISTORY_COLLECTION = 'costHistory';
const INVENTORY_ITEMS_COLLECTION = 'inventoryItems';

// ============================================
// Stock Level Queries
// ============================================

/**
 * Get all stock levels for an inventory item across all locations
 */
export async function getStockLevels(inventoryItemId: string): Promise<StockLevel[]> {
  const q = query(
    collection(db, STOCK_LEVELS_COLLECTION),
    where('inventoryItemId', '==', inventoryItemId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockLevel));
}

/**
 * Get all stock levels at a specific warehouse
 */
export async function getStockByWarehouse(warehouseId: string): Promise<StockLevel[]> {
  const q = query(
    collection(db, STOCK_LEVELS_COLLECTION),
    where('warehouseId', '==', warehouseId),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StockLevel));
}

/**
 * Get a specific stock level (item + warehouse combo)
 */
export async function getStockLevel(
  inventoryItemId: string,
  warehouseId: string,
): Promise<StockLevel | null> {
  const q = query(
    collection(db, STOCK_LEVELS_COLLECTION),
    where('inventoryItemId', '==', inventoryItemId),
    where('warehouseId', '==', warehouseId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as StockLevel;
}

/**
 * Get aggregated stock across all locations for an item
 */
export async function getAggregatedStock(inventoryItemId: string): Promise<{
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
}> {
  const levels = await getStockLevels(inventoryItemId);
  return levels.reduce(
    (acc, sl) => ({
      totalOnHand: acc.totalOnHand + sl.quantityOnHand,
      totalReserved: acc.totalReserved + sl.quantityReserved,
      totalAvailable: acc.totalAvailable + sl.quantityAvailable,
    }),
    { totalOnHand: 0, totalReserved: 0, totalAvailable: 0 },
  );
}

// ============================================
// Stock Level Subscriptions
// ============================================

/**
 * Subscribe to stock levels at a warehouse (real-time)
 */
export function subscribeToStockByWarehouse(
  warehouseId: string,
  callback: (levels: StockLevel[]) => void,
): () => void {
  const q = query(
    collection(db, STOCK_LEVELS_COLLECTION),
    where('warehouseId', '==', warehouseId),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StockLevel)));
  });
}

/**
 * Subscribe to stock levels for an item across all locations (real-time)
 */
export function subscribeToStockLevels(
  inventoryItemId: string,
  callback: (levels: StockLevel[]) => void,
): () => void {
  const q = query(
    collection(db, STOCK_LEVELS_COLLECTION),
    where('inventoryItemId', '==', inventoryItemId),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as StockLevel)));
  });
}

// ============================================
// Stock Adjustments
// ============================================

/**
 * Get or create a stock level document for an item+warehouse combo
 */
async function getOrCreateStockLevel(
  inventoryItemId: string,
  warehouseId: string,
  sku: string,
  itemName: string,
): Promise<string> {
  const existing = await getStockLevel(inventoryItemId, warehouseId);
  if (existing) return existing.id;

  const docRef = await addDoc(collection(db, STOCK_LEVELS_COLLECTION), {
    inventoryItemId,
    warehouseId,
    sku,
    itemName,
    quantityOnHand: 0,
    quantityReserved: 0,
    quantityAvailable: 0,
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Record a stock movement and update stock level atomically
 */
async function recordMovement(
  stockLevelId: string,
  movement: {
    type: StockMovementType;
    quantity: number;
    referenceType: StockMovementReferenceType;
    referenceId: string;
    notes?: string;
    performedBy: string;
  },
  updates: {
    quantityOnHand?: number;
    quantityReserved?: number;
  },
): Promise<void> {
  const batch = writeBatch(db);

  // Record movement in subcollection
  const movementRef = doc(
    collection(db, STOCK_LEVELS_COLLECTION, stockLevelId, MOVEMENTS_SUBCOLLECTION),
  );
  batch.set(movementRef, {
    ...movement,
    performedAt: serverTimestamp(),
  });

  // Update stock level
  const stockRef = doc(db, STOCK_LEVELS_COLLECTION, stockLevelId);
  const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };

  if (updates.quantityOnHand !== undefined) {
    updateData.quantityOnHand = increment(updates.quantityOnHand);
    updateData.quantityAvailable = increment(
      updates.quantityOnHand - (updates.quantityReserved ?? 0),
    );
  }
  if (updates.quantityReserved !== undefined && updates.quantityOnHand === undefined) {
    updateData.quantityReserved = increment(updates.quantityReserved);
    updateData.quantityAvailable = increment(-updates.quantityReserved);
  }

  if (movement.type === 'receipt') {
    updateData.lastReceivedAt = serverTimestamp();
  } else if (movement.type === 'consumption') {
    updateData.lastConsumedAt = serverTimestamp();
  }

  batch.update(stockRef, updateData);
  await batch.commit();
}

/**
 * Receive stock from a purchase order
 * Updates both stockLevels (per-warehouse) and inventoryItems.inventory.inStock (aggregate)
 */
export async function receiveStock(
  inventoryItemId: string,
  warehouseId: string,
  sku: string,
  itemName: string,
  quantity: number,
  poId: string,
  userId: string,
  notes?: string,
): Promise<void> {
  await validateTransactableItem(inventoryItemId, 'stock-adjustment');
  const stockLevelId = await getOrCreateStockLevel(inventoryItemId, warehouseId, sku, itemName);
  await recordMovement(
    stockLevelId,
    {
      type: 'receipt',
      quantity,
      referenceType: 'po',
      referenceId: poId,
      notes,
      performedBy: userId,
    },
    { quantityOnHand: quantity },
  );

  // Also update the inventory item's aggregate inStock count
  const itemRef = doc(db, INVENTORY_ITEMS_COLLECTION, inventoryItemId);
  await updateDoc(itemRef, {
    'inventory.inStock': increment(quantity),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Reserve stock for a manufacturing order
 */
export async function reserveStock(
  inventoryItemId: string,
  warehouseId: string,
  sku: string,
  itemName: string,
  quantity: number,
  moId: string,
  userId: string,
): Promise<{ stockLevelId: string; success: boolean; availableQty: number }> {
  await validateTransactableItem(inventoryItemId, 'stock-adjustment');
  const stockLevelId = await getOrCreateStockLevel(inventoryItemId, warehouseId, sku, itemName);

  // Check availability in a transaction
  return runTransaction(db, async (transaction) => {
    const stockRef = doc(db, STOCK_LEVELS_COLLECTION, stockLevelId);
    const stockSnap = await transaction.get(stockRef);
    const data = stockSnap.data();
    const available = (data?.quantityAvailable ?? 0) as number;

    if (available < quantity) {
      return { stockLevelId, success: false, availableQty: available };
    }

    // Reserve the stock
    transaction.update(stockRef, {
      quantityReserved: increment(quantity),
      quantityAvailable: increment(-quantity),
      updatedAt: serverTimestamp(),
    });

    // Record movement
    const movementRef = doc(
      collection(db, STOCK_LEVELS_COLLECTION, stockLevelId, MOVEMENTS_SUBCOLLECTION),
    );
    transaction.set(movementRef, {
      type: 'reservation',
      quantity: -quantity,
      referenceType: 'mo',
      referenceId: moId,
      performedBy: userId,
      performedAt: serverTimestamp(),
    });

    return { stockLevelId, success: true, availableQty: available - quantity };
  });
}

/**
 * Consume reserved stock during manufacturing
 * Updates both stockLevels (per-warehouse) and inventoryItems.inventory.inStock (aggregate)
 */
export async function consumeStock(
  inventoryItemId: string,
  warehouseId: string,
  quantity: number,
  moId: string,
  userId: string,
): Promise<void> {
  await validateTransactableItem(inventoryItemId, 'stock-adjustment');
  const stockLevel = await getStockLevel(inventoryItemId, warehouseId);
  if (!stockLevel) throw new Error('Stock level not found');

  const batch = writeBatch(db);
  const stockRef = doc(db, STOCK_LEVELS_COLLECTION, stockLevel.id);

  // Decrease both onHand and reserved (available stays same)
  batch.update(stockRef, {
    quantityOnHand: increment(-quantity),
    quantityReserved: increment(-quantity),
    lastConsumedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Record movement
  const movementRef = doc(
    collection(db, STOCK_LEVELS_COLLECTION, stockLevel.id, MOVEMENTS_SUBCOLLECTION),
  );
  batch.set(movementRef, {
    type: 'consumption',
    quantity: -quantity,
    referenceType: 'mo',
    referenceId: moId,
    performedBy: userId,
    performedAt: serverTimestamp(),
  });

  // Also update the inventory item's aggregate inStock count
  const itemRef = doc(db, INVENTORY_ITEMS_COLLECTION, inventoryItemId);
  batch.update(itemRef, {
    'inventory.inStock': increment(-quantity),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Release previously reserved stock (e.g., MO cancelled)
 */
export async function releaseStock(
  inventoryItemId: string,
  warehouseId: string,
  quantity: number,
  moId: string,
  userId: string,
): Promise<void> {
  await validateTransactableItem(inventoryItemId, 'stock-adjustment');
  const stockLevel = await getStockLevel(inventoryItemId, warehouseId);
  if (!stockLevel) throw new Error('Stock level not found');

  const batch = writeBatch(db);
  const stockRef = doc(db, STOCK_LEVELS_COLLECTION, stockLevel.id);

  batch.update(stockRef, {
    quantityReserved: increment(-quantity),
    quantityAvailable: increment(quantity),
    updatedAt: serverTimestamp(),
  });

  const movementRef = doc(
    collection(db, STOCK_LEVELS_COLLECTION, stockLevel.id, MOVEMENTS_SUBCOLLECTION),
  );
  batch.set(movementRef, {
    type: 'release',
    quantity,
    referenceType: 'mo',
    referenceId: moId,
    performedBy: userId,
    performedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Manually unreserve stock (admin action)
 * Releases reserved quantity without requiring a specific MO reference.
 * Records movement with referenceType 'manual' for audit trail.
 */
export async function manualUnreserveStock(
  inventoryItemId: string,
  warehouseId: string,
  quantity: number,
  userId: string,
  reason: string,
): Promise<void> {
  const stockLevel = await getStockLevel(inventoryItemId, warehouseId);
  if (!stockLevel) throw new Error('Stock level not found for this item and warehouse');

  if (quantity <= 0) throw new Error('Quantity must be greater than zero');
  if (quantity > stockLevel.quantityReserved) {
    throw new Error(
      `Cannot unreserve ${quantity} — only ${stockLevel.quantityReserved} currently reserved`,
    );
  }

  await recordMovement(
    stockLevel.id,
    {
      type: 'release',
      quantity,
      referenceType: 'manual',
      referenceId: `MANUAL-${Date.now()}`,
      notes: reason,
      performedBy: userId,
    },
    { quantityReserved: -quantity },
  );
}

/**
 * Transfer stock between warehouses
 */
export async function transferStock(
  request: StockTransferRequest,
  userId: string,
): Promise<void> {
  const { inventoryItemId, fromWarehouseId, toWarehouseId, quantity, notes } = request;

  await validateTransactableItem(inventoryItemId, 'stock-adjustment');

  // Get source stock level
  const sourceStock = await getStockLevel(inventoryItemId, fromWarehouseId);
  if (!sourceStock) throw new Error('Source stock level not found');
  if (sourceStock.quantityAvailable < quantity) {
    throw new Error(
      `Insufficient available stock. Available: ${sourceStock.quantityAvailable}, Requested: ${quantity}`,
    );
  }

  // Get/create destination stock level
  const destStockId = await getOrCreateStockLevel(
    inventoryItemId,
    toWarehouseId,
    sourceStock.sku,
    sourceStock.itemName,
  );

  const transferId = `TRF-${Date.now()}`;
  const batch = writeBatch(db);

  // Decrease source
  const sourceRef = doc(db, STOCK_LEVELS_COLLECTION, sourceStock.id);
  batch.update(sourceRef, {
    quantityOnHand: increment(-quantity),
    quantityAvailable: increment(-quantity),
    updatedAt: serverTimestamp(),
  });

  // Source movement
  const sourceMovementRef = doc(
    collection(db, STOCK_LEVELS_COLLECTION, sourceStock.id, MOVEMENTS_SUBCOLLECTION),
  );
  batch.set(sourceMovementRef, {
    type: 'transfer',
    quantity: -quantity,
    referenceType: 'transfer',
    referenceId: transferId,
    notes: notes ?? `Transfer to warehouse ${toWarehouseId}`,
    performedBy: userId,
    performedAt: serverTimestamp(),
  });

  // Increase destination
  const destRef = doc(db, STOCK_LEVELS_COLLECTION, destStockId);
  batch.update(destRef, {
    quantityOnHand: increment(quantity),
    quantityAvailable: increment(quantity),
    lastReceivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Destination movement
  const destMovementRef = doc(
    collection(db, STOCK_LEVELS_COLLECTION, destStockId, MOVEMENTS_SUBCOLLECTION),
  );
  batch.set(destMovementRef, {
    type: 'transfer',
    quantity,
    referenceType: 'transfer',
    referenceId: transferId,
    notes: notes ?? `Transfer from warehouse ${fromWarehouseId}`,
    performedBy: userId,
    performedAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Manual stock adjustment (inventory count correction)
 */
export async function adjustStock(
  inventoryItemId: string,
  warehouseId: string,
  sku: string,
  itemName: string,
  quantityDelta: number,
  userId: string,
  notes?: string,
): Promise<void> {
  await validateTransactableItem(inventoryItemId, 'stock-adjustment');
  const stockLevelId = await getOrCreateStockLevel(inventoryItemId, warehouseId, sku, itemName);
  await recordMovement(
    stockLevelId,
    {
      type: 'adjustment',
      quantity: quantityDelta,
      referenceType: 'manual',
      referenceId: `ADJ-${Date.now()}`,
      notes,
      performedBy: userId,
    },
    { quantityOnHand: quantityDelta },
  );

  // Also update the inventory item's aggregate inStock count
  const itemRef = doc(db, INVENTORY_ITEMS_COLLECTION, inventoryItemId);
  await updateDoc(itemRef, {
    'inventory.inStock': increment(quantityDelta),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Recalculate stock balances after a UoM conversion factor change.
 * Applies the ratio (newFactor / oldFactor) to all stock levels for the item.
 * Records adjustment movements for audit trail.
 */
export async function recalculateStockForConversionChange(
  inventoryItemId: string,
  oldFactor: number,
  newFactor: number,
  userId: string,
): Promise<{ adjustedLocations: number; totalDelta: number }> {
  if (oldFactor <= 0 || newFactor <= 0) {
    throw new Error('Conversion factors must be positive numbers');
  }
  if (oldFactor === newFactor) {
    return { adjustedLocations: 0, totalDelta: 0 };
  }

  const ratio = newFactor / oldFactor;
  const stockLevels = await getStockLevels(inventoryItemId);

  if (stockLevels.length === 0) {
    return { adjustedLocations: 0, totalDelta: 0 };
  }

  let adjustedLocations = 0;
  let totalDelta = 0;

  for (const sl of stockLevels) {
    const currentOnHand = sl.quantityOnHand ?? 0;
    const currentReserved = sl.quantityReserved ?? 0;

    if (currentOnHand === 0 && currentReserved === 0) continue;

    const newOnHand = Math.round(currentOnHand * ratio * 1000) / 1000;
    const newReserved = Math.round(currentReserved * ratio * 1000) / 1000;
    const deltaOnHand = newOnHand - currentOnHand;

    const stockLevelRef = doc(db, STOCK_LEVELS_COLLECTION, sl.id);
    const batch = writeBatch(db);

    // Update stock level quantities
    batch.update(stockLevelRef, {
      quantityOnHand: newOnHand,
      quantityReserved: newReserved,
      quantityAvailable: newOnHand - newReserved,
      updatedAt: serverTimestamp(),
    });

    // Record movement for audit
    const movementRef = doc(collection(db, STOCK_LEVELS_COLLECTION, sl.id, MOVEMENTS_SUBCOLLECTION));
    batch.set(movementRef, {
      type: 'adjustment' as StockMovementType,
      quantity: deltaOnHand,
      referenceType: 'manual' as StockMovementReferenceType,
      referenceId: `UOM-ADJ-${Date.now()}`,
      notes: `UoM conversion changed from ${oldFactor} to ${newFactor} (ratio: ${ratio.toFixed(4)}). On-hand: ${currentOnHand} → ${newOnHand}`,
      performedBy: userId,
      performedAt: serverTimestamp(),
    });

    await batch.commit();
    adjustedLocations++;
    totalDelta += deltaOnHand;
  }

  // Update aggregate inStock on the inventory item (set absolute value, not increment)
  const itemRef = doc(db, INVENTORY_ITEMS_COLLECTION, inventoryItemId);
  const aggregated = await getAggregatedStock(inventoryItemId);
  await updateDoc(itemRef, {
    'inventory.inStock': aggregated.totalOnHand,
    updatedAt: serverTimestamp(),
  });

  return { adjustedLocations, totalDelta };
}

// ============================================
// Stock Movement History
// ============================================

/**
 * Get movement history for a stock level
 */
export async function getStockMovements(
  stockLevelId: string,
  limitCount = 50,
): Promise<StockMovement[]> {
  const q = query(
    collection(db, STOCK_LEVELS_COLLECTION, stockLevelId, MOVEMENTS_SUBCOLLECTION),
    orderBy('performedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs
    .slice(0, limitCount)
    .map((d) => ({ id: d.id, ...d.data() } as StockMovement));
}

// ============================================
// Cost History
// ============================================

/**
 * Record a cost change for an inventory item
 */
export async function recordCostChange(
  inventoryItemId: string,
  previousCost: number,
  newCost: number,
  currency: string,
  source: CostChangeSource,
  userId: string,
  referenceId?: string,
  poNumber?: string,
  notes?: string,
): Promise<void> {
  await addDoc(collection(db, COST_HISTORY_COLLECTION), {
    inventoryItemId,
    previousCost,
    newCost,
    currency,
    source,
    referenceId,
    poNumber,
    notes,
    recordedAt: serverTimestamp(),
    recordedBy: userId,
  });
}

/**
 * Get cost history for an inventory item
 */
export async function getCostHistory(inventoryItemId: string): Promise<CostHistoryEntry[]> {
  const q = query(
    collection(db, COST_HISTORY_COLLECTION),
    where('inventoryItemId', '==', inventoryItemId),
    orderBy('recordedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CostHistoryEntry));
}

/**
 * Subscribe to cost history for an item (real-time)
 */
export function subscribeToCostHistory(
  inventoryItemId: string,
  callback: (entries: CostHistoryEntry[]) => void,
): () => void {
  const q = query(
    collection(db, COST_HISTORY_COLLECTION),
    where('inventoryItemId', '==', inventoryItemId),
    orderBy('recordedAt', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as CostHistoryEntry)));
  });
}

// ============================================
// Inventory Item Cost Updates
// ============================================

/**
 * Update inventory item cost using weighted average after PO receipt
 *
 * NOTE: receiveStock() is called BEFORE this function, so inventory.inStock
 * has already been incremented by receivedQuantity. We account for this by
 * subtracting receivedQuantity to get the pre-receipt qty for the formula.
 *
 * Formula:
 *   newAvgCost = ((preReceiptQty * existingCost) + (receivedQty * effectiveUnitCost))
 *                / (preReceiptQty + receivedQty)
 */
export async function updateInventoryItemCostFromReceipt(
  inventoryItemId: string,
  receivedQuantity: number,
  effectiveUnitCost: number,
  currency: string,
  userId: string,
  poId: string,
  poNumber: string,
): Promise<void> {
  const itemRef = doc(db, INVENTORY_ITEMS_COLLECTION, inventoryItemId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) return;

  const itemData = itemSnap.data();
  const existingCost = itemData?.pricing?.costPerUnit ?? 0;
  const currentQty = itemData?.inventory?.inStock ?? 0;

  // inStock was already incremented by receiveStock(), so subtract to get pre-receipt qty
  const preReceiptQty = Math.max(0, currentQty - receivedQuantity);
  const totalQty = preReceiptQty + receivedQuantity; // = currentQty (post-receipt)

  const newAvgCost =
    totalQty > 0
      ? ((preReceiptQty * existingCost) + (receivedQuantity * effectiveUnitCost)) / totalQty
      : effectiveUnitCost;

  // Record cost change
  await recordCostChange(
    inventoryItemId,
    existingCost,
    newAvgCost,
    currency,
    'po_receipt',
    userId,
    poId,
    poNumber,
    `Weighted avg: (${preReceiptQty} x ${existingCost} + ${receivedQuantity} x ${effectiveUnitCost}) / ${totalQty}`,
  );

  // Update inventory item pricing
  await updateDoc(itemRef, {
    'pricing.costPerUnit': newAvgCost,
    'pricing.lastUpdatedAt': serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Keep family parent pricing aligned with child SKU costs, even when
  // quantities are zero and only receipt-driven cost updates occur.
  if (itemData?.familyId) {
    await syncFamilyPricingFromChildren(itemData.familyId as string, userId);
  }
}

/**
 * Recompute family pricing from active child SKUs.
 * Uses simple average so family pricing remains meaningful when total stock is zero.
 */
async function syncFamilyPricingFromChildren(
  familyId: string,
  userId: string,
): Promise<void> {
  const familyRef = doc(db, INVENTORY_ITEMS_COLLECTION, familyId);
  const [familySnap, childrenSnap] = await Promise.all([
    getDoc(familyRef),
    getDocs(query(collection(db, INVENTORY_ITEMS_COLLECTION), where('familyId', '==', familyId))),
  ]);

  if (!familySnap.exists()) return;

  const familyData = familySnap.data();
  const activePricedChildren = childrenSnap.docs
    .map((d) => d.data())
    .filter((child) => child?.status === 'active')
    .filter((child) => (child?.pricing?.costPerUnit ?? 0) > 0);

  const averageCost = activePricedChildren.length > 0
    ? activePricedChildren.reduce((sum, child) => sum + (child?.pricing?.costPerUnit ?? 0), 0) / activePricedChildren.length
    : 0;

  const currency =
    activePricedChildren[0]?.pricing?.currency ||
    familyData?.pricing?.currency ||
    'UGX';
  const unit =
    activePricedChildren[0]?.pricing?.unit ||
    familyData?.pricing?.unit ||
    'ea';

  await updateDoc(familyRef, {
    pricing: {
      ...(familyData?.pricing || {}),
      costPerUnit: averageCost,
      currency,
      unit,
    },
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

// ============================================
// Low Stock Detection
// ============================================

/**
 * Get stock levels that are below their reorder level
 */
export async function getLowStockLevels(): Promise<StockLevel[]> {
  // Firestore can't do field-to-field comparison, so we fetch all with reorder levels set
  // and filter client-side
  const q = query(
    collection(db, STOCK_LEVELS_COLLECTION),
    where('reorderLevel', '>', 0),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as StockLevel))
    .filter((sl) => sl.quantityAvailable < (sl.reorderLevel ?? 0));
}

// ============================================
// Item-to-Item Stock Transfer
// ============================================

/**
 * Transfer ALL stock from one inventory item to another across all warehouses.
 * Used when deleting an item that still carries stock — move it to a replacement item first.
 * Does NOT use validateTransactableItem (the source item may be non-active / being deleted).
 */
export async function transferStockToItem(
  sourceItemId: string,
  targetItemId: string,
  userId: string,
  notes?: string,
): Promise<{ totalTransferred: number; warehouseCount: number }> {
  // 1. Get all stock levels for source item
  const sourceStockLevels = await getStockLevels(sourceItemId);
  const nonEmptyLevels = sourceStockLevels.filter(sl => sl.quantityOnHand > 0);

  if (nonEmptyLevels.length === 0) {
    return { totalTransferred: 0, warehouseCount: 0 };
  }

  // 2. Get target item info for creating stock levels
  const targetItemRef = doc(db, INVENTORY_ITEMS_COLLECTION, targetItemId);
  const targetItemSnap = await getDoc(targetItemRef);
  if (!targetItemSnap.exists()) throw new Error('Target item not found');
  const targetData = targetItemSnap.data();

  let totalTransferred = 0;

  // 3. For each warehouse stock level with stock, transfer to target
  for (const sourceLevel of nonEmptyLevels) {
    const qty = sourceLevel.quantityOnHand;
    const transferId = `ITEM-TRF-${Date.now()}-${sourceLevel.warehouseId.slice(0, 6)}`;

    // Get or create target stock level for the same warehouse
    const targetStockLevelId = await getOrCreateStockLevel(
      targetItemId,
      sourceLevel.warehouseId,
      targetData.sku || '',
      targetData.displayName || targetData.name || '',
    );

    const batch = writeBatch(db);

    // Decrease source stock level
    const sourceRef = doc(db, STOCK_LEVELS_COLLECTION, sourceLevel.id);
    batch.update(sourceRef, {
      quantityOnHand: increment(-qty),
      quantityAvailable: increment(-qty),
      updatedAt: serverTimestamp(),
    });

    // Record source movement
    const sourceMovementRef = doc(
      collection(db, STOCK_LEVELS_COLLECTION, sourceLevel.id, MOVEMENTS_SUBCOLLECTION),
    );
    batch.set(sourceMovementRef, {
      type: 'item-transfer',
      quantity: -qty,
      referenceType: 'item-transfer',
      referenceId: transferId,
      notes: notes || `Stock transferred to item ${targetItemId} before deletion`,
      performedBy: userId,
      performedAt: serverTimestamp(),
    });

    // Increase target stock level
    const targetRef = doc(db, STOCK_LEVELS_COLLECTION, targetStockLevelId);
    batch.update(targetRef, {
      quantityOnHand: increment(qty),
      quantityAvailable: increment(qty),
      lastReceivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Record target movement
    const targetMovementRef = doc(
      collection(db, STOCK_LEVELS_COLLECTION, targetStockLevelId, MOVEMENTS_SUBCOLLECTION),
    );
    batch.set(targetMovementRef, {
      type: 'item-transfer',
      quantity: qty,
      referenceType: 'item-transfer',
      referenceId: transferId,
      notes: notes || `Stock received from item ${sourceItemId}`,
      performedBy: userId,
      performedAt: serverTimestamp(),
    });

    await batch.commit();
    totalTransferred += qty;
  }

  // 4. Update aggregate inStock on both inventory items
  const sourceItemRef = doc(db, INVENTORY_ITEMS_COLLECTION, sourceItemId);
  const finalBatch = writeBatch(db);
  finalBatch.update(sourceItemRef, {
    'inventory.inStock': 0,
    updatedAt: serverTimestamp(),
  });
  finalBatch.update(targetItemRef, {
    'inventory.inStock': increment(totalTransferred),
    updatedAt: serverTimestamp(),
  });
  await finalBatch.commit();

  return { totalTransferred, warehouseCount: nonEmptyLevels.length };
}
