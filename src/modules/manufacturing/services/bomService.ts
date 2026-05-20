/**
 * BOM (Bill of Materials) Service
 * Manages BOM lines as a subcollection of manufacturing orders
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc as _rawUpdateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  writeBatch,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { cleanForFirestore } from './manufacturingOrderService';
import type {
  BOMLine,
  BOMCostSummary,
  BOMLineAvailability,
  BOMAvailabilityReport,
} from '../types';

const MO_COLLECTION = 'manufacturingOrders';

/** Safe updateDoc wrapper — deep-cleans data to strip undefined before writing */
async function updateDoc(ref: DocumentReference, data: Record<string, unknown>) {
  return _rawUpdateDoc(ref, cleanForFirestore(data));
}
const BOM_SUBCOLLECTION = 'bom';

// ============================================
// CRUD
// ============================================

/**
 * Get all BOM lines for an order, ordered by line number
 */
async function getBOM(orderId: string): Promise<BOMLine[]> {
  const snap = await getDocs(
    query(
      collection(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION),
      orderBy('lineNumber', 'asc'),
    ),
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as BOMLine);
}

/**
 * Add a BOM line to an order
 */
async function addBOMLine(
  orderId: string,
  line: Omit<BOMLine, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const now = serverTimestamp();
  const raw = {
    ...line,
    orderId,
    reservedQuantity: line.reservedQuantity ?? 0,
    consumedQuantity: line.consumedQuantity ?? 0,
    wasteQuantity: line.wasteQuantity ?? 0,
    totalEstimatedCost: line.requiredQuantity * line.unitCost,
    totalActualCost: line.totalActualCost ?? 0,
    procurementStatus: line.procurementStatus ?? 'pending',
    fromOptimization: line.fromOptimization ?? false,
    createdAt: now,
    updatedAt: now,
  };

  // Strip undefined values — Firestore rejects them
  const data = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  );

  const ref = await addDoc(
    collection(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION),
    data,
  );

  // Update MO BOM summary
  await updateMOBOMSummary(orderId);

  return ref.id;
}

/**
 * Update a BOM line
 */
async function updateBOMLine(
  orderId: string,
  lineId: string,
  updates: Partial<BOMLine>,
): Promise<void> {
  const lineRef = doc(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION, lineId);

  // Handle priority override: preserve upstream value and set source
  if (updates.purchasePriority !== undefined) {
    const snap = await getDocs(
      query(collection(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION)),
    );
    const existing = snap.docs.find(d => d.id === lineId);
    if (existing) {
      const current = existing.data() as BOMLine;
      if (current.upstreamPurchasePriority == null && current.purchasePriority != null) {
        updates.upstreamPurchasePriority = current.purchasePriority;
      }
      updates.prioritySource = 'manufacturing';
    }
  }

  // Recalculate estimated cost if quantity or unit cost changed
  const recalcFields: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
  if (updates.requiredQuantity !== undefined || updates.unitCost !== undefined) {
    const snap = await getDocs(
      query(collection(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION)),
    );
    const existing = snap.docs.find(d => d.id === lineId);
    if (existing) {
      const current = existing.data() as BOMLine;
      const qty = updates.requiredQuantity ?? current.requiredQuantity;
      const cost = updates.unitCost ?? current.unitCost;
      recalcFields.totalEstimatedCost = qty * cost;
    }
  }

  await updateDoc(lineRef, recalcFields);
  await updateMOBOMSummary(orderId);
}

/**
 * Remove a BOM line
 */
async function removeBOMLine(orderId: string, lineId: string): Promise<void> {
  await deleteDoc(doc(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION, lineId));
  await updateMOBOMSummary(orderId);
}

// ============================================
// Material Availability
// ============================================

/**
 * Check material availability for all BOM lines
 */
async function checkMaterialAvailability(
  orderId: string,
): Promise<BOMAvailabilityReport> {
  const bomLines = await getBOM(orderId);
  const lines: BOMLineAvailability[] = [];
  let totalShortageValue = 0;

  for (const line of bomLines) {
    if (line.category === 'labor') {
      lines.push({
        bomLineId: line.id,
        materialName: line.materialName,
        requiredQuantity: line.requiredQuantity,
        availableQuantity: line.requiredQuantity,
        shortageQuantity: 0,
        status: 'in_stock',
      });
      continue;
    }

    let availableQty = 0;

    if (line.inventoryItemId) {
      try {
        const { getDocs: getStockDocs } = await import('firebase/firestore');
        const stockSnap = await getStockDocs(
          query(
            collection(db, 'stockLevels'),
            orderBy('currentQuantity', 'desc'),
          ),
        );
        // Find stock for this inventory item
        for (const stockDoc of stockSnap.docs) {
          const stockData = stockDoc.data();
          if (stockData.inventoryItemId === line.inventoryItemId) {
            availableQty += stockData.currentQuantity ?? 0;
          }
        }
      } catch {
        // If stock query fails, treat as unavailable
        availableQty = 0;
      }
    }

    const shortage = Math.max(0, line.requiredQuantity - availableQty);
    let status: BOMLineAvailability['status'] = 'in_stock';
    if (availableQty === 0) status = 'out_of_stock';
    else if (availableQty < line.requiredQuantity) status = 'partial';

    if (shortage > 0) {
      totalShortageValue += shortage * line.unitCost;
    }

    lines.push({
      bomLineId: line.id,
      materialName: line.materialName,
      requiredQuantity: line.requiredQuantity,
      availableQuantity: availableQty,
      shortageQuantity: shortage,
      status,
    });
  }

  const hasShortages = lines.some(l => l.shortageQuantity > 0);
  const allAvailable = lines.every(l => l.status === 'in_stock');

  return {
    orderId,
    checkedAt: serverTimestamp() as never,
    overallStatus: allAvailable ? 'all_available' : hasShortages ? 'shortages' : 'partial',
    lines,
    totalShortageValue,
  };
}

/**
 * Reserve materials from inventory for BOM lines
 */
async function reserveMaterials(orderId: string): Promise<void> {
  const bomLines = await getBOM(orderId);
  const batch = writeBatch(db);
  const now = serverTimestamp();

  for (const line of bomLines) {
    if (line.category === 'labor' || !line.inventoryItemId) continue;

    const lineRef = doc(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION, line.id);
    batch.update(lineRef, {
      reservedQuantity: line.requiredQuantity,
      procurementStatus: 'reserved',
      updatedAt: now,
    });
  }

  await batch.commit();
}

/**
 * Release all material reservations (on MO cancellation)
 */
async function releaseMaterials(orderId: string): Promise<void> {
  const bomLines = await getBOM(orderId);
  const batch = writeBatch(db);
  const now = serverTimestamp();

  for (const line of bomLines) {
    if (line.reservedQuantity > 0) {
      const lineRef = doc(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION, line.id);
      batch.update(lineRef, {
        reservedQuantity: 0,
        procurementStatus: 'pending',
        updatedAt: now,
      });
    }
  }

  await batch.commit();
}

/**
 * Record material consumption for a BOM line
 */
async function recordConsumption(
  orderId: string,
  bomLineId: string,
  quantity: number,
  wasteQuantity?: number,
  _wasteReason?: string,
): Promise<void> {
  const lineRef = doc(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION, bomLineId);
  const snap = await getDocs(
    query(collection(db, MO_COLLECTION, orderId, BOM_SUBCOLLECTION)),
  );
  const lineDoc = snap.docs.find(d => d.id === bomLineId);
  if (!lineDoc) throw new Error('BOM line not found');

  const line = lineDoc.data() as BOMLine;
  const newConsumed = (line.consumedQuantity ?? 0) + quantity;
  const newWaste = (line.wasteQuantity ?? 0) + (wasteQuantity ?? 0);
  const actualCost = newConsumed * line.unitCost;

  await updateDoc(lineRef, {
    consumedQuantity: newConsumed,
    wasteQuantity: newWaste,
    totalActualCost: actualCost,
    updatedAt: serverTimestamp(),
  });

  await updateMOBOMSummary(orderId);
}

/**
 * Get BOM cost summary for an order
 */
async function getBOMCostSummary(orderId: string): Promise<BOMCostSummary> {
  const bomLines = await getBOM(orderId);

  let totalEstimatedMaterialCost = 0;
  let totalActualMaterialCost = 0;
  let totalEstimatedLaborCost = 0;
  let totalActualLaborCost = 0;
  let totalScrapCost = 0;

  for (const line of bomLines) {
    if (line.category === 'labor') {
      totalEstimatedLaborCost += line.totalEstimatedCost;
      totalActualLaborCost += line.totalActualCost;
    } else {
      totalEstimatedMaterialCost += line.totalEstimatedCost;
      totalActualMaterialCost += line.totalActualCost;
      totalScrapCost += (line.wasteQuantity ?? 0) * line.unitCost;
    }
  }

  return {
    totalEstimatedMaterialCost,
    totalActualMaterialCost,
    totalEstimatedLaborCost,
    totalActualLaborCost,
    totalScrapCost,
    currency: 'UGX',
    lineCount: bomLines.length,
  };
}

// ============================================
// Internal Helpers
// ============================================

/**
 * Update MO-level BOM summary fields
 */
async function updateMOBOMSummary(orderId: string): Promise<void> {
  const bomLines = await getBOM(orderId);
  const totalMaterialCost = bomLines
    .filter(l => l.category !== 'labor')
    .reduce((sum, l) => sum + l.totalEstimatedCost, 0);

  await updateDoc(doc(db, MO_COLLECTION, orderId), {
    bomLineCount: bomLines.length,
    bomTotalMaterialCost: totalMaterialCost,
    estimatedMaterialCost: totalMaterialCost,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Exports
// ============================================

export const bomService = {
  getBOM,
  addBOMLine,
  updateBOMLine,
  removeBOMLine,
  checkMaterialAvailability,
  reserveMaterials,
  releaseMaterials,
  recordConsumption,
  getBOMCostSummary,
};
