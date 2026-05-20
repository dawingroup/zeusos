/**
 * CONTROL BOQ TYPES
 * 
 * Types for the Control BOQ used in the Delivery module.
 * The Control BOQ is imported from MatFlow's BOQ parsing tool
 * and serves as the source for requisition generation.
 */

import { Timestamp } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// BOQ ITEM STATUS
// ─────────────────────────────────────────────────────────────────

export type BOQItemStatus = 
  | 'pending'        // Not yet requisitioned
  | 'partial'        // Partially requisitioned
  | 'requisitioned'  // Fully requisitioned
  | 'in_progress'    // Work in progress
  | 'completed';     // Work completed

export const BOQ_ITEM_STATUS_CONFIG: Record<BOQItemStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'gray' },
  partial: { label: 'Partial', color: 'blue' },
  requisitioned: { label: 'Requisitioned', color: 'purple' },
  in_progress: { label: 'In Progress', color: 'yellow' },
  completed: { label: 'Completed', color: 'green' },
};

// ─────────────────────────────────────────────────────────────────
// BOQ CATEGORY
// ─────────────────────────────────────────────────────────────────

export type BOQCategory =
  | 'preliminaries'
  | 'substructure'
  | 'superstructure'
  | 'finishes'
  | 'services'
  | 'external_works'
  | 'provisional'
  | 'contingency'
  | 'professional_fees'
  | 'other';

export const BOQ_CATEGORY_LABELS: Record<BOQCategory, string> = {
  preliminaries: 'Preliminaries',
  substructure: 'Substructure',
  superstructure: 'Superstructure',
  finishes: 'Finishes',
  services: 'Services',
  external_works: 'External Works',
  provisional: 'Provisional Sums',
  contingency: 'Contingency',
  professional_fees: 'Professional Fees',
  other: 'Other',
};

// ─────────────────────────────────────────────────────────────────
// BUDGET CONTROL (ADD-FIN-001 Integration)
// ─────────────────────────────────────────────────────────────────

export type VarianceBudgetStatus = 'on_budget' | 'alert' | 'exceeded';

export interface BOQBudgetControl {
  // Budget line reference
  budgetLineId: string;
  budgetLineName?: string;

  // Budget amounts
  allocatedAmount: number; // From BOQ contract (quantityContract * rate)
  committedAmount: number; // Sum of approved requisitions
  spentAmount: number; // Sum of accounted expenses
  remainingBudget: number; // allocated - committed

  // Variance tracking
  varianceAmount: number; // spent - committed
  variancePercentage: number;
  varianceStatus: VarianceBudgetStatus;

  // Thresholds
  alertThreshold: number; // Percentage (e.g., 90% = alert when 90% committed)
  criticalThreshold: number; // Percentage (e.g., 100% = critical)

  // Last updated
  lastUpdated: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// CONTROL BOQ ITEM
// ─────────────────────────────────────────────────────────────────

export interface ControlBOQItem {
  id: string;
  projectId: string;
  
  // Item identification
  itemCode: string;
  itemNumber: string;
  description: string;
  specification?: string;
  
  // Hierarchy (from MatFlow parsing)
  billNumber: string;
  billName?: string;
  elementCode?: string;
  elementName?: string;
  sectionCode?: string;
  sectionName?: string;
  hierarchyPath?: string;
  hierarchyLevel?: number;
  
  // Quantities
  unit: string;
  quantityContract: number;      // Original contract quantity
  quantityRequisitioned: number; // Amount already in requisitions
  quantityExecuted: number;      // Amount of work completed
  quantityRemaining: number;     // Contract - Executed
  
  // Rates & Amounts
  rate: number;
  amount: number;
  currency: string;
  
  // Category & Stage
  category?: BOQCategory;
  stage?: string;
  
  // Status
  status: BOQItemStatus;

  // Requisition tracking
  linkedRequisitionIds: string[];
  lastRequisitionDate?: Date;

  // ADD-FIN-001: Budget control
  budgetControl?: BOQBudgetControl;

  // Metadata
  source: 'import' | 'manual' | 'matflow';
  importedAt?: Timestamp;
  importedBy?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// REQUISITION BOQ ITEM (Line item in a requisition)
// ─────────────────────────────────────────────────────────────────

export interface RequisitionBOQItem {
  id: string;
  
  // Reference to source BOQ item
  boqItemId: string;
  boqItemCode: string;
  
  // Item details (copied from BOQ for reference)
  description: string;
  specification?: string;
  billName?: string;
  sectionName?: string;
  
  // Requisition quantity (subset of BOQ item)
  unit: string;
  quantityRequested: number;
  quantityAvailable: number;  // How much was available at time of requisition
  
  // Rates & Amounts
  rate: number;
  amount: number;
  
  // Notes
  notes?: string;
  
  // Execution tracking (for accountability)
  quantityExecuted: number;
  executionNotes?: string;
}

// ─────────────────────────────────────────────────────────────────
// CONTROL BOQ SUMMARY
// ─────────────────────────────────────────────────────────────────

export interface ControlBOQSummary {
  projectId: string;
  
  // Counts
  totalItems: number;
  pendingItems: number;
  requisitionedItems: number;
  inProgressItems: number;
  completedItems: number;
  
  // Amounts
  totalContractValue: number;
  requisitionedValue: number;
  executedValue: number;
  remainingValue: number;
  currency: string;
  
  // By category
  byCategory: Record<BOQCategory, {
    count: number;
    contractValue: number;
    requisitionedValue: number;
  }>;
  
  // Metadata
  lastUpdated: Timestamp;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate available quantity for requisition
 */
export function getAvailableQuantity(item: ControlBOQItem): number {
  return Math.max(0, item.quantityContract - item.quantityRequisitioned);
}

/**
 * Calculate requisition progress percentage
 */
export function getRequisitionProgress(item: ControlBOQItem): number {
  if (item.quantityContract <= 0) return 0;
  return (item.quantityRequisitioned / item.quantityContract) * 100;
}

/**
 * Calculate execution progress percentage
 */
export function getExecutionProgress(item: ControlBOQItem): number {
  if (item.quantityContract <= 0) return 0;
  return (item.quantityExecuted / item.quantityContract) * 100;
}

/**
 * Determine item status based on quantities
 */
export function determineItemStatus(item: ControlBOQItem): BOQItemStatus {
  if (item.quantityExecuted >= item.quantityContract) {
    return 'completed';
  }
  if (item.quantityExecuted > 0) {
    return 'in_progress';
  }
  if (item.quantityRequisitioned >= item.quantityContract) {
    return 'requisitioned';
  }
  if (item.quantityRequisitioned > 0) {
    return 'partial';
  }
  return 'pending';
}

/**
 * Calculate total amount for requisition items
 */
export function calculateRequisitionTotal(items: RequisitionBOQItem[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/**
 * Group BOQ items by bill
 */
export function groupByBill(items: ControlBOQItem[]): Record<string, ControlBOQItem[]> {
  return items.reduce((groups, item) => {
    const key = item.billName || item.billNumber || 'Uncategorized';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, ControlBOQItem[]>);
}

/**
 * Group BOQ items by section
 */
export function groupBySection(items: ControlBOQItem[]): Record<string, ControlBOQItem[]> {
  return items.reduce((groups, item) => {
    const key = item.sectionName || item.sectionCode || 'Uncategorized';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, ControlBOQItem[]>);
}

// ─────────────────────────────────────────────────────────────────
// ADD-FIN-001: BUDGET CONTROL HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate budget control metrics for a BOQ item
 */
export function calculateBudgetControl(
  item: ControlBOQItem,
  requisitions: { amount: number; status: string }[],
  accountabilities: { amount: number }[]
): BOQBudgetControl {
  const allocatedAmount = item.quantityContract * item.rate;

  // Sum approved requisitions
  const committedAmount = requisitions
    .filter(req => req.status === 'approved' || req.status === 'paid')
    .reduce((sum, req) => sum + req.amount, 0);

  // Sum accounted expenses
  const spentAmount = accountabilities.reduce((sum, acc) => sum + acc.amount, 0);

  const remainingBudget = allocatedAmount - committedAmount;
  const varianceAmount = spentAmount - committedAmount;
  const variancePercentage = committedAmount > 0
    ? (varianceAmount / committedAmount) * 100
    : 0;

  // Determine variance status
  const commitmentPercentage = allocatedAmount > 0
    ? (committedAmount / allocatedAmount) * 100
    : 0;

  let varianceStatus: VarianceBudgetStatus;
  if (committedAmount > allocatedAmount) {
    varianceStatus = 'exceeded';
  } else if (commitmentPercentage >= 90) {
    varianceStatus = 'alert';
  } else {
    varianceStatus = 'on_budget';
  }

  return {
    budgetLineId: item.id,
    budgetLineName: item.description,
    allocatedAmount,
    committedAmount,
    spentAmount,
    remainingBudget,
    varianceAmount,
    variancePercentage,
    varianceStatus,
    alertThreshold: 90,
    criticalThreshold: 100,
    lastUpdated: Timestamp.now(),
  };
}

/**
 * Check if BOQ item has sufficient budget for requisition
 */
export function hasSufficientBudget(
  item: ControlBOQItem,
  requestedAmount: number
): { sufficient: boolean; message?: string } {
  if (!item.budgetControl) {
    return {
      sufficient: false,
      message: 'Budget control not initialized for this BOQ item',
    };
  }

  const { remainingBudget, allocatedAmount } = item.budgetControl;

  if (requestedAmount > remainingBudget) {
    return {
      sufficient: false,
      message: `Requested amount (${requestedAmount}) exceeds remaining budget (${remainingBudget})`,
    };
  }

  // Check if request would push to alert threshold
  const newCommitment = item.budgetControl.committedAmount + requestedAmount;
  const newCommitmentPercentage = (newCommitment / allocatedAmount) * 100;

  if (newCommitmentPercentage >= 90 && newCommitmentPercentage < 100) {
    return {
      sufficient: true,
      message: `Warning: This requisition will commit ${newCommitmentPercentage.toFixed(1)}% of allocated budget`,
    };
  }

  return { sufficient: true };
}

/**
 * Get budget control status color for UI
 */
export function getBudgetControlStatusColor(status: VarianceBudgetStatus): string {
  const colorMap: Record<VarianceBudgetStatus, string> = {
    on_budget: 'text-green-600 bg-green-100',
    alert: 'text-yellow-600 bg-yellow-100',
    exceeded: 'text-red-600 bg-red-100',
  };
  return colorMap[status];
}

/**
 * Calculate total budget control summary for all BOQ items
 */
export function calculateTotalBudgetSummary(items: ControlBOQItem[]): {
  totalAllocated: number;
  totalCommitted: number;
  totalSpent: number;
  totalRemaining: number;
  totalVariance: number;
  onBudgetCount: number;
  alertCount: number;
  exceededCount: number;
} {
  const itemsWithBudget = items.filter(item => item.budgetControl);

  const summary = itemsWithBudget.reduce(
    (acc, item) => {
      const bc = item.budgetControl!;
      return {
        totalAllocated: acc.totalAllocated + bc.allocatedAmount,
        totalCommitted: acc.totalCommitted + bc.committedAmount,
        totalSpent: acc.totalSpent + bc.spentAmount,
        totalRemaining: acc.totalRemaining + bc.remainingBudget,
        totalVariance: acc.totalVariance + bc.varianceAmount,
        onBudgetCount: acc.onBudgetCount + (bc.varianceStatus === 'on_budget' ? 1 : 0),
        alertCount: acc.alertCount + (bc.varianceStatus === 'alert' ? 1 : 0),
        exceededCount: acc.exceededCount + (bc.varianceStatus === 'exceeded' ? 1 : 0),
      };
    },
    {
      totalAllocated: 0,
      totalCommitted: 0,
      totalSpent: 0,
      totalRemaining: 0,
      totalVariance: 0,
      onBudgetCount: 0,
      alertCount: 0,
      exceededCount: 0,
    }
  );

  return summary;
}

/**
 * Update BOQ item after requisition approval
 */
export function updateBOQAfterRequisitionApproval(
  item: ControlBOQItem,
  requisitionQuantity: number,
  requisitionAmount: number,
  requisitionId: string
): Partial<ControlBOQItem> {
  const newQuantityRequisitioned = item.quantityRequisitioned + requisitionQuantity;
  const newQuantityRemaining = item.quantityContract - item.quantityExecuted;

  // Update linked requisitions
  const linkedRequisitionIds = [...item.linkedRequisitionIds, requisitionId];

  // Update status
  let newStatus: BOQItemStatus = item.status;
  if (newQuantityRequisitioned >= item.quantityContract) {
    newStatus = 'requisitioned';
  } else if (newQuantityRequisitioned > 0) {
    newStatus = 'partial';
  }

  // Update budget control
  let updatedBudgetControl: BOQBudgetControl | undefined;
  if (item.budgetControl) {
    const newCommittedAmount = item.budgetControl.committedAmount + requisitionAmount;
    const newRemainingBudget = item.budgetControl.allocatedAmount - newCommittedAmount;
    const newVarianceAmount = item.budgetControl.spentAmount - newCommittedAmount;
    const newVariancePercentage = newCommittedAmount > 0
      ? (newVarianceAmount / newCommittedAmount) * 100
      : 0;

    const commitmentPercentage = item.budgetControl.allocatedAmount > 0
      ? (newCommittedAmount / item.budgetControl.allocatedAmount) * 100
      : 0;

    let newVarianceStatus: VarianceBudgetStatus;
    if (newCommittedAmount > item.budgetControl.allocatedAmount) {
      newVarianceStatus = 'exceeded';
    } else if (commitmentPercentage >= 90) {
      newVarianceStatus = 'alert';
    } else {
      newVarianceStatus = 'on_budget';
    }

    updatedBudgetControl = {
      ...item.budgetControl,
      committedAmount: newCommittedAmount,
      remainingBudget: newRemainingBudget,
      varianceAmount: newVarianceAmount,
      variancePercentage: newVariancePercentage,
      varianceStatus: newVarianceStatus,
      lastUpdated: Timestamp.now(),
    };
  }

  return {
    quantityRequisitioned: newQuantityRequisitioned,
    quantityRemaining: newQuantityRemaining,
    status: newStatus,
    linkedRequisitionIds,
    budgetControl: updatedBudgetControl,
    lastRequisitionDate: new Date(),
    updatedAt: Timestamp.now(),
  };
}

/**
 * Update BOQ item after accountability completion
 */
export function updateBOQAfterAccountability(
  item: ControlBOQItem,
  executedQuantity: number,
  spentAmount: number
): Partial<ControlBOQItem> {
  const newQuantityExecuted = item.quantityExecuted + executedQuantity;
  const newQuantityRemaining = item.quantityContract - newQuantityExecuted;

  // Update status
  let newStatus: BOQItemStatus = item.status;
  if (newQuantityExecuted >= item.quantityContract) {
    newStatus = 'completed';
  } else if (newQuantityExecuted > 0) {
    newStatus = 'in_progress';
  }

  // Update budget control
  let updatedBudgetControl: BOQBudgetControl | undefined;
  if (item.budgetControl) {
    const newSpentAmount = item.budgetControl.spentAmount + spentAmount;
    const newVarianceAmount = newSpentAmount - item.budgetControl.committedAmount;
    const newVariancePercentage = item.budgetControl.committedAmount > 0
      ? (newVarianceAmount / item.budgetControl.committedAmount) * 100
      : 0;

    updatedBudgetControl = {
      ...item.budgetControl,
      spentAmount: newSpentAmount,
      varianceAmount: newVarianceAmount,
      variancePercentage: newVariancePercentage,
      lastUpdated: Timestamp.now(),
    };
  }

  return {
    quantityExecuted: newQuantityExecuted,
    quantityRemaining: newQuantityRemaining,
    status: newStatus,
    budgetControl: updatedBudgetControl,
    updatedAt: Timestamp.now(),
  };
}
