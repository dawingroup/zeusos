/**
 * Firestore trigger — finishLibrary/{id} write → Shopify metaobject sync.
 *
 * Fires when the dawinFinishes block changes meaningfully. Skips when only
 * the shopify-sync-state fields changed (those updates come from the publisher
 * itself; re-firing would loop).
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { publishFinish, unpublishFinish } = require('../integrations/shopify/publishFinishMetaobject');

// Fields the publisher writes back; if ONLY these changed, skip.
const SYNC_STATE_KEYS = new Set([
  'shopifyMetaobjectGid',
  'shopifyLastPublishedAt',
  'shopifySyncStatus',
  'shopifySyncError',
  'shopifyTextureImageGid',
  'shopifyWallPreviewImageGid',
]);

function isMaterialDawinFinishesChange(before, after) {
  const b = before?.dawinFinishes;
  const a = after?.dawinFinishes;
  if (!a && !b) return false;
  if (!a || !b) return true; // appeared or disappeared
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (SYNC_STATE_KEYS.has(k)) continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return true;
  }
  // Also re-publish if the source-of-truth top-level fields the metaobject
  // reads (name, code, hexColor, thumbnailUrl) changed.
  if (after?.name !== before?.name) return true;
  if (after?.code !== before?.code) return true;
  if (after?.hexColor !== before?.hexColor) return true;
  if (after?.thumbnailUrl !== before?.thumbnailUrl) return true;
  return false;
}

const finishShopifySync = onDocumentWritten(
  {
    document: 'finishLibrary/{id}',
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const id = event.params.id;

    // Document deleted → unpublish if it had a GID
    if (!after) {
      if (before?.dawinFinishes?.shopifyMetaobjectGid) {
        logger.info('finishShopifySync.unpublish-on-delete', { id });
        try {
          await unpublishFinish(id);
        } catch (err) {
          logger.error('finishShopifySync.unpublish.failed', { id, error: err.message });
        }
      }
      return;
    }

    if (!isMaterialDawinFinishesChange(before, after)) {
      return;
    }

    // Skip if no dawinFinishes block (not a brand finish).
    if (!after.dawinFinishes) return;

    try {
      const result = await publishFinish(id);
      logger.info('finishShopifySync.published', { id, status: result.status });
    } catch (err) {
      logger.error('finishShopifySync.failed', { id, error: err.message });
      // Failure is already recorded on the doc by the publisher; don't rethrow
      // (would trigger retries that compound the failure).
    }
  }
);

module.exports = { finishShopifySync };
