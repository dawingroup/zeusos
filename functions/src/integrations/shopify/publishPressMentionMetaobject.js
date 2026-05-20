/**
 * publishPressMentionMetaobject — DawinOS press mention → Shopify
 * `press_mention` metaobject. Spec: docs/integrations/metaobjects/press_mention.json.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getShopifyConfig } = require('./adminClient');
const { uploadOrReplaceFile } = require('./fileUpload');
const { upsertMetaobject, buildFields } = require('./metaobjectClient');

const COLLECTION = 'pressMentions';
const TYPE = 'press_mention';

async function publishPressMention(id, { force = false } = {}) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `PressMention ${id} not found`);
  const p = snap.data();

  if (!p.shouldPublishToShopify && !force) {
    if (p.shopifyMetaobjectGid) return unpublishPressMention(id);
    return { status: 'skipped' };
  }
  if (!p.publication || !p.title || !p.datePublished || !p.publicationLogoUrl) {
    throw new HttpsError('failed-precondition', 'publication/title/datePublished/publicationLogoUrl required');
  }

  await ref.update({ shopifySyncStatus: 'syncing', shopifySyncError: FieldValue.delete() });
  const config = await getShopifyConfig();

  const logo = await uploadOrReplaceFile(config, {
    entityType: 'press_mention',
    dawinSourceId: id,
    slot: 'logo',
    sourceUrl: p.publicationLogoUrl,
    displayName: p.publication,
    existingGid: p.shopifyLogoImageGid,
  });

  const date = p.datePublished?.toDate ? p.datePublished.toDate() : new Date(p.datePublished);

  const fields = buildFields([
    { key: 'publication',      type: 'single_line_text_field', value: p.publication },
    { key: 'publication_logo', type: 'file_reference',         value: logo?.gid },
    { key: 'title',            type: 'single_line_text_field', value: p.title },
    { key: 'url',              type: 'url',                    value: p.url },
    { key: 'date_published',   type: 'date',                   value: date.toISOString().slice(0, 10) },
    { key: 'pull_quote',       type: 'single_line_text_field', value: p.pullQuote },
    { key: 'featured',         type: 'boolean',                value: p.featured },
  ]);

  const handle = `press-${id}`.toLowerCase().slice(0, 50);
  const result = await upsertMetaobject(config, {
    type: TYPE,
    handle,
    dawinSourceId: id,
    fields,
    existingGid: p.shopifyMetaobjectGid,
    status: 'ACTIVE',
  });

  const update = {
    shopifyMetaobjectGid: result.gid,
    shopifySyncStatus: 'synced',
    shopifySyncError: FieldValue.delete(),
    shopifyLastPublishedAt: Timestamp.now(),
  };
  if (logo?.gid) update.shopifyLogoImageGid = logo.gid;
  await ref.update(update);

  logger.info('shopify.pressMention.published', { id, gid: result.gid });
  return { gid: result.gid, status: 'synced', isNew: result.isNew };
}

async function unpublishPressMention(id) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 'skipped' };
  const p = snap.data();
  if (!p.shopifyMetaobjectGid) return { status: 'skipped' };
  const config = await getShopifyConfig();
  const handle = `press-${id}`.toLowerCase().slice(0, 50);
  await upsertMetaobject(config, {
    type: TYPE,
    handle,
    dawinSourceId: id,
    fields: [],
    existingGid: p.shopifyMetaobjectGid,
    status: 'DRAFT',
  });
  await ref.update({ shopifySyncStatus: 'unpublished', shopifyLastPublishedAt: Timestamp.now() });
  return { status: 'unpublished' };
}

const publishPressMentionMetaobject = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const { id, force } = request.data || {};
    if (!id) throw new HttpsError('invalid-argument', 'id is required');
    return publishPressMention(id, { force: Boolean(force) });
  }
);

module.exports = { publishPressMentionMetaobject, publishPressMention, unpublishPressMention };
