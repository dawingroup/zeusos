/**
 * Unified Dashboard Service
 *
 * Aggregated metrics and KPIs across Manufacturing, Inventory, and Procurement:
 * - Production pipeline status
 * - Inventory health indicators
 * - Procurement status summary
 * - Cost and efficiency metrics
 * - Material flow tracking
 */

import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ManufacturingOrder,
  ManufacturingOrderStatus,
  MOStage,
} from '../types';
import type { PurchaseOrder, PurchaseOrderStatus } from '@/modules/procurement/types/purchaseOrder';
import type { ProcurementRequirement } from '@/modules/procurement/types/procurement';
import { getCostVarianceSummary } from '@/modules/procurement/services/costVarianceService';
import { getReorderAlerts } from './inventoryIntegrationService';

const MO_COLLECTION = 'manufacturingOrders';
const PO_COLLECTION = 'purchaseOrders';
const PROCUREMENT_REQUIREMENTS_COLLECTION = 'procurementRequirements';
const STOCK_LEVELS_COLLECTION = 'stockLevels';

// ============================================
// Types
// ============================================

export interface UnifiedDashboardData {
  // Manufacturing Pipeline
  manufacturing: ManufacturingMetrics;

  // Inventory Health
  inventory: InventoryMetrics;

  // Procurement Status
  procurement: ProcurementMetrics;

  // Combined Efficiency
  efficiency: EfficiencyMetrics;

  // Alerts and Actions
  alerts: DashboardAlerts;

  // Snapshot timestamp
  generatedAt: Date;
  subsidiaryId: string;
}

export interface ManufacturingMetrics {
  // Order counts by status
  totalOrders: number;
  byStatus: Record<ManufacturingOrderStatus, number>;
  byStage: Record<MOStage, number>;

  // Priority distribution
  byPriority: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };

  // Time metrics
  averageCycleTimeDays: number;
  ordersOnHold: number;
  ordersOverdue: number;

  // Throughput
  completedThisWeek: number;
  completedThisMonth: number;
  completedTrend: 'up' | 'down' | 'stable';

  // Value
  totalInProgressValue: number;
  totalCompletedValueThisMonth: number;
  currency: string;
}

export interface InventoryMetrics {
  // Stock health
  totalStockValue: number;
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  overstockedCount: number;

  // Reservations
  totalReserved: number;
  reservedValue: number;

  // Movement
  receiptsThisWeek: number;
  consumptionThisWeek: number;

  // Coverage
  averageDaysOfCover: number;
  itemsBelowMinimum: number;

  currency: string;
}

export interface ProcurementMetrics {
  // PO Summary
  totalPOs: number;
  poByStatus: Record<PurchaseOrderStatus, number>;
  totalPOValue: number;
  pendingDeliveryValue: number;

  // Requirements
  pendingRequirements: number;
  pendingRequirementsValue: number;
  requirementsBySupplier: Array<{
    supplierId: string;
    supplierName: string;
    count: number;
    totalValue: number;
  }>;

  // Lead time
  averageLeadTimeDays: number;
  overdueDeliveries: number;

  currency: string;
}

export interface EfficiencyMetrics {
  // Material efficiency
  materialUtilizationPercent: number;
  wastePercent: number;

  // Cost performance
  costVariancePercent: number;
  favorableVarianceCount: number;
  unfavorableVarianceCount: number;

  // Inventory turnover
  inventoryTurnoverRatio: number;
  daysInventoryOutstanding: number;

  // Procurement efficiency
  onTimeDeliveryPercent: number;
  supplierPerformanceScore: number;
}

export interface DashboardAlerts {
  // Critical alerts
  criticalCount: number;
  highCount: number;
  mediumCount: number;

  // Specific alerts
  lowStockAlerts: Array<{
    itemName: string;
    available: number;
    reorderLevel: number;
    urgency: string;
  }>;

  overdueApprovals: Array<{
    moNumber: string;
    level: number;
    overdueHours: number;
  }>;

  blockedMOs: Array<{
    moNumber: string;
    reason: string;
    blockedSince: Date;
  }>;

  pendingReceipts: Array<{
    poNumber: string;
    supplierName: string;
    expectedDate?: Date;
    value: number;
  }>;

  costOverruns: Array<{
    moNumber: string;
    variancePercent: number;
    varianceAmount: number;
  }>;
}

// ============================================
// Dashboard Data Generation
// ============================================

/**
 * Generate comprehensive dashboard data for a subsidiary
 */
export async function generateUnifiedDashboard(
  subsidiaryId: string,
): Promise<UnifiedDashboardData> {
  const [manufacturing, inventory, procurement, efficiency, alerts] = await Promise.all([
    generateManufacturingMetrics(subsidiaryId),
    generateInventoryMetrics(subsidiaryId),
    generateProcurementMetrics(subsidiaryId),
    generateEfficiencyMetrics(subsidiaryId),
    generateAlerts(subsidiaryId),
  ]);

  return {
    manufacturing,
    inventory,
    procurement,
    efficiency,
    alerts,
    generatedAt: new Date(),
    subsidiaryId,
  };
}

/**
 * Generate manufacturing pipeline metrics
 */
async function generateManufacturingMetrics(
  subsidiaryId: string,
): Promise<ManufacturingMetrics> {
  const q = query(
    collection(db, MO_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
  );
  const snap = await getDocs(q);
  const orders = snap.docs.map(d => ({ id: d.id, ...d.data() } as ManufacturingOrder));

  // Status counts
  const byStatus: Record<ManufacturingOrderStatus, number> = {
    draft: 0,
    'pending-approval': 0,
    approved: 0,
    'in-progress': 0,
    'on-hold': 0,
    'partially-complete': 0,
    completed: 0,
    'closed-out': 0,
    cancelled: 0,
  };

  // Stage counts
  const byStage: Record<MOStage, number> = {
    queued: 0,
    cutting: 0,
    assembly: 0,
    finishing: 0,
    qc: 0,
    ready: 0,
  };

  // Priority counts
  const byPriority = { low: 0, medium: 0, high: 0, urgent: 0 };

  let totalInProgressValue = 0;
  let totalCompletedValueThisMonth = 0;
  let completedThisWeek = 0;
  let completedThisMonth = 0;
  let totalCycleTime = 0;
  let completedWithCycleTime = 0;
  let overdueCount = 0;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (const mo of orders) {
    byStatus[mo.status]++;

    if (mo.status === 'in-progress' || mo.status === 'approved') {
      byStage[mo.currentStage]++;
      totalInProgressValue += mo.costSummary.totalCost;
    }

    byPriority[mo.priority]++;

    // Completed metrics
    if (mo.status === 'completed' && mo.scheduling.actualEnd) {
      const completedAt = toDate(mo.scheduling.actualEnd);

      if (completedAt && completedAt > weekAgo) {
        completedThisWeek++;
      }
      if (completedAt && completedAt > monthAgo) {
        completedThisMonth++;
        totalCompletedValueThisMonth += mo.costSummary.totalCost;
      }

      // Cycle time
      if (mo.scheduling.actualStart && mo.scheduling.actualEnd) {
        const start = toDate(mo.scheduling.actualStart);
        const end = toDate(mo.scheduling.actualEnd);
        if (start && end) {
          totalCycleTime += (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
          completedWithCycleTime++;
        }
      }
    }

    // Overdue check (scheduled end passed, not completed)
    if (
      mo.scheduling.scheduledEnd &&
      !['completed', 'cancelled'].includes(mo.status)
    ) {
      const scheduledEnd = toDate(mo.scheduling.scheduledEnd);
      if (scheduledEnd && scheduledEnd < now) {
        overdueCount++;
      }
    }
  }

  // Determine trend
  let completedTrend: 'up' | 'down' | 'stable' = 'stable';
  const lastMonthCompleted = orders.filter(mo => {
    if (mo.status !== 'completed' || !mo.scheduling.actualEnd) return false;
    const completedAt = toDate(mo.scheduling.actualEnd);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    return completedAt && completedAt > twoMonthsAgo && completedAt <= monthAgo;
  }).length;

  if (completedThisMonth > lastMonthCompleted * 1.1) {
    completedTrend = 'up';
  } else if (completedThisMonth < lastMonthCompleted * 0.9) {
    completedTrend = 'down';
  }

  return {
    totalOrders: orders.length,
    byStatus,
    byStage,
    byPriority,
    averageCycleTimeDays: completedWithCycleTime > 0 ? totalCycleTime / completedWithCycleTime : 0,
    ordersOnHold: byStatus['on-hold'],
    ordersOverdue: overdueCount,
    completedThisWeek,
    completedThisMonth,
    completedTrend,
    totalInProgressValue,
    totalCompletedValueThisMonth,
    currency: 'UGX',
  };
}

/**
 * Generate inventory health metrics
 */
async function generateInventoryMetrics(
  _subsidiaryId: string,
): Promise<InventoryMetrics> {
  const q = query(collection(db, STOCK_LEVELS_COLLECTION));
  const snap = await getDocs(q);

  let totalStockValue = 0;
  let totalReserved = 0;
  let reservedValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let overstockedCount = 0;
  let itemsBelowMinimum = 0;

  for (const stockDoc of snap.docs) {
    const stock = stockDoc.data();
    const onHand = stock.quantityOnHand ?? 0;
    const reserved = stock.quantityReserved ?? 0;
    const available = stock.quantityAvailable ?? 0;
    const reorderLevel = stock.reorderLevel ?? 0;
    const maxLevel = stock.maxLevel ?? Infinity;
    const unitCost = stock.unitCost ?? 0;

    totalStockValue += onHand * unitCost;
    totalReserved += reserved;
    reservedValue += reserved * unitCost;

    if (available <= 0) {
      outOfStockCount++;
    } else if (reorderLevel > 0 && available < reorderLevel) {
      lowStockCount++;
    }

    if (maxLevel !== Infinity && onHand > maxLevel) {
      overstockedCount++;
    }

    if (reorderLevel > 0 && available < reorderLevel) {
      itemsBelowMinimum++;
    }
  }

  // Get movement data (simplified - would need movement subcollection query)
  const receiptsThisWeek = 0; // Placeholder
  const consumptionThisWeek = 0; // Placeholder

  return {
    totalStockValue,
    totalItems: snap.size,
    lowStockCount,
    outOfStockCount,
    overstockedCount,
    totalReserved,
    reservedValue,
    receiptsThisWeek,
    consumptionThisWeek,
    averageDaysOfCover: 30, // Placeholder - would calculate from consumption rate
    itemsBelowMinimum,
    currency: 'UGX',
  };
}

/**
 * Generate procurement metrics
 */
async function generateProcurementMetrics(
  subsidiaryId: string,
): Promise<ProcurementMetrics> {
  // Get POs
  const poQuery = query(
    collection(db, PO_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
  );
  const poSnap = await getDocs(poQuery);
  const pos = poSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder));

  const poByStatus: Record<PurchaseOrderStatus, number> = {
    draft: 0,
    'pending-approval': 0,
    approved: 0,
    sent: 0,
    'partially-received': 0,
    received: 0,
    closed: 0,
    cancelled: 0,
    rejected: 0,
  };

  let totalPOValue = 0;
  let pendingDeliveryValue = 0;
  let overdueDeliveries = 0;

  for (const po of pos) {
    poByStatus[po.status]++;
    totalPOValue += po.totals?.grandTotal ?? 0;

    if (['sent', 'partially-received'].includes(po.status)) {
      pendingDeliveryValue += po.totals?.grandTotal ?? 0;
    }
  }

  // Get requirements
  const reqQuery = query(
    collection(db, PROCUREMENT_REQUIREMENTS_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('status', '==', 'pending'),
  );
  const reqSnap = await getDocs(reqQuery);
  const requirements = reqSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProcurementRequirement));

  const pendingRequirementsValue = requirements.reduce(
    (sum, r) => sum + r.estimatedTotalCost,
    0,
  );

  // Group by supplier
  const bySupplier = new Map<string, { name: string; count: number; value: number }>();
  for (const req of requirements) {
    const key = req.supplierId ?? 'unassigned';
    const existing = bySupplier.get(key) ?? {
      name: req.supplierName ?? 'Unassigned',
      count: 0,
      value: 0,
    };
    existing.count++;
    existing.value += req.estimatedTotalCost;
    bySupplier.set(key, existing);
  }

  const requirementsBySupplier = [...bySupplier.entries()]
    .map(([supplierId, data]) => ({
      supplierId,
      supplierName: data.name,
      count: data.count,
      totalValue: data.value,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  return {
    totalPOs: pos.length,
    poByStatus,
    totalPOValue,
    pendingDeliveryValue,
    pendingRequirements: requirements.length,
    pendingRequirementsValue,
    requirementsBySupplier,
    averageLeadTimeDays: 14, // Placeholder
    overdueDeliveries,
    currency: 'UGX',
  };
}

/**
 * Generate efficiency metrics
 */
async function generateEfficiencyMetrics(
  subsidiaryId: string,
): Promise<EfficiencyMetrics> {
  // Get cost variance summary
  const varianceSummary = await getCostVarianceSummary(subsidiaryId);

  return {
    materialUtilizationPercent: 92, // Placeholder - would calculate from BOM vs consumption
    wastePercent: 8, // Placeholder
    costVariancePercent: varianceSummary.averageVariancePercent,
    favorableVarianceCount: varianceSummary.favorableCount,
    unfavorableVarianceCount: varianceSummary.unfavorableCount + varianceSummary.criticalCount,
    inventoryTurnoverRatio: 4.5, // Placeholder
    daysInventoryOutstanding: 81, // Placeholder
    onTimeDeliveryPercent: 85, // Placeholder
    supplierPerformanceScore: 78, // Placeholder
  };
}

/**
 * Generate alerts
 */
async function generateAlerts(
  subsidiaryId: string,
): Promise<DashboardAlerts> {
  const reorderAlerts = await getReorderAlerts(subsidiaryId);

  const lowStockAlerts = reorderAlerts.slice(0, 5).map(a => ({
    itemName: a.itemName,
    available: a.quantityAvailable,
    reorderLevel: a.reorderLevel,
    urgency: a.urgency,
  }));

  // Get blocked MOs
  const blockedQuery = query(
    collection(db, MO_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('status', '==', 'on-hold'),
  );
  const blockedSnap = await getDocs(blockedQuery);
  const blockedMOs = blockedSnap.docs.slice(0, 5).map(d => {
    const mo = d.data() as ManufacturingOrder;
    return {
      moNumber: mo.moNumber,
      reason: 'On hold',
      blockedSince: toDate(mo.updatedAt) ?? new Date(),
    };
  });

  // Get cost overruns
  const varianceSummary = await getCostVarianceSummary(subsidiaryId);
  const costOverruns = varianceSummary.topOverruns.slice(0, 5).map(o => ({
    moNumber: o.moNumber,
    variancePercent: o.variancePercent,
    varianceAmount: o.variance,
  }));

  // Count alerts by severity
  const criticalCount = reorderAlerts.filter(a => a.urgency === 'critical').length;
  const highCount = reorderAlerts.filter(a => a.urgency === 'high').length + costOverruns.length;
  const mediumCount = reorderAlerts.filter(a => a.urgency === 'medium').length + blockedMOs.length;

  return {
    criticalCount,
    highCount,
    mediumCount,
    lowStockAlerts,
    overdueApprovals: [], // Would need approval workflow integration
    blockedMOs,
    pendingReceipts: [], // Would need PO expected date tracking
    costOverruns,
  };
}

// ============================================
// Helper Functions
// ============================================

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  return null;
}

// ============================================
// Individual Widget Data
// ============================================

/**
 * Get manufacturing pipeline data for chart
 */
export async function getManufacturingPipelineData(
  subsidiaryId: string,
): Promise<{
  stages: Array<{ stage: MOStage; count: number; value: number }>;
  total: number;
}> {
  const q = query(
    collection(db, MO_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('status', 'in', ['approved', 'in-progress']),
  );
  const snap = await getDocs(q);

  const stageMap = new Map<MOStage, { count: number; value: number }>();
  const stages: MOStage[] = ['queued', 'cutting', 'assembly', 'finishing', 'qc', 'ready'];

  for (const stage of stages) {
    stageMap.set(stage, { count: 0, value: 0 });
  }

  for (const d of snap.docs) {
    const mo = d.data() as ManufacturingOrder;
    const existing = stageMap.get(mo.currentStage)!;
    existing.count++;
    existing.value += mo.costSummary.totalCost;
  }

  return {
    stages: stages.map(stage => ({
      stage,
      count: stageMap.get(stage)!.count,
      value: stageMap.get(stage)!.value,
    })),
    total: snap.size,
  };
}

/**
 * Get procurement status chart data
 */
export async function getProcurementStatusData(
  subsidiaryId: string,
): Promise<{
  statuses: Array<{ status: PurchaseOrderStatus; count: number; value: number }>;
  total: number;
}> {
  const q = query(
    collection(db, PO_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
  );
  const snap = await getDocs(q);

  const statusMap = new Map<PurchaseOrderStatus, { count: number; value: number }>();
  const statuses: PurchaseOrderStatus[] = [
    'draft',
    'pending-approval',
    'approved',
    'sent',
    'partially-received',
    'received',
    'closed',
    'cancelled',
    'rejected',
  ];

  for (const status of statuses) {
    statusMap.set(status, { count: 0, value: 0 });
  }

  for (const d of snap.docs) {
    const po = d.data() as PurchaseOrder;
    const existing = statusMap.get(po.status)!;
    existing.count++;
    existing.value += po.totals?.grandTotal ?? 0;
  }

  return {
    statuses: statuses.map(status => ({
      status,
      count: statusMap.get(status)!.count,
      value: statusMap.get(status)!.value,
    })),
    total: snap.size,
  };
}
