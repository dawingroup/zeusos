/**
 * generateTasksForEvent — Phase 6.E integration tests.
 *   cd functions && node --test __tests__/event-task-engine/generator.test.js
 *
 * Covers:
 *   - no matching definitions → no tasks
 *   - matching definition with passing conditions → task created
 *   - failed conditions → no task
 *   - multiple rules on one definition → all matching fire
 *   - re-processing same event → idempotent (no duplicate tasks)
 *   - inactive definition → no task
 *   - payload_field assignTo → assignedToUserId populated
 *   - unassigned assignTo → assignedToUserId null, status pending_assignment
 *   - role/dynamic assignTo → pendingAssignmentRule recorded
 *   - dueInDays computes dueAt
 *   - tags interpolated onto task
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const {
  generateTasksForEvent,
  resolveAssignment,
  taskIdFor,
} = require('../../src/event-task-engine/generateTasksForEvent');

function seedDefinition(db, def) {
  return db.collection('event_definitions').doc(def.id).set(def);
}

function fakeEvent(over = {}) {
  return {
    id: 'evt_abc',
    eventType: 'IWOIssued',
    aggregateType: 'IWO',
    aggregateId: 'iwo-42',
    payload: { tier: 'TIER_1', subsidiaryOrgId: 'zeus-the-agency', masterJobId: 'mj-1' },
    emittedAt: '2026-05-24T10:00:00Z',
    emittedByUserId: 'user-am-1',
    ...over,
  };
}

// ----- happy paths ----------------------------------------------------

test('no matching definitions → no tasks', async () => {
  const { db } = makeFirestore();
  const r = await generateTasksForEvent({ db, event: fakeEvent() });
  assert.deepEqual(r.taskIds, []);
  assert.equal(r.matchedDefinitions, 0);
});

test('matching definition without conditions → task created', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, {
    id: 'ed_iwo_accept',
    eventType: 'IWOIssued',
    description: 'Accept IWO',
    tasks: [{
      id: 'accept',
      titleTpl: 'Accept IWO {{aggregateId}}',
      priority: 'P1',
      assignTo: { kind: 'unassigned' },
    }],
    isActive: true,
  });

  const r = await generateTasksForEvent({ db, event: fakeEvent() });
  assert.equal(r.taskIds.length, 1);
  assert.equal(r.matchedDefinitions, 1);

  const tasks = db._dump_prefix('generated_tasks');
  assert.equal(tasks.length, 1);
  const t = tasks[0].data;
  assert.equal(t.title, 'Accept IWO iwo-42');
  assert.equal(t.priority, 'P1');
  assert.equal(t.status, 'pending_assignment');
  assert.equal(t.assignedToUserId, null);
  assert.equal(t.sourceEventId, 'evt_abc');
  assert.equal(t.sourceEventType, 'IWOIssued');
  assert.equal(t.sourceDefinitionId, 'ed_iwo_accept');
  assert.equal(t.sourceRuleId, 'accept');
  assert.equal(t.history.length, 1);
  assert.equal(t.history[0].toStatus, 'pending_assignment');
});

test('failed conditions → no task', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, {
    id: 'ed_tier1_only',
    eventType: 'IWOIssued',
    description: 'Only fire for TIER_2',
    tasks: [{
      id: 'r1',
      titleTpl: 'X',
      priority: 'P2',
      conditions: [{ op: 'eq', path: 'payload.tier', value: 'TIER_2' }],
      assignTo: { kind: 'unassigned' },
    }],
    isActive: true,
  });

  const r = await generateTasksForEvent({ db, event: fakeEvent({ payload: { tier: 'TIER_1' } }) });
  assert.equal(r.taskIds.length, 0);
  assert.equal(r.matchedDefinitions, 1);     // definition matched eventType…
  assert.equal(db._dump_prefix('generated_tasks').length, 0); // …but rule's conditions failed
});

test('multiple rules → each evaluated independently', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, {
    id: 'ed_multi',
    eventType: 'IWOIssued',
    description: 'two rules',
    tasks: [
      { id: 'r1', titleTpl: 'Always fires', priority: 'P2', assignTo: { kind: 'unassigned' } },
      { id: 'r2', titleTpl: 'TIER_3 only', priority: 'P3',
        conditions: [{ op: 'eq', path: 'payload.tier', value: 'TIER_3' }],
        assignTo: { kind: 'unassigned' } },
    ],
    isActive: true,
  });
  const r = await generateTasksForEvent({ db, event: fakeEvent() });
  assert.equal(r.taskIds.length, 1);  // r1 fires; r2's condition fails
  const titles = db._dump_prefix('generated_tasks').map((t) => t.data.title);
  assert.deepEqual(titles, ['Always fires']);
});

test('idempotent: re-processing same event does not duplicate', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, {
    id: 'ed_iwo',
    eventType: 'IWOIssued',
    description: 'X',
    tasks: [{ id: 'r1', titleTpl: 'X', priority: 'P1', assignTo: { kind: 'unassigned' } }],
    isActive: true,
  });

  await generateTasksForEvent({ db, event: fakeEvent() });
  await generateTasksForEvent({ db, event: fakeEvent() });   // retry / replay

  const tasks = db._dump_prefix('generated_tasks');
  assert.equal(tasks.length, 1);
});

test('inactive definition → no task', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, {
    id: 'ed_off',
    eventType: 'IWOIssued',
    description: 'X',
    tasks: [{ id: 'r1', titleTpl: 'X', priority: 'P1', assignTo: { kind: 'unassigned' } }],
    isActive: false,
  });
  const r = await generateTasksForEvent({ db, event: fakeEvent() });
  assert.equal(r.taskIds.length, 0);
});

// ----- assignment resolution ------------------------------------------

test('resolveAssignment: unassigned → null userId', () => {
  assert.deepEqual(
    resolveAssignment({ kind: 'unassigned' }, fakeEvent()),
    { userId: null },
  );
});

test('resolveAssignment: payload_field copies userId from event', () => {
  const r = resolveAssignment(
    { kind: 'payload_field', field: 'payload.assigneeId' },
    fakeEvent({ payload: { assigneeId: 'u-bob' } }),
  );
  assert.equal(r.userId, 'u-bob');
});

test('resolveAssignment: role/dynamic record pendingRule', () => {
  const r1 = resolveAssignment({ kind: 'role', roleProfileId: 'rp1' }, fakeEvent());
  assert.equal(r1.userId, null);
  assert.deepEqual(r1.pendingRule, { kind: 'role', roleProfileId: 'rp1' });

  const r2 = resolveAssignment(
    { kind: 'dynamic', criteria: { skill: 'design' } },
    fakeEvent(),
  );
  assert.equal(r2.userId, null);
  assert.deepEqual(r2.pendingRule.kind, 'dynamic');
});

test('integration: payload_field resolves to assigned status', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, {
    id: 'ed_direct',
    eventType: 'IWOIssued',
    description: 'X',
    tasks: [{
      id: 'r1', titleTpl: 'X', priority: 'P1',
      assignTo: { kind: 'payload_field', field: 'emittedByUserId' },
    }],
    isActive: true,
  });
  await generateTasksForEvent({ db, event: fakeEvent() });
  const t = db._dump_prefix('generated_tasks')[0].data;
  assert.equal(t.assignedToUserId, 'user-am-1');
  assert.equal(t.status, 'assigned');
});

// ----- dueAt + tags ---------------------------------------------------

test('dueInDays computes dueAt from event emittedAt', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, {
    id: 'ed_due',
    eventType: 'IWOIssued',
    description: 'X',
    tasks: [{
      id: 'r1', titleTpl: 'X', priority: 'P1', dueInDays: 3,
      assignTo: { kind: 'unassigned' },
    }],
    isActive: true,
  });
  await generateTasksForEvent({ db, event: fakeEvent({ emittedAt: '2026-05-24T10:00:00Z' }) });
  const t = db._dump_prefix('generated_tasks')[0].data;
  // 3 days after 2026-05-24 10:00 UTC = 2026-05-27 10:00 UTC
  assert.equal(t.dueAt, '2026-05-27T10:00:00.000Z');
});

test('tagsTpl interpolated onto task', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, {
    id: 'ed_tags',
    eventType: 'IWOIssued',
    description: 'X',
    tasks: [{
      id: 'r1', titleTpl: 'X', priority: 'P1',
      assignTo: { kind: 'unassigned' },
      tagsTpl: {
        iwoId: '{{aggregateId}}',
        brandId: '{{payload.subsidiaryOrgId}}',
        masterJobId: '{{payload.masterJobId}}',
      },
    }],
    isActive: true,
  });
  await generateTasksForEvent({ db, event: fakeEvent() });
  const t = db._dump_prefix('generated_tasks')[0].data;
  assert.equal(t.iwoId, 'iwo-42');
  assert.equal(t.brandId, 'zeus-the-agency');
  assert.equal(t.masterJobId, 'mj-1');
});

// ----- taskIdFor ------------------------------------------------------

test('taskIdFor is deterministic + sanitised', () => {
  const id = taskIdFor('ed_x', 'r1', 'evt_abc');
  assert.equal(id, 'task_ed_x__r1__evt_abc');
  // Same inputs → same id (idempotency anchor)
  assert.equal(taskIdFor('ed_x', 'r1', 'evt_abc'), id);
  // Unsafe characters get sanitised
  assert.equal(taskIdFor('ed/x', 'r:1', 'evt#abc'), 'task_ed_x__r_1__evt_abc');
});
