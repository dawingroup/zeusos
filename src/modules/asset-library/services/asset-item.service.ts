/**
 * Asset Item service — CRUD operations against Firestore.
 *
 * Collection: asset_library_items/{itemId}
 *
 * Usages live in a subcollection (asset_library_items/{itemId}/usages)
 * managed by helpers here. Versions live in their own service module.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  AssetItem,
  AssetCategory,
  AssetStatus,
} from '../types/asset-item.types';
import type { AssetUsage } from '../types/asset-usage.types';

const ITEMS_COLL    = 'asset_library_items';
const USAGES_SUBCOLL = 'usages';

// ─────────────────────────────────────────────────────────────────
// AssetItem CRUD
// ─────────────────────────────────────────────────────────────────

export async function createAsset(
  input: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<AssetItem> {
  const ref = await addDoc(collection(db, ITEMS_COLL), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getAsset(ref.id) as Promise<AssetItem>;
}

export async function getAsset(itemId: string): Promise<AssetItem | null> {
  const snap = await getDoc(doc(db, ITEMS_COLL, itemId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<AssetItem, 'id'>) };
}

export async function listAssets(filters: {
  category?: AssetCategory;
  clientId?: string;
  subsidiaryOrgId?: string;
  status?: AssetStatus;
  tag?: string;
} = {}): Promise<AssetItem[]> {
  const constraints = [];
  if (filters.category)        constraints.push(where('category',        '==', filters.category));
  if (filters.clientId)        constraints.push(where('clientId',        '==', filters.clientId));
  if (filters.subsidiaryOrgId) constraints.push(where('subsidiaryOrgId', '==', filters.subsidiaryOrgId));
  if (filters.status)          constraints.push(where('status',          '==', filters.status));
  if (filters.tag)             constraints.push(where('tags', 'array-contains', filters.tag));

  const q = constraints.length
    ? query(collection(db, ITEMS_COLL), ...constraints, orderBy('createdAt', 'desc'))
    : query(collection(db, ITEMS_COLL), orderBy('createdAt', 'desc'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssetItem, 'id'>) }));
}

export async function updateAsset(
  itemId: string,
  updates: Partial<Omit<AssetItem, 'id' | 'createdAt' | 'uploadedBy'>>,
): Promise<void> {
  await updateDoc(doc(db, ITEMS_COLL, itemId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveAsset(itemId: string): Promise<void> {
  await updateAsset(itemId, { status: 'ARCHIVED' });
}

// ─────────────────────────────────────────────────────────────────
// Usage tracking
// ─────────────────────────────────────────────────────────────────

export async function recordAssetUsage(
  itemId: string,
  input: Omit<AssetUsage, 'id' | 'addedAt'>,
): Promise<AssetUsage> {
  const usagesRef = collection(db, ITEMS_COLL, itemId, USAGES_SUBCOLL);
  const ref = await addDoc(usagesRef, {
    ...input,
    addedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<AssetUsage, 'id'>) };
}

export async function listAssetUsages(itemId: string): Promise<AssetUsage[]> {
  const snap = await getDocs(
    query(
      collection(db, ITEMS_COLL, itemId, USAGES_SUBCOLL),
      orderBy('addedAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssetUsage, 'id'>) }));
}

export async function removeAssetUsage(itemId: string, usageId: string): Promise<void> {
  await deleteDoc(doc(db, ITEMS_COLL, itemId, USAGES_SUBCOLL, usageId));
}
