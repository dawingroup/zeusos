/**
 * Shopify Files delete helper.
 *
 * Companion to fileUpload.js. Invoked when a DawinOS asset is removed and
 * we want to clean up the corresponding Shopify CDN file. Per the locked
 * decision in docs/integrations/shopify-decisions.md §4, "Delete in DawinOS
 * triggers fileDelete on Shopify."
 *
 * Idempotent: deleting a GID that no longer exists in Shopify returns a
 * userError we treat as success. Callers should clear the cached GID
 * (e.g. `shopifyHeroImageGid`) on the DawinOS doc after a successful delete
 * so re-publishes upload a fresh file.
 */

const { logger } = require('firebase-functions');
const { shopifyGraphQL } = require('./adminClient');

const FILE_DELETE = `
  mutation FileDelete($fileIds: [ID!]!) {
    fileDelete(fileIds: $fileIds) {
      deletedFileIds
      userErrors { field message code }
    }
  }
`;

/**
 * Delete one or more files from Shopify CDN.
 *
 * @param {string|string[]} gidOrGids — Shopify file GID(s), e.g.
 *   `gid://shopify/MediaImage/123` or `gid://shopify/GenericFile/123`.
 * @returns {Promise<{deleted: string[], notFound: string[], errors: object[]}>}
 *   `deleted` — GIDs Shopify confirmed were removed.
 *   `notFound` — GIDs Shopify reported as already gone (treated as success).
 *   `errors`   — userErrors that were neither deleted nor not-found.
 */
async function deleteShopifyFiles(gidOrGids) {
  const fileIds = Array.isArray(gidOrGids) ? gidOrGids : [gidOrGids];
  const clean = fileIds.filter(Boolean);
  if (clean.length === 0) {
    return { deleted: [], notFound: [], errors: [] };
  }

  const start = Date.now();
  const data = await shopifyGraphQL(FILE_DELETE, { fileIds: clean }, {
    op: 'fileDelete',
    entity: 'file',
  });
  const deleted = data?.fileDelete?.deletedFileIds || [];
  const userErrors = data?.fileDelete?.userErrors || [];

  // Shopify reports a 'NOT_FOUND' (or similar) code for already-gone files.
  // We surface those separately so callers can decide whether to log a warning.
  const notFound = [];
  const errors = [];
  for (const err of userErrors) {
    const code = (err.code || '').toUpperCase();
    if (code === 'NOT_FOUND' || /not[_ ]?found|does not exist/i.test(err.message || '')) {
      notFound.push({ message: err.message, field: err.field });
    } else {
      errors.push(err);
    }
  }

  logger.info('shopify.fileDelete', {
    requested: clean.length,
    deleted: deleted.length,
    notFound: notFound.length,
    errors: errors.length,
    durationMs: Date.now() - start,
  });

  return { deleted, notFound, errors };
}

/**
 * Best-effort delete: swallows errors and never throws. Use this from
 * Firestore cleanup triggers where a failed Shopify delete shouldn't block
 * the DawinOS-side delete.
 *
 * @param {string|string[]} gidOrGids
 * @returns {Promise<boolean>} true if all requested GIDs were deleted (or
 *   confirmed not-found); false otherwise.
 */
async function deleteShopifyFilesSafe(gidOrGids) {
  try {
    const { deleted, notFound, errors } = await deleteShopifyFiles(gidOrGids);
    if (errors.length > 0) {
      logger.warn('shopify.fileDelete partial failure', { errors });
      return false;
    }
    const requested = Array.isArray(gidOrGids) ? gidOrGids.length : 1;
    return (deleted.length + notFound.length) === requested;
  } catch (err) {
    logger.error('shopify.fileDelete threw', { error: err.message });
    return false;
  }
}

module.exports = {
  deleteShopifyFiles,
  deleteShopifyFilesSafe,
};
