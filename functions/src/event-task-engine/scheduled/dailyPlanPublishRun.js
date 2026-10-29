/**
 * 06:00 Africa/Nairobi — publish today's plans.
 *
 *   1. Drafts → published. Plans nobody reviewed publish anyway, still flagged
 *      `reviewed: false` — staff must never open a blank day because a manager
 *      was travelling, but the gap has to be visible rather than silent.
 *      A system draft for someone's non-working day closes instead.
 *   2. Backfill anyone with open work but no plan (a task created after 17:00,
 *      or an evening run that failed), honouring carry-overs.
 *   3. "Your focus today" bell notice to each person.
 *
 * Idempotent: re-running publishes nothing twice and notifies nobody twice.
 */

const { toMillis } = require('../lib/taskModel');
const { dateKey } = require('../lib/taskRanking');
const { PLANS_COLLECTION, MAX_PLAN_ITEMS, planId, composePlanItems, dayStartMs, isWorkDay, isHumanOwned, carriedFrom } = require('../lib/dailyPlan');
const { loadDirectory, groupByAssignee } = require('../lib/peopleDirectory');
const { fetchOpenTasks, latestPlanBefore, fetchPlansForDate } = require('../lib/dailyPlanData');
const { notifyUser } = require('../lib/notices');
const { briefPlans } = require('../ai/dailyBrief');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MY_DAY_URL = '/tasks/today';

async function runDailyPlanPublish(db, { now = Date.now(), logger = console, getAnthropic = null } = {}) {
  const nowMs = toMillis(now) ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const key = dateKey(nowMs);
  const planDayStartMs = dayStartMs(key);

  const directory = await loadDirectory(db);

  // ── 1. Publish today's drafts ──────────────────────────────────────────
  const plans = new Map();
  let published = 0;
  let nonWorkingDayClosed = 0;
  for (const plan of await fetchPlansForDate(db, key)) {
    const ref = db.collection(PLANS_COLLECTION).doc(plan.id);
    const person = directory.get(plan.assigneeUid);
    if (plan.status === 'draft' && !isHumanOwned(plan) && !isWorkDay(key, person && person.workDays)) {
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
    if (plan.status === 'draft') {
      await ref.update({ status: 'published', publishedAt: nowIso, updatedAt: nowIso });
      plan.status = 'published';
      plan.publishedAt = nowIso;
      published++;
    }
    plans.set(plan.assigneeUid, plan);
  }

  // ── 2. Backfill anyone with open work but no plan ──────────────────────
  const tasks = await fetchOpenTasks(db);
  const byAssignee = groupByAssignee(tasks, directory);
  let backfilled = 0;
  for (const [assigneeUid, assigneeTasks] of byAssignee) {
    if (plans.has(assigneeUid)) continue;
    const person = directory.get(assigneeUid) || null;
    if (!isWorkDay(key, person && person.workDays)) continue;
    const prevPlan = await latestPlanBefore(db, assigneeUid, key);
    const items = composePlanItems(assigneeTasks, {
      now: nowMs,
      planDayStartMs,
      carriedTaskIds: carriedFrom(prevPlan),
      previousItems: (prevPlan && prevPlan.items) || [],
      limit: MAX_PLAN_ITEMS,
    });
    if (items.length === 0) continue;
    const plan = {
      date: key,
      assigneeUid,
      assigneeEmployeeId: (person && person.employeeId) || null,
      assigneeName: (person && person.name) || assigneeTasks[0].assignedToName || null,
      subsidiaryId: (person && person.subsidiaryId) || assigneeTasks[0].brandId || null,
      managerUid: (person && person.managerUid) || null,
      managerEmployeeId: (person && person.managerEmployeeId) || null,
      managerName: (person && person.managerName) || null,
      status: 'published',
      reviewed: false,
      source: 'system',
      items,
      generatedAt: nowIso,
      publishedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await db.collection(PLANS_COLLECTION).doc(planId(key, assigneeUid)).set(plan);
    plans.set(assigneeUid, { id: planId(key, assigneeUid), ...plan });
    backfilled++;
  }

  // ── 3. The morning brief (Phase 6.E PR 3) — only when an Anthropic key is
  // configured; otherwise the plans publish exactly as before. Best-effort.
  let briefs = 0;
  try {
    // The resolver is the FUNCTION, never a call: an eager `getAnthropic()`
    // here ran the Secret Manager lookup detached from the awaited path and
    // surfaced as an unhandled rejection once the run had returned.
    const resolver = typeof getAnthropic === 'function' ? getAnthropic : require('../../ai/_anthropic').getAnthropic;
    briefs = await briefPlans(db, [...plans.values()], { getAnthropic: resolver, logger, nowIso, todayKey: key });
  } catch (err) {
    logger.warn('[dailyPlanPublish] briefs skipped', { error: err.message });
  }

  // ── 4. Tell each person their day is ready ─────────────────────────────
  let notified = 0;
  let teams = new Set();
  let teamsReviewed = new Set();
  for (const plan of plans.values()) {
    if (plan.status !== 'published') continue;
    const count = (plan.items || []).length;
    if (plan.managerUid) {
      teams.add(plan.managerUid);
      if (plan.reviewed) teamsReviewed.add(plan.managerUid);
    }
    if (count === 0 || !plan.assigneeUid) continue;
    try {
      const ok = await notifyUser(db, {
        userId: plan.assigneeUid,
        type: 'daily_plan',
        title: 'Your focus today',
        message: plan.reviewed
          ? `${count} ${count === 1 ? 'item' : 'items'} · reviewed by ${plan.reviewedByName || plan.managerName || 'your manager'}`
          : `${count} ${count === 1 ? 'item' : 'items'} · auto-generated, not yet reviewed`,
        entityType: 'daily_plan',
        entityId: plan.id || planId(key, plan.assigneeUid),
        actionUrl: MY_DAY_URL,
        priority: 'medium',
        dedupeKey: `daily_plan:${key}`,
        // Gone from the bell once the day is over: yesterday's focus list is not today's news.
        expiresAt: new Date(planDayStartMs + MS_PER_DAY).toISOString(),
      }, { nowIso });
      if (ok) notified++;
    } catch (err) {
      logger.warn('[dailyPlanPublish] assignee notice failed', { assigneeUid: plan.assigneeUid, error: err.message });
    }
  }

  const summary = {
    date: key, people: plans.size, published, backfilled, nonWorkingDayClosed, notified, briefs,
    teamsReviewed: `${teamsReviewed.size}/${teams.size}`,
  };
  logger.info('[dailyPlanPublish] Done', summary);
  return summary;
}

module.exports = { runDailyPlanPublish, MY_DAY_URL };
