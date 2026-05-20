/**
 * publishVoiceMetaobject — publishes a DawinOS voice (testimonial) as a
 * Shopify `voice` metaobject. Spec: docs/integrations/metaobjects/voice.json.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getShopifyConfig } = require('./adminClient');
const { uploadOrReplaceFile } = require('./fileUpload');
const { upsertMetaobject, buildFields } = require('./metaobjectClient');

const COLLECTION = 'voices';
const TYPE = 'voice';

function rich(s) {
  if (!s) return undefined;
  return JSON.stringify({
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: String(s) }] }],
  });
}

async function publishVoice(voiceId, { force = false } = {}) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(voiceId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Voice ${voiceId} not found`);
  const v = snap.data();

  if (!v.shouldPublishToShopify && !force) {
    if (v.shopifyMetaobjectGid) return unpublishVoice(voiceId);
    return { status: 'skipped', reason: 'shouldPublishToShopify=false' };
  }
  if (!v.consentGiven) throw new HttpsError('failed-precondition', 'consent required');
  if (!v.quote || !v.attribution || !v.quoteDate) {
    throw new HttpsError('failed-precondition', 'quote/attribution/quoteDate required');
  }

  await ref.update({
    shopifySyncStatus: 'syncing',
    shopifySyncError: FieldValue.delete(),
  });

  const config = await getShopifyConfig();

  let logoGid;
  if (v.companyLogoUrl) {
    const logo = await uploadOrReplaceFile(config, {
      entityType: 'voice',
      dawinSourceId: voiceId,
      slot: 'logo',
      sourceUrl: v.companyLogoUrl,
      displayName: v.company || v.attribution,
      existingGid: v.shopifyLogoImageGid,
    });
    logoGid = logo?.gid;
  }

  // Resolve linked project to its Shopify metaobject GID
  let projectGid;
  if (v.projectCaseStudyId) {
    const pSnap = await db.collection('projectCaseStudies').doc(v.projectCaseStudyId).get();
    projectGid = pSnap.exists ? pSnap.data().storefront?.shopifyMetaobjectGid : undefined;
  }

  const quoteDate = v.quoteDate?.toDate ? v.quoteDate.toDate() : new Date(v.quoteDate);

  const fields = buildFields([
    { key: 'quote',         type: 'rich_text_field',         value: rich(v.quote) },
    { key: 'attribution',   type: 'single_line_text_field',  value: v.attribution },
    { key: 'role',          type: 'single_line_text_field',  value: v.role },
    { key: 'company',       type: 'single_line_text_field',  value: v.company },
    { key: 'company_logo',  type: 'file_reference',          value: logoGid },
    { key: 'project_ref',   type: 'metaobject_reference',    value: projectGid },
    { key: 'quote_date',    type: 'date',                    value: quoteDate.toISOString().slice(0, 10) },
    { key: 'tone',          type: 'single_line_text_field',  value: v.tone },
    { key: 'lead',          type: 'boolean',                 value: v.lead },
    { key: 'featured',      type: 'boolean',                 value: v.featured },
    { key: 'consent_given', type: 'boolean',                 value: v.consentGiven },
  ]);

  const result = await upsertMetaobject(config, {
    type: TYPE,
    handle: `voice-${voiceId}`.toLowerCase().slice(0, 50),
    dawinSourceId: voiceId,
    fields,
    existingGid: v.shopifyMetaobjectGid,
    status: 'ACTIVE',
  });

  const update = {
    shopifyMetaobjectGid: result.gid,
    shopifySyncStatus: 'synced',
    shopifySyncError: FieldValue.delete(),
    shopifyLastPublishedAt: Timestamp.now(),
  };
  if (logoGid) update.shopifyLogoImageGid = logoGid;
  await ref.update(update);

  logger.info('shopify.voice.published', { voiceId, gid: result.gid });
  return { gid: result.gid, status: 'synced', isNew: result.isNew };
}

async function unpublishVoice(voiceId) {
  const db = getFirestore();
  const ref = db.collection(COLLECTION).doc(voiceId);
  const snap = await ref.get();
  if (!snap.exists) return { status: 'skipped' };
  const v = snap.data();
  if (!v.shopifyMetaobjectGid) return { status: 'skipped' };
  const config = await getShopifyConfig();
  await upsertMetaobject(config, {
    type: TYPE,
    handle: `voice-${voiceId}`.toLowerCase().slice(0, 50),
    dawinSourceId: voiceId,
    fields: [],
    existingGid: v.shopifyMetaobjectGid,
    status: 'DRAFT',
  });
  await ref.update({
    shopifySyncStatus: 'unpublished',
    shopifyLastPublishedAt: Timestamp.now(),
  });
  return { status: 'unpublished' };
}

const publishVoiceMetaobject = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const { voiceId, force } = request.data || {};
    if (!voiceId) throw new HttpsError('invalid-argument', 'voiceId is required');
    return publishVoice(voiceId, { force: Boolean(force) });
  }
);

module.exports = { publishVoiceMetaobject, publishVoice, unpublishVoice };
