/**
 * Task hygiene — every 30 minutes.
 *
 *   1. Pending assignments: tasks whose rule named a role / department /
 *      manager get an owner (lib/assigneeResolution.js). Never unowned.
 *   2. Auto-close: a task whose record has been dealt with on its own screen
 *      completes (lib/entityResolution.js); an orphan whose record vanished
 *      more than ORPHAN_MIN_AGE_DAYS ago is cancelled.
 *   3. Overdue escalation, counted in WORKING hours: past the threshold for
 *      its priority the task moves one notch up (P3→P2→P1→P0) and the
 *      assignee + manager hear (triggers/onTaskWritten.js on `escalatedAt`).
 *      Once at P0 and escalated it stays there — no repeat notices.
 *   4. Due-soon reminders at 24 / 4 / 1 hours, once each per task.
 */

const { TASKS_COLLECTION, OPEN_STATUSES, toMillis, dueMsOf, normalisePriority, historyEntry, assigneeOf } = require('../lib/taskModel');
const { AUTO_CLOSE_ENTITY_TYPES, autoCloseAllowed, resolveEntity } = require('../lib/entityResolution');
const { closeTask } = require('../lib/taskAutoClose');
const { resolvePendingAssignments } = require('../lib/assigneeResolution');
const { fetchOpenTasks } = require('../lib/dailyPlanData');
const { workingHoursBetween } = require('../lib/workingTime');
const { escalatedPriority, ESCALATION_AFTER_WORKING_HOURS } = require('../lib/taskPriority');
const { sendDueSoonReminder } = require('../lib/taskNotice');

const RUN_LIMIT_PER_TYPE = 300;
const ORPHAN_MIN_AGE_DAYS = 3;
const REMINDER_HOURS = [24, 4, 1];
const MS_PER_HOUR = 60 * 60 * 1000;
const DAY_MS = 24 * MS_PER_HOUR;

async function runAutoClose(db, { nowMs, nowIso, logger }) {
  const summary = { scanned: 0, closed: 0, orphansCancelled: 0, errors: 0 };
  const cache = new Map();
  for (const entityType of AUTO_CLOSE_ENTITY_TYPES) {
    let snap;
    try {
      snap = await db
        .collection(TASKS_COLLECTION)
        .where('entityType', '==', entityType)
        .where('status', 'in', [...OPEN_STATUSES])
        .limit(RUN_LIMIT_PER_TYPE)
        .get();
    } catch (err) {
      summary.errors += 1;
      logger.warn(`[taskHygiene] auto-close query for ${entityType} failed`, { error: err.message });
      continue;
    }
    for (const taskSnap of snap.docs) {
      summary.scanned += 1;
      const task = { id: taskSnap.id, ...taskSnap.data() };
      if (!autoCloseAllowed(task)) continue;
      try {
        const state = await resolveEntity(db, task, { cache });
        if (state === 'resolved') {
          await closeTask(db, taskSnap, { status: 'completed', outcome: 'completed', reason: 'entity_resolved', closedBy: 'system:auto-close', nowIso });
          summary.closed += 1;
        } else if (state === 'missing') {
          const created = toMillis(task.createdAt);
          if (created != null && nowMs - created > ORPHAN_MIN_AGE_DAYS * DAY_MS) {
            await closeTask(db, taskSnap, { status: 'cancelled', outcome: 'cancelled', reason: 'entity_missing', closedBy: 'system:auto-close', nowIso });
            summary.orphansCancelled += 1;
          }
        }
      } catch (err) {
        summary.errors += 1;
        logger.warn(`[taskHygiene] auto-close task ${taskSnap.id} failed`, { error: err.message });
      }
    }
  }
  return summary;
}

/** PURE: should this open task escalate now? */
function escalationDecision(task, nowMs) {
  const dueMs = dueMsOf(task);
  if (dueMs == null || dueMs >= nowMs) return null;
  if (task.kind === 'notify' || task.entityType === 'daily_plan_review') return null;
  const priority = normalisePriority(task.priority);
  const escalatedAt = toMillis(task.escalatedAt);
  if (priority === 'P0' && escalatedAt) return null; // already at the top
  const threshold = ESCALATION_AFTER_WORKING_HOURS[priority];
  const since = escalatedAt && escalatedAt > dueMs ? escalatedAt : dueMs;
  const hoursOver = workingHoursBetween(since, nowMs);
  if (hoursOver < threshold) return null;
  return { from: priority, to: escalatedPriority(priority), hoursOver };
}

async function runEscalations(db, openTasks, { nowMs, nowIso, logger }) {
  const summary = { escalated: 0, errors: 0 };
  for (const task of openTasks) {
    const decision = escalationDecision(task, nowMs);
    if (!decision) continue;
    try {
      await db.collection(TASKS_COLLECTION).doc(task.id).update({
        priority: decision.to,
        escalatedAt: nowIso,
        escalationLevel: (Number(task.escalationLevel) || 0) + 1,
        priorityBeforeEscalation: task.priorityBeforeEscalation || decision.from,
        history: [
          ...(Array.isArray(task.history) ? task.history : []),
          historyEntry({ fromStatus: task.status, toStatus: task.status, actorUserId: 'system:escalation', notes: `overdue ${Math.round(decision.hoursOver)} working hours — priority ${decision.from} → ${decision.to}`, nowIso }),
        ],
        updatedAt: nowIso,
      });
      summary.escalated += 1;
    } catch (err) {
      summary.errors += 1;
      logger.warn(`[taskHygiene] escalation of ${task.id} failed`, { error: err.message });
    }
  }
  return summary;
}

async function runReminders(db, openTasks, { nowMs, logger }) {
  const summary = { sent: 0 };
  for (const task of openTasks) {
    if (task.kind === 'notify' || !assigneeOf(task)) continue;
    const dueMs = dueMsOf(task);
    if (dueMs == null || dueMs <= nowMs) continue;
    const hoursLeft = (dueMs - nowMs) / MS_PER_HOUR;
    // The tightest threshold the deadline is inside: 3h out is the 4h reminder, not the 24h one.
    const threshold = [...REMINDER_HOURS].sort((a, b) => a - b).find((h) => hoursLeft <= h);
    if (!threshold) continue;
    try {
      const r = await sendDueSoonReminder(db, task.id, task, threshold);
      if (r.notified) summary.sent += 1;
    } catch (err) {
      logger.warn(`[taskHygiene] reminder for ${task.id} failed`, { error: err.message });
    }
  }
  return summary;
}

async function runTaskHygiene(db, { now = Date.now(), logger = console } = {}) {
  const nowMs = toMillis(now) ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const ctx = { nowMs, nowIso, logger };

  const assignments = await resolvePendingAssignments(db, { nowIso, logger });
  const autoClose = await runAutoClose(db, ctx);
  const openTasks = await fetchOpenTasks(db);
  const escalation = await runEscalations(db, openTasks, ctx);
  const reminders = await runReminders(db, openTasks, ctx);

  const summary = { at: nowIso, assignments, autoClose, escalation, reminders };
  logger.info('[taskHygiene] Done', summary);
  return summary;
}

module.exports = { runTaskHygiene, runAutoClose, runEscalations, runReminders, escalationDecision, ORPHAN_MIN_AGE_DAYS, REMINDER_HOURS };
