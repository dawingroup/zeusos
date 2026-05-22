/**
 * Media Supplier Invoice service — submit, approve, reject, and mark paid
 * supplier invoices from media houses / agencies.
 *
 * Approval / payment business rules (enforced here, not just in Firestore rules):
 *   - Only SUBMITTED invoices can be APPROVED or REJECTED.
 *   - Only APPROVED invoices can be marked PAID.
 *   - REJECTED invoices cannot transition to PAID (guarded explicitly).
 *
 * When an invoice is marked PAID, a domain event is emitted inside a batch
 * write so the procurement consumer can raise a PO and the finance consumer
 * can post a journal entry (Phase 4.1 procurement / finance handshake).
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
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  MediaSupplierInvoice,
  MediaSupplierInvoiceStatus,
} from '../types/media-supplier-invoice.types';

const INVOICES_COLL = 'media_supplier_invoices';
const DOMAIN_EVENTS = 'domain_events';

export async function submitMediaSupplierInvoice(
  input: Omit<
    MediaSupplierInvoice,
    | 'id'
    | 'status'
    | 'linkedPoId'
    | 'approvedBy'
    | 'approvedAt'
    | 'rejectedBy'
    | 'rejectedAt'
    | 'rejectionReason'
    | 'paidAt'
    | 'paidBy'
    | 'createdAt'
    | 'updatedAt'
  >,
): Promise<MediaSupplierInvoice> {
  const ref = await addDoc(collection(db, INVOICES_COLL), {
    ...input,
    status: 'SUBMITTED',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<MediaSupplierInvoice, 'id'>) };
}

export async function getMediaSupplierInvoice(
  invoiceId: string,
): Promise<MediaSupplierInvoice | null> {
  const snap = await getDoc(doc(db, INVOICES_COLL, invoiceId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<MediaSupplierInvoice, 'id'>) };
}

export async function listMediaSupplierInvoices(filters: {
  supplierOrgId?: string;
  mediaPlanId?: string;
  masterJobId?: string;
  status?: MediaSupplierInvoiceStatus;
} = {}): Promise<MediaSupplierInvoice[]> {
  const constraints = [];
  if (filters.supplierOrgId) constraints.push(where('supplierOrgId', '==', filters.supplierOrgId));
  if (filters.mediaPlanId) constraints.push(where('mediaPlanId', '==', filters.mediaPlanId));
  if (filters.masterJobId) constraints.push(where('masterJobId', '==', filters.masterJobId));
  if (filters.status) constraints.push(where('status', '==', filters.status));

  const q =
    constraints.length > 0
      ? query(collection(db, INVOICES_COLL), ...constraints, orderBy('createdAt', 'desc'))
      : query(collection(db, INVOICES_COLL), orderBy('createdAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MediaSupplierInvoice, 'id'>) }));
}

export async function approveMediaSupplierInvoice(
  invoiceId: string,
  approvedBy: string,
): Promise<void> {
  const invoice = await getMediaSupplierInvoice(invoiceId);
  if (!invoice) throw new Error(`[media-supplier-invoice] Invoice ${invoiceId} not found`);
  if (invoice.status !== 'SUBMITTED') {
    throw new Error(
      `[media-supplier-invoice] Can only approve SUBMITTED invoices — current status: ${invoice.status}`,
    );
  }

  await updateDoc(doc(db, INVOICES_COLL, invoiceId), {
    status: 'APPROVED' satisfies MediaSupplierInvoiceStatus,
    approvedBy,
    approvedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function rejectMediaSupplierInvoice(
  invoiceId: string,
  rejectedBy: string,
  rejectionReason: string,
): Promise<void> {
  const invoice = await getMediaSupplierInvoice(invoiceId);
  if (!invoice) throw new Error(`[media-supplier-invoice] Invoice ${invoiceId} not found`);
  if (invoice.status !== 'SUBMITTED') {
    throw new Error(
      `[media-supplier-invoice] Can only reject SUBMITTED invoices — current status: ${invoice.status}`,
    );
  }

  await updateDoc(doc(db, INVOICES_COLL, invoiceId), {
    status: 'REJECTED' satisfies MediaSupplierInvoiceStatus,
    rejectedBy,
    rejectionReason,
    rejectedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markMediaSupplierInvoicePaid(
  invoiceId: string,
  paidBy: string,
): Promise<void> {
  const invoice = await getMediaSupplierInvoice(invoiceId);
  if (!invoice) throw new Error(`[media-supplier-invoice] Invoice ${invoiceId} not found`);
  if (invoice.status === 'REJECTED') {
    throw new Error(`[media-supplier-invoice] REJECTED invoice cannot be marked PAID`);
  }
  if (invoice.status !== 'APPROVED') {
    throw new Error(
      `[media-supplier-invoice] Invoice must be APPROVED before marking PAID — current status: ${invoice.status}`,
    );
  }

  const batch = writeBatch(db);

  // Update invoice status to PAID
  batch.update(doc(db, INVOICES_COLL, invoiceId), {
    status: 'PAID' satisfies MediaSupplierInvoiceStatus,
    paidAt: serverTimestamp(),
    paidBy,
    updatedAt: serverTimestamp(),
  });

  // Emit domain event for Phase 4.1 procurement consumer (onMediaSupplierInvoicePaid).
  // The Cloud Function will read this event and create a linked PO in Procurement.
  const eventRef = doc(collection(db, DOMAIN_EVENTS));
  batch.set(eventRef, {
    id: eventRef.id,
    eventType: 'MediaSupplierInvoicePaid',
    aggregateType: 'MediaSupplierInvoice',
    aggregateId: invoiceId,
    payload: {
      mediaSupplierInvoiceId: invoiceId,
      supplierOrgId: invoice.supplierOrgId,
      mediaPlanId: invoice.mediaPlanId,
      mediaBuyId: invoice.mediaBuyId || null,
      masterJobId: invoice.masterJobId,
      vehicleType: invoice.vehicleType,
      amountMinor: invoice.amountMinor,
      currency: invoice.currency,
      orgId: invoice.orgId,
    },
    emittedByUserId: paidBy,
    emittedAt: serverTimestamp(),
    processed: false,
    processedBy: [],
  });

  await batch.commit();
}
