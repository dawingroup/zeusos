# Asset Library (DAM-lite) — Deploy Notes

Phase 5.C wires real Cloud Storage uploads, server-side thumbnail
generation, and public share links into the Asset Library scaffold
that landed in Phase 4. This doc covers the deploy mechanics and the
runtime contract between the client and the Cloud Functions.

## Components

| Layer | Path | Notes |
|---|---|---|
| Storage rules | `storage.rules` (asset-library/* block) | Only staff can write `source/`; `thumb/` + `preview/` are CF-only. |
| Firestore rules | `firestore.rules` (asset_library_items / collections / share_links) | Subsidiary scoping + parent-org override. Share-link docs are server-side-only. |
| Service (client) | `src/modules/asset-library/services/asset-item.service.ts` | `createAssetWithUpload(input, file)` uploads to `asset-library/{itemId}/source/{name}` then writes the Firestore doc. |
| Service (client) | `src/modules/asset-library/services/share-link.service.ts` | `createShareLink(target, opts)` writes the token doc; `buildShareUrl(token)` returns the public URL. |
| Cloud Function | `functions/src/asset-library/onAssetUploaded.js` | Storage trigger; sharp → 200/800 jpegs; updates the item doc with `thumbnailUrl` + `previewUrl`. |
| Cloud Function | `functions/src/asset-library/resolveShareLink.js` | Public HTTPS endpoint; resolves token to a signed URL valid for 1h. |
| Public page | `src/modules/asset-library/pages/SharedAssetPage.tsx` | Mounted at `/share/:token` outside the AuthGuard. |

## One-time install steps

1. Add `sharp` to the Cloud Functions runtime:
   ```bash
   cd functions
   npm install
   ```
   (The dep is already listed in `functions/package.json`; this just
   installs it. The image-processing binary is platform-specific, so
   the install must happen in the same OS/arch the deploy targets —
   the Firebase build container handles this automatically.)

2. Deploy rules + functions:
   ```bash
   npx firebase deploy --only firestore:rules,storage,functions --project zeusos
   ```

   The functions of interest:
   - `onAssetUploaded` (Storage `onObjectFinalized`, region
     `europe-west1`, 512 MiB / 120 s).
   - `resolveShareLink` (HTTPS `onRequest`, region `europe-west1`,
     CORS open — it's a public read-only endpoint).

3. (Optional, only if Storage is freshly provisioned): activate the
   default bucket via the Firebase Console once. Storage rules cannot
   deploy until the bucket exists.

## Alternative — Resize Images extension

If you'd rather lean on the official extension instead of the
in-tree Cloud Function, replace `onAssetUploaded` with:

```bash
npx firebase ext:install firebase/storage-resize-images --project zeusos
```

When the interactive installer asks:

| Prompt | Answer |
|---|---|
| Sizes | `200x200,800x800` |
| Cache-Control header | `public,max-age=31536000,immutable` |
| Convert format | `jpeg` |
| Input image path | `asset-library/*/source/*` |
| Output image path | `asset-library/{file.dir}/thumbs` |
| Delete original | `no` |

The extension does NOT write the resulting URLs back to Firestore —
the predictable paths are `asset-library/{itemId}/thumbs/source_200x200.jpg`
and `…/source_800x800.jpg`. If you take this route, drop the
`onAssetUploaded` registration from `functions/index.js` and update
`AssetCard` / `AssetDetailPage` to construct the URL lazily from the
predictable path instead of reading `thumbnailUrl` / `previewUrl` off
the doc.

The Cloud Function path is the default because it (a) writes the URLs
back to the doc atomically and (b) keeps the implementation in-tree
for code review.

## Runtime contract

### Upload flow

1. `AssetUploadForm` calls `createAssetWithUpload(headerFields, file)`.
2. Service reserves a Firestore doc id, then uploads the source file
   to `asset-library/{itemId}/source/{fileName}` and writes the
   AssetItem doc with `storageRef` pointing at that path.
3. `onAssetUploaded` fires on the source object. For raster types
   (png/jpeg/webp/gif/tiff/avif) it generates the two thumbnails and
   merges `thumbnailUrl` + `previewUrl` onto the item doc.
4. Non-raster file types (PDF, video, fonts, office, archive) skip
   thumbnail generation; the UI shows a category-shaped placeholder.

### Share-link flow

1. Staff clicks "Share with client" on `AssetDetailPage` or
   `CollectionDetailPage` → `createShareLink({ assetItemId? |
   collectionId?, allowDownload, expiresInDays })`.
2. The service writes a `share_links/{token}` doc where the doc id is
   a 32-byte URL-safe random token.
3. The dialog copies `https://<host>/share/{token}` to the clipboard.
4. The recipient visits `/share/:token` (public route, no
   AuthGuard, no AppShell). The page calls the
   `resolveShareLink` HTTPS Function which:
   - Reads the token doc with admin SDK.
   - Verifies `revoked == false` and `expiresAt > now`.
   - Returns the asset/collection metadata plus a signed Storage URL
     for the source object (1 hour expiry, `responseDisposition:
     attachment` when `allowDownload` is true, inline otherwise).
5. The page renders the asset inline using the signed URL.

Storage objects stay private — the share-link flow never makes them
publicly readable directly.

## Revoking a share link

A staff user can revoke a share link by setting `revoked = true` on
the share-link doc. The Firestore rules allow this for the original
creator and for super-admins. Future requests against
`resolveShareLink` return `410 Gone`.

## Operational notes

- The 1 h signed URL expiry is short enough that a leaked link
  stops working quickly, but long enough that a recipient can finish
  reviewing a deck in one sitting. Tune in
  `resolveShareLink.js` if needed.
- The Cloud Function uses the Application Default Credentials of the
  Functions runtime; no JSON keys to manage.
- `sharp` ships ~30 MB of native binaries; container cold-starts add
  ~1.5 s the first time the function fires after deploy.
