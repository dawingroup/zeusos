/**
 * Daily focus loop — composition rules, working days, the pinned review and
 * the close run's outcome resolver (Phase 6.E). These pin the PURE pieces
 * because they decide whether a person's day is honest: carry-overs must
 * survive, noise must stay out, and an item nobody touched must not vanish.
 *
 *    cd functions && node --test __tests__/event-task-engine/dailyPlan.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { scoreTask, dateKey, isPlannableTask, PRIORITY_WEIGHT } = require('../../src/event-task-engine/lib/taskRanking');
const { toMillis, normalisePriority, normaliseStatus, assigneeOf, dueMsOf } = require('../../src/event-task-engine/lib/taskModel');
const {
  MAX_PLAN_ITEMS, planId, composePlanItems, focusReasonFor, dayStartMs, resolveOutcome, carriedFrom,
  addDays, weekdayOf, isWorkDay, nextWorkDay, reviewDayLabel,
  buildPinnedReviewItem, canPinReview, withPinnedReview, isSupersededReview,
  draftDecision, isHumanOwned, resumeNoteFor, whyTodayFor, entityRefFor,
} = require('../../src/event-task-engine/lib/dailyPlan');
const { canonicalAssigneeId, groupByAssignee } = require('../../src/event-task-engine/lib/peopleDirectory');

const NOW = Date.parse('2026-10-26T14:00:00Z'); // Monday 17:00 Nairobi — draft time
const PLAN_DATE = '2026-10-27';
const DAY_START = dayStartMs(PLAN_DATE);
const DAY = 86400000;

function task(id, over = {}) {
  return { id, assignedToUserId: 'uid-1', title: `Task ${id}`, priority: 'P2', status: 'assigned', ...over };
}

// ── Vocabulary ─────────────────────────────────────────────────────────────

test('legacy priority and status words are read, never flattened to the default', () => {
  assert.equal(normalisePriority('urgent'), 'P0');
  assert.equal(normalisePriority('critical'), 'P0');
  assert.equal(normalisePriority('high'), 'P1');
  assert.equal(normalisePriority('low'), 'P3');
  assert.equal(normalisePriority('P1'), 'P1');
  assert.equal(normalisePriority(undefined), 'P2');
  assert.equal(normaliseStatus('pending'), 'assigned');
  assert.equal(normaliseStatus('in_progress'), 'in_progress');
});

test('assigneeOf reads the engine field first, the legacy field second, and never a sentinel', () => {
  assert.equal(assigneeOf({ assignedToUserId: 'u1' }), 'u1');
  assert.equal(assigneeOf({ assignedTo: 'legacy' }), 'legacy');
  assert.equal(assigneeOf({ assignedToUserId: 'system' }), null);
  assert.equal(assigneeOf({ assignedToUserId: 'agent:ZA-002' }), null);
  assert.equal(assigneeOf({}), null);
});

test('toMillis accepts every timestamp shape the codebase produces', () => {
  const ms = 1_761_480_000_000;
  assert.equal(toMillis(ms), ms);
  assert.equal(toMillis(new Date(ms)), ms);
  assert.equal(toMillis(new Date(ms).toISOString()), ms);
  assert.equal(toMillis({ seconds: ms / 1000 }), ms);
  assert.equal(toMillis({ toMillis: () => ms }), ms);
  assert.equal(toMillis(undefined), null);
  assert.equal(toMillis('not a date'), null);
  assert.equal(dueMsOf({ dueAt: new Date(ms).toISOString() }), ms);
  assert.equal(dueMsOf({ dueDate: { seconds: ms / 1000 } }), ms);
});

// ── Ranking ────────────────────────────────────────────────────────────────

test('priority outranks, approvals bump, overdue bumps', () => {
  assert.ok(PRIORITY_WEIGHT.P0 > PRIORITY_WEIGHT.P3);
  assert.ok(scoreTask({ priority: 'urgent' }, NOW) > scoreTask({ priority: 'low' }, NOW), 'legacy words still rank');
  const plain = scoreTask({ priority: 'P2' }, NOW);
  assert.ok(scoreTask({ priority: 'P2', kind: 'approval' }, NOW) > plain);
  assert.ok(scoreTask({ priority: 'P2', entityType: 'client_invoice' }, NOW) > plain);
  const overdue = scoreTask({ priority: 'P2', dueAt: new Date(NOW - DAY).toISOString() }, NOW);
  const later = scoreTask({ priority: 'P2', dueAt: new Date(NOW + 5 * DAY).toISOString() }, NOW);
  assert.ok(overdue > later);
});

test('dateKey is Nairobi-local, so late-evening UTC still plans the right day', () => {
  const late = Date.parse('2026-10-26T22:30:00Z'); // 01:30 EAT on the 27th
  assert.equal(dateKey(late), '2026-10-27');
  assert.equal(dateKey(late, 1), '2026-10-28');
  assert.equal(dateKey(NOW), '2026-10-26');
  assert.equal(new Date(DAY_START).toISOString(), '2026-10-26T21:00:00.000Z', 'midnight EAT, not UTC');
});

// ── Plan composition ───────────────────────────────────────────────────────

test('planId keys one plan per person per day', () => {
  assert.equal(planId(PLAN_DATE, 'uid-1'), '2026-10-27_uid-1');
});

test('notify-kind, unassigned and the review task itself never reach a plan', () => {
  assert.equal(isPlannableTask(task('a', { kind: 'notify' })), false);
  assert.equal(isPlannableTask({ id: 'c', title: 'x', status: 'pending_assignment' }), false);
  assert.equal(isPlannableTask(task('r', { entityType: 'daily_plan_review' })), false);
  assert.equal(isPlannableTask(task('d')), true);
  const items = composePlanItems([task('a', { kind: 'notify' }), task('c')], { now: NOW, planDayStartMs: DAY_START });
  assert.deepEqual(items.map((i) => i.taskId), ['c']);
});

test('carry-overs come first even when a fresher task scores higher', () => {
  const items = composePlanItems(
    [task('urgent-new', { priority: 'P0' }), task('slipped', { priority: 'P3' })],
    { now: NOW, planDayStartMs: DAY_START, carriedTaskIds: ['slipped'] },
  );
  assert.deepEqual(items.map((i) => i.taskId), ['slipped', 'urgent-new']);
  assert.equal(items[0].focusReason, 'carry_over');
  assert.deepEqual(items.map((i) => i.order), [0, 1]);
});

test('overdue ranks above due-today, which ranks above the rest', () => {
  const items = composePlanItems(
    [
      task('later', { dueAt: new Date(DAY_START + 10 * DAY).toISOString() }),
      task('today', { dueAt: new Date(DAY_START + 3600000).toISOString() }),
      task('late', { dueAt: new Date(DAY_START - DAY).toISOString() }),
    ],
    { now: NOW, planDayStartMs: DAY_START },
  );
  assert.deepEqual(items.map((i) => i.taskId), ['late', 'today', 'later']);
  assert.deepEqual(items.map((i) => i.focusReason), ['overdue', 'due_today', 'auto_rank']);
});

test('the plan is capped — it is a focus list, not the inbox', () => {
  const many = Array.from({ length: 30 }, (_, i) => task(`t${i}`, { priority: 'P1' }));
  assert.equal(composePlanItems(many, { now: NOW, planDayStartMs: DAY_START }).length, MAX_PLAN_ITEMS);
});

test('duplicate task ids collapse', () => {
  assert.equal(composePlanItems([task('dup'), task('dup')], { now: NOW, planDayStartMs: DAY_START }).length, 1);
});

test('plan items denormalise what the focus card renders, and nothing undefined', () => {
  const [item] = composePlanItems(
    [task('t1', { kind: 'approval', sourceModule: 'assignment', estimateMinutes: 45, iwoId: 'iwo-1', dueAt: '2026-10-27T09:00:00.000Z' })],
    { now: NOW, planDayStartMs: DAY_START },
  );
  assert.equal(item.title, 'Task t1');
  assert.equal(item.kind, 'approval');
  assert.equal(item.timeboxMinutes, 45);
  assert.equal(item.iwoId, 'iwo-1');
  assert.equal(item.dueAt, '2026-10-27T09:00:00.000Z');
  for (const [k, v] of Object.entries(item)) assert.notEqual(v, undefined, `${k} is undefined`);
});

test('focusReasonFor treats the plan day, not "now", as the boundary', () => {
  const dueOnPlanDay = { id: 'x', dueAt: new Date(DAY_START + 7200000).toISOString() };
  assert.equal(focusReasonFor(dueOnPlanDay, DAY_START, new Set()), 'due_today');
  assert.equal(focusReasonFor(dueOnPlanDay, DAY_START, new Set(['x'])), 'carry_over');
});

test('focus-card copy is built only from facts; no fact, no field', () => {
  const [item] = composePlanItems(
    [task('a', { entityName: 'IWO-0142', aiUrgencyReason: 'Client presentation Thursday' })],
    {
      now: NOW, planDayStartMs: DAY_START, carriedTaskIds: ['a'],
      previousItems: [{ taskId: 'a', outcome: 'blocked', outcomeNote: 'Waiting on the brand guidelines' }],
    },
  );
  assert.equal(item.entityRef, 'IWO-0142');
  assert.equal(item.whyToday, 'Client presentation Thursday');
  assert.equal(item.resumeNote, 'Blocked last time: Waiting on the brand guidelines');
  const [bare] = composePlanItems([task('b')], { now: NOW, planDayStartMs: DAY_START });
  for (const f of ['entityRef', 'whyToday', 'resumeNote']) assert.equal(f in bare, false, f);
  assert.equal(resumeNoteFor({ checklistItems: [{ completed: true }, { completed: false }, { completed: true }] }), '2 of 3 checklist steps done.');
  assert.equal(resumeNoteFor({ status: 'blocked', blockedReason: 'No assets' }), 'Marked blocked: No assets');
  assert.equal(resumeNoteFor({ status: 'in_progress' }), 'In progress.');
  assert.equal(whyTodayFor({}), null);
  assert.equal(entityRefFor({ masterJobName: 'Safaricom Q4' }), 'Safaricom Q4');
});

// ── Working days ───────────────────────────────────────────────────────────

const OFFICE = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

test('calendar arithmetic and work-day defaults', () => {
  assert.equal(weekdayOf('2026-10-31'), 'saturday');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(isWorkDay('2026-10-31', undefined), false, 'Mon–Fri default');
  assert.equal(isWorkDay('2026-10-31', ['Saturday']), true, 'case-insensitive');
  assert.equal(nextWorkDay('2026-10-30', OFFICE), '2026-11-02', 'Fri → Mon');
  assert.equal(nextWorkDay('2026-10-26', OFFICE), '2026-10-27');
  assert.equal(nextWorkDay('2026-10-30', [...OFFICE, 'saturday']), '2026-10-31');
  assert.equal(reviewDayLabel('2026-10-27', '2026-10-26'), "tomorrow's");
  assert.equal(reviewDayLabel('2026-11-02', '2026-10-30'), "Monday's");
});

// ── The pinned review ──────────────────────────────────────────────────────

test('the pinned review carries no undefined field and goes FIRST', () => {
  const pin = buildPinnedReviewItem('mgr', '2026-10-27', 3, '2026-10-26');
  for (const [k, v] of Object.entries(pin)) assert.notEqual(v, undefined, k);
  assert.equal(pin.taskId, 'daily-plan-review:mgr:2026-10-27');
  assert.match(pin.title, /\(3 people\)/);
  assert.match(buildPinnedReviewItem('m', '2026-10-27', 1).title, /\(1 person\)/);
  const items = withPinnedReview([{ taskId: 'po', order: 0, priority: 'P0' }], pin);
  assert.equal(items[0].entityType, 'daily_plan_review');
  assert.deepEqual(items.map((i) => i.order), [0, 1]);
  const twice = withPinnedReview(items, pin);
  assert.equal(twice.filter((i) => i.entityType === 'daily_plan_review').length, 1, 'never stacks');
  assert.equal(withPinnedReview(undefined, pin).length, 1);
});

test('a wrapped-up or closed day is never reopened by a pin', () => {
  assert.equal(canPinReview({ status: 'published' }), true);
  assert.equal(canPinReview({ status: 'published', wrapUp: { closedBy: 'system:daily-plan-close' } }), true);
  assert.equal(canPinReview({ status: 'published', wrapUp: { at: '2026-10-26T13:55:00Z' } }), false);
  assert.equal(canPinReview({ status: 'closed' }), false);
  assert.equal(canPinReview(null), false);
});

test('only an EARLIER review is superseded', () => {
  const current = 'daily-plan-review:m:2026-10-27';
  assert.equal(isSupersededReview('daily-plan-review:m:2026-10-26', '2026-10-26', current, '2026-10-27'), true);
  assert.equal(isSupersededReview(current, '2026-10-27', current, '2026-10-27'), false);
  assert.equal(isSupersededReview('daily-plan-review:m:2026-10-29', '2026-10-29', current, '2026-10-27'), false);
});

// ── Close run + carry-overs ────────────────────────────────────────────────

test('an untouched item is resolved from the live task, never dropped', () => {
  assert.equal(resolveOutcome(undefined, 'completed'), 'done');
  assert.equal(resolveOutcome(undefined, 'cancelled'), 'done');
  assert.equal(resolveOutcome(undefined, 'assigned'), 'carried');
  assert.equal(resolveOutcome(undefined, 'in_progress'), 'carried');
  assert.equal(resolveOutcome(undefined, 'blocked'), 'blocked');
  assert.equal(resolveOutcome(undefined, 'missing'), 'done');
  assert.equal(resolveOutcome('done', 'assigned'), 'done', "a person's own disposition wins");
  assert.equal(resolveOutcome('dropped', 'in_progress'), 'dropped');
});

test('carry-overs come from the wrap-up, else from carried/blocked/untouched items', () => {
  assert.deepEqual(carriedFrom({ wrapUp: { carriedTaskIds: ['a'] }, items: [{ taskId: 'b' }] }), ['a']);
  assert.deepEqual(carriedFrom({ items: [{ taskId: 'a', outcome: 'done' }, { taskId: 'b', outcome: 'carried' }, { taskId: 'c' }] }), ['b', 'c']);
  assert.deepEqual(carriedFrom(null), []);
});

test('draft decisions: humans own what they touched; the refresh never creates', () => {
  assert.equal(draftDecision(null, false), 'write');
  assert.equal(draftDecision({ status: 'draft', source: 'system' }, true), 'write');
  assert.equal(draftDecision(null, true), 'leave');
  assert.equal(draftDecision({ status: 'published', source: 'system' }, true), 'leave');
  for (const refreshOnly of [false, true]) {
    assert.equal(draftDecision({ status: 'draft', source: 'manager' }, refreshOnly), 'human_owned');
    assert.equal(draftDecision({ status: 'draft', source: 'system', reviewed: true }, refreshOnly), 'human_owned');
  }
  assert.equal(isHumanOwned(null), false);
});

// ── One person, one plan ───────────────────────────────────────────────────

test('work assigned under an employee id and a uid lands on ONE plan, keyed by uid', () => {
  const rec = { employeeId: 'emp-1', uid: 'uid-1', name: 'Amina' };
  const dir = new Map([['emp-1', rec], ['uid-1', rec], ['amina@zeus.co.ke', rec]]);
  assert.equal(canonicalAssigneeId('emp-1', dir), 'uid-1');
  assert.equal(canonicalAssigneeId('uid-1', dir), 'uid-1');
  assert.equal(canonicalAssigneeId('stranger', dir), 'stranger', 'unknown ids keep their own plan');
  const grouped = groupByAssignee(
    [{ id: 'a', assignedToUserId: 'emp-1' }, { id: 'b', assignedToUserId: 'uid-1' }, { id: 'c', assignedTo: 'other' }, { id: 'd' }],
    dir,
  );
  assert.equal(grouped.size, 2);
  assert.deepEqual(grouped.get('uid-1').map((t) => t.id), ['a', 'b']);
});
