/**
 * Monthly Payroll Run — parent doc that fans out to one PayrollBatch
 * per active subsidiary for a given month. Tracks aggregate totals
 * and lifecycle so HR/Finance can see and act on the whole month's
 * run in one place.
 */

import type { Timestamp } from 'firebase/firestore';
import type { PayrollBatchStatus } from './payroll-batch.types';

export type MonthlyPayrollRunStatus =
  | 'in_progress'         // sub-batches created, calculation in flight
  | 'all_calculated'      // every sub-batch has reached `calculated`
  | 'partially_approved'  // some sub-batches approved, others not yet
  | 'all_approved'        // every sub-batch reached `approved` (or beyond)
  | 'all_paid'            // every sub-batch reached `paid`
  | 'cancelled';

export const MONTHLY_RUN_STATUS_LABELS: Record<MonthlyPayrollRunStatus, string> = {
  in_progress: 'In Progress',
  all_calculated: 'All Calculated',
  partially_approved: 'Partially Approved',
  all_approved: 'All Approved',
  all_paid: 'All Paid',
  cancelled: 'Cancelled',
};

export const MONTHLY_RUN_STATUS_COLORS: Record<MonthlyPayrollRunStatus, string> = {
  in_progress: 'gray',
  all_calculated: 'blue',
  partially_approved: 'yellow',
  all_approved: 'green',
  all_paid: 'emerald',
  cancelled: 'red',
};

/**
 * Per-sub-batch snapshot inside the parent run — denormalised so the
 * detail page can render the list without a fan-in read of every
 * child doc on every refresh. Source of truth for current status is
 * the child PayrollBatch; this snapshot is updated on each lifecycle
 * event (recomputeAggregates).
 */
export interface SubBatchRef {
  batchId: string;
  batchNumber: string;
  subsidiaryId: string;
  subsidiaryName: string;
  status: PayrollBatchStatus;
  employeeCount: number;
  totalNetPay: number;
  errorCount: number;
}

export interface MonthlyPayrollRun {
  id: string;
  year: number;
  month: number;
  period: string; // "YYYY-MM"

  status: MonthlyPayrollRunStatus;

  subBatchIds: string[];
  subBatches: SubBatchRef[];   // denormalised snapshot
  subBatchCount: number;

  // Aggregate totals (sum of children)
  totalEmployees: number;
  totalGross: number;
  totalTaxableIncome: number;
  totalPAYE: number;
  totalNSSFEmployee: number;
  totalNSSFEmployer: number;
  totalLST: number;
  totalOtherDeductions: number;
  totalDeductions: number;
  totalNetPay: number;

  // Aggregate progress counters
  calculatedSubBatches: number;
  approvedSubBatches: number;
  paidSubBatches: number;
  cancelledSubBatches: number;

  paymentDate: Date | Timestamp;

  // Audit
  createdBy: string;
  createdByName?: string;
  createdAt: Date | Timestamp;
  updatedBy?: string;
  updatedAt?: Date | Timestamp;
  notes?: string;
}

/**
 * Input for creating a new monthly run. The service resolves the
 * subsidiaries list itself from the `subsidiaries` collection (active
 * only) — callers don't pre-supply it, so a new subsidiary added
 * between months is picked up automatically.
 */
export interface CreateMonthlyPayrollRunInput {
  year: number;
  month: number;
  paymentDate: Date;
  /** Optional explicit subsidiary list — bypasses the active query. */
  subsidiaryIds?: string[];
  notes?: string;
}
