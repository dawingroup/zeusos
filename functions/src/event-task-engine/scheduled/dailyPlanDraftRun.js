/**
 * 17:00 Africa/Nairobi — draft tomorrow's focus plan for everyone with open
 * work and ask each manager to review their team's plans.
 *
 *   1. draftPlans: one plan per person for their next working day, carrying
 *      over what the last plan left unfinished (lib/dailyPlanDraft.js).
 *   2. One "Review tomorrow's plan for your team" task per manager, at a
 *      deterministic id — re-running never files a second one.
 *   3. Earlier review tasks for that manager are closed as superseded.
 *   4. The review is PINNED first on the manager's own plan for today: by the
 *      next run it would be one P1 task among many and never rank.
 *   5. A bell notice to the manager.
 *
 * Pure run function; the onSchedule wrapper lives in scheduled/index.js.
 */

const { TASKS_COLLECTION, OPEN_STATUSES, ASSIGNED_STATUS, historyEntry, systemCloseFields, toMillis } = require('../lib/taskModel');
const { dateKey, EAT_OFFSET_MS } = require('../lib/taskRanking');
const {
  PLANS_COLLECTION, planId, dayStartMs, reviewDayLabel, reviewTaskId,
  buildPinnedReviewItem, canPinReview, withPinnedReview, isSupersededReview,
} = require('../lib/dailyPlan');
const { draftPlans } = require('../lib/dailyPlanDraft');
const { notifyUser } = require('../lib/notices');
const { TEAM_PLAN_URL } = require('../lib/taskNotice');

const MS_PER_HOUR = 60 * 60 * 1000;

/** 18:30 Nairobi on `todayKey`, as ISO — the review is due before the evening ends. */
function reviewDueIso(todayKey) {
  return new Date(dayStartMs(todayKey) + 18.5 * MS_PER_HOUR).toISOString();
}

async function fileReviewTask(db, bucket, { todayKey, nowIso }) {
  const { managerUid, planDate, people, record } = bucket;
  const taskId = reviewTaskId(managerUid, planDate);
  const ref = db.collection(TASKS_COLLECTION).doc(taskId);
  const existing = await ref.get();
  if (existing.exists) return false;
  const n = people.length;
  const label = reviewDayLabel(planDate, todayKey);
  await ref.set({
    id: taskId,
    title: `Review ${label} plan for your team (${n} ${n === 1 ? 'person' : 'people'})`,
    description:
      `${people.slice(0, 8).join(', ')}${n > 8 ? ` and ${n - 8} more` : ''} ` +
      `${n === 1 ? 'has' : 'have'} a drafted plan for ${planDate}. Shape each one — order, timebox, ` +
      'day goal — and mark it reviewed. What you mark reviewed is what they open to at 06:00.',
    priority: 'P1',
    status: ASSIGNED_STATUS,
    kind: 'review',
    dueAt: reviewDueIso(todayKey),
    assignedToUserId: managerUid,
    assignedToName: (record && record.name) || null,
    assignedAt: nowIso,
    assignedBy: 'system:daily-plan-draft',
    pendingAssignmentRule: null,
    entityType: 'daily_plan_review',
    entityId: planDate,
    entityName: `${label} team plan`,
    sourceModule: 'daily_plan',
    source: 'system',
    brandId: (record && record.subsidiaryId) || null,
    planDate,
    teamSize: n,
    history: [historyEntry({ fromStatus: null, toStatus: ASSIGNED_STATUS, actorUserId: 'system:daily-plan-draft', notes: 'evening plan review', nowIso })],
    idempotencyKey: taskId,
    createdBy: 'system:daily-plan-draft',
    createdAt: nowIso,
    updatedAt: nowIso,
  });
  return true;
}

/** Yesterday's review for the same manager is moot once today's plans are drafted. */
async function closeSupersededReviews(db, managerUid, planDate, nowIso) {
  const currentId = reviewTaskId(managerUid, planDate);
  const snap = await db
    .collection(TASKS_COLLECTION)
    .where('assignedToUserId', '==', managerUid)
    .where('entityType', '==', 'daily_plan_review')
    .where('status', 'in', [...OPEN_STATUSES])
    .get();
  let closed = 0;
  for (const d of snap.docs) {
    const task = d.data();
    if (!isSupersededReview(d.id, task.entityId, currentId, planDate)) continue;
    await d.ref.update(systemCloseFields(task, {
      status: 'completed',
      outcome: 'completed',
      reason: 'superseded_by_newer_review',
      closedBy: 'system:daily-plan-draft',
      nowIso,
    }));
    closed++;
  }
  return closed;
}

/**
 * Put the review first on the manager's plan for TODAY — inside a
 * transaction, through canPinReview, so a wrap-up saved in between is seen
 * rather than overwritten.
 */
async function pinReviewOntoManagerPlan(db, bucket, { todayKey, nowIso }) {
  const ref = db.collection(PLANS_COLLECTION).doc(planId(todayKey, bucket.managerUid));
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const plan = snap.data();
    if (!canPinReview(plan)) return false;
    const pinned = buildPinnedReviewItem(bucket.managerUid, bucket.planDate, bucket.people.length, todayKey);
    tx.update(ref, { items: withPinnedReview(plan.items, pinned), updatedAt: nowIso });
    return true;
  });
}

async function runDailyPlanDraft(db, { now = Date.now(), logger = console } = {}) {
  const nowMs = toMillis(now) ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const todayKey = dateKey(nowMs);

  const { written, skippedManagerOwned, managerBuckets, candidates } = await draftPlans(db, { now: nowMs });

  let reviewsFiled = 0;
  let alreadyRequested = 0;
  let supersededClosed = 0;
  let pinned = 0;
  let notified = 0;
  for (const bucket of managerBuckets.values()) {
    try {
      const isNew = await fileReviewTask(db, bucket, { todayKey, nowIso });
      if (!isNew) {
        alreadyRequested++;
        continue;
      }
      reviewsFiled++;
      supersededClosed += await closeSupersededReviews(db, bucket.managerUid, bucket.planDate, nowIso);
      if (await pinReviewOntoManagerPlan(db, bucket, { todayKey, nowIso })) pinned++;
      const n = bucket.people.length;
      const ok = await notifyUser(db, {
        userId: bucket.managerUid,
        type: 'daily_plan_review',
        title: `Review ${reviewDayLabel(bucket.planDate, todayKey)} plan for your team`,
        message: `${n} ${n === 1 ? 'person has' : 'people have'} a drafted plan: ${bucket.people.slice(0, 5).join(', ')}${n > 5 ? '…' : ''}`,
        entityType: 'daily_plan_review',
        entityId: bucket.planDate,
        actionUrl: TEAM_PLAN_URL,
        priority: 'high',
        dedupeKey: `daily_plan_review:${bucket.managerUid}:${bucket.planDate}`,
        expiresAt: new Date(dayStartMs(bucket.planDate) + 6 * MS_PER_HOUR).toISOString(),
      }, { nowIso });
      if (ok) notified++;
    } catch (err) {
      logger.warn('[dailyPlanDraft] manager review failed', { managerUid: bucket.managerUid, error: err.message });
    }
  }

  const summary = {
    date: todayKey, candidates, written, skippedManagerOwned,
    managers: managerBuckets.size, reviewsFiled, alreadyRequested, supersededClosed, pinned, notified,
  };
  logger.info('[dailyPlanDraft] Done', summary);
  return summary;
}

module.exports = { runDailyPlanDraft, fileReviewTask, closeSupersededReviews, pinReviewOntoManagerPlan, reviewDueIso, EAT_OFFSET_MS };
