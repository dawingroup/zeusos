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
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';
import { db } from '@/shared/services/firebase';
import { app } from '@/shared/services/firebase/config';
import type {
  AssetItem,
  AssetCategory,
  AssetStatus,
} from '../types/asset-item.types';
import type { AssetUsage } from '../types/asset-usage.types';

const ITEMS_COLL    = 'asset_library_items';
const USAGES_SUBCOLL = 'usages';

/**
 * Path layout the `onAssetUploaded` Cloud Function listens on. Uploading
 * to anything else will not trigger thumbnail generation.
 */
export function assetSourceStoragePath(itemId: string, fileName: string): string {
  // Strip any directory separators from the filename — paranoia against
  // a user-supplied name like "../foo".
  const safeName = fileName.replace(/[\\/]+/g, '_');
  return `asset-library/${itemId}/source/${safeName}`;
}

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

/**
 * Create the AssetItem doc and upload the source file in one shot.
 *
 * Flow:
 *   1. Reserve a Firestore doc id so we can compute the storage path.
 *   2. Upload to `asset-library/{itemId}/source/{fileName}` — this is
 *      the path the `onAssetUploaded` Cloud Function watches; it will
 *      asynchronously populate `thumbnailUrl` and `previewUrl` on the
 *      same doc.
 *   3. Write the AssetItem doc with the resolved `storageRef`.
 *
 * The caller doesn't need to do anything to surface the thumbnail —
 * the trigger will write it back, and existing readers (AssetCard /
 * AssetGrid / AssetDetailPage) re-render on the next fetch.
 */
export async function createAssetWithUpload(
  input: Omit<AssetItem, 'id' | 'createdAt' | 'updatedAt' | 'storageRef' | 'fileSizeBytes' | 'thumbnailUrl' | 'previewUrl'>,
  file: File,
): Promise<AssetItem> {
  // Reserve the Firestore id so the storage path can reference it.
  const itemRef = doc(collection(db, ITEMS_COLL));
  const path = assetSourceStoragePath(itemRef.id, file.name);

  const storage = getStorage(app);
  await uploadBytes(storageRef(storage, path), file, {
    contentType: file.type || undefined,
  });

  await setDoc(itemRef, {
    ...input,
    storageRef: path,
    fileSizeBytes: file.size,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return (await getAsset(itemRef.id)) as AssetItem;
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

/**
 * Replace the source file for an existing asset. Uploads to the
 * `asset-library/{itemId}/source/{newName}` path and updates the
 * doc's `storageRef` + `fileSizeBytes`. The `onAssetUploaded` Cloud
 * Function fires automatically and regenerates thumbnails.
 *
 * The previous source file is left in storage as an orphan — the
 * `onAssetDeleted` Cloud Function sweeps the entire
 * `asset-library/{itemId}/` prefix when the asset is deleted, so the
 * orphan eventually goes away.
 */
export async function replaceAssetSource(itemId: string, file: File): Promise<void> {
  const path = assetSourceStoragePath(itemId, file.name);
  const storage = getStorage(app);
  await uploadBytes(storageRef(storage, path), file, {
    contentType: file.type || undefined,
  });
  await updateDoc(doc(db, ITEMS_COLL, itemId), {
    storageRef: path,
    fileSizeBytes: file.size,
    // Clear the cached thumbnail URLs; the trigger will repopulate
    // them once the new source has been processed. Until then the UI
    // falls back to the category placeholder.
    thumbnailUrl: null,
    previewUrl: null,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveAsset(itemId: string): Promise<void> {
  await updateAsset(itemId, { status: 'ARCHIVED' });
}

/**
 * Hard-delete an asset from Firestore. The matching Storage tree
 * (`asset-library/{itemId}/source/*`, `/thumb/*`, `/preview/*`) is
 * swept by the `onAssetDeleted` Cloud Function.
 *
 * Firestore rules require admin to delete — non-admin callers get a
 * permission-denied error from this method.
 */
export async function deleteAsset(itemId: string): Promise<void> {
  await deleteDoc(doc(db, ITEMS_COLL, itemId));
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
