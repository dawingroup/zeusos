/**
 * Asset Version service — append-only version history per asset.
 *
 * Collection: asset_library_items/{itemId}/versions/{versionId}
 *
 * Adding a version writes the row and updates the parent item's
 * `currentVersionId` + storage mirror fields so the grid view shows
 * the latest revision without an extra query.
 *
 * Rolling back doesn't delete any row — it just re-points the parent
 * item to a previous version. Old references in campaigns / production
 * jobs therefore stay valid.
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { AssetVersion } from '../types/asset-version.types';

const ITEMS_COLL      = 'asset_library_items';
const VERSIONS_SUBCOLL = 'versions';

// ─────────────────────────────────────────────────────────────────
// Versions
// ─────────────────────────────────────────────────────────────────

export async function addVersion(
  itemId: string,
  input: Omit<AssetVersion, 'id' | 'uploadedAt'>,
): Promise<AssetVersion> {
  const versionsRef = collection(db, ITEMS_COLL, itemId, VERSIONS_SUBCOLL);
  const ref = await addDoc(versionsRef, {
    ...input,
    uploadedAt: serverTimestamp(),
  });

  // Mirror the new version onto the parent header so grid reads stay cheap.
  await updateDoc(doc(db, ITEMS_COLL, itemId), {
    currentVersionId: ref.id,
    storageRef: input.storageRef,
    fileSizeBytes: input.fileSizeBytes,
    updatedAt: serverTimestamp(),
  });

  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<AssetVersion, 'id'>) };
}

export async function listVersions(itemId: string): Promise<AssetVersion[]> {
  const snap = await getDocs(
    query(
      collection(db, ITEMS_COLL, itemId, VERSIONS_SUBCOLL),
      orderBy('uploadedAt', 'desc'),
    ),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AssetVersion, 'id'>) }));
}

/**
 * Stub: point the parent item back to a previous version.
 * Phase 5 will also copy the previous version's storageRef onto the
 * header so downloads serve the rolled-back file. For now we just
 * flip the pointer.
 */
export async function rollbackToVersion(
  itemId: string,
  versionId: string,
): Promise<void> {
  const versionSnap = await getDoc(
    doc(db, ITEMS_COLL, itemId, VERSIONS_SUBCOLL, versionId),
  );
  if (!versionSnap.exists()) {
    throw new Error(`Version ${versionId} not found on asset ${itemId}`);
  }
  const versionData = versionSnap.data() as Omit<AssetVersion, 'id'>;

  await updateDoc(doc(db, ITEMS_COLL, itemId), {
    currentVersionId: versionId,
    storageRef: versionData.storageRef,
    fileSizeBytes: versionData.fileSizeBytes,
    updatedAt: serverTimestamp(),
  });
}
