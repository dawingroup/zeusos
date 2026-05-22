/**
 * Asset Collection service — CRUD plus item membership helpers.
 *
 * Collection: asset_library_collections/{collectionId}
 *
 * `itemIds` is stored as a flat array on the collection doc. The
 * add/remove helpers are idempotent: adding an item that's already
 * present is a no-op, and removing an item that isn't present is a
 * no-op rather than throwing. Callers don't need to dedupe themselves.
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
import type { AssetCollection } from '../types/asset-collection.types';

const COLLECTIONS_COLL = 'asset_library_collections';

// ─────────────────────────────────────────────────────────────────
// Collection CRUD
// ─────────────────────────────────────────────────────────────────

export async function createCollection(
  input: Omit<AssetCollection, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<AssetCollection> {
  const ref = await addDoc(collection(db, COLLECTIONS_COLL), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return getCollection(ref.id) as Promise<AssetCollection>;
}

export async function getCollection(
  collectionId: string,
): Promise<AssetCollection | null> {
  const snap = await getDoc(doc(db, COLLECTIONS_COLL, collectionId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<AssetCollection, 'id'>) };
}

export async function listCollections(filters: {
  clientId?: string;
  subsidiaryOrgId?: string;
} = {}): Promise<AssetCollection[]> {
  const constraints = [];
  if (filters.clientId)        constraints.push(where('clientId',        '==', filters.clientId));
  if (filters.subsidiaryOrgId) constraints.push(where('subsidiaryOrgId', '==', filters.subsidiaryOrgId));

  const q = constraints.length
    ? query(collection(db, COLLECTIONS_COLL), ...constraints, orderBy('name'))
    : query(collection(db, COLLECTIONS_COLL), orderBy('name'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssetCollection, 'id'>) }));
}

export async function updateCollection(
  collectionId: string,
  updates: Partial<Omit<AssetCollection, 'id' | 'createdAt' | 'createdBy'>>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS_COLL, collectionId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCollection(collectionId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTIONS_COLL, collectionId));
}

// ─────────────────────────────────────────────────────────────────
// Membership helpers — idempotent on both sides
// ─────────────────────────────────────────────────────────────────

export async function addItemToCollection(
  collectionId: string,
  itemId: string,
): Promise<void> {
  const current = await getCollection(collectionId);
  if (!current) throw new Error(`Collection ${collectionId} not found`);
  if (current.itemIds.includes(itemId)) return; // idempotent
  await updateCollection(collectionId, {
    itemIds: [...current.itemIds, itemId],
  });
}

export async function removeItemFromCollection(
  collectionId: string,
  itemId: string,
): Promise<void> {
  const current = await getCollection(collectionId);
  if (!current) throw new Error(`Collection ${collectionId} not found`);
  if (!current.itemIds.includes(itemId)) return; // idempotent — no error
  await updateCollection(collectionId, {
    itemIds: current.itemIds.filter((id) => id !== itemId),
  });
}
