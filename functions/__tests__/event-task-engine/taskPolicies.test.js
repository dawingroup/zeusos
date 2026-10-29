/**
 * Task hardening policies (Phase 6.E): working time, the re-open rule, the
 * escalation ladder, kind derivation, stale classification and the notices
 * a write calls for. All PURE except the injected record read.
 *
 *    cd functions && node --test __tests__/event-task-engine/taskPolicies.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { addWorkingHours, isWorkingTime, workingHoursBetween, endOfWorkingDayIso } = require('../../src/event-task-engine/lib/workingTime');
const { HUMAN_CLOSE_COOLDOWN_DAYS, isSystemClosed, decideReopen, reopenFields } = require('../../src/event-task-engine/lib/taskReopenPolicy');
const { escalatedPriority, deescalatedPriority, priorityMax } = require('../../src/event-task-engine/lib/taskPriority');
const { deriveKind, resolveKind } = require('../../src/event-task-engine/lib/taskKind');
const { classifyStaleTask, STALE_AFTER_DAYS, NOTIFY_MAX_AGE_DAYS } = require('../../src/event-task-engine/lib/staleTaskPolicy');
const { planTaskNotices } = require('../../src/event-task-engine/lib/taskNotice');
const { autoCloseAllowed, entityTypeForAggregate } = require('../../src/event-task-engine/lib/entityResolution');
const { escalationDecision } = require('../../src/event-task-engine/scheduled/taskHygieneRun');
const { systemCloseFields } = require('../../src/event-task-engine/lib/taskModel');

const DAY = 24 * 60 * 60 * 1000;
// Nairobi is UTC+3. eat('2026-10-23T16:00') = Friday 16:00 EAT.
const eat = (local) => Date.parse(`${local}:00+03:00`);

// ── Working time ───────────────────────────────────────────────────────────

test('isWorkingTime: 08:00–17:00 Nairobi, Monday to Friday', () => {
  assert.equal(isWorkingTime(eat('2026-10-23T08:00')), true); // Fri
  assert.equal(isWorkingTime(eat('2026-10-23T16:59')), true);
  assert.equal(isWorkingTime(eat('2026-10-23T17:00')), false);
  assert.equal(isWorkingTime(eat('2026-10-24T10:00')), false); // Sat
  assert.equal(isWorkingTime(eat('2026-10-25T10:00')), false); // Sun
});

test('workingHoursBetween counts only working time, and inverts addWorkingHours', () => {
  assert.equal(workingHoursBetween(eat('2026-10-23T16:00'), eat('2026-10-26T09:00')), 2, 'Fri 16:00 → Mon 09:00');
  assert.equal(workingHoursBetween(eat('2026-10-22T18:30'), eat('2026-10-23T07:00')), 0);
  assert.equal(workingHoursBetween(eat('2026-10-22T09:00'), eat('2026-10-22T13:30')), 4.5);
  assert.equal(workingHoursBetween(eat('2026-10-23T12:00'), eat('2026-10-23T11:00')), 0);
  for (const start of [eat('2026-10-22T09:15'), eat('2026-10-23T16:30'), eat('2026-10-24T11:00')]) {
    for (const h of [1, 4, 12, 48]) {
      const due = addWorkingHours(start, h);
      assert.ok(Math.abs(workingHoursBetween(start, due) - h) < 1e-9, `${new Date(start).toISOString()} +${h}h`);
    }
  }
  // An 8-hour SLA on a task issued at 18:07 is due the NEXT working day, not at 02:07.
  const due = addWorkingHours(eat('2026-10-22T18:07'), 8);
  assert.equal(new Date(due).toISOString(), new Date(eat('2026-10-23T16:00')).toISOString());
  assert.equal(endOfWorkingDayIso('2026-10-27'), '2026-10-27T14:00:00.000Z');
});

// ── Re-open policy ─────────────────────────────────────────────────────────

const CLOSED_AT = Date.parse('2026-10-15T16:46:13Z');
const humanClosed = (over = {}) => ({ status: 'completed', outcome: 'completed', outcomeBy: 'uid-amina', outcomeAt: new Date(CLOSED_AT).toISOString(), completedAt: new Date(CLOSED_AT).toISOString(), assignedToUserId: 'uid-amina', ...over });
const systemClosed = (over = {}) => ({ ...humanClosed(), outcomeBy: 'system', closedBy: 'system:auto-close', ...over });

test("a person's close stands for the cooldown; a system close re-opens at once", () => {
  assert.equal(isSystemClosed(humanClosed()), false);
  assert.equal(isSystemClosed(systemClosed()), true);
  assert.equal(isSystemClosed(humanClosed({ closedBy: 'system:stale-sweep' })), false, 'the person acted last');
  assert.equal(isSystemClosed({ status: 'completed' }), false, 'nobody named → a person');
  const morningAfter = decideReopen(humanClosed(), { now: CLOSED_AT + 14 * 60 * 60 * 1000 });
  assert.deepEqual([morningAfter.reopen, morningAfter.reason], [false, 'human_close_cooldown']);
  const lastDay = CLOSED_AT + HUMAN_CLOSE_COOLDOWN_DAYS * DAY - 1;
  assert.equal(decideReopen(humanClosed(), { now: lastDay }).reopen, false);
  assert.equal(decideReopen(humanClosed(), { now: lastDay + 1 }).reason, 'human_close_cooldown_elapsed');
  assert.equal(decideReopen(systemClosed(), { now: CLOSED_AT + 60000 }).reason, 'system_closed');
  for (const status of ['assigned', 'in_progress', 'blocked']) {
    assert.equal(decideReopen(humanClosed({ status }), { now: CLOSED_AT + 99 * DAY }).reopen, false, status);
  }
  assert.equal(decideReopen({ status: 'completed', outcomeBy: 'uid-9' }, { now: CLOSED_AT + 99 * DAY }).reopen, false, 'no close time → never');
});

test('a re-open leaves no close stamp behind, says who and why, keeps the audit', () => {
  const body = reopenFields(systemClosed({ history: [{ toStatus: 'completed' }] }), { by: 'uid-mgr', reason: 'still open', nowIso: 'NOW' });
  assert.equal(body.status, 'assigned');
  for (const f of ['outcome', 'outcomeBy', 'outcomeAt', 'completedAt', 'closedBy', 'autoClosedAt', 'autoClosedReason']) assert.equal(body[f], null, f);
  assert.equal(body.reopenedBy, 'uid-mgr');
  assert.equal(body.reopenCount, 1);
  assert.equal(body.previousClose.closedBy, 'system:auto-close');
  assert.equal(body.history.length, 2);
  assert.equal(reopenFields(systemClosed({ assignedToUserId: null }), { by: 'x', reason: 'y', nowIso: 'N' }).status, 'pending_assignment');
});

test('systemCloseFields is the one shape every sweep writes', () => {
  const f = systemCloseFields({ status: 'assigned', history: [] }, { status: 'cancelled', outcome: 'cancelled', reason: 'expired', closedBy: 'system:stale-sweep', nowIso: 'N' });
  assert.equal(f.outcomeBy, 'system');
  assert.equal(f.closedBy, 'system:stale-sweep');
  assert.equal(f.history[0].toStatus, 'cancelled');
  assert.equal(isSystemClosed(f), true);
});

// ── Escalation ladder ──────────────────────────────────────────────────────

test('escalation climbs the P-scale and stops at P0; approvals keep a P1 floor on the way back', () => {
  assert.equal(escalatedPriority('P3'), 'P2');
  assert.equal(escalatedPriority('P2'), 'P1');
  assert.equal(escalatedPriority('high'), 'P0');
  assert.equal(escalatedPriority('P0'), 'P0');
  assert.equal(deescalatedPriority({ priority: 'P1', escalatedAt: 'x' }), 'P2');
  assert.equal(deescalatedPriority({ priority: 'P1', escalatedAt: 'x', kind: 'approval' }), 'P1');
  assert.equal(deescalatedPriority({ priority: 'P1' }), null);
  assert.equal(priorityMax('P2', 'urgent'), 'P0');
  assert.equal(priorityMax('P1', 'P1'), 'P1');
});

test('escalationDecision counts WORKING hours past due and never repeats at P0', () => {
  const dueFri16 = new Date(eat('2026-10-23T16:00')).toISOString();
  // Saturday morning: nothing has elapsed at work.
  assert.equal(escalationDecision({ priority: 'P1', dueAt: dueFri16 }, eat('2026-10-24T09:00')), null);
  // Monday 13:00: 1h Friday + 5h Monday = 6 working hours ≥ P1's 4.
  const d = escalationDecision({ priority: 'P1', dueAt: dueFri16 }, eat('2026-10-26T13:00'));
  assert.deepEqual([d.from, d.to], ['P1', 'P0']);
  assert.equal(escalationDecision({ priority: 'P0', dueAt: dueFri16, escalatedAt: new Date(eat('2026-10-26T09:00')).toISOString() }, eat('2026-10-26T13:00')), null);
  assert.equal(escalationDecision({ priority: 'P1', dueAt: dueFri16, kind: 'notify' }, eat('2026-10-26T13:00')), null);
  // Already escalated this morning: the next notch waits another threshold.
  assert.equal(escalationDecision({ priority: 'P1', dueAt: dueFri16, escalatedAt: new Date(eat('2026-10-26T12:30')).toISOString() }, eat('2026-10-26T13:00')), null);
});

// ── Kinds ──────────────────────────────────────────────────────────────────

test('kinds derive from the event type; the rule wins when explicit', () => {
  assert.equal(deriveKind('ApprovalRungAdvanced'), 'approval');
  assert.equal(deriveKind('ConflictExclusivityRisk'), 'review');
  assert.equal(deriveKind('IWOIssued'), 'action');
  assert.equal(deriveKind('ClientMessageReceived'), 'followup');
  assert.equal(deriveKind('JournalEntryPosted'), 'notify');
  assert.equal(resolveKind({ kind: 'review' }, 'IWOIssued'), 'review');
});

// ── Stale classification ───────────────────────────────────────────────────

test('the stale sweep removes noise, never work', async () => {
  const now = Date.parse('2026-10-26T10:00:00Z');
  const old = new Date(now - (STALE_AFTER_DAYS + 1) * DAY).toISOString();
  const resolve = (state) => async () => state;
  const base = { status: 'assigned', priority: 'P3', dueAt: old, entityType: 'iwo', entityId: 'i1' };
  assert.equal(await classifyStaleTask(null, { ...base, status: 'in_progress' }, now, null, resolve('resolved')), null, 'a human engaged');
  assert.equal(await classifyStaleTask(null, { ...base, kind: 'approval' }, now, null, resolve('resolved')), null, 'approvals never expire');
  assert.equal(await classifyStaleTask(null, { ...base, source: 'personal' }, now, null, resolve('resolved')), null, "a person's own task");
  assert.equal(await classifyStaleTask(null, { ...base, priority: 'P1' }, now, null, resolve('resolved')), null, 'high priority survives');
  assert.equal(await classifyStaleTask(null, base, now, null, resolve('open')), null, 'record still open → real work');
  assert.equal(await classifyStaleTask(null, base, now, null, resolve('resolved')), 'expired');
  assert.equal(await classifyStaleTask(null, base, now, null, resolve('missing')), 'entity_missing');
  assert.equal(await classifyStaleTask(null, { ...base, entityType: null, entityId: null }, now, null, resolve('open')), 'expired', 'nothing anchors it');
  assert.equal(await classifyStaleTask(null, { status: 'assigned', kind: 'notify', createdAt: new Date(now - (NOTIFY_MAX_AGE_DAYS + 1) * DAY).toISOString() }, now, null, resolve('open')), 'notify_expired');
  assert.equal(await classifyStaleTask(null, { status: 'assigned', kind: 'notify', createdAt: new Date(now - DAY).toISOString() }, now, null, resolve('open')), null);
});

test('autoCloseAllowed and aggregate → entity type', () => {
  assert.equal(entityTypeForAggregate('IWO'), 'iwo');
  assert.equal(entityTypeForAggregate('MasterJob'), 'master_job');
  assert.equal(entityTypeForAggregate('InterCompanyInvoice'), 'intercompany_invoice');
  assert.equal(entityTypeForAggregate('SomethingNew'), 'something_new');
  assert.equal(autoCloseAllowed({ entityType: 'iwo', entityId: 'x' }), true);
  assert.equal(autoCloseAllowed({ entityType: 'iwo', entityId: 'x', kind: 'notify' }), false);
  assert.equal(autoCloseAllowed({ entityType: 'iwo', entityId: 'x', source: 'personal' }), false);
  assert.equal(autoCloseAllowed({ entityType: 'client', entityId: 'x' }), false);
});

// ── Notices a write calls for ──────────────────────────────────────────────

test('planTaskNotices: assigned, reassigned, reopened, escalated, blocked — and nothing else', () => {
  const t = { assignedToUserId: 'u1', status: 'assigned', title: 'x', updatedAt: '2026-10-26T10:00:00Z' };
  assert.deepEqual(planTaskNotices(null, t, 'T').map((p) => p.moment), ['assigned']);
  assert.deepEqual(planTaskNotices(t, { ...t, assignedToUserId: 'u2' }, 'T').map((p) => p.moment), ['reassigned']);
  assert.deepEqual(planTaskNotices({ ...t, status: 'completed' }, t, 'T').map((p) => p.moment), ['reopened']);
  assert.deepEqual(planTaskNotices(t, { ...t, escalatedAt: '2026-10-26T11:00:00Z' }, 'T').map((p) => p.moment), ['escalated']);
  assert.deepEqual(planTaskNotices(t, { ...t, status: 'blocked', blockedReason: 'No assets', blockedAt: '2026-10-26T11:00:00Z' }, 'T').map((p) => p.moment), ['blocked']);
  assert.deepEqual(planTaskNotices(t, { ...t, status: 'blocked' }, 'T'), [], 'a block without a reason tells nobody');
  assert.deepEqual(planTaskNotices(t, { ...t, status: 'in_progress' }, 'T'), [], 'status changes are not news');
  assert.deepEqual(planTaskNotices(t, { ...t, status: 'completed' }, 'T'), [], 'completion is not news');
  assert.deepEqual(planTaskNotices(null, { ...t, status: 'pending_assignment', assignedToUserId: null }, 'T'), []);
  // Deterministic ids: the same moment never notifies twice.
  assert.equal(planTaskNotices(null, t, 'T')[0].dedupeKey, planTaskNotices(null, t, 'T')[0].dedupeKey);
});
