/**
 * The callables a person acts through: `taskAction`, `createTask` and
 * `dailyPlanAction` (Phase 6.E). Who may act, which transitions are legal,
 * what the history records, and the Done / Blocked rules on a plan item.
 *
 * Needs firebase-functions on the require path (HttpsError):
 *    cd functions && node --test __tests__/event-task-engine/taskActions.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { handleTaskAction, handleCreateTask } = require('../../src/event-task-engine/callables/taskActions');
const { handleDailyPlanAction } = require('../../src/event-task-engine/callables/dailyPlanActions');
const { planId, reviewTaskId } = require('../../src/event-task-engine/lib/dailyPlan');

const NOW = '2026-10-27T08:30:00.000Z';

function seedPeople(db) {
  db._seed('users/uid-admin', { uid: 'uid-admin', email: 'admin@zeus.co.ke', displayName: 'Admin', globalRole: 'admin' });
  db._seed('users/uid-mgr', { uid: 'uid-mgr', email: 'grace@zeus.co.ke', displayName: 'Grace', globalRole: 'manager' });
  db._seed('users/uid-amina', { uid: 'uid-amina', email: 'amina@zeus.co.ke', displayName: 'Amina' });
  db._seed('users/uid-ben', { uid: 'uid-ben', email: 'ben@zeus.co.ke', displayName: 'Ben' });
  db._seed('employees/emp-mgr', { firstName: 'Grace', lastName: 'W', email: 'grace@zeus.co.ke', employmentStatus: 'active', position: {} });
  db._seed('employees/emp-amina', { firstName: 'Amina', lastName: 'O', email: 'amina@zeus.co.ke', employmentStatus: 'active', position: { reportingTo: 'emp-mgr' }, systemAccess: { userId: 'uid-amina' } });
  db._seed('employees/emp-ben', { firstName: 'Ben', lastName: 'K', email: 'ben@zeus.co.ke', employmentStatus: 'active', position: { reportingTo: 'emp-mgr' } });
}

/** Auth + the deps that keep the callables off real Firebase. */
function as(db, uid) {
  const auth = { uid, token: { email: `${uid}@zeus.co.ke` } };
  const deps = {
    nowIso: NOW,
    loadUserDoc: async (id) => db._store.get(`users/${id}`) || null,
    isParentOrgUser: async () => false,
  };
  return { auth, deps };
}

const task = (db, id, over) => db._seed(`generated_tasks/${id}`, { id, title: `Task ${id}`, status: 'assigned', priority: 'P2', kind: 'action', history: [], createdBy: 'system:event-task-engine', createdAt: '2026-10-20T08:00:00Z', ...over });

async function rejects(promise, code, re) {
  await assert.rejects(promise, (err) => {
    assert.equal(err.code, code, `${err.code}: ${err.message}`);
    if (re) assert.match(err.message, re);
    return true;
  });
}

// ── taskAction ─────────────────────────────────────────────────────────────

test('the assignee walks a task start → block (with a reason) → unblock → complete, and history records every step', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  task(db, 't1', { assignedToUserId: 'uid-amina' });
  const { auth, deps } = as(db, 'uid-amina');
  const get = () => db._store.get('generated_tasks/t1');

  await handleTaskAction(db, auth, { taskId: 't1', action: 'start' }, deps);
  assert.equal(get().status, 'in_progress');
  assert.equal(get().startedAt, NOW);

  await rejects(handleTaskAction(db, auth, { taskId: 't1', action: 'block' }, deps), 'invalid-argument', /what is blocking/);
  await handleTaskAction(db, auth, { taskId: 't1', action: 'block', reason: 'Waiting on client assets' }, deps);
  assert.equal(get().status, 'blocked');
  assert.equal(get().blockedReason, 'Waiting on client assets');
  assert.equal(get().blockedBy, 'uid-amina');
  await rejects(handleTaskAction(db, auth, { taskId: 't1', action: 'start' }, deps), 'failed-precondition');

  await handleTaskAction(db, auth, { taskId: 't1', action: 'unblock' }, deps);
  assert.equal(get().status, 'in_progress', 'back to where it was');
  assert.equal(get().blockedReason, null);

  const r = await handleTaskAction(db, auth, { taskId: 't1', action: 'complete', note: 'Sent to client' }, deps);
  assert.equal(r.status, 'completed');
  assert.equal(get().outcome, 'completed');
  assert.equal(get().outcomeBy, 'uid-amina');
  assert.equal(get().closedBy, 'uid-amina');
  assert.deepEqual(get().history.map((h) => h.toStatus), ['in_progress', 'blocked', 'in_progress', 'completed']);
  await rejects(handleTaskAction(db, auth, { taskId: 't1', action: 'complete' }, deps), 'failed-precondition', /already completed/);
});

test('a stranger may not act; the manager and an admin may; pool work can be claimed by anyone', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  task(db, 't1', { assignedToUserId: 'uid-amina' });
  task(db, 'pool', { status: 'pending_assignment', assignedToUserId: null });
  await rejects(handleTaskAction(db, as(db, 'uid-ben').auth, { taskId: 't1', action: 'start' }, as(db, 'uid-ben').deps), 'permission-denied');
  const mgr = as(db, 'uid-mgr');
  await handleTaskAction(db, mgr.auth, { taskId: 't1', action: 'start' }, mgr.deps);
  assert.equal(db._store.get('generated_tasks/t1').status, 'in_progress');
  const admin = as(db, 'uid-admin');
  await handleTaskAction(db, admin.auth, { taskId: 't1', action: 'cancel', reason: 'Scope dropped' }, admin.deps);
  assert.equal(db._store.get('generated_tasks/t1').status, 'cancelled');
  assert.equal(db._store.get('generated_tasks/t1').cancelReason, 'Scope dropped');
  const ben = as(db, 'uid-ben');
  await handleTaskAction(db, ben.auth, { taskId: 'pool', action: 'claim' }, ben.deps);
  const pool = db._store.get('generated_tasks/pool');
  assert.equal(pool.status, 'assigned');
  assert.equal(pool.assignedToUserId, 'uid-ben');
  await rejects(handleTaskAction(db, as(db, 'uid-amina').auth, { taskId: 'pool', action: 'claim' }, as(db, 'uid-amina').deps), 'failed-precondition', /already has an owner/);
  await rejects(handleTaskAction(db, ben.auth, { taskId: 'missing', action: 'start' }, ben.deps), 'not-found');
  await rejects(handleTaskAction(db, ben.auth, { taskId: 'pool', action: 'dance' }, ben.deps), 'invalid-argument');
});

test('assign resolves an employee id to a login, records the hand-off; the assignee may hand their own task on', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  task(db, 't1', { assignedToUserId: 'uid-amina' });
  const amina = as(db, 'uid-amina');
  await handleTaskAction(db, amina.auth, { taskId: 't1', action: 'assign', assigneeId: 'emp-ben', note: 'Ben owns the deck' }, amina.deps);
  const t = db._store.get('generated_tasks/t1');
  assert.equal(t.assignedToUserId, 'uid-ben', 'employee doc id → uid via email');
  assert.equal(t.assignedToName, 'Ben K');
  assert.equal(t.previousAssigneeUserId, 'uid-amina');
  assert.equal(t.reassignedBy, 'uid-amina');
  await rejects(handleTaskAction(db, amina.auth, { taskId: 't1', action: 'start' }, amina.deps), 'permission-denied'); // no longer hers
  await rejects(handleTaskAction(db, as(db, 'uid-ben').auth, { taskId: 't1', action: 'assign', assigneeId: 'nobody@nowhere' }, as(db, 'uid-ben').deps), 'invalid-argument');
});

test('reopen clears the close and names who brought it back; Mark done follows the required checklist', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  task(db, 'done', { assignedToUserId: 'uid-amina', status: 'completed', outcome: 'completed', outcomeBy: 'system', closedBy: 'system:auto-close', completedAt: '2026-10-26T10:00:00Z' });
  task(db, 'checks', { assignedToUserId: 'uid-amina', checklistItems: [{ id: 'c1', title: 'Get sign-off', isRequired: true, completed: false }, { id: 'c2', title: 'Optional', isRequired: false, completed: false }] });
  const amina = as(db, 'uid-amina');
  await rejects(handleTaskAction(db, amina.auth, { taskId: 'done', action: 'start' }, amina.deps), 'failed-precondition');
  await handleTaskAction(db, amina.auth, { taskId: 'done', action: 'reopen', note: 'Client came back' }, amina.deps);
  const t = db._store.get('generated_tasks/done');
  assert.equal(t.status, 'assigned');
  assert.equal(t.outcome, null);
  assert.equal(t.reopenedBy, 'uid-amina');
  assert.equal(t.reopenReason, 'Client came back');
  assert.equal(t.previousClose.closedBy, 'system:auto-close');

  await rejects(handleTaskAction(db, amina.auth, { taskId: 'checks', action: 'complete' }, amina.deps), 'failed-precondition', /Get sign-off/);
  await handleTaskAction(db, amina.auth, { taskId: 'checks', action: 'checklist', itemId: 'c1', completed: true }, amina.deps);
  assert.equal(db._store.get('generated_tasks/checks').checklistProgress, 50);
  await handleTaskAction(db, amina.auth, { taskId: 'checks', action: 'complete' }, amina.deps);
  assert.equal(db._store.get('generated_tasks/checks').status, 'completed');
});

// ── createTask ─────────────────────────────────────────────────────────────

test('anyone adds their own task; a manager drafts for a report; a stranger may not draft for others', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  const amina = as(db, 'uid-amina');
  const own = await handleCreateTask(db, amina.auth, { title: 'Call the client', dueDate: '2026-10-28', priority: 'high' }, amina.deps);
  const t = db._store.get(`generated_tasks/${own.id}`);
  assert.equal(t.assignedToUserId, 'uid-amina');
  assert.equal(t.source, 'personal');
  assert.equal(t.priority, 'P1');
  assert.equal(t.dueAt, '2026-10-28T14:00:00.000Z', 'end of that working day');
  assert.equal(t.status, 'assigned');

  const mgr = as(db, 'uid-mgr');
  const drafted = await handleCreateTask(db, mgr.auth, { title: 'Prepare the deck', assigneeId: 'emp-ben', estimateMinutes: 90 }, mgr.deps);
  const d = db._store.get(`generated_tasks/${drafted.id}`);
  assert.equal(d.assignedToUserId, 'uid-ben');
  assert.equal(d.source, 'manual');
  assert.equal(d.createdBy, 'uid-mgr');
  assert.equal(d.estimateMinutes, 90);

  await rejects(handleCreateTask(db, amina.auth, { title: 'x', assigneeId: 'emp-ben' }, amina.deps), 'permission-denied');
  await rejects(handleCreateTask(db, amina.auth, { title: '   ' }, amina.deps), 'invalid-argument');
});

// ── dailyPlanAction ────────────────────────────────────────────────────────

function seedPlan(db) {
  task(db, 'a1', { assignedToUserId: 'uid-amina' });
  task(db, 'a2', { assignedToUserId: 'uid-amina', kind: 'approval', entityType: 'iwo', entityId: 'iwo-1' });
  task(db, 'a3', { assignedToUserId: 'uid-amina', status: 'completed' });
  db._seed(`daily_plans/${planId('2026-10-27', 'uid-amina')}`, {
    date: '2026-10-27', assigneeUid: 'uid-amina', managerUid: 'uid-mgr', status: 'published', source: 'system', reviewed: false,
    items: [
      { taskId: 'a1', order: 0, title: 'Task a1', priority: 'P2' },
      { taskId: 'a2', order: 1, title: 'Task a2', priority: 'P2', kind: 'approval' },
      { taskId: 'a3', order: 2, title: 'Task a3', priority: 'P2' },
    ],
  });
}

test('the assignee acknowledges, marks Done (closing the task first), Blocked (holding the task with the reason), and wraps up', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  seedPlan(db);
  const amina = as(db, 'uid-amina');
  const plan = () => db._store.get(`daily_plans/${planId('2026-10-27', 'uid-amina')}`);

  await handleDailyPlanAction(db, amina.auth, { action: 'acknowledge', date: '2026-10-27' }, amina.deps);
  assert.equal(plan().acknowledgedAt, NOW);

  const done = await handleDailyPlanAction(db, amina.auth, { action: 'setItemOutcome', date: '2026-10-27', taskId: 'a1', outcome: 'done' }, amina.deps);
  assert.equal(done.ok, true);
  assert.equal(db._store.get('generated_tasks/a1').status, 'completed', 'the task closed FIRST');
  assert.equal(plan().items[0].outcome, 'done');

  const refused = await handleDailyPlanAction(db, amina.auth, { action: 'setItemOutcome', date: '2026-10-27', taskId: 'a2', outcome: 'done' }, amina.deps);
  assert.equal(refused.ok, false);
  assert.match(refused.taskLeftOpen, /decided on its record/);
  assert.equal(plan().items[1].outcome, undefined, 'never a silent Done');

  await handleDailyPlanAction(db, amina.auth, { action: 'setItemOutcome', date: '2026-10-27', taskId: 'a2', outcome: 'blocked', note: 'ECD on leave' }, amina.deps);
  assert.equal(db._store.get('generated_tasks/a2').status, 'blocked');
  assert.equal(db._store.get('generated_tasks/a2').blockedReason, 'ECD on leave');
  assert.equal(plan().items[1].outcomeNote, 'ECD on leave');

  await handleDailyPlanAction(db, amina.auth, { action: 'clearItemOutcome', date: '2026-10-27', taskId: 'a2' }, amina.deps);
  assert.equal(db._store.get('generated_tasks/a2').status, 'assigned', 'reopening the item lifts the hold');
  assert.equal(plan().items[1].outcome, undefined);

  const wrap = await handleDailyPlanAction(db, amina.auth, {
    action: 'wrapUp', date: '2026-10-27', summary: 'Deck out, approval waiting', blockers: '',
    outcomes: { a2: { outcome: 'done' } },
  }, amina.deps);
  assert.deepEqual(wrap.notClosed.map((n) => n.taskId), ['a2'], 'Done it could not close is reported');
  assert.deepEqual(wrap.carriedTaskIds, ['a2'], 'and the item is carried, not lost');
  assert.equal(plan().wrapUp.at, NOW);
  assert.equal(plan().wrapUp.closedBy, 'staff');
  assert.equal(plan().wrapUp.summary, 'Deck out, approval waiting');
  assert.equal(plan().items[2].outcome, 'done', 'a closed task reads done without being asked');

  await rejects(handleDailyPlanAction(db, as(db, 'uid-ben').auth, { action: 'acknowledge', date: '2026-10-27', assigneeUid: 'uid-amina' }, as(db, 'uid-ben').deps), 'permission-denied');
  await rejects(handleDailyPlanAction(db, amina.auth, { action: 'acknowledge', date: 'tomorrow' }, amina.deps), 'invalid-argument');
});

test('the manager shapes the plan — items denormalised from the live task — and marking the last one reviewed closes the review task', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  seedPlan(db);
  task(db, 'extra', { assignedToUserId: 'uid-amina', priority: 'P1', dueAt: '2026-10-27T10:00:00Z', iwoId: 'iwo-9' });
  task(db, reviewTaskId('uid-mgr', '2026-10-27'), { assignedToUserId: 'uid-mgr', entityType: 'daily_plan_review', entityId: '2026-10-27', kind: 'review' });
  const mgr = as(db, 'uid-mgr');
  const plan = () => db._store.get(`daily_plans/${planId('2026-10-27', 'uid-amina')}`);

  await rejects(handleDailyPlanAction(db, as(db, 'uid-ben').auth, { action: 'saveNotes', date: '2026-10-27', assigneeUid: 'uid-amina', dayGoal: 'x' }, as(db, 'uid-ben').deps), 'permission-denied');

  await handleDailyPlanAction(db, mgr.auth, {
    action: 'saveItems', date: '2026-10-27', assigneeUid: 'emp-amina',
    items: [{ taskId: 'extra' }, { taskId: 'a1', title: 'Task a1', priority: 'P2', timeboxMinutes: 45 }, { taskId: 'a1' }],
  }, mgr.deps);
  const items = plan().items;
  assert.deepEqual(items.map((i) => i.taskId), ['extra', 'a1'], 'reordered, trimmed, deduped; employee id resolved to the plan key');
  assert.equal(items[0].title, 'Task extra', 'denormalised from the live task');
  assert.equal(items[0].iwoId, 'iwo-9');
  assert.equal(items[0].focusReason, 'manager_pick');
  assert.equal(items[1].timeboxMinutes, 45);
  assert.equal(plan().source, 'manager');

  const r = await handleDailyPlanAction(db, mgr.auth, { action: 'markReviewed', date: '2026-10-27', assigneeUid: 'uid-amina', dayGoal: 'Land the deck', managerNote: 'Call me if the ECD is slow' }, mgr.deps);
  assert.equal(plan().reviewed, true);
  assert.equal(plan().reviewedBy, 'uid-mgr');
  assert.equal(plan().reviewedByName, 'Grace W');
  assert.equal(plan().dayGoal, 'Land the deck');
  assert.equal(r.reviewTaskClosed, true, 'every plan for this manager is reviewed');
  const review = db._store.get(`generated_tasks/${reviewTaskId('uid-mgr', '2026-10-27')}`);
  assert.equal(review.status, 'completed');
  assert.equal(review.closedBy, 'manager-review');
  assert.equal(review.outcomeBy, 'uid-mgr');
});

test('a manager starts an empty plan for someone the draft skipped, once', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  const mgr = as(db, 'uid-mgr');
  const first = await handleDailyPlanAction(db, mgr.auth, { action: 'createEmptyPlan', date: '2026-10-28', assigneeUid: 'emp-ben' }, mgr.deps);
  assert.equal(first.created, true);
  assert.equal(first.plan.assigneeUid, 'uid-ben');
  assert.equal(first.plan.managerUid, 'uid-mgr');
  assert.equal(first.plan.source, 'manager');
  const second = await handleDailyPlanAction(db, mgr.auth, { action: 'createEmptyPlan', date: '2026-10-28', assigneeUid: 'uid-ben' }, mgr.deps);
  assert.equal(second.created, false, 'never clobbered');
  await rejects(handleDailyPlanAction(db, as(db, 'uid-amina').auth, { action: 'createEmptyPlan', date: '2026-10-28', assigneeUid: 'uid-ben' }, as(db, 'uid-amina').deps), 'permission-denied');
});
