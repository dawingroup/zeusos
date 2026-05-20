/**
 * PROGRAM BUDGET TYPES
 * 
 * Budget categories, allocations, and financial tracking for programs.
 */

import { Money } from '../../core/types/money';

// ─────────────────────────────────────────────────────────────────
// BUDGET CATEGORIES
// ─────────────────────────────────────────────────────────────────

/**
 * Budget category for cost classification
 */
export type BudgetCategory =
  | 'works'         // Construction works
  | 'goods'         // Materials, equipment, supplies
  | 'services'      // Professional services, consultancy
  | 'supervision'   // Supervision and monitoring
  | 'contingency'   // Contingency reserve
  | 'overhead'      // Administrative overhead
  | 'other';        // Miscellaneous

/**
 * Budget category configuration
 */
export interface BudgetCategoryConfig {
  category: BudgetCategory;
  label: string;
  description: string;
  typicalPercent: number;
}

export const BUDGET_CATEGORIES: Record<BudgetCategory, BudgetCategoryConfig> = {
  works: {
    category: 'works',
    label: 'Works',
    description: 'Construction and civil works',
    typicalPercent: 70,
  },
  goods: {
    category: 'goods',
    label: 'Goods',
    description: 'Materials, equipment, and supplies',
    typicalPercent: 10,
  },
  services: {
    category: 'services',
    label: 'Services',
    description: 'Professional and consultancy services',
    typicalPercent: 5,
  },
  supervision: {
    category: 'supervision',
    label: 'Supervision',
    description: 'Supervision and monitoring costs',
    typicalPercent: 5,
  },
  contingency: {
    category: 'contingency',
    label: 'Contingency',
    description: 'Contingency reserve for unforeseen costs',
    typicalPercent: 5,
  },
  overhead: {
    category: 'overhead',
    label: 'Overhead',
    description: 'Administrative and operational overhead',
    typicalPercent: 3,
  },
  other: {
    category: 'other',
    label: 'Other',
    description: 'Miscellaneous costs',
    typicalPercent: 2,
  },
};

// ─────────────────────────────────────────────────────────────────
// CO-INVESTMENT TRACKING
// ─────────────────────────────────────────────────────────────────

/**
 * Source type for co-investment contributions
 */
export type CoInvestmentSourceType = 'donor' | 'client' | 'government' | 'other';

export const CO_INVESTMENT_SOURCE_CONFIG: Record<CoInvestmentSourceType, {
  label: string;
  color: string;
  bgColor: string;
}> = {
  donor: { label: 'Donor', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  client: { label: 'Client', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  government: { label: 'Government', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  other: { label: 'Other', color: 'text-gray-700', bgColor: 'bg-gray-100' },
};

/**
 * Individual co-investment contribution entry.
 * Stored in `advisory_programs/{programId}/co_investments`.
 */
export interface CoInvestmentEntry {
  id: string;
  programId: string;
  projectId: string;                // Linked project within the program
  projectName: string;              // Denormalized for display
  sourceType: CoInvestmentSourceType;
  sourceName: string;               // e.g. "World Bank", "Ministry of Works"
  pledged: Money;                   // Total amount pledged/committed
  disbursed: Money;                 // Amount actually received/disbursed
  spent: Money;                     // Amount spent from this source
  conditions?: string;              // Conditions attached to the funding
  isConfirmed: boolean;             // Whether the commitment is firm
  budgetPeriodId?: string;          // Optional link to specific budget period
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Computed co-investment summary for display
 */
export interface CoInvestmentSummary {
  totalPledged: Money;
  totalDisbursed: Money;
  totalSpent: Money;
  donorTotal: Money;                // Sum of all donor-type entries
  clientTotal: Money;               // Sum of all client-type entries
  governmentTotal: Money;           // Sum of all government-type entries
  otherTotal: Money;                // Sum of all other-type entries
  coInvestmentRatio: number;        // client / total pledged (0–1)
  leverageRatio: number;            // total / donor (how much each donor $ leverages)
  disbursementRate: number;         // disbursed / pledged (0–100)
  entries: CoInvestmentEntry[];
}

// ─────────────────────────────────────────────────────────────────
// FUNDING ALLOCATION
// ─────────────────────────────────────────────────────────────────

/**
 * Allocation of funding source to program budget
 * Links program budget to engagement-level funding sources
 */
export interface BudgetAllocation {
  fundingSourceId: string;
  funderName: string;
  allocatedAmount: Money;
  disbursedAmount: Money;
  spentAmount: Money;
  percentOfBudget: number;
  conditions?: string[];
  eligibleCategories?: BudgetCategory[];
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────────
// BUDGET BY CATEGORY
// ─────────────────────────────────────────────────────────────────

/**
 * Budget breakdown by category
 */
export interface CategoryBudget {
  category: BudgetCategory;
  allocated: Money;
  committed: Money;
  spent: Money;
  available: Money;
  percentOfTotal: number;
}

// ─────────────────────────────────────────────────────────────────
// PROGRAM BUDGET
// ─────────────────────────────────────────────────────────────────

/**
 * PROGRAM BUDGET
 * Complete budget structure for a program
 */
export interface ProgramBudget {
  currency: string;
  
  // Totals
  allocated: Money;
  committed: Money;
  spent: Money;
  available: Money;
  
  // By Category
  byCategory: CategoryBudget[];
  
  // Funding Allocation
  fundingAllocations: BudgetAllocation[];
  
  // Tracking
  lastCalculatedAt: Date;
  
  variance: {
    commitmentVariance: Money;
    commitmentVariancePercent: number;
    spendingVariance: Money;
    spendingVariancePercent: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Initialize empty program budget
 */
export function initializeProgramBudget(currency: string = 'USD'): ProgramBudget {
  return {
    currency,
    allocated: { amount: 0, currency },
    committed: { amount: 0, currency },
    spent: { amount: 0, currency },
    available: { amount: 0, currency },
    byCategory: Object.values(BUDGET_CATEGORIES).map(config => ({
      category: config.category,
      allocated: { amount: 0, currency },
      committed: { amount: 0, currency },
      spent: { amount: 0, currency },
      available: { amount: 0, currency },
      percentOfTotal: 0,
    })),
    fundingAllocations: [],
    lastCalculatedAt: new Date(),
    variance: {
      commitmentVariance: { amount: 0, currency },
      commitmentVariancePercent: 0,
      spendingVariance: { amount: 0, currency },
      spendingVariancePercent: 0,
    },
  };
}

/**
 * Calculate budget totals from allocations
 */
export function calculateBudgetTotals(
  allocations: BudgetAllocation[]
): { allocated: number; disbursed: number; spent: number } {
  return allocations.reduce(
    (totals, allocation) => ({
      allocated: totals.allocated + allocation.allocatedAmount.amount,
      disbursed: totals.disbursed + allocation.disbursedAmount.amount,
      spent: totals.spent + allocation.spentAmount.amount,
    }),
    { allocated: 0, disbursed: 0, spent: 0 }
  );
}

/**
 * Calculate budget variance
 */
export function calculateBudgetVariance(
  allocated: number,
  committed: number,
  spent: number,
  currency: string
): ProgramBudget['variance'] {
  const commitmentVariance = allocated - committed;
  const spendingVariance = committed - spent;
  
  return {
    commitmentVariance: { amount: commitmentVariance, currency },
    commitmentVariancePercent: allocated > 0 ? (commitmentVariance / allocated) * 100 : 0,
    spendingVariance: { amount: spendingVariance, currency },
    spendingVariancePercent: committed > 0 ? (spendingVariance / committed) * 100 : 0,
  };
}

/**
 * Get budget utilization percentage
 */
export function getBudgetUtilization(budget: ProgramBudget): {
  commitmentRate: number;
  spendingRate: number;
  overallUtilization: number;
} {
  const allocated = budget.allocated.amount;
  if (allocated === 0) {
    return { commitmentRate: 0, spendingRate: 0, overallUtilization: 0 };
  }
  
  const commitmentRate = (budget.committed.amount / allocated) * 100;
  const spendingRate = budget.committed.amount > 0
    ? (budget.spent.amount / budget.committed.amount) * 100
    : 0;
  const overallUtilization = (budget.spent.amount / allocated) * 100;
  
  return { commitmentRate, spendingRate, overallUtilization };
}

/**
 * Check if category budget is exceeded
 */
export function isCategoryOverBudget(categoryBudget: CategoryBudget): boolean {
  return categoryBudget.committed.amount > categoryBudget.allocated.amount;
}

/**
 * Get funding source utilization
 */
export function getFundingSourceUtilization(allocation: BudgetAllocation): {
  disbursementRate: number;
  spendingRate: number;
} {
  const allocated = allocation.allocatedAmount.amount;
  if (allocated === 0) {
    return { disbursementRate: 0, spendingRate: 0 };
  }
  
  return {
    disbursementRate: (allocation.disbursedAmount.amount / allocated) * 100,
    spendingRate: (allocation.spentAmount.amount / allocated) * 100,
  };
}

/**
 * Get category budget by type
 */
export function getCategoryBudget(
  budget: ProgramBudget,
  category: BudgetCategory
): CategoryBudget | undefined {
  return budget.byCategory.find(c => c.category === category);
}

/**
 * Calculate available budget for category
 */
export function getAvailableBudget(categoryBudget: CategoryBudget): number {
  return categoryBudget.allocated.amount - categoryBudget.committed.amount;
}

// ─────────────────────────────────────────────────────────────────
// CO-INVESTMENT HELPERS
// ─────────────────────────────────────────────────────────────────

/**
 * Compute co-investment summary from entries
 */
export function computeCoInvestmentSummary(
  entries: CoInvestmentEntry[],
  currency: string = 'USD'
): CoInvestmentSummary {
  const totalPledged = entries.reduce((sum, e) => sum + e.pledged.amount, 0);
  const totalDisbursed = entries.reduce((sum, e) => sum + e.disbursed.amount, 0);
  const totalSpent = entries.reduce((sum, e) => sum + e.spent.amount, 0);

  const sumByType = (type: CoInvestmentSourceType) =>
    entries
      .filter(e => e.sourceType === type)
      .reduce((sum, e) => sum + e.pledged.amount, 0);

  const donorTotal = sumByType('donor');
  const clientTotal = sumByType('client');
  const governmentTotal = sumByType('government');
  const otherTotal = sumByType('other');

  return {
    totalPledged: { amount: totalPledged, currency },
    totalDisbursed: { amount: totalDisbursed, currency },
    totalSpent: { amount: totalSpent, currency },
    donorTotal: { amount: donorTotal, currency },
    clientTotal: { amount: clientTotal, currency },
    governmentTotal: { amount: governmentTotal, currency },
    otherTotal: { amount: otherTotal, currency },
    coInvestmentRatio: totalPledged > 0 ? clientTotal / totalPledged : 0,
    leverageRatio: donorTotal > 0 ? totalPledged / donorTotal : 0,
    disbursementRate: totalPledged > 0 ? (totalDisbursed / totalPledged) * 100 : 0,
    entries,
  };
}

/**
 * Initialize a new co-investment entry
 */
export function initializeCoInvestmentEntry(
  programId: string,
  projectId: string,
  projectName: string,
  sourceType: CoInvestmentSourceType,
  sourceName: string,
  pledgedAmount: number,
  currency: string = 'USD'
): Omit<CoInvestmentEntry, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> {
  return {
    programId,
    projectId,
    projectName,
    sourceType,
    sourceName,
    pledged: { amount: pledgedAmount, currency },
    disbursed: { amount: 0, currency },
    spent: { amount: 0, currency },
    isConfirmed: false,
  };
}
