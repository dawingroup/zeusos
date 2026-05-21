/**
 * Payroll Records Types
 * ZeusOS HR Central - Advances, Overtime, Attendance
 */

import { Timestamp } from 'firebase/firestore';

// ============================================================================
// Attendance Types
// ============================================================================

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'holiday' | 'weekend' | 'sick';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD format
  status: AttendanceStatus;
  checkInTime?: string; // HH:mm format
  checkOutTime?: string; // HH:mm format
  hoursWorked?: number;
  overtimeHours?: number;
  leaveType?: 'annual' | 'sick' | 'maternity' | 'paternity' | 'compassionate' | 'unpaid';
  notes?: string;
  approvedBy?: string;
  createdBy: string;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
}

export interface AttendanceSummary {
  employeeId: string;
  employeeName: string;
  period: string; // YYYY-MM format
  totalDays: number;
  workingDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  halfDays: number;
  leaveDays: number;
  sickDays: number;
  holidays: number;
  weekends: number;
  totalHoursWorked: number;
  totalOvertimeHours: number;
  attendancePercentage: number;
}

export interface CreateAttendanceInput {
  employeeId: string;
  date: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  leaveType?: AttendanceRecord['leaveType'];
  notes?: string;
}

export interface BulkAttendanceInput {
  date: string;
  records: Array<{
    employeeId: string;
    status: AttendanceStatus;
    checkInTime?: string;
    checkOutTime?: string;
    notes?: string;
  }>;
}

// ============================================================================
// Salary Advance Types
// ============================================================================

export type AdvanceStatus = 'pending' | 'approved' | 'disbursed' | 'partially_recovered' | 'fully_recovered' | 'rejected' | 'cancelled';

export interface SalaryAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  requestDate: Date | Timestamp;
  amount: number;
  reason: string;
  repaymentMonths: number; // Number of months to repay
  monthlyDeduction: number;
  status: AdvanceStatus;
  
  // Approval
  approvedBy?: string;
  approvedAt?: Date | Timestamp;
  rejectionReason?: string;
  
  // Disbursement
  disbursedBy?: string;
  disbursedAt?: Date | Timestamp;
  disbursementMethod?: 'bank_transfer' | 'mobile_money' | 'cash' | 'cheque';
  disbursementReference?: string;
  
  // Recovery tracking
  totalRecovered: number;
  balanceRemaining: number;
  recoveryStartMonth: string; // YYYY-MM format
  lastRecoveryMonth?: string;
  recoveryHistory: Array<{
    month: string;
    amount: number;
    payrollId?: string;
    date: Date | Timestamp;
  }>;
  
  // Audit
  createdBy: string;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  notes?: string;
}

export interface CreateAdvanceInput {
  employeeId: string;
  amount: number;
  reason: string;
  repaymentMonths: number;
  notes?: string;
  /** Optional backdated request date (YYYY-MM-DD). Defaults to today.
   *  Used when entering historical advances retrospectively. */
  requestDate?: string;
}

/** Patch shape for advanceService.update — all fields optional. */
export interface UpdateAdvanceInput {
  amount?: number;
  reason?: string;
  repaymentMonths?: number;
  notes?: string;
  requestDate?: string;          // YYYY-MM-DD
  disbursedAt?: string;          // YYYY-MM-DD — applies only if status is disbursed/partially_recovered
  disbursementMethod?: SalaryAdvance['disbursementMethod'];
  disbursementReference?: string;
  recoveryStartMonth?: string;   // YYYY-MM
}

export interface ApproveAdvanceInput {
  advanceId: string;
  approved: boolean;
  rejectionReason?: string;
}

export interface DisburseAdvanceInput {
  advanceId: string;
  disbursementMethod: SalaryAdvance['disbursementMethod'];
  disbursementReference?: string;
  recoveryStartMonth: string;
  /** Optional backdated disbursement date (YYYY-MM-DD). Defaults to
   *  today. Used for historical entries. */
  disbursedAt?: string;
}

// ============================================================================
// Other Deductions (recurring contributions + one-time disciplinary recoveries)
// ============================================================================

export type DeductionScheduleKind = 'one_time' | 'recurring' | 'installments';

export type OtherDeductionType =
  | 'food_contribution'
  | 'savings'
  | 'insurance'
  | 'union'
  | 'sacco'
  | 'pension'
  | 'property_damage'
  | 'lost_property'
  | 'overpayment'
  | 'fine'
  | 'other';

export type OtherDeductionStatus = 'pending' | 'active' | 'completed' | 'cancelled';

/**
 * A non-statutory, non-advance deduction applied to an employee's
 * payroll. Three schedule shapes are supported:
 *
 *   - one_time     : applies in `effectivePeriod` only (e.g. fine for
 *                    a single incident)
 *   - recurring    : applies every period from `startMonth` to
 *                    `endMonth` (or indefinitely if no endMonth)
 *                    — e.g. monthly food contribution
 *   - installments : applies until `balanceRemaining` reaches 0;
 *                    each period reduces the balance by
 *                    `installmentAmount`. Used for spreading large
 *                    one-off recoveries (e.g. damaged equipment).
 */
export interface EmployeeDeduction {
  id: string;
  employeeId: string;
  employeeName: string;

  type: OtherDeductionType;
  description: string;

  schedule: DeductionScheduleKind;

  // For one_time
  effectivePeriod?: string; // YYYY-MM

  // For recurring & installments
  startMonth?: string;      // YYYY-MM, default = effective period of first apply
  endMonth?: string;        // YYYY-MM, optional close

  // Amounts
  installmentAmount: number;            // monthly amount taken (one_time uses this as the full amount)
  totalAmount?: number;                 // installments only — full balance to recover
  totalRecovered?: number;              // installments only — accumulated
  balanceRemaining?: number;            // installments only — auto-derived
  recoveryHistory?: Array<{             // installments only — payment ledger keyed by payrollId for idempotency
    month: string;
    amount: number;
    payrollId?: string;
    date: Date | Timestamp;
  }>;

  status: OtherDeductionStatus;

  reason?: string;                      // free-text justification (incident ref, approval note, etc.)
  approvedBy?: string;
  approvedAt?: Date | Timestamp;

  createdBy: string;
  createdAt: Date | Timestamp;
  updatedBy?: string;
  updatedAt?: Date | Timestamp;
}

export interface CreateEmployeeDeductionInput {
  employeeId: string;
  type: OtherDeductionType;
  description: string;
  schedule: DeductionScheduleKind;
  effectivePeriod?: string;
  startMonth?: string;
  endMonth?: string;
  installmentAmount: number;
  totalAmount?: number;
  reason?: string;
}

export interface UpdateEmployeeDeductionInput {
  type?: OtherDeductionType;
  description?: string;
  schedule?: DeductionScheduleKind;
  effectivePeriod?: string;
  startMonth?: string;
  endMonth?: string | null;
  installmentAmount?: number;
  totalAmount?: number;
  reason?: string;
  status?: OtherDeductionStatus;
}

// ============================================================================
// Overtime Types (Extended from existing)
// ============================================================================

export type OvertimeType = 'regular' | 'weekend' | 'holiday' | 'night' | 'straight_time';
export type OvertimeStatus = 'pending' | 'approved' | 'processed' | 'rejected';

export interface OvertimeEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD format
  type: OvertimeType;
  hours: number;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  hourlyRate: number;
  multiplier: number; // 1.5x for regular, 2x for weekend/holiday
  amount: number;
  reason: string;
  status: OvertimeStatus;
  
  // Approval
  approvedBy?: string;
  approvedAt?: Date | Timestamp;
  rejectionReason?: string;
  
  // Payroll processing
  payrollPeriod?: string; // YYYY-MM
  processedAt?: Date | Timestamp;
  
  // Audit
  createdBy: string;
  createdAt: Date | Timestamp;
  updatedAt?: Date | Timestamp;
  notes?: string;
}

export interface CreateOvertimeInput {
  employeeId: string;
  date: string;
  type: OvertimeType;
  hours: number;
  startTime?: string;
  endTime?: string;
  reason: string;
  notes?: string;
}

export interface ApproveOvertimeInput {
  overtimeId: string;
  approved: boolean;
  rejectionReason?: string;
}

// ============================================================================
// Summary Types for Payroll Page
// ============================================================================

export interface PayrollPeriodSummary {
  period: string; // YYYY-MM
  
  // Attendance summary
  attendance: {
    totalEmployees: number;
    avgAttendanceRate: number;
    totalWorkingDays: number;
    totalAbsentDays: number;
    totalLeaveDays: number;
  };
  
  // Overtime summary
  overtime: {
    totalEntries: number;
    totalHours: number;
    totalAmount: number;
    pendingApproval: number;
  };
  
  // Advances summary
  advances: {
    activeAdvances: number;
    totalOutstanding: number;
    monthlyRecovery: number;
    newRequests: number;
  };
}

// ============================================================================
// Filter Types
// ============================================================================

export interface AttendanceFilters {
  employeeId?: string;
  departmentId?: string;
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus;
}

export interface AdvanceFilters {
  employeeId?: string;
  status?: AdvanceStatus;
  startDate?: string;
  endDate?: string;
}

export interface OvertimeFilters {
  employeeId?: string;
  status?: OvertimeStatus;
  type?: OvertimeType;
  startDate?: string;
  endDate?: string;
  payrollPeriod?: string;
}
