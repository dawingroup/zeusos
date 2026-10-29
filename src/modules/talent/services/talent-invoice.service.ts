/**
 * Talent Invoice service — submit, approve, reject, and pay freelancer invoices.
 *
 * Approval business rules (enforced here, not just in Firestore rules):
 *   - Only SUBMITTED invoices can be APPROVED or REJECTED.
 *   - Only APPROVED invoices can be PAID.
 *   - REJECTED invoices cannot transition to PAID (guarded explicitly).
 *
 * When an invoice is APPROVED, a stub domain event is logged. In Phase 5
 * this will trigger a Cloud Function to generate a linked PO in Procurement.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { db } from '@/shared/services/firebase';
import { app } from '@/core/services/firebase/config';
import type { TalentInvoice, TalentInvoiceStatus } from '../types/talent-invoice.types';

const INVOICES_COLL    = 'talent_invoices';

export async function submitTalentInvoice(
  input: Omit<TalentInvoice, 'id' | 'status' | 'linkedPoId' | 'approvedBy' | 'approvedAt' | 'rejectedBy' | 'rejectedAt' | 'rejectionReason' | 'paidAt' | 'createdAt' | 'updatedAt'>,
): Promise<TalentInvoice> {
  const ref = await addDoc(collection(db, INVOICES_COLL), {
    ...input,
    status: 'SUBMITTED',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<TalentInvoice, 'id'>) };
}

export async function getTalentInvoice(invoiceId: string): Promise<TalentInvoice | null> {
  const snap = await getDoc(doc(db, INVOICES_COLL, invoiceId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<TalentInvoice, 'id'>) };
}

export async function listTalentInvoices(filters: {
  talentProfileId?: string;
  masterJobId?: string;
  status?: TalentInvoiceStatus;
} = {}): Promise<TalentInvoice[]> {
  const constraints = [];
  if (filters.talentProfileId) constraints.push(where('talentProfileId', '==', filters.talentProfileId));
  if (filters.masterJobId)     constraints.push(where('masterJobId',     '==', filters.masterJobId));
  if (filters.status)          constraints.push(where('status',          '==', filters.status));

  const q = constraints.length
    ? query(collection(db, INVOICES_COLL), ...constraints, orderBy('createdAt', 'desc'))
    : query(collection(db, INVOICES_COLL), orderBy('createdAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TalentInvoice, 'id'>) }));
}

/** What the approval callables return — one signature taken, or the record already approved. */
export interface ApproveSupplierInvoiceResult {
  id: string;
  status: 'APPROVED' | 'SUBMITTED' | 'PAID';
  /** The level this call signed (absent on an idempotent no-op). */
  level?: number;
  complete: boolean;
  pendingLevel?: number | null;
  bandId?: string;
  signaturesRequired?: number;
  skip?: 'already_approved';
}

export const approveTalentInvoiceFn: HttpsCallable<
  { invoiceId: string; note?: string; idempotencyKey?: string },
  ApproveSupplierInvoiceResult
> = httpsCallable(getFunctions(app, 'europe-west1'), 'approveTalentInvoice');

/**
 * Approve (sign) a talent invoice — a SERVER decision since routing v2 /
 * ADR-2026-10-25. The callable plans the signature ladder on first touch,
 * refuses the raiser and any machine actor, signs the lowest level the
 * caller may sign, and only moves the invoice to APPROVED (emitting
 * `TalentInvoiceApproved` for the PO consumer) when the last level lands.
 * Until then the invoice stays SUBMITTED with `approval.pendingLevel` set.
 *
 * The approver is the signed-in uid on the server — callers no longer pass it.
 */
export async function approveTalentInvoice(invoiceId: string, note?: string): Promise<ApproveSupplierInvoiceResult> {
  const res = await approveTalentInvoiceFn({ invoiceId, ...(note ? { note } : {}) });
  return res.data;
}

/** One line for a toast after a signature: "Approved" or how far the ladder got. */
export function describeApprovalProgress(r: ApproveSupplierInvoiceResult, ref: string): string {
  if (r.complete) return `Approved: ${ref}`;
  const total = r.signaturesRequired ?? '?';
  return `Signed level ${r.level ?? '?'} of ${total} for ${ref} — awaiting level ${r.pendingLevel ?? '?'}.`;
}

export async function rejectTalentInvoice(
  invoiceId: string,
  rejectedBy: string,
  rejectionReason: string,
): Promise<void> {
  const invoice = await getTalentInvoice(invoiceId);
  if (!invoice) throw new Error(`[talent-invoice] Invoice ${invoiceId} not found`);
  if (invoice.status !== 'SUBMITTED') {
    throw new Error(
      `[talent-invoice] Can only reject SUBMITTED invoices — current status: ${invoice.status}`,
    );
  }

  await updateDoc(doc(db, INVOICES_COLL, invoiceId), {
    status: 'REJECTED' satisfies TalentInvoiceStatus,
    rejectedBy,
    rejectionReason,
    rejectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markTalentInvoicePaid(
  invoiceId: string,
): Promise<void> {
  const invoice = await getTalentInvoice(invoiceId);
  if (!invoice) throw new Error(`[talent-invoice] Invoice ${invoiceId} not found`);
  if (invoice.status === 'REJECTED') {
    throw new Error(`[talent-invoice] REJECTED invoice cannot be marked PAID`);
  }
  if (invoice.status !== 'APPROVED') {
    throw new Error(
      `[talent-invoice] Invoice must be APPROVED before marking PAID — current status: ${invoice.status}`,
    );
  }

  await updateDoc(doc(db, INVOICES_COLL, invoiceId), {
    status: 'PAID' satisfies TalentInvoiceStatus,
    paidAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
