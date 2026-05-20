/**
 * PO-to-COGS Tracking Service
 * Links PO actual costs back through manufacturing orders to calculate
 * accurate Cost of Goods Sold for completed production.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { PurchaseOrder } from '../types/purchaseOrder';
import type { ManufacturingOrder } from '@/modules/manufacturing/types';

const PURCHASE_ORDERS_COLLECTION = 'purchaseOrders';
const MO_COLLECTION = 'manufacturingOrders';

// ============================================================================
// TYPES
// ============================================================================

export interface MOCostRollup {
  moId: string;
  moNumber: string;
  designItemName: string;
  projectCode: string;

  // Estimated costs (from BOM at creation)
  estimatedMaterialCost: number;
  estimatedLaborCost: number;
  estimatedTotalCost: number;

  // Actual costs (from POs + material consumptions)
  actualMaterialCost: number;
  actualLandedCost: number;
  actualLaborCost: number;
  actualTotalCost: number;

  // Variance
  costVariance: number;
  variancePercent: number;

  // PO breakdown
  linkedPOs: Array<{
    poId: string;
    poNumber: string;
    supplierName: string;
    subtotal: number;
    landedCost: number;
    grandTotal: number;
    status: string;
    receivedPercent: number;
  }>;

  currency: string;
}

// ============================================================================
// COST ROLLUP
// ============================================================================

/**
 * Calculate actual COGS for a manufacturing order by rolling up
 * PO actual costs + material consumption costs.
 */
export async function calculateMOCostRollup(moId: string): Promise<MOCostRollup> {
  // Fetch MO
  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);
  if (!moSnap.exists()) throw new Error('Manufacturing order not found');
  const mo = { id: moSnap.id, ...moSnap.data() } as ManufacturingOrder;

  // Fetch linked POs
  const linkedPOIds = mo.linkedPOIds ?? [];
  const linkedPOs: Array<MOCostRollup['linkedPOs'][0]> = [];
  let actualMaterialCostFromPOs = 0;
  let actualLandedCost = 0;

  for (const poId of linkedPOIds) {
    const poRef = doc(db, PURCHASE_ORDERS_COLLECTION, poId);
    const poSnap = await getDoc(poRef);
    if (!poSnap.exists()) continue;

    const po = { id: poSnap.id, ...poSnap.data() } as PurchaseOrder;
    const totalReceived = po.lineItems.reduce((sum, li) => sum + li.quantityReceived, 0);
    const totalOrdered = po.lineItems.reduce((sum, li) => sum + li.quantity, 0);
    const receivedPercent = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;

    linkedPOs.push({
      poId: po.id,
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      subtotal: po.totals.subtotal,
      landedCost: po.totals.landedCostTotal,
      grandTotal: po.totals.grandTotal,
      status: po.status,
      receivedPercent,
    });

    // Only count received amounts as actual cost
    if (['received', 'closed', 'partially-received'].includes(po.status)) {
      actualMaterialCostFromPOs += po.totals.subtotal * (receivedPercent / 100);
      actualLandedCost += po.totals.landedCostTotal * (receivedPercent / 100);
    }
  }

  // Add material consumption costs (in-house materials used)
  const consumptionCost = (mo.materialConsumptions ?? []).reduce(
    (sum, c) => sum + c.totalCost,
    0,
  );

  const actualMaterialCost = actualMaterialCostFromPOs + consumptionCost;
  const actualLaborCost = mo.costSummary.laborCost; // Labor stays from estimate
  const actualTotalCost = actualMaterialCost + actualLandedCost + actualLaborCost;

  const estimatedTotalCost = mo.costSummary.totalCost;
  const costVariance = actualTotalCost - estimatedTotalCost;
  const variancePercent = estimatedTotalCost > 0
    ? (costVariance / estimatedTotalCost) * 100
    : 0;

  return {
    moId: mo.id,
    moNumber: mo.moNumber,
    designItemName: mo.designItemName ?? '',
    projectCode: mo.projectCode ?? '',
    estimatedMaterialCost: mo.costSummary.materialCost,
    estimatedLaborCost: mo.costSummary.laborCost,
    estimatedTotalCost,
    actualMaterialCost: Math.round(actualMaterialCost * 100) / 100,
    actualLandedCost: Math.round(actualLandedCost * 100) / 100,
    actualLaborCost,
    actualTotalCost: Math.round(actualTotalCost * 100) / 100,
    costVariance: Math.round(costVariance * 100) / 100,
    variancePercent: Math.round(variancePercent * 100) / 100,
    linkedPOs,
    currency: mo.costSummary.currency,
  };
}

/**
 * Update MO cost summary with actual PO costs.
 * Called when POs are fully received and closed.
 */
export async function syncActualCostsToMO(
  moId: string,
  userId: string,
): Promise<MOCostRollup> {
  const rollup = await calculateMOCostRollup(moId);

  const moRef = doc(db, MO_COLLECTION, moId);
  await updateDoc(moRef, {
    'costSummary.actualMaterialCost': rollup.actualMaterialCost,
    'costSummary.actualLandedCost': rollup.actualLandedCost,
    'costSummary.actualTotalCost': rollup.actualTotalCost,
    'costSummary.costVariance': rollup.costVariance,
    'costSummary.variancePercent': rollup.variancePercent,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });

  return rollup;
}

/**
 * Get cost rollups for all MOs in a project.
 * Useful for project-level COGS reporting.
 */
export async function getProjectCostRollup(
  projectId: string,
): Promise<{
  projectId: string;
  moRollups: MOCostRollup[];
  totalEstimated: number;
  totalActual: number;
  totalVariance: number;
  currency: string;
}> {
  const moQuery = query(
    collection(db, MO_COLLECTION),
    where('projectId', '==', projectId),
  );
  const moSnap = await getDocs(moQuery);

  const moRollups: MOCostRollup[] = [];
  for (const moDoc of moSnap.docs) {
    const rollup = await calculateMOCostRollup(moDoc.id);
    moRollups.push(rollup);
  }

  const totalEstimated = moRollups.reduce((s, r) => s + r.estimatedTotalCost, 0);
  const totalActual = moRollups.reduce((s, r) => s + r.actualTotalCost, 0);

  return {
    projectId,
    moRollups,
    totalEstimated: Math.round(totalEstimated * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    totalVariance: Math.round((totalActual - totalEstimated) * 100) / 100,
    currency: moRollups[0]?.currency ?? 'UGX',
  };
}
