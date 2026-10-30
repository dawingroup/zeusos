/**
 * Stale-task sweep — 02:30 Africa/Nairobi. Cancels the dead tail under the
 * rules in lib/staleTaskPolicy.js: never approvals, never anything a person
 * engaged with, never a person's own task. Write shape mirrors the auto-close
 * (`closedBy: 'system:stale-sweep'`), so the re-open policy knows it was the
 * system.
 */

const { TASKS_COLLECTION, toMillis } = require('../lib/taskModel');
const { classifyStaleTask } = require('../lib/staleTaskPolicy');
const { closeTask } = require('../lib/taskAutoClose');

const RUN_LIMIT = 500;

async function runStaleTaskSweep(db, { now = Date.now(), enabled = true, logger = console } = {}) {
  const nowMs = toMillis(now) ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const summary = { enabled, scanned: 0, cancelled: 0, wouldCancel: 0, byReason: {}, errors: 0 };
  const cache = new Map();

  const snaps = await Promise.all(
    ['assigned', 'pending'].map((status) => db.collection(TASKS_COLLECTION).where('status', '==', status).limit(RUN_LIMIT).get()),
  );
  const seen = new Set();
  for (const snap of snaps) {
    for (const taskSnap of snap.docs) {
      if (seen.has(taskSnap.id)) continue;
      seen.add(taskSnap.id);
      summary.scanned += 1;
      const task = { id: taskSnap.id, ...taskSnap.data() };
      try {
        const reason = await classifyStaleTask(db, task, nowMs, cache);
        if (!reason) continue;
        summary.byReason[reason] = (summary.byReason[reason] || 0) + 1;
        if (!enabled) {
          summary.wouldCancel += 1;
          continue;
        }
        await closeTask(db, taskSnap, { status: 'cancelled', outcome: 'cancelled', reason, closedBy: 'system:stale-sweep', nowIso });
        summary.cancelled += 1;
      } catch (err) {
        summary.errors += 1;
        logger.warn(`[staleSweep] task ${taskSnap.id} failed`, { error: err.message });
      }
    }
  }
  logger.info('[staleSweep] Done', summary);
  return summary;
}

module.exports = { runStaleTaskSweep };
