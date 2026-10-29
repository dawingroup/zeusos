/**
 * The task engine's clock — Phase 6.E (Daily Plan + task hardening).
 *
 *   06:00  dailyPlanPublishRun   publish today's plans, backfill, "Your focus today"
 *   17:00  dailyPlanDraftRun     draft tomorrow, file + pin the manager's review
 *   20:00  dailyPlanCloseRun     close the day, re-draft tomorrow from the wrap-ups
 *   02:30  staleTaskSweep        cancel the dead tail (never work)
 *   :00/:30 taskHygieneRun       owners for pending work · auto-close · escalation · reminders
 *
 * All Africa/Nairobi, region europe-west1. `taskEngineRunNow` lets an admin
 * run any of them on demand (verification, or right after a bulk change).
 */

const admin = require('firebase-admin');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

const { requireAdminCaller } = require('../lib/callerAuth');
const { runDailyPlanDraft } = require('./dailyPlanDraftRun');
const { runDailyPlanPublish } = require('./dailyPlanPublishRun');
const { runDailyPlanClose } = require('./dailyPlanCloseRun');
const { runTaskHygiene } = require('./taskHygieneRun');
const { runStaleTaskSweep } = require('./staleTaskSweep');

if (!admin.apps.length) admin.initializeApp();

const REGION = 'europe-west1';
const TIME_ZONE = 'Africa/Nairobi';
const OPTS = (schedule, memory = '512MiB') => ({ schedule, timeZone: TIME_ZONE, region: REGION, timeoutSeconds: 540, memory });

const RUNS = {
  publish: (db, o) => runDailyPlanPublish(db, o),
  draft: (db, o) => runDailyPlanDraft(db, o),
  close: (db, o) => runDailyPlanClose(db, o),
  hygiene: (db, o) => runTaskHygiene(db, o),
  stale: (db, o) => runStaleTaskSweep(db, o),
};

function scheduled(name, schedule, run) {
  return onSchedule(OPTS(schedule), async () => {
    try {
      await run(admin.firestore(), { now: Date.now(), logger });
    } catch (err) {
      logger.error(`[${name}] Top-level run failed`, err);
      throw err;
    }
  });
}

const dailyPlanPublishRun = scheduled('dailyPlanPublish', '0 6 * * *', RUNS.publish);
const dailyPlanDraftRun = scheduled('dailyPlanDraft', '0 17 * * *', RUNS.draft);
const dailyPlanCloseRun = scheduled('dailyPlanClose', '0 20 * * *', RUNS.close);
const staleTaskSweep = scheduled('staleSweep', '30 2 * * *', RUNS.stale);
const taskHygieneRun = scheduled('taskHygiene', '*/30 * * * *', RUNS.hygiene);

/** Admin-only: { run: 'publish'|'draft'|'close'|'hygiene'|'stale', now?: ISO } */
const taskEngineRunNow = onCall({ region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async (request) => {
  await requireAdminCaller(request, 'run a task-engine job');
  const run = request.data && request.data.run;
  if (!RUNS[run]) throw new HttpsError('invalid-argument', `run must be one of ${Object.keys(RUNS).join(', ')}`);
  const at = request.data.now ? Date.parse(request.data.now) : Date.now();
  if (Number.isNaN(at)) throw new HttpsError('invalid-argument', 'now must be an ISO timestamp');
  try {
    const summary = await RUNS[run](admin.firestore(), { now: at, logger });
    return { ok: true, run, summary };
  } catch (err) {
    logger.error(`[taskEngineRunNow] ${run} failed`, err);
    throw new HttpsError('internal', (err && err.message) || `${run} failed`);
  }
});

module.exports = {
  dailyPlanPublishRun,
  dailyPlanDraftRun,
  dailyPlanCloseRun,
  staleTaskSweep,
  taskHygieneRun,
  taskEngineRunNow,
  RUNS,
};
