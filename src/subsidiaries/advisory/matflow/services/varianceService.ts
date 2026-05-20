/**
 * Variance Service
 * Calculate and manage planned vs actual variance data
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type {
  MaterialVariance,
  StageVariance,
  ProjectVarianceSummary,
  VarianceStatus,
  VarianceAlert,
  VarianceTrend,
  CostTrend,
  VarianceFilters,
  VarianceThresholds,
  MaterialInfo,
} from '../types/variance';
import { DEFAULT_THRESHOLDS } from '../types/variance';
import type { ProcurementEntry } from '../types/procurement';

// Default organization
const DEFAULT_ORG_ID = 'default';

// Collection paths
const getProjectPath = (orgId: string, projectId: string) =>
  `organizations/${orgId}/advisory_projects/${projectId}`;

const getBOQCollection = (orgId: string, projectId: string) =>
  collection(db, getProjectPath(orgId, projectId), 'boq_items');

const getProcurementCollection = (orgId: string, projectId: string) =>
  collection(db, getProjectPath(orgId, projectId), 'procurement_entries');

const getVarianceCacheDoc = (orgId: string, projectId: string) =>
  doc(db, getProjectPath(orgId, projectId), 'cache', 'variance_summary');

// ============================================================================
// MATERIAL VARIANCE CALCULATION
// ============================================================================

interface BOQItemData {
  id: string;
  materialId: string;
  materialName: string;
  unit: string;
  quantity: number;
  unitRate: number;
  totalCost: number;
  stageId?: string;
  category?: string;
}

interface ProcurementSummary {
  materialId: string;
  totalReceived: number;
  totalAccepted: number;
  totalRejected: number;
  totalCost: number;
  pendingQuantity: number;
  averageUnitPrice: number;
}

export function calculateMaterialVariance(
  boqItems: BOQItemData[],
  procurementSummary: ProcurementSummary | null,
  thresholds: VarianceThresholds = DEFAULT_THRESHOLDS
): MaterialVariance {
  // Aggregate BOQ quantities
  const planned = boqItems.reduce(
    (acc, item) => ({
      quantity: acc.quantity + item.quantity,
      totalCost: acc.totalCost + item.totalCost,
    }),
    { quantity: 0, totalCost: 0 }
  );
  
  const avgUnitCost = planned.quantity > 0 
    ? planned.totalCost / planned.quantity 
    : 0;
  
  const unit = boqItems[0]?.unit || '';
  const materialInfo: MaterialInfo = {
    id: boqItems[0]?.materialId || '',
    name: boqItems[0]?.materialName || 'Unknown Material',
    category: boqItems[0]?.category,
  };

  // Default actual values
  const actual = procurementSummary
    ? {
        quantityOrdered: procurementSummary.totalReceived,
        quantityAccepted: procurementSummary.totalAccepted,
        quantityRejected: procurementSummary.totalRejected,
        averageUnitCost: procurementSummary.averageUnitPrice,
        totalCost: procurementSummary.totalCost,
        pendingQuantity: procurementSummary.pendingQuantity,
      }
    : {
        quantityOrdered: 0,
        quantityAccepted: 0,
        quantityRejected: 0,
        averageUnitCost: 0,
        totalCost: 0,
        pendingQuantity: 0,
      };

  // Calculate variances
  const quantityDelta = actual.quantityAccepted - planned.quantity;
  const quantityPercent = planned.quantity > 0
    ? ((actual.quantityAccepted / planned.quantity) - 1) * 100
    : 0;
  const costDelta = actual.totalCost - planned.totalCost;
  const costPercent = planned.totalCost > 0
    ? ((actual.totalCost / planned.totalCost) - 1) * 100
    : 0;
  const fulfillmentPercent = planned.quantity > 0
    ? (actual.quantityAccepted / planned.quantity) * 100
    : 0;

  // Determine status and alerts
  const alerts: VarianceAlert[] = [];
  let status: VarianceStatus = 'on-track';

  // Check quantity variance
  if (quantityPercent > thresholds.quantityOverrunPercent) {
    status = 'over-procured';
    alerts.push({
      id: `qty-over-${materialInfo.id}`,
      type: 'quantity-overrun',
      severity: quantityPercent > thresholds.quantityOverrunPercent * 2 ? 'critical' : 'warning',
      message: `Quantity ${quantityPercent.toFixed(1)}% over planned`,
      threshold: thresholds.quantityOverrunPercent,
      actualValue: quantityPercent,
      createdAt: new Date(),
    });
  } else if (fulfillmentPercent < (100 - thresholds.quantityShortagePercent)) {
    status = 'under-procured';
    if (fulfillmentPercent < 50) {
      alerts.push({
        id: `qty-short-${materialInfo.id}`,
        type: 'quantity-shortage',
        severity: 'warning',
        message: `Only ${fulfillmentPercent.toFixed(1)}% of planned quantity procured`,
        threshold: 100 - thresholds.quantityShortagePercent,
        actualValue: fulfillmentPercent,
        createdAt: new Date(),
      });
    }
  }

  // Check cost variance
  if (costPercent > thresholds.costOverrunPercent) {
    status = status === 'on-track' ? 'cost-overrun' : 'at-risk';
    alerts.push({
      id: `cost-over-${materialInfo.id}`,
      type: 'cost-overrun',
      severity: costPercent > thresholds.costOverrunPercent * 2 ? 'critical' : 'warning',
      message: `Cost ${costPercent.toFixed(1)}% over budget`,
      threshold: thresholds.costOverrunPercent,
      actualValue: costPercent,
      createdAt: new Date(),
    });
  } else if (costPercent < -thresholds.costSavingsPercent) {
    if (status === 'on-track') {
      status = 'cost-savings';
    }
  }

  // Check rejection rate
  const totalReceived = actual.quantityAccepted + actual.quantityRejected;
  const rejectionRate = totalReceived > 0
    ? (actual.quantityRejected / totalReceived) * 100
    : 0;
  
  if (rejectionRate > thresholds.rejectionRatePercent) {
    alerts.push({
      id: `reject-${materialInfo.id}`,
      type: 'high-rejection-rate',
      severity: rejectionRate > thresholds.rejectionRatePercent * 2 ? 'critical' : 'warning',
      message: `${rejectionRate.toFixed(1)}% rejection rate`,
      threshold: thresholds.rejectionRatePercent,
      actualValue: rejectionRate,
      createdAt: new Date(),
    });
  }

  // Check unit price spike
  if (avgUnitCost > 0 && actual.averageUnitCost > 0) {
    const priceVariance = ((actual.averageUnitCost / avgUnitCost) - 1) * 100;
    if (priceVariance > thresholds.unitPriceSpikePercent) {
      alerts.push({
        id: `price-${materialInfo.id}`,
        type: 'unit-price-spike',
        severity: priceVariance > thresholds.unitPriceSpikePercent * 2 ? 'critical' : 'warning',
        message: `Unit price ${priceVariance.toFixed(1)}% higher than planned`,
        threshold: thresholds.unitPriceSpikePercent,
        actualValue: priceVariance,
        createdAt: new Date(),
      });
    }
  }

  return {
    materialId: materialInfo.id,
    materialInfo,
    planned: {
      quantity: planned.quantity,
      unitCost: avgUnitCost,
      totalCost: planned.totalCost,
      unit,
    },
    actual,
    variance: {
      quantityDelta,
      quantityPercent,
      costDelta,
      costPercent,
      fulfillmentPercent,
    },
    status,
    alerts,
  };
}

// ============================================================================
// PROJECT VARIANCE CALCULATION
// ============================================================================

export async function calculateProjectVariance(
  projectId: string,
  thresholds: VarianceThresholds = DEFAULT_THRESHOLDS,
  orgId: string = DEFAULT_ORG_ID
): Promise<ProjectVarianceSummary> {
  // Fetch BOQ items
  const boqSnapshot = await getDocs(getBOQCollection(orgId, projectId));
  const boqItems: BOQItemData[] = boqSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as BOQItemData));

  // Group BOQ items by material
  const boqByMaterial = new Map<string, BOQItemData[]>();
  for (const item of boqItems) {
    const key = item.materialId || item.materialName;
    if (!boqByMaterial.has(key)) {
      boqByMaterial.set(key, []);
    }
    boqByMaterial.get(key)!.push(item);
  }

  // Fetch procurement entries
  const procurementSnapshot = await getDocs(
    query(
      getProcurementCollection(orgId, projectId),
      where('status', 'in', ['confirmed', 'pending'])
    )
  );

  // Aggregate procurement by material
  const procurementByMaterial = new Map<string, ProcurementSummary>();
  for (const doc of procurementSnapshot.docs) {
    const entry = doc.data() as ProcurementEntry;
    const key = entry.materialId || entry.materialName;
    
    const existing = procurementByMaterial.get(key) || {
      materialId: key,
      totalReceived: 0,
      totalAccepted: 0,
      totalRejected: 0,
      totalCost: 0,
      pendingQuantity: 0,
      averageUnitPrice: 0,
    };
    
    existing.totalReceived += entry.quantityReceived;
    existing.totalAccepted += entry.quantityAccepted;
    existing.totalRejected += entry.quantityRejected || 0;
    existing.totalCost += entry.totalAmount;
    if (entry.status === 'pending') {
      existing.pendingQuantity += entry.quantityReceived;
    }
    
    procurementByMaterial.set(key, existing);
  }

  // Calculate average unit price for each material
  for (const [, summary] of procurementByMaterial) {
    if (summary.totalAccepted > 0) {
      summary.averageUnitPrice = summary.totalCost / summary.totalAccepted;
    }
  }

  // Calculate variance for each material
  const allMaterialVariances: MaterialVariance[] = [];
  for (const [materialId, items] of boqByMaterial) {
    const summary = procurementByMaterial.get(materialId) || null;
    const variance = calculateMaterialVariance(items, summary, thresholds);
    allMaterialVariances.push(variance);
  }

  // Group by stage
  const stageMap = new Map<string, { items: BOQItemData[]; name: string; order: number }>();
  for (const item of boqItems) {
    const stageId = item.stageId || 'unassigned';
    if (!stageMap.has(stageId)) {
      stageMap.set(stageId, { items: [], name: stageId, order: 0 });
    }
    stageMap.get(stageId)!.items.push(item);
  }

  // Calculate stage variances
  const stageVariances: StageVariance[] = [];
  let stageOrder = 0;
  for (const [stageId, stageData] of stageMap) {
    const stageMaterialIds = new Set(stageData.items.map(i => i.materialId || i.materialName));
    const stageMaterials = allMaterialVariances.filter(m => stageMaterialIds.has(m.materialId));
    
    const totalPlannedCost = stageMaterials.reduce((sum, m) => sum + m.planned.totalCost, 0);
    const totalActualCost = stageMaterials.reduce((sum, m) => sum + m.actual.totalCost, 0);
    const costVariancePercent = totalPlannedCost > 0
      ? ((totalActualCost / totalPlannedCost) - 1) * 100
      : 0;
    
    let fullyProcured = 0, partiallyProcured = 0, notStarted = 0, overProcured = 0;
    for (const m of stageMaterials) {
      const f = m.variance.fulfillmentPercent;
      if (f >= 100) {
        if (f > 105) overProcured++;
        else fullyProcured++;
      } else if (f > 0) {
        partiallyProcured++;
      } else {
        notStarted++;
      }
    }
    
    const fulfillmentPercent = stageMaterials.length > 0
      ? stageMaterials.reduce((sum, m) => sum + m.variance.fulfillmentPercent, 0) / stageMaterials.length
      : 0;
    
    let status: VarianceStatus = 'on-track';
    if (costVariancePercent > 10) status = 'cost-overrun';
    else if (fulfillmentPercent < 50) status = 'under-procured';
    else if (overProcured > stageMaterials.length * 0.2) status = 'over-procured';
    else if (costVariancePercent < -10) status = 'cost-savings';
    
    stageVariances.push({
      stageId,
      stageName: stageData.name,
      stageOrder: stageOrder++,
      totalPlannedCost,
      totalActualCost,
      costVariancePercent,
      materialsCount: stageMaterials.length,
      fullyProcured,
      partiallyProcured,
      notStarted,
      overProcured,
      fulfillmentPercent,
      status,
      materials: stageMaterials,
    });
  }

  // Aggregate project-level metrics
  let totalPlannedCost = 0;
  let totalActualCost = 0;
  let totalCommittedCost = 0;
  let totalAccepted = 0;
  let totalRejected = 0;
  let fullyProcured = 0, partiallyProcured = 0, notStarted = 0, overProcured = 0;
  const allAlerts: VarianceAlert[] = [];

  for (const variance of allMaterialVariances) {
    totalPlannedCost += variance.planned.totalCost;
    totalActualCost += variance.actual.totalCost;
    totalCommittedCost += variance.actual.totalCost + 
      (variance.actual.pendingQuantity * variance.actual.averageUnitCost);
    totalAccepted += variance.actual.quantityAccepted;
    totalRejected += variance.actual.quantityRejected;
    allAlerts.push(...variance.alerts);
    
    const f = variance.variance.fulfillmentPercent;
    if (f >= 100) {
      if (f > 105) overProcured++;
      else fullyProcured++;
    } else if (f > 0) {
      partiallyProcured++;
    } else {
      notStarted++;
    }
  }

  const costVariance = totalActualCost - totalPlannedCost;
  const costVariancePercent = totalPlannedCost > 0
    ? ((totalActualCost / totalPlannedCost) - 1) * 100
    : 0;
  
  const overallFulfillmentPercent = allMaterialVariances.length > 0
    ? allMaterialVariances.reduce((sum, m) => sum + m.variance.fulfillmentPercent, 0) / allMaterialVariances.length
    : 0;
  
  const overallAcceptanceRate = (totalAccepted + totalRejected) > 0
    ? (totalAccepted / (totalAccepted + totalRejected)) * 100
    : 100;

  // Top cost overruns
  const topCostOverruns = [...allMaterialVariances]
    .filter(v => v.variance.costDelta > 0)
    .sort((a, b) => b.variance.costDelta - a.variance.costDelta)
    .slice(0, 5);

  // Top shortages
  const topShortages = [...allMaterialVariances]
    .filter(v => v.variance.fulfillmentPercent < 80)
    .sort((a, b) => a.variance.fulfillmentPercent - b.variance.fulfillmentPercent)
    .slice(0, 5);

  // Recent alerts
  const recentAlerts = allAlerts
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  return {
    projectId,
    calculatedAt: new Date(),
    totalPlannedCost,
    totalActualCost,
    totalCommittedCost,
    costVariance,
    costVariancePercent,
    totalMaterialsPlanned: allMaterialVariances.length,
    materialsFullyProcured: fullyProcured,
    materialsPartiallyProcured: partiallyProcured,
    materialsNotStarted: notStarted,
    materialsOverProcured: overProcured,
    overallFulfillmentPercent,
    totalAccepted,
    totalRejected,
    overallAcceptanceRate,
    stages: stageVariances,
    topCostOverruns,
    topShortages,
    recentAlerts,
  };
}

// ============================================================================
// TRENDS
// ============================================================================

export async function getVarianceTrends(
  projectId: string,
  days: number = 30,
  orgId: string = DEFAULT_ORG_ID
): Promise<{ quantity: VarianceTrend[]; cost: CostTrend[] }> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get total planned from BOQ
  const boqSnapshot = await getDocs(getBOQCollection(orgId, projectId));
  let totalPlannedQuantity = 0;
  let totalPlannedCost = 0;
  
  for (const doc of boqSnapshot.docs) {
    const item = doc.data();
    totalPlannedQuantity += item.quantity || 0;
    totalPlannedCost += item.totalCost || 0;
  }

  // Get procurement entries for trend
  const procurementSnapshot = await getDocs(
    query(
      getProcurementCollection(orgId, projectId),
      where('status', '==', 'confirmed'),
      orderBy('deliveryDate', 'asc')
    )
  );

  // Build daily cumulative data
  const dailyData = new Map<string, { quantity: number; cost: number }>();
  let cumulativeQuantity = 0;
  let cumulativeCost = 0;

  for (const doc of procurementSnapshot.docs) {
    const entry = doc.data();
    const date = (entry.deliveryDate as Timestamp).toDate();
    const dateKey = date.toISOString().split('T')[0];
    
    cumulativeQuantity += entry.quantityAccepted || 0;
    cumulativeCost += entry.totalAmount || 0;
    
    dailyData.set(dateKey, {
      quantity: cumulativeQuantity,
      cost: cumulativeCost,
    });
  }

  // Build trend arrays
  const quantityTrends: VarianceTrend[] = [];
  const costTrends: CostTrend[] = [];
  
  let lastQuantity = 0;
  let lastCost = 0;

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    
    const data = dailyData.get(dateKey);
    if (data) {
      lastQuantity = data.quantity;
      lastCost = data.cost;
    }
    
    const expectedQuantityByDate = (totalPlannedQuantity * (i + 1)) / days;
    const expectedCostByDate = (totalPlannedCost * (i + 1)) / days;
    
    quantityTrends.push({
      date,
      plannedCumulative: expectedQuantityByDate,
      actualCumulative: lastQuantity,
      variancePercent: expectedQuantityByDate > 0
        ? ((lastQuantity / expectedQuantityByDate) - 1) * 100
        : 0,
    });
    
    costTrends.push({
      date,
      budgetedCumulative: expectedCostByDate,
      actualCumulative: lastCost,
      committedCumulative: lastCost,
      variancePercent: expectedCostByDate > 0
        ? ((lastCost / expectedCostByDate) - 1) * 100
        : 0,
    });
  }

  return { quantity: quantityTrends, cost: costTrends };
}

// ============================================================================
// CACHING
// ============================================================================

export async function cacheVarianceSummary(
  projectId: string,
  summary: ProjectVarianceSummary,
  orgId: string = DEFAULT_ORG_ID
): Promise<void> {
  try {
    await setDoc(getVarianceCacheDoc(orgId, projectId), {
      ...summary,
      calculatedAt: Timestamp.fromDate(summary.calculatedAt),
      cachedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Failed to cache variance summary:', error);
  }
}

export async function getCachedVarianceSummary(
  projectId: string,
  maxAgeMinutes: number = 15,
  orgId: string = DEFAULT_ORG_ID
): Promise<ProjectVarianceSummary | null> {
  try {
    const snapshot = await getDoc(getVarianceCacheDoc(orgId, projectId));
    
    if (!snapshot.exists()) return null;
    
    const data = snapshot.data();
    const cachedAt = (data.cachedAt as Timestamp).toDate();
    const ageMinutes = (Date.now() - cachedAt.getTime()) / (1000 * 60);
    
    if (ageMinutes > maxAgeMinutes) return null;
    
    return {
      ...data,
      calculatedAt: (data.calculatedAt as Timestamp).toDate(),
    } as ProjectVarianceSummary;
  } catch {
    return null;
  }
}

// ============================================================================
// FILTERS
// ============================================================================

export function filterMaterialVariances(
  variances: MaterialVariance[],
  filters: VarianceFilters
): MaterialVariance[] {
  return variances.filter(v => {
    if (filters.materialIds?.length && !filters.materialIds.includes(v.materialId)) {
      return false;
    }
    if (filters.status?.length && !filters.status.includes(v.status)) {
      return false;
    }
    if (filters.minVariancePercent !== undefined && 
        v.variance.costPercent < filters.minVariancePercent) {
      return false;
    }
    if (filters.maxVariancePercent !== undefined && 
        v.variance.costPercent > filters.maxVariancePercent) {
      return false;
    }
    if (filters.showOnlyAlerts && v.alerts.length === 0) {
      return false;
    }
    return true;
  });
}
