/**
 * Purchase Order Service
 * Full PO lifecycle: Draft → Approval → Sent → Receive → Close
 * Includes landed cost calculation and inventory cost updates
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  runTransaction,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  POLineItem,
  LandedCosts,
  POApproval,
  GoodsReceipt,
  GoodsReceiptEditRecord,
  POTotals,
  POFilters,
  PORevision,
  POFieldChange,
} from '../types/purchaseOrder';
import { getRequiredApprovalTier } from '../types/purchaseOrder';
import {
  receiveStock,
  updateInventoryItemCostFromReceipt,
  adjustStock,
  recordCostChange,
} from '@/modules/inventory/services/stockLevelService';
import { updateRequirementsByPOStatus } from './procurementRequirementService';
import { updatePerformanceMetrics } from '@/modules/suppliers/services/supplierService';
import { getInventoryItem } from '@/modules/inventory/services/inventoryService';
import { assetService } from '@/modules/assets/services/AssetService';
import type { AssetCategory } from '@/shared/types/assets';

const PURCHASE_ORDERS_COLLECTION = 'purchaseOrders';
const BUSINESS_EVENTS_COLLECTION = 'businessEvents';
const COUNTERS_COLLECTION = 'counters';

/** Recursively strip undefined values from an object (Firestore rejects undefined) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripUndefined(obj: any): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (obj instanceof Date || (obj && typeof obj.toDate === 'function')) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)])
  );
}

// ============================================
// MPN Resolution from Vendor Sources
// ============================================

/**
 * Resolve the MPN (Manufacturer Part Number) for a PO line item.
 * Looks up the inventory item's vendorSources and finds:
 * 1. A vendor source matching the PO's supplier → returns its MPN
 * 2. If no supplier match, returns the preferred vendor source's MPN
 * 3. Falls back to undefined (no MPN available)
 */
export async function resolveMpnForLineItem(
  inventoryItemId: string,
  supplierId?: string,
): Promise<{ mpn?: string; supplierSku?: string }> {
  const item = await getInventoryItem(inventoryItemId);
  if (!item?.vendorSources?.length) return {};

  // Try to find a source matching the PO supplier
  if (supplierId) {
    const supplierMatch = item.vendorSources.find((vs) => vs.supplierId === supplierId);
    if (supplierMatch) {
      return { mpn: supplierMatch.mpn, supplierSku: supplierMatch.supplierSku };
    }
  }

  // Fall back to preferred vendor source
  const preferred = item.vendorSources.find((vs) => vs.isPreferred);
  if (preferred) {
    return { mpn: preferred.mpn, supplierSku: preferred.supplierSku };
  }

  // Fall back to first source
  const first = item.vendorSources[0];
  return { mpn: first.mpn, supplierSku: first.supplierSku };
}

/**
 * Enrich PO line items with MPNs from vendor sources.
 * Call this before creating a PO to populate MPN fields.
 */
export async function enrichLineItemsWithMpn(
  lineItems: POLineItem[],
  supplierId?: string,
): Promise<POLineItem[]> {
  const enriched = await Promise.all(
    lineItems.map(async (line) => {
      if (line.mpn || !line.inventoryItemId) return line;
      const resolved = await resolveMpnForLineItem(line.inventoryItemId, supplierId);
      return { ...line, mpn: resolved.mpn };
    }),
  );
  return enriched;
}

// ============================================
// Auto-numbering (transaction-safe)
// ============================================

async function generatePONumber(subsidiaryId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = subsidiaryId === 'finishes' ? 'PO-FIN' : 'PO';
  const counterDocId = `po_${subsidiaryId}_${year}`;
  const counterRef = doc(db, COUNTERS_COLLECTION, counterDocId);

  const nextNum = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    let current = 0;
    if (counterSnap.exists()) {
      current = counterSnap.data().value ?? 0;
    }
    const next = current + 1;
    transaction.set(counterRef, { value: next, prefix, year, subsidiaryId }, { merge: true });
    return next;
  });

  return `${prefix}-${year}-${String(nextNum).padStart(4, '0')}`;
}

// ============================================
// Landed Cost Calculation
// ============================================

/**
 * Calculate landed cost distribution across line items
 * and compute effective unit costs
 */
export function calculateLandedCostDistribution(
  lineItems: POLineItem[],
  landedCosts: LandedCosts,
): { updatedLineItems: POLineItem[]; totals: POTotals } {
  const totalLanded =
    landedCosts.shipping +
    landedCosts.customs +
    landedCosts.duties +
    landedCosts.insurance +
    landedCosts.handling +
    landedCosts.other;

  const subtotal = lineItems.reduce((sum, li) => sum + li.totalCost, 0);
  const totalWeight = lineItems.reduce((sum, li) => sum + (li.weight ?? 0), 0);

  const updatedLineItems = lineItems.map((li) => {
    let allocation = 0;

    switch (landedCosts.distributionMethod) {
      case 'proportional_value':
        allocation = subtotal > 0 ? (li.totalCost / subtotal) * totalLanded : 0;
        break;
      case 'proportional_weight':
        allocation =
          totalWeight > 0 ? ((li.weight ?? 0) / totalWeight) * totalLanded : 0;
        break;
      case 'equal':
        allocation = lineItems.length > 0 ? totalLanded / lineItems.length : 0;
        break;
    }

    const effectiveUnitCost =
      li.quantity > 0 ? (li.totalCost + allocation) / li.quantity : li.unitCost;

    return {
      ...li,
      landedCostAllocation: Math.round(allocation * 100) / 100,
      effectiveUnitCost: Math.round(effectiveUnitCost * 100) / 100,
    };
  });

  const totals: POTotals = {
    subtotal: Math.round(subtotal * 100) / 100,
    landedCostTotal: Math.round(totalLanded * 100) / 100,
    grandTotal: Math.round((subtotal + totalLanded) * 100) / 100,
    currency: landedCosts.currency,
  };

  return { updatedLineItems, totals };
}

// ============================================
// Business Event Emission
// ============================================

async function emitBusinessEvent(
  eventType: string,
  po: Partial<PurchaseOrder>,
  userId: string,
  extraData?: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
    eventType,
    category: 'workflow_transition',
    severity: 'medium',
    sourceModule: 'manufacturing',
    subsidiary: 'finishes',
    entityType: 'purchase_order',
    entityId: po.id ?? '',
    entityName: po.poNumber ?? '',
    projectId: po.linkedProjectId ?? null,
    title: `Purchase order ${eventType.replace(/_/g, ' ')}`,
    description: `PO ${po.poNumber} - ${po.supplierName ?? 'unknown supplier'}`,
    triggeredBy: userId,
    triggeredAt: serverTimestamp(),
    status: 'pending',
    metadata: extraData ?? {},
    createdAt: serverTimestamp(),
  });
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a draft purchase order
 */
export async function createPurchaseOrder(
  data: {
    supplierName: string;
    supplierContact?: string;
    supplierId?: string;
    lineItems: POLineItem[];
    landedCosts: LandedCosts;
    linkedMOIds?: string[];
    linkedProjectId?: string;
    notes?: string;
    subsidiaryId: string;
    orderDate?: Date;
  },
  userId: string,
): Promise<string> {
  const poNumber = await generatePONumber(data.subsidiaryId);
  const { updatedLineItems, totals } = calculateLandedCostDistribution(
    data.lineItems,
    data.landedCosts,
  );

  const landedCosts: LandedCosts = {
    ...data.landedCosts,
    totalLandedCost: totals.landedCostTotal,
  };

  const poData = {
    poNumber,
    status: 'draft' as PurchaseOrderStatus,
    orderDate: data.orderDate ?? new Date(),
    supplierName: data.supplierName,
    supplierContact: data.supplierContact ?? null,
    supplierId: data.supplierId ?? null,
    lineItems: updatedLineItems,
    landedCosts,
    totals,
    approvals: [],
    receivingHistory: [],
    linkedMOIds: data.linkedMOIds ?? [],
    linkedProjectId: data.linkedProjectId ?? null,
    notes: data.notes ?? null,
    subsidiaryId: data.subsidiaryId,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  const docRef = await addDoc(collection(db, PURCHASE_ORDERS_COLLECTION), stripUndefined(poData));

  await emitBusinessEvent('purchase_order_created', { ...poData, id: docRef.id } as unknown as Partial<PurchaseOrder>, userId);

  return docRef.id;
}

/**
 * Validate line item edits against receiving constraints.
 * - Cannot reduce ordered quantity below already-received quantity
 * - Cannot change SKU or unit cost on lines that have been partially received
 * - Cannot remove a line that has received quantities
 */
function validateLineItemEdits(
  existingLines: POLineItem[],
  newLines: POLineItem[],
): void {
  const existingMap = new Map(existingLines.map((li) => [li.id, li]));

  // Check for removed lines that have received quantities
  for (const existing of existingLines) {
    if (existing.quantityReceived > 0) {
      const stillPresent = newLines.find((nl) => nl.id === existing.id);
      if (!stillPresent) {
        throw new Error(
          `Cannot remove line "${existing.description}" — ${existing.quantityReceived} units already received`,
        );
      }
    }
  }

  // Check for invalid edits on partially received lines
  for (const line of newLines) {
    const prev = existingMap.get(line.id);
    if (!prev) continue; // new line, no constraints

    if (prev.quantityReceived > 0) {
      // Cannot reduce ordered qty below received qty
      if (line.quantity < prev.quantityReceived) {
        throw new Error(
          `Cannot set quantity for "${line.description}" to ${line.quantity} — ${prev.quantityReceived} already received`,
        );
      }
      // Lock SKU on received lines
      if (line.sku !== prev.sku) {
        throw new Error(
          `Cannot change SKU for "${line.description}" — line has received quantities`,
        );
      }
      // Lock unit cost on received lines
      if (line.unitCost !== prev.unitCost) {
        throw new Error(
          `Cannot change unit cost for "${line.description}" — line has received quantities. Adjust via landed costs instead.`,
        );
      }
    }
  }
}

/**
 * Detect field-level changes between existing and incoming PO data
 */
function detectChanges(
  existing: PurchaseOrder,
  incoming: {
    supplierName?: string;
    supplierContact?: string;
    lineItems?: POLineItem[];
    landedCosts?: LandedCosts;
    notes?: string;
    linkedMOIds?: string[];
    linkedProjectId?: string;
  },
): POFieldChange[] {
  const changes: POFieldChange[] = [];

  if (incoming.supplierName && incoming.supplierName !== existing.supplierName) {
    changes.push({ field: 'supplierName', previousValue: existing.supplierName, newValue: incoming.supplierName });
  }
  if (incoming.supplierContact !== undefined && incoming.supplierContact !== (existing.supplierContact ?? '')) {
    changes.push({ field: 'supplierContact', previousValue: existing.supplierContact, newValue: incoming.supplierContact });
  }
  if (incoming.notes !== undefined && incoming.notes !== (existing.notes ?? '')) {
    changes.push({ field: 'notes', previousValue: existing.notes, newValue: incoming.notes });
  }

  // Detect line item changes
  if (incoming.lineItems) {
    const existingMap = new Map(existing.lineItems.map((li) => [li.id, li]));
    const newIds = new Set(incoming.lineItems.map((li) => li.id));

    // Removed lines
    for (const prev of existing.lineItems) {
      if (!newIds.has(prev.id)) {
        changes.push({ field: 'lineItem.removed', lineItemId: prev.id, previousValue: prev.description, newValue: null });
      }
    }
    // Added or modified lines
    for (const line of incoming.lineItems) {
      const prev = existingMap.get(line.id);
      if (!prev) {
        changes.push({ field: 'lineItem.added', lineItemId: line.id, previousValue: null, newValue: line.description });
      } else {
        if (line.description !== prev.description) {
          changes.push({ field: 'lineItem.description', lineItemId: line.id, previousValue: prev.description, newValue: line.description });
        }
        if (line.quantity !== prev.quantity) {
          changes.push({ field: 'lineItem.quantity', lineItemId: line.id, previousValue: prev.quantity, newValue: line.quantity });
        }
        if (line.unitCost !== prev.unitCost) {
          changes.push({ field: 'lineItem.unitCost', lineItemId: line.id, previousValue: prev.unitCost, newValue: line.unitCost });
        }
        if (line.sku !== prev.sku) {
          changes.push({ field: 'lineItem.sku', lineItemId: line.id, previousValue: prev.sku, newValue: line.sku });
        }
      }
    }
  }

  // Detect landed cost changes
  if (incoming.landedCosts) {
    const fields = ['shipping', 'customs', 'duties', 'insurance', 'handling', 'other', 'distributionMethod', 'currency'] as const;
    for (const f of fields) {
      if (incoming.landedCosts[f] !== existing.landedCosts[f]) {
        changes.push({ field: `landedCosts.${f}`, previousValue: existing.landedCosts[f], newValue: incoming.landedCosts[f] });
      }
    }
  }

  return changes;
}

/**
 * Update purchase order details (only in draft/pending-approval status)
 * Enforces edit safety rules and records a revision snapshot
 */
export async function updatePurchaseOrder(
  poId: string,
  data: {
    supplierName?: string;
    supplierContact?: string;
    supplierId?: string;
    lineItems?: POLineItem[];
    landedCosts?: LandedCosts;
    notes?: string;
    linkedMOIds?: string[];
    linkedProjectId?: string;
    orderDate?: Date;
  },
  userId: string,
  options?: { isAdminEdit?: boolean },
): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('Purchase order not found');

  const existing = { id: poId, ...poSnap.data() } as PurchaseOrder;
  const editableStatuses = ['draft', 'pending-approval'];
  const adminEditableStatuses = ['approved', 'sent', 'partially-received'];

  if (!editableStatuses.includes(existing.status)) {
    if (options?.isAdminEdit && adminEditableStatuses.includes(existing.status)) {
      // Admin override: allow editing approved/sent/partially-received POs
    } else {
      throw new Error(`Cannot edit PO in "${existing.status}" status`);
    }
  }

  // ── Safety validation on line items ──
  if (data.lineItems) {
    validateLineItemEdits(existing.lineItems, data.lineItems);
  }

  // ── Change detection ──
  const changes = detectChanges(existing, data);

  // ── Create revision snapshot (only if there are actual changes) ──
  const revisionHistory = existing.revisionHistory ?? [];
  let updatedRevisionHistory = revisionHistory;

  if (changes.length > 0) {
    const revision: PORevision = {
      id: `REV-${Date.now()}`,
      revisionNumber: revisionHistory.length + 1,
      editedAt: new Date() as unknown as PORevision['editedAt'],
      editedBy: userId,
      changes,
      previousLineItems: existing.lineItems,
    };
    updatedRevisionHistory = [...revisionHistory, revision];
  }

  // ── Build update payload ──
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: userId,
    revisionHistory: updatedRevisionHistory,
  };

  if (data.supplierName) updateData.supplierName = data.supplierName;
  if (data.supplierId !== undefined) updateData.supplierId = data.supplierId;
  if (data.supplierContact !== undefined) updateData.supplierContact = data.supplierContact;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.linkedMOIds) updateData.linkedMOIds = data.linkedMOIds;
  if (data.linkedProjectId !== undefined) updateData.linkedProjectId = data.linkedProjectId;
  if (data.orderDate !== undefined) updateData.orderDate = data.orderDate;

  // Recalculate if line items or landed costs changed
  if (data.lineItems || data.landedCosts) {
    const lineItems = data.lineItems ?? existing.lineItems;
    const landedCosts = data.landedCosts ?? existing.landedCosts;
    const { updatedLineItems, totals } = calculateLandedCostDistribution(lineItems, landedCosts);

    updateData.lineItems = updatedLineItems;
    updateData.landedCosts = { ...landedCosts, totalLandedCost: totals.landedCostTotal };
    updateData.totals = totals;
  }

  await updateDoc(poRef, stripUndefined(updateData));

  // ── Emit audit event ──
  if (changes.length > 0) {
    await emitBusinessEvent('purchase_order_edited', existing, userId, {
      changeCount: changes.length,
      revisionNumber: updatedRevisionHistory.length,
      adminEdit: options?.isAdminEdit ?? false,
      changes: changes.map((c) => ({
        field: c.field,
        lineItemId: c.lineItemId,
        from: String(c.previousValue ?? ''),
        to: String(c.newValue ?? ''),
      })),
    });
  }
}

/**
 * Get a single purchase order by ID
 */
export async function getPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
  const docRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as PurchaseOrder;
}

// ============================================
// Status Transitions
// ============================================

/**
 * Submit PO for approval (Draft → Pending Approval)
 */
export async function submitForApproval(poId: string, userId: string): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('PO not found');

  const po = { id: poId, ...poSnap.data() } as PurchaseOrder;
  if (po.status !== 'draft') throw new Error('PO must be in draft status');
  if (po.lineItems.length === 0) throw new Error('PO must have at least one line item');

  // Determine required approval tier based on PO value
  const tier = getRequiredApprovalTier(po.totals?.grandTotal ?? 0);

  const approval: POApproval = {
    id: `APR-${Date.now()}`,
    approverId: '',
    approverName: '',
    status: 'pending',
    level: 1,
    notes: `Requires ${tier.label} (${tier.requiredRole})`,
  };

  await updateDoc(poRef, stripUndefined({
    status: 'pending-approval',
    approvals: [approval],
    approvalTier: tier.requiredRole,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  await emitBusinessEvent('purchase_order_submitted_for_approval', po, userId);
}

/**
 * Approve a purchase order (Pending Approval → Approved)
 */
export async function approvePurchaseOrder(
  poId: string,
  userId: string,
  approverName: string,
  notes?: string,
): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('PO not found');

  const po = { id: poId, ...poSnap.data() } as PurchaseOrder;
  if (po.status !== 'pending-approval') throw new Error('PO is not pending approval');

  const updatedApprovals = po.approvals.map((a) =>
    a.status === 'pending'
      ? {
          ...a,
          approverId: userId,
          approverName,
          status: 'approved' as const,
          respondedAt: new Date(),
          notes,
        }
      : a,
  );

  await updateDoc(poRef, stripUndefined({
    status: 'approved',
    approvals: updatedApprovals,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  await emitBusinessEvent('purchase_order_approved', po, userId);
}

/**
 * Reject a purchase order (Pending Approval → Draft)
 */
export async function rejectPurchaseOrder(
  poId: string,
  userId: string,
  approverName: string,
  notes: string,
): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('PO not found');

  const po = { id: poId, ...poSnap.data() } as PurchaseOrder;
  if (po.status !== 'pending-approval') throw new Error('PO is not pending approval');

  const updatedApprovals = po.approvals.map((a) =>
    a.status === 'pending'
      ? {
          ...a,
          approverId: userId,
          approverName,
          status: 'rejected' as const,
          respondedAt: new Date(),
          notes,
        }
      : a,
  );

  await updateDoc(poRef, stripUndefined({
    status: 'draft',
    approvals: updatedApprovals,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  await emitBusinessEvent('purchase_order_rejected', po, userId);
}

/**
 * Mark PO as sent to supplier (Approved → Sent)
 */
export async function markAsSent(poId: string, userId: string): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('PO not found');

  const po = { id: poId, ...poSnap.data() } as PurchaseOrder;
  if (po.status !== 'approved') throw new Error('PO must be approved before sending');

  await updateDoc(poRef, stripUndefined({
    status: 'sent',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  // Mark linked procurement requirements as ordered
  try {
    await updateRequirementsByPOStatus(poId, 'ordered');
  } catch {
    console.warn('Failed to update procurement requirements for PO:', poId);
  }

  await emitBusinessEvent('purchase_order_sent', po, userId);
}

/**
 * Receive goods against a PO
 * Updates stock levels and inventory item costs with landed cost
 */
export async function receiveGoods(
  poId: string,
  receipt: Omit<GoodsReceipt, 'id'>,
  userId: string,
): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('PO not found');

  const po = { id: poId, ...poSnap.data() } as PurchaseOrder;
  if (!['sent', 'partially-received'].includes(po.status)) {
    throw new Error('PO must be sent or partially received to receive goods');
  }

  const receiptWithId: GoodsReceipt = {
    ...receipt,
    id: `GR-${Date.now()}`,
  };

  // Update line item received quantities and persist inventory links
  const updatedLineItems = po.lineItems.map((li) => {
    const receiptLine = receipt.lines.find((rl) => rl.lineItemId === li.id);
    if (!receiptLine) return li;
    const updated = {
      ...li,
      quantityReceived: li.quantityReceived + receiptLine.quantityReceived,
    };
    // Persist inventoryItemId from receipt onto PO line for future partial receipts
    if (receiptLine.inventoryItemId && !li.inventoryItemId) {
      updated.inventoryItemId = receiptLine.inventoryItemId;
    }
    return updated;
  });

  // Determine if fully or partially received
  const allFullyReceived = updatedLineItems.every(
    (li) => li.quantityReceived >= li.quantity,
  );
  const newStatus: PurchaseOrderStatus = allFullyReceived
    ? 'received'
    : 'partially-received';

  // Update PO
  await updateDoc(poRef, stripUndefined({
    status: newStatus,
    lineItems: updatedLineItems,
    receivingHistory: [...po.receivingHistory, receiptWithId],
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  // Route each received line by category
  for (const line of receipt.lines) {
    const poLineItem = updatedLineItems.find((li) => li.id === line.lineItemId);
    if (!poLineItem) continue;

    const category = poLineItem.category ?? 'inventory';

    switch (category) {
      case 'inventory': {
        if (!line.inventoryItemId) break;
        // Receive stock at the specified warehouse
        await receiveStock(
          line.inventoryItemId,
          line.warehouseId,
          poLineItem.sku ?? '',
          poLineItem.description,
          line.quantityReceived,
          poId,
          userId,
          `From PO ${po.poNumber}`,
        );
        // Update inventory item cost with landed cost (weighted average)
        if (poLineItem.effectiveUnitCost) {
          await updateInventoryItemCostFromReceipt(
            line.inventoryItemId,
            line.quantityReceived,
            poLineItem.effectiveUnitCost,
            po.totals.currency,
            userId,
            poId,
            po.poNumber,
          );
        }
        break;
      }

      case 'asset': {
        // Create asset(s) in the asset registry — one per unit received
        try {
          const descParts = poLineItem.description.split(' ');
          const asset = await assetService.createAsset(
            {
              brand: descParts[0] || 'Unknown',
              model: descParts.slice(1).join(' ') || poLineItem.description,
              category: (poLineItem.assetCategory as AssetCategory) || 'POWER_TOOL',
              specs: {},
              maintenance: {
                intervalHours: 500,
                tasks: [],
                nextServiceDue: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
                history: [],
              },
              status: 'ACTIVE',
              location: { zone: 'Receiving' },
              createdBy: userId,
              updatedBy: userId,
            },
            userId,
          );
          // Persist the assetId back onto the PO line item
          const lineIdx = updatedLineItems.findIndex((li) => li.id === line.lineItemId);
          if (lineIdx >= 0) {
            updatedLineItems[lineIdx] = { ...updatedLineItems[lineIdx], assetId: asset.id };
          }
        } catch (err) {
          console.warn('Failed to create asset from PO line:', (err as Error).message);
        }
        await emitBusinessEvent('asset_received_from_po', po, userId, {
          lineItemId: line.lineItemId,
          description: poLineItem.description,
          assetCategory: poLineItem.assetCategory,
          totalCost: poLineItem.totalCost,
        });
        break;
      }

      case 'service':
      case 'overhead': {
        // Emit business event for finance module to record the expense
        await emitBusinessEvent(`${category}_expense_from_po`, po, userId, {
          lineItemId: line.lineItemId,
          category,
          description: poLineItem.description,
          totalCost: poLineItem.totalCost,
          expenseAccountCode: poLineItem.expenseAccountCode,
          currency: poLineItem.currency,
        });
        break;
      }
    }
  }

  // Mark linked procurement requirements as received (if fully received)
  if (allFullyReceived) {
    try {
      await updateRequirementsByPOStatus(poId, 'received');
    } catch {
      console.warn('Failed to update procurement requirements for PO:', poId);
    }
  }

  // Update supplier performance metrics on goods receipt
  if (po.supplierId) {
    try {
      await updatePerformanceMetrics(
        po.supplierId,
        {
          orderCompleted: allFullyReceived,
          deliveryOnTime: po.expectedDeliveryDate
            ? new Date() <= (typeof (po.expectedDeliveryDate as { toDate?: () => Date }).toDate === 'function'
                ? (po.expectedDeliveryDate as { toDate: () => Date }).toDate()
                : new Date(po.expectedDeliveryDate as unknown as string))
            : true,
          qualityPassed: true, // Updated later if QC fails
        },
        userId,
      );
    } catch {
      console.warn('Failed to update supplier performance metrics for:', po.supplierId);
    }
  }

  await emitBusinessEvent('goods_received', po, userId, {
    receiptId: receiptWithId.id,
    linesReceived: receipt.lines.length,
    fullyReceived: allFullyReceived,
  });
}

/**
 * Edit a previously recorded goods receipt (admin-only).
 * Adjusts stock levels, recalculates PO line received quantities,
 * and records an audit trail entry.
 */
export async function editGoodsReceipt(
  poId: string,
  receiptId: string,
  updatedLines: { lineItemId: string; quantityReceived: number }[],
  updatedReceivedDate: Date | undefined,
  reason: string,
  userId: string,
): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('PO not found');

  const po = { id: poId, ...poSnap.data() } as PurchaseOrder;

  // Find the receipt to edit
  const receiptIndex = po.receivingHistory.findIndex((r) => r.id === receiptId);
  if (receiptIndex === -1) throw new Error('Receipt not found');
  const originalReceipt = po.receivingHistory[receiptIndex];

  // Calculate deltas per line
  const changes: GoodsReceiptEditRecord['changes'] = [];
  const stockAdjustments: {
    lineItemId: string;
    inventoryItemId: string;
    warehouseId: string;
    sku: string;
    description: string;
    delta: number;
  }[] = [];

  for (const updatedLine of updatedLines) {
    const originalLine = originalReceipt.lines.find(
      (l) => l.lineItemId === updatedLine.lineItemId,
    );
    if (!originalLine) continue;

    const delta = updatedLine.quantityReceived - originalLine.quantityReceived;
    if (delta === 0) continue;

    const poLine = po.lineItems.find((li) => li.id === updatedLine.lineItemId);
    if (!poLine) continue;

    if (updatedLine.quantityReceived < 0) {
      throw new Error(
        `Receipt quantity cannot be negative for "${poLine.description}"`,
      );
    }

    changes.push({
      lineItemId: updatedLine.lineItemId,
      previousQuantity: originalLine.quantityReceived,
      newQuantity: updatedLine.quantityReceived,
      delta,
    });

    const invId = originalLine.inventoryItemId || poLine.inventoryItemId;
    if (invId) {
      stockAdjustments.push({
        lineItemId: updatedLine.lineItemId,
        inventoryItemId: invId,
        warehouseId: originalLine.warehouseId,
        sku: poLine.sku ?? '',
        description: poLine.description,
        delta,
      });
    }
  }

  const dateChanged = !!updatedReceivedDate;
  if (changes.length === 0 && !dateChanged) {
    throw new Error('No changes detected');
  }

  // 1. Update the receipt in receivingHistory
  const updatedReceivingHistory = [...po.receivingHistory];
  const updatedReceipt = { ...originalReceipt };

  updatedReceipt.lines = originalReceipt.lines.map((line) => {
    const update = updatedLines.find((u) => u.lineItemId === line.lineItemId);
    if (!update) return line;
    return { ...line, quantityReceived: update.quantityReceived };
  });

  if (updatedReceivedDate) {
    updatedReceipt.receivedDate = updatedReceivedDate as unknown as GoodsReceipt['receivedDate'];
  }

  updatedReceivingHistory[receiptIndex] = updatedReceipt;

  // 2. Recalculate lineItems[].quantityReceived from ALL receipts
  const updatedLineItems = po.lineItems.map((li) => {
    const totalReceived = updatedReceivingHistory.reduce((sum, r) => {
      const rl = r.lines.find((l) => l.lineItemId === li.id);
      return sum + (rl?.quantityReceived ?? 0);
    }, 0);
    return { ...li, quantityReceived: totalReceived };
  });

  // 3. Recalculate PO status
  const allFullyReceived = updatedLineItems.every(
    (li) => li.quantityReceived >= li.quantity,
  );
  const anyReceived = updatedLineItems.some((li) => li.quantityReceived > 0);
  let newStatus: PurchaseOrderStatus = po.status;
  if (allFullyReceived) {
    newStatus = 'received';
  } else if (anyReceived) {
    newStatus = 'partially-received';
  } else {
    newStatus = 'sent';
  }

  // 4. Create audit record
  const editRecord: GoodsReceiptEditRecord = {
    id: `GRE-${Date.now()}`,
    receiptId,
    editedAt: new Date() as unknown as GoodsReceiptEditRecord['editedAt'],
    editedBy: userId,
    reason,
    changes,
    ...(updatedReceivedDate
      ? {
          previousReceivedDate: originalReceipt.receivedDate,
          newReceivedDate: updatedReceivedDate as unknown as GoodsReceiptEditRecord['newReceivedDate'],
        }
      : {}),
  };

  const receiptEditHistory = [...(po.receiptEditHistory ?? []), editRecord];

  // 5. Update PO document — flag QBO sync as correction-pending if a Bill exists
  const poUpdate: Record<string, unknown> = {
    status: newStatus,
    lineItems: updatedLineItems,
    receivingHistory: updatedReceivingHistory,
    receiptEditHistory,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  if (po.qboBillId) {
    poUpdate.qboSyncStatus = 'correction-pending';
  }

  await updateDoc(poRef, stripUndefined(poUpdate));

  // 6. Backward linkages: adjust stock for each changed line
  for (const adj of stockAdjustments) {
    await adjustStock(
      adj.inventoryItemId,
      adj.warehouseId,
      adj.sku,
      adj.description,
      adj.delta,
      userId,
      `Receipt correction on PO ${po.poNumber} (${receiptId}): ${adj.delta > 0 ? '+' : ''}${adj.delta}`,
    );

    // Record a cost correction entry
    const poLine = po.lineItems.find((li) => li.id === adj.lineItemId);
    if (poLine?.effectiveUnitCost) {
      await recordCostChange(
        adj.inventoryItemId,
        0,
        poLine.effectiveUnitCost,
        po.totals.currency,
        'receipt_correction',
        userId,
        poId,
        po.poNumber,
        `Receipt qty correction: delta=${adj.delta}`,
      );
    }
  }

  // 7. Update procurement requirements if status changed
  if (newStatus !== po.status) {
    try {
      if (newStatus === 'received') {
        await updateRequirementsByPOStatus(poId, 'received');
      } else if (po.status === 'received' && newStatus === 'partially-received') {
        await updateRequirementsByPOStatus(poId, 'ordered');
      }
    } catch {
      console.warn('Failed to update procurement requirements after receipt edit');
    }
  }

  // 8. Emit audit event
  await emitBusinessEvent('goods_receipt_edited', po, userId, {
    receiptId,
    changeCount: changes.length,
    reason,
    stockAdjustments: stockAdjustments.map((a) => ({
      inventoryItemId: a.inventoryItemId,
      delta: a.delta,
    })),
  });
}

/**
 * Close a purchase order (Received → Closed)
 * Also syncs actual costs to linked MOs for COGS tracking.
 */
export async function closePurchaseOrder(poId: string, userId: string): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('PO not found');

  const po = { id: poId, ...poSnap.data() } as PurchaseOrder;
  if (!['received', 'partially-received'].includes(po.status)) {
    throw new Error('PO must be received to close');
  }

  await updateDoc(poRef, stripUndefined({
    status: 'closed',
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));

  // Sync actual costs to linked MOs for COGS tracking
  if (po.linkedMOIds && po.linkedMOIds.length > 0) {
    try {
      const { syncActualCostsToMO } = await import('./poCOGSService');
      for (const moId of po.linkedMOIds) {
        await syncActualCostsToMO(moId, userId);
      }
    } catch {
      console.warn('Failed to sync COGS for linked MOs:', po.linkedMOIds);
    }
  }

  // Update supplier performance on close
  if (po.supplierId) {
    try {
      await updatePerformanceMetrics(
        po.supplierId,
        { orderCompleted: true },
        userId,
      );
    } catch {
      console.warn('Failed to update supplier performance on PO close:', po.supplierId);
    }
  }

  await emitBusinessEvent('purchase_order_closed', po, userId);
}

/**
 * Cancel a purchase order
 */
export async function cancelPurchaseOrder(
  poId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('PO not found');

  const po = { id: poId, ...poSnap.data() } as PurchaseOrder;
  if (['closed', 'cancelled'].includes(po.status)) {
    throw new Error('Cannot cancel a closed or already cancelled PO');
  }

  await updateDoc(poRef, stripUndefined({
    status: 'cancelled',
    notes: `${po.notes ? po.notes + '\n' : ''}[CANCELLED] ${reason}`,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  }));
}

/**
 * Permanently delete a purchase order from Firestore.
 * Only allowed for draft or cancelled POs with no receiving history.
 */
export async function deletePurchaseOrder(
  poId: string,
  userId: string,
): Promise<void> {
  const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) throw new Error('Purchase order not found');

  const po = { id: poId, ...poSnap.data() } as PurchaseOrder;

  if (!['draft', 'cancelled'].includes(po.status)) {
    throw new Error(
      `Cannot delete PO in "${po.status}" status. Only draft or cancelled POs can be deleted.`,
    );
  }

  if (po.receivingHistory && po.receivingHistory.length > 0) {
    throw new Error('Cannot delete PO with receiving history. Use cancel instead.');
  }

  const hasReceivedQty = po.lineItems.some((li) => li.quantityReceived > 0);
  if (hasReceivedQty) {
    throw new Error('Cannot delete PO — one or more line items have received quantities.');
  }

  // Emit audit event before deletion (captures full PO snapshot)
  await emitBusinessEvent('purchase_order_deleted', po, userId);

  await deleteDoc(poRef);
}

// ============================================
// Queries & Subscriptions
// ============================================

const DEFAULT_SUBSCRIBE_PO_LIMIT = 500;

/**
 * Subscribe to purchase orders with filters (real-time)
 */
export function subscribeToPurchaseOrders(
  filters: POFilters & { subsidiaryId: string; maxResults?: number; unbounded?: boolean },
  callback: (orders: PurchaseOrder[]) => void,
): () => void {
  const constraints: QueryConstraint[] = [
    where('subsidiaryId', '==', filters.subsidiaryId),
  ];

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length === 1) {
      constraints.push(where('status', '==', statuses[0]));
    }
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const effectiveLimit = filters.unbounded
    ? undefined
    : (filters.maxResults ?? DEFAULT_SUBSCRIBE_PO_LIMIT);
  if (effectiveLimit !== undefined) {
    constraints.push(limit(effectiveLimit));
  }

  const q = query(collection(db, PURCHASE_ORDERS_COLLECTION), ...constraints);

  return onSnapshot(q, (snapshot) => {
    let orders = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as PurchaseOrder),
    );

    // Client-side filtering for fields that can't be combined in Firestore queries
    if (filters.search) {
      const term = filters.search.toLowerCase();
      orders = orders.filter(
        (o) =>
          o.poNumber.toLowerCase().includes(term) ||
          o.supplierName.toLowerCase().includes(term),
      );
    }

    // Category filter: keep POs that have at least one line with the specified category
    if (filters.category) {
      const cats = Array.isArray(filters.category) ? filters.category : [filters.category];
      orders = orders.filter((o) =>
        o.lineItems.some((li) => cats.includes(li.category ?? 'inventory')),
      );
    }

    if (effectiveLimit !== undefined && snapshot.size >= effectiveLimit) {
      console.warn(
        `[manufacturing] subscribeToPurchaseOrders hit the ${effectiveLimit}-row cap. ` +
        `Pass unbounded=true or raise maxResults if intentional.`,
      );
    }

    callback(orders);
  });
}

/**
 * Subscribe to a single purchase order (real-time)
 */
export function subscribeToPurchaseOrder(
  poId: string,
  callback: (order: PurchaseOrder | null) => void,
): () => void {
  const docRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
  return onSnapshot(docRef, (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...snap.data() } as PurchaseOrder);
  });
}
