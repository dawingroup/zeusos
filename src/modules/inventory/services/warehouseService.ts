/**
 * Warehouse Service
 * CRUD operations for warehouse/storage location management
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { Warehouse } from '../types/warehouse';

const WAREHOUSES_COLLECTION = 'warehouses';

/** Strip undefined values — Firestore rejects them */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as T;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new warehouse
 */
export async function createWarehouse(
  data: Omit<Warehouse, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<string> {
  const warehouseData = {
    ...stripUndefined(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, WAREHOUSES_COLLECTION), warehouseData);
  return docRef.id;
}

/**
 * Update an existing warehouse
 */
export async function updateWarehouse(
  warehouseId: string,
  data: Partial<Pick<Warehouse, 'name' | 'code' | 'type' | 'address' | 'isActive'>>,
): Promise<void> {
  const docRef = doc(db, WAREHOUSES_COLLECTION, warehouseId);
  await updateDoc(docRef, {
    ...stripUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get a single warehouse by ID
 */
export async function getWarehouse(warehouseId: string): Promise<Warehouse | null> {
  const docRef = doc(db, WAREHOUSES_COLLECTION, warehouseId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Warehouse;
}

/**
 * Get all warehouses for a subsidiary
 */
export async function getWarehouses(subsidiaryId: string): Promise<Warehouse[]> {
  const q = query(
    collection(db, WAREHOUSES_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
  );
  const snap = await getDocs(q);
  const warehouses = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Warehouse));
  return warehouses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Get only active warehouses for a subsidiary
 */
export async function getActiveWarehouses(subsidiaryId: string): Promise<Warehouse[]> {
  const q = query(
    collection(db, WAREHOUSES_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('isActive', '==', true),
  );
  const snap = await getDocs(q);
  const warehouses = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Warehouse));
  return warehouses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

// ============================================
// Real-time Subscriptions
// ============================================

/**
 * Subscribe to warehouses for a subsidiary (real-time)
 */
export function subscribeToWarehouses(
  subsidiaryId: string,
  callback: (warehouses: Warehouse[]) => void,
): () => void {
  const q = query(
    collection(db, WAREHOUSES_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
  );

  return onSnapshot(q, (snapshot) => {
    const warehouses = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as Warehouse));
    warehouses.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    callback(warehouses);
  });
}
