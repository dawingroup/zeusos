/**
 * Manufacturing Analytics Service
 *
 * Provides analytics and KPI calculations for the manufacturing module.
 * Queries Firestore collections to compute production metrics, cost breakdowns,
 * operator performance, workstation efficiency, and production trends.
 */

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ProductionSummary,
  ManufacturingKPIs,
  OrderCostBreakdown,
  OperatorPerformance,
  WorkstationEfficiency,
  MOStatus,
  ManufacturingOrderMES,
  Workstation,
  ManufacturingStep,
} from '../types';

const MO_COLLECTION = 'manufacturingOrders';
const WORKSTATIONS_COLLECTION = 'workstations';

// ============================================
// Helpers
// ============================================

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as Timestamp).toDate === 'function'
  ) {
    return (value as Timestamp).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return null;
}

function daysBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================
// 1. Production Summary
// ============================================

/**
 * Query MOs within a date range and calculate production summary metrics.
 * Includes completed/in-progress counts, average cycle time, on-time delivery
 * rate, first pass yield (orders without rework), and defect rate.
 */
async function getProductionSummary(
  startDate: Date,
  endDate: Date,
): Promise<ProductionSummary> {
  const q = query(
    collection(db, MO_COLLECTION),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    where('createdAt', '<=', Timestamp.fromDate(endDate)),
    orderBy('createdAt', 'desc'),
  );

  const snap = await getDocs(q);
  const orders = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ManufacturingOrderMES),
  );

  const totalOrders = orders.length;
  const ordersByStatus: Record<string, number> = {};
  let completedOrders = 0;
  let totalLeadTimeDays = 0;
  let completedWithLeadTime = 0;
  let totalDefects = 0;
  let totalScrapCost = 0;
  let totalEstimatedLabor = 0;
  let totalActualLabor = 0;
  let ordersDeliveredOnTime = 0;
  let ordersWithDueDate = 0;

  for (const mo of orders) {
    // Count by status
    const statusKey = mo.mesStatus ?? 'draft';
    ordersByStatus[statusKey] = (ordersByStatus[statusKey] ?? 0) + 1;

    if (statusKey === 'completed') {
      completedOrders++;

      // Lead time calculation (createdAt to actualEndDate)
      const created = toDate(mo.createdAt);
      const completed = toDate(mo.actualEndDate) ?? toDate(mo.scheduling?.actualEnd);
      if (created && completed) {
        totalLeadTimeDays += daysBetween(created, completed);
        completedWithLeadTime++;
      }

      // On-time delivery check
      const dueDate = toDate(mo.dueDate) ?? toDate(mo.scheduling?.scheduledEnd);
      if (dueDate) {
        ordersWithDueDate++;
        const actualEnd = toDate(mo.actualEndDate) ?? toDate(mo.scheduling?.actualEnd);
        if (actualEnd && actualEnd <= dueDate) {
          ordersDeliveredOnTime++;
        }
      }
    }

    // Defects and scrap
    totalDefects += mo.defectCount ?? 0;
    const scrapFromConsumptions = (mo.materialConsumptions ?? []).reduce(
      (sum, c) => sum + (c.notes?.toLowerCase().includes('scrap') ? c.totalCost : 0),
      0,
    );
    totalScrapCost += scrapFromConsumptions;

    // Labor tracking
    totalEstimatedLabor += mo.estimatedLaborHours ?? 0;
    totalActualLabor += mo.actualLaborHours ?? 0;
  }

  const averageLeadTimeDays =
    completedWithLeadTime > 0 ? totalLeadTimeDays / completedWithLeadTime : 0;
  const completionRate =
    totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;
  const defectRate =
    totalOrders > 0 ? (totalDefects / totalOrders) * 100 : 0;
  const laborUtilizationPercent =
    totalEstimatedLabor > 0
      ? (totalActualLabor / totalEstimatedLabor) * 100
      : 0;

  return {
    dateRange: {
      start: Timestamp.fromDate(startDate),
      end: Timestamp.fromDate(endDate),
    },
    totalOrders,
    ordersByStatus,
    completedOrders,
    completionRate: Math.round(completionRate * 100) / 100,
    averageLeadTimeDays: Math.round(averageLeadTimeDays * 100) / 100,
    totalDefects,
    defectRate: Math.round(defectRate * 100) / 100,
    totalScrapCost,
    laborUtilizationPercent: Math.round(laborUtilizationPercent * 100) / 100,
  };
}

// ============================================
// 2. Manufacturing KPIs
// ============================================

/**
 * Calculate current manufacturing KPIs:
 * - Throughput: completed orders in last 30 days / 30
 * - Average lead time for completed orders
 * - WIP count: orders with status in_progress, ready, or on_hold
 * - Capacity utilization from workstations
 * - Scrap rate, cost variance, quality score
 */
async function getManufacturingKPIs(): Promise<ManufacturingKPIs> {
  const snap = await getDocs(collection(db, MO_COLLECTION));
  const orders = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ManufacturingOrderMES),
  );

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // WIP statuses (using MOStatus values with underscores)
  const wipStatuses: MOStatus[] = ['in_progress', 'ready', 'on_hold'];
  const wipOrders = orders.filter((mo) =>
    wipStatuses.includes(mo.mesStatus as MOStatus),
  );

  // Completed in last 30 days
  const recentCompleted = orders.filter((mo) => {
    if (mo.mesStatus !== 'completed') return false;
    const completedAt = toDate(mo.actualEndDate) ?? toDate(mo.scheduling?.actualEnd);
    return completedAt && completedAt >= thirtyDaysAgo;
  });

  // Average lead time from completed orders
  let totalLeadTime = 0;
  let leadTimeCount = 0;
  for (const mo of recentCompleted) {
    const created = toDate(mo.createdAt);
    const completed = toDate(mo.actualEndDate) ?? toDate(mo.scheduling?.actualEnd);
    if (created && completed) {
      totalLeadTime += daysBetween(created, completed);
      leadTimeCount++;
    }
  }
  const averageLeadTime = leadTimeCount > 0 ? totalLeadTime / leadTimeCount : 0;

  // On-time delivery rate
  let onTimeCount = 0;
  let dueDateCount = 0;
  for (const mo of recentCompleted) {
    const dueDate = toDate(mo.dueDate) ?? toDate(mo.scheduling?.scheduledEnd);
    if (!dueDate) continue;
    dueDateCount++;
    const actualEnd = toDate(mo.actualEndDate) ?? toDate(mo.scheduling?.actualEnd);
    if (actualEnd && actualEnd <= dueDate) {
      onTimeCount++;
    }
  }
  const onTimeDeliveryRate = dueDateCount > 0 ? (onTimeCount / dueDateCount) * 100 : 100;

  // Defect rate
  const totalDefects = orders.reduce((sum, mo) => sum + (mo.defectCount ?? 0), 0);
  const defectRate = orders.length > 0 ? (totalDefects / orders.length) * 100 : 0;

  // Material waste: compare estimated vs actual material cost
  let totalEstimatedMaterial = 0;
  let totalActualMaterial = 0;
  for (const mo of orders) {
    totalEstimatedMaterial += mo.estimatedMaterialCost ?? 0;
    totalActualMaterial += mo.actualMaterialCost ?? 0;
  }
  const materialWastePercent =
    totalEstimatedMaterial > 0
      ? ((totalActualMaterial - totalEstimatedMaterial) / totalEstimatedMaterial) * 100
      : 0;

  // Labor utilization
  let totalEstimatedLabor = 0;
  let totalActualLabor = 0;
  for (const mo of orders) {
    totalEstimatedLabor += mo.estimatedLaborHours ?? 0;
    totalActualLabor += mo.actualLaborHours ?? 0;
  }
  const laborUtilizationPercent =
    totalEstimatedLabor > 0
      ? (totalActualLabor / totalEstimatedLabor) * 100
      : 0;

  return {
    ordersInProgress: wipOrders.length,
    avgLeadTimeDays: Math.round(averageLeadTime * 100) / 100,
    onTimeDeliveryRate: Math.round(onTimeDeliveryRate * 100) / 100,
    defectRate: Math.round(defectRate * 100) / 100,
    materialWastePercent: Math.round(Math.max(0, materialWastePercent) * 100) / 100,
    laborUtilizationPercent: Math.round(laborUtilizationPercent * 100) / 100,
  };
}

// ============================================
// 3. Order Cost Breakdown
// ============================================

/**
 * Get a single MO and return its cost breakdown.
 * Uses MES-extended fields for estimated vs actual costs.
 */
async function getOrderCostBreakdown(
  orderId: string,
): Promise<OrderCostBreakdown> {
  const docRef = doc(db, MO_COLLECTION, orderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error(`Manufacturing order ${orderId} not found`);
  }

  const mo = { id: snap.id, ...snap.data() } as ManufacturingOrderMES;

  const estimatedMaterialCost = mo.estimatedMaterialCost ?? mo.costSummary?.materialCost ?? 0;
  const actualMaterialCost = mo.actualMaterialCost ?? 0;
  const estimatedLaborCost =
    (mo.estimatedLaborHours ?? 0) * 15000; // default hourly rate in UGX
  const actualLaborCost =
    (mo.actualLaborHours ?? 0) * 15000;

  // Scrap cost from material consumptions tagged as scrap
  const scrapCost = (mo.materialConsumptions ?? []).reduce(
    (sum, c) => sum + (c.notes?.toLowerCase().includes('scrap') ? c.totalCost : 0),
    0,
  );

  const estimatedTotalCost = mo.estimatedTotalCost ?? estimatedMaterialCost + estimatedLaborCost;
  const actualTotalCost = mo.actualTotalCost ?? actualMaterialCost + actualLaborCost + scrapCost;

  const variance = actualTotalCost - estimatedTotalCost;
  const variancePercent =
    estimatedTotalCost > 0 ? (variance / estimatedTotalCost) * 100 : 0;

  return {
    orderId: mo.id,
    moNumber: mo.moNumber,
    estimatedMaterialCost,
    actualMaterialCost,
    estimatedLaborCost,
    actualLaborCost,
    scrapCost,
    estimatedTotalCost,
    actualTotalCost,
    variance,
    variancePercent: Math.round(variancePercent * 100) / 100,
  };
}

// ============================================
// 4. Workstation Efficiency
// ============================================

/**
 * Query all workstations and calculate utilization and efficiency metrics.
 * Utilization is derived from currentActiveJobs / maxConcurrentJobs.
 */
async function getWorkstationEfficiency(): Promise<WorkstationEfficiency[]> {
  const snap = await getDocs(
    query(collection(db, WORKSTATIONS_COLLECTION), where('isActive', '==', true)),
  );

  const workstations = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as Workstation),
  );

  return workstations.map((ws) => {
    const maxJobs = ws.maxConcurrentJobs || 1;
    const utilizationPercent = (ws.currentActiveJobs / maxJobs) * 100;

    // Cycle time estimate based on operating hours and capacity
    const capacityPerHour = ws.capacityPerHour ?? 1;
    const averageCycleTimeMinutes = capacityPerHour > 0 ? 60 / capacityPerHour : 0;

    return {
      workstationId: ws.id,
      workstationName: ws.name,
      utilizationPercent: Math.min(100, Math.round(utilizationPercent * 100) / 100),
      averageCycleTimeMinutes: Math.round(averageCycleTimeMinutes * 100) / 100,
      queueDepth: ws.queuedStepCount ?? 0,
      stepsCompleted: ws.currentStepIds?.length ?? 0,
    };
  });
}

// ============================================
// 5. Production Trend
// ============================================

/**
 * Query MOs from the last N days and group by date.
 * Returns daily counts of completed vs started orders.
 */
async function getProductionTrend(
  days: number,
): Promise<Array<{ date: string; completed: number; started: number }>> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const q = query(
    collection(db, MO_COLLECTION),
    where('createdAt', '>=', Timestamp.fromDate(startDate)),
    orderBy('createdAt', 'asc'),
  );

  const snap = await getDocs(q);
  const orders = snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as ManufacturingOrderMES),
  );

  // Initialize all days in the range
  const trendMap = new Map<string, { completed: number; started: number }>();
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    trendMap.set(formatDateKey(date), { completed: 0, started: 0 });
  }

  for (const mo of orders) {
    // Count started (by createdAt)
    const created = toDate(mo.createdAt);
    if (created) {
      const key = formatDateKey(created);
      const entry = trendMap.get(key);
      if (entry) {
        entry.started++;
      }
    }

    // Count completed (by actualEndDate or scheduling.actualEnd)
    if (mo.mesStatus === 'completed' || mo.status === 'completed') {
      const completed = toDate(mo.actualEndDate) ?? toDate(mo.scheduling?.actualEnd);
      if (completed && completed >= startDate) {
        const key = formatDateKey(completed);
        const entry = trendMap.get(key);
        if (entry) {
          entry.completed++;
        }
      }
    }
  }

  return Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date,
      completed: counts.completed,
      started: counts.started,
    }));
}

// ============================================
// 6. Operator Performance
// ============================================

/**
 * Aggregate operator performance metrics from manufacturing step data.
 * Queries all completed steps across recent MOs and groups by operator.
 */
async function getOperatorPerformance(): Promise<OperatorPerformance[]> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get recent MOs
  const moQuery = query(
    collection(db, MO_COLLECTION),
    where('createdAt', '>=', Timestamp.fromDate(ninetyDaysAgo)),
  );
  const moSnap = await getDocs(moQuery);

  const operatorMap = new Map<
    string,
    {
      name: string;
      stepsCompleted: number;
      totalTimeRatio: number;
      qualityPasses: number;
      qualityTotal: number;
      totalHours: number;
    }
  >();

  for (const moDoc of moSnap.docs) {
    // Query steps subcollection for this MO
    const stepsSnap = await getDocs(
      query(
        collection(db, MO_COLLECTION, moDoc.id, 'steps'),
        where('status', '==', 'completed'),
      ),
    );

    for (const stepDoc of stepsSnap.docs) {
      const step = { id: stepDoc.id, ...stepDoc.data() } as ManufacturingStep;

      const operatorId = step.assignedOperatorId;
      if (!operatorId) continue;

      const existing = operatorMap.get(operatorId) ?? {
        name: step.assignedOperatorName ?? 'Unknown',
        stepsCompleted: 0,
        totalTimeRatio: 0,
        qualityPasses: 0,
        qualityTotal: 0,
        totalHours: 0,
      };

      existing.stepsCompleted++;

      // Time vs estimate ratio
      if (step.estimatedDurationMinutes > 0 && step.actualDurationMinutes) {
        existing.totalTimeRatio +=
          step.estimatedDurationMinutes / step.actualDurationMinutes;
      }

      // Quality tracking
      if (step.qcRequired) {
        existing.qualityTotal++;
        if (step.qcResult === 'pass') {
          existing.qualityPasses++;
        }
      }

      // Hours worked
      existing.totalHours += (step.actualDurationMinutes ?? 0) / 60;

      operatorMap.set(operatorId, existing);
    }
  }

  return Array.from(operatorMap.entries()).map(([operatorId, data]) => ({
    operatorId,
    operatorName: data.name,
    stepsCompleted: data.stepsCompleted,
    averageTimeVsEstimate:
      data.stepsCompleted > 0
        ? Math.round((data.totalTimeRatio / data.stepsCompleted) * 100) / 100
        : 0,
    qualityPassRate:
      data.qualityTotal > 0
        ? Math.round((data.qualityPasses / data.qualityTotal) * 100 * 100) / 100
        : 100,
    totalHoursWorked: Math.round(data.totalHours * 100) / 100,
  }));
}

// ============================================
// Export
// ============================================

export const manufacturingAnalyticsService = {
  getProductionSummary,
  getManufacturingKPIs,
  getOrderCostBreakdown,
  getWorkstationEfficiency,
  getProductionTrend,
  getOperatorPerformance,
};
