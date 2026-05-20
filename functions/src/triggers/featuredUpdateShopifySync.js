/**
 * Firestore trigger — featuredUpdates/{id} write → Shopify metaobject sync.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { publishFeaturedUpdate, unpublishFeaturedUpdate } = require('../integrations/shopify/publishFeaturedUpdateMetaobject');

const SYNC_STATE_KEYS = new Set([
  'shopifyMetaobjectGid', 'shopifySyncStatus', 'shopifySyncError',
  'shopifyLastPublishedAt', 'shopifyImageGid',
]);

function changed(before, after) {
  if (!before || !after) return true;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    if (SYNC_STATE_KEYS.has(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) return true;
  }
  return false;
}

const featuredUpdateShopifySync = onDocumentWritten(
  { document: 'featuredUpdates/{id}', region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const id = event.params.id;
    if (!after) {
      if (before?.shopifyMetaobjectGid) {
        try { await unpublishFeaturedUpdate(id); }
        catch (err) { logger.error('featuredUpdateShopifySync.unpublish.failed', { id, error: err.message }); }
      }
      return;
    }
    if (!changed(before, after)) return;
    try { await publishFeaturedUpdate(id); }
    catch (err) { logger.error('featuredUpdateShopifySync.failed', { id, error: err.message }); }
  }
);

module.exports = { featuredUpdateShopifySync };
