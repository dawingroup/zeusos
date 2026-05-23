/**
 * Supplier directory service — CRUD for supplier_orgs.
 *
 * Status transition rules (enforced here in addition to Firestore rules):
 *   - ACTIVE      → INACTIVE     (free)
 *   - INACTIVE    → ACTIVE       (free; re-activation)
 *   - ACTIVE      → BLACKLISTED  (requires reason, sets blacklistedAt/By)
 *   - INACTIVE    → BLACKLISTED  (same)
 *   - BLACKLISTED → ACTIVE       (allowed — admin override; clears blacklist fields)
 *
 * Soft-delete model: no delete operation; INACTIVE is the equivalent.
 * Hard delete is admin-only via Firestore rules and intentionally not
 * exposed in this service.
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
import { db } from '@/shared/services/firebase';
import type {
  Supplier,
  SupplierKind,
  SupplierStatus,
} from '../types/supplier.types';

const SUPPLIERS_COLL = 'supplier_orgs';

type CreateSupplierInput = Omit<
  Supplier,
  | 'id'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'blacklistedAt'
  | 'blacklistedBy'
  | 'blacklistReason'
>;

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  if (!input.name?.trim()) {
    throw new Error('[supplier] name is required');
  }
  if (!input.kind) {
    throw new Error('[supplier] kind is required');
  }
  if (!input.currency) {
    throw new Error('[supplier] currency is required');
  }
  if (!input.paymentTerms) {
    throw new Error('[supplier] paymentTerms is required');
  }

  const ref = await addDoc(collection(db, SUPPLIERS_COLL), {
    ...input,
    name: input.name.trim(),
    status: 'ACTIVE' satisfies SupplierStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<Supplier, 'id'>) };
}

export async function getSupplier(supplierId: string): Promise<Supplier | null> {
  const snap = await getDoc(doc(db, SUPPLIERS_COLL, supplierId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Supplier, 'id'>) };
}

export async function listSuppliers(filters: {
  kind?: SupplierKind;
  status?: SupplierStatus;
  countryCode?: string;
} = {}): Promise<Supplier[]> {
  const constraints = [];
  if (filters.kind) constraints.push(where('kind', '==', filters.kind));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.countryCode) constraints.push(where('countryCode', '==', filters.countryCode));

  const q = constraints.length
    ? query(collection(db, SUPPLIERS_COLL), ...constraints, orderBy('name'))
    : query(collection(db, SUPPLIERS_COLL), orderBy('name'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Supplier, 'id'>) }));
}

export async function updateSupplier(
  supplierId: string,
  patch: Partial<Omit<Supplier, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'blacklistedAt' | 'blacklistedBy' | 'blacklistReason'>>,
): Promise<void> {
  const existing = await getSupplier(supplierId);
  if (!existing) throw new Error(`[supplier] ${supplierId} not found`);

  await updateDoc(doc(db, SUPPLIERS_COLL, supplierId), {
    ...patch,
    ...(patch.name ? { name: patch.name.trim() } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function deactivateSupplier(supplierId: string): Promise<void> {
  const existing = await getSupplier(supplierId);
  if (!existing) throw new Error(`[supplier] ${supplierId} not found`);
  if (existing.status === 'BLACKLISTED') {
    throw new Error('[supplier] BLACKLISTED supplier cannot be deactivated directly; reactivate first');
  }

  await updateDoc(doc(db, SUPPLIERS_COLL, supplierId), {
    status: 'INACTIVE' satisfies SupplierStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function activateSupplier(supplierId: string): Promise<void> {
  const existing = await getSupplier(supplierId);
  if (!existing) throw new Error(`[supplier] ${supplierId} not found`);

  // Reactivating from BLACKLISTED clears the blacklist metadata
  const wasBlacklisted = existing.status === 'BLACKLISTED';
  await updateDoc(doc(db, SUPPLIERS_COLL, supplierId), {
    status: 'ACTIVE' satisfies SupplierStatus,
    updatedAt: serverTimestamp(),
    ...(wasBlacklisted
      ? { blacklistedAt: null, blacklistedBy: null, blacklistReason: null }
      : {}),
  });
}

export async function blacklistSupplier(
  supplierId: string,
  blacklistedBy: string,
  reason: string,
): Promise<void> {
  const existing = await getSupplier(supplierId);
  if (!existing) throw new Error(`[supplier] ${supplierId} not found`);
  if (!reason?.trim()) {
    throw new Error('[supplier] blacklist reason is required');
  }

  await updateDoc(doc(db, SUPPLIERS_COLL, supplierId), {
    status: 'BLACKLISTED' satisfies SupplierStatus,
    blacklistedAt: serverTimestamp(),
    blacklistedBy,
    blacklistReason: reason.trim(),
    updatedAt: serverTimestamp(),
  });
}
