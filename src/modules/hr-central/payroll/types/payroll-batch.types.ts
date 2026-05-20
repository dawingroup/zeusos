/**
 * Payroll Batch Types and Workflow States
 * DawinOS HR Central - Payroll Module
 * 
 * Comprehensive type definitions for payroll batch processing,
 * approval workflows, payment tracking, and payslip generation.
 */

// ============================================================================
// Batch Status Workflow
// ============================================================================

/**
 * Payroll batch status workflow
 * Flow: draft → calculating → calculated → hr_review → hr_approved → 
 *       finance_review → finance_approved → [ceo_review] → approved → 
 *       processing_payment → paid
 */
export type PayrollBatchStatus = 
  | 'draft'              // Initial creation, can add/remove employees
  | 'calculating'        // Batch calculation in progress
  | 'calculated'         // All calculations complete, ready for review
  | 'hr_review'          // Under HR review
  | 'hr_approved'        // HR approved, pending finance
  | 'finance_review'     // Under finance review
  | 'finance_approved'   // Finance approved, pending CEO (if required)
  | 'ceo_review'         // Under CEO review (for large amounts)
  | 'approved'           // Fully approved, ready for payment
  | 'processing_payment' // Payment processing in progress
  | 'paid'               // All payments completed
  | 'cancelled'          // Batch cancelled
  | 'reversed';          // Batch reversed (corrections needed)

/**
 * Valid status transitions map
 */
export const VALID_STATUS_TRANSITIONS: Record<PayrollBatchStatus, PayrollBatchStatus[]> = {
  draft: ['calculating', 'cancelled'],
  calculating: ['calculated', 'draft'],
  calculated: ['hr_review', 'draft'],
  hr_review: ['hr_approved', 'calculated', 'cancelled'],
  hr_approved: ['finance_review'],
  finance_review: ['finance_approved', 'hr_approved', 'cancelled'],
  finance_approved: ['ceo_review', 'approved'],
  ceo_review: ['approved', 'finance_approved', 'cancelled'],
  approved: ['processing_payment'],
  processing_payment: ['paid', 'approved'],
  paid: ['reversed'],
  cancelled: [],
  reversed: ['draft']
};

/**
 * Status display labels
 */
export const BATCH_STATUS_LABELS: Record<PayrollBatchStatus, string> = {
  draft: 'Draft',
  calculating: 'Calculating...',
  calculated: 'Calculated',
  hr_review: 'HR Review',
  hr_approved: 'HR Approved',
  finance_review: 'Finance Review',
  finance_approved: 'Finance Approved',
  ceo_review: 'CEO Review',
  approved: 'Approved',
  processing_payment: 'Processing Payment',
  paid: 'Paid',
  cancelled: 'Cancelled',
  reversed: 'Reversed'
};

/**
 * Status colors for UI
 */
export const BATCH_STATUS_COLORS: Record<PayrollBatchStatus, string> = {
  draft: 'gray',
  calculating: 'blue',
  calculated: 'indigo',
  hr_review: 'yellow',
  hr_approved: 'cyan',
  finance_review: 'orange',
  finance_approved: 'teal',
  ceo_review: 'purple',
  approved: 'green',
  processing_payment: 'blue',
  paid: 'green',
  cancelled: 'red',
  reversed: 'red'
};

// ============================================================================
// Approval Configuration
// ============================================================================

/**
 * Approval threshold configuration
 */
export interface ApprovalThresholds {
  hrApprovalRequired: boolean;
  financeApprovalRequired: boolean;
  ceoApprovalRequired: boolean;
  ceoThresholdAmount: number; // e.g., UGX 100,000,000
}

/**
 * Default CEO approval threshold (UGX 100 million)
 */
export const DEFAULT_CEO_THRESHOLD = 100_000_000;

/**
 * Approval action types
 */
export type ApprovalAction = 'approved' | 'rejected' | 'returned';

/**
 * Approval level
 */
export type ApprovalLevel = 'hr' | 'finance' | 'ceo';

/**
 * Approval record for audit trail
 */
export interface ApprovalRecord {
  id: string;
  level: ApprovalLevel;
  action: ApprovalAction;
  approverId: string;
  approverName: string;
  approverRole: string;
  timestamp: Date;
  comments?: string;
  previousStatus: PayrollBatchStatus;
  newStatus: PayrollBatchStatus;
}

// ============================================================================
// Payment Tracking
// ============================================================================

/**
 * Payment method types
 */
export type PaymentMethodType = 'bank_transfer' | 'mobile_money' | 'cash' | 'cheque';

/**
 * Payment batch status
 */
export type PaymentBatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

/**
 * Failed payment record
 */
export interface FailedPayment {
  employeeId: string;
  employeeName: string;
  amount: number;
  reason: string;
}

/**
 * Payment batch record
 */
export interface PaymentBatch {
  id: string;
  payrollBatchId: string;
  paymentMethod: PaymentMethodType;
  bankName?: string;
  mobileProvider?: string;
  totalAmount: number;
  employeeCount: number;
  status: PaymentBatchStatus;
  processedCount: number;
  failedCount: number;
  failedPayments?: FailedPayment[];
  reference?: string;
  processedAt?: Date;
  processedBy?: string;
  notes?: string;
}

// ============================================================================
// Status History
// ============================================================================

/**
 * Status change history entry
 */
export interface StatusHistoryEntry {
  status: PayrollBatchStatus;
  timestamp: Date;
  userId: string;
  userName: string;
  notes?: string;
}

// ============================================================================
// Batch Errors
// ============================================================================

/**
 * Batch calculation error
 */
export interface BatchCalculationError {
  employeeId: string;
  employeeName: string;
  error: string;
  timestamp: Date;
}

// ============================================================================
// Batch Documents
// ============================================================================

/**
 * Document types that can be attached to a batch
 */
export type BatchDocumentType = 
  | 'summary_report' 
  | 'bank_file' 
  | 'mobile_money_file' 
  | 'payslip_batch' 
  | 'ura_return' 
  | 'nssf_return';

/**
 * Batch document record
 */
export interface BatchDocument {
  id: string;
  type: BatchDocumentType;
  name: string;
  fileUrl: string;
  generatedAt: Date;
  generatedBy: string;
}

// ============================================================================
// Main Payroll Batch Entity
// ============================================================================

/**
 * Main payroll batch entity
 */
export interface PayrollBatch {
  id: string;
  batchNumber: string; // PAY-{SUBSIDIARY}-{YEAR}{MONTH}-{SEQ}
  subsidiaryId: string;
  subsidiaryName: string;

  // Optional link to the MonthlyPayrollRun that fanned this batch out.
  // Standalone batches created the old way have no monthlyRunId.
  monthlyRunId?: string;
  
  // Period information
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  
  // Scope
  departmentIds?: string[];
  employeeIds?: string[];
  includeAllActive: boolean;
  
  // Status
  status: PayrollBatchStatus;
  statusHistory: StatusHistoryEntry[];
  
  // Employee payrolls
  payrollIds: string[];
  employeeCount: number;
  calculatedCount: number;
  errorCount: number;
  errors?: BatchCalculationError[];
  
  // Totals (all in UGX)
  totalGross: number;
  totalTaxableIncome: number;
  totalPAYE: number;
  totalNSSFEmployee: number;
  totalNSSFEmployer: number;
  totalLST: number;
  totalOtherDeductions: number;
  totalDeductions: number;
  totalNetPay: number;
  
  // Approval tracking
  approvalThresholds: ApprovalThresholds;
  approvalRecords: ApprovalRecord[];
  currentApprover?: string;
  
  // Payment tracking
  paymentBatches: PaymentBatch[];
  paymentStatus: 'pending' | 'partial' | 'complete';
  paidAmount: number;
  pendingAmount: number;
  
  // Documents
  documents?: BatchDocument[];
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  notes?: string;
  version: number;
}

// ============================================================================
// Input DTOs
// ============================================================================

/**
 * Create batch input
 */
export interface CreatePayrollBatchInput {
  subsidiaryId: string;
  year: number;
  month: number;
  paymentDate: Date;
  departmentIds?: string[];
  employeeIds?: string[];
  includeAllActive?: boolean;
  notes?: string;
}

/**
 * Update batch input
 */
export interface UpdatePayrollBatchInput {
  paymentDate?: Date;
  departmentIds?: string[];
  employeeIds?: string[];
  includeAllActive?: boolean;
  notes?: string;
}

// ============================================================================
// Calculation Progress
// ============================================================================

/**
 * Batch calculation progress tracking
 */
export interface BatchCalculationProgress {
  batchId: string;
  total: number;
  completed: number;
  failed: number;
  currentEmployee?: string;
  status: 'idle' | 'calculating' | 'complete' | 'error';
  errors: Array<{ employeeId: string; employeeName: string; error: string }>;
  startedAt?: Date;
  estimatedCompletion?: Date;
}

// ============================================================================
// Payslip Data
// ============================================================================

/**
 * Payslip data for PDF/DOCX generation
 */
export interface PayslipData {
  // Company info
  companyName: string;
  companyAddress: string;
  companyLogo?: string;
  companyTIN: string;
  
  // Employee info
  employeeName: string;
  employeeNumber: string;
  department: string;
  position: string;
  nssfNumber?: string;
  tinNumber?: string;
  
  // Period
  payPeriod: string;
  paymentDate: string;
  
  // Earnings
  basicSalary: number;
  earnings: Array<{
    description: string;
    amount: number;
  }>;
  totalEarnings: number;
  
  // Deductions
  deductions: Array<{
    description: string;
    amount: number;
  }>;
  totalDeductions: number;
  
  // Net pay
  netPay: number;
  netPayWords: string;
  
  // YTD
  ytdGross: number;
  ytdPAYE: number;
  ytdNSSF: number;
  ytdNetPay: number;
  
  // Payment info
  paymentMethod: string;
  bankDetails?: string;
  
  // Reference
  payslipNumber: string;
  generatedAt: string;

  /** Cost allocation footnote — populated only when the employee works
   *  across multiple subsidiaries (snapshot from EmployeePayroll). Net
   *  pay above is the full amount payable; this just shows the
   *  internal cost split for transparency. See PAYROLL-ALLOCATIONS.md. */
  subsidiaryAllocations?: Array<{
    subsidiaryId: string;
    subsidiaryName: string;
    allocationPercent: number;
    isHost: boolean;
  }>;
}

// ============================================================================
// Filter and Sort Options
// ============================================================================

/**
 * Filter options for batch list
 */
export interface PayrollBatchFilters {
  subsidiaryId?: string;
  year?: number;
  month?: number;
  status?: PayrollBatchStatus[];
  createdBy?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
}

/**
 * Sort field options
 */
export type PayrollBatchSortField = 
  | 'batchNumber' 
  | 'createdAt' 
  | 'paymentDate' 
  | 'totalNetPay' 
  | 'status'
  | 'employeeCount';

/**
 * Sort options for batch list
 */
export interface PayrollBatchSort {
  field: PayrollBatchSortField;
  direction: 'asc' | 'desc';
}

// ============================================================================
// List Result
// ============================================================================

/**
 * Paginated batch list result
 */
export interface PayrollBatchListResult {
  batches: PayrollBatch[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Batch Summary
// ============================================================================

/**
 * Summary view of a batch for list display
 */
export interface PayrollBatchSummary {
  id: string;
  batchNumber: string;
  subsidiaryId: string;
  subsidiaryName: string;
  year: number;
  month: number;
  employeeCount: number;
  totalNetPay: number;
  status: PayrollBatchStatus;
  paymentStatus: 'pending' | 'partial' | 'complete';
  paymentDate: Date;
  createdAt: Date;
}

// ============================================================================
// Bank File Generation
// ============================================================================

/**
 * Bank file format types
 */
export type BankFileFormat = 'csv' | 'excel' | 'eft' | 'swift';

/**
 * Bank file entry
 */
export interface BankFileEntry {
  employeeNumber: string;
  employeeName: string;
  bankName: string;
  branchCode?: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  reference: string;
  narration?: string;
}

/**
 * Bank file generation options
 */
export interface BankFileOptions {
  format: BankFileFormat;
  bankName: string;
  valueDate: Date;
  reference: string;
  includeHeaders: boolean;
}

// ============================================================================
// Tax Return Data
// ============================================================================

/**
 * URA PAYE return data
 */
export interface URAReturnData {
  period: string; // YYYY-MM
  employerTIN: string;
  employerName: string;
  totalEmployees: number;
  totalGrossEmoluments: number;
  totalTaxablePay: number;
  totalPAYE: number;
  entries: Array<{
    employeeTIN: string;
    employeeName: string;
    grossPay: number;
    taxablePay: number;
    paye: number;
  }>;
}

/**
 * NSSF return data
 */
export interface NSSFReturnData {
  period: string; // YYYY-MM
  employerNumber: string;
  employerName: string;
  totalEmployees: number;
  totalWages: number;
  totalEmployeeContribution: number;
  totalEmployerContribution: number;
  totalContribution: number;
  entries: Array<{
    nssfNumber: string;
    employeeName: string;
    wages: number;
    employeeContribution: number;
    employerContribution: number;
  }>;
}
