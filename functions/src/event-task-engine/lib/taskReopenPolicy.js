/**
 * When may the system bring a closed task back?
 *
 *   - a task the SYSTEM closed is re-opened freely — it was closed on a data
 *     signal, and the signal flipped back;
 *   - a task a PERSON closed stands for `HUMAN_CLOSE_COOLDOWN_DAYS`. The data
 *     usually lags the act, and the person knows something the record does
 *     not. After the cooldown the finding is allowed back;
 *   - every re-open is a CLEAN one (`reopenFields`) that says who and why.
 *
 * Pure: no Firestore access, `now` injected. Ported from DawinOS.
 */

const { toMillis, assigneeOf, ASSIGNED_STATUS, historyEntry } = require('./taskModel');

const HUMAN_CLOSE_COOLDOWN_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const REOPENABLE_STATUSES = new Set(['completed', 'cancelled']);

/**
 * Closed by a sweep or trigger rather than a person. Every system close stamps
 * `outcomeBy: 'system'` and a `closedBy` starting `system`; a person's close
 * stamps their uid on `outcomeBy`. A close that names nobody is treated as a
 * PERSON's — the cautious reading.
 */
function isSystemClosed(task) {
  if (!task) return false;
  if (task.outcomeBy && task.outcomeBy !== 'system') return false;
  if (task.outcomeBy === 'system') return true;
  return typeof task.closedBy === 'string' && task.closedBy.startsWith('system');
}

function decideReopen(task, opts = {}) {
  if (!task || !REOPENABLE_STATUSES.has(task.status)) return { reopen: false, reason: 'not_closed' };
  if (isSystemClosed(task)) return { reopen: true, reason: 'system_closed' };

  const now = toMillis(opts.now) ?? Date.now();
  const cooldownDays = typeof opts.cooldownDays === 'number' ? opts.cooldownDays : HUMAN_CLOSE_COOLDOWN_DAYS;
  const closedAtMs = toMillis(task.outcomeAt) ?? toMillis(task.completedAt) ?? toMillis(task.updatedAt);
  if (closedAtMs == null) return { reopen: false, reason: 'human_close_cooldown', closedAtMs: null };
  const cooldownEndsMs = closedAtMs + cooldownDays * MS_PER_DAY;
  return now >= cooldownEndsMs
    ? { reopen: true, reason: 'human_close_cooldown_elapsed', closedAtMs, cooldownEndsMs }
    : { reopen: false, reason: 'human_close_cooldown', closedAtMs, cooldownEndsMs };
}

/**
 * The re-open write. Clears every close stamp so the task completes afresh
 * next time, and records who brought it back and why.
 */
function reopenFields(task, { by, reason, nowIso }) {
  const now = nowIso || new Date().toISOString();
  const status = assigneeOf(task) ? ASSIGNED_STATUS : 'pending_assignment';
  return {
    status,
    outcome: null,
    outcomeBy: null,
    outcomeAt: null,
    completedAt: null,
    cancelledAt: null,
    closedBy: null,
    autoClosedAt: null,
    autoClosedReason: null,
    previousClose: {
      status: (task && task.status) || null,
      outcomeBy: (task && task.outcomeBy) || null,
      outcomeAt: (task && (task.outcomeAt || task.completedAt)) || null,
      closedBy: (task && task.closedBy) || null,
    },
    reopenedAt: now,
    reopenedBy: by,
    reopenReason: reason,
    reopenCount: (Number(task && task.reopenCount) || 0) + 1,
    history: [
      ...(Array.isArray(task && task.history) ? task.history : []),
      historyEntry({ fromStatus: task && task.status, toStatus: status, actorUserId: by, notes: reason, nowIso: now }),
    ],
    updatedAt: now,
  };
}

module.exports = { HUMAN_CLOSE_COOLDOWN_DAYS, isSystemClosed, decideReopen, reopenFields };
