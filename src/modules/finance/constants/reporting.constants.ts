// ============================================================================
// REPORTING CONSTANTS
// DawinOS v2.0 - Financial Management Module
// Constants for Financial Reporting
// ============================================================================

// ----------------------------------------------------------------------------
// REPORT TYPES
// ----------------------------------------------------------------------------

export const REPORT_TYPES = {
  // Financial Statements
  INCOME_STATEMENT: 'income_statement',
  BALANCE_SHEET: 'balance_sheet',
  CASH_FLOW_STATEMENT: 'cash_flow_statement',
  TRIAL_BALANCE: 'trial_balance',
  GENERAL_LEDGER: 'general_ledger',
  
  // Management Reports
  BUDGET_VARIANCE: 'budget_variance',
  DEPARTMENTAL_PL: 'departmental_pl',
  PROJECT_PROFITABILITY: 'project_profitability',
  AGED_RECEIVABLES: 'aged_receivables',
  AGED_PAYABLES: 'aged_payables',
  
  // Tax Reports (Uganda-specific)
  VAT_RETURN: 'vat_return',
  WHT_REPORT: 'wht_report',
  PAYE_RETURN: 'paye_return',
  NSSF_RETURN: 'nssf_return',
  LST_RETURN: 'lst_return',
} as const;

export type ReportType = typeof REPORT_TYPES[keyof typeof REPORT_TYPES];

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  [REPORT_TYPES.INCOME_STATEMENT]: 'Income Statement',
  [REPORT_TYPES.BALANCE_SHEET]: 'Balance Sheet',
  [REPORT_TYPES.CASH_FLOW_STATEMENT]: 'Cash Flow Statement',
  [REPORT_TYPES.TRIAL_BALANCE]: 'Trial Balance',
  [REPORT_TYPES.GENERAL_LEDGER]: 'General Ledger',
  [REPORT_TYPES.BUDGET_VARIANCE]: 'Budget Variance Report',
  [REPORT_TYPES.DEPARTMENTAL_PL]: 'Departmental P&L',
  [REPORT_TYPES.PROJECT_PROFITABILITY]: 'Project Profitability',
  [REPORT_TYPES.AGED_RECEIVABLES]: 'Aged Receivables',
  [REPORT_TYPES.AGED_PAYABLES]: 'Aged Payables',
  [REPORT_TYPES.VAT_RETURN]: 'VAT Return',
  [REPORT_TYPES.WHT_REPORT]: 'Withholding Tax Report',
  [REPORT_TYPES.PAYE_RETURN]: 'PAYE Return',
  [REPORT_TYPES.NSSF_RETURN]: 'NSSF Return',
  [REPORT_TYPES.LST_RETURN]: 'Local Service Tax Return',
};

export const REPORT_CATEGORIES = {
  FINANCIAL_STATEMENTS: 'financial_statements',
  MANAGEMENT_REPORTS: 'management_reports',
  TAX_REPORTS: 'tax_reports',
} as const;

export type ReportCategory = typeof REPORT_CATEGORIES[keyof typeof REPORT_CATEGORIES];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  [REPORT_CATEGORIES.FINANCIAL_STATEMENTS]: 'Financial Statements',
  [REPORT_CATEGORIES.MANAGEMENT_REPORTS]: 'Management Reports',
  [REPORT_CATEGORIES.TAX_REPORTS]: 'Tax Reports (Uganda)',
};

export const REPORTS_BY_CATEGORY: Record<ReportCategory, ReportType[]> = {
  [REPORT_CATEGORIES.FINANCIAL_STATEMENTS]: [
    REPORT_TYPES.INCOME_STATEMENT,
    REPORT_TYPES.BALANCE_SHEET,
    REPORT_TYPES.CASH_FLOW_STATEMENT,
    REPORT_TYPES.TRIAL_BALANCE,
    REPORT_TYPES.GENERAL_LEDGER,
  ],
  [REPORT_CATEGORIES.MANAGEMENT_REPORTS]: [
    REPORT_TYPES.BUDGET_VARIANCE,
    REPORT_TYPES.DEPARTMENTAL_PL,
    REPORT_TYPES.PROJECT_PROFITABILITY,
    REPORT_TYPES.AGED_RECEIVABLES,
    REPORT_TYPES.AGED_PAYABLES,
  ],
  [REPORT_CATEGORIES.TAX_REPORTS]: [
    REPORT_TYPES.VAT_RETURN,
    REPORT_TYPES.WHT_REPORT,
    REPORT_TYPES.PAYE_RETURN,
    REPORT_TYPES.NSSF_RETURN,
    REPORT_TYPES.LST_RETURN,
  ],
};

// ----------------------------------------------------------------------------
// REPORT PERIODS
// ----------------------------------------------------------------------------

export const REPORT_PERIODS = {
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  SEMI_ANNUAL: 'semi_annual',
  ANNUAL: 'annual',
  YTD: 'ytd',
  CUSTOM: 'custom',
} as const;

export type ReportPeriod = typeof REPORT_PERIODS[keyof typeof REPORT_PERIODS];

export const REPORT_PERIOD_LABELS: Record<ReportPeriod, string> = {
  [REPORT_PERIODS.MONTHLY]: 'Monthly',
  [REPORT_PERIODS.QUARTERLY]: 'Quarterly',
  [REPORT_PERIODS.SEMI_ANNUAL]: 'Semi-Annual',
  [REPORT_PERIODS.ANNUAL]: 'Annual',
  [REPORT_PERIODS.YTD]: 'Year to Date',
  [REPORT_PERIODS.CUSTOM]: 'Custom Period',
};

// ----------------------------------------------------------------------------
// COMPARISON TYPES
// ----------------------------------------------------------------------------

export const COMPARISON_TYPES = {
  NONE: 'none',
  PRIOR_PERIOD: 'prior_period',
  PRIOR_YEAR: 'prior_year',
  BUDGET: 'budget',
  FORECAST: 'forecast',
} as const;

export type ComparisonType = typeof COMPARISON_TYPES[keyof typeof COMPARISON_TYPES];

export const COMPARISON_TYPE_LABELS: Record<ComparisonType, string> = {
  [COMPARISON_TYPES.NONE]: 'No Comparison',
  [COMPARISON_TYPES.PRIOR_PERIOD]: 'Prior Period',
  [COMPARISON_TYPES.PRIOR_YEAR]: 'Prior Year',
  [COMPARISON_TYPES.BUDGET]: 'Budget',
  [COMPARISON_TYPES.FORECAST]: 'Forecast',
};

// ----------------------------------------------------------------------------
// EXPORT FORMATS
// ----------------------------------------------------------------------------

export const EXPORT_FORMATS = {
  PDF: 'pdf',
  EXCEL: 'excel',
  CSV: 'csv',
} as const;

export type ExportFormat = typeof EXPORT_FORMATS[keyof typeof EXPORT_FORMATS];

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  [EXPORT_FORMATS.PDF]: 'PDF Document',
  [EXPORT_FORMATS.EXCEL]: 'Excel Spreadsheet',
  [EXPORT_FORMATS.CSV]: 'CSV File',
};

// ----------------------------------------------------------------------------
// REPORT STATUS
// ----------------------------------------------------------------------------

export const REPORT_STATUS = {
  DRAFT: 'draft',
  FINAL: 'final',
  ARCHIVED: 'archived',
} as const;

export type ReportStatus = typeof REPORT_STATUS[keyof typeof REPORT_STATUS];

// ----------------------------------------------------------------------------
// INCOME STATEMENT SECTIONS
// ----------------------------------------------------------------------------

export const INCOME_STATEMENT_SECTIONS = {
  REVENUE: {
    key: 'revenue',
    label: 'Revenue',
    accountTypes: ['revenue'],
    categories: ['operating_revenue', 'other_income'],
    sign: 1,
  },
  COST_OF_SALES: {
    key: 'cost_of_sales',
    label: 'Cost of Sales',
    accountTypes: ['expense'],
    categories: ['cost_of_goods_sold'],
    sign: -1,
  },
  GROSS_PROFIT: {
    key: 'gross_profit',
    label: 'Gross Profit',
    calculated: true,
    formula: 'revenue - cost_of_sales',
  },
  OPERATING_EXPENSES: {
    key: 'operating_expenses',
    label: 'Operating Expenses',
    accountTypes: ['expense'],
    categories: ['operating_expense', 'administrative_expense', 'selling_expense'],
    sign: -1,
  },
  OPERATING_PROFIT: {
    key: 'operating_profit',
    label: 'Operating Profit (EBIT)',
    calculated: true,
    formula: 'gross_profit - operating_expenses',
  },
  FINANCIAL_INCOME: {
    key: 'financial_income',
    label: 'Financial Income',
    accountTypes: ['revenue'],
    categories: ['interest_income', 'dividend_income'],
    sign: 1,
  },
  FINANCIAL_EXPENSES: {
    key: 'financial_expenses',
    label: 'Financial Expenses',
    accountTypes: ['expense'],
    categories: ['interest_expense', 'bank_charges'],
    sign: -1,
  },
  PROFIT_BEFORE_TAX: {
    key: 'profit_before_tax',
    label: 'Profit Before Tax',
    calculated: true,
    formula: 'operating_profit + financial_income - financial_expenses',
  },
  TAX_EXPENSE: {
    key: 'tax_expense',
    label: 'Income Tax Expense',
    accountTypes: ['expense'],
    categories: ['tax_expense'],
    sign: -1,
  },
  NET_PROFIT: {
    key: 'net_profit',
    label: 'Net Profit',
    calculated: true,
    formula: 'profit_before_tax - tax_expense',
  },
} as const;

// ----------------------------------------------------------------------------
// BALANCE SHEET SECTIONS
// ----------------------------------------------------------------------------

export const BALANCE_SHEET_SECTIONS = {
  // Assets
  CURRENT_ASSETS: {
    key: 'current_assets',
    label: 'Current Assets',
    accountTypes: ['asset'],
    categories: ['cash', 'bank', 'accounts_receivable', 'inventory', 'prepaid_expense', 'other_current_asset'],
    sign: 1,
  },
  NON_CURRENT_ASSETS: {
    key: 'non_current_assets',
    label: 'Non-Current Assets',
    accountTypes: ['asset'],
    categories: ['fixed_asset', 'intangible_asset', 'investment', 'other_non_current_asset'],
    sign: 1,
  },
  TOTAL_ASSETS: {
    key: 'total_assets',
    label: 'Total Assets',
    calculated: true,
    formula: 'current_assets + non_current_assets',
  },
  
  // Liabilities
  CURRENT_LIABILITIES: {
    key: 'current_liabilities',
    label: 'Current Liabilities',
    accountTypes: ['liability'],
    categories: ['accounts_payable', 'accrued_expense', 'short_term_loan', 'tax_payable', 'other_current_liability'],
    sign: 1,
  },
  NON_CURRENT_LIABILITIES: {
    key: 'non_current_liabilities',
    label: 'Non-Current Liabilities',
    accountTypes: ['liability'],
    categories: ['long_term_loan', 'deferred_tax', 'other_non_current_liability'],
    sign: 1,
  },
  TOTAL_LIABILITIES: {
    key: 'total_liabilities',
    label: 'Total Liabilities',
    calculated: true,
    formula: 'current_liabilities + non_current_liabilities',
  },
  
  // Equity
  SHARE_CAPITAL: {
    key: 'share_capital',
    label: 'Share Capital',
    accountTypes: ['equity'],
    categories: ['share_capital'],
    sign: 1,
  },
  RETAINED_EARNINGS: {
    key: 'retained_earnings',
    label: 'Retained Earnings',
    accountTypes: ['equity'],
    categories: ['retained_earnings'],
    sign: 1,
  },
  RESERVES: {
    key: 'reserves',
    label: 'Reserves',
    accountTypes: ['equity'],
    categories: ['reserve'],
    sign: 1,
  },
  TOTAL_EQUITY: {
    key: 'total_equity',
    label: 'Total Equity',
    calculated: true,
    formula: 'share_capital + retained_earnings + reserves',
  },
  TOTAL_LIABILITIES_EQUITY: {
    key: 'total_liabilities_equity',
    label: 'Total Liabilities & Equity',
    calculated: true,
    formula: 'total_liabilities + total_equity',
  },
} as const;

// ----------------------------------------------------------------------------
// CASH FLOW SECTIONS (Indirect Method)
// ----------------------------------------------------------------------------

export const CASH_FLOW_SECTIONS = {
  // Operating Activities
  NET_INCOME: {
    key: 'net_income',
    label: 'Net Income',
    source: 'income_statement',
  },
  DEPRECIATION: {
    key: 'depreciation',
    label: 'Add: Depreciation & Amortization',
    adjustmentType: 'add',
  },
  WORKING_CAPITAL_CHANGES: {
    key: 'working_capital_changes',
    label: 'Changes in Working Capital',
    items: ['receivables', 'inventory', 'payables', 'accruals'],
  },
  OPERATING_CASH_FLOW: {
    key: 'operating_cash_flow',
    label: 'Net Cash from Operating Activities',
    calculated: true,
  },
  
  // Investing Activities
  CAPITAL_EXPENDITURE: {
    key: 'capital_expenditure',
    label: 'Capital Expenditure',
    categories: ['fixed_asset'],
  },
  INVESTMENT_PROCEEDS: {
    key: 'investment_proceeds',
    label: 'Proceeds from Investments',
    categories: ['investment'],
  },
  INVESTING_CASH_FLOW: {
    key: 'investing_cash_flow',
    label: 'Net Cash from Investing Activities',
    calculated: true,
  },
  
  // Financing Activities
  LOAN_PROCEEDS: {
    key: 'loan_proceeds',
    label: 'Proceeds from Borrowings',
    categories: ['short_term_loan', 'long_term_loan'],
  },
  LOAN_REPAYMENTS: {
    key: 'loan_repayments',
    label: 'Loan Repayments',
    categories: ['short_term_loan', 'long_term_loan'],
  },
  DIVIDENDS_PAID: {
    key: 'dividends_paid',
    label: 'Dividends Paid',
    categories: ['dividend'],
  },
  FINANCING_CASH_FLOW: {
    key: 'financing_cash_flow',
    label: 'Net Cash from Financing Activities',
    calculated: true,
  },
  
  // Summary
  NET_CASH_CHANGE: {
    key: 'net_cash_change',
    label: 'Net Change in Cash',
    calculated: true,
    formula: 'operating_cash_flow + investing_cash_flow + financing_cash_flow',
  },
  OPENING_CASH: {
    key: 'opening_cash',
    label: 'Opening Cash Balance',
  },
  CLOSING_CASH: {
    key: 'closing_cash',
    label: 'Closing Cash Balance',
    calculated: true,
    formula: 'opening_cash + net_cash_change',
  },
} as const;

// ----------------------------------------------------------------------------
// TAX RATES (Uganda)
// ----------------------------------------------------------------------------

export const URA_TAX_CONFIG = {
  VAT: {
    STANDARD_RATE: 0.18, // 18%
    ZERO_RATE: 0,
    EXEMPT: null,
  },
  WHT: {
    SERVICES: 0.06, // 6%
    GOODS: 0.06, // 6%
    PROFESSIONAL: 0.15, // 15%
    COMMISSION: 0.10, // 10%
    RENT: 0.06, // 6%
  },
  CORPORATE_TAX: 0.30, // 30%
  NSSF: {
    EMPLOYEE: 0.05, // 5%
    EMPLOYER: 0.10, // 10%
  },
  LST: {
    THRESHOLD: 100000, // UGX per month
  },
} as const;

// ----------------------------------------------------------------------------
// REPORT SETTINGS
// ----------------------------------------------------------------------------

export const DEFAULT_REPORT_SETTINGS = {
  showZeroBalances: false,
  showAccountCodes: true,
  showSubtotals: true,
  decimalPlaces: 0, // UGX typically no decimals
  negativeFormat: 'parentheses' as const, // (1,000) vs -1,000
  dateFormat: 'DD MMM YYYY',
  numberFormat: '#,##0',
  currency: 'UGX',
};

// ----------------------------------------------------------------------------
// FIRESTORE COLLECTIONS
// ----------------------------------------------------------------------------

export const REPORTS_COLLECTION = 'financial_reports';
export const REPORT_TEMPLATES_COLLECTION = 'report_templates';

// ----------------------------------------------------------------------------
// FISCAL YEAR HELPER
// ----------------------------------------------------------------------------

export const getFiscalYear = (date: Date): number => {
  const month = date.getMonth();
  const year = date.getFullYear();
  // Uganda fiscal year runs July 1 to June 30
  // If month is July (6) or later, we're in the next fiscal year
  return month >= 6 ? year + 1 : year;
};

export const getFiscalYearDates = (fiscalYear: number): { start: Date; end: Date } => {
  return {
    start: new Date(fiscalYear - 1, 6, 1), // July 1 of previous year
    end: new Date(fiscalYear, 5, 30), // June 30 of fiscal year
  };
};
