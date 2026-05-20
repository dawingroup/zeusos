// ============================================================================
// ACCOUNT CONSTANTS
// DawinOS v2.0 - Financial Management Module
// Chart of Accounts configuration for Uganda-compliant accounting
// ============================================================================

/**
 * Account Types following standard accounting principles
 * Aligned with Uganda Revenue Authority (URA) requirements
 */
export const ACCOUNT_TYPES = {
  ASSET: 'asset',
  LIABILITY: 'liability',
  EQUITY: 'equity',
  REVENUE: 'revenue',
  EXPENSE: 'expense',
} as const;

export type AccountType = typeof ACCOUNT_TYPES[keyof typeof ACCOUNT_TYPES];

/**
 * Account Sub-Types for detailed classification
 */
export const ACCOUNT_SUB_TYPES = {
  // Asset Sub-Types
  CURRENT_ASSET: 'current_asset',
  FIXED_ASSET: 'fixed_asset',
  INTANGIBLE_ASSET: 'intangible_asset',
  OTHER_ASSET: 'other_asset',
  
  // Liability Sub-Types
  CURRENT_LIABILITY: 'current_liability',
  LONG_TERM_LIABILITY: 'long_term_liability',
  OTHER_LIABILITY: 'other_liability',
  
  // Equity Sub-Types
  SHARE_CAPITAL: 'share_capital',
  RETAINED_EARNINGS: 'retained_earnings',
  RESERVES: 'reserves',
  
  // Revenue Sub-Types
  OPERATING_REVENUE: 'operating_revenue',
  NON_OPERATING_REVENUE: 'non_operating_revenue',
  OTHER_INCOME: 'other_income',
  
  // Expense Sub-Types
  COST_OF_SALES: 'cost_of_sales',
  OPERATING_EXPENSE: 'operating_expense',
  ADMINISTRATIVE_EXPENSE: 'administrative_expense',
  FINANCIAL_EXPENSE: 'financial_expense',
  OTHER_EXPENSE: 'other_expense',
} as const;

export type AccountSubType = typeof ACCOUNT_SUB_TYPES[keyof typeof ACCOUNT_SUB_TYPES];

/**
 * Mapping of account types to their valid sub-types
 */
export const ACCOUNT_TYPE_SUB_TYPES: Record<AccountType, AccountSubType[]> = {
  [ACCOUNT_TYPES.ASSET]: [
    ACCOUNT_SUB_TYPES.CURRENT_ASSET,
    ACCOUNT_SUB_TYPES.FIXED_ASSET,
    ACCOUNT_SUB_TYPES.INTANGIBLE_ASSET,
    ACCOUNT_SUB_TYPES.OTHER_ASSET,
  ],
  [ACCOUNT_TYPES.LIABILITY]: [
    ACCOUNT_SUB_TYPES.CURRENT_LIABILITY,
    ACCOUNT_SUB_TYPES.LONG_TERM_LIABILITY,
    ACCOUNT_SUB_TYPES.OTHER_LIABILITY,
  ],
  [ACCOUNT_TYPES.EQUITY]: [
    ACCOUNT_SUB_TYPES.SHARE_CAPITAL,
    ACCOUNT_SUB_TYPES.RETAINED_EARNINGS,
    ACCOUNT_SUB_TYPES.RESERVES,
  ],
  [ACCOUNT_TYPES.REVENUE]: [
    ACCOUNT_SUB_TYPES.OPERATING_REVENUE,
    ACCOUNT_SUB_TYPES.NON_OPERATING_REVENUE,
    ACCOUNT_SUB_TYPES.OTHER_INCOME,
  ],
  [ACCOUNT_TYPES.EXPENSE]: [
    ACCOUNT_SUB_TYPES.COST_OF_SALES,
    ACCOUNT_SUB_TYPES.OPERATING_EXPENSE,
    ACCOUNT_SUB_TYPES.ADMINISTRATIVE_EXPENSE,
    ACCOUNT_SUB_TYPES.FINANCIAL_EXPENSE,
    ACCOUNT_SUB_TYPES.OTHER_EXPENSE,
  ],
};

/**
 * Account Type Labels for UI display
 */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  [ACCOUNT_TYPES.ASSET]: 'Assets',
  [ACCOUNT_TYPES.LIABILITY]: 'Liabilities',
  [ACCOUNT_TYPES.EQUITY]: 'Equity',
  [ACCOUNT_TYPES.REVENUE]: 'Revenue',
  [ACCOUNT_TYPES.EXPENSE]: 'Expenses',
};

/**
 * Account Sub-Type Labels for UI display
 */
export const ACCOUNT_SUB_TYPE_LABELS: Record<AccountSubType, string> = {
  [ACCOUNT_SUB_TYPES.CURRENT_ASSET]: 'Current Assets',
  [ACCOUNT_SUB_TYPES.FIXED_ASSET]: 'Fixed Assets',
  [ACCOUNT_SUB_TYPES.INTANGIBLE_ASSET]: 'Intangible Assets',
  [ACCOUNT_SUB_TYPES.OTHER_ASSET]: 'Other Assets',
  [ACCOUNT_SUB_TYPES.CURRENT_LIABILITY]: 'Current Liabilities',
  [ACCOUNT_SUB_TYPES.LONG_TERM_LIABILITY]: 'Long-term Liabilities',
  [ACCOUNT_SUB_TYPES.OTHER_LIABILITY]: 'Other Liabilities',
  [ACCOUNT_SUB_TYPES.SHARE_CAPITAL]: 'Share Capital',
  [ACCOUNT_SUB_TYPES.RETAINED_EARNINGS]: 'Retained Earnings',
  [ACCOUNT_SUB_TYPES.RESERVES]: 'Reserves',
  [ACCOUNT_SUB_TYPES.OPERATING_REVENUE]: 'Operating Revenue',
  [ACCOUNT_SUB_TYPES.NON_OPERATING_REVENUE]: 'Non-Operating Revenue',
  [ACCOUNT_SUB_TYPES.OTHER_INCOME]: 'Other Income',
  [ACCOUNT_SUB_TYPES.COST_OF_SALES]: 'Cost of Sales',
  [ACCOUNT_SUB_TYPES.OPERATING_EXPENSE]: 'Operating Expenses',
  [ACCOUNT_SUB_TYPES.ADMINISTRATIVE_EXPENSE]: 'Administrative Expenses',
  [ACCOUNT_SUB_TYPES.FINANCIAL_EXPENSE]: 'Financial Expenses',
  [ACCOUNT_SUB_TYPES.OTHER_EXPENSE]: 'Other Expenses',
};

/**
 * Normal Balance for each account type
 * Debit = positive, Credit = negative
 */
export const NORMAL_BALANCE: Record<AccountType, 'debit' | 'credit'> = {
  [ACCOUNT_TYPES.ASSET]: 'debit',
  [ACCOUNT_TYPES.LIABILITY]: 'credit',
  [ACCOUNT_TYPES.EQUITY]: 'credit',
  [ACCOUNT_TYPES.REVENUE]: 'credit',
  [ACCOUNT_TYPES.EXPENSE]: 'debit',
};

/**
 * Account Status
 */
export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived',
} as const;

export type AccountStatus = typeof ACCOUNT_STATUS[keyof typeof ACCOUNT_STATUS];

/**
 * Account Code Ranges (Uganda Standard)
 * 6-digit account codes with hierarchical structure
 */
export const ACCOUNT_CODE_RANGES: Record<AccountType, { start: number; end: number }> = {
  [ACCOUNT_TYPES.ASSET]: { start: 100000, end: 199999 },
  [ACCOUNT_TYPES.LIABILITY]: { start: 200000, end: 299999 },
  [ACCOUNT_TYPES.EQUITY]: { start: 300000, end: 399999 },
  [ACCOUNT_TYPES.REVENUE]: { start: 400000, end: 499999 },
  [ACCOUNT_TYPES.EXPENSE]: { start: 500000, end: 699999 },
};

/**
 * Default account code structure:
 * X-XX-XXX
 * 1st digit: Account Type
 * 2nd-3rd digits: Sub-Type
 * 4th-6th digits: Specific Account
 */
export const ACCOUNT_CODE_FORMAT = {
  TYPE_DIGITS: 1,
  SUBTYPE_DIGITS: 2,
  ACCOUNT_DIGITS: 3,
  TOTAL_DIGITS: 6,
};

/**
 * Account Hierarchy Levels
 */
export const ACCOUNT_LEVELS = {
  ROOT: 0,
  TYPE: 1,
  SUBTYPE: 2,
  CATEGORY: 3,
  SUBCATEGORY: 4,
  DETAIL: 5,
} as const;

export type AccountLevel = typeof ACCOUNT_LEVELS[keyof typeof ACCOUNT_LEVELS];

export const ACCOUNT_LEVEL_LABELS: Record<AccountLevel, string> = {
  [ACCOUNT_LEVELS.ROOT]: 'Root',
  [ACCOUNT_LEVELS.TYPE]: 'Type',
  [ACCOUNT_LEVELS.SUBTYPE]: 'Sub-Type',
  [ACCOUNT_LEVELS.CATEGORY]: 'Category',
  [ACCOUNT_LEVELS.SUBCATEGORY]: 'Sub-Category',
  [ACCOUNT_LEVELS.DETAIL]: 'Detail',
};

/**
 * System Accounts - Required accounts for system operations
 */
export const SYSTEM_ACCOUNTS = {
  // Asset System Accounts
  CASH_ON_HAND: '110001',
  PETTY_CASH: '110002',
  BANK_UGX: '111001',
  BANK_USD: '111002',
  ACCOUNTS_RECEIVABLE: '120001',
  PREPAID_EXPENSES: '130001',
  INVENTORY: '140001',
  FIXED_ASSETS: '150001',
  ACCUMULATED_DEPRECIATION: '159001',
  
  // Liability System Accounts
  ACCOUNTS_PAYABLE: '210001',
  ACCRUED_EXPENSES: '220001',
  VAT_PAYABLE: '230001',
  PAYE_PAYABLE: '230002',
  NSSF_PAYABLE: '230003',
  LOANS_PAYABLE: '250001',
  
  // Equity System Accounts
  SHARE_CAPITAL: '310001',
  RETAINED_EARNINGS: '320001',
  CURRENT_YEAR_EARNINGS: '320002',
  
  // Revenue System Accounts
  SALES_REVENUE: '410001',
  SERVICE_REVENUE: '410002',
  INTEREST_INCOME: '420001',
  OTHER_INCOME: '430001',
  
  // Expense System Accounts
  COST_OF_GOODS_SOLD: '510001',
  SALARIES_EXPENSE: '520001',
  RENT_EXPENSE: '520002',
  UTILITIES_EXPENSE: '520003',
  DEPRECIATION_EXPENSE: '530001',
  BANK_CHARGES: '540001',
  INTEREST_EXPENSE: '540002',
} as const;

/**
 * Account Colors for UI
 */
export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  [ACCOUNT_TYPES.ASSET]: '#4CAF50',      // Green
  [ACCOUNT_TYPES.LIABILITY]: '#F44336',   // Red
  [ACCOUNT_TYPES.EQUITY]: '#9C27B0',      // Purple
  [ACCOUNT_TYPES.REVENUE]: '#2196F3',     // Blue
  [ACCOUNT_TYPES.EXPENSE]: '#FF9800',     // Orange
};

/**
 * Account Icons for UI
 */
export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  [ACCOUNT_TYPES.ASSET]: 'AccountBalance',
  [ACCOUNT_TYPES.LIABILITY]: 'CreditCard',
  [ACCOUNT_TYPES.EQUITY]: 'Business',
  [ACCOUNT_TYPES.REVENUE]: 'TrendingUp',
  [ACCOUNT_TYPES.EXPENSE]: 'TrendingDown',
};
