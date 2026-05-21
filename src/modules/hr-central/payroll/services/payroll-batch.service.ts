/**
 * Payroll Batch Service
 * ZeusOS HR Central - Payroll Module
 * 
 * Manages payroll batch lifecycle, approval workflows, and payment processing.
 * Workflow: Create → Calculate → HR Review → Finance Review → [CEO Review] → Payment → Complete
 */

import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';

import {
  PayrollBatch,
  PayrollBatchStatus,
  CreatePayrollBatchInput,
  ApprovalRecord,
  ApprovalLevel,
  PaymentBatch,
  BatchCalculationProgress,
  PayrollBatchFilters,
  PayrollBatchSort,
  StatusHistoryEntry,
  BatchCalculationError,
  VALID_STATUS_TRANSITIONS,
  DEFAULT_CEO_THRESHOLD
} from '../types/payroll-batch.types';
import { EmployeePayroll } from '../types/payroll.types';
import { calculateEmployeePayroll, applyRecoveriesForPayroll, reverseRecoveriesForPayroll } from './payroll-calculator.service';
import { roundCurrency } from '../utils/tax-calculator';
import { Employee } from '../../types/employee.types';

// ============================================================================
// Collection Constants
// ============================================================================

const BATCH_COLLECTION = 'payrollBatches';
const PAYROLL_COLLECTION = 'payroll';
const EMPLOYEE_COLLECTION = 'employees';
const SUBSIDIARY_COLLECTION = 'subsidiaries';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Batch-fetch payroll docs by id. Replaces serial `for (const id of ids) await
 * getDoc(...)` patterns with chunked `where(documentId(), 'in', chunk)` queries
 * (Firestore's `in` operator caps at 30 ids per query). Missing ids are simply
 * absent from the result — callers must not rely on input ordering.
 */
async function getPayrollsByIds(payrollIds: string[]): Promise<EmployeePayroll[]> {
  if (payrollIds.length === 0) return [];
  const results: EmployeePayroll[] = [];
  const CHUNK = 30;
  for (let i = 0; i < payrollIds.length; i += CHUNK) {
    const chunk = payrollIds.slice(i, i + CHUNK);
    const q = query(
      collection(db, PAYROLL_COLLECTION),
      where(documentId(), 'in', chunk),
    );
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      results.push({ id: d.id, ...d.data() } as EmployeePayroll);
    }
  }
  return results;
}

function generateId(): string {
  return doc(collection(db, '_')).id;
}

function convertTimestampToDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

// ============================================================================
// Payroll Batch Service
// ============================================================================

/**
 * Create a new payroll batch
 */
export async function createPayrollBatch(
  input: CreatePayrollBatchInput,
  createdBy: string,
  createdByName: string = ''
): Promise<PayrollBatch> {
  // Validate no existing active batch for this period
  const existing = await getBatchForPeriod(
    input.subsidiaryId,
    input.year,
    input.month
  );
  if (existing && !['cancelled', 'reversed'].includes(existing.status)) {
    throw new Error(`Payroll batch already exists for ${input.year}-${String(input.month).padStart(2, '0')}`);
  }

  // Get subsidiary info
  const subsidiary = await getSubsidiary(input.subsidiaryId);
  if (!subsidiary) {
    throw new Error('Subsidiary not found');
  }

  // Generate batch number
  const batchNumber = await generateBatchNumber(
    input.subsidiaryId,
    input.year,
    input.month
  );

  const batchId = generateId();
  const now = new Date();
  const periodStart = new Date(input.year, input.month - 1, 1);
  const periodEnd = new Date(input.year, input.month, 0);

  const batch: PayrollBatch = {
    id: batchId,
    batchNumber,
    subsidiaryId: input.subsidiaryId,
    subsidiaryName: subsidiary.name || input.subsidiaryId,
    
    year: input.year,
    month: input.month,
    periodStart,
    periodEnd,
    paymentDate: input.paymentDate,
    
    departmentIds: input.departmentIds,
    employeeIds: input.employeeIds,
    includeAllActive: input.includeAllActive ?? true,
    
    status: 'draft',
    statusHistory: [{
      status: 'draft',
      timestamp: now,
      userId: createdBy,
      userName: createdByName,
      notes: 'Batch created'
    }],
    
    payrollIds: [],
    employeeCount: 0,
    calculatedCount: 0,
    errorCount: 0,
    
    totalGross: 0,
    totalTaxableIncome: 0,
    totalPAYE: 0,
    totalNSSFEmployee: 0,
    totalNSSFEmployer: 0,
    totalLST: 0,
    totalOtherDeductions: 0,
    totalDeductions: 0,
    totalNetPay: 0,
    
    approvalThresholds: {
      hrApprovalRequired: true,
      financeApprovalRequired: true,
      ceoApprovalRequired: false, // Determined after calculation
      ceoThresholdAmount: DEFAULT_CEO_THRESHOLD
    },
    approvalRecords: [],
    
    paymentBatches: [],
    paymentStatus: 'pending',
    paidAmount: 0,
    pendingAmount: 0,
    
    createdBy,
    createdAt: now,
    notes: input.notes,
    version: 1
  };

  // Save to Firestore
  await setDoc(doc(db, BATCH_COLLECTION, batchId), {
    ...batch,
    periodStart: Timestamp.fromDate(periodStart),
    periodEnd: Timestamp.fromDate(periodEnd),
    paymentDate: Timestamp.fromDate(input.paymentDate),
    createdAt: Timestamp.now(),
    statusHistory: batch.statusHistory.map(h => ({
      ...h,
      timestamp: Timestamp.fromDate(h.timestamp)
    }))
  });

  return batch;
}

/**
 * Calculate all payrolls in batch
 */
export async function calculateBatch(
  batchId: string,
  performedBy: string,
  performedByName: string = '',
  progressCallback?: (progress: BatchCalculationProgress) => void
): Promise<PayrollBatch> {
  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  if (batch.status !== 'draft') {
    throw new Error(`Cannot calculate batch in ${batch.status} status`);
  }

  // Update status to calculating
  await updateBatchStatus(batch, 'calculating', performedBy, performedByName, 'Starting calculation');

  // Get employees to process
  const employees = await getEmployeesForBatch(batch);
  
  const progress: BatchCalculationProgress = {
    batchId,
    total: employees.length,
    completed: 0,
    failed: 0,
    status: 'calculating',
    errors: [],
    startedAt: new Date()
  };

  progressCallback?.(progress);

  const payrollIds: string[] = [];
  const errors: BatchCalculationError[] = [];
  let totalGross = 0;
  let totalTaxableIncome = 0;
  let totalPAYE = 0;
  let totalNSSFEmployee = 0;
  let totalNSSFEmployer = 0;
  let totalLST = 0;
  let totalOtherDeductions = 0;
  let totalDeductions = 0;
  let totalNetPay = 0;

  for (const employee of employees) {
    const employeeName = `${employee.firstName} ${employee.lastName}`;
    progress.currentEmployee = employeeName;
    progressCallback?.(progress);

    try {
      const payroll = await calculateEmployeePayroll(
        {
          employeeId: employee.id,
          year: batch.year,
          month: batch.month,
          recalculate: true
        },
        performedBy
      );

      // Apply this employee's allocation share for the batch's
      // subsidiary. The factor is read from the snapshot stored on
      // the payroll record (calculateEmployeePayroll just wrote it),
      // not from the live employee — so reruns and reports are
      // stable even if the employee's split changes later.
      const allocationFactor = getEmployeeSubsidiaryAllocation(payroll, batch.subsidiaryId);
      const isHost = isHostSubsidiary(payroll, batch.subsidiaryId);

      // Link the payroll to this batch. We deliberately don't
      // overwrite `payrollPeriodId` when another sub-batch already
      // owns it (split employees appear in multiple sub-batches —
      // the host's link is the authoritative one for statutory and
      // payment purposes).
      if (isHost) {
        await updateDoc(doc(db, PAYROLL_COLLECTION, payroll.id), {
          payrollPeriodId: batchId,
          updatedAt: Timestamp.now(),
        });
      }

      payrollIds.push(payroll.id);

      // Accumulate totals — cost-share view per Model A.
      //   Gross / net pay: scaled by allocation factor at every
      //     sub-batch (this is the cost the subsidiary bears).
      //   Statutory (PAYE / NSSF / LST): only on the host sub-batch
      //     because filings happen at the host's TIN. Recipient
      //     sub-batches show 0 statutory — their economic cost is
      //     just the recharge amount.
      totalGross += payroll.grossPay * allocationFactor;
      totalTaxableIncome += payroll.taxableIncome * allocationFactor;
      totalNSSFEmployer += payroll.nssfBreakdown.employerContribution * allocationFactor;
      totalOtherDeductions += payroll.totalVoluntaryDeductions * allocationFactor;
      totalNetPay += payroll.netPay * allocationFactor;

      if (isHost) {
        totalPAYE += payroll.payeBreakdown.netPAYE;
        totalNSSFEmployee += payroll.nssfBreakdown.employeeContribution;
        totalLST += payroll.lstBreakdown.monthlyLST;
        totalDeductions += payroll.totalDeductions;
      } else {
        // Recipient: only the voluntary slice contributes to their
        // "total deductions" view (statutory belongs to the host).
        totalDeductions += payroll.totalVoluntaryDeductions * allocationFactor;
      }

      progress.completed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      progress.failed++;
      progress.errors.push({
        employeeId: employee.id,
        employeeName,
        error: errorMessage
      });
      errors.push({
        employeeId: employee.id,
        employeeName,
        error: errorMessage,
        timestamp: new Date()
      });
    }

    progressCallback?.(progress);
  }

  // Determine if CEO approval required
  const ceoApprovalRequired = totalNetPay >= DEFAULT_CEO_THRESHOLD;

  // Update batch with results
  const updatedData: Partial<PayrollBatch> = {
    payrollIds,
    employeeCount: employees.length,
    calculatedCount: progress.completed,
    errorCount: progress.failed,
    errors: errors.length > 0 ? errors : undefined,
    
    totalGross: roundCurrency(totalGross),
    totalTaxableIncome: roundCurrency(totalTaxableIncome),
    totalPAYE: roundCurrency(totalPAYE),
    totalNSSFEmployee: roundCurrency(totalNSSFEmployee),
    totalNSSFEmployer: roundCurrency(totalNSSFEmployer),
    totalLST: roundCurrency(totalLST),
    totalOtherDeductions: roundCurrency(totalOtherDeductions),
    totalDeductions: roundCurrency(totalDeductions),
    totalNetPay: roundCurrency(totalNetPay),
    pendingAmount: roundCurrency(totalNetPay),
    
    approvalThresholds: {
      ...batch.approvalThresholds,
      ceoApprovalRequired
    },
    
    status: 'calculated',
    updatedBy: performedBy,
    updatedAt: new Date(),
    version: batch.version + 1
  };

  // Add status history
  const statusHistory: StatusHistoryEntry[] = [
    ...batch.statusHistory,
    {
      status: 'calculated',
      timestamp: new Date(),
      userId: performedBy,
      userName: performedByName,
      notes: `Calculated ${progress.completed} of ${employees.length} employees${progress.failed > 0 ? `, ${progress.failed} failed` : ''}`
    }
  ];

  await updateDoc(doc(db, BATCH_COLLECTION, batchId), {
    ...updatedData,
    statusHistory: statusHistory.map(h => ({
      ...h,
      timestamp: Timestamp.fromDate(h.timestamp)
    })),
    errors: errors.map(e => ({
      ...e,
      timestamp: Timestamp.fromDate(e.timestamp)
    })),
    updatedAt: Timestamp.now()
  });

  progress.status = 'complete';
  progressCallback?.(progress);

  return getBatch(batchId) as Promise<PayrollBatch>;
}

/**
 * Re-run calculation for an existing batch.
 *
 * Used when something changed underneath after the first calculation —
 * salary updated, attendance recorded, overtime approved, statutory
 * rates revised. Re-uses the per-employee idempotent path
 * (calculateEmployeePayroll with recalculate: true reuses the existing
 * payroll doc id), so no duplicate payslips are created.
 *
 * Refuses for any post-approval status — once a batch is approved or
 * paid it must be cancelled/reversed first to keep the audit trail
 * clean. For batches mid-review (hr_review / finance_review /
 * ceo_review) the status snaps back to `calculated` and reviewers
 * must re-approve with the fresh numbers; the prior approvalRecords
 * are kept intact as audit history.
 */
export async function recalculateBatch(
  batchId: string,
  performedBy: string,
  performedByName: string = '',
  progressCallback?: (progress: BatchCalculationProgress) => void
): Promise<PayrollBatch> {
  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const lockedStatuses: PayrollBatchStatus[] = [
    'approved',
    'processing_payment',
    'paid',
    'cancelled',
    'reversed',
  ];
  if (lockedStatuses.includes(batch.status)) {
    throw new Error(
      `Cannot regenerate a batch in "${batch.status}" status. Cancel or reverse it first.`
    );
  }

  // Snap status back to draft so calculateBatch's gate accepts it.
  // Bypasses VALID_STATUS_TRANSITIONS deliberately — this is an
  // explicit user-initiated reset, not a workflow advance.
  const recalcNote = `Regenerated by ${performedByName || performedBy} (was ${batch.status})`;
  await updateDoc(doc(db, BATCH_COLLECTION, batchId), {
    status: 'draft',
    statusHistory: [
      ...batch.statusHistory.map(h => ({
        ...h,
        timestamp: h.timestamp instanceof Date ? Timestamp.fromDate(h.timestamp) : h.timestamp,
      })),
      {
        status: 'draft',
        timestamp: Timestamp.now(),
        userId: performedBy,
        userName: performedByName,
        notes: recalcNote,
      },
    ],
    // Clear prior calculation errors so the new run shows a clean slate.
    errors: [],
    updatedBy: performedBy,
    updatedAt: Timestamp.now(),
    version: batch.version + 1,
  });

  return calculateBatch(batchId, performedBy, performedByName, progressCallback);
}

/**
 * Submit batch for review
 */
export async function submitForReview(
  batchId: string,
  submittedBy: string,
  submittedByName: string = ''
): Promise<PayrollBatch> {
  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  if (batch.status !== 'calculated') {
    throw new Error('Batch must be calculated before submitting for review');
  }

  if (batch.errorCount > 0) {
    throw new Error(`Cannot submit batch with ${batch.errorCount} errors. Please fix errors first.`);
  }

  await updateBatchStatus(batch, 'hr_review', submittedBy, submittedByName, 'Submitted for HR review');

  return getBatch(batchId) as Promise<PayrollBatch>;
}

/**
 * Process approval action
 */
export async function processApproval(
  batchId: string,
  action: 'approve' | 'reject' | 'return',
  approverId: string,
  approverName: string,
  approverRole: string,
  comments?: string
): Promise<PayrollBatch> {
  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  // Determine current approval level and next status
  const { level, newStatus, returnStatus } = getApprovalTransition(batch.status, action);
  
  const finalStatus = action === 'return' ? returnStatus : newStatus;

  // Create approval record
  const approvalRecord: ApprovalRecord = {
    id: generateId(),
    level,
    action: action === 'approve' ? 'approved' : action === 'return' ? 'returned' : 'rejected',
    approverId,
    approverName,
    approverRole,
    timestamp: new Date(),
    comments,
    previousStatus: batch.status,
    newStatus: finalStatus
  };

  // Build status history entry
  const statusHistoryEntry: StatusHistoryEntry = {
    status: finalStatus,
    timestamp: new Date(),
    userId: approverId,
    userName: approverName,
    notes: `${level.toUpperCase()} ${action}: ${comments || 'No comments'}`
  };

  // Update batch
  await updateDoc(doc(db, BATCH_COLLECTION, batchId), {
    status: finalStatus,
    approvalRecords: [...batch.approvalRecords, {
      ...approvalRecord,
      timestamp: Timestamp.fromDate(approvalRecord.timestamp)
    }],
    currentApprover: null,
    statusHistory: [...batch.statusHistory.map(h => ({
      ...h,
      timestamp: h.timestamp instanceof Date ? Timestamp.fromDate(h.timestamp) : h.timestamp
    })), {
      ...statusHistoryEntry,
      timestamp: Timestamp.fromDate(statusHistoryEntry.timestamp)
    }],
    updatedBy: approverId,
    updatedAt: Timestamp.now(),
    version: batch.version + 1
  });

  // Handle post-approval actions (move to next stage)
  if (action === 'approve') {
    await handleApprovalComplete(batchId, batch, level, approverId, approverName);
  }

  return getBatch(batchId) as Promise<PayrollBatch>;
}

/**
 * Get approval transition based on current status and action
 */
function getApprovalTransition(
  currentStatus: PayrollBatchStatus,
  action: 'approve' | 'reject' | 'return'
): { level: ApprovalLevel; newStatus: PayrollBatchStatus; returnStatus: PayrollBatchStatus } {
  switch (currentStatus) {
    case 'hr_review':
      return {
        level: 'hr',
        newStatus: action === 'approve' ? 'hr_approved' : 
                   action === 'reject' ? 'cancelled' : 'calculated',
        returnStatus: 'calculated'
      };
    case 'finance_review':
      return {
        level: 'finance',
        newStatus: action === 'approve' ? 'finance_approved' : 
                   action === 'reject' ? 'cancelled' : 'hr_approved',
        returnStatus: 'hr_approved'
      };
    case 'ceo_review':
      return {
        level: 'ceo',
        newStatus: action === 'approve' ? 'approved' : 
                   action === 'reject' ? 'cancelled' : 'finance_approved',
        returnStatus: 'finance_approved'
      };
    default:
      throw new Error(`Batch is not in an approvable status: ${currentStatus}`);
  }
}

/**
 * Handle completion of an approval level - move to next stage
 */
async function handleApprovalComplete(
  _batchId: string,
  batch: PayrollBatch,
  level: ApprovalLevel,
  approverId: string,
  approverName: string
): Promise<void> {
  if (level === 'hr') {
    // Move to finance review
    await updateBatchStatus(
      { ...batch, status: 'hr_approved' },
      'finance_review',
      approverId,
      approverName,
      'Moving to finance review'
    );
  } else if (level === 'finance') {
    if (batch.approvalThresholds.ceoApprovalRequired) {
      // Move to CEO review
      await updateBatchStatus(
        { ...batch, status: 'finance_approved' },
        'ceo_review',
        approverId,
        approverName,
        'Moving to CEO review (threshold exceeded)'
      );
    } else {
      // Fully approved
      await updateBatchStatus(
        { ...batch, status: 'finance_approved' },
        'approved',
        approverId,
        approverName,
        'Fully approved'
      );
    }
  }
  // CEO approval already sets status to 'approved' directly
}

/**
 * Process payments for batch
 */
export async function processPayments(
  batchId: string,
  processedBy: string,
  processedByName: string = ''
): Promise<PayrollBatch> {
  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  if (batch.status !== 'approved') {
    throw new Error('Batch must be approved before processing payments');
  }

  await updateBatchStatus(batch, 'processing_payment', processedBy, processedByName, 'Processing payments');

  // Get all payrolls in batch
  const payrolls = await getBatchPayrolls(batchId);

  // Group by payment method
  const groupedPayments = groupPayrollsByPaymentMethod(payrolls);

  const paymentBatches: PaymentBatch[] = [];

  for (const [method, methodPayrolls] of Object.entries(groupedPayments)) {
    // Further group bank transfers by bank
    if (method === 'bank_transfer') {
      const bankGroups = groupByBank(methodPayrolls);
      for (const [bankName, bankPayrolls] of Object.entries(bankGroups)) {
        const paymentBatch = createPaymentBatchRecord(
          batch,
          'bank_transfer',
          bankPayrolls,
          bankName
        );
        paymentBatches.push(paymentBatch);
      }
    } else {
      const paymentBatch = createPaymentBatchRecord(
        batch,
        method as PaymentBatch['paymentMethod'],
        methodPayrolls
      );
      paymentBatches.push(paymentBatch);
    }
  }

  // Update batch with payment batches
  await updateDoc(doc(db, BATCH_COLLECTION, batchId), {
    paymentBatches,
    updatedBy: processedBy,
    updatedAt: Timestamp.now(),
    version: batch.version + 1
  });

  return getBatch(batchId) as Promise<PayrollBatch>;
}

/**
 * Mark payment batch as completed
 */
export async function completePaymentBatch(
  batchId: string,
  paymentBatchId: string,
  result: {
    status: 'completed' | 'failed' | 'partial';
    processedCount: number;
    failedPayments?: PaymentBatch['failedPayments'];
    reference?: string;
  },
  processedBy: string,
  processedByName: string = ''
): Promise<PayrollBatch> {
  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const paymentBatches = batch.paymentBatches.map(pb => {
    if (pb.id === paymentBatchId) {
      return {
        ...pb,
        status: result.status,
        processedCount: result.processedCount,
        failedCount: result.failedPayments?.length || 0,
        failedPayments: result.failedPayments,
        reference: result.reference,
        processedAt: new Date(),
        processedBy
      };
    }
    return pb;
  });

  // Calculate overall payment status
  const allCompleted = paymentBatches.every(pb => pb.status === 'completed');
  const anyFailed = paymentBatches.some(pb => pb.status === 'failed');
  const paymentStatus = allCompleted ? 'complete' : anyFailed ? 'partial' : 'pending';

  const paidAmount = paymentBatches
    .filter(pb => pb.status === 'completed')
    .reduce((sum, pb) => sum + pb.totalAmount, 0);

  const updates: Record<string, any> = {
    paymentBatches: paymentBatches.map(pb => ({
      ...pb,
      processedAt: pb.processedAt ? Timestamp.fromDate(pb.processedAt) : null
    })),
    paymentStatus,
    paidAmount,
    pendingAmount: batch.totalNetPay - paidAmount,
    updatedBy: processedBy,
    updatedAt: Timestamp.now(),
    version: batch.version + 1
  };

  // If all payments complete, update batch status
  if (paymentStatus === 'complete') {
    updates.status = 'paid';
    updates.statusHistory = [...batch.statusHistory.map(h => ({
      ...h,
      timestamp: h.timestamp instanceof Date ? Timestamp.fromDate(h.timestamp) : h.timestamp
    })), {
      status: 'paid',
      timestamp: Timestamp.now(),
      userId: processedBy,
      userName: processedByName,
      notes: 'All payments completed'
    }];

    // Update individual payroll statuses, then fire amortising
    // recoveries (loans / advances / installment other-deductions) for
    // each. Recoveries are idempotent on payrollId so retries are safe.
    const firestoreBatch = writeBatch(db);
    for (const payrollId of batch.payrollIds) {
      firestoreBatch.update(doc(db, PAYROLL_COLLECTION, payrollId), {
        status: 'paid',
        updatedAt: Timestamp.now()
      });
    }
    await firestoreBatch.commit();

    const payrolls = await getPayrollsByIds(batch.payrollIds);
    for (const payroll of payrolls) {
      await applyRecoveriesForPayroll(payroll);
    }
  }

  await updateDoc(doc(db, BATCH_COLLECTION, batchId), updates);

  return getBatch(batchId) as Promise<PayrollBatch>;
}

/**
 * Reverse a paid batch.
 *
 * Used when a paid batch needs to be unwound — wrong amounts, wrong
 * employees, wrong period. Walks every payroll in the batch, reverses
 * the recoveries each one applied (loans / advances / installment
 * other-deductions), and flips both the batch and its payroll
 * records to 'reversed'. Statutory remittances (PAYE / NSSF / LST)
 * already filed with URA / NSSF are NOT undone by this — the
 * reversal is the operational unwind for re-issuing payslips, not a
 * way to claw back tax. Filing corrections need to be handled
 * separately through the URA / NSSF amendment channels.
 *
 * From here the batch can be regenerated (`reversed → draft` is an
 * allowed transition) to produce a corrected payslip.
 */
export async function reverseBatch(
  batchId: string,
  reversedBy: string,
  reversedByName: string = '',
  reason: string,
): Promise<PayrollBatch> {
  const batch = await getBatch(batchId);
  if (!batch) throw new Error('Batch not found');

  if (batch.status !== 'paid') {
    throw new Error(`Can only reverse a paid batch (current status: ${batch.status})`);
  }

  // Reverse recoveries per payroll, then flip each payroll's status.
  // Recovery reversal is idempotent on payrollId, so partial retries
  // are safe if a later step fails.
  const payrolls = await getPayrollsByIds(batch.payrollIds);
  for (const payroll of payrolls) {
    await reverseRecoveriesForPayroll(payroll);
    await updateDoc(doc(db, PAYROLL_COLLECTION, payroll.id), {
      status: 'reversed',
      updatedAt: Timestamp.now(),
    });
  }

  await updateBatchStatus(batch, 'reversed', reversedBy, reversedByName, `Reversed: ${reason}`);

  return getBatch(batchId) as Promise<PayrollBatch>;
}

/**
 * Cancel a batch
 */
export async function cancelBatch(
  batchId: string,
  cancelledBy: string,
  cancelledByName: string = '',
  reason: string
): Promise<PayrollBatch> {
  const batch = await getBatch(batchId);
  if (!batch) {
    throw new Error('Batch not found');
  }

  const cancellableStatuses: PayrollBatchStatus[] = ['draft', 'calculated', 'hr_review', 'finance_review', 'ceo_review'];
  if (!cancellableStatuses.includes(batch.status)) {
    throw new Error(`Cannot cancel batch in ${batch.status} status`);
  }

  await updateBatchStatus(batch, 'cancelled', cancelledBy, cancelledByName, `Cancelled: ${reason}`);

  return getBatch(batchId) as Promise<PayrollBatch>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate batch number
 */
async function generateBatchNumber(
  subsidiaryId: string,
  year: number,
  month: number
): Promise<string> {
  const prefix = 'PAY';
  const monthStr = String(month).padStart(2, '0');
  
  // Get subsidiary code (first 3 letters)
  const subsidiary = await getSubsidiary(subsidiaryId);
  const subCode = subsidiary?.code || subsidiaryId.substring(0, 3).toUpperCase();
  
  // Get sequence number for this period
  const q = query(
    collection(db, BATCH_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('year', '==', year),
    where('month', '==', month)
  );
  const snapshot = await getDocs(q);
  const seq = snapshot.size + 1;
  
  return `${prefix}-${subCode}-${year}${monthStr}-${String(seq).padStart(2, '0')}`;
}

/**
 * Update batch status with validation
 */
async function updateBatchStatus(
  batch: PayrollBatch,
  newStatus: PayrollBatchStatus,
  userId: string,
  userName: string,
  notes?: string
): Promise<void> {
  if (!VALID_STATUS_TRANSITIONS[batch.status].includes(newStatus)) {
    throw new Error(`Invalid status transition from ${batch.status} to ${newStatus}`);
  }

  const statusHistoryEntry: StatusHistoryEntry = {
    status: newStatus,
    timestamp: new Date(),
    userId,
    userName,
    notes
  };

  await updateDoc(doc(db, BATCH_COLLECTION, batch.id), {
    status: newStatus,
    statusHistory: [...batch.statusHistory.map(h => ({
      ...h,
      timestamp: h.timestamp instanceof Date ? Timestamp.fromDate(h.timestamp) : h.timestamp
    })), {
      ...statusHistoryEntry,
      timestamp: Timestamp.fromDate(statusHistoryEntry.timestamp)
    }],
    updatedBy: userId,
    updatedAt: Timestamp.now(),
    version: batch.version + 1
  });
}

/**
 * Get employees for batch calculation
 */
/**
 * Resolve the fraction (0..1) of an employee's pay attributable to
 * the given subsidiary. Returns 1.0 when the employee has no
 * `subsidiaryAllocations` array and their primary `subsidiaryId`
 * matches; falls back to the matching allocation percent otherwise.
 * Returns 0 when the employee isn't allocated to this subsidiary at
 * all (caller should exclude them from the batch).
 *
 * Accepts either a live Employee or a calculated EmployeePayroll (the
 * snapshot stored on the payroll is the preferred source post-calc —
 * see Model A intercompany recharge design).
 */
export function getEmployeeSubsidiaryAllocation(
  source: {
    subsidiaryId?: string;
    subsidiaryAllocations?: Array<{ subsidiaryId: string; allocationPercent: number }>;
  },
  subsidiaryId: string,
): number {
  const allocs = source.subsidiaryAllocations;
  if (allocs && allocs.length > 0) {
    const match = allocs.find(a => a.subsidiaryId === subsidiaryId);
    if (!match) return 0;
    return Math.max(0, Math.min(100, Number(match.allocationPercent) || 0)) / 100;
  }
  // No split — implicitly 100% on the primary/host subsidiary.
  return source.subsidiaryId === subsidiaryId ? 1 : 0;
}

/**
 * True if this subsidiary is the host (employer of record) for the
 * payroll record. Under Model A only the host books statutory
 * remittances (PAYE / NSSF / LST) — recipient sub-batches just carry
 * the recharge amount.
 */
export function isHostSubsidiary(
  payroll: { subsidiaryId?: string },
  subsidiaryId: string,
): boolean {
  return payroll.subsidiaryId === subsidiaryId;
}

async function getEmployeesForBatch(batch: PayrollBatch): Promise<Employee[]> {
  // Match the rest of the system (PayrollPage, labor rate calculator) —
  // probation and on-leave employees still get paid.
  const ACTIVE_STATUSES = ['active', 'probation', 'on_leave'] as const;

  // If specific employees specified
  if (batch.employeeIds && batch.employeeIds.length > 0) {
    const employees: Employee[] = [];
    // Firestore 'in' query limited to 10, need to batch
    for (let i = 0; i < batch.employeeIds.length; i += 10) {
      const chunk = batch.employeeIds.slice(i, i + 10);
      const chunkQuery = query(
        collection(db, EMPLOYEE_COLLECTION),
        where('id', 'in', chunk),
        where('employmentStatus', 'in', ACTIVE_STATUSES as unknown as string[]),
      );
      const snapshot = await getDocs(chunkQuery);
      employees.push(...snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employee)));
    }
    return employees;
  }

  // Pull all active employees, then filter client-side by allocation.
  // Firestore array-contains can't match by sub-field on object arrays,
  // and the read volume is small (single-org HR scale). The filter
  // catches BOTH:
  //   - employees with primary subsidiaryId === batch.subsidiaryId
  //     and no explicit allocation array
  //   - employees whose subsidiaryAllocations include this subsidiary
  const q = batch.departmentIds && batch.departmentIds.length > 0
    ? query(
        collection(db, EMPLOYEE_COLLECTION),
        where('position.departmentId', 'in', batch.departmentIds),
        where('employmentStatus', 'in', ACTIVE_STATUSES as unknown as string[]),
      )
    : query(
        collection(db, EMPLOYEE_COLLECTION),
        where('employmentStatus', 'in', ACTIVE_STATUSES as unknown as string[]),
      );

  const snapshot = await getDocs(q);
  const allActive = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Employee));

  let employees = allActive.filter(
    (e) => getEmployeeSubsidiaryAllocation(e, batch.subsidiaryId) > 0,
  );

  // Safety-net fallback for standalone batches only. For sub-batches
  // owned by a monthly run we must NOT fall back to all active staff —
  // doing so makes every sub-batch claim every employee with
  // allocationFactor=0, which (a) inflates the resolved-employee count
  // shown in the UI, (b) overwrites each payroll doc's payrollPeriodId
  // with the LAST sub-batch to touch it (race-y, wrong batch link),
  // and (c) defeats the cost-share allocation by counting employees
  // who genuinely have 0% allocation. Empty is the correct signal —
  // assign the employee to this subsidiary if they belong here.
  if (employees.length === 0 && !batch.monthlyRunId) {
    // eslint-disable-next-line no-console
    console.warn(
      `[payroll-batch] No employees matched subsidiary "${batch.subsidiaryId}" (by primary or allocation) for batch ${batch.batchNumber}. Falling back to all active employees.`
    );
    employees = allActive;
  }

  // eslint-disable-next-line no-console
  console.info(
    `[payroll-batch] ${batch.batchNumber}: resolved ${employees.length} employees (subsidiaryId="${batch.subsidiaryId}", departmentIds=${JSON.stringify(batch.departmentIds ?? [])})`
  );

  return employees;
}

/**
 * Group payrolls by payment method
 */
function groupPayrollsByPaymentMethod(
  payrolls: EmployeePayroll[]
): Record<string, EmployeePayroll[]> {
  return payrolls.reduce((groups, payroll) => {
    const method = payroll.paymentMethod;
    if (!groups[method]) {
      groups[method] = [];
    }
    groups[method].push(payroll);
    return groups;
  }, {} as Record<string, EmployeePayroll[]>);
}

/**
 * Group payrolls by bank name
 */
function groupByBank(
  payrolls: EmployeePayroll[]
): Record<string, EmployeePayroll[]> {
  return payrolls.reduce((groups, payroll) => {
    const bankName = payroll.bankDetails?.bankName || 'Unknown';
    if (!groups[bankName]) {
      groups[bankName] = [];
    }
    groups[bankName].push(payroll);
    return groups;
  }, {} as Record<string, EmployeePayroll[]>);
}

/**
 * Create payment batch record
 */
function createPaymentBatchRecord(
  batch: PayrollBatch,
  method: PaymentBatch['paymentMethod'],
  payrolls: EmployeePayroll[],
  bankName?: string
): PaymentBatch {
  const totalAmount = payrolls.reduce((sum, p) => sum + p.netPay, 0);

  return {
    id: generateId(),
    payrollBatchId: batch.id,
    paymentMethod: method,
    bankName,
    totalAmount: roundCurrency(totalAmount),
    employeeCount: payrolls.length,
    status: 'pending',
    processedCount: 0,
    failedCount: 0
  };
}

// ============================================================================
// Data Access Functions
// ============================================================================

/**
 * Get batch by ID
 */
export async function getBatch(batchId: string): Promise<PayrollBatch | null> {
  const docRef = doc(db, BATCH_COLLECTION, batchId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    periodStart: convertTimestampToDate(data.periodStart),
    periodEnd: convertTimestampToDate(data.periodEnd),
    paymentDate: convertTimestampToDate(data.paymentDate),
    createdAt: convertTimestampToDate(data.createdAt),
    updatedAt: data.updatedAt ? convertTimestampToDate(data.updatedAt) : undefined,
    statusHistory: (data.statusHistory || []).map((h: any) => ({
      ...h,
      timestamp: convertTimestampToDate(h.timestamp)
    })),
    approvalRecords: (data.approvalRecords || []).map((r: any) => ({
      ...r,
      timestamp: convertTimestampToDate(r.timestamp)
    })),
    errors: (data.errors || []).map((e: any) => ({
      ...e,
      timestamp: convertTimestampToDate(e.timestamp)
    })),
    paymentBatches: (data.paymentBatches || []).map((pb: any) => ({
      ...pb,
      processedAt: pb.processedAt ? convertTimestampToDate(pb.processedAt) : undefined
    }))
  } as PayrollBatch;
}

/**
 * Get batch for a specific period
 */
export async function getBatchForPeriod(
  subsidiaryId: string,
  year: number,
  month: number
): Promise<PayrollBatch | null> {
  const q = query(
    collection(db, BATCH_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('year', '==', year),
    where('month', '==', month),
    orderBy('createdAt', 'desc'),
    firestoreLimit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return getBatch(snapshot.docs[0].id);
}

/**
 * List batches with filters
 */
export async function listBatches(
  filters: PayrollBatchFilters,
  sort: PayrollBatchSort = { field: 'createdAt', direction: 'desc' },
  pageSize: number = 20
): Promise<PayrollBatch[]> {
  let q = query(collection(db, BATCH_COLLECTION));

  if (filters.subsidiaryId) {
    q = query(q, where('subsidiaryId', '==', filters.subsidiaryId));
  }
  if (filters.year) {
    q = query(q, where('year', '==', filters.year));
  }
  if (filters.month) {
    q = query(q, where('month', '==', filters.month));
  }
  if (filters.status && filters.status.length > 0 && filters.status.length <= 10) {
    q = query(q, where('status', 'in', filters.status));
  }

  q = query(q, orderBy(sort.field, sort.direction), firestoreLimit(pageSize));

  const snapshot = await getDocs(q);
  const batches: PayrollBatch[] = [];
  
  for (const docSnap of snapshot.docs) {
    const batch = await getBatch(docSnap.id);
    if (batch) batches.push(batch);
  }
  
  return batches;
}

/**
 * Get payrolls in a batch
 */
export async function getBatchPayrolls(batchId: string): Promise<EmployeePayroll[]> {
  const q = query(
    collection(db, PAYROLL_COLLECTION),
    where('payrollPeriodId', '==', batchId)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      periodStart: convertTimestampToDate(data.periodStart),
      periodEnd: convertTimestampToDate(data.periodEnd),
      paymentDate: convertTimestampToDate(data.paymentDate),
      calculatedAt: convertTimestampToDate(data.calculatedAt),
      createdAt: convertTimestampToDate(data.createdAt),
      updatedAt: data.updatedAt ? convertTimestampToDate(data.updatedAt) : undefined
    };
  }) as EmployeePayroll[];
}

/**
 * Get subsidiary info
 */
async function getSubsidiary(subsidiaryId: string): Promise<{ name: string; code?: string } | null> {
  const docRef = doc(db, SUBSIDIARY_COLLECTION, subsidiaryId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    // Return a default based on ID
    return { name: subsidiaryId, code: subsidiaryId.substring(0, 3).toUpperCase() };
  }
  
  const data = docSnap.data();
  return { 
    name: data.name || subsidiaryId, 
    code: data.code || subsidiaryId.substring(0, 3).toUpperCase() 
  };
}

/**
 * Get batch summary statistics
 */
export async function getBatchStatistics(subsidiaryId: string, year: number): Promise<{
  totalBatches: number;
  totalPaid: number;
  totalPending: number;
  byStatus: Record<PayrollBatchStatus, number>;
}> {
  const q = query(
    collection(db, BATCH_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('year', '==', year)
  );
  
  const snapshot = await getDocs(q);
  
  const byStatus: Record<string, number> = {};
  let totalPaid = 0;
  let totalPending = 0;
  
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    byStatus[data.status] = (byStatus[data.status] || 0) + 1;
    
    if (data.status === 'paid') {
      totalPaid += data.totalNetPay || 0;
    } else if (!['cancelled', 'reversed'].includes(data.status)) {
      totalPending += data.totalNetPay || 0;
    }
  }
  
  return {
    totalBatches: snapshot.size,
    totalPaid: roundCurrency(totalPaid),
    totalPending: roundCurrency(totalPending),
    byStatus: byStatus as Record<PayrollBatchStatus, number>
  };
}
