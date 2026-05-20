/**
 * Firestore trigger — projectCaseStudies/{id} write → Shopify metaobject sync.
 *
 * Republishes when the storefront block or its referenced source fields
 * (hero, handle, narrative, quote) change meaningfully. Skips when only
 * the publisher's own sync-state fields change.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { publishProject, unpublishProject } = require('../integrations/shopify/publishProjectMetaobject');

const STOREFRONT_SYNC_STATE_KEYS = new Set([
  'shopifyMetaobjectGid',
  'shopifySyncStatus',
  'shopifySyncError',
  'shopifyLastPublishedAt',
  'shopifyHeroImageGid',
  'shopifyGalleryImageGids',
  'shopifyBeforeImageGid',
  'shopifyAfterImageGid',
  'shopifyFloorPlanImageGid',
]);

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function shouldRePublish(before, after) {
  // Storefront block changed (non-state fields)?
  const bsf = before?.storefront;
  const asf = after?.storefront;
  if (Boolean(bsf) !== Boolean(asf)) return true;
  if (asf) {
    const keys = new Set([...Object.keys(asf), ...Object.keys(bsf || {})]);
    for (const k of keys) {
      if (STOREFRONT_SYNC_STATE_KEYS.has(k)) continue;
      if (!deepEqual(asf[k], bsf?.[k])) return true;
    }
  }
  // Source-of-truth fields the publisher reads
  if (!deepEqual(after?.hero, before?.hero)) return true;
  if (!deepEqual(after?.narrative, before?.narrative)) return true;
  if (!deepEqual(after?.quote, before?.quote)) return true;
  if (!deepEqual(after?.gallery, before?.gallery)) return true;
  if (after?.handle !== before?.handle) return true;
  return false;
}

const projectCaseStudyShopifySync = onDocumentWritten(
  {
    document: 'projectCaseStudies/{id}',
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const id = event.params.id;

    if (!after) {
      if (before?.storefront?.shopifyMetaobjectGid) {
        try { await unpublishProject(id); }
        catch (err) { logger.error('projectCaseStudyShopifySync.unpublish.failed', { id, error: err.message }); }
      }
      return;
    }
    if (!after.storefront) return;
    if (!shouldRePublish(before, after)) return;

    try {
      const r = await publishProject(id);
      logger.info('projectCaseStudyShopifySync.published', { id, status: r.status });
    } catch (err) {
      logger.error('projectCaseStudyShopifySync.failed', { id, error: err.message });
    }
  }
);

module.exports = { projectCaseStudyShopifySync };
