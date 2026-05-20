/**
 * Cost Variance Service
 *
 * Tracks and analyzes cost variances between estimated and actual costs
 * throughout the manufacturing order lifecycle:
 * - Material cost variance (BOM estimate vs actual consumption)
 * - Labor cost tracking and variance
 * - Overhead allocation
 * - Variance alerts and reporting
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
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ManufacturingOrder, MOStage } from '../types';

const MO_COLLECTION = 'manufacturingOrders';
const COST_VARIANCE_COLLECTION = 'manufacturingCostVariance';
const LABOR_ENTRIES_COLLECTION = 'laborTimeEntries';
const BUSINESS_EVENTS_COLLECTION = 'businessEvents';

// ============================================
// Types
// ============================================

export interface CostVarianceRecord {
  id: string;
  moId: string;
  moNumber: string;
  projectId: string;
  subsidiaryId: string;

  // Estimated costs (from BOM)
  estimatedMaterialCost: number;
  estimatedLaborCost: number;
  estimatedOverheadCost: number;
  estimatedTotalCost: number;

  // Actual costs (tracked during production)
  actualMaterialCost: number;
  actualLaborCost: number;
  actualOverheadCost: number;
  actualTotalCost: number;

  // Variances
  materialVariance: number;
  materialVariancePercent: number;
  laborVariance: number;
  laborVariancePercent: number;
  overheadVariance: number;
  totalVariance: number;
  totalVariancePercent: number;

  // Status
  varianceStatus: 'favorable' | 'unfavorable' | 'within-tolerance' | 'critical';
  tolerancePercent: number;

  // Breakdown by stage
  costByStage: Record<MOStage, StageCostBreakdown>;

  // Currency
  currency: string;

  // Metadata
  calculatedAt: Date;
  lastUpdatedAt: Date;
}

export interface StageCostBreakdown {
  stage: MOStage;
  materialCost: number;
  laborCost: number;
  laborHours: number;
  overheadCost: number;
  totalCost: number;
  startedAt?: Date;
  completedAt?: Date;
  durationHours?: number;
}

export interface LaborTimeEntry {
  id: string;
  moId: string;
  moNumber: string;
  stage: MOStage;
  workerId: string;
  workerName: string;
  laborType: 'direct' | 'indirect' | 'setup' | 'rework';
  startTime: Date;
  endTime?: Date;
  durationHours: number;
  hourlyRate: number;
  totalCost: number;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

export interface CostVarianceSummary {
  totalMOs: number;
  favorableCount: number;
  unfavorableCount: number;
  criticalCount: number;
  totalEstimatedCost: number;
  totalActualCost: number;
  totalVariance: number;
  averageVariancePercent: number;
  topOverruns: Array<{
    moId: string;
    moNumber: string;
    variance: number;
    variancePercent: number;
  }>;
  varianceByStage: Record<MOStage, {
    totalEstimated: number;
    totalActual: number;
    variance: number;
  }>;
}

// ============================================
// Cost Variance Calculation
// ============================================

/**
 * Calculate cost variance for a manufacturing order
 */
export async function calculateCostVariance(
  mo: ManufacturingOrder,
  tolerancePercent: number = 10,
): Promise<CostVarianceRecord> {
  // Get estimated costs from BOM
  const estimatedMaterialCost = mo.bom.reduce((sum, entry) => sum + entry.totalCost, 0);
  const estimatedLaborCost = mo.costSummary.laborCost;
  const estimatedOverheadCost = 0; // Default overhead, could be configurable
  const estimatedTotalCost = estimatedMaterialCost + estimatedLaborCost + estimatedOverheadCost;

  // Calculate actual material cost from consumptions
  let actualMaterialCost = 0;
  for (const consumption of mo.materialConsumptions) {
    const bomEntry = mo.bom.find(b => b.inventoryItemId === consumption.inventoryItemId);
    if (bomEntry) {
      // Use unit cost from BOM (could be enhanced to use actual cost at consumption time)
      actualMaterialCost += consumption.quantityConsumed * bomEntry.unitCost;
    }
  }

  // Get actual labor cost from time entries
  const laborEntries = await getLaborEntriesForMO(mo.id);
  const actualLaborCost = laborEntries.reduce((sum, entry) => sum + entry.totalCost, 0);

  // Actual overhead (could be calculated based on machine time, etc.)
  const actualOverheadCost = 0;

  const actualTotalCost = actualMaterialCost + actualLaborCost + actualOverheadCost;

  // Calculate variances
  const materialVariance = actualMaterialCost - estimatedMaterialCost;
  const materialVariancePercent = estimatedMaterialCost > 0
    ? (materialVariance / estimatedMaterialCost) * 100
    : 0;

  const laborVariance = actualLaborCost - estimatedLaborCost;
  const laborVariancePercent = estimatedLaborCost > 0
    ? (laborVariance / estimatedLaborCost) * 100
    : 0;

  const overheadVariance = actualOverheadCost - estimatedOverheadCost;

  const totalVariance = actualTotalCost - estimatedTotalCost;
  const totalVariancePercent = estimatedTotalCost > 0
    ? (totalVariance / estimatedTotalCost) * 100
    : 0;

  // Determine variance status
  let varianceStatus: CostVarianceRecord['varianceStatus'];
  if (totalVariancePercent < -tolerancePercent) {
    varianceStatus = 'favorable';
  } else if (totalVariancePercent > tolerancePercent * 2) {
    varianceStatus = 'critical';
  } else if (totalVariancePercent > tolerancePercent) {
    varianceStatus = 'unfavorable';
  } else {
    varianceStatus = 'within-tolerance';
  }

  // Calculate cost by stage
  const costByStage = calculateCostByStage(mo, laborEntries);

  return {
    id: '',
    moId: mo.id,
    moNumber: mo.moNumber,
    projectId: mo.projectId ?? '',
    subsidiaryId: mo.subsidiaryId,
    estimatedMaterialCost,
    estimatedLaborCost,
    estimatedOverheadCost,
    estimatedTotalCost,
    actualMaterialCost,
    actualLaborCost,
    actualOverheadCost,
    actualTotalCost,
    materialVariance,
    materialVariancePercent,
    laborVariance,
    laborVariancePercent,
    overheadVariance,
    totalVariance,
    totalVariancePercent,
    varianceStatus,
    tolerancePercent,
    costByStage,
    currency: mo.costSummary.currency,
    calculatedAt: new Date(),
    lastUpdatedAt: new Date(),
  };
}

/**
 * Calculate cost breakdown by manufacturing stage
 */
function calculateCostByStage(
  mo: ManufacturingOrder,
  laborEntries: LaborTimeEntry[],
): Record<MOStage, StageCostBreakdown> {
  const stages: MOStage[] = ['queued', 'cutting', 'assembly', 'finishing', 'qc', 'ready'];
  const result: Record<MOStage, StageCostBreakdown> = {} as Record<MOStage, StageCostBreakdown>;

  for (const stage of stages) {
    // Material cost for this stage
    const stageMaterialCost = mo.materialConsumptions
      .filter(c => c.moStage === stage)
      .reduce((sum, c) => {
        const bomEntry = mo.bom.find(b => b.inventoryItemId === c.inventoryItemId);
        return sum + (c.quantityConsumed * (bomEntry?.unitCost ?? 0));
      }, 0);

    // Labor cost for this stage
    const stageLabor = laborEntries.filter(e => e.stage === stage);
    const stageLaborCost = stageLabor.reduce((sum, e) => sum + e.totalCost, 0);
    const stageLaborHours = stageLabor.reduce((sum, e) => sum + e.durationHours, 0);

    // Get stage timing from history
    const stageTransitions = mo.stageHistory.filter(
      t => t.toStage === stage || t.fromStage === stage
    );

    const startTransition = stageTransitions.find(t => t.toStage === stage);
    const endTransition = stageTransitions.find(t => t.fromStage === stage);

    let durationHours: number | undefined;
    if (startTransition && endTransition) {
      const startTime = startTransition.transitionedAt as unknown as { toDate?: () => Date };
      const endTime = endTransition.transitionedAt as unknown as { toDate?: () => Date };
      if (startTime?.toDate && endTime?.toDate) {
        durationHours = (endTime.toDate().getTime() - startTime.toDate().getTime()) / (1000 * 60 * 60);
      }
    }

    result[stage] = {
      stage,
      materialCost: stageMaterialCost,
      laborCost: stageLaborCost,
      laborHours: stageLaborHours,
      overheadCost: 0,
      totalCost: stageMaterialCost + stageLaborCost,
      startedAt: startTransition?.transitionedAt as unknown as Date,
      completedAt: endTransition?.transitionedAt as unknown as Date,
      durationHours,
    };
  }

  return result;
}

// ============================================
// Labor Time Tracking
// ============================================

/**
 * Record a labor time entry for a manufacturing order
 */
export async function recordLaborEntry(
  moId: string,
  entry: Omit<LaborTimeEntry, 'id' | 'createdAt'>,
  userId: string,
): Promise<string> {
  const entryData = {
    ...entry,
    createdAt: serverTimestamp(),
    createdBy: userId,
  };

  const docRef = await addDoc(collection(db, LABOR_ENTRIES_COLLECTION), entryData);

  // Update MO labor cost
  await updateMOLaborCost(moId);

  return docRef.id;
}

/**
 * Get all labor entries for a manufacturing order
 */
export async function getLaborEntriesForMO(moId: string): Promise<LaborTimeEntry[]> {
  const q = query(
    collection(db, LABOR_ENTRIES_COLLECTION),
    where('moId', '==', moId),
    orderBy('startTime', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as LaborTimeEntry));
}

/**
 * Update MO's labor cost summary based on recorded entries
 */
async function updateMOLaborCost(moId: string): Promise<void> {
  const entries = await getLaborEntriesForMO(moId);
  const totalLaborCost = entries.reduce((sum, e) => sum + e.totalCost, 0);

  const moRef = doc(db, MO_COLLECTION, moId);
  const moSnap = await getDoc(moRef);

  if (!moSnap.exists()) return;

  const mo = moSnap.data() as ManufacturingOrder;
  const materialCost = mo.costSummary.materialCost;

  await updateDoc(moRef, {
    'costSummary.laborCost': totalLaborCost,
    'costSummary.totalCost': materialCost + totalLaborCost,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Variance Persistence & Reporting
// ============================================

/**
 * Save or update cost variance record
 */
export async function saveCostVarianceRecord(
  variance: CostVarianceRecord,
): Promise<string> {
  // Check if record exists
  const q = query(
    collection(db, COST_VARIANCE_COLLECTION),
    where('moId', '==', variance.moId),
  );
  const snap = await getDocs(q);

  const data = {
    ...variance,
    lastUpdatedAt: serverTimestamp(),
  };

  if (snap.empty) {
    // Create new
    data.calculatedAt = serverTimestamp() as unknown as Date;
    const docRef = await addDoc(collection(db, COST_VARIANCE_COLLECTION), data);
    return docRef.id;
  } else {
    // Update existing
    const existingId = snap.docs[0].id;
    await updateDoc(doc(db, COST_VARIANCE_COLLECTION, existingId), data);
    return existingId;
  }
}

/**
 * Get cost variance record for an MO
 */
export async function getCostVarianceForMO(
  moId: string,
): Promise<CostVarianceRecord | null> {
  const q = query(
    collection(db, COST_VARIANCE_COLLECTION),
    where('moId', '==', moId),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as CostVarianceRecord;
}

/**
 * Get variance summary across all MOs for a subsidiary
 */
export async function getCostVarianceSummary(
  subsidiaryId: string,
  dateRange?: { start: Date; end: Date },
): Promise<CostVarianceSummary> {
  let q = query(
    collection(db, COST_VARIANCE_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
  );

  const snap = await getDocs(q);
  const records = snap.docs.map(d => d.data() as CostVarianceRecord);

  // Filter by date range if provided
  const filtered = dateRange
    ? records.filter(r => {
        const calcDate = (r.calculatedAt as unknown as { toDate?: () => Date })?.toDate?.() ?? new Date(r.calculatedAt);
        return calcDate >= dateRange.start && calcDate <= dateRange.end;
      })
    : records;

  const favorableCount = filtered.filter(r => r.varianceStatus === 'favorable').length;
  const unfavorableCount = filtered.filter(r => r.varianceStatus === 'unfavorable').length;
  const criticalCount = filtered.filter(r => r.varianceStatus === 'critical').length;

  const totalEstimatedCost = filtered.reduce((sum, r) => sum + r.estimatedTotalCost, 0);
  const totalActualCost = filtered.reduce((sum, r) => sum + r.actualTotalCost, 0);
  const totalVariance = totalActualCost - totalEstimatedCost;

  const averageVariancePercent = filtered.length > 0
    ? filtered.reduce((sum, r) => sum + r.totalVariancePercent, 0) / filtered.length
    : 0;

  // Top overruns
  const topOverruns = [...filtered]
    .filter(r => r.totalVariance > 0)
    .sort((a, b) => b.totalVariance - a.totalVariance)
    .slice(0, 5)
    .map(r => ({
      moId: r.moId,
      moNumber: r.moNumber,
      variance: r.totalVariance,
      variancePercent: r.totalVariancePercent,
    }));

  // Variance by stage
  const stages: MOStage[] = ['queued', 'cutting', 'assembly', 'finishing', 'qc', 'ready'];
  const varianceByStage: Record<MOStage, { totalEstimated: number; totalActual: number; variance: number }> =
    {} as Record<MOStage, { totalEstimated: number; totalActual: number; variance: number }>;

  for (const stage of stages) {
    const stageData = filtered.reduce(
      (acc, r) => {
        const stageInfo = r.costByStage[stage];
        if (stageInfo) {
          acc.actual += stageInfo.totalCost;
        }
        return acc;
      },
      { estimated: 0, actual: 0 },
    );

    varianceByStage[stage] = {
      totalEstimated: stageData.estimated,
      totalActual: stageData.actual,
      variance: stageData.actual - stageData.estimated,
    };
  }

  return {
    totalMOs: filtered.length,
    favorableCount,
    unfavorableCount,
    criticalCount,
    totalEstimatedCost,
    totalActualCost,
    totalVariance,
    averageVariancePercent,
    topOverruns,
    varianceByStage,
  };
}

/**
 * Subscribe to cost variance records (real-time)
 */
export function subscribeToCostVariances(
  subsidiaryId: string,
  callback: (records: CostVarianceRecord[]) => void,
): () => void {
  const q = query(
    collection(db, COST_VARIANCE_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    orderBy('lastUpdatedAt', 'desc'),
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CostVarianceRecord)));
  });
}

// ============================================
// Variance Alerts
// ============================================

/**
 * Check for critical variance and emit alerts
 */
export async function checkAndEmitVarianceAlerts(
  mo: ManufacturingOrder,
  variance: CostVarianceRecord,
  userId: string,
): Promise<void> {
  if (variance.varianceStatus === 'critical') {
    await addDoc(collection(db, BUSINESS_EVENTS_COLLECTION), {
      eventType: 'cost_variance_critical',
      category: 'cost_management',
      severity: 'high',
      sourceModule: 'manufacturing',
      subsidiary: 'finishes',
      entityType: 'manufacturing_order',
      entityId: mo.id,
      entityName: mo.moNumber,
      projectId: mo.projectId,
      title: `Critical cost variance on ${mo.moNumber}`,
      description: `Total variance: ${variance.totalVariancePercent.toFixed(1)}% (${variance.currency} ${variance.totalVariance.toLocaleString()})`,
      triggeredBy: userId,
      triggeredAt: serverTimestamp(),
      status: 'pending',
      metadata: {
        estimatedCost: variance.estimatedTotalCost,
        actualCost: variance.actualTotalCost,
        variance: variance.totalVariance,
        variancePercent: variance.totalVariancePercent,
        materialVariance: variance.materialVariance,
        laborVariance: variance.laborVariance,
      },
      createdAt: serverTimestamp(),
    });
  }
}
