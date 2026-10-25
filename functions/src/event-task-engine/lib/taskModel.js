/**
 * ONE vocabulary for `generated_tasks` — Phase 6.E task hardening.
 *
 * Every writer of a task (the event engine, agents, the callables, the
 * sweeps) and every reader (inbox, Daily Plan, notices) speaks through this
 * module, so a status or priority word cannot drift between them the way it
 * did in DawinOS (three priority vocabularies, two status vocabularies —
 * audit 2026-09-18).
 *
 * Statuses (src/modules/intelligence-layer/types/event-task-engine.types.ts):
 *   pending_assignment  no person yet — floats in the pool / is resolved by
 *                       the hygiene run (lib/assigneeResolution.js)
 *   assigned            on a person, not started. Legacy agent drafts wrote
 *                       `pending` for the same thing; it is READ as assigned
 *                       and never written again.
 *   in_progress         the person pressed Start
 *   pending_review      submitted for sign-off (optional step)
 *   blocked             on hold, with a reason — still open work
 *   completed/cancelled terminal
 *
 * Priorities are P0 (critical) … P3 (low). Legacy words (urgent/high/medium/
 * low/critical) are mapped on read so an old doc still ranks.
 *
 * PURE: no Firebase imports. Timestamps on a task are ISO strings (the engine
 * convention); `toMillis` also accepts Firestore Timestamps, Dates and numbers
 * so a legacy doc never crashes a sweep.
 */

const TASKS_COLLECTION = 'generated_tasks';

const OPEN_STATUSES = Object.freeze([
  'pending_assignment', 'assigned', 'pending', 'in_progress', 'pending_review', 'blocked', 'escalated',
]);
/** Open AND on a person — what a plan or a reminder can be built from. */
const ACTIVE_STATUSES = Object.freeze(['assigned', 'pending', 'in_progress', 'pending_review', 'blocked', 'escalated']);
const TERMINAL_STATUSES = Object.freeze(['completed', 'cancelled']);
/** The word written for "on a person, not started". */
const ASSIGNED_STATUS = 'assigned';

const PRIORITIES = Object.freeze(['P0', 'P1', 'P2', 'P3']);
const LEGACY_PRIORITY = Object.freeze({
  critical: 'P0', urgent: 'P0', high: 'P1', medium: 'P2', low: 'P3',
});

/** 'P2' for anything unknown — the same default the generator writes. */
function normalisePriority(value) {
  if (typeof value !== 'string') return 'P2';
  const v = value.trim();
  if (PRIORITIES.includes(v)) return v;
  return LEGACY_PRIORITY[v.toLowerCase()] || 'P2';
}

/** Legacy `pending` reads as `assigned`; everything else as written. */
function normaliseStatus(value) {
  if (value === 'pending') return ASSIGNED_STATUS;
  if (value === 'escalated') return ASSIGNED_STATUS;
  return typeof value === 'string' && value ? value : ASSIGNED_STATUS;
}

function isOpenStatus(status) {
  return OPEN_STATUSES.includes(status);
}
function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}
function isOpenTask(task) {
  return Boolean(task) && isOpenStatus(task.status);
}

/** Ids a task can be "assigned" to that are not a person. */
const NOT_A_PERSON = new Set(['', 'system', 'mcp', 'agent', 'unassigned']);

/** The uid a task is on, or null. Reads the legacy `assignedTo` too. */
function assigneeOf(task) {
  if (!task) return null;
  const raw = typeof task.assignedToUserId === 'string' && task.assignedToUserId.trim()
    ? task.assignedToUserId.trim()
    : typeof task.assignedTo === 'string' ? task.assignedTo.trim() : '';
  if (!raw || NOT_A_PERSON.has(raw) || raw.startsWith('agent:') || raw.startsWith('system:')) return null;
  return raw;
}

/**
 * Milliseconds from an ISO string, a Firestore Timestamp, a {seconds} shape,
 * a Date or a millis number. Null for anything else (including undefined).
 */
function toMillis(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v._seconds === 'number') return v._seconds * 1000;
  return null;
}

/** When the task is due, in ms — `dueAt` (ISO) first, legacy `dueDate` second. */
function dueMsOf(task) {
  if (!task) return null;
  return toMillis(task.dueAt) ?? toMillis(task.dueDate);
}

function isoOf(ms) {
  return new Date(ms).toISOString();
}

/** One audit row for `history[]`. */
function historyEntry({ fromStatus, toStatus, actorUserId, notes, nowIso }) {
  return {
    fromStatus: fromStatus ?? null,
    toStatus,
    actorUserId: actorUserId || 'system',
    notes: notes || null,
    occurredAt: nowIso || new Date().toISOString(),
  };
}

/**
 * The terminal write every system close uses (auto-close, stale sweep, watch
 * run). One shape, so the re-open policy can recognise a system close by
 * `outcomeBy: 'system'` + `closedBy: 'system:*'`.
 */
function systemCloseFields(task, { status, outcome, reason, closedBy, nowIso }) {
  const now = nowIso || new Date().toISOString();
  return {
    status,
    outcome,
    outcomeBy: 'system',
    outcomeAt: now,
    completedAt: now,
    closedBy,
    autoClosedAt: now,
    autoClosedReason: reason,
    history: [
      ...(Array.isArray(task && task.history) ? task.history : []),
      historyEntry({ fromStatus: task && task.status, toStatus: status, actorUserId: closedBy, notes: reason, nowIso: now }),
    ],
    updatedAt: now,
  };
}

/** Kinds decide the buttons a card shows (DawinOS task-management.md §kinds). */
const TASK_KINDS = Object.freeze(['approval', 'review', 'action', 'followup', 'notify']);

module.exports = {
  TASKS_COLLECTION,
  OPEN_STATUSES,
  ACTIVE_STATUSES,
  TERMINAL_STATUSES,
  ASSIGNED_STATUS,
  PRIORITIES,
  TASK_KINDS,
  NOT_A_PERSON,
  normalisePriority,
  normaliseStatus,
  isOpenStatus,
  isTerminalStatus,
  isOpenTask,
  assigneeOf,
  toMillis,
  dueMsOf,
  isoOf,
  historyEntry,
  systemCloseFields,
};
