/**
 * Firestore reads shared by the daily-plan runs. Pure data access: no function
 * definitions, no side effects at import, `db` passed in.
 */

const { TASKS_COLLECTION, ACTIVE_STATUSES, dueMsOf } = require('./taskModel');
const { PLANS_COLLECTION, planId, addDays } = require('./dailyPlan');

const CANDIDATE_LIMIT = 500;

/**
 * Open tasks on a person, worth planning. Firestore allows one `in` clause per
 * query and the stub sorts in memory, so this runs one query per status and
 * sorts the union by due date here (undated last).
 */
async function fetchOpenTasks(db) {
  const seen = new Map();
  for (const status of ACTIVE_STATUSES) {
    const snap = await db
      .collection(TASKS_COLLECTION)
      .where('status', '==', status)
      .limit(CANDIDATE_LIMIT)
      .get();
    for (const d of snap.docs) seen.set(d.id, { id: d.id, ...d.data() });
  }
  return [...seen.values()].sort((a, b) => {
    const da = dueMsOf(a);
    const dbm = dueMsOf(b);
    if (da === dbm) return 0;
    if (da == null) return 1;
    if (dbm == null) return -1;
    return da - dbm;
  });
}

/**
 * The plan to carry over FROM: the person's most recent plan before
 * `planDate`, looking back up to a week. "Yesterday" is wrong across a weekend
 * — Monday's plan must carry Friday's unfinished work. A plan closed as a
 * non-working day carries nothing and is skipped.
 */
async function latestPlanBefore(db, assigneeUid, planDate, { maxDays = 7 } = {}) {
  const keys = Array.from({ length: maxDays }, (_, i) => addDays(planDate, -(i + 1)));
  const snaps = await Promise.all(keys.map((k) => db.collection(PLANS_COLLECTION).doc(planId(k, assigneeUid)).get()));
  for (const snap of snaps) {
    if (!snap.exists) continue;
    const plan = snap.data();
    if (plan.nonWorkingDay) continue;
    return { id: snap.id, ...plan };
  }
  return null;
}

/** Every plan for one date. */
async function fetchPlansForDate(db, date) {
  const snap = await db.collection(PLANS_COLLECTION).where('date', '==', date).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** The live status of each task id (missing → 'missing'). Point reads; a plan holds ≤ 7. */
async function fetchTaskStates(db, taskIds) {
  const out = new Map();
  const unique = [...new Set(taskIds.filter(Boolean))];
  const snaps = await Promise.all(unique.map((id) => db.collection(TASKS_COLLECTION).doc(id).get()));
  snaps.forEach((snap, i) => {
    out.set(unique[i], snap.exists ? { id: snap.id, ...snap.data() } : null);
  });
  return out;
}

module.exports = {
  CANDIDATE_LIMIT,
  fetchOpenTasks,
  latestPlanBefore,
  fetchPlansForDate,
  fetchTaskStates,
};
