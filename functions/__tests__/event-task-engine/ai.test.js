/**
 * The AI pieces of Phase 6.E (PR 3): "Draft with AI" and the morning brief.
 * Both are dark without an Anthropic key and never fail what they decorate.
 * The model is injected; nothing here touches the network.
 *
 *    cd functions && node --test __tests__/event-task-engine/ai.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { draftTasks, normaliseDrafts, buildPrompt, safeJson } = require('../../src/event-task-engine/ai/draftTasksWithAi');
const { briefPlans, briefPrompt } = require('../../src/event-task-engine/ai/dailyBrief');
const { runDailyPlanPublish } = require('../../src/event-task-engine/scheduled/dailyPlanPublishRun');

const quiet = { info() {}, warn() {}, error() {} };
const notConfigured = async () => { const e = new Error('no key'); e.code = 'NOT_CONFIGURED'; throw e; };
const fakeModel = (text) => async () => ({
  model: 'claude-test',
  client: { messages: { create: async () => ({ content: [{ type: 'text', text }] }) } },
});

function seedPeople(db) {
  db._seed('users/uid-mgr', { uid: 'uid-mgr', email: 'grace@zeus.co.ke', displayName: 'Grace' });
  db._seed('users/uid-amina', { uid: 'uid-amina', email: 'amina@zeus.co.ke', displayName: 'Amina' });
  db._seed('users/uid-ben', { uid: 'uid-ben', email: 'ben@zeus.co.ke', displayName: 'Ben' });
  db._seed('employees/emp-mgr', { firstName: 'Grace', lastName: 'W', email: 'grace@zeus.co.ke', employmentStatus: 'active', position: {} });
  db._seed('employees/emp-amina', { firstName: 'Amina', lastName: 'O', email: 'amina@zeus.co.ke', employmentStatus: 'active', position: { title: 'Account Executive', reportingTo: 'emp-mgr' } });
  db._seed('employees/emp-ben', { firstName: 'Ben', lastName: 'K', email: 'ben@zeus.co.ke', employmentStatus: 'active', position: {} });
}
const authDeps = (uid) => ({ auth: { uid, token: {} }, loadUserDoc: async () => null, isParentOrgUser: async () => false, nowIso: '2026-10-27T15:00:00.000Z' });

// ── Draft with AI ──────────────────────────────────────────────────────────

test('without a key, drafting refuses with a sentence the form can show — and nothing is written', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  await assert.rejects(
    draftTasks(db, { intent: 'Get the deck to the ECD' }, { ...authDeps('uid-amina'), getAnthropic: notConfigured }),
    (err) => err.code === 'failed-precondition' && /ANTHROPIC_API_KEY/.test(err.message),
  );
  assert.equal(db._dump_prefix('generated_tasks').length, 0);
});

test('the manager drafts for a report: the model sees their open work, the drafts come back clean, nothing is written', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  db._seed('generated_tasks/open-1', { title: 'Brief the photographer', priority: 'P2', status: 'assigned', assignedToUserId: 'uid-amina', dueAt: '2026-10-28T14:00:00Z' });
  let prompt = '';
  const getAnthropic = async () => ({
    model: 'claude-test',
    client: { messages: { create: async ({ messages }) => { prompt = messages[0].content; return { content: [{ type: 'text', text: '```json\n[{"title":"Send the Q4 deck to the ECD","description":"Attach v3, ask for sign-off by Thursday.","priority":"high","kind":"action","estimateMinutes":50,"dueDate":"2026-10-28","why":"Unblocks client presentation"},{"title":"","priority":"P9"},{"title":"Raise the October invoice","priority":"P1","estimateMinutes":9999,"kind":"dance"}]\n```' }] }; } } },
  });
  const r = await draftTasks(db, { intent: 'Deck to the ECD, invoice out', assigneeUid: 'emp-amina', planDate: '2026-10-28' }, { ...authDeps('uid-mgr'), getAnthropic });
  assert.equal(r.assigneeUid, 'uid-amina');
  assert.match(prompt, /Brief the photographer/, 'open work is in the prompt');
  assert.match(prompt, /Deck to the ECD, invoice out/);
  assert.equal(r.drafts.length, 2, 'the blank draft is dropped');
  assert.deepEqual(r.drafts[0], { title: 'Send the Q4 deck to the ECD', description: 'Attach v3, ask for sign-off by Thursday.', priority: 'P1', kind: 'action', estimateMinutes: 45, dueDate: '2026-10-28', why: 'Unblocks client presentation' });
  assert.equal(r.drafts[1].estimateMinutes, 480, 'capped');
  assert.equal(r.drafts[1].kind, 'action', 'unknown kind → action');
  assert.equal(r.drafts[1].dueDate, '2026-10-28', 'the plan date when the model gave none');
  assert.equal(db._dump_prefix('generated_tasks').length, 1, 'nothing written — drafts are for the form');
  assert.equal(db._dump_prefix('agent_audit_entries').length, 1, 'one audit row');
});

test('a stranger may not draft for someone else; an empty intent is refused', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  await assert.rejects(
    draftTasks(db, { intent: 'x', assigneeUid: 'uid-amina' }, { ...authDeps('uid-ben'), getAnthropic: fakeModel('[]') }),
    (err) => err.code === 'permission-denied',
  );
  await assert.rejects(draftTasks(db, { intent: '  ' }, { ...authDeps('uid-ben'), getAnthropic: fakeModel('[]') }), (err) => err.code === 'invalid-argument');
});

test('normaliseDrafts and safeJson are forgiving of the model', () => {
  assert.deepEqual(normaliseDrafts(null), []);
  assert.equal(normaliseDrafts(Array.from({ length: 9 }, (_, i) => ({ title: `t${i}` }))).length, 5, 'capped at five');
  assert.equal(safeJson('Here you go: [{"title":"a"}] thanks')[0].title, 'a');
  assert.equal(safeJson('no json'), null);
  const p = buildPrompt({ intent: 'x', person: { name: 'Amina', jobTitle: 'AE' }, planDate: '2026-10-28', openTasks: [] });
  assert.match(p, /Amina, AE/);
  assert.match(p, /\(nothing open\)/);
});

// ── Morning brief ──────────────────────────────────────────────────────────

test('without a key the publish is unchanged: plans publish with no brief', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  db._seed('daily_plans/2026-10-27_uid-amina', { date: '2026-10-27', assigneeUid: 'uid-amina', status: 'draft', source: 'system', items: [{ taskId: 'a', order: 0, title: 'x', priority: 'P2' }] });
  const summary = await runDailyPlanPublish(db, { now: Date.parse('2026-10-27T03:00:00Z'), logger: quiet, getAnthropic: notConfigured });
  assert.equal(summary.published, 1);
  assert.equal(summary.briefs, 0);
  assert.equal(db._store.get('daily_plans/2026-10-27_uid-amina').brief, undefined);
});

test('with a key every published plan with work gets a brief once; a failure never fails the publish', async () => {
  const { db } = makeFirestore();
  seedPeople(db);
  db._seed('daily_plans/2026-10-27_uid-amina', { date: '2026-10-27', assigneeUid: 'uid-amina', assigneeName: 'Amina', status: 'draft', source: 'system', dayGoal: 'Land the deck', items: [{ taskId: 'a', order: 1, title: 'Raise the invoice', priority: 'P2' }, { taskId: 'b', order: 0, title: 'Send the deck', priority: 'P1', focusReason: 'carry_over', whyToday: 'Client presentation Thursday' }] });
  db._seed('daily_plans/2026-10-27_uid-ben', { date: '2026-10-27', assigneeUid: 'uid-ben', status: 'draft', source: 'system', items: [] });
  let calls = 0;
  const getAnthropic = async () => ({
    model: 'claude-test',
    client: { messages: { create: async ({ messages }) => {
      calls++;
      const prompt = messages[0].content;
      assert.match(prompt, /1\. Send the deck \[P1, carried over\] Why today: Client presentation Thursday/);
      assert.match(prompt, /Land the deck/);
      return { content: [{ type: 'text', text: '  Start with the deck — it slipped yesterday and the client sees it Thursday.\n Then raise the invoice.  ' }] };
    } } },
  });
  const summary = await runDailyPlanPublish(db, { now: Date.parse('2026-10-27T03:00:00Z'), logger: quiet, getAnthropic });
  assert.equal(summary.briefs, 1, 'the empty plan is not briefed');
  const plan = db._store.get('daily_plans/2026-10-27_uid-amina');
  assert.equal(plan.brief, 'Start with the deck — it slipped yesterday and the client sees it Thursday. Then raise the invoice.');
  assert.equal(plan.briefDate, '2026-10-27');
  assert.equal(plan.briefModel, 'claude-test');

  // Re-running publishes nothing new and asks the model again for nobody.
  const again = await runDailyPlanPublish(db, { now: Date.parse('2026-10-27T03:30:00Z'), logger: quiet, getAnthropic });
  assert.equal(again.briefs, 0);
  assert.equal(calls, 1);

  // A model error on one plan is logged, not thrown.
  const failing = async () => ({ model: 'm', client: { messages: { create: async () => { throw new Error('rate limited'); } } } });
  const n = await briefPlans(db, [{ id: 'daily_plans_x', date: '2026-10-27', status: 'published', items: [{ taskId: 'a', title: 'x', priority: 'P2' }] }], { getAnthropic: failing, logger: quiet });
  assert.equal(n, 0);
  assert.match(briefPrompt({ assigneeName: 'Ben', date: '2026-10-27', items: [] }), /\(nothing\)/);
});
