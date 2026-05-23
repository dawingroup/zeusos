/**
 * resolveShareLink — public HTTPS resolver for asset share tokens.
 *
 * The SharedAssetPage POSTs { token } (no auth) and gets back the
 * asset / collection metadata plus a freshly-signed Cloud Storage URL
 * valid for one hour. Storage objects themselves stay private — the
 * signed URL is the only externally-issued read handle.
 *
 * Returns:
 *   200 — { kind: 'asset', asset, signedUrl } | { kind: 'collection', collection, items }
 *   404 — token unknown
 *   410 — token revoked OR expired
 *   400 — token malformed / missing
 *   500 — anything else
 *
 * CORS open — this is a public read-only endpoint.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

const SHARE_LINKS_COLL = 'share_links';
const ITEMS_COLL = 'asset_library_items';
const COLLECTIONS_COLL = 'asset_library_collections';

/** Hard cap on per-link TTL — mirrors the client-side cap. */
const MAX_TTL_MS = 90 * 24 * 60 * 60 * 1000;

exports.resolveShareLink = onRequest(
  {
    region: 'europe-west1',
    cors: true,
    invoker: 'public',
  },
  async (req, res) => {
    // Accept token from query (?token=…) or JSON body — keeps the
    // viewer page flexible (a simple <a href> works too).
    const token =
      (req.method === 'POST' && req.body && req.body.token) ||
      (req.query && req.query.token) ||
      null;

    if (!token || typeof token !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(token)) {
      res.status(400).json({ error: 'Missing or malformed token.' });
      return;
    }

    try {
      const db = getFirestore();
      const linkSnap = await db.collection(SHARE_LINKS_COLL).doc(token).get();
      if (!linkSnap.exists) {
        res.status(404).json({ error: 'Share link not found.' });
        return;
      }
      const link = linkSnap.data() || {};

      if (link.revoked === true) {
        res.status(410).json({ error: 'This share link has been revoked.' });
        return;
      }

      const expiresAtMs = toMillis(link.expiresAt);
      if (!expiresAtMs || expiresAtMs < Date.now()) {
        res.status(410).json({ error: 'This share link has expired.' });
        return;
      }
      // Defensive: refuse to honour anything claiming to live forever.
      if (expiresAtMs - Date.now() > MAX_TTL_MS) {
        res.status(410).json({ error: 'Share link TTL exceeds policy.' });
        return;
      }

      if (link.assetItemId) {
        const item = await loadAsset(db, link.assetItemId);
        if (!item) {
          res.status(404).json({ error: 'Underlying asset has been removed.' });
          return;
        }
        const signedUrl = await signObject(item.storageRef, !!link.allowDownload, item.name);
        res.status(200).json({
          kind: 'asset',
          asset: item,
          signedUrl,
          allowDownload: !!link.allowDownload,
          expiresAt: new Date(expiresAtMs).toISOString(),
        });
        return;
      }

      if (link.collectionId) {
        const collection = await loadCollection(db, link.collectionId);
        if (!collection) {
          res.status(404).json({ error: 'Underlying collection has been removed.' });
          return;
        }
        const items = [];
        for (const itemId of collection.itemIds || []) {
          const item = await loadAsset(db, itemId);
          if (!item) continue; // skip dangling references
          // Sign every item in the collection — the recipient lands on
          // a gallery view that needs to render each preview inline.
          item.signedUrl = await signObject(
            item.storageRef,
            !!link.allowDownload,
            item.name,
          );
          items.push(item);
        }
        res.status(200).json({
          kind: 'collection',
          collection,
          items,
          allowDownload: !!link.allowDownload,
          expiresAt: new Date(expiresAtMs).toISOString(),
        });
        return;
      }

      // Neither field set — malformed share link.
      res.status(500).json({ error: 'Share link target is undefined.' });
    } catch (err) {
      console.error('[resolveShareLink] failure', err);
      res.status(500).json({ error: 'Internal error resolving share link.' });
    }
  },
);

function toMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'string' || typeof ts === 'number') {
    const ms = new Date(ts).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (ts._seconds != null) return ts._seconds * 1000 + Math.floor((ts._nanoseconds || 0) / 1e6);
  return null;
}

async function loadAsset(db, itemId) {
  const snap = await db.collection(ITEMS_COLL).doc(itemId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    category: data.category,
    fileType: data.fileType,
    fileSizeBytes: data.fileSizeBytes,
    dimensions: data.dimensions || null,
    storageRef: data.storageRef,
    thumbnailUrl: data.thumbnailUrl || null,
    previewUrl: data.previewUrl || null,
  };
}

async function loadCollection(db, collectionId) {
  const snap = await db.collection(COLLECTIONS_COLL).doc(collectionId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return {
    id: snap.id,
    name: data.name,
    description: data.description || null,
    itemIds: data.itemIds || [],
  };
}

/**
 * Issue a v4 signed URL valid for 1 hour. `allowDownload` toggles
 * `responseDisposition`: `attachment` triggers a download dialog with
 * the asset name; `inline` previews in-browser.
 */
async function signObject(storageRef, allowDownload, suggestedFilename) {
  const bucket = getStorage().bucket();
  const file = bucket.file(storageRef);
  const safeName = (suggestedFilename || 'asset').replace(/[^A-Za-z0-9._-]+/g, '_');
  const disposition = allowDownload
    ? `attachment; filename="${safeName}"`
    : 'inline';
  const [signed] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000,
    responseDisposition: disposition,
  });
  return signed;
}
