/**
 * Stale-task policy — removes NOISE from the task distribution, never work.
 *
 *   Only tasks nobody has engaged with (`assigned`, never started) are
 *   eligible — in_progress / blocked means a human engaged.
 *
 *   1. approval-kind tasks and admin entity types NEVER expire (they escalate;
 *      the auto-close run clears them once the record resolves).
 *   2. notify-kind tasks older than NOTIFY_MAX_AGE_DAYS → cancelled.
 *   3. past due > STALE_AFTER_DAYS, priority P2/P3, and the linked record is
 *      resolved / missing / unresolvable → cancelled. A record still open
 *      keeps the task alive. A person's OWN task is theirs to close.
 *
 * PURE apart from the injected `resolveEntity` read.
 */

const { toMillis, dueMsOf, normalisePriority, normaliseStatus } = require('./taskModel');
const { ADMIN_ENTITY_TYPES } = require('./taskRanking');
const { resolveEntity: defaultResolve } = require('./entityResolution');

const STALE_AFTER_DAYS = 14;
const NOTIFY_MAX_AGE_DAYS = 30;
const SWEEP_PRIORITIES = new Set(['P2', 'P3']);
const DAY_MS = 24 * 60 * 60 * 1000;

function isAdminProtected(task) {
  return task.kind === 'approval' || ADMIN_ENTITY_TYPES.has(task.entityType) || task.entityType === 'daily_plan_review';
}

/**
 * Classify one task. Returns a cancel reason ('notify_expired' | 'expired' |
 * 'entity_missing') or null (keep).
 */
async function classifyStaleTask(db, task, now, cache, resolve = defaultResolve) {
  if (normaliseStatus(task.status) !== 'assigned') return null;
  if (task.source === 'personal') return null;
  if (isAdminProtected(task)) return null;

  if (task.kind === 'notify') {
    const createdMs = toMillis(task.createdAt);
    if (createdMs != null && createdMs < now - NOTIFY_MAX_AGE_DAYS * DAY_MS) return 'notify_expired';
    return null;
  }

  const dueMs = dueMsOf(task);
  if (dueMs == null || dueMs > now - STALE_AFTER_DAYS * DAY_MS) return null;
  if (!SWEEP_PRIORITIES.has(normalisePriority(task.priority))) return null;

  if (!task.entityType || !task.entityId) return 'expired';
  const state = await resolve(db, task, { cache });
  if (state === 'resolved') return 'expired';
  if (state === 'missing') return 'entity_missing';
  if (state === 'unsupported') return 'expired';
  return null; // 'open' (real work survives) or 'error' (retry next run)
}

module.exports = { classifyStaleTask, isAdminProtected, STALE_AFTER_DAYS, NOTIFY_MAX_AGE_DAYS, SWEEP_PRIORITIES };
