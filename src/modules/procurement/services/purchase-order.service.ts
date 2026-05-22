/**
 * Purchase Order service — read POs raised by the Phase 4.1 procurement
 * consumers (onTalentInvoiceApproved + onMediaSupplierInvoicePaid).
 *
 * Writes are Cloud-Function-only (firestore.rules enforces this). The UI
 * is purely a viewer onto the procurement-side ledger.
 *
 * Org-scoping: queries are filtered by orgId so subsidiaries don't see
 * each other's supplier costs (spec §7.4 commercial gravity).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
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
