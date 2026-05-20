/**
 * publishProjectMetaobject
 *
 * Replaces the old `shopifyPublishCaseStudy` (article-based) path. Publishes
 * a DawinOS ProjectCaseStudy as a Shopify `project` metaobject. URL-addressable
 * at https://dawinfinishes.com/projects/{handle}.
 *
 * The old export `shopifyPublishCaseStudy` is kept aliased to this for one
 * release in functions/index.js so callers don't break.
 *
 * Source-of-truth mapping: docs/integrations/metaobjects/project.json.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getShopifyConfig, pingIndexNow } = require('./adminClient');
const { uploadOrReplaceFile, uploadGallery } = require('./fileUpload');
const { upsertMetaobject, buildFields } = require('./metaobjectClient');

const CASE_STUDY_COLLECTION = 'projectCaseStudies';
const FINISH_COLLECTION = 'finishLibrary';
const INVENTORY_COLLECTION = 'inventoryItems';
const PRESS_COLLECTION = 'pressMentions';
const METAOBJECT_TYPE = 'project';

function richText(s) {
  if (!s) return undefined;
  return JSON.stringify({
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', value: String(s) }] }],
  });
}

/**
 * Resolve a list of DawinOS doc ids → Shopify metaobject GIDs.
 * Caller passes the collection name and the field path holding the GID.
 */
async function resolveGids(db, collection, ids, gidPath) {
  if (!ids || ids.length === 0) return [];
  const out = [];
  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
  for (const chunk of chunks) {
    const snaps = await Promise.all(chunk.map((id) => db.collection(collection).doc(id).get()));
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data();
      const gid = gidPath.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), data);
      if (gid) out.push(gid);
    }
  }
  return out;
}

async function publishProject(caseStudyId, { force = false } = {}) {
  const db = getFirestore();
  const ref = db.collection(CASE_STUDY_COLLECTION).doc(caseStudyId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', `Case study ${caseStudyId} not found`);
  const cs = snap.data();
  const sf = cs.storefront;

  if (!sf) {
    return { gid: null, status: 'skipped', reason: 'no storefront block — fill in to publish' };
  }
  if (!sf.shouldPublishToShopify && !force) {
    if (sf.shopifyMetaobjectGid) return await unpublishProject(caseStudyId);
    return { gid: null, status: 'skipped', reason: 'shouldPublishToShopify=false' };
  }
  if (!cs.handle) throw new HttpsError('failed-precondition', 'handle required');
  if (!cs.hero?.title) throw new HttpsError('failed-precondition', 'hero.title required');
  if (!cs.hero?.imageUrl) throw new HttpsError('failed-precondition', 'hero image required');
  if (!sf.locationCity || !sf.locationCountry) {
    throw new HttpsError('failed-precondition', 'storefront.locationCity/Country required');
  }

  await ref.update({
    'storefront.shopifySyncStatus': 'syncing',
    'storefront.shopifySyncError': FieldValue.delete(),
  });

  const config = await getShopifyConfig();
  const title = cs.hero.title;

  // 1. Hero image
  const hero = await uploadOrReplaceFile(config, {
    entityType: 'project',
    dawinSourceId: caseStudyId,
    slot: 'hero',
    sourceUrl: cs.hero.imageUrl,
    displayName: title,
    existingGid: sf.shopifyHeroImageGid,
  });

  // 2. Gallery (preserve order; cached GIDs by index)
  const galleryUrls = cs.gallery?.imagePaths || [];
  const galleryResults = await uploadGallery(config, {
    entityType: 'project',
    dawinSourceId: caseStudyId,
    displayName: title,
    items: galleryUrls.map((url, i) => ({
      sourceUrl: url,
      slot: `gallery-${i}`,
      existingGid: sf.shopifyGalleryImageGids?.[i],
    })),
  });

  // 3. Optional context images
  const beforeImg = sf.beforeImageUrl ? await uploadOrReplaceFile(config, {
    entityType: 'project', dawinSourceId: caseStudyId, slot: 'before',
    sourceUrl: sf.beforeImageUrl, displayName: title, existingGid: sf.shopifyBeforeImageGid,
  }) : null;
  const afterImg = sf.afterImageUrl ? await uploadOrReplaceFile(config, {
    entityType: 'project', dawinSourceId: caseStudyId, slot: 'after',
    sourceUrl: sf.afterImageUrl, displayName: title, existingGid: sf.shopifyAfterImageGid,
  }) : null;
  const floorPlan = sf.floorPlanImageUrl ? await uploadOrReplaceFile(config, {
    entityType: 'project', dawinSourceId: caseStudyId, slot: 'floor-plan',
    sourceUrl: sf.floorPlanImageUrl, displayName: title, existingGid: sf.shopifyFloorPlanImageGid,
  }) : null;

  // 4. Resolve linked refs to Shopify GIDs
  const finishGids = await resolveGids(db, FINISH_COLLECTION, sf.finishesUsedIds, 'dawinFinishes.shopifyMetaobjectGid');
  const materialGids = await resolveGids(db, INVENTORY_COLLECTION, sf.materialsUsedIds, 'shopify.materialMetaobjectGid');
  const pressGids = await resolveGids(db, PRESS_COLLECTION, sf.pressMentionIds, 'shopifyMetaobjectGid');

  // 5. Build fields per project.json spec
  const fields = buildFields([
    { key: 'title',              type: 'single_line_text_field', value: title },
    { key: 'sector',             type: 'single_line_text_field', value: sf.sector },
    { key: 'sub_sector',         type: 'single_line_text_field', value: sf.subSector },
    { key: 'client',             type: 'single_line_text_field', value: cs.hero.client },
    { key: 'location_city',      type: 'single_line_text_field', value: sf.locationCity },
    { key: 'location_country',   type: 'single_line_text_field', value: sf.locationCountry },
    { key: 'year_completed',     type: 'number_integer',         value: sf.yearCompleted },
    { key: 'month_completed',    type: 'number_integer',         value: sf.monthCompleted },
    { key: 'area_sqm',           type: 'number_integer',         value: sf.areaSqm },
    { key: 'scope',              type: 'list.single_line_text_field', value: sf.scope },
    { key: 'team_lead',          type: 'single_line_text_field', value: sf.teamLead },
    { key: 'team_size',          type: 'number_integer',         value: sf.teamSize },
    { key: 'duration_weeks',     type: 'number_integer',         value: sf.durationWeeks },
    { key: 'budget_band',        type: 'single_line_text_field', value: sf.budgetBand },
    { key: 'quote_text',         type: 'rich_text_field',        value: richText(cs.quote?.quote) },
    { key: 'quote_attribution',  type: 'single_line_text_field', value: cs.quote?.attribution },
    { key: 'hero_image',         type: 'file_reference',         value: hero?.gid },
    { key: 'gallery',            type: 'list.file_reference',    value: galleryResults.map((g) => g.gid) },
    { key: 'before_image',       type: 'file_reference',         value: beforeImg?.gid },
    { key: 'after_image',        type: 'file_reference',         value: afterImg?.gid },
    { key: 'floor_plan_image',   type: 'file_reference',         value: floorPlan?.gid },
    { key: 'body_long',          type: 'rich_text_field',        value: richText(cs.narrative?.body) },
    { key: 'finishes_used',      type: 'list.metaobject_reference', value: finishGids },
    { key: 'materials_used',     type: 'list.metaobject_reference', value: materialGids },
    { key: 'products_used',      type: 'list.product_reference',    value: sf.productsUsedShopifyIds },
    { key: 'press_mentions',     type: 'list.metaobject_reference', value: pressGids },
    { key: 'commissioned_by',    type: 'single_line_text_field', value: sf.commissionedBy },
    { key: 'partner_architect',  type: 'single_line_text_field', value: sf.partnerArchitect },
    { key: 'published',          type: 'boolean',                value: sf.storefrontPublished },
    { key: 'sort_index',         type: 'number_integer',         value: sf.sortIndex },
    { key: 'bench_log',          type: 'json',                   value: sf.benchLog ? JSON.stringify(sf.benchLog) : undefined },
  ]);

  const result = await upsertMetaobject(config, {
    type: METAOBJECT_TYPE,
    handle: cs.handle,
    dawinSourceId: caseStudyId,
    fields,
    existingGid: sf.shopifyMetaobjectGid,
    status: sf.storefrontPublished ? 'ACTIVE' : 'DRAFT',
  });

  const update = {
    'storefront.shopifyMetaobjectGid': result.gid,
    'storefront.shopifySyncStatus': 'synced',
    'storefront.shopifySyncError': FieldValue.delete(),
    'storefront.shopifyLastPublishedAt': Timestamp.now(),
    lastPublishedAt: Timestamp.now(),
    status: 'published',
  };
  if (hero?.gid) update['storefront.shopifyHeroImageGid'] = hero.gid;
  if (galleryResults.length > 0) update['storefront.shopifyGalleryImageGids'] = galleryResults.map((g) => g.gid);
  if (beforeImg?.gid) update['storefront.shopifyBeforeImageGid'] = beforeImg.gid;
  if (afterImg?.gid) update['storefront.shopifyAfterImageGid'] = afterImg.gid;
  if (floorPlan?.gid) update['storefront.shopifyFloorPlanImageGid'] = floorPlan.gid;
  await ref.update(update);

  await pingIndexNow(`https://${config.shopDomain.replace('.myshopify.com', '.com')}/projects/${cs.handle}`);

  logger.info('shopify.project.published', { caseStudyId, gid: result.gid, isNew: result.isNew });
  return { gid: result.gid, status: 'synced', isNew: result.isNew };
}

async function unpublishProject(caseStudyId) {
  const db = getFirestore();
  const ref = db.collection(CASE_STUDY_COLLECTION).doc(caseStudyId);
  const snap = await ref.get();
  if (!snap.exists) return { status: 'skipped' };
  const sf = snap.data().storefront;
  if (!sf?.shopifyMetaobjectGid) return { status: 'skipped', reason: 'no gid' };
  const config = await getShopifyConfig();
  await upsertMetaobject(config, {
    type: METAOBJECT_TYPE,
    handle: snap.data().handle,
    dawinSourceId: caseStudyId,
    fields: [],
    existingGid: sf.shopifyMetaobjectGid,
    status: 'DRAFT',
  });
  await ref.update({
    'storefront.shopifySyncStatus': 'unpublished',
    'storefront.shopifyLastPublishedAt': Timestamp.now(),
  });
  return { gid: sf.shopifyMetaobjectGid, status: 'unpublished' };
}

const publishProjectMetaobject = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 180 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const { caseStudyId, force } = request.data || {};
    if (!caseStudyId) throw new HttpsError('invalid-argument', 'caseStudyId is required');
    return publishProject(caseStudyId, { force: Boolean(force) });
  }
);

module.exports = { publishProjectMetaobject, publishProject, unpublishProject };
