/**
 * Compliance Obligation Service
 * Firestore CRUD + scheduling logic + next-due-date calculation.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  ComplianceObligation,
  ComplianceObligationInput,
  ObligationFilters,
  RenewalFrequency,
} from '../types';
import { emitObligationDue, emitObligationCompleted } from './complianceEventService';

const COLLECTION = 'complianceObligations';

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));
}

// ── Next Due Date Calculation ──────────────────────────────────────────────

export function calculateNextDueDate(
  frequency: RenewalFrequency,
  fromDate?: Date,
  dayOfMonthDue?: number
): Date | null {
  const base = fromDate || new Date();
  const next = new Date(base);

  switch (frequency) {
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      if (dayOfMonthDue) next.setDate(Math.min(dayOfMonthDue, 28));
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      if (dayOfMonthDue) next.setDate(Math.min(dayOfMonthDue, 28));
      break;
    case 'semi_annually':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'annually':
      next.setFullYear(next.getFullYear() + 1);
      break;
    case 'biennial':
      next.setFullYear(next.getFullYear() + 2);
      break;
    case 'one_time':
    case 'ad_hoc':
      return null;
  }

  return next;
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function getComplianceObligations(
  companyId: string,
  filters?: ObligationFilters
): Promise<ComplianceObligation[]> {
  const constraints = [where('companyId', '==', companyId)];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.category) {
    constraints.push(where('category', '==', filters.category));
  }
  if (filters?.regulatoryBody) {
    constraints.push(where('regulatoryBody', '==', filters.regulatoryBody));
  }
  if (filters?.priority) {
    constraints.push(where('priority', '==', filters.priority));
  }

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  let obligations = snap.docs.map(d => ({ id: d.id, ...d.data() } as ComplianceObligation));
  // Sort client-side to avoid composite index requirement
  obligations.sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    obligations = obligations.filter(
      o =>
        o.title.toLowerCase().includes(search) ||
        o.description?.toLowerCase().includes(search)
    );
  }

  return obligations;
}

export async function getComplianceObligation(id: string): Promise<ComplianceObligation | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ComplianceObligation;
}

export async function createComplianceObligation(
  input: Partial<ComplianceObligationInput>
): Promise<ComplianceObligation> {
  const now = Timestamp.now();

  const nextDue = calculateNextDueDate(
    input.frequency || 'annually',
    undefined,
    input.dayOfMonthDue
  );

  const data = stripUndefined({
    ...input,
    status: input.status || 'active',
    autoCreateTasks: input.autoCreateTasks ?? true,
    nextDueDate: nextDue ? Timestamp.fromDate(nextDue) : undefined,
    createdAt: now,
    updatedAt: now,
  });

  const ref = await addDoc(collection(db, COLLECTION), data);
  return { id: ref.id, ...data } as ComplianceObligation;
}

export async function updateComplianceObligation(
  id: string,
  updates: Partial<ComplianceObligation>
): Promise<void> {
  const { id: _id, ...rest } = updates;
  const data = stripUndefined({
    ...rest,
    updatedAt: Timestamp.now(),
  });
  await updateDoc(doc(db, COLLECTION, id), data);
}

export async function deleteComplianceObligation(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

// ── Complete Obligation ────────────────────────────────────────────────────

export async function completeObligation(id: string, companyId: string): Promise<void> {
  const obligation = await getComplianceObligation(id);
  if (!obligation) throw new Error('Obligation not found');

  const now = new Date();
  const nextDue = calculateNextDueDate(
    obligation.frequency,
    now,
    obligation.dayOfMonthDue
  );

  await updateComplianceObligation(id, {
    lastCompletedDate: Timestamp.fromDate(now),
    nextDueDate: nextDue ? Timestamp.fromDate(nextDue) : undefined,
  } as Partial<ComplianceObligation>);

  emitObligationCompleted(id, companyId).catch(() => {});
}

// ── Scan Upcoming Obligations ──────────────────────────────────────────────

export async function scanUpcomingObligations(
  companyId: string,
  daysAhead: number = 7
): Promise<{ due: ComplianceObligation[]; overdue: ComplianceObligation[] }> {
  const obligations = await getComplianceObligations(companyId, { status: 'active' });
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const due: ComplianceObligation[] = [];
  const overdue: ComplianceObligation[] = [];

  for (const o of obligations) {
    if (!o.nextDueDate) continue;
    const dueDate = o.nextDueDate.toDate();

    if (dueDate < now) {
      overdue.push(o);
      emitObligationDue(o.id, companyId, true).catch(() => {});
    } else if (dueDate <= futureDate) {
      due.push(o);
      emitObligationDue(o.id, companyId, false).catch(() => {});
    }
  }

  return { due, overdue };
}
