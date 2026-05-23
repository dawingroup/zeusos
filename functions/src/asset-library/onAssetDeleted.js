/**
 * onAssetDeleted — Phase 5.C storage-cleanup trigger.
 *
 * Firestore trigger on `asset_library_items/{itemId}` deletes. Sweeps
 * the matching Storage tree (`asset-library/{itemId}/` — source,
 * thumb, preview) so deleted assets don't leave orphaned bytes behind.
 *
 * Also revokes any outstanding `share_links` that pointed at this
 * asset, so external recipients get a clean 410 Gone instead of a
 * "underlying asset has been removed" 404 from the resolver.
 *
 * Idempotent and best-effort: a missing Storage prefix is normal
 * (non-raster assets, or a delete fired before upload finished).
 * Errors are logged but not re-thrown — a failed sweep should not
 * resurrect a deleted Firestore doc.
 */

const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

exports.onAssetDeleted = onDocumentDeleted(
  {
    document: 'asset_library_items/{itemId}',
    region: 'europe-west1',
  },
  async (event) => {
    const itemId = event.params && event.params.itemId;
    if (!itemId) return;

    const prefix = `asset-library/${itemId}/`;

    // 1. Sweep Storage. `getFiles({ prefix })` returns the source,
    // thumb, and preview objects this asset owns.
    try {
      const bucket = getStorage().bucket();
      const [files] = await bucket.getFiles({ prefix });
      if (files.length > 0) {
        await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));
        console.info(
          `[onAssetDeleted] swept ${files.length} object(s) under ${prefix}`,
        );
      }
    } catch (err) {
      console.error(`[onAssetDeleted] storage sweep failed for ${itemId}`, err);
    }

    // 2. Revoke any share links pointing at this asset. Use a
    // batched update — there will rarely be more than a handful per
    // asset.
    try {
      const db = getFirestore();
      const snap = await db
        .collection('share_links')
        .where('assetItemId', '==', itemId)
        .get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((d) => {
          batch.update(d.ref, {
            revoked: true,
            revokedAt: FieldValue.serverTimestamp(),
            revokedReason: 'asset_deleted',
          });
        });
        await batch.commit();
        console.info(
          `[onAssetDeleted] revoked ${snap.size} share link(s) for ${itemId}`,
        );
      }
    } catch (err) {
      console.error(`[onAssetDeleted] share-link revoke failed for ${itemId}`, err);
    }
  },
);
