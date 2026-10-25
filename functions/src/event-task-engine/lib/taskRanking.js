/**
 * Shared task ranking — the ONE scoring function behind every "what should
 * this person do next" surface (the 06:00 publish, the 17:00 draft, the
 * inbox's urgency sort). The client mirror is `computeUrgencyScore` in
 * src/modules/intelligence-layer/hooks/useEmployeeTaskInbox.ts — change the
 * weights in both places.
 *
 * Score = priority weight
 *       + aiUrgencyScore/2
 *       + due-distance (closer = higher)
 *       + overdue bump
 *       + administrative bump (approvals block other people)
 *
 * Time is Africa/Nairobi (UTC+3, no DST) throughout the task engine.
 */

const { normalisePriority, toMillis, dueMsOf, assigneeOf } = require('./taskModel');

const PRIORITY_WEIGHT = Object.freeze({ P0: 100, P1: 70, P2: 40, P3: 10 });

/** Approvals and money/compliance work block other people. */
const ADMIN_ENTITY_TYPES = new Set([
  'purchase_order', 'client_invoice', 'intercompany_invoice', 'talent_invoice',
  'media_supplier_invoice', 'journal_entry', 'change_order', 'quote', 'sow', 'msa',
]);

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const TIME_ZONE = 'Africa/Nairobi';

function scoreTask(t, now) {
  const p = PRIORITY_WEIGHT[normalisePriority(t.priority)];
  const ai = (Number(t.aiUrgencyScore) || 0) / 2;
  const dueMs = dueMsOf(t);
  const due = dueMs != null ? Math.max(0, 30 - (dueMs - now) / MS_PER_DAY) : 0;
  const overdue = dueMs != null && dueMs < now ? 30 : 0;
  const admin_ = (t.kind === 'approval' ? 25 : 0) + (ADMIN_ENTITY_TYPES.has(t.entityType) ? 15 : 0);
  return p + ai + due + overdue + admin_;
}

/**
 * Nairobi date key. `offsetDays` shifts in LOCAL days — dateKey(now, 1) is
 * tomorrow in Nairobi, which is what the evening draft plans for.
 */
function dateKey(nowMs, offsetDays = 0) {
  const eat = new Date(nowMs + EAT_OFFSET_MS + offsetDays * MS_PER_DAY);
  return eat.toISOString().slice(0, 10);
}

/** True when the task should never appear on a person's focus plan. */
function isPlannableTask(t) {
  if (!t) return false;
  if (!assigneeOf(t)) return false;
  if (t.kind === 'notify') return false; // FYI noise, not work
  // Pinned onto the manager's plan separately (dailyPlanDraftRun), never ranked.
  if (t.entityType === 'daily_plan_review') return false;
  return true;
}

module.exports = {
  ADMIN_ENTITY_TYPES,
  PRIORITY_WEIGHT,
  MS_PER_DAY,
  EAT_OFFSET_MS,
  TIME_ZONE,
  toMillis,
  scoreTask,
  dateKey,
  isPlannableTask,
};
