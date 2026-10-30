/**
 * Daily plan writes — `dailyPlanAction`, the one writer of `daily_plans`.
 *
 * Two very different writers share the collection and the callable keeps
 * them visibly apart: a MANAGER shapes the plan (items, order, timebox, day
 * goal, reviewed) and the ASSIGNEE reports on it (acknowledge, per-item
 * outcome, wrap-up) and may not add or drop a commitment.
 *
 *   Assignee: acknowledge · setItemOutcome · clearItemOutcome · wrapUp
 *   Manager : createEmptyPlan · saveItems · saveNotes · markReviewed
 *
 * "Done" on a plan item closes the task FIRST, then writes the outcome, so a
 * finished item is never re-planned tomorrow (DawinOS audit 2026-10-11: 463
 * of 602 items carried because Done wrote the plan and left the task open).
 * A task Done cannot close — required checklist steps still open, or an
 * approval decided on its record — keeps the item open and the response says
 * why. "Blocked" puts the task on hold with the reason, which is what tells
 * the manager (triggers/onTaskWritten.js).
 */

const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

const { TASKS_COLLECTION, OPEN_STATUSES, isOpenStatus, isTerminalStatus, assigneeOf, historyEntry, normaliseStatus, ASSIGNED_STATUS } = require('../lib/taskModel');
const { PLANS_COLLECTION, planId, planItemFromTask, reviewTaskId, resolveOutcome } = require('../lib/dailyPlan');
const { loadDirectory, resolvePersonUid } = require('../lib/peopleDirectory');
const { requireSignedIn, isPrivileged } = require('../lib/callerAuth');

const REGION = 'europe-west1';
const ASSIGNEE_ACTIONS = new Set(['acknowledge', 'setItemOutcome', 'clearItemOutcome', 'wrapUp']);
const MANAGER_ACTIONS = new Set(['createEmptyPlan', 'saveItems', 'saveNotes', 'markReviewed']);
const OUTCOMES = new Set(['done', 'carried', 'blocked', 'dropped']);
const ITEM_KEYS = new Set(['taskId', 'order', 'title', 'priority', 'dueAt', 'kind', 'sourceModule', 'entityType', 'entityId', 'entityName', 'masterJobId', 'iwoId', 'brandId', 'timeboxMinutes', 'focusReason', 'entityRef', 'whyToday', 'resumeNote', 'outcome', 'outcomeNote', 'outcomeAt']);

function str(v, max = 2000) {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}
function isDateKey(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Required checklist steps still open on a task. */
function unmetRequired(task) {
  const items = [...(Array.isArray(task.checklistItems) ? task.checklistItems : []), ...(Array.isArray(task.aiChecklist) ? task.aiChecklist : [])];
  return items.filter((i) => i && i.isRequired === true && !i.completed);
}

/**
 * Close a task because its plan item was marked done. Returns null when
 * closed (or nothing to close), else the reason it was left open.
 */
async function closeTaskForDoneItem(db, taskId, uid, nowIso) {
  const ref = db.collection(TASKS_COLLECTION).doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const task = snap.data();
  if (!isOpenStatus(task.status)) return null;
  if (task.kind === 'approval' && task.entityType && task.entityId) return 'decided on its record — approve or reject it there';
  const unmet = unmetRequired(task);
  if (unmet.length) return `${unmet.length} required ${unmet.length === 1 ? 'check is' : 'checks are'} still open`;
  await ref.update({
    status: 'completed',
    outcome: 'completed',
    outcomeBy: uid,
    outcomeAt: nowIso,
    completedAt: nowIso,
    closedBy: uid,
    history: [...(Array.isArray(task.history) ? task.history : []), historyEntry({ fromStatus: task.status, toStatus: 'completed', actorUserId: uid, notes: 'marked done on the day plan', nowIso })],
    updatedAt: nowIso,
  });
  return null;
}

/** Put the task behind a blocked item on hold, with the reason. */
async function blockTaskForItem(db, taskId, reason, uid, nowIso) {
  const ref = db.collection(TASKS_COLLECTION).doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const task = snap.data();
  if (!isOpenStatus(task.status) || task.status === 'blocked') return false;
  await ref.update({
    status: 'blocked',
    blockedAt: nowIso,
    blockedReason: reason || 'Blocked',
    blockedBy: uid,
    history: [...(Array.isArray(task.history) ? task.history : []), historyEntry({ fromStatus: task.status, toStatus: 'blocked', actorUserId: uid, notes: reason || 'Blocked', nowIso })],
    updatedAt: nowIso,
  });
  return true;
}

async function unblockTaskForItem(db, taskId, uid, nowIso) {
  const ref = db.collection(TASKS_COLLECTION).doc(taskId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const task = snap.data();
  if (task.status !== 'blocked') return false;
  const status = task.startedAt ? 'in_progress' : ASSIGNED_STATUS;
  await ref.update({
    status,
    unblockedAt: nowIso,
    lastBlockedReason: task.blockedReason || null,
    blockedReason: null,
    history: [...(Array.isArray(task.history) ? task.history : []), historyEntry({ fromStatus: 'blocked', toStatus: status, actorUserId: uid, notes: 'reopened on the day plan', nowIso })],
    updatedAt: nowIso,
  });
  return true;
}

/**
 * Close the manager's review task once every plan it asked for is reviewed
 * — decided on the record.
 */
async function closePlanReviewTaskIfDone(db, date, managerUid, reviewerUid, nowIso) {
  if (!managerUid) return false;
  const plans = await db.collection(PLANS_COLLECTION).where('date', '==', date).where('managerUid', '==', managerUid).get();
  if (plans.empty) return false;
  const allReviewed = plans.docs.every((d) => {
    const p = d.data();
    return p.reviewed === true || p.status === 'closed';
  });
  if (!allReviewed) return false;
  const ref = db.collection(TASKS_COLLECTION).doc(reviewTaskId(managerUid, date));
  const snap = await ref.get();
  if (!snap.exists || !OPEN_STATUSES.includes(snap.data().status)) return false;
  const task = snap.data();
  await ref.update({
    status: 'completed',
    outcome: 'completed',
    outcomeBy: reviewerUid,
    outcomeAt: nowIso,
    completedAt: nowIso,
    closedBy: 'manager-review',
    history: [...(Array.isArray(task.history) ? task.history : []), historyEntry({ fromStatus: task.status, toStatus: 'completed', actorUserId: reviewerUid, notes: 'every plan reviewed', nowIso })],
    updatedAt: nowIso,
  });
  return true;
}

/** Whitelist + normalise one item the manager sent; denormalise from the live task when thin. */
async function normaliseItem(db, raw, index) {
  if (!raw || typeof raw !== 'object' || !str(raw.taskId, 400)) throw new HttpsError('invalid-argument', `items[${index}] needs a taskId.`);
  const item = {};
  for (const k of ITEM_KEYS) if (raw[k] !== undefined && raw[k] !== null) item[k] = raw[k];
  item.taskId = str(raw.taskId, 400);
  item.order = index;
  if (item.timeboxMinutes !== undefined) {
    const n = Number(item.timeboxMinutes);
    if (!Number.isFinite(n) || n <= 0) delete item.timeboxMinutes;
    else item.timeboxMinutes = Math.round(n);
  }
  if (!item.title) {
    const snap = await db.collection(TASKS_COLLECTION).doc(item.taskId).get();
    if (!snap.exists) throw new HttpsError('not-found', `Task ${item.taskId} not found.`);
    const fromTask = planItemFromTask({ id: snap.id, ...snap.data() }, index, item.focusReason || 'manager_pick');
    return { ...fromTask, ...item, focusReason: item.focusReason || 'manager_pick' };
  }
  item.focusReason = item.focusReason || 'manager_pick';
  return item;
}

async function handleDailyPlanAction(db, auth, data, deps = {}) {
  const input = data || {};
  const action = str(input.action, 40);
  if (!action || (!ASSIGNEE_ACTIONS.has(action) && !MANAGER_ACTIONS.has(action))) {
    throw new HttpsError('invalid-argument', `action must be one of ${[...ASSIGNEE_ACTIONS, ...MANAGER_ACTIONS].join(', ')}.`);
  }
  const date = str(input.date, 10);
  if (!isDateKey(date)) throw new HttpsError('invalid-argument', 'date must be YYYY-MM-DD.');
  const nowIso = deps.nowIso || new Date().toISOString();
  const uid = auth.uid;
  const privileged = await isPrivileged(auth, deps);

  // Whose plan.
  let assigneeUid = uid;
  if (input.assigneeUid && input.assigneeUid !== uid) {
    const person = await resolvePersonUid(db, str(input.assigneeUid, 200));
    if (!person || !person.uid) throw new HttpsError('invalid-argument', 'assigneeUid must name a person with a ZeusOS login.');
    assigneeUid = person.uid;
  }
  const ref = db.collection(PLANS_COLLECTION).doc(planId(date, assigneeUid));
  const snap = await ref.get();
  const plan = snap.exists ? { id: snap.id, ...snap.data() } : null;

  const directoryFor = async () => deps.directory || (await loadDirectory(db, { includeExStaff: true }));
  const isManagerOf = async () => {
    if (plan && plan.managerUid === uid) return true;
    const directory = await directoryFor();
    const rec = directory.get(assigneeUid);
    return Boolean(rec && rec.managerUid === uid);
  };

  // ── Assignee actions ───────────────────────────────────────────────────
  if (ASSIGNEE_ACTIONS.has(action)) {
    if (!plan) throw new HttpsError('not-found', 'No plan for that day.');
    if (plan.assigneeUid !== uid && !privileged) throw new HttpsError('permission-denied', 'Only the person the plan is for can report on it.');
    if (plan.status === 'closed' && action !== 'clearItemOutcome') throw new HttpsError('failed-precondition', 'That day is closed.');
    const items = Array.isArray(plan.items) ? plan.items : [];

    if (action === 'acknowledge') {
      await ref.update({ acknowledgedAt: plan.acknowledgedAt || nowIso, updatedAt: nowIso });
      return { ok: true, acknowledgedAt: plan.acknowledgedAt || nowIso };
    }

    if (action === 'setItemOutcome') {
      const taskId = str(input.taskId, 400);
      const outcome = input.outcome;
      if (!taskId || !items.some((i) => i.taskId === taskId)) throw new HttpsError('not-found', 'That item is not on the plan.');
      if (!OUTCOMES.has(outcome)) throw new HttpsError('invalid-argument', 'outcome must be done, carried, blocked or dropped.');
      const note = str(input.note, 500);
      let taskLeftOpen = null;
      if (outcome === 'done') taskLeftOpen = await closeTaskForDoneItem(db, taskId, uid, nowIso);
      if (outcome === 'done' && taskLeftOpen) {
        return { ok: false, taskLeftOpen, taskId };
      }
      if (outcome === 'blocked') await blockTaskForItem(db, taskId, note, uid, nowIso);
      const next = items.map((i) => (i.taskId === taskId ? { ...i, outcome, ...(note ? { outcomeNote: note } : {}), outcomeAt: nowIso } : i));
      await ref.update({ items: next, updatedAt: nowIso });
      return { ok: true, taskId, outcome };
    }

    if (action === 'clearItemOutcome') {
      const taskId = str(input.taskId, 400);
      const prev = items.find((i) => i.taskId === taskId);
      if (!prev) throw new HttpsError('not-found', 'That item is not on the plan.');
      if (prev.outcome === 'blocked') await unblockTaskForItem(db, taskId, uid, nowIso);
      const next = items.map((i) => {
        if (i.taskId !== taskId) return i;
        const { outcome, outcomeNote, outcomeAt, outcomeInferred, ...rest } = i; // eslint-disable-line no-unused-vars
        return rest;
      });
      await ref.update({ items: next, updatedAt: nowIso });
      return { ok: true, taskId };
    }

    if (action === 'wrapUp') {
      const outcomes = input.outcomes && typeof input.outcomes === 'object' ? input.outcomes : {};
      const notClosed = [];
      const next = [];
      for (const item of items) {
        const given = outcomes[item.taskId];
        let outcome = given && OUTCOMES.has(given.outcome) ? given.outcome : item.outcome;
        const note = given && str(given.note, 500);
        if (!outcome) {
          // Untouched → resolved from the live task, same as the 20:00 close.
          const live = await db.collection(TASKS_COLLECTION).doc(item.taskId).get();
          outcome = resolveOutcome(undefined, live.exists ? live.data().status : 'missing');
        }
        if (outcome === 'done') {
          const left = await closeTaskForDoneItem(db, item.taskId, uid, nowIso);
          if (left) {
            notClosed.push({ taskId: item.taskId, title: item.title, reason: left });
            outcome = 'carried';
          }
        }
        if (outcome === 'blocked') await blockTaskForItem(db, item.taskId, note || item.outcomeNote, uid, nowIso);
        next.push({ ...item, outcome, ...(note ? { outcomeNote: note } : {}), outcomeAt: item.outcome === outcome && item.outcomeAt ? item.outcomeAt : nowIso });
      }
      const carriedTaskIds = next.filter((i) => i.outcome === 'carried' || i.outcome === 'blocked').map((i) => i.taskId);
      await ref.update({
        items: next,
        wrapUp: {
          at: nowIso,
          summary: str(input.summary, 2000) || '',
          blockers: str(input.blockers, 2000) || '',
          carriedTaskIds,
          closedBy: 'staff',
        },
        updatedAt: nowIso,
      });
      return { ok: true, carriedTaskIds, notClosed };
    }
  }

  // ── Manager actions ────────────────────────────────────────────────────
  if (!privileged && !(await isManagerOf())) {
    throw new HttpsError('permission-denied', 'Only the person\'s manager or Account Management can shape their plan.');
  }

  if (action === 'createEmptyPlan') {
    if (plan) return { created: false, plan };
    const directory = await directoryFor();
    const person = directory.get(assigneeUid) || null;
    const fields = {
      date,
      assigneeUid,
      assigneeEmployeeId: (person && person.employeeId) || null,
      assigneeName: (person && person.name) || str(input.assigneeName, 200) || null,
      subsidiaryId: (person && person.subsidiaryId) || null,
      managerUid: (person && person.managerUid) || uid,
      managerEmployeeId: (person && person.managerEmployeeId) || null,
      managerName: (person && person.managerName) || (directory.get(uid) && directory.get(uid).name) || null,
      status: 'draft',
      reviewed: false,
      source: 'manager',
      items: [],
      createdBy: uid,
      generatedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const created = await db.runTransaction(async (tx) => {
      const again = await tx.get(ref);
      if (again.exists) return false;
      tx.set(ref, fields);
      return true;
    });
    const fresh = await ref.get();
    return { created, plan: { id: fresh.id, ...fresh.data() } };
  }

  if (!plan) throw new HttpsError('not-found', 'No plan for that day — start one first.');
  if (plan.status === 'closed') throw new HttpsError('failed-precondition', 'That day is closed.');

  if (action === 'saveItems') {
    if (!Array.isArray(input.items)) throw new HttpsError('invalid-argument', 'items must be an array.');
    const seen = new Set();
    const items = [];
    for (let i = 0; i < input.items.length; i++) {
      const item = await normaliseItem(db, input.items[i], items.length);
      if (seen.has(item.taskId)) continue;
      seen.add(item.taskId);
      items.push(item);
    }
    await ref.update({ items, source: 'manager', updatedAt: nowIso });
    return { ok: true, count: items.length };
  }

  if (action === 'saveNotes' || action === 'markReviewed') {
    const patch = { source: 'manager', updatedAt: nowIso };
    if (input.dayGoal !== undefined) patch.dayGoal = str(input.dayGoal, 300) || '';
    if (input.managerNote !== undefined) patch.managerNote = str(input.managerNote, 2000) || '';
    if (action === 'markReviewed') {
      const directory = await directoryFor();
      const me = directory.get(uid);
      patch.reviewed = true;
      patch.reviewedBy = uid;
      patch.reviewedByName = (me && me.name) || (auth.token && (auth.token.name || auth.token.email)) || null;
      patch.reviewedAt = nowIso;
    }
    await ref.update(patch);
    let reviewTaskClosed = false;
    if (action === 'markReviewed') {
      try {
        reviewTaskClosed = await closePlanReviewTaskIfDone(db, date, plan.managerUid || uid, uid, nowIso);
      } catch (err) {
        logger.warn('[dailyPlanAction] could not close the review task', { error: err.message });
      }
    }
    return { ok: true, reviewTaskClosed };
  }

  throw new HttpsError('invalid-argument', `Unknown action ${action}.`);
}

const dailyPlanAction = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async (request) => {
  const auth = requireSignedIn(request, 'act on a day plan');
  if (!admin.apps.length) admin.initializeApp();
  try {
    return await handleDailyPlanAction(admin.firestore(), auth, request.data);
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    logger.error('[dailyPlanAction] failed', err);
    throw new HttpsError('internal', (err && err.message) || 'dailyPlanAction failed');
  }
});

module.exports = {
  dailyPlanAction,
  handleDailyPlanAction,
  closePlanReviewTaskIfDone,
  closeTaskForDoneItem,
  ASSIGNEE_ACTIONS,
  MANAGER_ACTIONS,
};
