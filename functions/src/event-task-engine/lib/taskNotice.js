/**
 * Task notices — the moments a task write should tell a person about:
 *   - a task lands on someone (created with them as assignee, handed to them,
 *     or reopened on them);
 *   - a task is escalated (overdue) — the assignee AND their manager;
 *   - a task is put on hold with a reason — the person who can unblock it.
 *
 * Deliberately NOT a notice: a task you gave yourself, status changes, edits,
 * completion, and anything with no assignee. Notice ids are deterministic per
 * moment, so a retried or repeated write notifies nobody twice.
 *
 * `planTaskNotices` is PURE; the I/O half takes `db` + injectable deps.
 */

const { assigneeOf, toMillis, isTerminalStatus, normalisePriority } = require('./taskModel');
const { notifyUser } = require('./notices');
const { loadDirectory } = require('./peopleDirectory');

/** The in-app link every task notice opens. */
function taskActionUrl(taskId) {
  return `/intelligence/inbox?task=${encodeURIComponent(taskId)}`;
}

const TEAM_PLAN_URL = '/tasks/review';

function openStatus(status) {
  return status !== undefined && !isTerminalStatus(status) && status !== 'pending_assignment';
}

/**
 * PURE. What this write means for notices.
 * @returns {Array<{moment: 'assigned'|'reassigned'|'reopened'|'escalated'|'blocked', dedupeKey: string, assignee: string, actor: string|null}>}
 */
function planTaskNotices(before, after, taskId) {
  if (!after || !taskId) return [];
  const assignee = assigneeOf(after);
  if (!assignee || !openStatus(after.status || 'assigned')) return [];

  const out = [];
  const stamp = toMillis(after.updatedAt) || toMillis(after.createdAt) || 0;
  const actor = after.assignedBy || after.reassignedBy || after.createdBy || null;

  if (!before) {
    out.push({ moment: 'assigned', dedupeKey: `task.assigned:${taskId}`, assignee, actor });
  } else if (assigneeOf(before) !== assignee) {
    out.push({ moment: 'reassigned', dedupeKey: `task.assigned:${taskId}:r${stamp}`, assignee, actor });
  } else if (isTerminalStatus(before.status) && !isTerminalStatus(after.status)) {
    out.push({ moment: 'reopened', dedupeKey: `task.assigned:${taskId}:reopen${stamp}`, assignee, actor: null });
  }

  const escBefore = toMillis(before && before.escalatedAt);
  const escAfter = toMillis(after.escalatedAt);
  if (escAfter && escAfter !== escBefore) {
    out.push({ moment: 'escalated', dedupeKey: `task.escalated:${taskId}:${escAfter}`, assignee, actor: null });
  }

  const nowBlocked = after.status === 'blocked' && typeof after.blockedReason === 'string' && after.blockedReason.trim();
  if (nowBlocked && !(before && before.status === 'blocked')) {
    const at = toMillis(after.blockedAt) || stamp;
    out.push({ moment: 'blocked', dedupeKey: `task.blocked:${taskId}:${at}`, assignee, actor: after.blockedBy || null });
  }
  return out;
}

function noticePriorityFor(task, moment) {
  const p = normalisePriority(task.priority);
  if (moment === 'escalated' || p === 'P0') return 'critical';
  if (task.kind === 'approval' || p === 'P1') return 'high';
  return p === 'P3' ? 'low' : 'medium';
}

function clip(text, n = 400) {
  const s = String(text || '').replace(/\s+\n/g, '\n').trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/**
 * Send the notices `planTaskNotices` calls for. Never throws.
 * @returns {Promise<Array<{moment: string, userId?: string, notified: boolean, reason?: string}>>}
 */
async function notifyTaskChange(db, taskId, before, after, deps = {}) {
  const d = { notify: notifyUser, directory: null, logger: console, ...deps };
  const results = [];
  const plans = planTaskNotices(before, after, taskId);
  if (!plans.length) return results;

  let directory = d.directory;
  const dirFor = async () => {
    if (!directory) directory = await loadDirectory(db, { includeExStaff: true });
    return directory;
  };

  const assignee = plans[0].assignee;
  const title = after.title || 'A task for you';
  const base = {
    message: clip(after.aiDescription || after.description),
    entityType: 'task',
    entityId: taskId,
    actionUrl: taskActionUrl(taskId),
    metadata: { sourceEntityType: after.entityType || null, sourceEntityId: after.entityId || null },
  };

  for (const plan of plans) {
    try {
      if (plan.moment === 'blocked') {
        const dir = await dirFor();
        const person = dir.get(assignee);
        let recipient = person && person.managerUid ? person.managerUid : null;
        let via = 'manager';
        if (!recipient) {
          const { findOwnerUser } = require('./peopleDirectory');
          const owner = await findOwnerUser(db);
          recipient = owner ? owner.uid : null;
          via = 'owner';
        }
        if (!recipient || recipient === assignee) {
          results.push({ moment: 'blocked', notified: false, reason: recipient ? 'recipient is the blocked person' : 'no recipient' });
          continue;
        }
        const who = (person && person.name) || after.assignedToName || 'Someone';
        const notified = await d.notify(db, {
          ...base,
          userId: recipient,
          type: 'task_blocked',
          title: `${who} is blocked: ${after.title || 'a task'}`,
          message: String(after.blockedReason).trim(),
          actionUrl: TEAM_PLAN_URL,
          priority: noticePriorityFor(after, 'blocked'),
          dedupeKey: plan.dedupeKey,
          metadata: { ...base.metadata, via, blockedBy: after.blockedBy || null, assigneeUid: assignee },
        }, deps);
        results.push({ moment: 'blocked', userId: recipient, notified, reason: via });
        continue;
      }

      if (plan.actor && plan.actor === assignee && plan.moment !== 'escalated' && plan.moment !== 'reopened') {
        results.push({ moment: plan.moment, userId: assignee, notified: false, reason: 'you gave it to yourself' });
        continue;
      }

      const noticeTitle = plan.moment === 'escalated'
        ? `Overdue and escalated: ${title}`
        : plan.moment === 'reopened'
          ? `Reopened for you: ${title}`
          : title;
      const notified = await d.notify(db, {
        ...base,
        userId: assignee,
        type: plan.moment === 'escalated' ? 'task_escalated' : 'task_assigned',
        title: noticeTitle,
        priority: noticePriorityFor(after, plan.moment),
        dedupeKey: plan.dedupeKey,
        metadata: { ...base.metadata, moment: plan.moment },
      }, deps);
      results.push({ moment: plan.moment, userId: assignee, notified });

      if (plan.moment === 'escalated') {
        const dir = await dirFor();
        const person = dir.get(assignee);
        const managerUid = person && person.managerUid && person.managerUid !== assignee ? person.managerUid : null;
        if (managerUid) {
          const who = (person && person.name) || after.assignedToName || 'Someone on your team';
          const managerNotified = await d.notify(db, {
            ...base,
            userId: managerUid,
            type: 'task_escalated',
            title: `${who}'s task is overdue and escalated: ${title}`,
            priority: noticePriorityFor(after, 'escalated'),
            dedupeKey: `${plan.dedupeKey}:manager`,
            metadata: { ...base.metadata, moment: 'escalated', forManager: true, assigneeUid: assignee },
          }, deps);
          results.push({ moment: 'escalated', userId: managerUid, notified: managerNotified, reason: 'manager' });
        }
      }
    } catch (err) {
      d.logger.warn('[taskNotice] notice failed', { taskId, moment: plan.moment, error: err.message });
      results.push({ moment: plan.moment, notified: false, reason: err.message });
    }
  }
  return results;
}

/**
 * "Due soon" reminder — once per task per threshold. The notice EXPIRES at the
 * task's due date so a reminder nobody opened is not still there tomorrow.
 */
async function sendDueSoonReminder(db, taskId, task, hours, deps = {}) {
  const d = { notify: notifyUser, ...deps };
  const uid = assigneeOf(task);
  if (!uid) return { notified: false, reason: 'no assignee' };
  const dueMs = toMillis(task.dueAt) ?? toMillis(task.dueDate);
  const notified = await d.notify(db, {
    userId: uid,
    type: 'task_due_soon',
    title: `Due in ${hours} hour${hours === 1 ? '' : 's'}: ${task.title || 'a task'}`,
    message: task.description ? String(task.description).slice(0, 300) : '',
    entityType: 'task',
    entityId: taskId,
    actionUrl: taskActionUrl(taskId),
    priority: hours <= 1 ? 'high' : 'medium',
    dedupeKey: `task.due_soon:${taskId}:${hours}h`,
    ...(dueMs ? { expiresAt: new Date(dueMs).toISOString() } : {}),
    metadata: { hours, dueAt: dueMs ? new Date(dueMs).toISOString() : null },
  }, deps);
  return { notified, userId: uid };
}

module.exports = {
  planTaskNotices,
  notifyTaskChange,
  sendDueSoonReminder,
  taskActionUrl,
  TEAM_PLAN_URL,
};
