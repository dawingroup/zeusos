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
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { TalentInvoice, TalentInvoiceStatus } from '../types/talent-invoice.types';

const INVOICES_COLL    = 'talent_invoices';
const DOMAIN_EVENTS    = 'domain_events';

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

export async function approveTalentInvoice(
  invoiceId: string,
  approvedBy: string,
): Promise<void> {
  const invoice = await getTalentInvoice(invoiceId);
  if (!invoice) throw new Error(`[talent-invoice] Invoice ${invoiceId} not found`);
  if (invoice.status !== 'SUBMITTED') {
    throw new Error(
      `[talent-invoice] Can only approve SUBMITTED invoices — current status: ${invoice.status}`,
    );
  }

  const batch = writeBatch(db);

  // Update invoice status
  batch.update(doc(db, INVOICES_COLL, invoiceId), {
    status: 'APPROVED' satisfies TalentInvoiceStatus,
    approvedBy,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Emit domain event for Phase 4.1 procurement consumer (onTalentInvoiceApproved).
  // The Cloud Function will read this event and create a linked PO in Procurement.
  const eventRef = doc(collection(db, DOMAIN_EVENTS));
  batch.set(eventRef, {
    id: eventRef.id,
    eventType: 'TalentInvoiceApproved',
    aggregateType: 'TalentInvoice',
    aggregateId: invoiceId,
    payload: {
      talentInvoiceId: invoiceId,
      talentProfileId: invoice.talentProfileId,
      masterJobId: invoice.masterJobId,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      orgId: invoice.orgId,
    },
    emittedByUserId: approvedBy,
    emittedAt: serverTimestamp(),
    processed: false,
    processedBy: [],
  });

  await batch.commit();
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
