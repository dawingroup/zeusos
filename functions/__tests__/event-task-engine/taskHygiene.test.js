/**
 * The hygiene run against the stub: owners for pending work, auto-close on
 * resolved records, overdue escalation, due-soon reminders, the stale sweep.
 *
 *    cd functions && node --test __tests__/event-task-engine/taskHygiene.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { runTaskHygiene } = require('../../src/event-task-engine/scheduled/taskHygieneRun');
const { runStaleTaskSweep } = require('../../src/event-task-engine/scheduled/staleTaskSweep');
const { resolvePendingAssignments } = require('../../src/event-task-engine/lib/assigneeResolution');
const { closeResolvedTasksForEntity } = require('../../src/event-task-engine/lib/taskAutoClose');
const { isSystemClosed } = require('../../src/event-task-engine/lib/taskReopenPolicy');

const quiet = { info() {}, warn() {}, error() {} };
const NOW = Date.parse('2026-10-26T10:00:00Z'); // Monday 13:00 Nairobi
const DAY = 24 * 60 * 60 * 1000;

function seedPeople(db) {
  db._seed('users/uid-owner', { uid: 'uid-owner', email: 'owner@zeus.co.ke', displayName: 'Zeus Owner', globalRole: 'owner' });
  db._seed('users/uid-mgr', { uid: 'uid-mgr', email: 'grace@zeus.co.ke', displayName: 'Grace', globalRole: 'manager' });
  db._seed('users/uid-amina', { uid: 'uid-amina', email: 'amina@zeus.co.ke', displayName: 'Amina' });
  db._seed('users/uid-ben', { uid: 'uid-ben', email: 'ben@zeus.co.ke', displayName: 'Ben' });
  db._seed('employees/emp-mgr', { firstName: 'Grace', lastName: 'W', email: 'grace@zeus.co.ke', employmentStatus: 'active', subsidiaryId: 'zeus-digital', position: { departmentId: 'digital' } });
  db._seed('employees/emp-amina', { firstName: 'Amina', lastName: 'O', email: 'amina@zeus.co.ke', employmentStatus: 'active', subsidiaryId: 'zeus-digital', position: { departmentId: 'digital', reportingTo: 'emp-mgr' } });
  db._seed('employees/emp-ben', { firstName: 'Ben', lastName: 'K', email: 'ben@zeus.co.ke', employmentStatus: 'active', subsidiaryId: 'labyrinth', position: { departmentId: 'creative', reportingTo: 'emp-mgr' } });
  db._seed('role_assignment/emp-amina__rp-ae__2026-01-01', { employeeId: 'emp-amina', roleProfileId: 'rp-ae', status: 'active' });
  db._seed('role_assignment/emp-ben__rp-ae__2026-01-01', { employeeId: 'emp-ben', roleProfileId: 'rp-ae', status: 'active' });
}

const task = (db, id, over) => db._seed(`generated_tasks/${id}`, { id, title: `Task ${id}`, status: 'assigned', priority: 'P2', kind: 'action', history: [], createdAt: '2026-10-20T08:00:00Z', ...over });

// ── Owners for pending work ────────────────────────────────────────────────

test('pending work finds an owner: role (brand-matched, least loaded), manager of actor, owner fallback', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  task(db, 'busy1', { assignedToUserId: 'uid-amina' });
  task(db, 'busy2', { assignedToUserId: 'uid-amina' });
  task(db, 'r1', { status: 'pending_assignment', pendingAssignmentRule: { kind: 'role', roleProfileId: 'rp-ae' } });
  task(db, 'r2', { status: 'pending_assignment', pendingAssignmentRule: { kind: 'role', roleProfileId: 'rp-ae' }, brandId: 'zeus-digital' });
  task(db, 'm1', { status: 'pending_assignment', pendingAssignmentRule: { kind: 'manager_of_actor' }, sourceActorUserId: 'uid-amina' });
  task(db, 'd1', { status: 'pending_assignment', pendingAssignmentRule: { kind: 'department', departmentId: 'creative' } });
  task(db, 'x1', { status: 'pending_assignment', pendingAssignmentRule: { kind: 'role', roleProfileId: 'rp-nobody' }, priority: 'P0', escalatedAt: '2026-10-25T10:00:00Z', kind: 'approval' });
  task(db, 'y1', { status: 'pending_assignment', pendingAssignmentRule: { kind: 'dynamic', criteria: {} } });

  const summary = await resolvePendingAssignments(db, { nowIso: new Date(NOW).toISOString(), logger: quiet });
  assert.equal(summary.assigned, 6);
  assert.equal(summary.left, 0);
  const get = (id) => db._store.get(`generated_tasks/${id}`);
  assert.equal(get('r1').assignedToUserId, 'uid-ben', 'least loaded holder of the role');
  assert.equal(get('r1').status, 'assigned');
  assert.equal(get('r1').assignmentMethod, 'role');
  assert.equal(get('r2').assignedToUserId, 'uid-amina', 'brand match beats load');
  assert.equal(get('m1').assignedToUserId, 'uid-mgr');
  assert.equal(get('d1').assignedToUserId, 'uid-ben');
  assert.equal(get('x1').assignedToUserId, 'uid-owner', 'nobody holds the role → the owner');
  assert.equal(get('x1').assignmentMethod, 'owner_fallback');
  assert.equal(get('x1').priority, 'P1', 'escalation while unowned undone, approval floor kept');
  assert.equal(get('y1').assignedToUserId, 'uid-owner');
  assert.equal(get('r1').history.at(-1).toStatus, 'assigned');
});

// ── Auto-close ─────────────────────────────────────────────────────────────

test('a task closes when its record is dealt with — the acceptance task on accept, the rung review on the chain moving', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  db._seed('internal_work_orders/iwo-1', { state: 'ACCEPTED', approvalChain: { currentRung: 1 } });
  db._seed('internal_work_orders/iwo-2', { state: 'ISSUED' });
  task(db, 'accept-1', { assignedToUserId: 'uid-ben', entityType: 'iwo', entityId: 'iwo-1', sourceRuleId: 'accept_iwo' });
  task(db, 'accept-2', { assignedToUserId: 'uid-ben', entityType: 'iwo', entityId: 'iwo-2', sourceRuleId: 'accept_iwo' });
  task(db, 'rung-1', { assignedToUserId: 'uid-mgr', entityType: 'iwo', entityId: 'iwo-1', sourceRuleId: 'review_at_next_rung', rung: 1, kind: 'approval' });
  task(db, 'rung-0', { assignedToUserId: 'uid-mgr', entityType: 'iwo', entityId: 'iwo-1', sourceRuleId: 'review_at_next_rung', rung: 0, kind: 'approval' });
  task(db, 'orphan', { assignedToUserId: 'uid-ben', entityType: 'master_job', entityId: 'gone', createdAt: '2026-10-01T08:00:00Z' });
  task(db, 'young-orphan', { assignedToUserId: 'uid-ben', entityType: 'master_job', entityId: 'gone-too', createdAt: new Date(NOW - DAY).toISOString() });
  task(db, 'own', { assignedToUserId: 'uid-ben', entityType: 'iwo', entityId: 'iwo-1', source: 'personal' });

  const summary = await runTaskHygiene(db, { now: NOW, logger: quiet });
  const get = (id) => db._store.get(`generated_tasks/${id}`);
  assert.equal(get('accept-1').status, 'completed');
  assert.equal(get('accept-1').closedBy, 'system:auto-close');
  assert.equal(isSystemClosed(get('accept-1')), true);
  assert.equal(get('accept-2').status, 'assigned', 'still ISSUED');
  assert.equal(get('rung-1').status, 'assigned', "chain is at rung 1 — still this reviewer's");
  assert.equal(get('rung-0').status, 'completed', 'chain moved past rung 0');
  assert.equal(get('orphan').status, 'cancelled');
  assert.equal(get('orphan').autoClosedReason, 'entity_missing');
  assert.equal(get('young-orphan').status, 'assigned', 'inside the creation grace window');
  assert.equal(get('own').status, 'assigned', "a person's own task is never auto-closed");
  assert.equal(summary.autoClose.closed, 2);
  assert.equal(summary.autoClose.orphansCancelled, 1);
  assert.ok(db._dump_prefix('agent_audit_entries').length >= 3, 'one audit row per close');
});

test("the domain-event trigger path closes the record's open tasks at once", async () => {
  const { db } = makeFirestore();
  db._seed('client_invoices/inv-1', { status: 'PAID' });
  task(db, 'chase', { assignedToUserId: 'uid-amina', entityType: 'client_invoice', entityId: 'inv-1' });
  task(db, 'fyi', { assignedToUserId: 'uid-amina', entityType: 'client_invoice', entityId: 'inv-1', kind: 'notify' });
  const closed = await closeResolvedTasksForEntity(db, { entityType: 'client_invoice', entityId: 'inv-1' });
  assert.equal(closed, 1);
  assert.equal(db._store.get('generated_tasks/chase').status, 'completed');
  assert.equal(db._store.get('generated_tasks/fyi').status, 'assigned', 'a notice is read, not done');
});

// ── Escalation + reminders ─────────────────────────────────────────────────

test('overdue work escalates one notch per working-hours threshold, with a notice-worthy stamp; due-soon reminders land once', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  const fri16 = '2026-10-23T13:00:00.000Z'; // Friday 16:00 Nairobi
  task(db, 'late', { assignedToUserId: 'uid-amina', priority: 'P2', dueAt: fri16 }); // 6 working hours overdue at NOW < P2's 9
  task(db, 'later', { assignedToUserId: 'uid-amina', priority: 'P1', dueAt: fri16 }); // ≥ P1's 4 → escalates
  task(db, 'soon', { assignedToUserId: 'uid-ben', dueAt: new Date(NOW + 3 * 60 * 60 * 1000).toISOString() });
  task(db, 'soon-fyi', { assignedToUserId: 'uid-ben', kind: 'notify', dueAt: new Date(NOW + 3 * 60 * 60 * 1000).toISOString() });

  const first = await runTaskHygiene(db, { now: NOW, logger: quiet });
  const get = (id) => db._store.get(`generated_tasks/${id}`);
  assert.equal(first.escalation.escalated, 1);
  assert.equal(get('later').priority, 'P0');
  assert.equal(get('later').escalationLevel, 1);
  assert.equal(get('later').priorityBeforeEscalation, 'P1');
  assert.ok(get('later').escalatedAt);
  assert.equal(get('late').priority, 'P2', 'P2 waits 9 working hours');
  assert.equal(first.reminders.sent, 1, 'the 4h reminder for `soon`; notices are not reminded');
  const reminders = db._dump_prefix('notifications').map((n) => n.data).filter((n) => n.type === 'task_due_soon');
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].userId, 'uid-ben');
  assert.match(reminders[0].title, /^Due in 4 hours/);

  // Half an hour later: nothing repeats.
  const second = await runTaskHygiene(db, { now: NOW + 30 * 60 * 1000, logger: quiet });
  assert.equal(second.escalation.escalated, 0, 'at P0 and escalated — stays there');
  assert.equal(second.reminders.sent, 0);
  // Tuesday 13:00: `late` has now 1 + 9 + 5 = 15 working hours → escalates.
  const third = await runTaskHygiene(db, { now: NOW + DAY, logger: quiet });
  assert.equal(get('late').priority, 'P1');
  assert.equal(third.escalation.escalated, 1);
});

// ── Stale sweep ────────────────────────────────────────────────────────────

test('the stale sweep cancels noise and leaves work, and can dry-run', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  db._seed('internal_work_orders/iwo-done', { state: 'CLOSED' });
  db._seed('internal_work_orders/iwo-live', { state: 'IN_PROGRESS' });
  const old = new Date(NOW - 20 * DAY).toISOString();
  task(db, 'noise', { assignedToUserId: 'uid-amina', priority: 'P3', dueAt: old, entityType: 'iwo', entityId: 'iwo-done' });
  task(db, 'work', { assignedToUserId: 'uid-amina', priority: 'P3', dueAt: old, entityType: 'iwo', entityId: 'iwo-live' });
  task(db, 'legacy-pending', { assignedToUserId: 'uid-amina', status: 'pending', priority: 'P3', dueAt: old });
  task(db, 'old-fyi', { assignedToUserId: 'uid-amina', kind: 'notify', createdAt: new Date(NOW - 40 * DAY).toISOString() });
  task(db, 'started', { assignedToUserId: 'uid-amina', status: 'in_progress', priority: 'P3', dueAt: old });

  const dry = await runStaleTaskSweep(db, { now: NOW, enabled: false, logger: quiet });
  assert.equal(dry.wouldCancel, 3);
  assert.equal(dry.cancelled, 0);
  assert.equal(db._store.get('generated_tasks/noise').status, 'assigned');

  const live = await runStaleTaskSweep(db, { now: NOW, logger: quiet });
  assert.equal(live.cancelled, 3);
  assert.deepEqual(live.byReason, { expired: 2, notify_expired: 1 });
  const get = (id) => db._store.get(`generated_tasks/${id}`);
  assert.equal(get('noise').status, 'cancelled');
  assert.equal(get('noise').closedBy, 'system:stale-sweep');
  assert.equal(get('legacy-pending').status, 'cancelled');
  assert.equal(get('old-fyi').status, 'cancelled');
  assert.equal(get('work').status, 'assigned', 'the record is still open');
  assert.equal(get('started').status, 'in_progress', 'a human engaged');
});
