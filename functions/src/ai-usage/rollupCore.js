/**
 * AI usage rollup — the aggregation itself, with no firebase-functions import
 * so the node tests drive the real code against the in-memory Firestore.
 *
 * Reads `ai_usage_events` for one UTC day, writes `ai_usage_daily/{yyyy-mm-dd}`,
 * re-sums the month into `ai_usage_monthly/{yyyy-mm}` from the day documents
 * (never from raw rows), and raises a budget alert to the admins — one notice
 * per threshold per period — through the one notice shape (stream C).
 */

'use strict';

const EVENTS = 'ai_usage_events';
const DAILY = 'ai_usage_daily';
const MONTHLY = 'ai_usage_monthly';

/** Rows read per day. Above this the day is marked truncated rather than wrong. */
const MAX_ROWS_PER_DAY = 50_000;

const DIMENSIONS = ['feature', 'model', 'provider', 'trigger', 'subsidiaryId', 'agentId', 'userId'];

function emptyBucket() {
  return {
    calls: 0, okCalls: 0, wasteCalls: 0,
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, thoughtTokens: 0, searches: 0,
    costUsd: 0, costUgx: 0, wasteCostUsd: 0,
  };
}

function addTo(bucket, row) {
  const u = row.usage || {};
  bucket.calls += 1;
  if (row.outcome === 'ok') bucket.okCalls += 1;
  if (row.isWaste) {
    bucket.wasteCalls += 1;
    bucket.wasteCostUsd += Number(row.costUsd) || 0;
  }
  bucket.inputTokens += Number(u.input) || 0;
  bucket.outputTokens += Number(u.output) || 0;
  bucket.cacheReadTokens += Number(u.cacheRead) || 0;
  bucket.cacheWriteTokens += Number(u.cacheWrite) || 0;
  bucket.thoughtTokens += Number(u.thoughts) || 0;
  bucket.searches += Number(u.searches) || 0;
  bucket.costUsd += Number(row.costUsd) || 0;
  bucket.costUgx += Number(row.costUgx) || 0;
}

function round(bucket) {
  return {
    ...bucket,
    costUsd: Math.round(bucket.costUsd * 1e6) / 1e6,
    wasteCostUsd: Math.round(bucket.wasteCostUsd * 1e6) / 1e6,
    costUgx: Math.round(bucket.costUgx),
  };
}

function mapRound(group) {
  const out = {};
  for (const [k, v] of Object.entries(group)) out[k] = round(v);
  return out;
}

/** Nearest-rank percentile. */
function percentile(sortedAsc, k) {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = Math.ceil((k / 100) * sortedAsc.length);
  return sortedAsc[Math.max(0, Math.min(sortedAsc.length - 1, rank - 1))];
}

/** PURE: raw ledger rows → a day document. `cacheHitRate` says whether caching pays off. */
function aggregateUsageRows(rows) {
  const totals = emptyBucket();
  const by = {};
  for (const d of DIMENSIONS) by[d] = {};
  const latencies = [];
  let unpricedCalls = 0;
  let fallbackCalls = 0;
  let retryCalls = 0;

  for (const row of rows) {
    addTo(totals, row);
    for (const d of DIMENSIONS) {
      const key = row[d] || (d === 'feature' ? 'unattributed' : 'none');
      if (!by[d][key]) by[d][key] = emptyBucket();
      addTo(by[d][key], row);
    }
    if (row.priced === false) unpricedCalls += 1;
    if (row.fallbackFrom) fallbackCalls += 1;
    if (Number(row.attempt) > 1) retryCalls += 1;
    if (Number.isFinite(row.latencyMs)) latencies.push(Number(row.latencyMs));
  }

  latencies.sort((a, b) => a - b);
  const cacheableInput = totals.inputTokens + totals.cacheReadTokens;
  return {
    ...round(totals),
    unpricedCalls,
    fallbackCalls,
    retryCalls,
    cacheHitRate: cacheableInput > 0 ? totals.cacheReadTokens / cacheableInput : 0,
    successRate: totals.calls > 0 ? totals.okCalls / totals.calls : 0,
    latencyMsP50: Math.round(percentile(latencies, 50)),
    latencyMsP95: Math.round(percentile(latencies, 95)),
    byFeature: mapRound(by.feature),
    byModel: mapRound(by.model),
    byProvider: mapRound(by.provider),
    byTrigger: mapRound(by.trigger),
    bySubsidiary: mapRound(by.subsidiaryId),
    byAgent: mapRound(by.agentId),
    byUser: mapRound(by.userId),
  };
}

/** yyyy-mm-dd in UTC. */
function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/** Rows carry `createdAt` as an ISO string, so a day is a string range. */
async function readDayRows(db, dayStartIso, dayEndIso) {
  const snap = await db.collection(EVENTS)
    .where('createdAt', '>=', dayStartIso)
    .where('createdAt', '<', dayEndIso)
    .limit(MAX_ROWS_PER_DAY)
    .get();
  return snap.docs.map((d) => d.data());
}

/** Recompute one day and its month. Idempotent; a backfill script can call it. */
async function rollupDay(db, date, deps = {}) {
  const nowIso = deps.nowIso || new Date().toISOString();
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const key = dayKey(dayStart);

  const rows = await readDayRows(db, dayStart.toISOString(), dayEnd.toISOString());
  const metrics = aggregateUsageRows(rows);
  const truncated = rows.length >= MAX_ROWS_PER_DAY;
  if (truncated) console.warn(`[aiUsageRollup] ${key} hit the ${MAX_ROWS_PER_DAY}-row cap; totals are a floor, not a total`);

  const ref = db.collection(DAILY).doc(key);
  const prior = await ref.get();
  const keep = prior.exists ? prior.data() : {};
  // A full recompute, but the alerts already raised for the day survive it.
  await ref.set({
    ...metrics,
    date: key,
    truncated,
    rowsRead: rows.length,
    alertsFired: Array.isArray(keep.alertsFired) ? keep.alertsFired : [],
    ...(keep.budgetUsd != null ? { budgetUsd: keep.budgetUsd } : {}),
    updatedAt: nowIso,
  });

  await rollupMonth(db, key.slice(0, 7), deps);
  return { key, metrics, truncated };
}

/** Sum the month's already-computed days — never re-read raw rows for a month. */
async function rollupMonth(db, monthKey, deps = {}) {
  const nowIso = deps.nowIso || new Date().toISOString();
  const snap = await db.collection(DAILY).where('date', '>=', `${monthKey}-01`).where('date', '<=', `${monthKey}-31`).get();

  const totals = emptyBucket();
  const by = { byFeature: {}, byModel: {}, byProvider: {}, byAgent: {}, bySubsidiary: {} };
  let days = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    days += 1;
    for (const k of Object.keys(totals)) totals[k] += Number(d[k]) || 0;
    for (const dim of Object.keys(by)) {
      for (const [name, bucket] of Object.entries(d[dim] || {})) {
        if (!by[dim][name]) by[dim][name] = emptyBucket();
        for (const k of Object.keys(by[dim][name])) by[dim][name][k] += Number(bucket[k]) || 0;
      }
    }
  }

  const ref = db.collection(MONTHLY).doc(monthKey);
  const prior = await ref.get();
  const keep = prior.exists ? prior.data() : {};
  const cacheableInput = totals.inputTokens + totals.cacheReadTokens;
  await ref.set({
    ...round(totals),
    month: monthKey,
    days,
    cacheHitRate: cacheableInput > 0 ? totals.cacheReadTokens / cacheableInput : 0,
    successRate: totals.calls > 0 ? totals.okCalls / totals.calls : 0,
    byFeature: mapRound(by.byFeature),
    byModel: mapRound(by.byModel),
    byProvider: mapRound(by.byProvider),
    byAgent: mapRound(by.byAgent),
    bySubsidiary: mapRound(by.bySubsidiary),
    alertsFired: Array.isArray(keep.alertsFired) ? keep.alertsFired : [],
    ...(keep.budgetUsd != null ? { budgetUsd: keep.budgetUsd } : {}),
    updatedAt: nowIso,
  });
}

/**
 * Raise a budget alert to the admins through the one notice shape. The dedupe
 * key carries the period and the threshold, so the hourly rollup raises each
 * crossing ONCE per person.
 */
async function raiseBudgetAlert(db, { period, periodKey, threshold, spendUsd, budgetUsd }, deps = {}) {
  const { severityForThreshold } = require('../utils/aiPolicy');
  const { notifyAudience } = require('../lib/noticeDelivery');
  const dedupeKey = `ai-budget:${period}:${periodKey}:${threshold}`;
  const pct = Math.round((spendUsd / budgetUsd) * 100);
  try {
    await notifyAudience(db, {
      audience: { kind: 'role', role: 'admin' },
      type: 'ai.budget',
      title: `AI spend at ${pct}% of the ${period} budget`,
      message: `AI spend for ${periodKey} is $${spendUsd.toFixed(2)} of the $${budgetUsd.toFixed(2)} ${period} budget. See which features are driving it on the AI usage page.`,
      module: 'admin',
      entityType: 'ai_budget',
      entityId: periodKey,
      actionUrl: '/admin/ai-usage',
      priority: severityForThreshold(threshold),
      source: 'ai-usage-rollup',
      dedupeKey,
      metadata: { period, periodKey, threshold, spendUsd, budgetUsd },
    }, deps);
    return dedupeKey;
  } catch (err) {
    console.error('[aiUsageRollup] failed to raise budget alert', err && err.message);
    return null;
  }
}

/** Compare spend against the daily and monthly budgets and raise what is newly crossed. */
async function checkBudgets(db, dayKeyStr, deps = {}) {
  const { getAiPolicy, thresholdsCrossed } = require('../utils/aiPolicy');
  const policy = await getAiPolicy({ db });
  const monthKey = dayKeyStr.slice(0, 7);
  const periods = [
    { period: 'daily', key: dayKeyStr, collection: DAILY, budget: policy.dailyBudgetUsd },
    { period: 'monthly', key: monthKey, collection: MONTHLY, budget: policy.monthlyBudgetUsd },
  ];
  const raised = [];
  for (const p of periods) {
    if (!p.budget) continue;
    const ref = db.collection(p.collection).doc(p.key);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const data = snap.data() || {};
    const crossed = thresholdsCrossed(data.costUsd || 0, p.budget, policy.alertThresholds, data.alertsFired || []);
    if (!crossed.length) continue;
    for (const threshold of crossed) {
      await raiseBudgetAlert(db, { period: p.period, periodKey: p.key, threshold, spendUsd: data.costUsd || 0, budgetUsd: p.budget }, deps);
      raised.push({ period: p.period, periodKey: p.key, threshold });
    }
    await ref.update({ alertsFired: [...new Set([...(data.alertsFired || []), ...crossed])], budgetUsd: p.budget });
  }
  return raised;
}

module.exports = {
  aggregateUsageRows,
  checkBudgets,
  raiseBudgetAlert,
  rollupDay,
  rollupMonth,
  dayKey,
  DIMENSIONS,
  MAX_ROWS_PER_DAY,
  EVENTS,
  DAILY,
  MONTHLY,
};
