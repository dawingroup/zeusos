// ============================================================================
// INTEGRATION CONSTANTS
// DawinOS v2.0 - Financial Management Module
// Constants for QuickBooks Online and Admin Tools
// ============================================================================

import type {
  QBODataCategory,
  ReconciliationFrequency,
  ReconciliationType,
  ReconciliationTaskStatus,
  TaxPortalCategory,
  TaxPortalLink,
  FinanceDocumentCategory,
  FinanceDocumentStatus,
} from '../types/integrations.types';

// ============================================================================
// QUICKBOOKS ONLINE CONSTANTS
// ============================================================================

export const QBO_DATA_CATEGORIES: Record<QBODataCategory, string> = {
  profit_and_loss: 'Profit & Loss',
  balance_sheet: 'Balance Sheet',
  cash_flow: 'Cash Flow',
  accounts: 'Chart of Accounts',
  invoices: 'Invoices',
  bills: 'Bills',
  bank_transactions: 'Bank Transactions',
  customers: 'Customers',
  vendors: 'Vendors',
};

export const QBO_SYNC_INTERVALS = {
  REAL_TIME: 'real_time',
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MANUAL: 'manual',
} as const;

export const QBO_SYNC_INTERVAL_LABELS: Record<string, string> = {
  [QBO_SYNC_INTERVALS.REAL_TIME]: 'Real-time',
  [QBO_SYNC_INTERVALS.HOURLY]: 'Every Hour',
  [QBO_SYNC_INTERVALS.DAILY]: 'Daily',
  [QBO_SYNC_INTERVALS.WEEKLY]: 'Weekly',
  [QBO_SYNC_INTERVALS.MANUAL]: 'Manual Only',
};

export const QBO_API_BASE = 'https://quickbooks.api.intuit.com/v3/company';

// Firestore collection paths (under companies/{companyId})
export const QBO_COLLECTIONS = {
  SYNCED_DATA: 'qbo_synced_data',
  SYNC_JOBS: 'qbo_sync_jobs',
  ACCOUNTS: 'qbo_accounts',
  INVOICES: 'qbo_invoices',
  BILLS: 'qbo_bills',
  BANK_TRANSACTIONS: 'qbo_bank_transactions',
} as const;

// ============================================================================
// RECONCILIATION CONSTANTS
// ============================================================================

export const RECONCILIATION_FREQUENCIES: Record<ReconciliationFrequency, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

export const RECONCILIATION_FREQUENCY_DAYS: Record<ReconciliationFrequency, number> = {
  daily: 1,
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
  annually: 365,
};

export const RECONCILIATION_TYPES: Record<ReconciliationType, string> = {
  bank_reconciliation: 'Bank Reconciliation',
  petty_cash: 'Petty Cash',
  intercompany: 'Intercompany',
  vat_reconciliation: 'VAT Reconciliation',
  payroll_reconciliation: 'Payroll Reconciliation',
  inventory_reconciliation: 'Inventory Reconciliation',
  accounts_receivable: 'Accounts Receivable',
  accounts_payable: 'Accounts Payable',
  fixed_assets: 'Fixed Assets',
  custom: 'Custom',
};

export const RECONCILIATION_TYPE_ICONS: Record<ReconciliationType, string> = {
  bank_reconciliation: 'Landmark',
  petty_cash: 'Wallet',
  intercompany: 'Building2',
  vat_reconciliation: 'Receipt',
  payroll_reconciliation: 'Users',
  inventory_reconciliation: 'Package',
  accounts_receivable: 'ArrowDownLeft',
  accounts_payable: 'ArrowUpRight',
  fixed_assets: 'Truck',
  custom: 'Settings',
};

export const RECONCILIATION_TASK_STATUS_LABELS: Record<ReconciliationTaskStatus, string> = {
  upcoming: 'Upcoming',
  due: 'Due',
  overdue: 'Overdue',
  in_progress: 'In Progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

export const RECONCILIATION_TASK_STATUS_COLORS: Record<ReconciliationTaskStatus, string> = {
  upcoming: 'slate',
  due: 'blue',
  overdue: 'red',
  in_progress: 'amber',
  completed: 'green',
  skipped: 'gray',
};

export const RECONCILIATION_COLLECTIONS = {
  SCHEDULES: 'reconciliation_schedules',
  TASKS: 'reconciliation_tasks',
} as const;

// ============================================================================
// TAX PORTAL CONSTANTS (Uganda-focused)
// ============================================================================

export const TAX_PORTAL_CATEGORIES: Record<TaxPortalCategory, string> = {
  tax_authority: 'Tax Authority',
  social_security: 'Social Security',
  local_government: 'Local Government',
  regulatory: 'Regulatory',
  banking: 'Banking',
  custom: 'Custom',
};

export const TAX_PORTAL_CATEGORY_ICONS: Record<TaxPortalCategory, string> = {
  tax_authority: 'Landmark',
  social_security: 'Shield',
  local_government: 'Building',
  regulatory: 'Scale',
  banking: 'CreditCard',
  custom: 'Link',
};

export const DEFAULT_TAX_PORTAL_LINKS: TaxPortalLink[] = [
  // Tax Authority
  {
    id: 'ura-etax',
    name: 'URA eTax Portal',
    description: 'Uganda Revenue Authority - File VAT, Income Tax, WHT, PAYE returns',
    url: 'https://ura.go.ug/efris/',
    category: 'tax_authority',
    icon: 'Landmark',
    country: 'UG',
    isDefault: true,
    order: 1,
  },
  {
    id: 'ura-efris',
    name: 'URA EFRIS',
    description: 'Electronic Fiscal Receipting and Invoicing Solution',
    url: 'https://efris.ura.go.ug/',
    category: 'tax_authority',
    icon: 'Receipt',
    country: 'UG',
    isDefault: true,
    order: 2,
  },
  {
    id: 'ura-web-portal',
    name: 'URA Web Portal',
    description: 'General URA services, TIN verification, tax clearance certificates',
    url: 'https://ura.go.ug/',
    category: 'tax_authority',
    icon: 'Globe',
    country: 'UG',
    isDefault: true,
    order: 3,
  },
  // Social Security
  {
    id: 'nssf-portal',
    name: 'NSSF Online',
    description: 'National Social Security Fund - Member contributions and remittances',
    url: 'https://online.nssfug.org/',
    category: 'social_security',
    icon: 'Shield',
    country: 'UG',
    isDefault: true,
    order: 4,
  },
  // Local Government
  {
    id: 'kcca-lst',
    name: 'KCCA eLST Portal',
    description: 'Kampala Capital City Authority - Local Service Tax payments',
    url: 'https://payment.kcca.go.ug/',
    category: 'local_government',
    icon: 'Building',
    country: 'UG',
    isDefault: true,
    order: 5,
  },
  {
    id: 'kcca-trade-license',
    name: 'KCCA Trade License',
    description: 'Trading license renewal and applications',
    url: 'https://payment.kcca.go.ug/',
    category: 'local_government',
    icon: 'FileCheck',
    country: 'UG',
    isDefault: true,
    order: 6,
  },
  // Regulatory
  {
    id: 'ursb',
    name: 'URSB Online',
    description: 'Uganda Registration Services Bureau - Company filings and annual returns',
    url: 'https://ursb.go.ug/',
    category: 'regulatory',
    icon: 'FileText',
    country: 'UG',
    isDefault: true,
    order: 7,
  },
  {
    id: 'bou',
    name: 'Bank of Uganda',
    description: 'Exchange rates, monetary policy, banking regulations',
    url: 'https://www.bou.or.ug/',
    category: 'regulatory',
    icon: 'Landmark',
    country: 'UG',
    isDefault: true,
    order: 8,
  },
];

export const TAX_PORTAL_COLLECTIONS = {
  LINKS: 'tax_portal_links',
} as const;

// ============================================================================
// FINANCE DOCUMENT LIBRARY CONSTANTS
// ============================================================================

export const FINANCE_DOCUMENT_CATEGORIES: Record<FinanceDocumentCategory, string> = {
  invoice: 'Invoice',
  receipt: 'Receipt',
  bank_statement: 'Bank Statement',
  tax_filing: 'Tax Filing',
  contract: 'Contract',
  audit_report: 'Audit Report',
  budget_report: 'Budget Report',
  payroll_record: 'Payroll Record',
  insurance: 'Insurance',
  correspondence: 'Correspondence',
  other: 'Other',
};

export const FINANCE_DOCUMENT_CATEGORY_ICONS: Record<FinanceDocumentCategory, string> = {
  invoice: 'FileText',
  receipt: 'Receipt',
  bank_statement: 'Landmark',
  tax_filing: 'FileCheck',
  contract: 'FileSignature',
  audit_report: 'ClipboardCheck',
  budget_report: 'PieChart',
  payroll_record: 'Users',
  insurance: 'Shield',
  correspondence: 'Mail',
  other: 'File',
};

export const FINANCE_DOCUMENT_STATUSES: Record<FinanceDocumentStatus, string> = {
  draft: 'Draft',
  filed: 'Filed',
  archived: 'Archived',
  pending_review: 'Pending Review',
};

export const FINANCE_DOCUMENT_STATUS_COLORS: Record<FinanceDocumentStatus, string> = {
  draft: 'slate',
  filed: 'green',
  archived: 'gray',
  pending_review: 'amber',
};

export const FINANCE_DOCUMENT_COLLECTIONS = {
  DOCUMENTS: 'finance_documents',
} as const;

// Google Drive Picker API Config
export const GOOGLE_DRIVE_CONFIG = {
  SCOPES: ['https://www.googleapis.com/auth/drive.readonly'],
  MIME_TYPES: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.document',
  ],
  VIEW_ID: 'DOCS',
} as const;
