/**
 * Payroll Types and Interfaces
 * ZeusOS HR Central - Payroll Module
 * 
 * Comprehensive type definitions for payroll calculations,
 * tax breakdowns, earnings, deductions, and related entities.
 */

import { 
  PaymentFrequency, 
  AllowanceType, 
  PAYEBandId, 
  LSTBandId,
  PayrollStatus,
  DeductionCategory
} from '../constants/uganda-tax-constants';

// ============================================================================
// Earnings Types
// ============================================================================

/**
 * Earnings line item in payroll
 */
export interface EarningsItem {
  id: string;
  type: 'basic_salary' | 'allowance' | 'overtime' | 'bonus' | 'commission' | 'arrears' | 'other';
  category: AllowanceType | 'basic';
  description: string;
  amount: number;
  taxable: boolean;
  taxableAmount: number;
  nssfApplicable: boolean;
  nssfApplicableAmount: number;
  metadata?: {
    hours?: number; // For overtime
    rate?: number; // Hourly/daily rate or multiplier
    period?: string; // For arrears (e.g., "2024-09")
    reference?: string; // Reference number or document
  };
}

/**
 * Overtime record for payroll
 */
export interface OvertimeRecord {
  id: string;
  employeeId: string;
  date: Date;
  type: 'regular' | 'weekend' | 'holiday' | 'night' | 'straight_time';
  hours: number;
  hourlyRate: number;
  multiplier: number;
  amount: number;
  approvedBy: string;
  approvedAt: Date;
  payrollPeriodId?: string;
  status: 'pending' | 'approved' | 'processed' | 'rejected';
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

// ============================================================================
// Deduction Types
// ============================================================================

/**
 * Deduction line item in payroll
 */
export interface DeductionItem {
  id: string;
  type: 'paye' | 'nssf_employee' | 'lst' | 'pension' | 'loan' | 'advance' | 
        'savings' | 'insurance' | 'union' | 'sacco' | 'garnishment' | 
        'child_support' | 'maintenance' | 'overpayment' | 'damage' | 'other';
  category: DeductionCategory;
  description: string;
  amount: number;
  mandatory: boolean;
  reference?: string;
  metadata?: {
    installmentNumber?: number;
    totalInstallments?: number;
    balanceRemaining?: number;
    courtOrderNumber?: string;
    loanId?: string;
    advanceId?: string;
    deductionId?: string;
    scheduleKind?: 'one_time' | 'recurring' | 'installments';
  };
}

/**
 * Loan recovery schedule
 */
export interface LoanRecovery {
  id: string;
  employeeId: string;
  loanType: 'salary_advance' | 'staff_loan' | 'emergency_loan' | 'education_loan' | 'other';
  principalAmount: number;
  interestRate: number; // Annual percentage
  totalAmount: number;
  monthlyDeduction: number;
  startDate: Date;
  endDate: Date;
  installments: number;
  paidInstallments: number;
  balanceRemaining: number;
  status: 'active' | 'completed' | 'suspended' | 'written_off';
  approvedBy: string;
  approvedAt: Date;
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
  recoveryHistory?: Array<{
    month: string;
    amount: number;
    payrollId?: string;
    date: Date;
  }>;
}

// ============================================================================
// Tax Breakdown Types
// ============================================================================

/**
 * PAYE calculation breakdown
 */
export interface PAYEBreakdown {
  grossTaxableIncome: number;
  taxableBands: Array<{
    bandId: PAYEBandId;
    bandLabel: string;
    incomeInBand: number;
    rate: number;
    taxAmount: number;
  }>;
  totalPAYE: number;
  effectiveRate: number;
  taxReliefs?: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
  netPAYE: number;
}

/**
 * NSSF calculation breakdown
 */
export interface NSSFBreakdown {
  nssfApplicableGross: number;
  contributionBase: number; // Capped at maximum if applicable
  employeeContribution: number;
  employerContribution: number;
  totalContribution: number;
  cappedAtMaximum: boolean;
  exemptionReason?: string;
  notes?: string;
}

/**
 * LST calculation breakdown
 */
export interface LSTBreakdown {
  projectedAnnualIncome: number;
  applicableBand: LSTBandId;
  bandLabel: string;
  annualLST: number;
  monthlyLST: number;
  yearToDatePaid: number;
  remainingForYear: number;
}

// ============================================================================
// Proration and Adjustments
// ============================================================================

/**
 * Proration details for partial months
 */
export interface ProrationDetails {
  isProrated: boolean;
  reason: 'joining' | 'exit' | 'unpaid_leave' | 'suspension' | 'partial_month' | 'none';
  totalDays: number;
  workedDays: number;
  prorationFactor: number;
  effectiveFrom?: Date;
  effectiveTo?: Date;
  unpaidDays?: number;
  notes?: string;
}

/**
 * Salary revision for retroactive calculations
 */
export interface SalaryRevision {
  id: string;
  employeeId: string;
  effectiveDate: Date;
  previousBasicSalary: number;
  newBasicSalary: number;
  previousAllowances: Array<{ type: AllowanceType; amount: number }>;
  newAllowances: Array<{ type: AllowanceType; amount: number }>;
  retroactiveMonths: number;
  retroactiveAmount: number;
  reason: string;
  approvedBy: string;
  approvedAt: Date;
  appliedToPayrollPeriod?: string;
  status: 'pending' | 'applied' | 'cancelled';
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Payroll adjustment entry
 */
export interface PayrollAdjustment {
  id: string;
  type: 'addition' | 'deduction';
  category: 'correction' | 'bonus' | 'penalty' | 'reimbursement' | 'other';
  reason: string;
  amount: number;
  taxable: boolean;
  approvedBy: string;
  approvedAt: Date;
  reference?: string;
}

// ============================================================================
// Year-to-Date Tracking
// ============================================================================

/**
 * Year-to-date totals for an employee
 */
export interface YearToDateTotals {
  taxYear: string; // e.g., '2024-2025'
  fiscalYearStart: Date;
  fiscalYearEnd: Date;
  
  // Earnings YTD
  grossEarnings: number;
  basicSalary: number;
  allowances: number;
  overtime: number;
  bonuses: number;
  commissions: number;
  otherEarnings: number;
  taxableEarnings: number;
  nssfApplicableEarnings: number;
  
  // Deductions YTD
  totalDeductions: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  lst: number;
  voluntaryDeductions: number;
  loanRecoveries: number;
  otherDeductions: number;
  
  // Net totals
  netPay: number;
  
  // Period tracking
  periodsProcessed: number;
  lastProcessedPeriod: string; // e.g., '2024-11'
}

// ============================================================================
// Payroll Period and Batch
// ============================================================================

/**
 * Payroll period definition
 */
export interface PayrollPeriod {
  id: string;
  subsidiaryId: string;
  year: number;
  month: number; // 1-12
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  paymentFrequency: PaymentFrequency;
  status: PayrollStatus;
  
  // Summary totals
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNetPay: number;
  totalPAYE: number;
  totalNSSFEmployee: number;
  totalNSSFEmployer: number;
  totalLST: number;
  
  // Processing metadata
  processedBy?: string;
  processedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  paidBy?: string;
  paidAt?: Date;
  
  // Audit
  createdBy: string;
  createdAt: Date;
  updatedBy?: string;
  updatedAt?: Date;
  notes?: string;
}

// ============================================================================
// Employee Payroll Record
// ============================================================================

/**
 * Individual employee payroll record
 */
export interface EmployeePayroll {
  id: string;
  payrollPeriodId: string;
  /** Host subsidiary — the legal employer that runs payroll, withholds
   *  PAYE / NSSF / LST under its TIN, and pays the employee. For split
   *  employees, the host is the employer of record; recharges to other
   *  subsidiaries are accounting-only cost allocations (Model A). */
  subsidiaryId: string;
  /** Snapshot of the employee's subsidiary allocations at calc time.
   *  Used by batch-scoped reads to derive each subsidiary's cost share
   *  without re-reading the live employee record (which may change
   *  between months and would silently rewrite history). Absent or
   *  empty means 100% on subsidiaryId (no split). */
  subsidiaryAllocations?: Array<{ subsidiaryId: string; allocationPercent: number }>;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentId: string;
  departmentName: string;
  position: string;
  contractId?: string;
  
  // Period details
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  paymentFrequency: PaymentFrequency;
  
  // Payment details
  paymentMethod: 'bank_transfer' | 'mobile_money' | 'cash' | 'cheque';
  bankDetails?: {
    bankName: string;
    branchName?: string;
    accountNumber: string;
    accountName: string;
    swiftCode?: string;
  };
  mobileMoneyDetails?: {
    provider: 'mtn' | 'airtel';
    phoneNumber: string;
    registeredName: string;
  };
  
  // Proration
  proration: ProrationDetails;
  
  // Earnings
  basicSalary: number;
  earnings: EarningsItem[];
  totalEarnings: number;
  grossPay: number;
  
  // Tax calculations
  taxableIncome: number;
  payeBreakdown: PAYEBreakdown;
  nssfBreakdown: NSSFBreakdown;
  lstBreakdown: LSTBreakdown;
  
  // Deductions
  deductions: DeductionItem[];
  totalStatutoryDeductions: number;
  totalVoluntaryDeductions: number;
  totalDeductions: number;
  
  // Net pay
  netPay: number;
  
  // Year-to-date
  ytd: YearToDateTotals;
  
  // Status
  status: 'draft' | 'calculated' | 'reviewed' | 'approved' | 'paid' | 'reversed';
  
  // Adjustments & notes
  adjustments?: PayrollAdjustment[];
  notes?: string;
  
  // Audit
  calculatedBy: string;
  calculatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  
  // Metadata
  createdAt: Date;
  updatedAt?: Date;
  version: number;
}

// ============================================================================
// Input DTOs
// ============================================================================

/**
 * Input for calculating payroll
 */
export interface CalculatePayrollInput {
  employeeId: string;
  year: number;
  month: number;
  overrides?: {
    basicSalary?: number;
    additionalEarnings?: Array<{
      type: AllowanceType | string;
      description: string;
      amount: number;
      taxable?: boolean;
    }>;
    additionalDeductions?: Array<{
      type: string;
      description: string;
      amount: number;
    }>;
    prorationDays?: number;
    unpaidLeaveDays?: number;
  };
  recalculate?: boolean;
}

/**
 * Batch payroll processing input
 */
export interface ProcessPayrollBatchInput {
  subsidiaryId: string;
  departmentIds?: string[]; // Optional filter by departments
  employeeIds?: string[]; // Optional specific employees
  year: number;
  month: number;
  paymentDate: Date;
  notes?: string;
}

/**
 * Input for creating loan recovery
 */
export interface CreateLoanRecoveryInput {
  employeeId: string;
  loanType: LoanRecovery['loanType'];
  principalAmount: number;
  interestRate: number;
  monthlyDeduction: number;
  startDate: Date;
  notes?: string;
}

/**
 * Input for creating overtime record
 */
export interface CreateOvertimeInput {
  employeeId: string;
  date: Date;
  type: OvertimeRecord['type'];
  hours: number;
  notes?: string;
}

/**
 * Input for salary revision
 */
export interface CreateSalaryRevisionInput {
  employeeId: string;
  effectiveDate: Date;
  newBasicSalary: number;
  newAllowances?: Array<{ type: AllowanceType; amount: number }>;
  retroactiveMonths?: number;
  reason: string;
}

// ============================================================================
// Summary and Reporting Types
// ============================================================================

/**
 * Payroll summary for reporting
 */
export interface PayrollSummary {
  period: string;
  subsidiaryId: string;
  
  departmentBreakdown: Array<{
    departmentId: string;
    departmentName: string;
    employeeCount: number;
    totalGross: number;
    totalNet: number;
    totalPAYE: number;
    totalNSSF: number;
    totalLST: number;
  }>;
  
  totals: {
    employeeCount: number;
    totalGross: number;
    totalTaxableIncome: number;
    totalPAYE: number;
    totalNSSFEmployee: number;
    totalNSSFEmployer: number;
    totalLST: number;
    totalVoluntaryDeductions: number;
    totalNet: number;
  };
  
  paymentMethodBreakdown: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  
  bankBreakdown: Array<{
    bankName: string;
    count: number;
    amount: number;
  }>;
}

/**
 * Employee payroll summary (for list views)
 */
export interface EmployeePayrollSummary {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string;
  position: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: EmployeePayroll['status'];
  paymentMethod: EmployeePayroll['paymentMethod'];
}

/**
 * Tax remittance summary
 */
export interface TaxRemittanceSummary {
  period: string;
  subsidiaryId: string;
  
  paye: {
    totalAmount: number;
    employeeCount: number;
    dueDate: Date;
    reference?: string;
    status: 'pending' | 'submitted' | 'paid';
  };
  
  nssf: {
    employeeContribution: number;
    employerContribution: number;
    totalAmount: number;
    employeeCount: number;
    dueDate: Date;
    reference?: string;
    status: 'pending' | 'submitted' | 'paid';
  };
  
  lst: {
    totalAmount: number;
    employeeCount: number;
    dueDate: Date;
    reference?: string;
    status: 'pending' | 'submitted' | 'paid';
  };
}

/**
 * Payslip data structure
 */
export interface PayslipData {
  // Header
  companyName: string;
  companyAddress: string;
  companyLogo?: string;
  
  // Employee info
  employeeName: string;
  employeeNumber: string;
  department: string;
  position: string;
  bankDetails?: EmployeePayroll['bankDetails'];
  mobileMoneyDetails?: EmployeePayroll['mobileMoneyDetails'];
  
  // Period
  payPeriod: string;
  paymentDate: string;
  
  // Earnings
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
  netPayInWords: string;
  
  // YTD summary
  ytdGross: number;
  ytdPAYE: number;
  ytdNSSF: number;
  ytdNet: number;
  
  // Footer
  generatedAt: string;
  reference: string;
}

// ============================================================================
// Filter and Query Types
// ============================================================================

/**
 * Filters for querying payroll records
 */
export interface PayrollFilters {
  subsidiaryId?: string;
  departmentId?: string;
  employeeId?: string;
  year?: number;
  month?: number;
  status?: EmployeePayroll['status'];
  paymentMethod?: EmployeePayroll['paymentMethod'];
  minNetPay?: number;
  maxNetPay?: number;
}

/**
 * Sort options for payroll list
 */
export interface PayrollSort {
  field: 'employeeName' | 'employeeNumber' | 'departmentName' | 'grossPay' | 'netPay' | 'calculatedAt';
  direction: 'asc' | 'desc';
}

/**
 * Paginated payroll list result
 */
export interface PayrollListResult {
  items: EmployeePayrollSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
