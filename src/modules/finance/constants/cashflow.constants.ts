// ============================================================================
// CASH FLOW CONSTANTS
// DawinOS v2.0 - Financial Management Module
// Constants for Cash Flow Analysis
// ============================================================================

// ----------------------------------------------------------------------------
// CASH FLOW CATEGORIES
// ----------------------------------------------------------------------------

export const CASH_FLOW_CATEGORIES = {
  // Inflows
  SALES_RECEIPTS: 'sales_receipts',
  ACCOUNTS_RECEIVABLE: 'accounts_receivable',
  LOAN_PROCEEDS: 'loan_proceeds',
  INVESTMENT_INCOME: 'investment_income',
  GRANT_FUNDING: 'grant_funding',
  OTHER_INCOME: 'other_income',
  
  // Outflows
  SUPPLIER_PAYMENTS: 'supplier_payments',
  SALARY_WAGES: 'salary_wages',
  RENT_UTILITIES: 'rent_utilities',
  TAX_PAYMENTS: 'tax_payments',
  LOAN_REPAYMENTS: 'loan_repayments',
  CAPITAL_EXPENDITURE: 'capital_expenditure',
  OTHER_EXPENSES: 'other_expenses',
} as const;

export type CashFlowCategory = typeof CASH_FLOW_CATEGORIES[keyof typeof CASH_FLOW_CATEGORIES];

export const CASH_FLOW_CATEGORY_LABELS: Record<CashFlowCategory, string> = {
  [CASH_FLOW_CATEGORIES.SALES_RECEIPTS]: 'Sales Receipts',
  [CASH_FLOW_CATEGORIES.ACCOUNTS_RECEIVABLE]: 'Accounts Receivable Collections',
  [CASH_FLOW_CATEGORIES.LOAN_PROCEEDS]: 'Loan Proceeds',
  [CASH_FLOW_CATEGORIES.INVESTMENT_INCOME]: 'Investment Income',
  [CASH_FLOW_CATEGORIES.GRANT_FUNDING]: 'Grant Funding',
  [CASH_FLOW_CATEGORIES.OTHER_INCOME]: 'Other Income',
  [CASH_FLOW_CATEGORIES.SUPPLIER_PAYMENTS]: 'Supplier Payments',
  [CASH_FLOW_CATEGORIES.SALARY_WAGES]: 'Salaries & Wages',
  [CASH_FLOW_CATEGORIES.RENT_UTILITIES]: 'Rent & Utilities',
  [CASH_FLOW_CATEGORIES.TAX_PAYMENTS]: 'Tax Payments',
  [CASH_FLOW_CATEGORIES.LOAN_REPAYMENTS]: 'Loan Repayments',
  [CASH_FLOW_CATEGORIES.CAPITAL_EXPENDITURE]: 'Capital Expenditure',
  [CASH_FLOW_CATEGORIES.OTHER_EXPENSES]: 'Other Expenses',
};

export const CASH_INFLOW_CATEGORIES: CashFlowCategory[] = [
  CASH_FLOW_CATEGORIES.SALES_RECEIPTS,
  CASH_FLOW_CATEGORIES.ACCOUNTS_RECEIVABLE,
  CASH_FLOW_CATEGORIES.LOAN_PROCEEDS,
  CASH_FLOW_CATEGORIES.INVESTMENT_INCOME,
  CASH_FLOW_CATEGORIES.GRANT_FUNDING,
  CASH_FLOW_CATEGORIES.OTHER_INCOME,
];

export const CASH_OUTFLOW_CATEGORIES: CashFlowCategory[] = [
  CASH_FLOW_CATEGORIES.SUPPLIER_PAYMENTS,
  CASH_FLOW_CATEGORIES.SALARY_WAGES,
  CASH_FLOW_CATEGORIES.RENT_UTILITIES,
  CASH_FLOW_CATEGORIES.TAX_PAYMENTS,
  CASH_FLOW_CATEGORIES.LOAN_REPAYMENTS,
  CASH_FLOW_CATEGORIES.CAPITAL_EXPENDITURE,
  CASH_FLOW_CATEGORIES.OTHER_EXPENSES,
];

// ----------------------------------------------------------------------------
// CASH FLOW ACTIVITIES
// ----------------------------------------------------------------------------

export const CASH_FLOW_ACTIVITIES = {
  OPERATING: 'operating',
  INVESTING: 'investing',
  FINANCING: 'financing',
} as const;

export type CashFlowActivity = typeof CASH_FLOW_ACTIVITIES[keyof typeof CASH_FLOW_ACTIVITIES];

export const CASH_FLOW_ACTIVITY_LABELS: Record<CashFlowActivity, string> = {
  [CASH_FLOW_ACTIVITIES.OPERATING]: 'Operating Activities',
  [CASH_FLOW_ACTIVITIES.INVESTING]: 'Investing Activities',
  [CASH_FLOW_ACTIVITIES.FINANCING]: 'Financing Activities',
};

// Map categories to activities
export const CATEGORY_TO_ACTIVITY: Record<CashFlowCategory, CashFlowActivity> = {
  [CASH_FLOW_CATEGORIES.SALES_RECEIPTS]: CASH_FLOW_ACTIVITIES.OPERATING,
  [CASH_FLOW_CATEGORIES.ACCOUNTS_RECEIVABLE]: CASH_FLOW_ACTIVITIES.OPERATING,
  [CASH_FLOW_CATEGORIES.SUPPLIER_PAYMENTS]: CASH_FLOW_ACTIVITIES.OPERATING,
  [CASH_FLOW_CATEGORIES.SALARY_WAGES]: CASH_FLOW_ACTIVITIES.OPERATING,
  [CASH_FLOW_CATEGORIES.RENT_UTILITIES]: CASH_FLOW_ACTIVITIES.OPERATING,
  [CASH_FLOW_CATEGORIES.TAX_PAYMENTS]: CASH_FLOW_ACTIVITIES.OPERATING,
  [CASH_FLOW_CATEGORIES.OTHER_INCOME]: CASH_FLOW_ACTIVITIES.OPERATING,
  [CASH_FLOW_CATEGORIES.OTHER_EXPENSES]: CASH_FLOW_ACTIVITIES.OPERATING,
  
  [CASH_FLOW_CATEGORIES.INVESTMENT_INCOME]: CASH_FLOW_ACTIVITIES.INVESTING,
  [CASH_FLOW_CATEGORIES.CAPITAL_EXPENDITURE]: CASH_FLOW_ACTIVITIES.INVESTING,
  
  [CASH_FLOW_CATEGORIES.LOAN_PROCEEDS]: CASH_FLOW_ACTIVITIES.FINANCING,
  [CASH_FLOW_CATEGORIES.LOAN_REPAYMENTS]: CASH_FLOW_ACTIVITIES.FINANCING,
  [CASH_FLOW_CATEGORIES.GRANT_FUNDING]: CASH_FLOW_ACTIVITIES.FINANCING,
};

// ----------------------------------------------------------------------------
// FORECAST SETTINGS
// ----------------------------------------------------------------------------

export const FORECAST_HORIZONS = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
} as const;

export type ForecastHorizon = typeof FORECAST_HORIZONS[keyof typeof FORECAST_HORIZONS];

export const FORECAST_HORIZON_LABELS: Record<ForecastHorizon, string> = {
  [FORECAST_HORIZONS.WEEKLY]: 'Weekly (13 weeks)',
  [FORECAST_HORIZONS.MONTHLY]: 'Monthly (12 months)',
  [FORECAST_HORIZONS.QUARTERLY]: 'Quarterly (4 quarters)',
};

export const FORECAST_PERIODS: Record<ForecastHorizon, number> = {
  [FORECAST_HORIZONS.WEEKLY]: 13,
  [FORECAST_HORIZONS.MONTHLY]: 12,
  [FORECAST_HORIZONS.QUARTERLY]: 4,
};

// ----------------------------------------------------------------------------
// CASH POSITION THRESHOLDS
// ----------------------------------------------------------------------------

export const CASH_POSITION_THRESHOLDS = {
  // Minimum cash on hand (in days of operating expenses)
  CRITICAL: 7,   // Less than 7 days = critical
  WARNING: 14,   // Less than 14 days = warning
  HEALTHY: 30,   // 30+ days = healthy
  
  // Absolute minimums (UGX)
  MINIMUM_BALANCE: 5000000,    // 5M UGX minimum
  TARGET_BALANCE: 20000000,    // 20M UGX target
  EXCESS_THRESHOLD: 100000000, // 100M UGX = excess for investment
};

// ----------------------------------------------------------------------------
// BANK RECONCILIATION STATUS
// ----------------------------------------------------------------------------

export const RECONCILIATION_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VARIANCE: 'variance',
} as const;

export type ReconciliationStatus = typeof RECONCILIATION_STATUS[keyof typeof RECONCILIATION_STATUS];

export const RECONCILIATION_STATUS_LABELS: Record<ReconciliationStatus, string> = {
  [RECONCILIATION_STATUS.NOT_STARTED]: 'Not Started',
  [RECONCILIATION_STATUS.IN_PROGRESS]: 'In Progress',
  [RECONCILIATION_STATUS.COMPLETED]: 'Completed',
  [RECONCILIATION_STATUS.VARIANCE]: 'Has Variance',
};

// ----------------------------------------------------------------------------
// UGANDA PAYMENT METHODS
// ----------------------------------------------------------------------------

export const PAYMENT_METHODS = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  CHEQUE: 'cheque',
  MTN_MOMO: 'mtn_momo',
  AIRTEL_MONEY: 'airtel_money',
  VISA: 'visa',
  MASTERCARD: 'mastercard',
  RTGS: 'rtgs',
  EFT: 'eft',
} as const;

export type PaymentMethod = typeof PAYMENT_METHODS[keyof typeof PAYMENT_METHODS];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PAYMENT_METHODS.CASH]: 'Cash',
  [PAYMENT_METHODS.BANK_TRANSFER]: 'Bank Transfer',
  [PAYMENT_METHODS.CHEQUE]: 'Cheque',
  [PAYMENT_METHODS.MTN_MOMO]: 'MTN Mobile Money',
  [PAYMENT_METHODS.AIRTEL_MONEY]: 'Airtel Money',
  [PAYMENT_METHODS.VISA]: 'Visa Card',
  [PAYMENT_METHODS.MASTERCARD]: 'Mastercard',
  [PAYMENT_METHODS.RTGS]: 'RTGS Transfer',
  [PAYMENT_METHODS.EFT]: 'EFT Transfer',
};

// ----------------------------------------------------------------------------
// COLLECTIONS
// ----------------------------------------------------------------------------

export const CASH_TRANSACTIONS_COLLECTION = 'cash_transactions';
export const CASH_FORECASTS_COLLECTION = 'cash_forecasts';
export const BANK_RECONCILIATIONS_COLLECTION = 'bank_reconciliations';
