/**
 * PROJECT BUDGET TYPES
 * 
 * Re-export from core and add delivery-specific budget types.
 */

// Re-export core budget type
export type { ProjectBudget } from '@/subsidiaries/advisory/core/project/types/project.types';

// ─────────────────────────────────────────────────────────────────
// VARIANCE STATUS
// ─────────────────────────────────────────────────────────────────

export type VarianceStatus = 'under_budget' | 'on_budget' | 'over_budget' | 'critical';

export const VARIANCE_STATUS_CONFIG: Record<VarianceStatus, { label: string; color: string; bgColor: string }> = {
  under_budget: { label: 'Under Budget', color: 'text-green-600', bgColor: 'bg-green-100' },
  on_budget: { label: 'On Budget', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  over_budget: { label: 'Over Budget', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' },
};

// ─────────────────────────────────────────────────────────────────
// BUDGET ALLOCATION
// ─────────────────────────────────────────────────────────────────

export type BudgetAllocationType = 
  | 'labor'
  | 'materials'
  | 'equipment'
  | 'subcontractor'
  | 'overhead'
  | 'contingency'
  | 'other';

export interface ProjectBudgetAllocation {
  id: string;
  type: BudgetAllocationType;
  description: string;
  allocatedAmount: number;
  spentAmount: number;
  committedAmount: number;
}

export interface BudgetSummary {
  totalBudget: number;
  totalSpent: number;
  totalCommitted: number;
  remaining: number;
  variancePercent: number;
  status: VarianceStatus;
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

export function initializeProjectBudget(currency: 'UGX' | 'USD' = 'UGX'): { currency: 'UGX' | 'USD'; totalBudget: number; spent: number; committed: number } {
  return {
    currency,
    totalBudget: 0,
    spent: 0,
    committed: 0,
  };
}

export function calculateBudgetVariance(budget: number, spent: number): number {
  if (budget === 0) return 0;
  return ((budget - spent) / budget) * 100;
}

export function getBudgetVarianceStatus(variancePercent: number): VarianceStatus {
  if (variancePercent > 10) return 'under_budget';
  if (variancePercent >= 0) return 'on_budget';
  if (variancePercent >= -10) return 'over_budget';
  return 'critical';
}

export function calculateBudgetSummary(
  totalBudget: number,
  spent: number,
  committed: number
): BudgetSummary {
  const remaining = totalBudget - spent - committed;
  const variancePercent = calculateBudgetVariance(totalBudget, spent + committed);
  const status = getBudgetVarianceStatus(variancePercent);

  return {
    totalBudget,
    totalSpent: spent,
    totalCommitted: committed,
    remaining,
    variancePercent,
    status,
  };
}

export function isBudgetCritical(spent: number, budget: number): boolean {
  if (budget === 0) return false;
  return spent / budget > 1.1;
}

export function formatBudgetAmount(amount: number, currency: 'UGX' | 'USD' = 'UGX'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return formatter.format(amount);
}

export function getVarianceStatusColor(status: VarianceStatus): string {
  return `${VARIANCE_STATUS_CONFIG[status].color} ${VARIANCE_STATUS_CONFIG[status].bgColor}`;
}

// Additional type aliases and helpers referenced by delivery index
export type BudgetCategory = BudgetAllocationType;

export function calculateVarianceStatus(spent: number, budget: number): VarianceStatus {
  const variancePercent = calculateBudgetVariance(budget, spent);
  return getBudgetVarianceStatus(variancePercent);
}

export function updateBudgetSpending(
  summary: BudgetSummary,
  additionalSpent: number
): BudgetSummary {
  return calculateBudgetSummary(
    summary.totalBudget,
    summary.totalSpent + additionalSpent,
    summary.totalCommitted
  );
}

export function getCategoryRemaining(allocation: ProjectBudgetAllocation): number {
  return allocation.allocatedAmount - allocation.spentAmount - allocation.committedAmount;
}
