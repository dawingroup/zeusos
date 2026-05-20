/**
 * publishFinishMetaobject
 *
 * Publishes a DawinOS finishLibrary entry as a Shopify `finish` metaobject.
 *
 * Both:
 *   - Firestore trigger (functions/src/triggers/finishShopifySync.js) invokes
 *     this directly with admin context.
 *   - Callable Cloud Function for manual re-publish from the admin UI.
 *
 * Contract: only acts on finishes with `dawinFinishes.shouldPublishToShopify=true`.
 * Reads/writes `dawinFinishes.shopify*` state on the source doc.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getShopifyConfig, pingIndexNow } = require('./adminClient');
const { uploadOrReplaceFile } = require('./fileUpload');
const { upsertMetaobject, buildFields } = require('./metaobjectClient');

const FINISH_COLLECTION = 'finishLibrary';
const METAOBJECT_TYPE = 'finish';

function richTextFromString(s) {
  if (!s) return undefined;
  // Shopify rich_text_field accepts a Slate-like AST JSON or a plain
  // paragraph. We send a minimal one-paragraph payload to keep things robust.
  return JSON.stringify({
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: String(s) }] }],
  });
}

/**
 * Core: publish (or unpublish) a single finish by id. Returns { gid, status }.
 */
async function publishFinish(finishId, { force = false } = {}) {
  const db = getFirestore();
  const ref = db.collection(FINISH_COLLECTION).doc(finishId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Finish ${finishId} not found`);
  const f = snap.data();
  const df = f.dawinFinishes;

  if (!df) {
    return { gid: null, status: 'skipped', reason: 'no dawinFinishes block' };
  }
  if (!df.shouldPublishToShopify && !force) {
    // If a GID exists, unpublish (set DRAFT).
    if (df.shopifyMetaobjectGid) {
      return await unpublishFinish(finishId);
    }
    return { gid: null, status: 'skipped', reason: 'shouldPublishToShopify=false' };
  }
  if (!df.family || !df.handle || !f.hexColor || !df.description) {
    await ref.update({
      'dawinFinishes.shopifySyncStatus': 'error',
      'dawinFinishes.shopifySyncError': 'missing required fields (family/handle/hexColor/description)',
    });
    throw new HttpsError('failed-precondition', 'finish missing required fields for publish');
  }

  await ref.update({
    'dawinFinishes.shopifySyncStatus': 'syncing',
    'dawinFinishes.shopifySyncError': FieldValue.delete(),
  });

  const config = await getShopifyConfig();

  // 1. Upload images (texture + wall preview). Idempotent via cached GID.
  const texture = await uploadOrReplaceFile(config, {
    entityType: 'finish',
    dawinSourceId: finishId,
    slot: 'texture',
    sourceUrl: f.thumbnailUrl || f.textureAssets?.diffuseUrl,
    displayName: f.name,
    existingGid: df.shopifyTextureImageGid,
  });
  const wallPreview = await uploadOrReplaceFile(config, {
    entityType: 'finish',
    dawinSourceId: finishId,
    slot: 'wall-preview',
    sourceUrl: df.wallPreviewImageUrl,
    displayName: f.name,
    existingGid: df.shopifyWallPreviewImageGid,
  });

  // 2. Build metaobject fields per docs/integrations/metaobjects/finish.json.
  //    `handle` is Shopify-reserved (passed at the input root, not as a field).
  const fields = buildFields([
    { key: 'name',                type: 'single_line_text_field', value: f.name },
    { key: 'code',                type: 'single_line_text_field', value: f.code },
    { key: 'family',              type: 'single_line_text_field', value: df.family },
    { key: 'color_hex',           type: 'color',                  value: f.hexColor },
    { key: 'texture_image',       type: 'file_reference',         value: texture?.gid },
    { key: 'wall_preview_image',  type: 'file_reference',         value: wallPreview?.gid },
    { key: 'recipe_id',           type: 'single_line_text_field', value: f.inventoryItemId },
    { key: 'sheen',               type: 'single_line_text_field', value: df.sheen },
    { key: 'sheen_value',         type: 'number_integer',         value: df.sheenValue },
    { key: 'hand_count',          type: 'number_integer',         value: df.handCount },
    { key: 'cure_hours',          type: 'number_integer',         value: df.cureHours },
    { key: 'cure_temp_c_min',     type: 'number_integer',         value: df.cureTempCMin },
    { key: 'cure_temp_c_max',     type: 'number_integer',         value: df.cureTempCMax },
    { key: 'coverage_m2_per_kg',  type: 'number_decimal',         value: df.coverageM2PerKg },
    { key: 'washability',         type: 'single_line_text_field', value: df.washability },
    { key: 'outdoor_use',         type: 'boolean',                value: df.outdoorUse },
    { key: 'sample_price_ugx',    type: 'number_integer',         value: df.samplePriceUgx },
    { key: 'sample_lead_days',    type: 'number_integer',         value: df.sampleLeadDays },
    { key: 'description',         type: 'rich_text_field',        value: richTextFromString(df.description) },
    { key: 'updated_at',          type: 'date',                   value: new Date().toISOString().slice(0, 10) },
    { key: 'published',           type: 'boolean',                value: df.published !== false },
    { key: 'sort_index',          type: 'number_integer',         value: df.sortIndex },
  ]);

  // 3. Upsert metaobject
  const result = await upsertMetaobject(config, {
    type: METAOBJECT_TYPE,
    handle: df.handle,
    dawinSourceId: finishId,
    fields,
    existingGid: df.shopifyMetaobjectGid,
    status: df.published === false ? 'DRAFT' : 'ACTIVE',
  });

  // 4. Write state back to Firestore
  const update = {
    'dawinFinishes.shopifyMetaobjectGid': result.gid,
    'dawinFinishes.shopifyLastPublishedAt': Timestamp.now(),
    'dawinFinishes.shopifySyncStatus': 'synced',
    'dawinFinishes.shopifySyncError': FieldValue.delete(),
  };
  if (texture?.gid) update['dawinFinishes.shopifyTextureImageGid'] = texture.gid;
  if (wallPreview?.gid) update['dawinFinishes.shopifyWallPreviewImageGid'] = wallPreview.gid;
  await ref.update(update);

  // 5. IndexNow ping (best-effort)
  await pingIndexNow(`https://${config.shopDomain.replace('.myshopify.com', '.com')}/finishes/${df.handle}`);

  logger.info('shopify.finish.published', { finishId, gid: result.gid, isNew: result.isNew });
  return { gid: result.gid, status: 'synced', isNew: result.isNew };
}

async function unpublishFinish(finishId) {
  const db = getFirestore();
  const ref = db.collection(FINISH_COLLECTION).doc(finishId);
  const snap = await ref.get();
  if (!snap.exists) return { status: 'skipped', reason: 'finish not found' };
  const df = snap.data().dawinFinishes;
  if (!df?.shopifyMetaobjectGid) return { status: 'skipped', reason: 'no shopify gid' };
  const config = await getShopifyConfig();
  await upsertMetaobject(config, {
    type: METAOBJECT_TYPE,
    handle: df.handle,
    dawinSourceId: finishId,
    fields: [],
    existingGid: df.shopifyMetaobjectGid,
    status: 'DRAFT',
  });
  await ref.update({
    'dawinFinishes.shopifySyncStatus': 'unpublished',
    'dawinFinishes.shopifyLastPublishedAt': Timestamp.now(),
  });
  return { gid: df.shopifyMetaobjectGid, status: 'unpublished' };
}

const publishFinishMetaobject = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const { finishId, force } = request.data || {};
    if (!finishId) throw new HttpsError('invalid-argument', 'finishId is required');
    return publishFinish(finishId, { force: Boolean(force) });
  }
);

module.exports = { publishFinishMetaobject, publishFinish, unpublishFinish };
