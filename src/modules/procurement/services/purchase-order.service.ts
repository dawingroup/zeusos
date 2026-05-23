/**
 * Purchase Order service — reads + manual VENDOR_OTHER writes.
 *
 * TALENT_FREELANCER and MEDIA_SUPPLIER POs are written by Cloud Functions
 * (onTalentInvoiceApproved + onMediaSupplierInvoicePaid) using the Admin
 * SDK. Admins can additionally create/update/delete VENDOR_OTHER POs
 * (print, props, catering, ad-hoc) via the manual-entry UI; firestore.rules
 * enforces the kind restriction.
 *
 * Org-scoping: queries are filtered by orgId so subsidiaries don't see
 * each other's supplier costs (spec §7.4 commercial gravity).
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  limit as limitFn,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  PurchaseOrder,
  PurchaseOrderKind,
  PurchaseOrderStatus,
} from '../types/purchase-order.types';

const POS_COLL = 'purchase_orders';

export async function getPurchaseOrder(poId: string): Promise<PurchaseOrder | null> {
  const snap = await getDoc(doc(db, POS_COLL, poId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<PurchaseOrder, 'id'>) };
}

export async function listPurchaseOrders(filters: {
  orgId: string;
  kind?: PurchaseOrderKind;
  status?: PurchaseOrderStatus;
  masterJobId?: string;
  limit?: number;
} = { orgId: '' }): Promise<PurchaseOrder[]> {
  if (!filters.orgId) {
    throw new Error('[purchase-order] orgId filter is required (spec §7.4 commercial gravity)');
  }

  const constraints = [where('orgId', '==', filters.orgId)];
  if (filters.kind) constraints.push(where('kind', '==', filters.kind));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.masterJobId) constraints.push(where('masterJobId', '==', filters.masterJobId));

  const q = filters.limit
    ? query(collection(db, POS_COLL), ...constraints, orderBy('createdAt', 'desc'), limitFn(filters.limit))
    : query(collection(db, POS_COLL), ...constraints, orderBy('createdAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PurchaseOrder, 'id'>) }));
}

export async function getPurchaseOrderBySourceInvoice(
  sourceInvoiceId: string,
): Promise<PurchaseOrder | null> {
  const q = query(
    collection(db, POS_COLL),
    where('sourceInvoiceId', '==', sourceInvoiceId),
    limitFn(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<PurchaseOrder, 'id'>) };
}

// ─────────────────────────────────────────────────────────────────
// Manual entry — VENDOR_OTHER only. Rules enforce the kind constraint.
// ─────────────────────────────────────────────────────────────────

export interface CreateManualPOInput {
  orgId: string;
  supplierOrgId?: string;
  amountMinor: number;
  currency: PurchaseOrder['currency'];
  masterJobId: string;
  sourceInvoiceId?: string;   // optional external reference (e.g. supplier doc #)
  notes?: string;
  raisedBy: string;
}

/**
 * Create a manual VENDOR_OTHER PO. Doc id is generated client-side so
 * the manual path stays distinct from the deterministic auto-raised ids.
 */
export async function createManualPurchaseOrder(
  input: CreateManualPOInput,
): Promise<PurchaseOrder> {
  const id = `po_vendor_manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const ref = doc(db, POS_COLL, id);
  const payload = {
    kind: 'VENDOR_OTHER' as const,
    sourceInvoiceId: input.sourceInvoiceId ?? id,
    supplierOrgId: input.supplierOrgId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    masterJobId: input.masterJobId,
    status: 'OPEN' as PurchaseOrderStatus,
    postedToGL: false,
    orgId: input.orgId,
    raisedBy: input.raisedBy,
    notes: input.notes,
    raisedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<PurchaseOrder, 'id'>) };
}

export async function updatePurchaseOrder(
  poId: string,
  updates: Partial<Pick<PurchaseOrder, 'amountMinor' | 'currency' | 'status' | 'masterJobId' | 'supplierOrgId' | 'sourceInvoiceId'>> & { notes?: string },
): Promise<void> {
  await updateDoc(doc(db, POS_COLL, poId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deletePurchaseOrder(poId: string): Promise<void> {
  await deleteDoc(doc(db, POS_COLL, poId));
}
