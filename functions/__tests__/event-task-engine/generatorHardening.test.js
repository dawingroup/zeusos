/**
 * Phase 6.E hardening of generateTasksForEvent: a replayed event never resets
 * a task someone has touched; every task names its record and its kind;
 * `dueInHours` counts working hours.
 *
 *    cd functions && node --test __tests__/event-task-engine/generatorHardening.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { generateTasksForEvent, subjectFor } = require('../../src/event-task-engine/generateTasksForEvent');

function seedDefinition(db, def) {
  return db.collection('event_definitions').doc(def.id).set(def);
}

const evt = (over = {}) => ({
  id: 'evt_1',
  eventType: 'IWOIssued',
  aggregateType: 'IWO',
  aggregateId: 'iwo-42',
  payload: { tier: 'TIER_1', subsidiaryOrgId: 'zeus-digital', masterJobId: 'mj-1', iwoCode: 'IWO-0042' },
  emittedAt: '2026-10-22T15:07:00Z', // Thursday 18:07 Nairobi
  emittedByUserId: 'uid-am',
  ...over,
});

test('a replayed event leaves a started task alone', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, { id: 'ed', eventType: 'IWOIssued', isActive: true, tasks: [{ id: 'accept_iwo', titleTpl: 'Accept {{aggregateId}}', priority: 'P1', assignTo: { kind: 'payload_field', field: 'emittedByUserId' } }] });
  const first = await generateTasksForEvent({ db, event: evt(), nowIso: '2026-10-22T15:07:01Z' });
  const [id] = first.taskIds;
  const path = `generated_tasks/${id}`;
  db._store.set(path, { ...db._store.get(path), status: 'in_progress', startedAt: '2026-10-23T06:00:00Z' });
  const again = await generateTasksForEvent({ db, event: evt(), nowIso: '2026-10-23T07:00:00Z' });
  assert.deepEqual(again.taskIds, [id], 'same id reported');
  assert.equal(db._dump_prefix('generated_tasks').length, 1);
  assert.equal(db._store.get(path).status, 'in_progress', 'not reset to assigned');
});

test('every task names its record, its kind, its source and the actor', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, { id: 'ed', eventType: 'ApprovalRungAdvanced', isActive: true, tasks: [{ id: 'review_at_next_rung', titleTpl: 'Review {{aggregateId}}', priority: 'P2', assignTo: { kind: 'role', roleProfileId: 'rp-ecd' }, estimateMinutes: 30 }] });
  const r = await generateTasksForEvent({ db, event: evt({ eventType: 'ApprovalRungAdvanced', payload: { toRung: 2, fromRung: 1, masterJobId: 'mj-1' } }), nowIso: '2026-10-22T15:07:01Z' });
  const t = db._store.get(`generated_tasks/${r.taskIds[0]}`);
  assert.equal(t.entityType, 'iwo');
  assert.equal(t.entityId, 'iwo-42');
  assert.equal(t.kind, 'approval');
  assert.equal(t.rung, 2);
  assert.equal(t.source, 'event');
  assert.equal(t.sourceModule, 'iwo');
  assert.equal(t.sourceActorUserId, 'uid-am');
  assert.equal(t.status, 'pending_assignment');
  assert.deepEqual(t.pendingAssignmentRule, { kind: 'role', roleProfileId: 'rp-ecd' });
  assert.equal(t.estimateMinutes, 30);
  assert.equal(t.createdBy, 'system:event-task-engine');
  assert.equal(t.history[0].toStatus, 'pending_assignment');
});

test('dueInHours counts working hours: an 18:07 event with an 8h SLA is due the next working afternoon', async () => {
  const { db } = makeFirestore();
  await seedDefinition(db, { id: 'ed', eventType: 'IWOIssued', isActive: true, tasks: [{ id: 'accept_iwo', titleTpl: 'Accept', priority: 'P1', assignTo: { kind: 'unassigned' }, dueInHours: 8 }] });
  const r = await generateTasksForEvent({ db, event: evt(), nowIso: '2026-10-22T15:07:01Z' });
  const t = db._store.get(`generated_tasks/${r.taskIds[0]}`);
  assert.equal(t.dueAt, '2026-10-23T13:00:00.000Z', 'Friday 16:00 Nairobi, not 02:07');
  assert.equal(t.entityName, 'IWO-0042');
});

test('subjectFor picks the first human name the payload carries', () => {
  assert.equal(subjectFor({ iwoCode: 'IWO-1', title: 'ignored? no — title first' }), 'ignored? no — title first');
  assert.equal(subjectFor({ clientName: 'Safaricom' }), 'Safaricom');
  assert.equal(subjectFor({}), null);
  assert.equal(subjectFor(null), null);
});
