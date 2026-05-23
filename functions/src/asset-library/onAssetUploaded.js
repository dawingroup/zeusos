/**
 * onAssetUploaded — Phase 5.C thumbnail generator for the Asset Library.
 *
 * Storage trigger on `asset-library/{itemId}/source/{fileName}`. When a
 * staff member uploads an asset source file, this handler produces two
 * derivatives with sharp and writes the public download URLs onto the
 * matching `asset_library_items/{itemId}` doc.
 *
 *   - thumb/200.jpg  → AssetCard / AssetGrid preview (square, fit-inside)
 *   - preview/800.jpg → AssetDetailPage hero (longest edge 800px)
 *
 * Non-raster file types (PDF, video, fonts, office, archive, etc.) are
 * skipped — the UI falls back to a category-shaped placeholder.
 *
 * Idempotency: thumbs land at deterministic paths under
 * `asset-library/{itemId}/...`. A re-trigger overwrites; that's fine.
 * The Firestore write merges `thumbnailUrl` / `previewUrl` so prior
 * fields on the doc stay intact.
 */

const { onObjectFinalized } = require('firebase-functions/v2/storage');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const path = require('path');
const os = require('os');
const fs = require('fs');
const sharp = require('sharp');

const SOURCE_PATH_RE = /^asset-library\/([^/]+)\/source\/([^/]+)$/;

const RASTER_CONTENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/avif',
]);

exports.onAssetUploaded = onObjectFinalized(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (event) => {
    const object = event.data;
    if (!object || !object.name) return;

    const match = SOURCE_PATH_RE.exec(object.name);
    if (!match) return; // not an asset-library source upload — ignore

    const [, itemId] = match;
    const contentType = object.contentType || '';
    if (!RASTER_CONTENT_TYPES.has(contentType)) {
      // Non-raster: nothing to thumbnail. The UI falls back to a
      // category-shaped placeholder via AssetCard.
      return;
    }

    const bucket = getStorage().bucket(object.bucket);
    const sourceFile = bucket.file(object.name);

    // Download to /tmp so sharp can read from disk (cheaper than holding
    // the entire buffer in memory for large source files).
    const tmpSource = path.join(os.tmpdir(), `${itemId}-source`);
    const tmpThumb = path.join(os.tmpdir(), `${itemId}-thumb.jpg`);
    const tmpPreview = path.join(os.tmpdir(), `${itemId}-preview.jpg`);

    await sourceFile.download({ destination: tmpSource });

    try {
      await sharp(tmpSource)
        .rotate() // honour EXIF orientation
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toFile(tmpThumb);

      await sharp(tmpSource)
        .rotate()
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 86 })
        .toFile(tmpPreview);

      const thumbDest = `asset-library/${itemId}/thumb/200.jpg`;
      const previewDest = `asset-library/${itemId}/preview/800.jpg`;

      const [thumbFile] = await Promise.all([
        bucket.upload(tmpThumb, {
          destination: thumbDest,
          metadata: {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000, immutable',
          },
        }),
        bucket.upload(tmpPreview, {
          destination: previewDest,
          metadata: {
            contentType: 'image/jpeg',
            cacheControl: 'public, max-age=31536000, immutable',
          },
        }),
      ]);

      // Use Firebase Hosting-style download URLs (token-protected, no
      // ACL change required). Same shape the web SDK produces from
      // `getDownloadURL`, so the client can render them directly.
      const thumbnailUrl = await firebaseDownloadUrl(bucket.name, thumbDest);
      const previewUrl = await firebaseDownloadUrl(bucket.name, previewDest);

      await getFirestore()
        .collection('asset_library_items')
        .doc(itemId)
        .set(
          {
            thumbnailUrl,
            previewUrl,
            thumbnailGeneratedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
    } finally {
      // Best-effort cleanup; ignore errors (functions container is
      // ephemeral anyway).
      for (const p of [tmpSource, tmpThumb, tmpPreview]) {
        try { fs.unlinkSync(p); } catch (_) { /* noop */ }
      }
    }
  },
);

/**
 * Generate a Firebase download URL with a freshly-issued access token.
 * Matches the shape produced by the client SDK's `getDownloadURL`, so
 * the React app can render the URL straight into an <img>.
 */
async function firebaseDownloadUrl(bucketName, objectPath) {
  const { v4: uuid } = require('uuid');
  const token = uuid();
  const file = getStorage().bucket(bucketName).file(objectPath);
  await file.setMetadata({
    metadata: { firebaseStorageDownloadTokens: token },
  });
  return (
    `https://firebasestorage.googleapis.com/v0/b/${bucketName}` +
    `/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
  );
}
