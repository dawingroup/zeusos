/**
 * Scheduled daily reconciler.
 *
 * Picks up any DawinOS records that:
 *   - have shouldPublishToShopify=true (or equivalent gate) AND
 *   - have no shopifyMetaobjectGid (never published) OR
 *   - their last publish is older than the doc's updatedAt
 *
 * and republishes them. Failures are recorded to `shopifySyncFailures`.
 *
 * Cron: every day at 02:00 Africa/Kampala (UTC+3) → 23:00 UTC.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const { publishFinish } = require('../integrations/shopify/publishFinishMetaobject');
const { publishProject } = require('../integrations/shopify/publishProjectMetaobject');
const { publishVoice } = require('../integrations/shopify/publishVoiceMetaobject');
const { publishPressMention } = require('../integrations/shopify/publishPressMentionMetaobject');
const { publishFeaturedUpdate } = require('../integrations/shopify/publishFeaturedUpdateMetaobject');
const { publishMaterial } = require('../integrations/shopify/publishMaterialMetaobject');
const { applyProductMetafields } = require('../integrations/shopify/applyProductMetafields');

const FAILURES_COLLECTION = 'shopifySyncFailures';
const RECON_LOG = 'shopifySyncReconciliations';

async function recordFailure(db, entity, id, err) {
  const failureDoc = db.collection(FAILURES_COLLECTION).doc();
  await failureDoc.set({
    entity,
    docId: id,
    error: String(err.message || err).slice(0, 2000),
    createdAt: Timestamp.now(),
  });
}

function isStale(doc, gidPath, lastPublishedAtPath) {
  const data = doc.data();
  const gid = gidPath.split('.').reduce((a, k) => (a ? a[k] : undefined), data);
  const lastPub = lastPublishedAtPath.split('.').reduce((a, k) => (a ? a[k] : undefined), data);
  if (!gid) return true;
  if (!lastPub) return true;
  const updatedAt = data.updatedAt;
  if (!updatedAt) return false;
  const u = updatedAt.toMillis ? updatedAt.toMillis() : new Date(updatedAt).getTime();
  const p = lastPub.toMillis ? lastPub.toMillis() : new Date(lastPub).getTime();
  return u > p;
}

async function reconcileCollection({ db, name, collection, shouldPublishWhere, gateValue, gidPath, lastPubPath, publishFn }) {
  const q = db.collection(collection).where(shouldPublishWhere, '==', gateValue);
  const snap = await q.get();
  let attempted = 0;
  let republished = 0;
  let failed = 0;
  for (const doc of snap.docs) {
    if (!isStale(doc, gidPath, lastPubPath)) continue;
    attempted++;
    try {
      await publishFn(doc.id);
      republished++;
    } catch (err) {
      failed++;
      await recordFailure(db, name, doc.id, err);
      logger.warn('shopifyDailyReconcile.entity-failed', { entity: name, id: doc.id, error: err.message });
    }
  }
  return { entity: name, scanned: snap.size, attempted, republished, failed };
}

const shopifyDailyReconcile = onSchedule(
  {
    schedule: '0 23 * * *', // 23:00 UTC = 02:00 EAT
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540,
  },
  async () => {
    const db = getFirestore();
    const results = [];

    results.push(await reconcileCollection({
      db, name: 'finish', collection: 'finishLibrary',
      shouldPublishWhere: 'dawinFinishes.shouldPublishToShopify', gateValue: true,
      gidPath: 'dawinFinishes.shopifyMetaobjectGid',
      lastPubPath: 'dawinFinishes.shopifyLastPublishedAt',
      publishFn: publishFinish,
    }));
    results.push(await reconcileCollection({
      db, name: 'project', collection: 'projectCaseStudies',
      shouldPublishWhere: 'storefront.shouldPublishToShopify', gateValue: true,
      gidPath: 'storefront.shopifyMetaobjectGid',
      lastPubPath: 'storefront.shopifyLastPublishedAt',
      publishFn: publishProject,
    }));
    results.push(await reconcileCollection({
      db, name: 'voice', collection: 'voices',
      shouldPublishWhere: 'shouldPublishToShopify', gateValue: true,
      gidPath: 'shopifyMetaobjectGid', lastPubPath: 'shopifyLastPublishedAt',
      publishFn: publishVoice,
    }));
    results.push(await reconcileCollection({
      db, name: 'press_mention', collection: 'pressMentions',
      shouldPublishWhere: 'shouldPublishToShopify', gateValue: true,
      gidPath: 'shopifyMetaobjectGid', lastPubPath: 'shopifyLastPublishedAt',
      publishFn: publishPressMention,
    }));
    results.push(await reconcileCollection({
      db, name: 'featured_update', collection: 'featuredUpdates',
      shouldPublishWhere: 'shouldPublishToShopify', gateValue: true,
      gidPath: 'shopifyMetaobjectGid', lastPubPath: 'shopifyLastPublishedAt',
      publishFn: publishFeaturedUpdate,
    }));
    results.push(await reconcileCollection({
      db, name: 'material', collection: 'inventoryItems',
      shouldPublishWhere: 'shopify.shouldPublishAsMaterial', gateValue: true,
      gidPath: 'shopify.materialMetaobjectGid',
      lastPubPath: 'shopify.materialLastPublishedAt',
      publishFn: publishMaterial,
    }));

    // Product metafield refresh: items with stale dawin.last_reconciled_at (> 7d).
    const productSnap = await db.collection('inventoryItems').where('shopifyProductId', '!=', null).get();
    let prodAttempted = 0, prodOk = 0, prodFailed = 0;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const doc of productSnap.docs) {
      const data = doc.data();
      const last = data.shopify?.metafieldsLastAt;
      const lastMs = last?.toMillis ? last.toMillis() : (last ? new Date(last).getTime() : 0);
      if (lastMs && now - lastMs < sevenDaysMs) continue;
      prodAttempted++;
      try {
        await applyProductMetafields(doc.id);
        prodOk++;
      } catch (err) {
        prodFailed++;
        await recordFailure(db, 'product_metafields', doc.id, err);
      }
    }
    results.push({ entity: 'product_metafields', scanned: productSnap.size, attempted: prodAttempted, republished: prodOk, failed: prodFailed });

    await db.collection(RECON_LOG).add({ ranAt: Timestamp.now(), results });
    logger.info('shopifyDailyReconcile.summary', { results });
  }
);

module.exports = { shopifyDailyReconcile };
