/**
 * Event/Task Engine — expression helpers.
 *
 * Pure functions (no Firestore). Mirror the TS versions in
 * src/modules/intelligence-layer/types/event-task-engine.types.ts —
 * server-side copy here so the trigger doesn't have to resolve TS
 * paths at runtime.
 *
 * Three primitives:
 *   getByPath          dotted-path read against a plain object
 *   evaluateCondition  single { op, path, value } predicate
 *   interpolateTemplate {{path.to.field}} substitution
 */

function getByPath(obj, path) {
  if (obj == null || !path) return undefined;
  const parts = String(path).split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function evaluateCondition(event, cond) {
  if (!cond || typeof cond !== 'object') return false;
  const actual = getByPath(event, cond.path);
  switch (cond.op) {
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'eq':
      return actual === cond.value;
    case 'neq':
      return actual !== cond.value;
    case 'gt':
      return typeof actual === 'number' && typeof cond.value === 'number' && actual > cond.value;
    case 'gte':
      return typeof actual === 'number' && typeof cond.value === 'number' && actual >= cond.value;
    case 'lt':
      return typeof actual === 'number' && typeof cond.value === 'number' && actual < cond.value;
    case 'lte':
      return typeof actual === 'number' && typeof cond.value === 'number' && actual <= cond.value;
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(cond.value);
      if (typeof actual === 'string' && typeof cond.value === 'string') return actual.includes(cond.value);
      return false;
    default:
      return false;
  }
}

function evaluateAllConditions(event, conditions) {
  if (!Array.isArray(conditions) || conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(event, c));
}

function interpolateTemplate(tpl, ctx) {
  if (typeof tpl !== 'string') return '';
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const v = getByPath(ctx, path);
    return v === undefined || v === null ? '' : String(v);
  });
}

module.exports = {
  getByPath,
  evaluateCondition,
  evaluateAllConditions,
  interpolateTemplate,
};
