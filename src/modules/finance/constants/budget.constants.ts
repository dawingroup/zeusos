// ============================================================================
// BUDGET CONSTANTS
// DawinOS v2.0 - Financial Management Module
// Constants for Budget Management
// ============================================================================

// ----------------------------------------------------------------------------
// BUDGET TYPES
// ----------------------------------------------------------------------------

export const BUDGET_TYPES = {
  OPERATING: 'operating',
  CAPITAL: 'capital',
  PROJECT: 'project',
  DEPARTMENTAL: 'departmental',
  CASH_FLOW: 'cash_flow',
  MASTER: 'master',
} as const;

export type BudgetType = typeof BUDGET_TYPES[keyof typeof BUDGET_TYPES];

export const BUDGET_TYPE_LABELS: Record<BudgetType, string> = {
  [BUDGET_TYPES.OPERATING]: 'Operating Budget',
  [BUDGET_TYPES.CAPITAL]: 'Capital Budget',
  [BUDGET_TYPES.PROJECT]: 'Project Budget',
  [BUDGET_TYPES.DEPARTMENTAL]: 'Departmental Budget',
  [BUDGET_TYPES.CASH_FLOW]: 'Cash Flow Budget',
  [BUDGET_TYPES.MASTER]: 'Master Budget',
};

export const BUDGET_TYPE_DESCRIPTIONS: Record<BudgetType, string> = {
  [BUDGET_TYPES.OPERATING]: 'Day-to-day operational expenses and revenues',
  [BUDGET_TYPES.CAPITAL]: 'Long-term asset investments and major purchases',
  [BUDGET_TYPES.PROJECT]: 'Budget allocated for specific projects',
  [BUDGET_TYPES.DEPARTMENTAL]: 'Department-specific budget allocation',
  [BUDGET_TYPES.CASH_FLOW]: 'Expected cash inflows and outflows',
  [BUDGET_TYPES.MASTER]: 'Consolidated budget for entire organization',
};

// ----------------------------------------------------------------------------
// BUDGET STATUS
// ----------------------------------------------------------------------------

export const BUDGET_STATUSES = {
  DRAFT: 'draft',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  ACTIVE: 'active',
  REVISED: 'revised',
  CLOSED: 'closed',
  REJECTED: 'rejected',
} as const;

export type BudgetStatus = typeof BUDGET_STATUSES[keyof typeof BUDGET_STATUSES];

export const BUDGET_STATUS_LABELS: Record<BudgetStatus, string> = {
  [BUDGET_STATUSES.DRAFT]: 'Draft',
  [BUDGET_STATUSES.PENDING_APPROVAL]: 'Pending Approval',
  [BUDGET_STATUSES.APPROVED]: 'Approved',
  [BUDGET_STATUSES.ACTIVE]: 'Active',
  [BUDGET_STATUSES.REVISED]: 'Revised',
  [BUDGET_STATUSES.CLOSED]: 'Closed',
  [BUDGET_STATUSES.REJECTED]: 'Rejected',
};

export const BUDGET_STATUS_COLORS: Record<BudgetStatus, string> = {
  [BUDGET_STATUSES.DRAFT]: '#9E9E9E',
  [BUDGET_STATUSES.PENDING_APPROVAL]: '#FF9800',
  [BUDGET_STATUSES.APPROVED]: '#2196F3',
  [BUDGET_STATUSES.ACTIVE]: '#4CAF50',
  [BUDGET_STATUSES.REVISED]: '#9C27B0',
  [BUDGET_STATUSES.CLOSED]: '#607D8B',
  [BUDGET_STATUSES.REJECTED]: '#F44336',
};

// ----------------------------------------------------------------------------
// BUDGET PERIOD
// ----------------------------------------------------------------------------

export const BUDGET_PERIODS = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  SEMI_ANNUAL: 'semi_annual',
  ANNUAL: 'annual',
} as const;

export type BudgetPeriod = typeof BUDGET_PERIODS[keyof typeof BUDGET_PERIODS];

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriod, string> = {
  [BUDGET_PERIODS.MONTHLY]: 'Monthly',
  [BUDGET_PERIODS.QUARTERLY]: 'Quarterly',
  [BUDGET_PERIODS.SEMI_ANNUAL]: 'Semi-Annual',
  [BUDGET_PERIODS.ANNUAL]: 'Annual',
};

export const BUDGET_PERIOD_MONTHS: Record<BudgetPeriod, number> = {
  [BUDGET_PERIODS.MONTHLY]: 1,
  [BUDGET_PERIODS.QUARTERLY]: 3,
  [BUDGET_PERIODS.SEMI_ANNUAL]: 6,
  [BUDGET_PERIODS.ANNUAL]: 12,
};

// ----------------------------------------------------------------------------
// VARIANCE THRESHOLDS
// ----------------------------------------------------------------------------

export const VARIANCE_THRESHOLDS = {
  FAVORABLE: 0,           // On or under budget
  MINOR: 5,               // 1-5% over budget
  MODERATE: 10,           // 5-10% over budget
  SIGNIFICANT: 20,        // 10-20% over budget
  CRITICAL: Infinity,     // 20%+ over budget
} as const;

export const VARIANCE_THRESHOLD_LABELS: Record<string, string> = {
  favorable: 'Favorable',
  minor: 'Minor Variance',
  moderate: 'Moderate Variance',
  significant: 'Significant Variance',
  critical: 'Critical Variance',
};

export const VARIANCE_THRESHOLD_COLORS: Record<string, string> = {
  favorable: '#4CAF50',
  minor: '#8BC34A',
  moderate: '#FF9800',
  significant: '#FF5722',
  critical: '#F44336',
};

// ----------------------------------------------------------------------------
// ALLOCATION METHODS
// ----------------------------------------------------------------------------

export const ALLOCATION_METHODS = {
  EQUAL: 'equal',              // Equal across all periods
  SEASONAL: 'seasonal',        // Based on seasonal patterns
  HISTORICAL: 'historical',    // Based on historical data
  CUSTOM: 'custom',            // Manual allocation
  FRONT_LOADED: 'front_loaded', // Higher in earlier periods
  BACK_LOADED: 'back_loaded',   // Higher in later periods
} as const;

export type AllocationMethod = typeof ALLOCATION_METHODS[keyof typeof ALLOCATION_METHODS];

export const ALLOCATION_METHOD_LABELS: Record<AllocationMethod, string> = {
  [ALLOCATION_METHODS.EQUAL]: 'Equal Distribution',
  [ALLOCATION_METHODS.SEASONAL]: 'Seasonal Pattern',
  [ALLOCATION_METHODS.HISTORICAL]: 'Historical Basis',
  [ALLOCATION_METHODS.CUSTOM]: 'Custom Allocation',
  [ALLOCATION_METHODS.FRONT_LOADED]: 'Front-Loaded',
  [ALLOCATION_METHODS.BACK_LOADED]: 'Back-Loaded',
};

// ----------------------------------------------------------------------------
// APPROVAL THRESHOLDS (UGX)
// ----------------------------------------------------------------------------

export const BUDGET_APPROVAL_THRESHOLDS = {
  DEPARTMENT_HEAD: 10_000_000,       // Up to 10M UGX
  FINANCE_MANAGER: 50_000_000,       // Up to 50M UGX
  CFO: 200_000_000,                  // Up to 200M UGX
  CEO: 500_000_000,                  // Up to 500M UGX
  BOARD: Infinity,                   // Above 500M UGX
} as const;

export const APPROVAL_LEVEL_LABELS: Record<string, string> = {
  department_head: 'Department Head',
  finance_manager: 'Finance Manager',
  cfo: 'Chief Financial Officer',
  ceo: 'Chief Executive Officer',
  board: 'Board of Directors',
};

// ----------------------------------------------------------------------------
// FISCAL MONTHS (Uganda: July - June)
// ----------------------------------------------------------------------------

export const FISCAL_MONTHS = [
  { month: 7, name: 'July', fiscalMonth: 1, quarter: 1 },
  { month: 8, name: 'August', fiscalMonth: 2, quarter: 1 },
  { month: 9, name: 'September', fiscalMonth: 3, quarter: 1 },
  { month: 10, name: 'October', fiscalMonth: 4, quarter: 2 },
  { month: 11, name: 'November', fiscalMonth: 5, quarter: 2 },
  { month: 12, name: 'December', fiscalMonth: 6, quarter: 2 },
  { month: 1, name: 'January', fiscalMonth: 7, quarter: 3 },
  { month: 2, name: 'February', fiscalMonth: 8, quarter: 3 },
  { month: 3, name: 'March', fiscalMonth: 9, quarter: 3 },
  { month: 4, name: 'April', fiscalMonth: 10, quarter: 4 },
  { month: 5, name: 'May', fiscalMonth: 11, quarter: 4 },
  { month: 6, name: 'June', fiscalMonth: 12, quarter: 4 },
] as const;

export const getFiscalMonth = (date: Date): number => {
  const month = date.getMonth() + 1;
  return month >= 7 ? month - 6 : month + 6;
};

export const getFiscalQuarter = (fiscalMonth: number): number => {
  return Math.ceil(fiscalMonth / 3);
};

export const getFiscalYear = (date: Date): number => {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return month >= 7 ? year + 1 : year;
};

// ----------------------------------------------------------------------------
// FIRESTORE COLLECTIONS
// ----------------------------------------------------------------------------

export const BUDGETS_COLLECTION = 'budgets';
export const BUDGET_LINES_COLLECTION = 'budgetLines';
export const BUDGET_REVISIONS_COLLECTION = 'budgetRevisions';
export const BUDGET_APPROVALS_COLLECTION = 'budgetApprovals';
