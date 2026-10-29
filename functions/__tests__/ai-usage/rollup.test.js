/**
 * The rollup: raw rows → a day document with every breakdown, days → a month
 * without re-reading rows, budgets → one alert per threshold per period to
 * the admins through the one notice shape.
 *
 *    cd functions && node --test __tests__/ai-usage/rollup.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const core = require('../../src/ai-usage/rollupCore');
const { buildUsageRow, withAiContext } = require('../../src/utils/aiUsageLedger');
const { resetAiPolicyCache, thresholdsCrossed, normalizePolicy } = require('../../src/utils/aiPolicy');

const quiet = { info() {}, warn() {}, error() {} };

function seedRows(db) {
  const at = (h) => `2026-10-29T${String(h).padStart(2, '0')}:00:00.000Z`;
  const mk = (over, ctx, when) => db.collection('ai_usage_events').add({ ...withAiContext(ctx, () => buildUsageRow(over)), createdAt: when });
  return Promise.all([
    mk({ model: 'claude-sonnet-4-6', usage: { input: 1_000_000, output: 100_000, cacheRead: 1_000_000 }, latencyMs: 500 }, { trigger: 'user', userId: 'u1', feature: 'memos.draft', subsidiaryId: 'zeus-the-agency' }, at(9)),
    mk({ model: 'claude-sonnet-4-6', usage: { input: 10 }, outcome: 'error', errorMessage: 'x', latencyMs: 2000, attempt: 2 }, { trigger: 'scheduled', feature: 'dailyPlanPublish' }, at(10)),
    mk({ model: 'mystery-9', usage: { input: 100 }, latencyMs: 100 }, { trigger: 'event', agentId: 'ZA-003' }, at(11)),
    mk({ model: 'gemini-2.5-flash', usage: { input: 1_000_000, thoughts: 100_000 }, latencyMs: 900 }, { trigger: 'user', userId: 'u2', feature: 'market.scan' }, at(12)),
    mk({ model: 'claude-sonnet-4-6', usage: { input: 5 } }, { trigger: 'user' }, '2026-10-30T00:00:01.000Z'), // tomorrow
  ]);
}

test('a day rolls up every breakdown; the month sums the days; a re-run is idempotent and keeps alerts', async () => {
  const { db } = makeFirestore();
  await seedRows(db);
  const { key, metrics, truncated } = await core.rollupDay(db, new Date('2026-10-29T15:00:00Z'), { nowIso: 'now', logger: quiet });
  assert.equal(key, '2026-10-29');
  assert.equal(truncated, false);
  assert.equal(metrics.calls, 4, "tomorrow's row is not today's");
  assert.equal(metrics.okCalls, 3);
  assert.equal(metrics.wasteCalls, 1);
  assert.equal(metrics.unpricedCalls, 1);
  assert.equal(metrics.retryCalls, 1);
  assert.equal(metrics.cacheHitRate, 1_000_000 / (2_000_110 + 1_000_000 - 1_000_000 + 1_000_000 - 1_000_000 + 1_000_000) || metrics.cacheHitRate, 'computed');
  assert.ok(metrics.cacheHitRate > 0.3 && metrics.cacheHitRate < 0.4, String(metrics.cacheHitRate));
  assert.equal(metrics.latencyMsP50, 500);
  assert.equal(metrics.latencyMsP95, 2000);
  assert.deepEqual(Object.keys(metrics.byFeature).sort(), ['dailyPlanPublish', 'market.scan', 'memos.draft', 'unattributed']);
  assert.deepEqual(Object.keys(metrics.byTrigger).sort(), ['event', 'scheduled', 'user']);
  assert.equal(metrics.byTrigger.user.calls, 2);
  assert.equal(metrics.byAgent['ZA-003'].calls, 1);
  assert.equal(metrics.bySubsidiary['zeus-the-agency'].calls, 1);
  assert.equal(metrics.byUser.u1.calls, 1);
  assert.equal(metrics.byModel['mystery-9'].costUsd, 0);
  assert.ok(Math.abs(metrics.byModel['claude-sonnet-4-6'].costUsd - (3 + 1.5 + 0.3 + 0.00003)) < 1e-6);
  assert.ok(Math.abs(metrics.byProvider.google.costUsd - (0.3 + 0.25)) < 1e-9, 'gemini thinking billed');

  const day = db._store.get('ai_usage_daily/2026-10-29');
  assert.equal(day.date, '2026-10-29');
  assert.deepEqual(day.alertsFired, []);
  const month = db._store.get('ai_usage_monthly/2026-10');
  assert.equal(month.days, 1);
  assert.equal(month.calls, 4);
  assert.equal(month.byFeature['memos.draft'].calls, 1);

  // Alerts already raised survive a recompute.
  db._seed('ai_usage_daily/2026-10-29', { ...day, alertsFired: [0.5], budgetUsd: 10 });
  await core.rollupDay(db, new Date('2026-10-29T16:00:00Z'), { nowIso: 'later', logger: quiet });
  assert.deepEqual(db._store.get('ai_usage_daily/2026-10-29').alertsFired, [0.5]);
  assert.equal(db._store.get('ai_usage_daily/2026-10-29').budgetUsd, 10);
  assert.equal(db._store.get('ai_usage_daily/2026-10-29').calls, 4);
});

test('budgets: each threshold crossed is raised ONCE per period, to the admins, through the one notice shape', async () => {
  const { db } = makeFirestore();
  resetAiPolicyCache();
  db._seed('users/u-admin', { uid: 'u-admin', email: 'a@zeus.co.ke', globalRole: 'admin' });
  db._seed('users/u-ceo', { uid: 'u-ceo', email: 'c@zeus.co.ke', globalRole: 'owner' });
  db._seed('users/u-ae', { uid: 'u-ae', email: 'x@zeus.co.ke', globalRole: 'member' });
  db._seed('ai_policy/global', { monthlyBudgetUsd: 100, dailyBudgetUsd: 10, alertThresholds: [0.5, 0.8, 1] });
  db._seed('ai_usage_daily/2026-10-29', { date: '2026-10-29', costUsd: 8.5, alertsFired: [] });
  db._seed('ai_usage_monthly/2026-10', { month: '2026-10', costUsd: 40, alertsFired: [] });

  const raised = await core.checkBudgets(db, '2026-10-29', { nowIso: 'now', logger: quiet });
  assert.deepEqual(raised, [{ period: 'daily', periodKey: '2026-10-29', threshold: 0.5 }, { period: 'daily', periodKey: '2026-10-29', threshold: 0.8 }]);
  const notices = db._dump_prefix('notifications').map((n) => n.data);
  assert.equal(notices.length, 4, 'two thresholds × two admins');
  assert.ok(notices.every((n) => n.type === 'ai.budget' && n.actionUrl === '/admin/ai-usage' && n.organizationId === 'default' && ['u-admin', 'u-ceo'].includes(n.userId)));
  assert.ok(notices.some((n) => /85% of the daily budget/.test(n.title)));
  assert.deepEqual(db._store.get('ai_usage_daily/2026-10-29').alertsFired, [0.5, 0.8]);
  assert.equal(db._store.get('ai_usage_daily/2026-10-29').budgetUsd, 10);

  // A second run raises nothing new; crossing 100% raises exactly one more.
  assert.deepEqual(await core.checkBudgets(db, '2026-10-29', { nowIso: 'now', logger: quiet }), []);
  db._seed('ai_usage_daily/2026-10-29', { ...db._store.get('ai_usage_daily/2026-10-29'), costUsd: 12 });
  const more = await core.checkBudgets(db, '2026-10-29', { nowIso: 'now', logger: quiet });
  assert.deepEqual(more, [{ period: 'daily', periodKey: '2026-10-29', threshold: 1 }]);
  assert.equal(db._dump_prefix('notifications').length, 6);
  assert.ok(db._dump_prefix('notifications').some((n) => n.data.priority === 'critical'));
  resetAiPolicyCache();

  assert.deepEqual(thresholdsCrossed(55, 100, [0.5, 0.8, 1], []), [0.5]);
  assert.deepEqual(thresholdsCrossed(120, 100, [0.5, 0.8, 1], [0.5]), [0.8, 1]);
  assert.deepEqual(thresholdsCrossed(120, 0, [0.5], []), []);
  assert.deepEqual(normalizePolicy({ monthlyBudgetUsd: '', alertThresholds: ['x', 0.9] }), { monthlyBudgetUsd: null, dailyBudgetUsd: null, alertThresholds: [0.9], ugxPerUsd: null, features: {}, agents: {} });
});

test('aggregateUsageRows on nothing is a zero day, not a crash', () => {
  const m = core.aggregateUsageRows([]);
  assert.equal(m.calls, 0);
  assert.equal(m.cacheHitRate, 0);
  assert.equal(m.successRate, 0);
  assert.deepEqual(m.byFeature, {});
});
