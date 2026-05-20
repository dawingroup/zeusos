/**
 * Apply DawinOS metafields to a Shopify product.
 *
 * Writes the `dawin.*` namespace metafields defined in schema §4.1 onto an
 * already-synced Shopify product. Idempotent (Shopify upserts by namespace+key).
 *
 * Inputs: inventoryItemId → reads the InventoryItem from Firestore, resolves
 * linked finish (→ dawin.finish_id), materials (→ dawin.materials list), and
 * projects (→ dawin.projects_used_in list) to Shopify GIDs, then upserts.
 *
 * Used by:
 *   - onProductSynced webhook (after inventoryShopifyLinkService completes)
 *   - manufacturing-order stage trigger (flips workshop_status to in-stock)
 *   - daily reconciler
 */

const { logger } = require('firebase-functions');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { shopifyGraphQL, getShopifyConfig } = require('./adminClient');

const INVENTORY_COLLECTION = 'inventoryItems';
const FINISH_COLLECTION = 'finishLibrary';
const PROJECT_COLLECTION = 'projectCaseStudies';

const METAFIELDS_SET = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key value type }
      userErrors { field message code }
    }
  }
`;

function encode(type, value) {
  if (value == null || value === '') return undefined;
  if (type.startsWith('list.')) {
    if (!Array.isArray(value)) return undefined;
    if (value.length === 0) return undefined;
    return JSON.stringify(value.map(String));
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : String(value);
}

function row(key, type, value) {
  const v = encode(type, value);
  if (v === undefined) return null;
  return { namespace: 'dawin', key, type, value: v };
}

async function resolveFinishGid(db, finishId) {
  if (!finishId) return null;
  const snap = await db.collection(FINISH_COLLECTION).doc(finishId).get();
  return snap.exists ? snap.data().dawinFinishes?.shopifyMetaobjectGid || null : null;
}

async function resolveMaterialGids(db, materialIds) {
  if (!materialIds || materialIds.length === 0) return [];
  const snaps = await Promise.all(materialIds.map((id) => db.collection(INVENTORY_COLLECTION).doc(id).get()));
  return snaps
    .filter((s) => s.exists)
    .map((s) => s.data().shopify?.materialMetaobjectGid)
    .filter(Boolean);
}

async function resolveProjectGids(db, projectIds) {
  if (!projectIds || projectIds.length === 0) return [];
  const snaps = await Promise.all(projectIds.map((id) => db.collection(PROJECT_COLLECTION).doc(id).get()));
  return snaps
    .filter((s) => s.exists)
    .map((s) => s.data().storefront?.shopifyMetaobjectGid)
    .filter(Boolean);
}

/**
 * @param {string} inventoryItemId   DawinOS doc id
 * @param {object} [opts]
 * @param {string} [opts.workshopStatusOverride]  Optional override "in-stock"|"made-to-order"|"draft"
 */
async function applyProductMetafields(inventoryItemId, opts = {}) {
  const db = getFirestore();
  const ref = db.collection(INVENTORY_COLLECTION).doc(inventoryItemId);
  const snap = await ref.get();
  if (!snap.exists) {
    logger.warn('applyProductMetafields.skip-missing', { inventoryItemId });
    return { status: 'skipped', reason: 'item not found' };
  }
  const item = snap.data();
  const ownerId = item.shopifyProductId;
  if (!ownerId) {
    return { status: 'skipped', reason: 'no shopifyProductId — product not yet synced' };
  }
  const ownerGid = ownerId.startsWith('gid://') ? ownerId : `gid://shopify/Product/${ownerId}`;
  const config = await getShopifyConfig();

  const sh = item.shopify || {};
  const finishGid = await resolveFinishGid(db, item.linkedFinishId || sh.finishId);
  const materialGids = await resolveMaterialGids(db, sh.materialIds || item.materialIds);
  const projectGids = await resolveProjectGids(db, sh.projectsUsedInIds);

  const workshopStatus = opts.workshopStatusOverride || sh.workshopStatus || (sh.isMTO ? 'made-to-order' : 'in-stock');

  const rows = [
    row('workshop_status',     'single_line_text_field', workshopStatus),
    row('lead_time_days_min',  'number_integer',         sh.leadTimeDaysMin),
    row('lead_time_days_max',  'number_integer',         sh.leadTimeDaysMax),
    row('hand_count',          'number_integer',         sh.handCount),
    row('bench_number',        'single_line_text_field', sh.benchNumber),
    row('signed_by',           'single_line_text_field', sh.signedBy),
    row('batch_id',            'single_line_text_field', sh.batchId),
    row('recipe_id',           'single_line_text_field', sh.recipeId),
    row('dimensions_w_mm',     'number_integer',         sh.dimensionsWmm),
    row('dimensions_h_mm',     'number_integer',         sh.dimensionsHmm),
    row('dimensions_d_mm',     'number_integer',         sh.dimensionsDmm),
    row('weight_kg',           'number_decimal',         sh.weightKg),
    row('care_instructions',   'rich_text_field',        sh.careInstructions ? JSON.stringify({ type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', value: sh.careInstructions }] }] }) : undefined),
    row('warranty_months',     'number_integer',         sh.warrantyMonths),
    row('country_of_origin',   'single_line_text_field', sh.countryOfOrigin),
    row('workshop',            'single_line_text_field', sh.workshop),
    row('designer_id',         'single_line_text_field', sh.designerId),
    row('finish_id',           'metaobject_reference',   finishGid),
    row('materials',           'list.metaobject_reference', materialGids),
    row('projects_used_in',    'list.metaobject_reference', projectGids),
    row('last_reconciled_at',  'date_time',              new Date().toISOString()),
  ].filter(Boolean).map((r) => ({ ...r, ownerId: ownerGid }));

  if (rows.length === 0) return { status: 'noop', reason: 'no fields to write' };

  const data = await shopifyGraphQL(config, METAFIELDS_SET, { metafields: rows }, {
    entity: 'product',
    dawin_id: inventoryItemId,
    action: 'metafieldsSet',
    shopify_gid: ownerGid,
  });
  const errs = data.metafieldsSet?.userErrors || [];
  if (errs.length > 0) {
    logger.warn('applyProductMetafields.userErrors', { inventoryItemId, errors: errs });
    await ref.update({
      'shopify.metafieldsLastError': JSON.stringify(errs).slice(0, 1000),
      'shopify.metafieldsLastAt': Timestamp.now(),
    });
    return { status: 'partial', errors: errs };
  }
  await ref.update({
    'shopify.metafieldsLastAt': Timestamp.now(),
    'shopify.metafieldsLastError': null,
    'shopify.workshopStatus': workshopStatus,
  });
  logger.info('applyProductMetafields.ok', { inventoryItemId, count: rows.length });
  return { status: 'synced', count: rows.length };
}

module.exports = { applyProductMetafields };
