/**
 * What a competitor hard-delete takes with it
 * (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md, finding B1 / D-3).
 *
 * The UI's delete dialog promised "all associated data will be removed" and
 * did a bare `deleteDoc`. In DawinOS that left 122 flags, 999 of 3,000
 * sampled posts and 39 profiles pointing at competitors that no longer
 * existed. In ZeusOS the client now ARCHIVES (`archived: true`, who, when,
 * why — the record stays and lists hide it); a hard delete is admin-only in
 * the rules and the `onCompetitorDeleted` trigger runs this cascade:
 *
 *   - rows in every child collection keyed by `competitorId` are deleted
 *     (`COMPETITOR_CHILD_COLLECTIONS` in marketIntelVocabulary.js);
 *   - records that merely REFERENCE the competitor in an array
 *     (`COMPETITOR_REFERENCE_ARRAYS`) have the id removed, not the record.
 *
 * `planCompetitorCascade` is pure and unit-tested; `runCompetitorCascade`
 * reads with the Admin SDK and writes in batches (or directly when the
 * database has no `batch()`, which is what the test stub offers).
 */
'use strict';

const {
  COMPETITOR_CHILD_COLLECTIONS,
  COMPETITOR_REFERENCE_ARRAYS,
} = require('./marketIntelVocabulary');

const BATCH_LIMIT = 400;

/**
 * Pure: `children` is `{ [collectionId]: Array<{ id, data }> }` as read by
 * `collectCompetitorChildren`. Returns the writes, child deletes first.
 */
function planCompetitorCascade(competitorId, children) {
  const ops = [];
  if (typeof competitorId !== 'string' || competitorId === '') return ops;
  const rows = children || {};
  for (const spec of COMPETITOR_CHILD_COLLECTIONS) {
    for (const row of rows[spec.id] || []) {
      const data = (row && row.data) || {};
      if (data[spec.competitorField] !== competitorId) continue;
      ops.push({ op: 'delete', collection: spec.id, id: row.id });
    }
  }
  for (const spec of COMPETITOR_REFERENCE_ARRAYS) {
    for (const row of rows[spec.id] || []) {
      const data = (row && row.data) || {};
      const arr = Array.isArray(data[spec.field]) ? data[spec.field] : [];
      if (!arr.includes(competitorId)) continue;
      ops.push({
        op: 'update',
        collection: spec.id,
        id: row.id,
        update: { [spec.field]: arr.filter((x) => x !== competitorId) },
      });
    }
  }
  return ops;
}

/** Summary of a plan: how many rows go per collection, how many are detached. */
function summarizeCascade(ops) {
  const byCollection = {};
  let deleted = 0;
  let detached = 0;
  for (const op of ops) {
    byCollection[op.collection] = (byCollection[op.collection] || 0) + 1;
    if (op.op === 'delete') deleted += 1;
    else detached += 1;
  }
  return { deleted, detached, byCollection };
}

async function collectCompetitorChildren(db, competitorId) {
  const children = {};
  for (const spec of COMPETITOR_CHILD_COLLECTIONS) {
    const snap = await db.collection(spec.id).where(spec.competitorField, '==', competitorId).get();
    children[spec.id] = snap.docs.map((d) => ({ id: d.id, data: d.data() }));
  }
  for (const spec of COMPETITOR_REFERENCE_ARRAYS) {
    const snap = await db.collection(spec.id).where(spec.field, 'array-contains', competitorId).get();
    children[spec.id] = (children[spec.id] || []).concat(snap.docs.map((d) => ({ id: d.id, data: d.data() })));
  }
  return children;
}

async function applyCascade(db, ops, deps = {}) {
  const now = deps.now || (() => new Date().toISOString());
  const canBatch = typeof db.batch === 'function';
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = canBatch ? db.batch() : null;
    for (const op of chunk) {
      const ref = db.collection(op.collection).doc(op.id);
      if (op.op === 'delete') {
        if (batch) batch.delete(ref);
        else await ref.delete();
      } else {
        const patch = { ...op.update, updatedAt: now() };
        if (batch) batch.update(ref, patch);
        else await ref.update(patch);
      }
    }
    if (batch) await batch.commit();
  }
}

/** Read, plan, apply. Returns the plan's summary. Never throws on an empty plan. */
async function runCompetitorCascade(db, competitorId, deps = {}) {
  const children = await collectCompetitorChildren(db, competitorId);
  const ops = planCompetitorCascade(competitorId, children);
  await applyCascade(db, ops, deps);
  return { competitorId, ...summarizeCascade(ops) };
}

module.exports = {
  BATCH_LIMIT,
  planCompetitorCascade,
  summarizeCascade,
  collectCompetitorChildren,
  applyCascade,
  runCompetitorCascade,
};
