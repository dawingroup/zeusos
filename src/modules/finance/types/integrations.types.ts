// ============================================================================
// INTEGRATION TYPES
// DawinOS v2.0 - Financial Management Module
// Types for QuickBooks Online and Admin Tools
// ============================================================================

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// QUICKBOOKS ONLINE TYPES
// ============================================================================

export type QBOSyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export type QBODataCategory =
  | 'profit_and_loss'
  | 'balance_sheet'
  | 'cash_flow'
  | 'accounts'
  | 'invoices'
  | 'bills'
  | 'bank_transactions'
  | 'customers'
  | 'vendors';

export interface QBOConnectionStatus {
  connected: boolean;
  realmId?: string;
  companyName?: string;
  refreshTokenValid?: boolean;
  connectedAt?: Timestamp;
  connectedBy?: string;
  lastSyncAt?: Timestamp;
  error?: string;
}

export interface QBOSyncJob {
  id: string;
  companyId: string;
  category: QBODataCategory;
  status: QBOSyncStatus;
  startedAt: Timestamp;
  completedAt?: Timestamp;
  recordCount?: number;
  error?: string;
  triggeredBy: string;
}

export interface QBOSyncHistory {
  jobs: QBOSyncJob[];
  lastFullSync?: Timestamp;
}

// --- QBO Financial Data ---

export interface QBOAccount {
  id: string;
  qboId: string;
  name: string;
  fullyQualifiedName: string;
  accountType: string;
  accountSubType: string;
  currentBalance: number;
  currencyRef: string;
  active: boolean;
  classification: 'Asset' | 'Equity' | 'Expense' | 'Liability' | 'Revenue';
  syncedAt: Timestamp;
}

export interface QBOReportRow {
  group?: string;
  label: string;
  value: number;
  subRows?: QBOReportRow[];
}

export interface QBOProfitAndLoss {
  id: string;
  companyId: string;
  startDate: string;
  endDate: string;
  currency: string;
  income: QBOReportRow[];
  costOfGoodsSold: QBOReportRow[];
  grossProfit: number;
  expenses: QBOReportRow[];
  netOperatingIncome: number;
  otherIncome: QBOReportRow[];
  otherExpenses: QBOReportRow[];
  netIncome: number;
  syncedAt: Timestamp;
}

export interface QBOBalanceSheet {
  id: string;
  companyId: string;
  asOfDate: string;
  currency: string;
  assets: QBOReportRow[];
  totalAssets: number;
  liabilities: QBOReportRow[];
  totalLiabilities: number;
  equity: QBOReportRow[];
  totalEquity: number;
  syncedAt: Timestamp;
}

export interface QBOInvoice {
  id: string;
  qboId: string;
  docNumber: string;
  customerName: string;
  customerId: string;
  txnDate: string;
  dueDate: string;
  totalAmt: number;
  balance: number;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'voided';
  lineItems: QBOInvoiceLineItem[];
  syncedAt: Timestamp;
}

export interface QBOInvoiceLineItem {
  description: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  accountRef?: string;
}

export interface QBOBill {
  id: string;
  qboId: string;
  docNumber: string;
  vendorName: string;
  vendorId: string;
  txnDate: string;
  dueDate: string;
  totalAmt: number;
  balance: number;
  currency: string;
  status: 'open' | 'paid' | 'overdue';
  syncedAt: Timestamp;
}

export interface QBOBankTransaction {
  id: string;
  qboId: string;
  txnDate: string;
  amount: number;
  accountRef: string;
  accountName: string;
  description: string;
  txnType: 'deposit' | 'expense' | 'transfer' | 'journal_entry';
  payee?: string;
  currency: string;
  syncedAt: Timestamp;
}

/**
 * Cash Flow Statement — flat named-field structure.
 * Each value = net cash impact: positive = cash in, negative = cash out.
 * ADD/LESS labels are fixed display conventions, not sign determinants.
 *
 * Operating CF = sum of all operating items
 * Free CF      = Operating CF + sum of investing items
 * Net CF       = Free CF + sum of financing items
 */
export interface QBOCashFlow {
  id?: string;
  companyId: string;
  startDate: string;
  endDate: string;
  currency: string;
  // ── Operating Activities ──────────────────────────────────────────────────
  revenue: number;                          // ADD
  costOfSales: number;                      // LESS
  expenses: number;                         // LESS
  otherIncome: number;                      // ADD
  cashTaxPaid: number;                      // LESS
  changeInAccountsPayable: number;          // ADD
  changeInOtherCurrentLiabilities: number;  // ADD
  changeInAccountsReceivable: number;       // LESS
  changeInInventory: number;                // LESS
  changeInWorkInProgress: number;           // LESS
  changeInOtherCurrentAssets: number;       // LESS
  operatingCashFlow: number;
  // ── Investing Activities ──────────────────────────────────────────────────
  changeInFixedAssets: number;              // LESS (ex. Depn & Amortisation)
  changeInIntangibleAssets: number;         // LESS
  changeInInvestments: number;              // LESS (Other Non-Current Assets)
  freeCashFlow: number;
  // ── Financing Activities ──────────────────────────────────────────────────
  netInterest: number;                      // LESS (after tax)
  changeInOtherNonCurrentLiabilities: number; // LESS
  dividends: number;                        // ADD
  changeInRetainedEarnings: number;         // ADD (and Other Equity)
  adjustments: number;                      // ADD
  netCashFlow: number;
  syncedAt: Timestamp;
}

// ============================================================================
// RECONCILIATION SCHEDULE TYPES
// ============================================================================

export type ReconciliationFrequency =
  | 'daily'
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'annually';

export type ReconciliationTaskStatus =
  | 'upcoming'
  | 'due'
  | 'overdue'
  | 'in_progress'
  | 'completed'
  | 'skipped';

export type ReconciliationType =
  | 'bank_reconciliation'
  | 'petty_cash'
  | 'intercompany'
  | 'vat_reconciliation'
  | 'payroll_reconciliation'
  | 'inventory_reconciliation'
  | 'accounts_receivable'
  | 'accounts_payable'
  | 'fixed_assets'
  | 'custom';

export interface ReconciliationSchedule {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  type: ReconciliationType;
  frequency: ReconciliationFrequency;
  assigneeId: string;
  assigneeName: string;
  bankAccountId?: string;
  bankAccountName?: string;
  nextDueDate: Timestamp;
  lastCompletedDate?: Timestamp;
  lastCompletedBy?: string;
  isActive: boolean;
  reminderDaysBefore: number;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

export interface ReconciliationScheduleInput {
  name: string;
  description?: string;
  type: ReconciliationType;
  frequency: ReconciliationFrequency;
  assigneeId: string;
  assigneeName: string;
  bankAccountId?: string;
  bankAccountName?: string;
  nextDueDate: Date;
  reminderDaysBefore?: number;
  notes?: string;
}

export interface ReconciliationTask {
  id: string;
  scheduleId: string;
  companyId: string;
  name: string;
  type: ReconciliationType;
  status: ReconciliationTaskStatus;
  dueDate: Timestamp;
  assigneeId: string;
  assigneeName: string;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  completedBy?: string;
  notes?: string;
  attachments?: string[];
  createdAt: Timestamp;
}

// ============================================================================
// TAX PORTAL TYPES
// ============================================================================

export interface TaxPortalLink {
  id: string;
  name: string;
  description: string;
  url: string;
  category: TaxPortalCategory;
  icon: string;
  country: string;
  isDefault: boolean;
  companyId?: string;
  order: number;
}

export type TaxPortalCategory =
  | 'tax_authority'
  | 'social_security'
  | 'local_government'
  | 'regulatory'
  | 'banking'
  | 'custom';

// ============================================================================
// FINANCE DOCUMENT LIBRARY TYPES
// ============================================================================

export type FinanceDocumentCategory =
  | 'invoice'
  | 'receipt'
  | 'bank_statement'
  | 'tax_filing'
  | 'contract'
  | 'audit_report'
  | 'budget_report'
  | 'payroll_record'
  | 'insurance'
  | 'correspondence'
  | 'other';

export type FinanceDocumentStatus =
  | 'draft'
  | 'filed'
  | 'archived'
  | 'pending_review';

export interface FinanceDocument {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  category: FinanceDocumentCategory;
  status: FinanceDocumentStatus;
  fileUrl: string;
  googleDriveFileId?: string;
  googleDriveUrl?: string;
  mimeType?: string;
  fileSize?: number;
  tags: string[];
  fiscalYear?: string;
  fiscalPeriod?: string;
  relatedEntityType?: 'invoice' | 'bill' | 'reconciliation' | 'tax_return' | 'budget';
  relatedEntityId?: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: Timestamp;
  reviewedBy?: string;
  reviewedAt?: Timestamp;
  archivedAt?: Timestamp;
  metadata?: Record<string, unknown>;
}

export interface FinanceDocumentInput {
  name: string;
  description?: string;
  category: FinanceDocumentCategory;
  fileUrl?: string;
  googleDriveFileId?: string;
  googleDriveUrl?: string;
  mimeType?: string;
  fileSize?: number;
  tags?: string[];
  fiscalYear?: string;
  fiscalPeriod?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export interface FinanceDocumentFilter {
  category?: FinanceDocumentCategory[];
  status?: FinanceDocumentStatus[];
  tags?: string[];
  fiscalYear?: string;
  search?: string;
  uploadedBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// ============================================================================
// GOOGLE DRIVE INTEGRATION TYPES
// ============================================================================

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink: string;
  webContentLink?: string;
  iconLink: string;
  thumbnailLink?: string;
  createdTime: string;
  modifiedTime: string;
  parents?: string[];
}

export interface GoogleDrivePickerResult {
  action: 'picked' | 'cancel';
  docs?: GoogleDriveFile[];
}
