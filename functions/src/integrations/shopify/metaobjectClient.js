/**
 * Shared metaobject mutations.
 *
 * Identity model: every DawinOS-published metaobject carries a `dawin_source_id`
 * field whose value equals the Firestore doc id of the source entity. The
 * publisher first writes a Shopify GID back to the source doc; subsequent
 * publishes use the cached GID for `metaobjectUpdate`. We also expose
 * `findByDawinSourceId` as a fallback (rare — only used by the reconciler
 * after a Firestore restore that drops the GID).
 */

const { logger } = require('firebase-functions');
const { shopifyGraphQL } = require('./adminClient');

const METAOBJECT_CREATE = `
  mutation MetaobjectCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle type displayName }
      userErrors { field message code }
    }
  }
`;

const METAOBJECT_UPDATE = `
  mutation MetaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject { id handle type displayName }
      userErrors { field message code }
    }
  }
`;

const METAOBJECT_BY_HANDLE = `
  query MetaobjectByHandle($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) {
      id type displayName
      fields { key value }
    }
  }
`;

const METAOBJECTS_BY_SOURCE_ID = `
  query MetaobjectsBySourceId($type: String!, $query: String!) {
    metaobjects(type: $type, first: 5, query: $query) {
      nodes { id handle type fields { key value } }
    }
  }
`;

/**
 * @param {object} config
 * @param {object} params
 * @param {string} params.type             metaobject type ("finish", "project", ...)
 * @param {string} params.handle           kebab-case identifier
 * @param {string} params.dawinSourceId    Firestore doc id (kept in `dawin_source_id` field)
 * @param {Array<{key,value}>} params.fields   shopify field values (value is JSON-encoded for refs/lists)
 * @param {string} [params.existingGid]    if present, route to update
 * @param {string} [params.status]         "ACTIVE" (default) | "DRAFT"
 *
 * @returns {Promise<{ gid: string, handle: string, isNew: boolean }>}
 */
async function upsertMetaobject(config, params) {
  const { type, handle, dawinSourceId, fields, existingGid, status = 'ACTIVE' } = params;

  // Always inject dawin_source_id so reconciler can find us
  const fullFields = [
    ...fields.filter((f) => f.key !== 'dawin_source_id'),
    { key: 'dawin_source_id', value: String(dawinSourceId) },
  ].filter((f) => f.value !== undefined && f.value !== null && f.value !== '');

  if (existingGid) {
    const data = await shopifyGraphQL(config, METAOBJECT_UPDATE, {
      id: existingGid,
      metaobject: { fields: fullFields, capabilities: { publishable: { status } } },
    }, { entity: type, dawin_id: dawinSourceId, action: 'metaobjectUpdate', shopify_gid: existingGid });
    const errs = data.metaobjectUpdate?.userErrors || [];
    if (errs.length > 0) {
      // Stale GID — fall through to create.
      if (errs.some((e) => e.code === 'OBJECT_NOT_FOUND' || /not found/i.test(e.message || ''))) {
        logger.warn('shopify.metaobjectUpdate.stale-gid-fallback-create', { type, existingGid });
        return upsertMetaobject(config, { ...params, existingGid: undefined });
      }
      throw new Error(`metaobjectUpdate userErrors: ${JSON.stringify(errs)}`);
    }
    const mo = data.metaobjectUpdate.metaobject;
    return { gid: mo.id, handle: mo.handle, isNew: false };
  }

  const data = await shopifyGraphQL(config, METAOBJECT_CREATE, {
    metaobject: {
      type,
      handle,
      fields: fullFields,
      capabilities: { publishable: { status } },
    },
  }, { entity: type, dawin_id: dawinSourceId, action: 'metaobjectCreate' });

  const errs = data.metaobjectCreate?.userErrors || [];
  if (errs.length > 0) {
    // Handle collision — handle already taken. Probably a duplicate publish race.
    if (errs.some((e) => e.code === 'TAKEN' || /taken/i.test(e.message || ''))) {
      const existing = await findByHandle(config, type, handle);
      if (existing?.id) {
        return upsertMetaobject(config, { ...params, existingGid: existing.id });
      }
    }
    throw new Error(`metaobjectCreate userErrors: ${JSON.stringify(errs)}`);
  }
  const mo = data.metaobjectCreate.metaobject;
  return { gid: mo.id, handle: mo.handle, isNew: true };
}

async function findByHandle(config, type, handle) {
  const data = await shopifyGraphQL(config, METAOBJECT_BY_HANDLE, {
    handle: { type, handle },
  }, { entity: type, action: 'metaobjectByHandle' });
  return data.metaobjectByHandle;
}

/**
 * Search for a metaobject whose `dawin_source_id` field matches.
 * Used by the daily reconciler when a Firestore record lost its GID.
 */
async function findByDawinSourceId(config, type, dawinSourceId) {
  const data = await shopifyGraphQL(config, METAOBJECTS_BY_SOURCE_ID, {
    type,
    query: `fields.dawin_source_id:${dawinSourceId}`,
  }, { entity: type, dawin_id: dawinSourceId, action: 'metaobjectsSearch' });
  const nodes = data.metaobjects?.nodes || [];
  // Filter strictly — Shopify's search is fuzzy on field values.
  return nodes.find((n) =>
    (n.fields || []).some((f) => f.key === 'dawin_source_id' && f.value === String(dawinSourceId))
  );
}

/**
 * Convenience: JSON-encode list and reference fields per Shopify's
 * metaobject field-value contract.
 *
 *   scalar (text/number/bool/date): pass string
 *   list.* : JSON array of strings
 *   metaobject_reference / file_reference / product_reference: GID string
 *   list.metaobject_reference / list.file_reference / list.product_reference: JSON array of GIDs
 *   color: hex string "#rrggbb"
 *   rich_text_field: JSON Slate-like AST string (or plain "{\"type\":\"root\",\"children\":[...]}")
 */
function encodeFieldValue(type, value) {
  if (value == null) return undefined;
  if (type.startsWith('list.')) {
    if (!Array.isArray(value)) return undefined;
    if (value.length === 0) return undefined;
    return JSON.stringify(value.map((v) => (typeof v === 'string' ? v : String(v))));
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : String(value);
}

/**
 * Build a Shopify field-payload array from a {key,type,value} list,
 * skipping undefined values.
 */
function buildFields(rows) {
  const out = [];
  for (const row of rows) {
    if (!row || row.value === undefined || row.value === null || row.value === '') continue;
    const encoded = encodeFieldValue(row.type, row.value);
    if (encoded === undefined) continue;
    out.push({ key: row.key, value: encoded });
  }
  return out;
}

module.exports = {
  upsertMetaobject,
  findByHandle,
  findByDawinSourceId,
  encodeFieldValue,
  buildFields,
};
