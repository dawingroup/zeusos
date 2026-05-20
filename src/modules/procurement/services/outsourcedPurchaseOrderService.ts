/**
 * Outsourced Purchase Order (OPO) Service
 * Manages OPO lifecycle: Create → Approve → Send → Receive → Close
 * Handles recipe snapshots, dual-warehouse inventory, and composite costing
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { Timestamp } from '@/shared/types';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  POLineItem,
  LandedCosts,
  GoodsReceipt,
  GoodsReceiptLine,
  OPORecipeRow,
  OPOIngredientAvailability,
  OPOLineItemExtension,
  OPOMaterialDispatch,
} from '../types/purchaseOrder';
import {
  generatePONumber,
  calculateLandedCostDistribution,
  stripUndefined,
  emitBusinessEvent,
} from './purchaseOrderService';
import {
  getStockLevel,
  receiveStock,
  reserveStock,
  consumeStock,
  releaseStock,
  transferStock,
  updateInventoryItemCostFromReceipt,
} from '@/modules/inventory/services/stockLevelService';
import { bomService } from '@/modules/manufacturing/services/bomService';
import type { BOMLine } from '@/modules/manufacturing/types';

const PURCHASE_ORDERS_COLLECTION = 'purchaseOrders';

// ============================================
// Recipe Snapshot
// ============================================

/**
 * Capture a recipe snapshot from a Manufacturing Order's BOM.
 * Maps each BOM line to an OPORecipeRow with current stock cost and availability.
 */
export async function captureRecipeFromMO(
  moId: string,
  parentLineItemId: string,
  parentQuantity: number,
  trackingWarehouseId: string,
): Promise<OPORecipeRow[]> {
  const bomLines = await bomService.getBOM(moId);
  return captureRecipeFromBOMLines(bomLines, parentLineItemId, parentQuantity, trackingWarehouseId);
}

/**
 * Capture recipe from raw BOM lines (can be from MO or inventory item recipe).
 */
async function captureRecipeFromBOMLines(
  bomLines: BOMLine[],
  parentLineItemId: string,
  parentQuantity: number,
  trackingWarehouseId: string,
): Promise<OPORecipeRow[]> {
  const recipeRows: OPORecipeRow[] = [];

  for (const bom of bomLines) {
    if (!bom.inventoryItemId) continue;

    // Get current stock level at tracking warehouse
    const stockLevel = await getStockLevel(bom.inventoryItemId, trackingWarehouseId);
    const availableQty = stockLevel?.quantityAvailable ?? 0;
    const totalNeeded = bom.requiredQuantity * parentQuantity;

    let availability: OPOIngredientAvailability = 'not_available';
    if (availableQty >= totalNeeded) {
      availability = 'in_stock';
    } else if (availableQty > 0) {
      availability = 'partial';
    }

    recipeRows.push({
      id: crypto.randomUUID(),
      parentLineItemId,
      ingredientId: bom.inventoryItemId,
      ingredientName: bom.materialName,
      ingredientSku: bom.materialCode ?? '',
      category: bom.category,
      quantityPerUnit: bom.requiredQuantity,
      totalQuantity: totalNeeded,
      unit: bom.unit,
      unitCostAtSnapshot: bom.unitCost,
      currentUnitCost: bom.unitCost,
      totalCost: bom.unitCost * totalNeeded,
      warehouseId: trackingWarehouseId,
      availability,
      availableQuantity: availableQty,
      sourceBomEntryId: bom.id,
      isManuallyAdded: false,
      isModified: false,
    });
  }

  return recipeRows;
}

// ============================================
// Ingredient Availability
// ============================================

/**
 * Compute ingredient availability for recipe rows at a given warehouse.
 * Returns updated recipe rows and an aggregate availability status.
 */
export async function computeIngredientAvailability(
  recipeRows: OPORecipeRow[],
  trackingWarehouseId: string,
): Promise<{ updatedRows: OPORecipeRow[]; aggregate: OPOIngredientAvailability }> {
  if (recipeRows.length === 0) {
    return { updatedRows: [], aggregate: 'no_recipe' };
  }

  const updatedRows: OPORecipeRow[] = [];
  let hasNotAvailable = false;
  let hasPartial = false;

  for (const row of recipeRows) {
    const stockLevel = await getStockLevel(row.ingredientId, trackingWarehouseId);
    const availableQty = stockLevel?.quantityAvailable ?? 0;

    let availability: OPOIngredientAvailability = 'not_available';
    if (availableQty >= row.totalQuantity) {
      availability = 'in_stock';
    } else if (availableQty > 0) {
      availability = 'partial';
      hasPartial = true;
    } else {
      hasNotAvailable = true;
    }

    updatedRows.push({
      ...row,
      availability,
      availableQuantity: availableQty,
      currentUnitCost: stockLevel ? row.currentUnitCost : row.unitCostAtSnapshot,
      totalCost: row.currentUnitCost * row.totalQuantity,
    });
  }

  let aggregate: OPOIngredientAvailability = 'in_stock';
  if (hasNotAvailable) aggregate = 'not_available';
  else if (hasPartial) aggregate = 'partial';

  return { updatedRows, aggregate };
}

// ============================================
// OPO Costing
// ============================================

/**
 * Compute OPO cost breakdown: service fees, ingredient costs, and product costs.
 */
export function computeOPOCosts(
  lineItems: POLineItem[],
  recipeSnapshot: OPORecipeRow[],
  landedCosts: LandedCosts,
): {
  totalServiceFee: number;
  totalIngredientCost: number;
  totalProductCost: number;
  extensions: Record<string, OPOLineItemExtension>;
} {
  const { updatedLineItems, totals } = calculateLandedCostDistribution(lineItems, landedCosts);
  const extensions: Record<string, OPOLineItemExtension> = {};

  let totalServiceFee = 0;
  let totalIngredientCost = 0;

  for (const item of updatedLineItems) {
    const itemRecipeRows = recipeSnapshot.filter(r => r.parentLineItemId === item.id);
    const hasRecipe = itemRecipeRows.length > 0;

    const ingredientCostPerUnit = itemRecipeRows.reduce(
      (sum, r) => sum + (r.currentUnitCost * r.quantityPerUnit), 0,
    );
    const landedCostPerUnit = (item.effectiveUnitCost ?? item.unitCost);
    const productCostPerUnit = landedCostPerUnit + ingredientCostPerUnit;

    // Determine per-item ingredient availability (worst case)
    let ingredientAvailability: OPOIngredientAvailability = hasRecipe ? 'in_stock' : 'no_recipe';
    if (hasRecipe) {
      const hasNotAvail = itemRecipeRows.some(r => r.availability === 'not_available');
      const hasPartial = itemRecipeRows.some(r => r.availability === 'partial');
      if (hasNotAvail) ingredientAvailability = 'not_available';
      else if (hasPartial) ingredientAvailability = 'partial';
    }

    extensions[item.id] = {
      isOutsourcedItem: true,
      hasRecipe,
      ingredientAvailability,
      landedCostPerUnit,
      ingredientCostPerUnit,
      productCostPerUnit,
      totalProductCost: productCostPerUnit * item.quantity,
    };

    totalServiceFee += item.totalCost;
    totalIngredientCost += ingredientCostPerUnit * item.quantity;
  }

  return {
    totalServiceFee,
    totalIngredientCost,
    totalProductCost: totals.grandTotal + totalIngredientCost,
    extensions,
  };
}

// ============================================
// OPO Creation
// ============================================

export interface CreateOPOInput {
  /** Contractor (supplier) */
  supplierId: string;
  supplierName: string;
  supplierContact?: string;

  /** Warehouses */
  shipToWarehouseId: string;
  shipToWarehouseName: string;
  trackIngredientsWarehouseId: string;
  trackIngredientsWarehouseName: string;

  /** Line items (outsourced products with service fees) */
  lineItems: POLineItem[];

  /** Recipe snapshot (pre-captured or will be captured from MO) */
  recipeSnapshot: OPORecipeRow[];

  /** Landed costs */
  landedCosts: LandedCosts;

  /** Links */
  linkedMOIds?: string[];
  linkedManufacturingOrderIds?: string[];
  linkedProjectId?: string;

  /** Notes */
  notes?: string;

  /** Expected delivery */
  expectedDeliveryDate?: Date;
  orderDate?: Date;

  /** Scoping */
  subsidiaryId: string;
}

/**
 * Create an Outsourced Purchase Order.
 * Auto-generates OPO number, computes costs, and optionally reserves ingredients.
 */
export async function createOPO(
  data: CreateOPOInput,
  userId: string,
): Promise<string> {
  const opoNumber = await generatePONumber(data.subsidiaryId, 'OPO');

  const { updatedLineItems, totals } = calculateLandedCostDistribution(
    data.lineItems,
    data.landedCosts,
  );

  const landedCosts: LandedCosts = {
    ...data.landedCosts,
    totalLandedCost: totals.landedCostTotal,
  };

  // Compute OPO-specific costs
  const costs = computeOPOCosts(updatedLineItems, data.recipeSnapshot, landedCosts);

  // Determine aggregate ingredient availability
  let ingredientAvailability: OPOIngredientAvailability = 'no_recipe';
  if (data.recipeSnapshot.length > 0) {
    const exts = Object.values(costs.extensions);
    const hasNotAvail = exts.some(e => e.ingredientAvailability === 'not_available');
    const hasPartial = exts.some(e => e.ingredientAvailability === 'partial');
    if (hasNotAvail) ingredientAvailability = 'not_available';
    else if (hasPartial) ingredientAvailability = 'partial';
    else ingredientAvailability = 'in_stock';
  }

  const opoData = {
    // Standard PO fields
    poNumber: opoNumber,
    status: 'draft' as PurchaseOrderStatus,
    supplierName: data.supplierName,
    supplierContact: data.supplierContact ?? null,
    supplierId: data.supplierId,
    lineItems: updatedLineItems,
    landedCosts,
    totals,
    approvals: [],
    receivingHistory: [],
    linkedMOIds: data.linkedMOIds ?? data.linkedManufacturingOrderIds ?? [],
    linkedProjectId: data.linkedProjectId ?? null,
    notes: data.notes ?? null,
    subsidiaryId: data.subsidiaryId,
    orderDate: data.orderDate ?? new Date(),
    expectedDeliveryDate: data.expectedDeliveryDate ?? null,

    // OPO-specific fields
    purchaseOrderType: 'outsourced' as const,
    shipToWarehouseId: data.shipToWarehouseId,
    shipToWarehouseName: data.shipToWarehouseName,
    trackIngredientsWarehouseId: data.trackIngredientsWarehouseId,
    trackIngredientsWarehouseName: data.trackIngredientsWarehouseName,
    recipeSnapshot: data.recipeSnapshot,
    recipeSnapshotAt: new Date(),
    recipeModified: false,
    ingredientAvailability,
    totalServiceFee: costs.totalServiceFee,
    totalIngredientCost: costs.totalIngredientCost,
    totalProductCost: costs.totalProductCost,
    opoLineItemExtensions: costs.extensions,
    linkedStockTransferIds: [],
    linkedManufacturingOrderIds: data.linkedManufacturingOrderIds ?? [],

    // Metadata
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  const docRef = await addDoc(
    collection(db, PURCHASE_ORDERS_COLLECTION),
    stripUndefined(opoData),
  );

  await emitBusinessEvent(
    'purchase_order_created',
    { ...opoData, id: docRef.id } as unknown as Partial<PurchaseOrder>,
    userId,
  );

  return docRef.id;
}

// ============================================
// Ingredient Reservation (on OPO approval/send)
// ============================================

/**
 * Reserve ingredients at the tracking warehouse for an OPO.
 * Called when OPO moves to 'approved' or 'sent' status.
 */
export async function reserveOPOIngredients(
  opoId: string,
  userId: string,
): Promise<{ allReserved: boolean; failures: string[] }> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const opoSnap = await getDoc(opoRef);
  if (!opoSnap.exists()) throw new Error('OPO not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') throw new Error('Not an outsourced purchase order');

  const recipeRows = opo.recipeSnapshot ?? [];
  const warehouseId = opo.trackIngredientsWarehouseId;
  if (!warehouseId) throw new Error('No tracking warehouse set');

  const failures: string[] = [];

  for (const row of recipeRows) {
    const result = await reserveStock(
      row.ingredientId,
      warehouseId,
      row.ingredientSku,
      row.ingredientName,
      row.totalQuantity,
      opoId,
      userId,
    );
    if (!result.success) {
      failures.push(`${row.ingredientName}: need ${row.totalQuantity}, available ${result.availableQty}`);
    }
  }

  return { allReserved: failures.length === 0, failures };
}

/**
 * Release all ingredient reservations for an OPO.
 * Called on OPO cancellation or deletion.
 */
export async function releaseOPOIngredients(
  opoId: string,
  userId: string,
): Promise<void> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const opoSnap = await getDoc(opoRef);
  if (!opoSnap.exists()) throw new Error('OPO not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') return;

  const recipeRows = opo.recipeSnapshot ?? [];
  const warehouseId = opo.trackIngredientsWarehouseId;
  if (!warehouseId) return;

  for (const row of recipeRows) {
    try {
      await releaseStock(row.ingredientId, warehouseId, row.totalQuantity, opoId, userId);
    } catch {
      // If release fails (e.g., no stock level), log but don't block
      console.warn(`Failed to release reservation for ${row.ingredientName} on OPO ${opoId}`);
    }
  }
}

// ============================================
// OPO Receiving (Dual-Location Transaction)
// ============================================

export interface OPOReceiveInput {
  lines: Array<{
    lineItemId: string;
    quantityReceived: number;
    inventoryItemId?: string;
  }>;
  notes?: string;
  deliveryReference?: string;
}

/**
 * Receive goods from an OPO — dual-location inventory transaction:
 * 1. Receive finished goods at ship-to warehouse
 * 2. Consume proportional ingredients at tracking warehouse
 * 3. Update product MAC with composite cost
 */
export async function receiveOPO(
  opoId: string,
  receipt: OPOReceiveInput,
  userId: string,
): Promise<void> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const opoSnap = await getDoc(opoRef);
  if (!opoSnap.exists()) throw new Error('OPO not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') throw new Error('Not an outsourced purchase order');

  const shipToWarehouseId = opo.shipToWarehouseId;
  const trackingWarehouseId = opo.trackIngredientsWarehouseId;
  if (!shipToWarehouseId) throw new Error('No ship-to warehouse set');
  if (!trackingWarehouseId) throw new Error('No tracking warehouse set');

  const recipeRows = opo.recipeSnapshot ?? [];
  const extensions = opo.opoLineItemExtensions ?? {};
  const updatedLineItems = [...opo.lineItems];
  const receiptLines: GoodsReceiptLine[] = [];
  let totalReceived = 0;

  for (const line of receipt.lines) {
    if (line.quantityReceived <= 0) continue;

    const lineItemIndex = updatedLineItems.findIndex(li => li.id === line.lineItemId);
    if (lineItemIndex === -1) throw new Error(`Line item ${line.lineItemId} not found`);

    const lineItem = updatedLineItems[lineItemIndex];
    const remaining = lineItem.quantity - lineItem.quantityReceived;
    if (line.quantityReceived > remaining) {
      throw new Error(
        `Cannot receive ${line.quantityReceived} for "${lineItem.description}" — only ${remaining} remaining`,
      );
    }

    const inventoryItemId = line.inventoryItemId ?? lineItem.inventoryItemId;

    // 1. Receive finished goods at ship-to warehouse
    if (inventoryItemId) {
      await receiveStock(
        inventoryItemId,
        shipToWarehouseId,
        lineItem.sku ?? '',
        lineItem.description,
        line.quantityReceived,
        opoId,
        userId,
        `OPO receipt: ${opo.poNumber}`,
      );

      // 2. Consume proportional ingredients at tracking warehouse
      const itemRecipeRows = recipeRows.filter(r => r.parentLineItemId === lineItem.id);
      for (const ingredient of itemRecipeRows) {
        const consumeQty = ingredient.quantityPerUnit * line.quantityReceived;
        if (consumeQty <= 0) continue;

        try {
          await consumeStock(
            ingredient.ingredientId,
            trackingWarehouseId,
            consumeQty,
            opoId,
            userId,
          );
        } catch (err) {
          // If ingredient stock is 0 or insufficient, still allow receive but warn
          console.warn(
            `OPO ${opoId}: Failed to consume ${consumeQty} ${ingredient.unit} of ${ingredient.ingredientName}: ${err}`,
          );
        }
      }

      // 3. Update product MAC with composite cost (service + landed + ingredients)
      const ext = extensions[lineItem.id];
      if (ext?.productCostPerUnit) {
        await updateInventoryItemCostFromReceipt(
          inventoryItemId,
          line.quantityReceived,
          ext.productCostPerUnit,
          opo.landedCosts.currency,
          userId,
          opoId,
          opo.poNumber,
        );
      }
    }

    // Update line item received quantity
    updatedLineItems[lineItemIndex] = {
      ...lineItem,
      quantityReceived: lineItem.quantityReceived + line.quantityReceived,
    };

    receiptLines.push({
      lineItemId: line.lineItemId,
      quantityReceived: line.quantityReceived,
      warehouseId: shipToWarehouseId,
      inventoryItemId,
    });

    totalReceived += line.quantityReceived;
  }

  if (totalReceived === 0) throw new Error('No items received');

  // Determine new status
  const allReceived = updatedLineItems.every(li => li.quantityReceived >= li.quantity);
  const anyReceived = updatedLineItems.some(li => li.quantityReceived > 0);
  let newStatus: PurchaseOrderStatus = opo.status;
  if (allReceived) {
    newStatus = 'received';
  } else if (anyReceived) {
    newStatus = 'partially-received';
  }

  // Build receipt record
  const receiptRecord: GoodsReceipt = {
    id: crypto.randomUUID(),
    receivedAt: { toDate: () => new Date() } as unknown as Timestamp,
    receivedBy: userId,
    lines: receiptLines,
    notes: receipt.notes,
    deliveryReference: receipt.deliveryReference,
  };

  // Update OPO
  await updateDoc(opoRef, stripUndefined({
    status: newStatus,
    lineItems: updatedLineItems,
    receivingHistory: [...opo.receivingHistory, receiptRecord],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  await emitBusinessEvent('goods_received', {
    id: opoId,
    poNumber: opo.poNumber,
    status: newStatus,
    purchaseOrderType: 'outsourced',
  } as Partial<PurchaseOrder>, userId);
}

// ============================================
// OPO Revert
// ============================================

/**
 * Revert a received OPO — reverse all inventory movements.
 * Finished goods removed from ship-to, ingredients restored at tracking warehouse.
 */
export async function revertOPOReceipt(
  opoId: string,
  userId: string,
): Promise<void> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const opoSnap = await getDoc(opoRef);
  if (!opoSnap.exists()) throw new Error('OPO not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') throw new Error('Not an outsourced purchase order');
  if (opo.status !== 'received' && opo.status !== 'partially-received') {
    throw new Error('Can only revert received or partially-received OPOs');
  }

  const shipToWarehouseId = opo.shipToWarehouseId;
  const trackingWarehouseId = opo.trackIngredientsWarehouseId;
  if (!shipToWarehouseId || !trackingWarehouseId) throw new Error('Missing warehouse configuration');

  const recipeRows = opo.recipeSnapshot ?? [];

  // For each line item that has received quantities, reverse the movements
  for (const lineItem of opo.lineItems) {
    if (lineItem.quantityReceived <= 0) continue;
    const inventoryItemId = lineItem.inventoryItemId;
    if (!inventoryItemId) continue;

    // Reverse finished goods receipt (reduce stock at ship-to)
    const stockLevel = await getStockLevel(inventoryItemId, shipToWarehouseId);
    if (stockLevel) {
      const { adjustStock } = await import('@/modules/inventory/services/stockLevelService');
      await adjustStock(
        inventoryItemId,
        shipToWarehouseId,
        lineItem.sku ?? '',
        lineItem.description,
        -lineItem.quantityReceived,
        userId,
        `OPO revert: ${opo.poNumber}`,
      );
    }

    // Reverse ingredient consumption (restore stock at tracking)
    const itemRecipeRows = recipeRows.filter(r => r.parentLineItemId === lineItem.id);
    for (const ingredient of itemRecipeRows) {
      const restoreQty = ingredient.quantityPerUnit * lineItem.quantityReceived;
      if (restoreQty <= 0) continue;
      try {
        const { adjustStock: adjustStockFn } = await import('@/modules/inventory/services/stockLevelService');
        await adjustStockFn(
          ingredient.ingredientId,
          trackingWarehouseId,
          ingredient.ingredientSku,
          ingredient.ingredientName,
          restoreQty,
          userId,
          `OPO revert ingredient: ${opo.poNumber}`,
        );
      } catch (err) {
        console.warn(`OPO ${opoId}: Failed to restore ${ingredient.ingredientName}: ${err}`);
      }
    }
  }

  // Reset line item received quantities
  const resetLineItems = opo.lineItems.map(li => ({
    ...li,
    quantityReceived: 0,
  }));

  await updateDoc(opoRef, stripUndefined({
    status: 'sent' as PurchaseOrderStatus,
    lineItems: resetLineItems,
    receivingHistory: [],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  await emitBusinessEvent('purchase_order_reverted', {
    id: opoId,
    poNumber: opo.poNumber,
    purchaseOrderType: 'outsourced',
  } as Partial<PurchaseOrder>, userId);
}

// ============================================
// OPO Deletion
// ============================================

/**
 * Delete an OPO and clean up all reservations.
 */
export async function deleteOPO(
  opoId: string,
  userId: string,
): Promise<void> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const opoSnap = await getDoc(opoRef);
  if (!opoSnap.exists()) throw new Error('OPO not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') throw new Error('Not an outsourced purchase order');

  // If received, revert first
  if (opo.status === 'received' || opo.status === 'partially-received') {
    await revertOPOReceipt(opoId, userId);
  }

  // Release ingredient reservations
  await releaseOPOIngredients(opoId, userId);

  // Delete the document
  await deleteDoc(opoRef);

  await emitBusinessEvent('purchase_order_deleted', {
    id: opoId,
    poNumber: opo.poNumber,
    purchaseOrderType: 'outsourced',
  } as Partial<PurchaseOrder>, userId);
}

// ============================================
// OPO Recipe Updates
// ============================================

/**
 * Update recipe rows on an OPO (add, remove, or modify ingredients).
 * Only allowed on draft/approved OPOs (not yet received).
 */
export async function updateOPORecipe(
  opoId: string,
  updatedRows: OPORecipeRow[],
  userId: string,
): Promise<void> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const opoSnap = await getDoc(opoRef);
  if (!opoSnap.exists()) throw new Error('OPO not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') throw new Error('Not an outsourced purchase order');

  const receivedStatuses: PurchaseOrderStatus[] = ['received', 'closed'];
  if (receivedStatuses.includes(opo.status)) {
    throw new Error('Cannot modify recipe on received or closed OPOs');
  }

  // Recompute costs with updated recipe
  const costs = computeOPOCosts(opo.lineItems, updatedRows, opo.landedCosts);

  // Determine aggregate availability
  const exts = Object.values(costs.extensions);
  let ingredientAvailability: OPOIngredientAvailability = 'no_recipe';
  if (updatedRows.length > 0) {
    const hasNotAvail = exts.some(e => e.ingredientAvailability === 'not_available');
    const hasPartial = exts.some(e => e.ingredientAvailability === 'partial');
    if (hasNotAvail) ingredientAvailability = 'not_available';
    else if (hasPartial) ingredientAvailability = 'partial';
    else ingredientAvailability = 'in_stock';
  }

  await updateDoc(opoRef, stripUndefined({
    recipeSnapshot: updatedRows,
    recipeModified: true,
    ingredientAvailability,
    totalIngredientCost: costs.totalIngredientCost,
    totalProductCost: costs.totalProductCost,
    opoLineItemExtensions: costs.extensions,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));
}

// ============================================
// OPO Update (General Fields)
// ============================================

/**
 * Update general OPO fields (supplier, dates, notes, line items, landed costs).
 */
export async function updateOPO(
  opoId: string,
  updates: Partial<{
    supplierName: string;
    supplierContact: string;
    supplierId: string;
    lineItems: POLineItem[];
    landedCosts: LandedCosts;
    shipToWarehouseId: string;
    shipToWarehouseName: string;
    trackIngredientsWarehouseId: string;
    trackIngredientsWarehouseName: string;
    expectedDeliveryDate: Date | null;
    notes: string;
  }>,
  userId: string,
): Promise<void> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const opoSnap = await getDoc(opoRef);
  if (!opoSnap.exists()) throw new Error('OPO not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') throw new Error('Not an outsourced purchase order');

  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  // If line items or landed costs changed, recalculate
  if (updates.lineItems || updates.landedCosts) {
    const lineItems = updates.lineItems ?? opo.lineItems;
    const landedCosts = updates.landedCosts ?? opo.landedCosts;
    const { updatedLineItems, totals } = calculateLandedCostDistribution(lineItems, landedCosts);

    const newLandedCosts = { ...landedCosts, totalLandedCost: totals.landedCostTotal };
    const recipeSnapshot = opo.recipeSnapshot ?? [];
    const costs = computeOPOCosts(updatedLineItems, recipeSnapshot, newLandedCosts);

    updateData.lineItems = updatedLineItems;
    updateData.landedCosts = newLandedCosts;
    updateData.totals = totals;
    updateData.totalServiceFee = costs.totalServiceFee;
    updateData.totalIngredientCost = costs.totalIngredientCost;
    updateData.totalProductCost = costs.totalProductCost;
    updateData.opoLineItemExtensions = costs.extensions;
  }

  // Copy simple fields
  if (updates.supplierName !== undefined) updateData.supplierName = updates.supplierName;
  if (updates.supplierContact !== undefined) updateData.supplierContact = updates.supplierContact;
  if (updates.supplierId !== undefined) updateData.supplierId = updates.supplierId;
  if (updates.shipToWarehouseId !== undefined) updateData.shipToWarehouseId = updates.shipToWarehouseId;
  if (updates.shipToWarehouseName !== undefined) updateData.shipToWarehouseName = updates.shipToWarehouseName;
  if (updates.trackIngredientsWarehouseId !== undefined) updateData.trackIngredientsWarehouseId = updates.trackIngredientsWarehouseId;
  if (updates.trackIngredientsWarehouseName !== undefined) updateData.trackIngredientsWarehouseName = updates.trackIngredientsWarehouseName;
  if (updates.expectedDeliveryDate !== undefined) updateData.expectedDeliveryDate = updates.expectedDeliveryDate;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  await updateDoc(opoRef, stripUndefined(updateData));
}

// ============================================
// OPO Duplication
// ============================================

/**
 * Duplicate an existing OPO as a new draft with fresh recipe snapshot.
 * Preserves supplier, warehouses, line items, landed costs, and notes.
 * Resets status, receiving history, and received quantities.
 */
export async function duplicateOPO(
  opoId: string,
  userId: string,
): Promise<string> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const opoSnap = await getDoc(opoRef);
  if (!opoSnap.exists()) throw new Error('OPO not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') throw new Error('Not an outsourced purchase order');

  // Reset line item received quantities
  const resetLineItems: POLineItem[] = opo.lineItems.map(li => ({
    ...li,
    quantityReceived: 0,
  }));

  // Re-capture recipe snapshot with fresh availability data
  let freshRecipe: OPORecipeRow[] = [];
  const trackingWarehouseId = opo.trackIngredientsWarehouseId;
  if (trackingWarehouseId && (opo.recipeSnapshot ?? []).length > 0) {
    const { updatedRows } = await computeIngredientAvailability(
      opo.recipeSnapshot!,
      trackingWarehouseId,
    );
    freshRecipe = updatedRows;
  }

  const input: CreateOPOInput = {
    supplierId: opo.supplierId ?? '',
    supplierName: opo.supplierName,
    supplierContact: opo.supplierContact ?? undefined,
    shipToWarehouseId: opo.shipToWarehouseId ?? '',
    shipToWarehouseName: opo.shipToWarehouseName ?? '',
    trackIngredientsWarehouseId: trackingWarehouseId ?? '',
    trackIngredientsWarehouseName: opo.trackIngredientsWarehouseName ?? '',
    lineItems: resetLineItems,
    recipeSnapshot: freshRecipe,
    landedCosts: opo.landedCosts,
    linkedMOIds: opo.linkedMOIds ?? [],
    linkedManufacturingOrderIds: opo.linkedManufacturingOrderIds ?? [],
    linkedProjectId: opo.linkedProjectId ?? undefined,
    notes: opo.notes ?? undefined,
    expectedDeliveryDate: undefined,
    subsidiaryId: opo.subsidiaryId,
  };

  return createOPO(input, userId);
}

// ============================================
// Material Dispatch (Stock Transfer to Contractor)
// ============================================

export interface DispatchMaterialsInput {
  items: Array<{
    ingredientId: string;
    ingredientName: string;
    quantity: number;
    unit: string;
  }>;
  toWarehouseId: string;
  toWarehouseName: string;
  notes?: string;
}

/**
 * Dispatch materials from the OPO tracking warehouse to a contractor location.
 * Executes stock transfers for each ingredient and records the dispatch on the OPO.
 */
export async function createStockTransferFromOPO(
  opoId: string,
  input: DispatchMaterialsInput,
  userId: string,
): Promise<void> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const opoSnap = await getDoc(opoRef);
  if (!opoSnap.exists()) throw new Error('OPO not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') throw new Error('Not an outsourced purchase order');

  const fromWarehouseId = opo.trackIngredientsWarehouseId;
  if (!fromWarehouseId) throw new Error('No tracking warehouse set on this OPO');

  // Execute stock transfers for each ingredient
  for (const item of input.items) {
    if (item.quantity <= 0) continue;
    await transferStock(
      {
        inventoryItemId: item.ingredientId,
        fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        quantity: item.quantity,
        notes: `OPO material dispatch: ${opo.poNumber}${input.notes ? ` — ${input.notes}` : ''}`,
      },
      userId,
    );
  }

  // Record the dispatch on the OPO
  const dispatchRecord: OPOMaterialDispatch = {
    id: crypto.randomUUID(),
    dispatchedAt: { toDate: () => new Date() } as unknown as Timestamp,
    dispatchedBy: userId,
    toWarehouseId: input.toWarehouseId,
    toWarehouseName: input.toWarehouseName,
    items: input.items.filter(i => i.quantity > 0),
    notes: input.notes,
  };

  await updateDoc(opoRef, stripUndefined({
    materialDispatchHistory: [...(opo.materialDispatchHistory ?? []), dispatchRecord],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  await emitBusinessEvent('purchase_order_updated', {
    id: opoId,
    poNumber: opo.poNumber,
    purchaseOrderType: 'outsourced',
  } as Partial<PurchaseOrder>, userId);
}

// ============================================
// Manufacturing Order Linking
// ============================================

const MANUFACTURING_ORDERS_COLLECTION = 'manufacturingOrders';

// ============================================
// Auto-create OPO from Manufacturing Order
// ============================================

/**
 * Create an Outsourced Purchase Order directly from a Manufacturing Order.
 * Reads the MO, captures its BOM as a recipe snapshot, builds a single line item
 * for the MO's output product, creates the OPO, and links it back to the MO.
 */
export async function createOPOFromMO(
  moId: string,
  supplierId: string,
  supplierName: string,
  shipToWarehouseId: string,
  shipToWarehouseName: string,
  trackIngredientsWarehouseId: string,
  trackIngredientsWarehouseName: string,
  subsidiaryId: string,
  userId: string,
): Promise<string> {
  // 1. Read the MO document from Firestore
  const moRef = doc(db, MANUFACTURING_ORDERS_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('Manufacturing Order not found');

  const mo = { id: moSnap.id, ...moSnap.data() } as { id: string; itemName: string; quantity: number; [key: string]: unknown };

  const productName = mo.itemName;
  const quantity = mo.quantity;

  // 2. Build a single line item for the MO's output product
  const lineItemId = crypto.randomUUID();
  const lineItem: POLineItem = {
    id: lineItemId,
    description: productName,
    quantity,
    unitCost: 0,
    totalCost: 0,
    currency: 'UGX',
    unit: 'pcs',
    quantityReceived: 0,
  };

  // 3. Capture the recipe from the MO's BOM
  const recipeSnapshot = await captureRecipeFromMO(
    moId,
    lineItemId,
    quantity,
    trackIngredientsWarehouseId,
  );

  // 4. Create the OPO
  const opoInput: CreateOPOInput = {
    supplierId,
    supplierName,
    shipToWarehouseId,
    shipToWarehouseName,
    trackIngredientsWarehouseId,
    trackIngredientsWarehouseName,
    lineItems: [lineItem],
    recipeSnapshot,
    landedCosts: {
      currency: 'UGX',
      totalLandedCost: 0,
    } as LandedCosts,
    linkedManufacturingOrderIds: [moId],
    subsidiaryId,
  };

  const opoId = await createOPO(opoInput, userId);

  // 5. Link the OPO to the MO (bidirectional)
  await linkOPOToMO(opoId, moId, userId);

  return opoId;
}

/**
 * Link an OPO to a Manufacturing Order (bidirectional).
 * Adds moId to the OPO's linkedManufacturingOrderIds and
 * opoId to the MO's linkedOPOIds using array union operations.
 */
export async function linkOPOToMO(
  opoId: string,
  moId: string,
  userId: string,
): Promise<void> {
  const opoRef = doc(db, PURCHASE_ORDERS_COLLECTION, opoId);
  const moRef = doc(db, MANUFACTURING_ORDERS_COLLECTION, moId);

  // Validate both documents exist
  const [opoSnap, moSnap] = await Promise.all([getDoc(opoRef), getDoc(moRef)]);
  if (!opoSnap.exists()) throw new Error('OPO not found');
  if (!moSnap.exists()) throw new Error('Manufacturing Order not found');

  const opo = { id: opoSnap.id, ...opoSnap.data() } as PurchaseOrder;
  if (opo.purchaseOrderType !== 'outsourced') throw new Error('Not an outsourced purchase order');

  // Update both documents with array union (idempotent — won't duplicate)
  await Promise.all([
    updateDoc(opoRef, {
      linkedManufacturingOrderIds: arrayUnion(moId),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }),
    updateDoc(moRef, {
      linkedOPOIds: arrayUnion(opoId),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }),
  ]);
}
