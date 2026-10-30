/**
 * AI usage rollup — the two scheduled jobs (europe-west1). Hourly recomputes
 * TODAY so the page is never more than an hour stale and checks the budgets;
 * nightly recomputes YESTERDAY once it can no longer change. Both are full
 * recomputes, so a re-run is idempotent. The maths is in rollupCore.js.
 */

const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const core = require('./rollupCore');

if (!admin.apps.length) admin.initializeApp();

const OPTS = (schedule) => ({ schedule, timeZone: 'UTC', region: 'europe-west1', timeoutSeconds: 540, memory: '512MiB' });

const aiUsageRollupHourly = onSchedule(OPTS('every 60 minutes'), async () => {
  const db = admin.firestore();
  const { key, metrics } = await core.rollupDay(db, new Date());
  const raised = await core.checkBudgets(db, key);
  logger.info('[aiUsageRollup] today rolled up', { date: key, calls: metrics.calls, costUsd: metrics.costUsd, wasteCostUsd: metrics.wasteCostUsd, cacheHitRate: metrics.cacheHitRate, alertsRaised: raised.length });
});

const aiUsageRollupDaily = onSchedule(OPTS('30 1 * * *'), async () => {
  const db = admin.firestore();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { key, metrics } = await core.rollupDay(db, yesterday);
  logger.info('[aiUsageRollup] yesterday finalised', { date: key, calls: metrics.calls, costUsd: metrics.costUsd });
});

module.exports = { aiUsageRollupHourly, aiUsageRollupDaily };
