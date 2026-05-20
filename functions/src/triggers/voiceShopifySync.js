/**
 * Firestore trigger — voices/{id} write → Shopify metaobject sync.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { publishVoice, unpublishVoice } = require('../integrations/shopify/publishVoiceMetaobject');

const SYNC_STATE_KEYS = new Set([
  'shopifyMetaobjectGid', 'shopifySyncStatus', 'shopifySyncError',
  'shopifyLastPublishedAt', 'shopifyLogoImageGid',
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

const voiceShopifySync = onDocumentWritten(
  { document: 'voices/{id}', region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const id = event.params.id;
    if (!after) {
      if (before?.shopifyMetaobjectGid) {
        try { await unpublishVoice(id); }
        catch (err) { logger.error('voiceShopifySync.unpublish.failed', { id, error: err.message }); }
      }
      return;
    }
    if (!changed(before, after)) return;
    try { await publishVoice(id); }
    catch (err) { logger.error('voiceShopifySync.failed', { id, error: err.message }); }
  }
);

module.exports = { voiceShopifySync };
