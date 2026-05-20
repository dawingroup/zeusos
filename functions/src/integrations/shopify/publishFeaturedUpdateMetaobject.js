/**
 * publishFeaturedUpdateMetaobject — DawinOS featured update → Shopify
 * `featured_update` metaobject. Spec: docs/integrations/metaobjects/featured_update.json.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getShopifyConfig } = require('./adminClient');
const { uploadOrReplaceFile } = require('./fileUpload');
const { upsertMetaobject, buildFields } = require('./metaobjectClient');

const COLLECTION = 'featuredUpdates';
const TYPE = 'featured_update';

async function publishFeaturedUpdate(id, { force = false } = {}) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `FeaturedUpdate ${id} not found`);
  const f = snap.data();

  if (!f.shouldPublishToShopify && !force) {
    if (f.shopifyMetaobjectGid) return unpublishFeaturedUpdate(id);
    return { status: 'skipped' };
  }
  if (!f.headline || !f.subhead || !f.imageUrl || !f.liveFrom || !f.category || !f.handle) {
    throw new HttpsError('failed-precondition', 'headline/subhead/imageUrl/liveFrom/category/handle required');
  }

  await ref.update({ shopifySyncStatus: 'syncing', shopifySyncError: FieldValue.delete() });
  const config = await getShopifyConfig();

  const image = await uploadOrReplaceFile(config, {
    entityType: 'featured_update',
    dawinSourceId: id,
    slot: 'image',
    sourceUrl: f.imageUrl,
    displayName: f.headline,
    existingGid: f.shopifyImageGid,
  });

  let projectGid;
  if (f.projectCaseStudyId) {
    const pSnap = await db.collection('projectCaseStudies').doc(f.projectCaseStudyId).get();
    projectGid = pSnap.exists ? pSnap.data().storefront?.shopifyMetaobjectGid : undefined;
  }

  const liveFrom = f.liveFrom?.toDate ? f.liveFrom.toDate() : new Date(f.liveFrom);
  const liveUntil = f.liveUntil?.toDate ? f.liveUntil.toDate() : (f.liveUntil ? new Date(f.liveUntil) : undefined);

  const fields = buildFields([
    { key: 'headline',    type: 'single_line_text_field', value: f.headline },
    { key: 'subhead',     type: 'single_line_text_field', value: f.subhead },
    { key: 'eyebrow',     type: 'single_line_text_field', value: f.eyebrow },
    { key: 'image',       type: 'file_reference',         value: image?.gid },
    { key: 'link_url',    type: 'url',                    value: f.linkUrl },
    { key: 'link_label',  type: 'single_line_text_field', value: f.linkLabel },
    { key: 'bench_id',    type: 'single_line_text_field', value: f.benchId },
    { key: 'project_ref', type: 'metaobject_reference',   value: projectGid },
    { key: 'live_from',   type: 'date_time',              value: liveFrom.toISOString() },
    { key: 'live_until',  type: 'date_time',              value: liveUntil ? liveUntil.toISOString() : undefined },
    { key: 'priority',    type: 'number_integer',         value: f.priority },
    { key: 'category',    type: 'single_line_text_field', value: f.category },
    { key: 'tone',        type: 'single_line_text_field', value: f.tone },
    { key: 'published',   type: 'boolean',                value: f.published },
  ]);

  const result = await upsertMetaobject(config, {
    type: TYPE,
    handle: f.handle,
    dawinSourceId: id,
    fields,
    existingGid: f.shopifyMetaobjectGid,
    status: f.published ? 'ACTIVE' : 'DRAFT',
  });

  const update = {
    shopifyMetaobjectGid: result.gid,
    shopifySyncStatus: 'synced',
    shopifySyncError: FieldValue.delete(),
    shopifyLastPublishedAt: Timestamp.now(),
  };
  if (image?.gid) update.shopifyImageGid = image.gid;
  await ref.update(update);

  logger.info('shopify.featuredUpdate.published', { id, gid: result.gid });
  return { gid: result.gid, status: 'synced', isNew: result.isNew };
}

async function unpublishFeaturedUpdate(id) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 'skipped' };
  const f = snap.data();
  if (!f.shopifyMetaobjectGid) return { status: 'skipped' };
  const config = await getShopifyConfig();
  await upsertMetaobject(config, {
    type: TYPE,
    handle: f.handle,
    dawinSourceId: id,
    fields: [],
    existingGid: f.shopifyMetaobjectGid,
    status: 'DRAFT',
  });
  await ref.update({ shopifySyncStatus: 'unpublished', shopifyLastPublishedAt: Timestamp.now() });
  return { status: 'unpublished' };
}

const publishFeaturedUpdateMetaobject = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const { id, force } = request.data || {};
    if (!id) throw new HttpsError('invalid-argument', 'id is required');
    return publishFeaturedUpdate(id, { force: Boolean(force) });
  }
);

module.exports = { publishFeaturedUpdateMetaobject, publishFeaturedUpdate, unpublishFeaturedUpdate };
