/**
 * Firestore trigger — inventoryItems/{id} write → publish as Shopify `material`
 * metaobject when shopify.shouldPublishAsMaterial flips true (or content changes).
 *
 * This is separate from the existing shopifyInventorySync trigger (which handles
 * stock-level pushes to Shopify products). Materials are a *promotion* of an
 * inventory item to a public-facing metaobject — gated by editorial intent.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { publishMaterial, unpublishMaterial } = require('../integrations/shopify/publishMaterialMetaobject');

const SYNC_STATE_KEYS = new Set([
  'materialMetaobjectGid', 'materialSyncStatus', 'materialSyncError',
  'materialLastPublishedAt', 'shopifyCertImageGid', 'materialHandle',
]);

function shopifyChanged(before, after) {
  const b = before?.shopify || {};
  const a = after?.shopify || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (SYNC_STATE_KEYS.has(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return true;
  }
  if ((after?.name) !== (before?.name)) return true;
  return false;
}

const materialShopifySync = onDocumentWritten(
  { document: 'inventoryItems/{id}', region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const id = event.params.id;
    if (!after) {
      if (before?.shopify?.materialMetaobjectGid) {
        try { await unpublishMaterial(id); }
        catch (err) { logger.error('materialShopifySync.unpublish.failed', { id, error: err.message }); }
      }
      return;
    }
    // Only act when there's intent to be a material
    const wasMaterial = Boolean(before?.shopify?.shouldPublishAsMaterial);
    const isMaterial = Boolean(after?.shopify?.shouldPublishAsMaterial);
    if (!wasMaterial && !isMaterial) return;
    if (!shopifyChanged(before, after)) return;
    try { await publishMaterial(id); }
    catch (err) { logger.error('materialShopifySync.failed', { id, error: err.message }); }
  }
);

module.exports = { materialShopifySync };
