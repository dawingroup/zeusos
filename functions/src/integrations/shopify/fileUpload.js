/**
 * Shopify Files upload/replace helper.
 *
 * Convention (locked decision in docs/integrations/shopify-decisions.md §4):
 *   - filename: `<entity-type>-<dawin-source-id>-<slot>.jpg`
 *   - alt: `<Display name> · DAW-IMG-<asset-id>`
 *
 * Idempotency: callers cache the returned Shopify GID on their DawinOS doc.
 * If a GID is supplied to `uploadOrReplaceFile`, we update alt + reuse it.
 * Otherwise we `fileCreate`. We don't query Shopify by filename — Shopify
 * doesn't enforce filename uniqueness, so the Firestore-side GID cache IS
 * the identity.
 */

const { logger } = require('firebase-functions');
const { shopifyGraphQL } = require('./adminClient');

const FILE_CREATE = `
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id alt fileStatus }
      userErrors { field message code }
    }
  }
`;

const FILE_UPDATE = `
  mutation FileUpdate($files: [FileUpdateInput!]!) {
    fileUpdate(files: $files) {
      files { id alt fileStatus }
      userErrors { field message code }
    }
  }
`;

const FILE_DELETE = `
  mutation FileDelete($fileIds: [ID!]!) {
    fileDelete(fileIds: $fileIds) {
      deletedFileIds
      userErrors { field message code }
    }
  }
`;

/**
 * Upload OR replace a file at Shopify.
 *
 * @param {object} config       systemConfig/shopifyConfig (shopDomain, accessToken)
 * @param {object} params
 * @param {string} params.entityType      e.g. "finish", "project", "voice"
 * @param {string} params.dawinSourceId   stable id on the DawinOS entity (used in filename)
 * @param {string} params.slot            "hero", "gallery-0", "wall-preview", etc.
 * @param {string} params.sourceUrl       publicly-fetchable URL (Firebase Storage public download URL)
 * @param {string} params.displayName     for alt-text prefix
 * @param {string} [params.existingGid]   if present, this overrides create and updates alt
 *
 * @returns {Promise<{ gid: string, alt: string, isNew: boolean } | null>}
 */
async function uploadOrReplaceFile(config, params) {
  const { entityType, dawinSourceId, slot, sourceUrl, displayName, existingGid } = params;
  if (!sourceUrl) return null;

  const alt = `${displayName || 'Asset'} · DAW-IMG-${dawinSourceId}-${slot}`;

  if (existingGid) {
    const data = await shopifyGraphQL(config, FILE_UPDATE, {
      files: [{ id: existingGid, alt }],
    }, { entity: entityType, dawin_id: dawinSourceId, action: 'fileUpdate', shopify_gid: existingGid });
    const errs = data.fileUpdate?.userErrors || [];
    if (errs.length > 0) {
      logger.warn('shopify.fileUpdate.userErrors', { gid: existingGid, errors: errs });
      // Fall through to create-new on stale GID.
      if (errs.some((e) => e.code === 'NOT_FOUND' || e.message?.includes('not found'))) {
        return uploadOrReplaceFile(config, { ...params, existingGid: undefined });
      }
      return { gid: existingGid, alt, isNew: false };
    }
    return { gid: existingGid, alt, isNew: false };
  }

  const data = await shopifyGraphQL(config, FILE_CREATE, {
    files: [
      {
        originalSource: sourceUrl,
        contentType: 'IMAGE',
        alt,
        filename: `${entityType}-${dawinSourceId}-${slot}.jpg`,
      },
    ],
  }, { entity: entityType, dawin_id: dawinSourceId, action: 'fileCreate' });

  const errs = data.fileCreate?.userErrors || [];
  if (errs.length > 0) {
    logger.warn('shopify.fileCreate.userErrors', { sourceUrl, errors: errs });
    return null;
  }
  const file = data.fileCreate?.files?.[0];
  if (!file?.id) return null;
  return { gid: file.id, alt, isNew: true };
}

/**
 * Delete a file from Shopify Files. Logs but does not throw.
 */
async function deleteFile(config, gid, context = {}) {
  if (!gid) return false;
  try {
    const data = await shopifyGraphQL(config, FILE_DELETE, { fileIds: [gid] }, {
      ...context, action: 'fileDelete', shopify_gid: gid,
    });
    const errs = data.fileDelete?.userErrors || [];
    if (errs.length > 0) {
      logger.warn('shopify.fileDelete.userErrors', { gid, errors: errs });
      return false;
    }
    return (data.fileDelete?.deletedFileIds || []).includes(gid);
  } catch (err) {
    logger.warn('shopify.fileDelete.failed', { gid, error: err.message || String(err) });
    return false;
  }
}

/**
 * Batch upload — for galleries. Resilient to per-image failures.
 * @returns {Promise<Array<{ gid: string, alt: string, isNew: boolean, sourceUrl: string, slot: string }>>}
 */
async function uploadGallery(config, params) {
  const { entityType, dawinSourceId, displayName, items } = params;
  // items: [{ sourceUrl, slot, existingGid }]
  const out = [];
  for (const it of items) {
    const result = await uploadOrReplaceFile(config, {
      entityType,
      dawinSourceId,
      slot: it.slot,
      sourceUrl: it.sourceUrl,
      displayName,
      existingGid: it.existingGid,
    });
    if (result) {
      out.push({ ...result, sourceUrl: it.sourceUrl, slot: it.slot });
    }
  }
  return out;
}

module.exports = {
  uploadOrReplaceFile,
  deleteFile,
  uploadGallery,
};
