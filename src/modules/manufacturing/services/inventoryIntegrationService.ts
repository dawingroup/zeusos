/**
 * Inventory Integration Service
 *
 * Enhanced integration between Manufacturing and Inventory modules:
 * - Material availability checking with detailed shortage analysis
 * - Automatic procurement generation from shortages
 * - Reorder point monitoring and alerts
 * - Unified stock status across MO lifecycle
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ManufacturingOrder, BOMEntry } from '../types';
import {
  getStockLevel,
  getAggregatedStock,
  getLowStockLevels,
} from '@/modules/inventory/services/stockLevelService';
import { getSupplierById } from '@/modules/procurement/services/supplierBridgeService';
import { expandKit } from '@/modules/inventory/services/kitService';

const PROCUREMENT_REQUIREMENTS_COLLECTION = 'procurementRequirements';
const PURCHASE_ORDERS_COLLECTION = 'purchaseOrders';
const INVENTORY_ITEMS_COLLECTION = 'inventoryItems';
const BUSINESS_EVENTS_COLLECTION = 'businessEvents';

// ============================================
// Types
// ============================================

export interface MaterialAvailability {
  bomEntryId: string;
  inventoryItemId: string;
  itemName: string;
  sku: string;
  quantityRequired: number;
  quantityAvailable: number;
  quantityReserved: number;
  quantityOnHand: number;
  shortageQty: number;
  coveragePercent: number;
  status: 'available' | 'partial' | 'unavailable' | 'no-inventory';
  warehouseId?: string;
  supplierId?: string;
  supplierName?: string;
  estimatedLeadTimeDays?: number;
  lastPurchasePrice?: number;
}

export interface AvailabilityCheckResult {
  moId?: string;
  checkDate: Date;
  totalBOMItems: number;
  availableItems: number;
  partialItems: number;
  unavailableItems: number;
  noInventoryItems: number;
  overallStatus: 'ready' | 'partial' | 'blocked';
  items: MaterialAvailability[];
  estimatedShortageValue: number;
  currency: string;
}

export interface AutoProcurementResult {
  success: boolean;
  requirementsCreated: number;
  requirementIds: string[];
  poCreated: boolean;
  poId?: string;
  errors: string[];
}

export interface ReorderAlert {
  inventoryItemId: string;
  itemName: string;
  sku: string;
  warehouseId: string;
  warehouseName: string;
  quantityAvailable: number;
  reorderLevel: number;
  reorderQuantity: number;
  shortageQty: number;
  preferredSupplierId?: string;
  preferredSupplierName?: string;
  lastPurchasePrice?: number;
  linkedMOCount: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================
// Material Availability Check
// ============================================

/**
 * Check material availability for a manufacturing order's BOM
 * Returns detailed analysis of each item's stock status
 */
export async function checkMaterialAvailability(
  mo: ManufacturingOrder,
  defaultWarehouseId: string,
): Promise<AvailabilityCheckResult> {
  const items: MaterialAvailability[] = [];
  let availableCount = 0;
  let partialCount = 0;
  let unavailableCount = 0;
  let noInventoryCount = 0;
  let estimatedShortageValue = 0;

  // Expand kit BOM entries into their component items
  const expandedBom = await expandBomWithKits(mo.bom);

  for (const bomEntry of expandedBom) {
    const availability = await checkBOMEntryAvailability(bomEntry, defaultWarehouseId);
    items.push(availability);

    switch (availability.status) {
      case 'available':
        availableCount++;
        break;
      case 'partial':
        partialCount++;
        estimatedShortageValue += availability.shortageQty * bomEntry.unitCost;
        break;
      case 'unavailable':
        unavailableCount++;
        estimatedShortageValue += availability.shortageQty * bomEntry.unitCost;
        break;
      case 'no-inventory':
        noInventoryCount++;
        estimatedShortageValue += bomEntry.totalCost;
        break;
    }
  }

  let overallStatus: 'ready' | 'partial' | 'blocked';
  if (unavailableCount > 0 || noInventoryCount > 0) {
    overallStatus = 'blocked';
  } else if (partialCount > 0) {
    overallStatus = 'partial';
  } else {
    overallStatus = 'ready';
  }

  return {
    moId: mo.id,
    checkDate: new Date(),
    totalBOMItems: mo.bom.length,
    availableItems: availableCount,
    partialItems: partialCount,
    unavailableItems: unavailableCount,
    noInventoryItems: noInventoryCount,
    overallStatus,
    items,
    estimatedShortageValue,
    currency: mo.costSummary.currency,
  };
}

/**
 * Check availability for a single BOM entry
 */
async function checkBOMEntryAvailability(
  entry: BOMEntry,
  defaultWarehouseId: string,
): Promise<MaterialAvailability> {
  const warehouseId = entry.warehouseId ?? defaultWarehouseId;

  // Offcut-backed BOM entries are always considered available
  // (offcuts are reserved in the offcut library, not in inventory)
  if (entry.offcutId) {
    return {
      bomEntryId: entry.id,
      inventoryItemId: entry.inventoryItemId || '',
      itemName: entry.itemName,
      sku: entry.sku,
      quantityRequired: entry.quantityRequired,
      quantityAvailable: entry.quantityRequired,
      quantityReserved: entry.quantityRequired,
      quantityOnHand: entry.quantityRequired,
      shortageQty: 0,
      coveragePercent: 100,
      status: 'available' as const,
      warehouseId,
    };
  }

  // If no inventory item linked, it needs procurement
  if (!entry.inventoryItemId) {
    return {
      bomEntryId: entry.id,
      inventoryItemId: '',
      itemName: entry.itemName,
      sku: entry.sku,
      quantityRequired: entry.quantityRequired,
      quantityAvailable: 0,
      quantityReserved: 0,
      quantityOnHand: 0,
      shortageQty: entry.quantityRequired,
      coveragePercent: 0,
      status: 'no-inventory',
      warehouseId,
      supplierId: entry.supplierId,
      supplierName: entry.supplierName,
    };
  }

  // Check stock at specific warehouse
  const stockLevel = await getStockLevel(entry.inventoryItemId, warehouseId);

  if (!stockLevel) {
    // No stock record at this warehouse
    const aggregated = await getAggregatedStock(entry.inventoryItemId);

    return {
      bomEntryId: entry.id,
      inventoryItemId: entry.inventoryItemId,
      itemName: entry.itemName,
      sku: entry.sku,
      quantityRequired: entry.quantityRequired,
      quantityAvailable: aggregated.totalAvailable,
      quantityReserved: aggregated.totalReserved,
      quantityOnHand: aggregated.totalOnHand,
      shortageQty: Math.max(0, entry.quantityRequired - aggregated.totalAvailable),
      coveragePercent: aggregated.totalAvailable > 0
        ? Math.min(100, (aggregated.totalAvailable / entry.quantityRequired) * 100)
        : 0,
      status: aggregated.totalAvailable >= entry.quantityRequired
        ? 'available'
        : aggregated.totalAvailable > 0
          ? 'partial'
          : 'unavailable',
      warehouseId,
      supplierId: entry.supplierId,
      supplierName: entry.supplierName,
    };
  }

  const shortageQty = Math.max(0, entry.quantityRequired - stockLevel.quantityAvailable);
  const coveragePercent = stockLevel.quantityAvailable > 0
    ? Math.min(100, (stockLevel.quantityAvailable / entry.quantityRequired) * 100)
    : 0;

  let status: MaterialAvailability['status'];
  if (stockLevel.quantityAvailable >= entry.quantityRequired) {
    status = 'available';
  } else if (stockLevel.quantityAvailable > 0) {
    status = 'partial';
  } else {
    status = 'unavailable';
  }

  return {
    bomEntryId: entry.id,
    inventoryItemId: entry.inventoryItemId,
    itemName: entry.itemName,
    sku: entry.sku,
    quantityRequired: entry.quantityRequired,
    quantityAvailable: stockLevel.quantityAvailable,
    quantityReserved: stockLevel.quantityReserved,
    quantityOnHand: stockLevel.quantityOnHand,
    shortageQty,
    coveragePercent,
    status,
    warehouseId,
    supplierId: entry.supplierId,
    supplierName: entry.supplierName,
  };
}

// ============================================
// Kit Expansion Helper
// ============================================

/**
 * Expand any kit entries in a BOM into their component lines.
 * Non-kit entries pass through unchanged. Kit entries are replaced by
 * their individual component lines (with kitSourceId set for traceability).
 */
async function expandBomWithKits(bom: BOMEntry[]): Promise<BOMEntry[]> {
  const expanded: BOMEntry[] = [];

  for (const entry of bom) {
    if (!entry.inventoryItemId) {
      expanded.push(entry);
      continue;
    }

    // Look up the item to check if it's a kit
    const itemDoc = await getDoc(doc(db, INVENTORY_ITEMS_COLLECTION, entry.inventoryItemId));

    if (itemDoc.exists() && itemDoc.data().itemType === 'kit') {
      // Expand the kit — expandKit multiplies component qty × kitQuantity
      const kitLines = await expandKit(entry.inventoryItemId, entry.quantityRequired);

      for (const line of kitLines) {
        expanded.push({
          id: `${entry.id}-kit-${line.inventoryItemId}`,
          inventoryItemId: line.inventoryItemId,
          sku: line.sku,
          itemName: line.itemName,
          category: line.category,
          quantityRequired: line.quantity,
          unit: line.unit,
          unitCost: line.unitCost,
          totalCost: line.totalCost,
          kitSourceId: line.kitSourceId,
          warehouseId: entry.warehouseId,
          supplierId: entry.supplierId,
          supplierName: entry.supplierName,
        });
      }
    } else {
      // Non-kit — pass through unchanged
      expanded.push(entry);
    }
  }

  return expanded;
}

// ============================================
// Auto-Procurement from Shortages
// ============================================

/**
 * Generate procurement requirements for shortages detected during MO approval.
 * Optionally consolidates into a draft PO if all shortages share the same supplier.
 */
export async function generateProcurementFromShortages(
  mo: ManufacturingOrder,
  shortages: MaterialAvailability[],
  userId: string,
  options: {
    autoCreatePO?: boolean;
    groupBySupplier?: boolean;
  } = {},
): Promise<AutoProcurementResult> {
  const { autoCreatePO = false, groupBySupplier: _groupBySupplier = true } = options;
  const result: AutoProcurementResult = {
    success: false,
    requirementsCreated: 0,
    requirementIds: [],
    poCreated: false,
    errors: [],
  };

  if (shortages.length === 0) {
    result.success = true;
    return result;
  }

  const batch = writeBatch(db);
  const requirementIds: string[] = [];

  // Group shortages by supplier
  const bySupplier = new Map<string, MaterialAvailability[]>();

  for (const shortage of shortages) {
    if (shortage.shortageQty <= 0) continue;

    const key = shortage.supplierId ?? 'unassigned';
    if (!bySupplier.has(key)) {
      bySupplier.set(key, []);
    }
    bySupplier.get(key)!.push(shortage);
  }

  // Create procurement requirements
  for (const shortage of shortages) {
    if (shortage.shortageQty <= 0) continue;

    const bomEntry = mo.bom.find(b => b.id === shortage.bomEntryId);
    if (!bomEntry) continue;

    const reqRef = doc(collection(db, PROCUREMENT_REQUIREMENTS_COLLECTION));
    const reqData = {
      subsidiaryId: mo.subsidiaryId,
      moId: mo.id,
      moNumber: mo.moNumber,
      bomEntryId: shortage.bomEntryId,
      designItemName: mo.designItemName,
      projectCode: mo.projectCode,
      inventoryItemId: shortage.inventoryItemId || null,
      itemDescription: shortage.itemName,
      quantityRequired: shortage.shortageQty,
      unit: bomEntry.unit,
      estimatedUnitCost: bomEntry.unitCost,
      estimatedTotalCost: shortage.shortageQty * bomEntry.unitCost,
      currency: mo.costSummary.currency,
      supplierId: shortage.supplierId || null,
      supplierName: shortage.supplierName || null,
      status: 'pending',
      poId: null,
      poLineItemId: null,
      source: 'shortage_auto',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    batch.set(reqRef, reqData);
    requirementIds.push(reqRef.id);
  }

  try {
    await batch.commit();
    result.requirementsCreated = requirementIds.length;
    result.requirementIds = requirementIds;

    // Emit business event
    await emitBusinessEvent('procurement_requirements_auto_generated', {
      moId: mo.id,
      moNumber: mo.moNumber,
      requirementsCount: requirementIds.length,
      totalShortageValue: shortages.reduce((sum, s) => {
        const bom = mo.bom.find(b => b.id === s.bomEntryId);
        return sum + (s.shortageQty * (bom?.unitCost ?? 0));
      }, 0),
    }, userId);

    // Auto-create PO if requested and all shortages share one supplier
    if (autoCreatePO && bySupplier.size === 1) {
      const [supplierId, supplierShortages] = [...bySupplier.entries()][0];

      if (supplierId !== 'unassigned') {
        try {
          const poId = await createDraftPOFromShortages(
            mo,
            supplierShortages,
            supplierId,
            requirementIds,
            userId,
          );
          result.poCreated = true;
          result.poId = poId;
        } catch (err) {
          result.errors.push(`Failed to create PO: ${err}`);
        }
      }
    }

    result.success = true;
  } catch (err) {
    result.errors.push(`Failed to create requirements: ${err}`);
  }

  return result;
}

/**
 * Create a draft PO from shortage items
 */
async function createDraftPOFromShortages(
  mo: ManufacturingOrder,
  shortages: MaterialAvailability[],
  supplierId: string,
  requirementIds: string[],
  userId: string,
): Promise<string> {
  const supplier = await getSupplierById(supplierId);

  const lineItems = shortages.map((s, idx) => {
    const bomEntry = mo.bom.find(b => b.id === s.bomEntryId);
    return {
      id: `LI-${Date.now()}-${idx}`,
      inventoryItemId: s.inventoryItemId || undefined,
      sku: s.sku,
      description: `${s.itemName} (MO: ${mo.moNumber})`,
      quantity: s.shortageQty,
      unitCost: bomEntry?.unitCost ?? 0,
      totalCost: s.shortageQty * (bomEntry?.unitCost ?? 0),
      currency: mo.costSummary.currency,
      unit: bomEntry?.unit ?? 'units',
      quantityReceived: 0,
    };
  });

  const year = new Date().getFullYear();
  const poNumber = `PO-AUTO-${year}-${Date.now().toString().slice(-6)}`;

  const poData = {
    poNumber,
    status: 'draft',
    supplierName: supplier?.name ?? 'Unknown Supplier',
    supplierContact: supplier ? `${supplier.contactPerson} — ${supplier.phone}` : null,
    supplierId,
    lineItems,
    landedCosts: {
      shipping: 0,
      customs: 0,
      duties: 0,
      insurance: 0,
      handling: 0,
      other: 0,
      totalLandedCost: 0,
      currency: mo.costSummary.currency,
      distributionMethod: 'proportional_value' as const,
    },
    totals: {
      subtotal: lineItems.reduce((sum, li) => sum + li.totalCost, 0),
      landedCostTotal: 0,
      grandTotal: lineItems.reduce((sum, li) => sum + li.totalCost, 0),
      currency: mo.costSummary.currency,
    },
    approvals: [],
    receivingHistory: [],
    linkedMOIds: [mo.id],
    linkedRequirementIds: requirementIds,
    linkedProjectId: mo.projectId,
    notes: `Auto-generated from MO ${mo.moNumber} shortage detection`,
    subsidiaryId: mo.subsidiaryId,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  const poRef = await addDoc(collection(db, PURCHASE_ORDERS_COLLECTION), poData);

  // Update requirements with PO link
  const batch = writeBatch(db);
  for (let i = 0; i < requirementIds.length; i++) {
    const reqRef = doc(db, PROCUREMENT_REQUIREMENTS_COLLECTION, requirementIds[i]);
    batch.update(reqRef, {
      status: 'added-to-po',
      poId: poRef.id,
      poLineItemId: lineItems[i]?.id,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  await emitBusinessEvent('purchase_order_auto_created', {
    poId: poRef.id,
    poNumber,
    moId: mo.id,
    moNumber: mo.moNumber,
    supplierId,
    lineItemCount: lineItems.length,
    totalValue: poData.totals.grandTotal,
  }, userId);

  return poRef.id;
}

// ============================================
// Reorder Point Monitoring
// ============================================

/**
 * Get reorder alerts for items that have fallen below their reorder level.
 * Enriched with MO linkage data to show production impact.
 */
export async function getReorderAlerts(
  subsidiaryId: string,
): Promise<ReorderAlert[]> {
  const lowStockLevels = await getLowStockLevels();
  const alerts: ReorderAlert[] = [];

  for (const stockLevel of lowStockLevels) {
    // Get inventory item details
    const itemDoc = await getDoc(doc(db, INVENTORY_ITEMS_COLLECTION, stockLevel.inventoryItemId));
    const itemData = itemDoc.data();

    // Count linked MOs that might be affected
    const moQuery = query(
      collection(db, 'manufacturingOrders'),
      where('subsidiaryId', '==', subsidiaryId),
      where('status', 'in', ['draft', 'approved', 'in-progress']),
    );
    const moSnap = await getDocs(moQuery);

    let linkedMOCount = 0;
    for (const moDoc of moSnap.docs) {
      const mo = moDoc.data() as ManufacturingOrder;
      const hasItem = mo.bom.some(b => b.inventoryItemId === stockLevel.inventoryItemId);
      if (hasItem) linkedMOCount++;
    }

    // Determine urgency
    const shortagePercent = stockLevel.reorderLevel
      ? ((stockLevel.reorderLevel - stockLevel.quantityAvailable) / stockLevel.reorderLevel) * 100
      : 0;

    let urgency: ReorderAlert['urgency'];
    if (stockLevel.quantityAvailable <= 0 || linkedMOCount > 3) {
      urgency = 'critical';
    } else if (shortagePercent > 50 || linkedMOCount > 1) {
      urgency = 'high';
    } else if (shortagePercent > 25) {
      urgency = 'medium';
    } else {
      urgency = 'low';
    }

    alerts.push({
      inventoryItemId: stockLevel.inventoryItemId,
      itemName: stockLevel.itemName,
      sku: stockLevel.sku,
      warehouseId: stockLevel.warehouseId,
      warehouseName: stockLevel.warehouseId, // Would need warehouse lookup
      quantityAvailable: stockLevel.quantityAvailable,
      reorderLevel: stockLevel.reorderLevel ?? 0,
      reorderQuantity: itemData?.inventory?.reorderQuantity ?? stockLevel.reorderLevel ?? 0,
      shortageQty: Math.max(0, (stockLevel.reorderLevel ?? 0) - stockLevel.quantityAvailable),
      preferredSupplierId: itemData?.procurement?.preferredSupplierId,
      preferredSupplierName: itemData?.procurement?.preferredSupplierName,
      lastPurchasePrice: itemData?.pricing?.costPerUnit,
      linkedMOCount,
      urgency,
    });
  }

  // Sort by urgency
  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  alerts.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return alerts;
}

/**
 * Generate procurement requirements from reorder alerts
 */
export async function generateProcurementFromReorderAlerts(
  alerts: ReorderAlert[],
  userId: string,
  subsidiaryId: string,
): Promise<string[]> {
  const batch = writeBatch(db);
  const requirementIds: string[] = [];

  for (const alert of alerts) {
    if (alert.shortageQty <= 0) continue;

    const reqRef = doc(collection(db, PROCUREMENT_REQUIREMENTS_COLLECTION));
    const reqData = {
      subsidiaryId,
      moId: null, // Not linked to specific MO
      moNumber: null,
      bomEntryId: null,
      designItemName: null,
      projectCode: null,
      inventoryItemId: alert.inventoryItemId,
      itemDescription: alert.itemName,
      quantityRequired: alert.reorderQuantity || alert.shortageQty,
      unit: 'units',
      estimatedUnitCost: alert.lastPurchasePrice ?? 0,
      estimatedTotalCost: (alert.reorderQuantity || alert.shortageQty) * (alert.lastPurchasePrice ?? 0),
      currency: 'UGX',
      supplierId: alert.preferredSupplierId || null,
      supplierName: alert.preferredSupplierName || null,
      status: 'pending',
      poId: null,
      poLineItemId: null,
      source: 'reorder_alert',
      urgency: alert.urgency,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    batch.set(reqRef, reqData);
    requirementIds.push(reqRef.id);
  }

  await batch.commit();

  await emitBusinessEvent('reorder_requirements_generated', {
    alertCount: alerts.length,
    requirementsCreated: requirementIds.length,
    criticalCount: alerts.filter(a => a.urgency === 'critical').length,
  }, userId);

  return requirementIds;
}

// ============================================
// Unified Stock Status
// ============================================

/**
 * Get comprehensive stock status for all BOM items across an MO's lifecycle.
 * Shows reserved, consumed, and remaining quantities.
 */
export async function getMOStockStatus(
  mo: ManufacturingOrder,
): Promise<{
  bomEntryId: string;
  itemName: string;
  quantityRequired: number;
  quantityReserved: number;
  quantityConsumed: number;
  quantityRemaining: number;
  status: 'pending' | 'reserved' | 'partial-consumed' | 'fully-consumed';
}[]> {
  const status = [];

  for (const bomEntry of mo.bom) {
    // Find reservations for this BOM entry
    const reservation = mo.materialReservations.find(
      r => r.inventoryItemId === bomEntry.inventoryItemId && r.warehouseId === (bomEntry.warehouseId ?? '')
    );

    // Find consumptions for this BOM entry (prefer bomEntryId, fallback to inventoryItemId for legacy data)
    const consumptions = mo.materialConsumptions.filter(
      c => c.bomEntryId === bomEntry.id || (!c.bomEntryId && c.inventoryItemId === bomEntry.inventoryItemId)
    );
    const totalConsumed = consumptions.reduce((sum, c) => sum + c.quantityConsumed, 0);

    const reserved = reservation?.status === 'active' ? reservation.quantityReserved : 0;
    const remaining = bomEntry.quantityRequired - totalConsumed;

    let itemStatus: 'pending' | 'reserved' | 'partial-consumed' | 'fully-consumed';
    if (totalConsumed >= bomEntry.quantityRequired) {
      itemStatus = 'fully-consumed';
    } else if (totalConsumed > 0) {
      itemStatus = 'partial-consumed';
    } else if (reserved > 0) {
      itemStatus = 'reserved';
    } else {
      itemStatus = 'pending';
    }

    status.push({
      bomEntryId: bomEntry.id,
      itemName: bomEntry.itemName,
      quantityRequired: bomEntry.quantityRequired,
      quantityReserved: reserved,
      quantityConsumed: totalConsumed,
      quantityRemaining: remaining,
      status: itemStatus,
    });
  }

  return status;
}

// ============================================
// BOM Item Substitution — Find Similar Items
// ============================================

// Re-export the shared type so existing consumers keep working
export type { SimilarInventoryItem } from '@/shared/services/inventory/similarItemService';
import { findSimilarItems, type SimilarInventoryItem } from '@/shared/services/inventory/similarItemService';

/**
 * Find inventory items that can substitute for a given BOM entry.
 * Thin wrapper around the shared similarItemService, mapping BOMEntry fields.
 */
export async function findSimilarInventoryItems(
  bomEntry: BOMEntry,
  _subsidiaryId?: string,
): Promise<SimilarInventoryItem[]> {
  // Offcut-backed entries don't have inventory items to look up
  if (bomEntry.offcutId) return [];

  return findSimilarItems({
    inventoryItemId: bomEntry.inventoryItemId,
    category: bomEntry.category,
    sku: bomEntry.sku,
    name: bomEntry.itemName,
  });
}

// ============================================
// Business Event Helper
// ============================================

async function emitBusinessEvent(
  eventType: string,
  data: Record<string, unknown>,
  userId: string,
): Promise<void> {
  await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
    eventType,
    category: 'inventory_integration',
    severity: eventType.includes('critical') ? 'high' : 'medium',
    sourceModule: 'manufacturing',
    subsidiary: 'finishes',
    entityType: 'inventory_integration',
    entityId: data.moId ?? data.poId ?? '',
    title: eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    description: JSON.stringify(data),
    triggeredBy: userId,
    triggeredAt: serverTimestamp(),
    status: 'pending',
    metadata: data,
    createdAt: serverTimestamp(),
  });
}
