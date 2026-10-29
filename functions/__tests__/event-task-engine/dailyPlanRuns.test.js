/**
 * The daily focus loop end to end, against the in-memory Firestore stub:
 * 17:00 draft → 06:00 publish → wrap-up → 20:00 close → re-draft.
 *
 *    cd functions && node --test __tests__/event-task-engine/dailyPlanRuns.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { runDailyPlanDraft } = require('../../src/event-task-engine/scheduled/dailyPlanDraftRun');
const { runDailyPlanPublish } = require('../../src/event-task-engine/scheduled/dailyPlanPublishRun');
const { runDailyPlanClose } = require('../../src/event-task-engine/scheduled/dailyPlanCloseRun');
const { reviewTaskId, planId } = require('../../src/event-task-engine/lib/dailyPlan');

const quiet = { info() {}, warn() {}, error() {} };

// Monday 2026-10-26. Draft at 17:00 EAT = 14:00Z; publish Tue 06:00 EAT = 03:00Z; close Tue 20:00 EAT = 17:00Z.
const DRAFT_AT = Date.parse('2026-10-26T14:00:00Z');
const PUBLISH_AT = Date.parse('2026-10-27T03:00:00Z');
const CLOSE_AT = Date.parse('2026-10-27T17:00:00Z');

function seed(db) {
  db._seed('users/uid-mgr', { uid: 'uid-mgr', email: 'grace@zeus.co.ke', displayName: 'Grace Wanjiru', globalRole: 'manager', homeOrgId: 'zeus-digital' });
  db._seed('users/uid-amina', { uid: 'uid-amina', email: 'amina@zeus.co.ke', displayName: 'Amina Otieno', globalRole: 'member' });
  db._seed('users/uid-ben', { uid: 'uid-ben', email: 'ben@zeus.co.ke', displayName: 'Ben Kiprop', globalRole: 'member' });
  db._seed('users/uid-owner', { uid: 'uid-owner', email: 'owner@zeus.co.ke', displayName: 'Zeus Owner', globalRole: 'owner' });
  db._seed('employees/emp-mgr', { firstName: 'Grace', lastName: 'Wanjiru', email: 'grace@zeus.co.ke', employmentStatus: 'active', subsidiaryId: 'zeus-digital', position: { title: 'Head of Digital', departmentId: 'digital' } });
  db._seed('employees/emp-amina', { firstName: 'Amina', lastName: 'Otieno', email: 'amina@zeus.co.ke', employmentStatus: 'active', subsidiaryId: 'zeus-digital', position: { title: 'Account Executive', departmentId: 'digital', reportingTo: 'emp-mgr' }, systemAccess: { userId: 'uid-amina' } });
  // Ben works Saturdays too; his login is linked by email only.
  db._seed('employees/emp-ben', { firstName: 'Ben', lastName: 'Kiprop', email: 'ben@zeus.co.ke', employmentStatus: 'active', subsidiaryId: 'zeus-digital', position: { title: 'Designer', departmentId: 'digital', reportingTo: 'emp-mgr' }, workSchedule: { workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] } });

  const t = (id, over) => db._seed(`generated_tasks/${id}`, { id, title: `Task ${id}`, status: 'assigned', priority: 'P2', kind: 'action', history: [], createdAt: '2026-10-20T08:00:00Z', ...over });
  t('a1', { assignedToUserId: 'uid-amina', dueAt: '2026-10-27T09:00:00Z', priority: 'P1', entityType: 'iwo', entityId: 'iwo-1' });
  t('a2', { assignedToUserId: 'emp-amina', dueAt: '2026-10-29T09:00:00Z' }); // legacy employee-id key → same person
  t('a3', { assignedToUserId: 'uid-amina', kind: 'notify' }); // FYI, never planned
  t('b1', { assignedToUserId: 'uid-ben', status: 'in_progress', startedAt: '2026-10-26T08:00:00Z' });
  t('m1', { assignedToUserId: 'uid-mgr', priority: 'P0' });
  t('pool', { status: 'pending_assignment', pendingAssignmentRule: { kind: 'role', roleProfileId: 'rp-ae' } });
}

test('17:00 draft: one plan per person keyed by uid, carry-overs honoured, one review per manager, pinned + belled', async () => {
  const { db } = makeFirestore();
  seed(db);
  // Amina's plan for today (Monday) left `a2` carried; the manager has a plan today to pin onto.
  db._seed(`daily_plans/${planId('2026-10-26', 'uid-amina')}`, { date: '2026-10-26', assigneeUid: 'uid-amina', status: 'published', source: 'system', items: [{ taskId: 'a2', order: 0, title: 'Task a2', priority: 'P2', outcome: 'carried', outcomeNote: 'Half done' }] });
  db._seed(`daily_plans/${planId('2026-10-26', 'uid-mgr')}`, { date: '2026-10-26', assigneeUid: 'uid-mgr', status: 'published', source: 'system', items: [{ taskId: 'm1', order: 0, title: 'Task m1', priority: 'P0' }] });

  const summary = await runDailyPlanDraft(db, { now: DRAFT_AT, logger: quiet });
  assert.equal(summary.written, 3, 'Amina, Ben, Grace');
  assert.equal(summary.reviewsFiled, 1);

  const amina = db._store.get(`daily_plans/${planId('2026-10-27', 'uid-amina')}`);
  assert.ok(amina, 'keyed by uid, dated tomorrow');
  assert.deepEqual(amina.items.map((i) => i.taskId), ['a2', 'a1'], 'carry-over first, then the P1 due tomorrow; notify excluded; both id spaces collapsed');
  assert.equal(amina.items[0].focusReason, 'carry_over');
  assert.equal(amina.items[0].resumeNote, 'Your note: Half done');
  assert.equal(amina.items[1].focusReason, 'due_today');
  assert.equal(amina.managerUid, 'uid-mgr');
  assert.equal(amina.managerName, 'Grace Wanjiru');
  assert.equal(amina.status, 'draft');
  assert.equal(amina.source, 'system');

  const ben = db._store.get(`daily_plans/${planId('2026-10-27', 'uid-ben')}`);
  assert.ok(ben, "Ben's login resolved by email");
  assert.equal(ben.items[0].resumeNote, 'In progress since Mon 11:00.');

  const review = db._store.get(`generated_tasks/${reviewTaskId('uid-mgr', '2026-10-27')}`);
  assert.ok(review, 'one review task for the manager');
  assert.equal(review.assignedToUserId, 'uid-mgr');
  assert.match(review.title, /^Review tomorrow's plan for your team \(2 people\)/);
  assert.equal(review.entityType, 'daily_plan_review');
  assert.equal(review.kind, 'review');
  assert.equal(review.dueAt, '2026-10-26T15:30:00.000Z', '18:30 Nairobi today');

  const mgrToday = db._store.get(`daily_plans/${planId('2026-10-26', 'uid-mgr')}`);
  assert.equal(mgrToday.items[0].entityType, 'daily_plan_review', "pinned first on the manager's own plan for today");
  assert.deepEqual(mgrToday.items.map((i) => i.order), [0, 1]);

  const notices = db._dump_prefix('notifications').map((n) => n.data);
  assert.equal(notices.filter((n) => n.userId === 'uid-mgr' && n.type === 'daily_plan_review').length, 1);
  assert.equal(notices[0].actionUrl, '/tasks/review');

  // Re-running files nothing twice and pins nothing twice.
  const again = await runDailyPlanDraft(db, { now: DRAFT_AT + 60000, logger: quiet });
  assert.equal(again.reviewsFiled, 0);
  assert.equal(again.alreadyRequested, 1);
  assert.equal(db._store.get(`daily_plans/${planId('2026-10-26', 'uid-mgr')}`).items.filter((i) => i.entityType === 'daily_plan_review').length, 1);
  assert.equal(db._dump_prefix('notifications').length, 1);
});

test('a plan the manager shaped is never rewritten; a wrapped-up day is never pinned onto', async () => {
  const { db } = makeFirestore();
  seed(db);
  db._seed(`daily_plans/${planId('2026-10-27', 'uid-amina')}`, { date: '2026-10-27', assigneeUid: 'uid-amina', managerUid: 'uid-mgr', status: 'draft', source: 'manager', reviewed: true, items: [{ taskId: 'a2', order: 0, title: 'Manager pick', priority: 'P2', focusReason: 'manager_pick' }] });
  db._seed(`daily_plans/${planId('2026-10-26', 'uid-mgr')}`, { date: '2026-10-26', assigneeUid: 'uid-mgr', status: 'published', source: 'system', items: [{ taskId: 'm1', order: 0, title: 'Task m1', priority: 'P0' }], wrapUp: { at: '2026-10-26T13:55:00Z', carriedTaskIds: [], closedBy: 'staff' } });

  const summary = await runDailyPlanDraft(db, { now: DRAFT_AT, logger: quiet });
  assert.equal(summary.skippedManagerOwned, 1);
  const amina = db._store.get(`daily_plans/${planId('2026-10-27', 'uid-amina')}`);
  assert.deepEqual(amina.items.map((i) => i.taskId), ['a2']);
  assert.equal(amina.reviewed, true);
  const mgrToday = db._store.get(`daily_plans/${planId('2026-10-26', 'uid-mgr')}`);
  assert.equal(mgrToday.items.length, 1, 'wrapped-up day left alone');
  assert.equal(summary.pinned, 0);
});

test('Friday drafts Monday for office staff and Saturday for a six-day worker', async () => {
  const { db } = makeFirestore();
  seed(db);
  const friday = Date.parse('2026-10-30T14:00:00Z');
  await runDailyPlanDraft(db, { now: friday, logger: quiet });
  assert.ok(db._store.get(`daily_plans/${planId('2026-11-02', 'uid-amina')}`), 'Mon for Amina');
  assert.equal(db._store.get(`daily_plans/${planId('2026-10-31', 'uid-amina')}`), undefined, 'no Saturday plan for office staff');
  assert.ok(db._store.get(`daily_plans/${planId('2026-10-31', 'uid-ben')}`), 'Sat for Ben');
  const review = db._store.get(`generated_tasks/${reviewTaskId('uid-mgr', '2026-11-02')}`);
  assert.match(review.title, /^Review Monday's plan/);
});

test('06:00 publish: drafts publish (reviewed or not), the unplanned are backfilled with carry-overs, everyone is told once', async () => {
  const { db } = makeFirestore();
  seed(db);
  await runDailyPlanDraft(db, { now: DRAFT_AT, logger: quiet });
  // A task created after 17:00 for someone with no plan yet.
  db._seed('generated_tasks/o1', { id: 'o1', title: 'Late task', status: 'assigned', priority: 'P1', assignedToUserId: 'uid-owner', history: [], createdAt: '2026-10-26T16:00:00Z' });
  // The owner's previous plan left `o0` carried.
  db._seed(`daily_plans/${planId('2026-10-23', 'uid-owner')}`, { date: '2026-10-23', assigneeUid: 'uid-owner', status: 'closed', items: [{ taskId: 'o0', order: 0, title: 'Old', priority: 'P2', outcome: 'carried' }], wrapUp: { carriedTaskIds: ['o0'], closedBy: 'staff' } });
  db._seed('generated_tasks/o0', { id: 'o0', title: 'Old', status: 'assigned', priority: 'P2', assignedToUserId: 'uid-owner', history: [], createdAt: '2026-10-20T08:00:00Z' });

  const summary = await runDailyPlanPublish(db, { now: PUBLISH_AT, logger: quiet });
  assert.equal(summary.published, 3);
  assert.equal(summary.backfilled, 1);
  const amina = db._store.get(`daily_plans/${planId('2026-10-27', 'uid-amina')}`);
  assert.equal(amina.status, 'published');
  assert.equal(amina.reviewed, false, 'published anyway, gap visible');
  const owner = db._store.get(`daily_plans/${planId('2026-10-27', 'uid-owner')}`);
  assert.equal(owner.status, 'published');
  assert.deepEqual(owner.items.map((i) => i.taskId), ['o0', 'o1'], 'backfill honours the carry-over');
  const notices = db._dump_prefix('notifications').map((n) => n.data).filter((n) => n.type === 'daily_plan');
  assert.equal(notices.length, 4);
  assert.match(notices.find((n) => n.userId === 'uid-amina').message, /not yet reviewed/);
  assert.equal(notices[0].actionUrl, '/tasks/today');
  await runDailyPlanPublish(db, { now: PUBLISH_AT + 60000, logger: quiet });
  assert.equal(db._dump_prefix('notifications').filter((n) => n.data.type === 'daily_plan').length, 4, 'idempotent');
});

test('06:00 publish closes a system draft for a non-working day instead of publishing it', async () => {
  const { db } = makeFirestore();
  seed(db);
  db._seed(`daily_plans/${planId('2026-10-31', 'uid-amina')}`, { date: '2026-10-31', assigneeUid: 'uid-amina', status: 'draft', source: 'system', items: [{ taskId: 'a1', order: 0, title: 'x', priority: 'P2' }] });
  db._seed(`daily_plans/${planId('2026-10-31', 'uid-ben')}`, { date: '2026-10-31', assigneeUid: 'uid-ben', status: 'draft', source: 'system', items: [{ taskId: 'b1', order: 0, title: 'x', priority: 'P2' }] });
  const saturday = Date.parse('2026-10-31T03:00:00Z');
  const summary = await runDailyPlanPublish(db, { now: saturday, logger: quiet });
  assert.equal(summary.nonWorkingDayClosed, 1);
  assert.equal(db._store.get(`daily_plans/${planId('2026-10-31', 'uid-amina')}`).nonWorkingDay, true);
  assert.equal(db._store.get(`daily_plans/${planId('2026-10-31', 'uid-ben')}`).status, 'published');
});

test('20:00 close: blanks resolve from the live task, a wrap-up stands, tomorrow is re-drafted from the carry-overs', async () => {
  const { db } = makeFirestore();
  seed(db);
  await runDailyPlanDraft(db, { now: DRAFT_AT, logger: quiet });
  await runDailyPlanPublish(db, { now: PUBLISH_AT, logger: quiet });
  // During the day: a1 completed on its record, a2 untouched, Ben blocked b1 himself.
  db._store.set('generated_tasks/a1', { ...db._store.get('generated_tasks/a1'), status: 'completed' });
  db._store.set('generated_tasks/b1', { ...db._store.get('generated_tasks/b1'), status: 'blocked', blockedReason: 'Waiting on copy' });
  // Tomorrow's (Wednesday) draft already exists as an untouched system draft — the 17:00 run ran before Amina wrapped up.
  await runDailyPlanDraft(db, { now: Date.parse('2026-10-27T14:00:00Z'), logger: quiet });
  const wedBefore = db._store.get(`daily_plans/${planId('2026-10-28', 'uid-amina')}`);
  assert.deepEqual(wedBefore.items.map((i) => i.taskId), ['a2'], 'a1 is done; only a2 remains, not yet marked carried');
  assert.equal(wedBefore.items[0].focusReason, 'carry_over', 'untouched items on an open day count as carried');

  const summary = await runDailyPlanClose(db, { now: CLOSE_AT, logger: quiet });
  assert.equal(summary.closed, 3);
  const amina = db._store.get(`daily_plans/${planId('2026-10-27', 'uid-amina')}`);
  assert.equal(amina.status, 'closed');
  const byId = Object.fromEntries(amina.items.map((i) => [i.taskId, i.outcome]));
  assert.deepEqual(byId, { a2: 'carried', a1: 'done' });
  assert.deepEqual(amina.wrapUp.carriedTaskIds, ['a2']);
  assert.equal(amina.wrapUp.closedBy, 'system:daily-plan-close');
  const ben = db._store.get(`daily_plans/${planId('2026-10-27', 'uid-ben')}`);
  assert.equal(ben.items[0].outcome, 'blocked');
  assert.deepEqual(ben.wrapUp.carriedTaskIds, ['b1']);
  assert.equal(summary.redrafted, 3, 'untouched system drafts for tomorrow refreshed');
  const wedAfter = db._store.get(`daily_plans/${planId('2026-10-28', 'uid-ben')}`);
  assert.equal(wedAfter.items[0].resumeNote, 'Marked blocked: Waiting on copy');
});

test('20:00 close: an unwrapped plan on a non-working day closes empty and carries nothing', async () => {
  const { db } = makeFirestore();
  seed(db);
  db._seed(`daily_plans/${planId('2026-10-31', 'uid-amina')}`, { date: '2026-10-31', assigneeUid: 'uid-amina', status: 'published', source: 'system', items: [{ taskId: 'a2', order: 0, title: 'x', priority: 'P2' }] });
  const summary = await runDailyPlanClose(db, { now: Date.parse('2026-10-31T17:00:00Z'), logger: quiet });
  assert.equal(summary.nonWorkingDayClosed, 1);
  const plan = db._store.get(`daily_plans/${planId('2026-10-31', 'uid-amina')}`);
  assert.equal(plan.nonWorkingDay, true);
  assert.deepEqual(plan.wrapUp.carriedTaskIds, []);
});
