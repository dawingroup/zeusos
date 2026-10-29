/**
 * Supplier-invoice feeds for the approvals inbox — freelancer (talent) and
 * media-house invoices awaiting AM approval.
 *
 * Both collections are readable by any staff principal (`isStaffAuth()`),
 * but only a parent-org principal may approve (`update: isParentOrgPrincipal()`),
 * so the inbox opens these for the parent scope only — a brand user would
 * see rows they cannot act on.
 */

import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type { MediaSupplierInvoiceInput, TalentInvoiceInput } from '../approvalsProjection';

export function subscribeSubmittedTalentInvoices(
  callback: (rows: TalentInvoiceInput[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'talent_invoices'), where('status', '==', 'SUBMITTED'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TalentInvoiceInput, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export function subscribeSubmittedMediaSupplierInvoices(
  callback: (rows: MediaSupplierInvoiceInput[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, 'media_supplier_invoices'), where('status', '==', 'SUBMITTED'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MediaSupplierInvoiceInput, 'id'>) }))),
    (err) => onError?.(err),
  );
}
