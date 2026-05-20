/**
 * Budget Tracker Utility
 * 
 * Utility for tracking BOQ budget vs actual procurement costs.
 */

import type { BOQDocument, BOQSection } from '../types/boq';
import type { Requisition, RequisitionItem } from '../types/requisition';
import type { PurchaseOrder } from '../types/procurement';

// ============================================================================
// TYPES
// ============================================================================

export interface Money {
  amount: number;
  currency: string;
}

export interface BudgetSummary {
  boqBudget: Money;
  requisitioned: Money;
  approved: Money;
  ordered: Money;
  delivered: Money;
  variance: Money;
  variancePercentage: number;
  status: 'under_budget' | 'on_budget' | 'over_budget';
}

export interface ItemBudgetTracking {
  boqItemId: string;
  boqItemDescription: string;
  budgetQuantity: number;
  budgetRate: Money;
  budgetTotal: Money;
  requisitionedQuantity: number;
  approvedQuantity: number;
  orderedQuantity: number;
  deliveredQuantity: number;
  actualRate?: Money;
  actualTotal: Money;
  variance: Money;
  variancePercentage: number;
  status: 'under_budget' | 'on_budget' | 'over_budget' | 'not_started';
}

export interface SectionBudgetTracking {
  sectionId: string;
  sectionName: string;
  budgetTotal: Money;
  actualTotal: Money;
  variance: Money;
  variancePercentage: number;
  status: 'under_budget' | 'on_budget' | 'over_budget';
  items: ItemBudgetTracking[];
}

export interface ProjectBudgetReport {
  projectId: string;
  projectName: string;
  currency: string;
  summary: BudgetSummary;
  sections: SectionBudgetTracking[];
  alerts: BudgetAlert[];
  generatedAt: Date;
}

export interface BudgetAlert {
  type: 'warning' | 'critical';
  category: 'over_budget' | 'rate_variance' | 'quantity_variance';
  message: string;
  itemId?: string;
  sectionId?: string;
  variance?: number;
}

// ============================================================================
// BUDGET CALCULATIONS
// ============================================================================

export const calculateBudgetSummary = (
  boq: BOQDocument,
  requisitions: Requisition[],
  purchaseOrders: PurchaseOrder[]
): BudgetSummary => {
  const currency = boq.summary?.currency || 'UGX';

  // BOQ budget
  const boqBudget = boq.summary?.totalAmount?.amount || 0;

  // Requisitioned total (all submitted/approved requisitions)
  const requisitioned = requisitions
    .filter(r => !['draft'].includes(r.status))
    .reduce((sum, r) => sum + (r.totalEstimatedCost?.amount || 0), 0);

  // Approved total
  const approved = requisitions
    .filter(r => ['approved', 'partially_fulfilled', 'fulfilled'].includes(r.status))
    .reduce((sum, r) => sum + (r.totalApprovedCost?.amount || r.totalEstimatedCost?.amount || 0), 0);

  // Ordered total (from POs)
  const ordered = purchaseOrders
    .filter(po => !['draft', 'cancelled'].includes(po.status || ''))
    .reduce((sum, po) => sum + (po.totalAmount || 0), 0);

  // Delivered total (from completed deliveries)
  const delivered = purchaseOrders
    .filter(po => ['completed'].includes(po.status || ''))
    .reduce((sum, po) => sum + (po.totalAmount || 0), 0);

  // Variance (against ordered, as that's committed)
  const variance = boqBudget - ordered;
  const variancePercentage = boqBudget > 0 
    ? ((boqBudget - ordered) / boqBudget) * 100 
    : 0;

  // Status
  let status: BudgetSummary['status'];
  if (variancePercentage > 5) {
    status = 'under_budget';
  } else if (variancePercentage < -5) {
    status = 'over_budget';
  } else {
    status = 'on_budget';
  }

  return {
    boqBudget: { amount: boqBudget, currency },
    requisitioned: { amount: requisitioned, currency },
    approved: { amount: approved, currency },
    ordered: { amount: ordered, currency },
    delivered: { amount: delivered, currency },
    variance: { amount: variance, currency },
    variancePercentage,
    status,
  };
};

export const calculateItemBudgetTracking = (
  boqItem: {
    id: string;
    description: string;
    quantity: number;
    materialRate?: number;
    unitRate: number;
    totalAmount: number;
  },
  requisitionItems: RequisitionItem[],
  poItems: Array<{
    quantityOrdered: number;
    quantityReceived: number;
    unitPrice: number;
    totalAmount: number;
  }>
): ItemBudgetTracking => {
  const currency = 'UGX';

  const budgetTotal = boqItem.totalAmount;
  const budgetRate = boqItem.materialRate || boqItem.unitRate;

  // Sum quantities from requisitions
  const requisitionedQuantity = requisitionItems.reduce(
    (sum, item) => sum + (item.requestedQuantity || 0), 0
  );
  const approvedQuantity = requisitionItems.reduce(
    (sum, item) => sum + (item.approvedQuantity || 0), 0
  );

  // Sum from POs
  const orderedQuantity = poItems.reduce(
    (sum, item) => sum + item.quantityOrdered, 0
  );
  const deliveredQuantity = poItems.reduce(
    (sum, item) => sum + item.quantityReceived, 0
  );

  // Calculate actual rate (weighted average from POs)
  let actualRate: number | undefined;
  if (orderedQuantity > 0) {
    const totalCost = poItems.reduce(
      (sum, item) => sum + (item.unitPrice * item.quantityOrdered), 0
    );
    actualRate = totalCost / orderedQuantity;
  }

  // Actual total from POs
  const actualTotal = poItems.reduce(
    (sum, item) => sum + item.totalAmount, 0
  );

  // Variance
  const variance = budgetTotal - actualTotal;
  const variancePercentage = budgetTotal > 0 
    ? ((budgetTotal - actualTotal) / budgetTotal) * 100 
    : 0;

  // Status
  let status: ItemBudgetTracking['status'];
  if (orderedQuantity === 0 && deliveredQuantity === 0) {
    status = 'not_started';
  } else if (variancePercentage > 5) {
    status = 'under_budget';
  } else if (variancePercentage < -5) {
    status = 'over_budget';
  } else {
    status = 'on_budget';
  }

  return {
    boqItemId: boqItem.id,
    boqItemDescription: boqItem.description,
    budgetQuantity: boqItem.quantity,
    budgetRate: { amount: budgetRate, currency },
    budgetTotal: { amount: budgetTotal, currency },
    requisitionedQuantity,
    approvedQuantity,
    orderedQuantity,
    deliveredQuantity,
    actualRate: actualRate ? { amount: actualRate, currency } : undefined,
    actualTotal: { amount: actualTotal, currency },
    variance: { amount: variance, currency },
    variancePercentage,
    status,
  };
};

export const calculateSectionBudgetTracking = (
  section: BOQSection,
  itemTrackings: ItemBudgetTracking[]
): SectionBudgetTracking => {
  const currency = 'UGX';

  const budgetTotal = section.subtotal?.amount || 0;
  const actualTotal = itemTrackings.reduce(
    (sum, item) => sum + item.actualTotal.amount, 0
  );

  const variance = budgetTotal - actualTotal;
  const variancePercentage = budgetTotal > 0 
    ? ((budgetTotal - actualTotal) / budgetTotal) * 100 
    : 0;

  let status: SectionBudgetTracking['status'];
  if (variancePercentage > 5) {
    status = 'under_budget';
  } else if (variancePercentage < -5) {
    status = 'over_budget';
  } else {
    status = 'on_budget';
  }

  return {
    sectionId: section.id,
    sectionName: section.name,
    budgetTotal: { amount: budgetTotal, currency },
    actualTotal: { amount: actualTotal, currency },
    variance: { amount: variance, currency },
    variancePercentage,
    status,
    items: itemTrackings,
  };
};

// ============================================================================
// ALERTS GENERATION
// ============================================================================

export const generateBudgetAlerts = (
  summary: BudgetSummary,
  sections: SectionBudgetTracking[]
): BudgetAlert[] => {
  const alerts: BudgetAlert[] = [];

  // Overall budget alerts
  if (summary.variancePercentage < -20) {
    alerts.push({
      type: 'critical',
      category: 'over_budget',
      message: `Project is ${Math.abs(summary.variancePercentage).toFixed(1)}% over budget`,
      variance: summary.variancePercentage,
    });
  } else if (summary.variancePercentage < -10) {
    alerts.push({
      type: 'warning',
      category: 'over_budget',
      message: `Project is ${Math.abs(summary.variancePercentage).toFixed(1)}% over budget`,
      variance: summary.variancePercentage,
    });
  }

  // Section-level alerts
  for (const section of sections) {
    if (section.variancePercentage < -15) {
      alerts.push({
        type: 'warning',
        category: 'over_budget',
        message: `Section "${section.sectionName}" is ${Math.abs(section.variancePercentage).toFixed(1)}% over budget`,
        sectionId: section.sectionId,
        variance: section.variancePercentage,
      });
    }

    // Item-level alerts
    for (const item of section.items) {
      // Rate variance alert
      if (item.actualRate && item.budgetRate) {
        const rateVariance = ((item.actualRate.amount - item.budgetRate.amount) / item.budgetRate.amount) * 100;
        if (rateVariance > 20) {
          alerts.push({
            type: 'warning',
            category: 'rate_variance',
            message: `Item "${item.boqItemDescription}" has ${rateVariance.toFixed(1)}% rate increase`,
            itemId: item.boqItemId,
            sectionId: section.sectionId,
            variance: rateVariance,
          });
        }
      }

      // Quantity variance alert
      if (item.orderedQuantity > item.budgetQuantity * 1.2) {
        const qtyVariance = ((item.orderedQuantity - item.budgetQuantity) / item.budgetQuantity) * 100;
        alerts.push({
          type: 'warning',
          category: 'quantity_variance',
          message: `Item "${item.boqItemDescription}" ordered quantity exceeds budget by ${qtyVariance.toFixed(1)}%`,
          itemId: item.boqItemId,
          sectionId: section.sectionId,
          variance: qtyVariance,
        });
      }
    }
  }

  // Sort by severity
  return alerts.sort((a, b) => {
    if (a.type === 'critical' && b.type !== 'critical') return -1;
    if (a.type !== 'critical' && b.type === 'critical') return 1;
    return (Math.abs(b.variance || 0)) - (Math.abs(a.variance || 0));
  });
};

// ============================================================================
// REPORT GENERATION
// ============================================================================

export const generateProjectBudgetReport = (
  projectId: string,
  projectName: string,
  boq: BOQDocument,
  requisitions: Requisition[],
  purchaseOrders: PurchaseOrder[]
): ProjectBudgetReport => {
  // Calculate summary
  const summary = calculateBudgetSummary(boq, requisitions, purchaseOrders);

  // Calculate section tracking
  const sections: SectionBudgetTracking[] = [];

  for (const section of (boq.sections || [])) {
    const itemTrackings: ItemBudgetTracking[] = [];

    for (const item of (section.items || [])) {
      // Find related requisition items
      const relatedReqItems = requisitions.flatMap(r => 
        (r.items || []).filter(ri => ri.boqItemId === item.id)
      );

      // For now, we don't have direct PO item linkage
      // This would need to be implemented based on actual data structure
      const relatedPOItems: Array<{
        quantityOrdered: number;
        quantityReceived: number;
        unitPrice: number;
        totalAmount: number;
      }> = [];

      const tracking = calculateItemBudgetTracking(
        {
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          materialRate: item.materialRate?.amount,
          unitRate: item.unitRate?.amount || 0,
          totalAmount: item.totalAmount?.amount || 0,
        },
        relatedReqItems,
        relatedPOItems
      );
      itemTrackings.push(tracking);
    }

    const sectionTracking = calculateSectionBudgetTracking(section, itemTrackings);
    sections.push(sectionTracking);
  }

  // Generate alerts
  const alerts = generateBudgetAlerts(summary, sections);

  return {
    projectId,
    projectName,
    currency: boq.summary?.currency || 'UGX',
    summary,
    sections,
    alerts,
    generatedAt: new Date(),
  };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const formatCurrency = (amount: number, currency: string = 'UGX'): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

export const getVarianceColor = (percentage: number): string => {
  if (percentage > 10) return 'green';
  if (percentage > 0) return 'blue';
  if (percentage > -10) return 'yellow';
  if (percentage > -20) return 'orange';
  return 'red';
};

export const budgetTracker = {
  calculateBudgetSummary,
  calculateItemBudgetTracking,
  calculateSectionBudgetTracking,
  generateBudgetAlerts,
  generateProjectBudgetReport,
  formatCurrency,
  formatPercentage,
  getVarianceColor,
};

export default budgetTracker;
