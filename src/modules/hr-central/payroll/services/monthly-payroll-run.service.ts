/**
 * Monthly Payroll Run Service
 * DawinOS HR Central - Payroll Module
 *
 * Generates and orchestrates a monthly payroll run that fans out to
 * one PayrollBatch per active subsidiary. Owns aggregate recomputation
 * and bulk-action helpers (calculate-all / submit-all / approve-all /
 * pay-all) so HR/Finance can act on the whole month at once.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../../shared/services/firebase/firestore';

import type {
  PayrollBatch,
  PayrollBatchStatus,
  StatusHistoryEntry,
} from '../types/payroll-batch.types';
import { DEFAULT_CEO_THRESHOLD } from '../types/payroll-batch.types';
import type {
  MonthlyPayrollRun,
  MonthlyPayrollRunStatus,
  SubBatchRef,
  CreateMonthlyPayrollRunInput,
} from '../types/monthly-payroll-run.types';
import {
  calculateBatch,
  submitForReview,
  processApproval,
  processPayments,
  cancelBatch,
} from './payroll-batch.service';

const MONTHLY_RUN_COLLECTION = 'monthlyPayrollRuns';
const BATCH_COLLECTION = 'payrollBatches';
const SUBSIDIARY_COLLECTION = 'subsidiaries';

function generateId(): string {
  return doc(collection(db, '_')).id;
}

function periodOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Pull the list of subsidiaries to fan a run out to. Reads the
 * `subsidiaries` collection filtered to status='active'. Falls back
 * to the in-app constant when Firestore is empty so an un-seeded
 * tenant still gets a functional run for its known subsidiaries.
 */
async function resolveActiveSubsidiaries(): Promise<Array<{ id: string; name: string }>> {
  const q = query(
    collection(db, SUBSIDIARY_COLLECTION),
    where('status', '==', 'active'),
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    return snap.docs.map(d => {
      const data = d.data() as { name?: string };
      return { id: d.id, name: data.name || d.id };
    });
  }

  // Fallback — use the bundled default subsidiaries
  const { DEFAULT_SUBSIDIARIES } = await import('@/types/subsidiary');
  return DEFAULT_SUBSIDIARIES.filter(s => s.status === 'active').map(s => ({
    id: s.id,
    name: s.name,
  }));
}

/**
 * Build a single child PayrollBatch payload (Firestore-ready). Mirrors
 * the shape produced by createPayrollBatch but inlined so we can
 * commit N children + 1 parent in one writeBatch.
 */
function buildChildBatch(opts: {
  batchId: string;
  parentRunId: string;
  subsidiary: { id: string; name: string };
  year: number;
  month: number;
  paymentDate: Date;
  createdBy: string;
  createdByName: string;
  notes?: string;
}): { firestoreDoc: Record<string, unknown>; snapshot: SubBatchRef } {
  const { batchId, parentRunId, subsidiary, year, month, paymentDate, createdBy, createdByName, notes } = opts;
  const subCode = subsidiary.id.substring(0, 3).toUpperCase();
  const batchNumber = `PAY-${subCode}-${year}${String(month).padStart(2, '0')}-MR`;
  const now = new Date();
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0);

  const initialStatus: StatusHistoryEntry = {
    status: 'draft',
    timestamp: now,
    userId: createdBy,
    userName: createdByName,
    notes: `Created via monthly run ${parentRunId}`,
  };

  const batch: PayrollBatch = {
    id: batchId,
    batchNumber,
    subsidiaryId: subsidiary.id,
    subsidiaryName: subsidiary.name,
    monthlyRunId: parentRunId,

    year,
    month,
    periodStart,
    periodEnd,
    paymentDate,

    includeAllActive: true,

    status: 'draft',
    statusHistory: [initialStatus],

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
      ceoApprovalRequired: false,
      ceoThresholdAmount: DEFAULT_CEO_THRESHOLD,
    },
    approvalRecords: [],

    paymentBatches: [],
    paymentStatus: 'pending',
    paidAmount: 0,
    pendingAmount: 0,

    createdBy,
    createdAt: now,
    notes,
    version: 1,
  };

  const firestoreDoc: Record<string, unknown> = {
    ...batch,
    periodStart: Timestamp.fromDate(periodStart),
    periodEnd: Timestamp.fromDate(periodEnd),
    paymentDate: Timestamp.fromDate(paymentDate),
    createdAt: Timestamp.now(),
    statusHistory: batch.statusHistory.map(h => ({
      ...h,
      timestamp: Timestamp.fromDate(h.timestamp),
    })),
  };

  const snapshot: SubBatchRef = {
    batchId,
    batchNumber,
    subsidiaryId: subsidiary.id,
    subsidiaryName: subsidiary.name,
    status: 'draft',
    employeeCount: 0,
    totalNetPay: 0,
    errorCount: 0,
  };

  return { firestoreDoc, snapshot };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a monthly run for the given year/month. Atomically creates
 * the parent doc + one child PayrollBatch per active subsidiary.
 * Refuses if a non-cancelled monthly run already exists for the period.
 */
export async function generateMonthlyRun(
  input: CreateMonthlyPayrollRunInput,
  createdBy: string,
  createdByName: string = '',
): Promise<MonthlyPayrollRun> {
  const { year, month, paymentDate, notes } = input;
  const period = periodOf(year, month);

  // Refuse if a run already exists for this period
  const existingQ = query(
    collection(db, MONTHLY_RUN_COLLECTION),
    where('period', '==', period),
  );
  const existingSnap = await getDocs(existingQ);
  const blocker = existingSnap.docs.find(d => {
    const s = (d.data() as { status?: string }).status;
    return s !== 'cancelled';
  });
  if (blocker) {
    throw new Error(`A monthly payroll run already exists for ${period}`);
  }

  // Resolve subsidiaries
  const subsidiaries = input.subsidiaryIds
    ? (await Promise.all(input.subsidiaryIds.map(async id => {
        const snap = await getDoc(doc(db, SUBSIDIARY_COLLECTION, id));
        return { id, name: (snap.data()?.name as string) || id };
      })))
    : await resolveActiveSubsidiaries();

  if (subsidiaries.length === 0) {
    throw new Error('No active subsidiaries found to fan a monthly run out to');
  }

  // Build parent + children
  const parentId = generateId();
  const childPayloads = subsidiaries.map(sub =>
    buildChildBatch({
      batchId: generateId(),
      parentRunId: parentId,
      subsidiary: sub,
      year,
      month,
      paymentDate,
      createdBy,
      createdByName,
      notes,
    }),
  );

  const subBatchIds = childPayloads.map(c => (c.firestoreDoc.id as string));
  const subBatches = childPayloads.map(c => c.snapshot);

  const parentDoc: Record<string, unknown> = {
    id: parentId,
    year,
    month,
    period,
    status: 'in_progress' as MonthlyPayrollRunStatus,

    subBatchIds,
    subBatches,
    subBatchCount: subBatchIds.length,

    totalEmployees: 0,
    totalGross: 0,
    totalTaxableIncome: 0,
    totalPAYE: 0,
    totalNSSFEmployee: 0,
    totalNSSFEmployer: 0,
    totalLST: 0,
    totalOtherDeductions: 0,
    totalDeductions: 0,
    totalNetPay: 0,

    calculatedSubBatches: 0,
    approvedSubBatches: 0,
    paidSubBatches: 0,
    cancelledSubBatches: 0,

    paymentDate: Timestamp.fromDate(paymentDate),

    createdBy,
    createdByName,
    createdAt: Timestamp.now(),
    notes,
  };

  // Atomic commit: parent + all children
  const batch = writeBatch(db);
  batch.set(doc(db, MONTHLY_RUN_COLLECTION, parentId), parentDoc);
  for (const child of childPayloads) {
    batch.set(doc(db, BATCH_COLLECTION, child.firestoreDoc.id as string), child.firestoreDoc);
  }
  await batch.commit();

  return { ...parentDoc, id: parentId } as unknown as MonthlyPayrollRun;
}

/**
 * Fetch a monthly run by id.
 */
export async function getMonthlyRun(runId: string): Promise<MonthlyPayrollRun | null> {
  const snap = await getDoc(doc(db, MONTHLY_RUN_COLLECTION, runId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MonthlyPayrollRun;
}

/**
 * List monthly runs (default: most-recent-first). Filters supported:
 * year (number).
 */
export async function listMonthlyRuns(filters?: { year?: number }): Promise<MonthlyPayrollRun[]> {
  let q = query(collection(db, MONTHLY_RUN_COLLECTION));
  if (filters?.year !== undefined) {
    q = query(q, where('year', '==', filters.year));
  }
  q = query(q, orderBy('period', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MonthlyPayrollRun));
}

/**
 * Recompute aggregates by reading every child batch and summing.
 * Call this after any sub-batch state transition so the parent
 * surfaces current totals + counts. Inexpensive — only fires when
 * a child's lifecycle event happens.
 */
export async function recomputeAggregates(runId: string): Promise<MonthlyPayrollRun> {
  const run = await getMonthlyRun(runId);
  if (!run) throw new Error(`Monthly run not found: ${runId}`);

  const children: PayrollBatch[] = [];
  for (const id of run.subBatchIds) {
    const cSnap = await getDoc(doc(db, BATCH_COLLECTION, id));
    if (cSnap.exists()) {
      children.push({ id: cSnap.id, ...cSnap.data() } as PayrollBatch);
    }
  }

  const subBatches: SubBatchRef[] = children.map(c => ({
    batchId: c.id,
    batchNumber: c.batchNumber,
    subsidiaryId: c.subsidiaryId,
    subsidiaryName: c.subsidiaryName,
    status: c.status,
    employeeCount: c.employeeCount,
    totalNetPay: c.totalNetPay,
    errorCount: c.errorCount,
  }));

  const sum = (key: keyof PayrollBatch) =>
    children.reduce((acc, c) => acc + (Number(c[key]) || 0), 0);

  // Headcount must be DEDUPED across sub-batches: a split employee
  // (e.g. 60/40 across two subsidiaries) appears in both sub-batches'
  // employeeCount and would otherwise inflate the monthly total. We
  // resolve distinct employees by reading each sub-batch's payrollIds
  // (one payroll record per employee per period — see Model A) and
  // counting the union.
  const distinctEmployees = new Set<string>();
  for (const c of children) {
    for (const pid of c.payrollIds || []) distinctEmployees.add(pid);
  }
  const distinctEmployeeCount = distinctEmployees.size;

  const calculatedCount = children.filter(c =>
    ['calculated', 'hr_review', 'hr_approved', 'finance_review', 'finance_approved', 'ceo_review', 'approved', 'processing_payment', 'paid'].includes(c.status),
  ).length;
  const approvedCount = children.filter(c =>
    ['approved', 'processing_payment', 'paid'].includes(c.status),
  ).length;
  const paidCount = children.filter(c => c.status === 'paid').length;
  const cancelledCount = children.filter(c => c.status === 'cancelled').length;

  const activeCount = children.length - cancelledCount;
  let status: MonthlyPayrollRunStatus;
  if (activeCount === 0) status = 'cancelled';
  else if (paidCount === activeCount) status = 'all_paid';
  else if (approvedCount === activeCount) status = 'all_approved';
  else if (approvedCount > 0) status = 'partially_approved';
  else if (calculatedCount === activeCount) status = 'all_calculated';
  else status = 'in_progress';

  const updates = {
    subBatches,
    status,
    totalEmployees: distinctEmployeeCount,
    totalGross: sum('totalGross'),
    totalTaxableIncome: sum('totalTaxableIncome'),
    totalPAYE: sum('totalPAYE'),
    totalNSSFEmployee: sum('totalNSSFEmployee'),
    totalNSSFEmployer: sum('totalNSSFEmployer'),
    totalLST: sum('totalLST'),
    totalOtherDeductions: sum('totalOtherDeductions'),
    totalDeductions: sum('totalDeductions'),
    totalNetPay: sum('totalNetPay'),
    calculatedSubBatches: calculatedCount,
    approvedSubBatches: approvedCount,
    paidSubBatches: paidCount,
    cancelledSubBatches: cancelledCount,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(doc(db, MONTHLY_RUN_COLLECTION, runId), updates);

  return { ...run, ...updates } as unknown as MonthlyPayrollRun;
}

// ============================================================================
// Bulk actions — fan a single user action out to every applicable child
// ============================================================================

interface BulkResult {
  attempted: number;
  succeeded: number;
  failed: Array<{ batchId: string; subsidiaryName: string; error: string }>;
}

/**
 * Internal helper — iterate sub-batches, run an action on each one that
 * matches `applicableWhen`, and aggregate the result. Recomputes parent
 * aggregates at the end. Doesn't bail on the first failure: one
 * subsidiary's hiccup shouldn't block the rest of the month.
 */
async function runBulkAction(
  runId: string,
  applicableWhen: (status: PayrollBatchStatus) => boolean,
  action: (batch: PayrollBatch) => Promise<unknown>,
): Promise<BulkResult> {
  const run = await getMonthlyRun(runId);
  if (!run) throw new Error(`Monthly run not found: ${runId}`);

  const result: BulkResult = { attempted: 0, succeeded: 0, failed: [] };

  for (const id of run.subBatchIds) {
    const snap = await getDoc(doc(db, BATCH_COLLECTION, id));
    if (!snap.exists()) continue;
    const child = { id: snap.id, ...snap.data() } as PayrollBatch;
    if (!applicableWhen(child.status)) continue;

    result.attempted++;
    try {
      await action(child);
      result.succeeded++;
    } catch (e) {
      result.failed.push({
        batchId: child.id,
        subsidiaryName: child.subsidiaryName,
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }

  await recomputeAggregates(runId);
  return result;
}

export function calculateAllSubBatches(
  runId: string,
  performedBy: string,
  performedByName: string = '',
): Promise<BulkResult> {
  return runBulkAction(
    runId,
    s => s === 'draft',
    batch => calculateBatch(batch.id, performedBy, performedByName),
  );
}

export function submitAllForReview(
  runId: string,
  performedBy: string,
  performedByName: string = '',
): Promise<BulkResult> {
  return runBulkAction(
    runId,
    s => s === 'calculated',
    batch => submitForReview(batch.id, performedBy, performedByName),
  );
}

/**
 * Approve all sub-batches at the given review stage. `level` matches
 * the reviewer's role — 'hr' / 'finance' / 'ceo'. Each child must
 * already be in the matching review state for this to apply.
 */
export function approveAllAtLevel(
  runId: string,
  level: 'hr' | 'finance' | 'ceo',
  performedBy: string,
  performedByName: string = '',
  comments?: string,
): Promise<BulkResult> {
  const reviewStatus: PayrollBatchStatus =
    level === 'hr' ? 'hr_review' : level === 'finance' ? 'finance_review' : 'ceo_review';

  return runBulkAction(
    runId,
    s => s === reviewStatus,
    batch =>
      processApproval(
        batch.id,
        'approve',
        performedBy,
        performedByName,
        level,
        comments,
      ),
  );
}

export function payAllSubBatches(
  runId: string,
  performedBy: string,
  performedByName: string = '',
): Promise<BulkResult> {
  return runBulkAction(
    runId,
    s => s === 'approved',
    batch => processPayments(batch.id, performedBy, performedByName),
  );
}

export function cancelAllSubBatches(
  runId: string,
  performedBy: string,
  performedByName: string = '',
  reason?: string,
): Promise<BulkResult> {
  return runBulkAction(
    runId,
    s => !['paid', 'cancelled', 'reversed'].includes(s),
    batch => cancelBatch(batch.id, performedBy, performedByName, reason ?? ''),
  );
}

// Re-export for convenience
export type { BulkResult };
