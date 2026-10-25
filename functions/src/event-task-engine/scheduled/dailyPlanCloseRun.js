/**
 * 20:00 Africa/Nairobi — close the day.
 *
 * Every plan for today that is still open is closed. Items the person left
 * blank are resolved from the live task (closed task → done, open → carried,
 * blocked → blocked); their own disposition always wins. A plan for a day the
 * person does not work, left unwrapped, closes as a non-working day and
 * carries nothing.
 *
 * Then tomorrow's untouched system drafts are re-drafted from the carry-overs
 * just finalised — a wrap-up filed after 17:00 would otherwise never shape
 * the next day, although the dialog promised carried items would lead it.
 */

const { toMillis } = require('../lib/taskModel');
const { dateKey } = require('../lib/taskRanking');
const { PLANS_COLLECTION, isWorkDay, resolveOutcome } = require('../lib/dailyPlan');
const { loadDirectory } = require('../lib/peopleDirectory');
const { fetchPlansForDate, fetchTaskStates } = require('../lib/dailyPlanData');
const { draftPlans } = require('../lib/dailyPlanDraft');

async function runDailyPlanClose(db, { now = Date.now(), logger = console } = {}) {
  const nowMs = toMillis(now) ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const key = dateKey(nowMs);

  const directory = await loadDirectory(db);
  const plans = (await fetchPlansForDate(db, key)).filter((p) => p.status !== 'closed');

  let closed = 0;
  let nonWorkingDayClosed = 0;
  let carriedItems = 0;
  for (const plan of plans) {
    const ref = db.collection(PLANS_COLLECTION).doc(plan.id);
    const person = directory.get(plan.assigneeUid);
    const wrappedUp = Boolean(plan.wrapUp && plan.wrapUp.at);

    if (!wrappedUp && !isWorkDay(key, person && person.workDays)) {
      await ref.update({
        status: 'closed',
        nonWorkingDay: true,
        wrapUp: { carriedTaskIds: [], closedBy: 'system:non-working-day' },
        closedAt: nowIso,
        updatedAt: nowIso,
      });
      nonWorkingDayClosed++;
      continue;
    }

    const items = Array.isArray(plan.items) ? plan.items : [];
    const states = await fetchTaskStates(db, items.map((i) => i.taskId));
    const resolvedItems = items.map((item) => {
      const live = states.get(item.taskId);
      const taskStatus = live === null ? 'missing' : live ? live.status : undefined;
      const outcome = resolveOutcome(item.outcome, taskStatus);
      return item.outcome === outcome ? item : { ...item, outcome, outcomeAt: item.outcomeAt || nowIso, outcomeInferred: true };
    });
    const carriedTaskIds = resolvedItems.filter((i) => i.outcome === 'carried' || i.outcome === 'blocked').map((i) => i.taskId);
    carriedItems += carriedTaskIds.length;

    await ref.update({
      items: resolvedItems,
      status: 'closed',
      closedAt: nowIso,
      wrapUp: {
        ...(plan.wrapUp || {}),
        carriedTaskIds,
        closedBy: wrappedUp ? plan.wrapUp.closedBy || 'staff' : 'system:daily-plan-close',
      },
      updatedAt: nowIso,
    });
    closed++;
  }

  const redraft = await draftPlans(db, { now: nowMs, refreshOnly: true, directory });

  const summary = { date: key, closed, nonWorkingDayClosed, carriedItems, redrafted: redraft.written };
  logger.info('[dailyPlanClose] Done', summary);
  return summary;
}

module.exports = { runDailyPlanClose };
