/**
 * Read-handler factory (ported from DawinOS).
 *
 * Most `read.*` tools are "fetch this Firestore collection, optionally
 * filtered, ordered, bounded." This config-driven factory means registering a
 * new read tool is one line in ./collectionMap.js, not a fresh handler.
 *
 * Input: { id?, limit?, filters?, orderBy?, companyId? } → { result, summary }.
 * Scopes: 'global' (top-level — the ZeusOS default for commercial collections),
 * 'company' (companies/{companyId}/<collection> — strategy collections),
 * 'collectionGroup', and 'deep' (fixed path).
 */

const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const STRATEGY_COMPANY_ID = 'zeus-group';
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

const ALLOWED_OPS = new Set([
  '==', '!=', '>', '>=', '<', '<=', 'in', 'not-in', 'array-contains', 'array-contains-any',
]);

function resolveCollection(config, companyId) {
  if (config.scope === 'global') {
    return db.collection(config.collection);
  }
  if (config.scope === 'collectionGroup') {
    if (!config.collection) {
      throw new Error(`readFactory: collectionGroup scope requires 'collection'`);
    }
    return db.collectionGroup(config.collection);
  }
  if (config.scope === 'deep') {
    if (!Array.isArray(config.path) || config.path.length === 0) {
      throw new Error(`readFactory: deep scope requires 'path' array`);
    }
    if (config.path.length % 2 === 0) {
      throw new Error(`readFactory: deep path must be odd-length (collection/doc/collection/...)`);
    }
    let ref = db.collection(config.path[0]);
    for (let i = 1; i < config.path.length; i += 2) {
      ref = ref.doc(config.path[i]);
      if (i + 1 < config.path.length) ref = ref.collection(config.path[i + 1]);
    }
    return ref;
  }
  // company-scoped
  const segments = config.path || [config.collection];
  if (!segments || segments.length === 0) {
    throw new Error(`readFactory: config requires 'collection' or 'path'`);
  }
  if (segments.length > 1) {
    throw new Error(`readFactory: company-scope path must be a single segment`);
  }
  return db.collection('companies').doc(companyId).collection(segments[0]);
}

function clampLimit(n) {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function applyFilters(query, filters, allowedFilters) {
  if (!filters || typeof filters !== 'object') return query;
  for (const [field, raw] of Object.entries(filters)) {
    if (allowedFilters && !allowedFilters.includes(field)) continue;
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.op) {
      if (!ALLOWED_OPS.has(raw.op)) continue;
      query = query.where(field, raw.op, raw.value);
    } else {
      query = query.where(field, '==', raw);
    }
  }
  return query;
}

function applyOrder(query, override, defaultOrder) {
  const order = override || defaultOrder;
  if (!order || !order.field) return query;
  const dir = order.direction === 'asc' ? 'asc' : 'desc';
  try {
    return query.orderBy(order.field, dir);
  } catch (err) {
    console.warn(`[readFactory] orderBy(${order.field}, ${dir}) failed; unordered: ${err.message}`);
    return query;
  }
}

function createReadHandler(config) {
  if (!config || (!config.collection && !config.path)) {
    throw new Error('createReadHandler: config.collection or config.path required');
  }
  const {
    toolId = 'read.unknown',
    scope = 'company',
    entityLabel = 'record',
    allowedFilters = null,
    defaultOrder = { field: 'updatedAt', direction: 'desc' },
    project,
  } = config;

  return async function handle(input) {
    const safeInput = input && typeof input === 'object' ? input : {};
    const companyId = safeInput.companyId || STRATEGY_COMPANY_ID;
    const colRef = resolveCollection({ ...config, scope }, companyId);

    if (safeInput.id && typeof safeInput.id === 'string') {
      if (scope === 'collectionGroup') {
        throw new Error(`${toolId}: by-id fetch unsupported for collectionGroup scope.`);
      }
      const snap = await colRef.doc(safeInput.id).get();
      if (!snap.exists) {
        return { result: null, summary: `No ${entityLabel} found for id=${safeInput.id}` };
      }
      const raw = { id: snap.id, ...snap.data() };
      return { result: project ? project(raw) : raw, summary: `Fetched ${entityLabel} ${safeInput.id}` };
    }

    const limit = clampLimit(safeInput.limit);
    let q = applyFilters(colRef, safeInput.filters, allowedFilters);
    q = applyOrder(q, safeInput.orderBy, defaultOrder);
    q = q.limit(limit);

    const snap = await q.get();
    const docs = snap.docs.map((d) => {
      const raw = { id: d.id, ...d.data() };
      return project ? project(raw) : raw;
    });

    return { result: docs, summary: `Listed ${docs.length} ${entityLabel}(s) via ${toolId} (limit=${limit})` };
  };
}

module.exports = { createReadHandler, STRATEGY_COMPANY_ID, DEFAULT_LIMIT, MAX_LIMIT };
