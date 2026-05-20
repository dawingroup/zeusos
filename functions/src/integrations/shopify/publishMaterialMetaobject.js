/**
 * publishMaterialMetaobject — promote an InventoryItem to a Shopify `material`
 * metaobject. Only items with `shopify.shouldPublishAsMaterial=true` and a
 * category in the Shopify-spec enum publish. Spec:
 * docs/integrations/metaobjects/material.json.
 *
 * Mapping convention (DawinOS category → Shopify material category):
 *   plaster | timber | metal | fibre | clay | stone | glass
 * The Shopify category is read off `shopify.materialCategory` on the
 * InventoryItem (set by an editor since DawinOS' broader InventoryCategory
 * doesn't 1:1 map).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getShopifyConfig } = require('./adminClient');
const { uploadOrReplaceFile } = require('./fileUpload');
const { upsertMetaobject, buildFields } = require('./metaobjectClient');

const COLLECTION = 'inventoryItems';
const TYPE = 'material';

const ALLOWED_CATEGORIES = new Set(['plaster', 'timber', 'metal', 'fibre', 'clay', 'stone', 'glass']);

function rich(s) {
  if (!s) return undefined;
  return JSON.stringify({
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: String(s) }] }],
  });
}

function slugify(s) {
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function publishMaterial(itemId, { force = false } = {}) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `InventoryItem ${itemId} not found`);
  const item = snap.data();
  const sh = item.shopify || {};

  if (!sh.shouldPublishAsMaterial && !force) {
    if (sh.materialMetaobjectGid) return unpublishMaterial(itemId);
    return { status: 'skipped' };
  }
  if (!ALLOWED_CATEGORIES.has(sh.materialCategory)) {
    throw new HttpsError('failed-precondition', `shopify.materialCategory must be one of ${[...ALLOWED_CATEGORIES].join(',')}`);
  }
  if (!sh.materialDescription || !sh.originCountry) {
    throw new HttpsError('failed-precondition', 'shopify.materialDescription and shopify.originCountry required');
  }

  await ref.update({
    'shopify.materialSyncStatus': 'syncing',
    'shopify.materialSyncError': FieldValue.delete(),
  });
  const config = await getShopifyConfig();

  let certGid;
  if (sh.certificationImageUrl) {
    const cert = await uploadOrReplaceFile(config, {
      entityType: 'material',
      dawinSourceId: itemId,
      slot: 'cert',
      sourceUrl: sh.certificationImageUrl,
      displayName: item.name,
      existingGid: sh.shopifyCertImageGid,
    });
    certGid = cert?.gid;
  }

  const handle = sh.materialHandle || slugify(item.name || itemId);

  const fields = buildFields([
    { key: 'name',           type: 'single_line_text_field', value: item.name },
    { key: 'category',       type: 'single_line_text_field', value: sh.materialCategory },
    { key: 'origin_country', type: 'single_line_text_field', value: sh.originCountry },
    { key: 'origin_region',  type: 'single_line_text_field', value: sh.originRegion },
    { key: 'supplier',       type: 'single_line_text_field', value: sh.supplier || item.preferredSupplier },
    { key: 'is_local',       type: 'boolean',                value: Boolean(sh.isLocal) },
    { key: 'is_sustainable', type: 'boolean',                value: Boolean(sh.isSustainable) },
    { key: 'cert_image',     type: 'file_reference',         value: certGid },
    { key: 'description',    type: 'rich_text_field',        value: rich(sh.materialDescription) },
  ]);

  const result = await upsertMetaobject(config, {
    type: TYPE,
    handle,
    dawinSourceId: itemId,
    fields,
    existingGid: sh.materialMetaobjectGid,
    status: 'ACTIVE',
  });

  const update = {
    'shopify.materialMetaobjectGid': result.gid,
    'shopify.materialHandle': handle,
    'shopify.materialSyncStatus': 'synced',
    'shopify.materialSyncError': FieldValue.delete(),
    'shopify.materialLastPublishedAt': Timestamp.now(),
  };
  if (certGid) update['shopify.shopifyCertImageGid'] = certGid;
  await ref.update(update);

  logger.info('shopify.material.published', { itemId, gid: result.gid });
  return { gid: result.gid, status: 'synced', isNew: result.isNew };
}

async function unpublishMaterial(itemId) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) return { status: 'skipped' };
  const sh = snap.data().shopify || {};
  if (!sh.materialMetaobjectGid) return { status: 'skipped' };
  const config = await getShopifyConfig();
  await upsertMetaobject(config, {
    type: TYPE,
    handle: sh.materialHandle,
    dawinSourceId: itemId,
    fields: [],
    existingGid: sh.materialMetaobjectGid,
    status: 'DRAFT',
  });
  await ref.update({
    'shopify.materialSyncStatus': 'unpublished',
    'shopify.materialLastPublishedAt': Timestamp.now(),
  });
  return { status: 'unpublished' };
}

const publishMaterialMetaobject = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const { inventoryItemId, force } = request.data || {};
    if (!inventoryItemId) throw new HttpsError('invalid-argument', 'inventoryItemId is required');
    return publishMaterial(inventoryItemId, { force: Boolean(force) });
  }
);

module.exports = { publishMaterialMetaobject, publishMaterial, unpublishMaterial };
