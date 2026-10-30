/**
 * Daily plan composition — PURE helpers shared by the evening draft run, the
 * morning publish run and the close run.
 *
 * A daily plan is the day's CONTRACT for one person: a short, ordered list of
 * work they are expected to land, reviewed by their manager the evening
 * before. It is deliberately NOT the inbox — capped at MAX_PLAN_ITEMS so the
 * list means something.
 *
 * Nothing here touches Firestore, so __tests__/event-task-engine/dailyPlan.test.js
 * pins the composition rules (carry-over precedence, cap, exclusions) directly.
 *
 * Ported from DawinOS functions/src/lib/dailyPlan.js; re-pointed at ZeusOS's
 * task shape (`dueAt` ISO, P0–P3, `assignedToUserId`) and Africa/Nairobi.
 */

const { normalisePriority, dueMsOf, toMillis } = require('./taskModel');
const { scoreTask, isPlannableTask, MS_PER_DAY, EAT_OFFSET_MS } = require('./taskRanking');

const PLANS_COLLECTION = 'daily_plans';
const MAX_PLAN_ITEMS = 7;

/** Deterministic doc id: one plan per (date, person), so writes are point ops. */
function planId(date, assigneeUid) {
  return `${date}_${assigneeUid}`;
}

/**
 * Why an item is on the plan. Order matters — `FOCUS_REASON_RANK` drives the
 * default ordering before the score is used as a tie-breaker, so work that was
 * promised yesterday and slipped comes first and cannot quietly fall off.
 */
const FOCUS_REASON_RANK = Object.freeze({
  carry_over: 0,
  overdue: 1,
  manager_pick: 2,
  due_today: 3,
  auto_rank: 4,
});

/**
 * Classify a task for a given plan date.
 * @param {object} task
 * @param {number} planDayStartMs — midnight Nairobi of the plan date, epoch ms
 * @param {Set<string>} carriedIds — task ids carried over from the last plan
 */
function focusReasonFor(task, planDayStartMs, carriedIds) {
  if (carriedIds && carriedIds.has(task.id)) return 'carry_over';
  const due = dueMsOf(task);
  if (due != null && due < planDayStartMs) return 'overdue';
  if (due != null && due < planDayStartMs + MS_PER_DAY) return 'due_today';
  return 'auto_rank';
}

/**
 * Compose the ordered item list for one person's plan.
 *
 * @param {object[]} tasks — that person's candidate open tasks
 * @param {object} opts
 * @param {number} opts.now — epoch ms, used for scoring
 * @param {number} opts.planDayStartMs — midnight Nairobi of the plan date
 * @param {string[]} [opts.carriedTaskIds] — from yesterday's wrap-up
 * @param {object[]} [opts.previousItems] — the last plan's items, for "where you left it"
 * @param {number} [opts.limit]
 */
function composePlanItems(tasks, { now, planDayStartMs, carriedTaskIds = [], previousItems = [], limit = MAX_PLAN_ITEMS }) {
  const carried = new Set(carriedTaskIds);
  const prevById = new Map((previousItems || []).filter((i) => i && i.taskId).map((i) => [i.taskId, i]));
  const seen = new Set();
  const ranked = (tasks || [])
    .filter((t) => {
      if (!isPlannableTask(t) || !t.id || seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    })
    .map((t) => ({
      task: t,
      reason: focusReasonFor(t, planDayStartMs, carried),
      score: scoreTask(t, now),
    }))
    .sort((a, b) => {
      const ra = FOCUS_REASON_RANK[a.reason] ?? 9;
      const rb = FOCUS_REASON_RANK[b.reason] ?? 9;
      if (ra !== rb) return ra - rb;
      return b.score - a.score;
    })
    .slice(0, limit);

  return ranked.map((r, i) => planItemFromTask(r.task, i, r.reason, prevById.get(r.task.id)));
}

// ─── Focus card copy ─────────────────────────────────────────────────────────
// The focus card's "Now" block says WHY an item is on today's list and WHERE
// the person left it. Both are built only from facts already on the task or
// the last plan — never invented. No fact → no field → the card hides the row.

const MAX_NOTE_CHARS = 240;

function clean(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim().replace(/\s+/g, ' ');
  if (!t) return null;
  return t.length > MAX_NOTE_CHARS ? `${t.slice(0, MAX_NOTE_CHARS - 1)}…` : t;
}

/** The record the task is about, as people name it (an IWO code, a job name). */
function entityRefFor(task) {
  return clean(task.entityName) || clean(task.masterJobName) || clean(task.iwoCode);
}

/** The concrete reason today matters — the AI enrichment's urgency reason. */
function whyTodayFor(task) {
  return clean(task.aiUrgencyReason);
}

/** "Fri 16:40", Nairobi time. */
function nairobiStamp(ms) {
  return new Date(ms).toLocaleString('en-GB', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Nairobi',
  });
}

/**
 * Where the person left it: their own note from the last plan, else what the
 * task itself records (checklist progress, a blocked reason, when it started).
 */
function resumeNoteFor(task, prevItem) {
  const note = prevItem ? clean(prevItem.outcomeNote) : null;
  if (note) return prevItem.outcome === 'blocked' ? `Blocked last time: ${note}` : `Your note: ${note}`;
  const steps = Array.isArray(task.checklistItems) ? task.checklistItems.filter(Boolean) : [];
  const doneSteps = steps.filter((c) => c.completed === true).length;
  if (steps.length > 0 && doneSteps > 0) {
    return `${doneSteps} of ${steps.length} checklist ${steps.length === 1 ? 'step' : 'steps'} done.`;
  }
  const blockedReason = clean(task.blockedReason);
  if (task.status === 'blocked' && blockedReason) return `Marked blocked: ${blockedReason}`;
  if (task.status === 'in_progress') {
    const started = toMillis(task.startedAt);
    return started ? `In progress since ${nairobiStamp(started)}.` : 'In progress.';
  }
  return null;
}

/**
 * Denormalise a task into a plan item. Titles/priorities are copied so the
 * focus card renders from ONE doc read; the live task is still the source of
 * truth for status (the UI hydrates it). Never writes an undefined field —
 * Firestore rejects one and names no field.
 */
function planItemFromTask(task, order, focusReason = 'manager_pick', prevItem = null) {
  const item = {
    taskId: task.id,
    order,
    title: task.title || 'Task',
    priority: normalisePriority(task.priority),
    focusReason,
  };
  const dueMs = dueMsOf(task);
  if (dueMs != null) item.dueAt = new Date(dueMs).toISOString();
  if (task.kind) item.kind = task.kind;
  if (task.sourceModule) item.sourceModule = task.sourceModule;
  if (task.entityType) item.entityType = task.entityType;
  if (task.entityId) item.entityId = task.entityId;
  if (task.masterJobId) item.masterJobId = task.masterJobId;
  if (task.iwoId) item.iwoId = task.iwoId;
  if (task.brandId) item.brandId = task.brandId;
  if (task.estimateMinutes) item.timeboxMinutes = task.estimateMinutes;
  const entityRef = entityRefFor(task);
  if (entityRef) item.entityRef = entityRef;
  const whyToday = whyTodayFor(task);
  if (whyToday) item.whyToday = whyToday;
  const resumeNote = resumeNoteFor(task, prevItem);
  if (resumeNote) item.resumeNote = resumeNote;
  return item;
}

/** Midnight Nairobi for a 'YYYY-MM-DD' key, as epoch ms (UTC+3, no DST — exact). */
function dayStartMs(dateKeyStr) {
  return Date.parse(`${dateKeyStr}T00:00:00.000Z`) - EAT_OFFSET_MS;
}

// ─── Working days ────────────────────────────────────────────────────────────
// Plans are for the days a person works (employees.workSchedule.workDays).

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DEFAULT_WORK_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

/** A 'YYYY-MM-DD' key moved by n calendar days. */
function addDays(dateKeyStr, n) {
  const [y, m, d] = dateKeyStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 'monday'…'sunday' for a calendar date key (timezone-free). */
function weekdayOf(dateKeyStr) {
  const [y, m, d] = dateKeyStr.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** A person's work days, falling back to Monday–Friday when unset or unusable. */
function workDaysOf(workDays) {
  const days = Array.isArray(workDays)
    ? workDays.map((w) => String(w).toLowerCase()).filter((w) => WEEKDAYS.includes(w))
    : [];
  return days.length > 0 ? days : DEFAULT_WORK_DAYS;
}

function isWorkDay(dateKeyStr, workDays) {
  return workDaysOf(workDays).includes(weekdayOf(dateKeyStr));
}

/** The first date AFTER `fromKey` that is one of the person's work days. */
function nextWorkDay(fromKey, workDays) {
  for (let i = 1; i <= 7; i++) {
    const candidate = addDays(fromKey, i);
    if (isWorkDay(candidate, workDays)) return candidate;
  }
  return addDays(fromKey, 1);
}

/** How the review names the day it is for: "tomorrow's", or "Monday's". */
function reviewDayLabel(planDate, todayKey) {
  if (!todayKey || planDate === addDays(todayKey, 1)) return "tomorrow's";
  const day = weekdayOf(planDate);
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}'s`;
}

// ─── The manager's pinned review ─────────────────────────────────────────────

function reviewTaskId(managerUid, planDate) {
  return `daily-plan-review:${managerUid}:${planDate}`;
}

/**
 * The pinned review row for a manager's own focus plan. Pure so the shape can
 * be pinned by a test: a plan item with an `undefined` field is rejected.
 */
function buildPinnedReviewItem(managerUid, planDate, teamSize, todayKey) {
  return {
    taskId: reviewTaskId(managerUid, planDate),
    order: 0,
    title: `Review ${reviewDayLabel(planDate, todayKey)} plan for your team (${teamSize} ${teamSize === 1 ? 'person' : 'people'})`,
    priority: 'P1',
    focusReason: 'manager_pick',
    kind: 'review',
    sourceModule: 'daily_plan',
    entityType: 'daily_plan_review',
    entityId: planDate,
    timeboxMinutes: 15,
  };
}

/**
 * May tonight's review be pinned onto this manager's plan for today? Not onto
 * a closed day, and not onto a day the manager has already wrapped up — an
 * item appended after the wrap-up reopens a day they had closed and is then
 * marked carried at 20:00.
 */
function canPinReview(plan) {
  if (!plan) return false;
  if (plan.status === 'closed') return false;
  if (plan.wrapUp && plan.wrapUp.at) return false;
  return true;
}

/** Put the review first and renumber, replacing any earlier pin (idempotent). */
function withPinnedReview(items, pinnedItem) {
  const rest = (items || []).filter((i) => i.entityType !== 'daily_plan_review');
  return [pinnedItem, ...rest].map((i, index) => ({ ...i, order: index }));
}

/**
 * Is this review task superseded by the one being created now? Only EARLIER
 * plan dates are superseded — a future-dated review is still live work.
 */
function isSupersededReview(taskId, taskEntityId, currentTaskId, planDate) {
  if (taskId === currentTaskId) return false;
  if (!taskEntityId) return false;
  return String(taskEntityId) < planDate;
}

// ─── Close run ───────────────────────────────────────────────────────────────

const CLOSED_TASK_STATUSES = new Set(['completed', 'cancelled']);

/**
 * What happened to a plan item nobody marked: inferred from the live task.
 * A person's own disposition always wins. Missing (archived) counts as done
 * — carrying it forever would be worse.
 */
function resolveOutcome(existing, taskStatus) {
  if (existing) return existing;
  if (!taskStatus || taskStatus === 'missing') return 'done';
  if (CLOSED_TASK_STATUSES.has(taskStatus)) return 'done';
  if (taskStatus === 'blocked') return 'blocked';
  return 'carried';
}

/**
 * Carry-overs for a person: what the previous plan left unfinished. Read from
 * their own wrap-up when they filed one, else from items the close run marked
 * carried. An item with NO outcome counts as carried.
 */
function carriedFrom(prevPlan) {
  if (!prevPlan) return [];
  const fromWrapUp = prevPlan.wrapUp && prevPlan.wrapUp.carriedTaskIds;
  if (Array.isArray(fromWrapUp) && fromWrapUp.length) return fromWrapUp;
  return (prevPlan.items || [])
    .filter((i) => i.outcome === 'carried' || i.outcome === 'blocked' || !i.outcome)
    .map((i) => i.taskId);
}

/** A plan a person has already shaped — never recomposed by a draft run. */
function isHumanOwned(plan) {
  return Boolean(plan) && (plan.source === 'manager' || plan.reviewed === true);
}

/**
 * What a draft pass may do with one person's plan for the day:
 *   'human_owned' — a manager shaped or reviewed it: never rewritten
 *   'write'       — compose it (the 17:00 draft; or an untouched system
 *                   draft on the 20:00 refresh)
 *   'leave'       — refresh pass, and the plan is missing, published or
 *                   closed: not this pass's to create or change
 */
function draftDecision(existing, refreshOnly) {
  if (isHumanOwned(existing)) return 'human_owned';
  if (!refreshOnly) return 'write';
  return existing && existing.status === 'draft' ? 'write' : 'leave';
}

module.exports = {
  PLANS_COLLECTION,
  MAX_PLAN_ITEMS,
  FOCUS_REASON_RANK,
  DEFAULT_WORK_DAYS,
  planId,
  focusReasonFor,
  composePlanItems,
  planItemFromTask,
  entityRefFor,
  whyTodayFor,
  resumeNoteFor,
  dayStartMs,
  addDays,
  weekdayOf,
  workDaysOf,
  isWorkDay,
  nextWorkDay,
  reviewDayLabel,
  reviewTaskId,
  buildPinnedReviewItem,
  canPinReview,
  withPinnedReview,
  isSupersededReview,
  resolveOutcome,
  carriedFrom,
  isHumanOwned,
  draftDecision,
};
