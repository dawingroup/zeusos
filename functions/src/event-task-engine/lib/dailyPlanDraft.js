/**
 * Composing a day's focus plans — shared by the 17:00 draft run and the 20:00
 * close run (which re-drafts tomorrow's untouched system drafts once the
 * day's wrap-ups are final, `refreshOnly`).
 *
 * A plan a manager has shaped (`source: 'manager'`) or reviewed is NEVER
 * rewritten by either caller.
 */

const { MAX_PLAN_ITEMS, PLANS_COLLECTION, planId, composePlanItems, dayStartMs, nextWorkDay, carriedFrom, draftDecision } = require('./dailyPlan');
const { dateKey } = require('./taskRanking');
const { loadDirectory, groupByAssignee, nameFor } = require('./peopleDirectory');
const { fetchOpenTasks, latestPlanBefore } = require('./dailyPlanData');

/**
 * Draft each person's NEXT WORKING DAY (from their workSchedule.workDays),
 * carrying over from their most recent plan. On a Friday that is Monday for
 * office staff.
 *
 * `refreshOnly`: touch only plans that already exist as untouched system
 * DRAFTS (the 20:00 re-draft). It never creates a plan — the 06:00 publish
 * backfills anyone still without one.
 *
 * Returns { written, skippedManagerOwned, managerBuckets, candidates }.
 * managerBuckets is `${managerUid}|${planDate}` -> { managerUid, planDate,
 * record, people: [] } for every person with work: one review per manager
 * per plan date.
 */
async function draftPlans(db, { now, refreshOnly = false, directory: dir = null, tasks: taskList = null }) {
  const nowIso = new Date(now).toISOString();
  const todayKey = dateKey(now);
  const [tasks, directory] = await Promise.all([taskList || fetchOpenTasks(db), dir || loadDirectory(db)]);

  const byAssignee = groupByAssignee(tasks, directory);

  const managerBuckets = new Map();
  let written = 0;
  let skippedManagerOwned = 0;

  for (const [assigneeUid, assigneeTasks] of byAssignee) {
    const person = directory.get(assigneeUid) || null;
    const planDate = nextWorkDay(todayKey, person && person.workDays);
    const ref = db.collection(PLANS_COLLECTION).doc(planId(planDate, assigneeUid));

    const [existingSnap, prevPlan] = await Promise.all([ref.get(), latestPlanBefore(db, assigneeUid, planDate)]);
    const existing = existingSnap.exists ? existingSnap.data() : null;
    const decision = draftDecision(existing, refreshOnly);

    if (decision === 'human_owned') {
      skippedManagerOwned++;
    } else if (decision === 'write') {
      const items = composePlanItems(assigneeTasks, {
        now,
        planDayStartMs: dayStartMs(planDate),
        carriedTaskIds: carriedFrom(prevPlan),
        previousItems: (prevPlan && prevPlan.items) || [],
        limit: MAX_PLAN_ITEMS,
      });
      if (items.length === 0) continue;

      const base = {
        date: planDate,
        assigneeUid,
        assigneeEmployeeId: (person && person.employeeId) || null,
        assigneeName: (person && person.name) || assigneeTasks[0].assignedToName || null,
        subsidiaryId: (person && person.subsidiaryId) || assigneeTasks[0].brandId || null,
        managerUid: (person && person.managerUid) || null,
        managerEmployeeId: (person && person.managerEmployeeId) || null,
        managerName: (person && person.managerName) || null,
        status: 'draft',
        reviewed: false,
        source: 'system',
        items,
        generatedAt: nowIso,
        updatedAt: nowIso,
      };
      if (existing) await ref.update(base);
      else await ref.set({ ...base, createdAt: nowIso });
      written++;
    }

    const managerUid = person && person.managerUid;
    if (!managerUid || managerUid === assigneeUid) continue;
    const bucketKey = `${managerUid}|${planDate}`;
    const bucket = managerBuckets.get(bucketKey) || {
      managerUid,
      planDate,
      record: directory.get(managerUid) || null,
      people: [],
    };
    bucket.people.push((person && person.name) || nameFor(directory, assigneeUid) || assigneeUid);
    managerBuckets.set(bucketKey, bucket);
  }

  return { written, skippedManagerOwned, managerBuckets, candidates: tasks.length, directory };
}

module.exports = { draftPlans };
