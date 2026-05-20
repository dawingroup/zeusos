/**
 * Procurement Requirement Service
 * Generates, queries, and consolidates procurement requirements from manufacturing orders.
 * Enables cross-MO PO consolidation by grouping requirements by supplier.
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
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ProcurementRequirement,
  ProcurementRequirementStatus,
  SupplierRequirementGroup,
  ProcurementFilters,
} from '../types/procurement';
import type { ManufacturingOrder } from '@/modules/manufacturing/types';
import type { POLineItem, PurchaseOrder } from '../types/purchaseOrder';
import { DEFAULT_LANDED_COSTS } from '../types/purchaseOrder';
import { getManufacturingOrder } from '@/modules/manufacturing/services/manufacturingOrderService';
import { createPurchaseOrder } from './purchaseOrderService';
import { getSupplierById } from './supplierBridgeService';

import type { DesignItem } from '@/modules/design-manager/types';
import { getDesignItems } from '@/modules/design-manager/services/firestore';
import { scoreAndSortRequirements, type DemandScoredRequirement, type DemandContext } from './demandScoringService';

const REQUIREMENTS_COLLECTION = 'procurementRequirements';
const MO_COLLECTION = 'manufacturingOrders';

// ============================================
// Generate Requirements from MO
// ============================================

/**
 * Scan a manufacturing order's BOM and create procurement requirements
 * for outsourced items (those with a supplier or in the 'special' category).
 */
export async function generateRequirementsFromMO(
  moId: string,
  userId: string,
): Promise<string[]> {
  const mo = await getManufacturingOrder(moId);
  if (!mo) throw new Error('Manufacturing order not found');

  const createdIds: string[] = [];

  for (const entry of mo.bom) {
    // Generate requirements for items with a supplier or special-category items
    const isOutsourced = !!entry.supplierId || entry.category === 'special';
    if (!isOutsourced) continue;

    const reqData = {
      subsidiaryId: mo.subsidiaryId,
      moId: mo.id,
      moNumber: mo.moNumber,
      bomEntryId: entry.id,
      designItemName: mo.designItemName,
      projectCode: mo.projectCode,
      inventoryItemId: entry.inventoryItemId || null,
      itemDescription: entry.itemName,
      quantityRequired: entry.quantityRequired,
      unit: entry.unit,
      estimatedUnitCost: entry.unitCost,
      estimatedTotalCost: entry.totalCost,
      currency: mo.costSummary.currency,
      supplierId: entry.supplierId || null,
      supplierName: entry.supplierName || null,
      status: 'pending' as ProcurementRequirementStatus,
      poId: null,
      poLineItemId: null,
      // Carry purchase priority from BOM entry
      ...(entry.purchasePriority != null && {
        purchasePriority: entry.purchasePriority,
        prioritySource: entry.prioritySource ?? 'design',
        upstreamPurchasePriority: entry.purchasePriority,
      }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
    };

    const docRef = await addDoc(collection(db, REQUIREMENTS_COLLECTION), reqData);
    createdIds.push(docRef.id);
  }

  return createdIds;
}

// ============================================
// Queries
// ============================================

/**
 * Get procurement requirements by an array of IDs.
 */
export async function getProcurementRequirementsByIds(
  ids: string[],
): Promise<ProcurementRequirement[]> {
  const results: ProcurementRequirement[] = [];
  for (const id of ids) {
    const snap = await getDoc(doc(db, REQUIREMENTS_COLLECTION, id));
    if (snap.exists()) {
      results.push({ id: snap.id, ...snap.data() } as ProcurementRequirement);
    }
  }
  return results;
}

/**
 * Get all procurement requirements matching filters
 */
export async function getProcurementRequirements(
  filters: ProcurementFilters & { subsidiaryId: string },
): Promise<ProcurementRequirement[]> {
  const constraints: QueryConstraint[] = [
    where('subsidiaryId', '==', filters.subsidiaryId),
  ];

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    if (statuses.length === 1) {
      constraints.push(where('status', '==', statuses[0]));
    }
  }

  if (filters.supplierId) {
    constraints.push(where('supplierId', '==', filters.supplierId));
  }

  if (filters.moId) {
    constraints.push(where('moId', '==', filters.moId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, REQUIREMENTS_COLLECTION), ...constraints);
  const snap = await getDocs(q);

  let results = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ProcurementRequirement),
  );

  // Client-side search filter
  if (filters.search) {
    const term = filters.search.toLowerCase();
    results = results.filter(
      (r) =>
        r.itemDescription.toLowerCase().includes(term) ||
        r.moNumber.toLowerCase().includes(term) ||
        r.supplierName?.toLowerCase().includes(term) ||
        r.designItemName.toLowerCase().includes(term),
    );
  }

  return results;
}

/**
 * Get pending requirements grouped by supplier for consolidation
 */
export async function getRequirementsGroupedBySupplier(
  subsidiaryId: string,
): Promise<SupplierRequirementGroup[]> {
  const requirements = await getProcurementRequirements({
    subsidiaryId,
    status: 'pending',
  });

  const groupMap = new Map<string, ProcurementRequirement[]>();

  for (const req of requirements) {
    const key = req.supplierId ?? 'unassigned';
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(req);
  }

  const groups: SupplierRequirementGroup[] = [];

  for (const [supplierId, reqs] of groupMap.entries()) {
    const uniqueMOs = new Set(reqs.map((r) => r.moId));
    groups.push({
      supplierId,
      supplierName: reqs[0]?.supplierName ?? 'Unassigned',
      requirements: reqs,
      totalEstimatedCost: reqs.reduce((sum, r) => sum + r.estimatedTotalCost, 0),
      currency: reqs[0]?.currency ?? 'USD',
      moCount: uniqueMOs.size,
    });
  }

  // Sort by total cost descending
  groups.sort((a, b) => b.totalEstimatedCost - a.totalEstimatedCost);

  return groups;
}

// ============================================
// Real-time Subscriptions
// ============================================

/**
 * Subscribe to procurement requirements (real-time)
 */
export function subscribeToProcurementRequirements(
  filters: ProcurementFilters & { subsidiaryId: string },
  callback: (requirements: ProcurementRequirement[]) => void,
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

  if (filters.supplierId) {
    constraints.push(where('supplierId', '==', filters.supplierId));
  }

  if (filters.moId) {
    constraints.push(where('moId', '==', filters.moId));
  }

  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, REQUIREMENTS_COLLECTION), ...constraints);

  return onSnapshot(q, (snapshot) => {
    let results = snapshot.docs.map(
      (d) => ({ id: d.id, ...d.data() } as ProcurementRequirement),
    );

    if (filters.search) {
      const term = filters.search.toLowerCase();
      results = results.filter(
        (r) =>
          r.itemDescription.toLowerCase().includes(term) ||
          r.moNumber.toLowerCase().includes(term) ||
          r.supplierName?.toLowerCase().includes(term),
      );
    }

    callback(results);
  });
}

// ============================================
// Consolidation into PO
// ============================================

/**
 * Consolidate selected procurement requirements into a new draft Purchase Order.
 * All requirements must share the same supplier.
 * Links PO to all originating MOs and marks requirements as added-to-po.
 */
export async function consolidateIntoPO(
  requirementIds: string[],
  supplierId: string,
  userId: string,
): Promise<string> {
  if (requirementIds.length === 0) {
    throw new Error('No requirements selected');
  }

  // Fetch all requirements
  const requirements: ProcurementRequirement[] = [];
  for (const reqId of requirementIds) {
    const reqDoc = await getDoc(doc(db, REQUIREMENTS_COLLECTION, reqId));
    if (reqDoc.exists()) {
      requirements.push({ id: reqDoc.id, ...reqDoc.data() } as ProcurementRequirement);
    }
  }

  if (requirements.length === 0) {
    throw new Error('No valid requirements found');
  }

  // Validate all requirements are pending and share the same supplier
  for (const req of requirements) {
    if (req.status !== 'pending') {
      throw new Error(`Requirement ${req.id} is not in pending status`);
    }
    if (req.supplierId && req.supplierId !== supplierId) {
      throw new Error(`Requirement ${req.id} has a different supplier`);
    }
  }

  // Fetch supplier info
  const supplier = await getSupplierById(supplierId);
  const supplierName = supplier?.name ?? requirements[0]?.supplierName ?? 'Unknown';
  const supplierContact = supplier
    ? `${supplier.contactPerson} — ${supplier.phone}`
    : undefined;

  // Build PO line items from requirements
  const lineItems: POLineItem[] = requirements.map((req, index) => ({
    id: `LI-${Date.now()}-${index}`,
    inventoryItemId: req.inventoryItemId ?? undefined,
    description: `${req.itemDescription} (MO: ${req.moNumber})`,
    quantity: req.quantityRequired,
    unitCost: req.estimatedUnitCost,
    totalCost: req.estimatedTotalCost,
    currency: req.currency,
    unit: req.unit,
    quantityReceived: 0,
  }));

  // Collect unique MO IDs
  const linkedMOIds = [...new Set(requirements.map((r) => r.moId))];

  // Create the PO
  const poId = await createPurchaseOrder(
    {
      supplierName,
      supplierContact,
      supplierId,
      lineItems,
      landedCosts: { ...DEFAULT_LANDED_COSTS, currency: requirements[0].currency },
      linkedMOIds,
      subsidiaryId: requirements[0].subsidiaryId,
      notes: `Auto-created from ${requirements.length} procurement requirement(s) across ${linkedMOIds.length} MO(s)`,
    },
    userId,
  );

  // Mark requirements as added-to-po
  const batch = writeBatch(db);
  for (let i = 0; i < requirements.length; i++) {
    const reqRef = doc(db, REQUIREMENTS_COLLECTION, requirements[i].id);
    batch.update(reqRef, {
      status: 'added-to-po',
      poId,
      poLineItemId: lineItems[i].id,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();

  // Link PO to originating MOs (add poId to each MO's linkedPOIds)
  for (const moId of linkedMOIds) {
    const moRef = doc(db, MO_COLLECTION, moId);
    const moDoc = await getDoc(moRef);
    if (moDoc.exists()) {
      const existingPOIds = (moDoc.data() as ManufacturingOrder).linkedPOIds ?? [];
      if (!existingPOIds.includes(poId)) {
        await updateDoc(moRef, {
          linkedPOIds: [...existingPOIds, poId],
          updatedAt: serverTimestamp(),
        });
      }
    }
  }

  return poId;
}

// ============================================
// Status Updates
// ============================================

/**
 * Mark a requirement as ordered (when its PO is sent)
 */
export async function markRequirementOrdered(
  requirementId: string,
): Promise<void> {
  const reqRef = doc(db, REQUIREMENTS_COLLECTION, requirementId);
  await updateDoc(reqRef, {
    status: 'ordered',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mark a requirement as received (when goods are received)
 */
export async function markRequirementReceived(
  requirementId: string,
): Promise<void> {
  const reqRef = doc(db, REQUIREMENTS_COLLECTION, requirementId);
  await updateDoc(reqRef, {
    status: 'received',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Cancel a procurement requirement
 */
export async function cancelRequirement(
  requirementId: string,
): Promise<void> {
  const reqRef = doc(db, REQUIREMENTS_COLLECTION, requirementId);
  await updateDoc(reqRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Demand-Scored Requirements
// ============================================

/**
 * Fetch pending requirements with demand scores.
 * Resolves linked MOs and design items, scores each requirement, returns sorted.
 */
export async function getRequirementsWithDemandScore(
  subsidiaryId: string,
): Promise<DemandScoredRequirement[]> {
  const requirements = await getProcurementRequirements({
    subsidiaryId,
    status: 'pending',
  });

  if (requirements.length === 0) return [];

  // Collect unique MO IDs → fetch MOs
  const uniqueMoIds = [...new Set(requirements.map((r) => r.moId))];
  const moResults = await Promise.all(
    uniqueMoIds.map((id) => getManufacturingOrder(id).catch(() => null)),
  );
  const moMap = new Map<string, ManufacturingOrder>();
  for (const mo of moResults) {
    if (mo) moMap.set(mo.id, mo);
  }

  const activeMOs = [...moMap.values()].filter(
    (mo) => mo.status !== 'cancelled' && mo.status !== 'completed',
  );

  // Collect unique project IDs → fetch design items per project
  const projectIds = [...new Set(
    [...moMap.values()].map((mo) => mo.projectId).filter((p): p is string => Boolean(p)),
  )];
  const designItemMap = new Map<string, DesignItem>();
  const projectItemCounts = new Map<string, number>();

  const itemResults = await Promise.all(
    projectIds.map((pid) => getDesignItems(pid).catch(() => [] as DesignItem[])),
  );
  for (let i = 0; i < projectIds.length; i++) {
    const items = itemResults[i];
    projectItemCounts.set(projectIds[i], items.length);
    for (const item of items) {
      designItemMap.set(item.id, item);
    }
  }

  // Build context map keyed by requirement ID
  const contextMap = new Map<string, DemandContext>();
  for (const req of requirements) {
    const mo = moMap.get(req.moId) ?? null;
    const designItem = mo?.designItemId ? (designItemMap.get(mo.designItemId) ?? null) : null;
    const totalItems = mo?.projectId ? (projectItemCounts.get(mo.projectId) ?? 0) : 0;

    contextMap.set(req.id, {
      mo,
      totalActiveMOs: activeMOs.length,
      designItem,
      totalItemsInProject: totalItems,
    });
  }

  return scoreAndSortRequirements(requirements, contextMap);
}

/**
 * Update all requirements linked to a PO when PO status changes
 */
export async function updateRequirementsByPOStatus(
  poId: string,
  newStatus: PurchaseOrder['status'],
): Promise<void> {
  // Map PO status → requirement status (only certain PO statuses advance requirements)
  let reqStatus: 'ordered' | 'received' | null = null;
  if (newStatus === 'sent') reqStatus = 'ordered';
  else if (newStatus === 'received' || newStatus === 'partially-received') reqStatus = 'received';
  if (!reqStatus) return;

  const q = query(
    collection(db, REQUIREMENTS_COLLECTION),
    where('poId', '==', poId),
  );
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  for (const reqDoc of snap.docs) {
    const current = reqDoc.data() as ProcurementRequirement;
    // Only advance status forward
    if (
      (reqStatus === 'ordered' && current.status === 'added-to-po') ||
      (reqStatus === 'received' && ['added-to-po', 'ordered'].includes(current.status))
    ) {
      batch.update(reqDoc.ref, {
        status: reqStatus,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}
