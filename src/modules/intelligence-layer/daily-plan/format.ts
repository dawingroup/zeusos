/**
 * Pure helpers for the daily-plan surfaces — clock maths, wording, the small
 * reductions the cards run over plans and tasks. Kept apart from the
 * components so the tests pin them without Firebase.
 *
 * Time is Africa/Nairobi throughout (EAT, UTC+3, no DST), the same clock the
 * plan runs on (draft 17:00, publish 06:00, close 20:00).
 */

import type {
  DailyPlan,
  DailyPlanItem,
  FocusReason,
  FocusReliability,
  PlanItemOutcome,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from './types';

const EAT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A Date whose UTC fields read as Nairobi wall-clock time. */
function eat(ms: number): Date {
  return new Date(ms + EAT_OFFSET_MS);
}

function keyToUtc(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}

// ─── Timestamps ──────────────────────────────────────────────────────────────

/** Millis for an ISO string, a Firestore Timestamp, a Date or a number; null when absent. */
export function toMs(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  const v = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  return null;
}

export function toIso(value: unknown): string | null {
  const ms = toMs(value);
  return ms == null ? null : new Date(ms).toISOString();
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/**
 * Nairobi date key (UTC+3, no DST). Mirrors `dateKey` in
 * functions/src/event-task-engine/lib/taskRanking.js — a person at 23:30 EAT
 * must see the same "today" the 06:00 job published.
 */
export function nairobiDateKey(at: number | Date = Date.now(), offsetDays = 0): string {
  const ms = at instanceof Date ? at.getTime() : at;
  return new Date(ms + EAT_OFFSET_MS + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' moved by n calendar days. */
export function addDays(dateKey: string, n: number): string {
  const d = keyToUtc(dateKey);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The next working day — Saturday and Sunday roll to Monday. */
export function nextWorkingDay(from: number | Date = Date.now()): string {
  for (let offset = 1; offset <= 4; offset++) {
    const key = nairobiDateKey(from, offset);
    const dow = keyToUtc(key).getUTCDay();
    if (dow !== 0 && dow !== 6) return key;
  }
  return nairobiDateKey(from, 1);
}

/** The working day before a plan date key (Mon → Fri). */
export function previousWorkingDay(dateKey: string): string {
  const d = keyToUtc(dateKey);
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/** Minutes since midnight in Nairobi. */
export function nairobiMinutes(nowMs: number): number {
  const d = eat(nowMs);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** 'YYYY-MM-DD' → "Tuesday". */
export function weekdayOf(dateKey: string): string {
  const d = keyToUtc(dateKey);
  return Number.isNaN(d.getTime()) ? dateKey : WEEKDAY_LONG[d.getUTCDay()];
}

/** 'YYYY-MM-DD' → "Tue 27 Oct". */
export function formatPlanDate(dateKey: string): string {
  const d = keyToUtc(dateKey);
  if (Number.isNaN(d.getTime())) return dateKey;
  return `${WEEKDAY_SHORT[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]}`;
}

/** 'YYYY-MM-DD' → "Tuesday · 27 Oct 2026". */
export function formatHeaderDate(dateKey: string): string {
  const d = keyToUtc(dateKey);
  if (Number.isNaN(d.getTime())) return dateKey;
  return `${WEEKDAY_LONG[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The working day before a plan date, short: Monday's plan → "Fri". */
export function previousWorkdayShort(dateKey: string): string {
  return WEEKDAY_SHORT[keyToUtc(previousWorkingDay(dateKey)).getUTCDay()];
}

/** The working day after a plan date, long: Friday's plan → "Monday". */
export function nextWorkdayLong(dateKey: string): string {
  return weekdayOf(nextWorkingDay(keyToUtc(dateKey)));
}

/** ISO | Timestamp | Date | ms → "07:52" (Nairobi). */
export function clockOf(value: unknown): string | null {
  const ms = toMs(value);
  if (ms === null) return null;
  const d = eat(ms);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** → "Sun 19:42" (Nairobi). */
export function dayClockOf(value: unknown): string | null {
  const ms = toMs(value);
  const clock = clockOf(value);
  if (ms === null || !clock) return null;
  return `${WEEKDAY_SHORT[eat(ms).getUTCDay()]} ${clock}`;
}

/** 45 → "45m", 90 → "1h 30m", 120 → "2h". */
export function fmtMins(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// ─── Chips ───────────────────────────────────────────────────────────────────

export type ChipTone = '' | 'red' | 'amber' | 'blue' | 'accent' | 'green';

export function normalisePriority(value: unknown): TaskPriority {
  switch (String(value ?? '').trim()) {
    case 'P0': case 'urgent': case 'critical': return 'P0';
    case 'P1': case 'high': return 'P1';
    case 'P3': case 'low': return 'P3';
    default: return 'P2';
  }
}

export function priorityLabel(priority?: string): string {
  switch (normalisePriority(priority)) {
    case 'P0': return 'Critical';
    case 'P1': return 'High';
    case 'P3': return 'Low';
    default: return 'Medium';
  }
}

export function priorityChip(priority?: string): { label: string; tone: ChipTone } {
  switch (normalisePriority(priority)) {
    case 'P0': return { label: 'Critical', tone: 'red' };
    case 'P1': return { label: 'High', tone: 'red' };
    case 'P3': return { label: 'Low', tone: '' };
    default: return { label: 'Medium', tone: 'amber' };
  }
}

export function priorityTone(priority?: string): string {
  switch (normalisePriority(priority)) {
    case 'P0': return 'var(--rag-red)';
    case 'P1': return 'var(--rag-amber)';
    case 'P3': return 'var(--fg-tertiary)';
    default: return 'var(--rag-blue)';
  }
}

export const FOCUS_REASON_LABEL: Record<FocusReason, string> = {
  carry_over: 'Carried over',
  overdue: 'Overdue',
  manager_pick: 'Manager pick',
  due_today: 'Due today',
  auto_rank: 'Ranked',
};

export const FOCUS_REASON_TONE: Record<FocusReason, string> = {
  carry_over: 'var(--rag-amber)',
  overdue: 'var(--rag-red)',
  manager_pick: 'var(--accent)',
  due_today: 'var(--rag-blue)',
  auto_rank: 'var(--fg-tertiary)',
};

/** Why an item earned its place — the chip. */
export function reasonChip(reason: FocusReason | undefined, planDate: string): { label: string; tone: ChipTone } {
  switch (reason) {
    case 'carry_over': return { label: `Carried from ${previousWorkdayShort(planDate)}`, tone: 'amber' };
    case 'overdue': return { label: 'Overdue', tone: 'red' };
    case 'manager_pick': return { label: 'Manager pick', tone: 'accent' };
    case 'due_today': return { label: 'Due today', tone: 'blue' };
    default: return { label: 'Ranked', tone: '' };
  }
}

export const OUTCOME_LABEL: Record<PlanItemOutcome, string> = {
  done: 'Done',
  carried: 'Carry over',
  blocked: 'Blocked',
  dropped: 'Dropped',
};

/** "assignment" / "daily_plan" → "Assignment" / "Daily Plan". */
export function moduleLabelOf(sourceModule?: string | null): string {
  const raw = String(sourceModule || '').trim();
  if (!raw) return 'My Tasks';
  const known: Record<string, string> = {
    daily_plan: 'Team plans',
    iwo: 'Delivery',
    master_job: 'Account Mgmt',
    client_invoice: 'Billing',
    intercompany_invoice: 'Billing',
    personal: 'My Tasks',
    manual: 'My Tasks',
    agents: 'ZeusOS agent',
    events: 'Events',
  };
  if (known[raw]) return known[raw];
  return raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Plan items ──────────────────────────────────────────────────────────────

export type ItemState = 'open' | 'done' | 'blocked' | 'carried' | 'dropped';

export interface HomePlanItem extends DailyPlanItem {
  /** The live task is closed (completed / cancelled / archived). */
  isClosed?: boolean;
  currentStatus?: string;
}

/** What the card shows for an item: the person's own outcome, or a closed task. */
export function itemState(item: HomePlanItem): ItemState {
  if (item.outcome === 'done' || item.isClosed) return 'done';
  if (item.outcome) return item.outcome as Exclude<PlanItemOutcome, 'done'>;
  return 'open';
}

export interface FocusGroups<T extends HomePlanItem> {
  /** The first item with no outcome, in plan order — the Now block. */
  now: T | null;
  upNext: T[];
  /** Blocked, carried and dropped — each with its note and a Reopen. */
  parked: T[];
  done: T[];
}

export function groupFocusItems<T extends HomePlanItem>(items: T[]): FocusGroups<T> {
  const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const open = sorted.filter((i) => itemState(i) === 'open');
  return {
    now: open[0] ?? null,
    upNext: open.slice(1),
    parked: sorted.filter((i) => ['blocked', 'carried', 'dropped'].includes(itemState(i))),
    done: sorted.filter((i) => itemState(i) === 'done'),
  };
}

export function sumTimebox(items: DailyPlanItem[]): number {
  return items.reduce((sum, i) => sum + (i.timeboxMinutes || 0), 0);
}

/**
 * What the wrap-up submits: every outcome the person already gave stands
 * (a closed task counts as done), and anything still open is carried.
 */
export function wrapUpOutcomes(items: HomePlanItem[]): Record<string, { outcome: PlanItemOutcome; note?: string }> {
  const out: Record<string, { outcome: PlanItemOutcome; note?: string }> = {};
  for (const item of items) {
    const state = itemState(item);
    if (state === 'open') out[item.taskId] = { outcome: 'carried' };
    else out[item.taskId] = { outcome: state, ...(item.outcomeNote ? { note: item.outcomeNote } : {}) };
  }
  return out;
}

// ─── Wrap-up reminder ────────────────────────────────────────────────────────

/** 16:30 Nairobi — half an hour before the working day ends at 17:00. */
export const WRAP_UP_REMINDER_MINUTES = 16 * 60 + 30;
/** 20:00 Nairobi — `dailyPlanCloseRun` closes every open plan. */
export const PLAN_CLOSE_MINUTES = 20 * 60;

type PlanLike = Pick<DailyPlan, 'date' | 'status' | 'items' | 'wrapUp' | 'nonWorkingDay'>;

/**
 * True when the person should be reminded now: TODAY's published plan, with
 * work on it, not yet wrapped up by them, between 16:30 and the 20:00 close.
 */
export function isWrapUpDue(plan: PlanLike | null | undefined, nowMs: number): boolean {
  if (!plan) return false;
  if (plan.date !== nairobiDateKey(nowMs)) return false;
  if (plan.status !== 'published' || plan.nonWorkingDay) return false;
  if (plan.wrapUp?.at) return false;
  if ((plan.items || []).length === 0) return false;
  const minutes = nairobiMinutes(nowMs);
  return minutes >= WRAP_UP_REMINDER_MINUTES && minutes < PLAN_CLOSE_MINUTES;
}

// ─── Reliability ─────────────────────────────────────────────────────────────

/**
 * Reduce plans to a reliability picture. Only CLOSED working-day plans count —
 * a day still in progress would drag the rate down for no reason.
 */
export function computeFocusReliability(plans: DailyPlan[], days = 10): FocusReliability {
  const closed = plans
    .filter((p) => p.status === 'closed' && !p.nonWorkingDay)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, days);
  let planned = 0;
  let done = 0;
  let carried = 0;
  let blocked = 0;
  let acknowledged = 0;
  const trail: number[] = [];
  for (const plan of [...closed].reverse()) {
    const items = plan.items || [];
    planned += items.length;
    const dayDone = items.filter((i) => i.outcome === 'done').length;
    done += dayDone;
    carried += items.filter((i) => i.outcome === 'carried').length;
    blocked += items.filter((i) => i.outcome === 'blocked').length;
    if (plan.acknowledgedAt) acknowledged++;
    trail.push(dayDone);
  }
  return {
    days: closed.length,
    planned,
    done,
    carried,
    blocked,
    acknowledged,
    completionRate: planned > 0 ? Math.round((done / planned) * 100) : 0,
    trail,
  };
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ['pending_assignment', 'assigned', 'pending', 'in_progress', 'pending_review', 'blocked', 'escalated'];
export const CLOSED_TASK_STATUSES: readonly string[] = ['completed', 'cancelled', 'missing'];

export function isOpenTaskStatus(status: string | null | undefined): boolean {
  return Boolean(status) && (OPEN_TASK_STATUSES as readonly string[]).includes(status as string);
}

/** A Firestore `generated_tasks` doc → the client record (timestamps as ISO). */
export function toTaskRecord(id: string, data: Record<string, unknown>): TaskRecord {
  const d = data as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const statusRaw = typeof d.status === 'string' ? d.status : 'assigned';
  return {
    id,
    title: d.title || 'Task',
    description: d.description ?? null,
    aiDescription: d.aiDescription ?? null,
    priority: normalisePriority(d.priority),
    status: (statusRaw === 'pending' ? 'assigned' : statusRaw) as TaskStatus,
    kind: d.kind || undefined,
    dueAt: toIso(d.dueAt ?? d.dueDate),
    assignedToUserId: d.assignedToUserId ?? d.assignedTo ?? null,
    assignedToName: d.assignedToName ?? null,
    startedAt: toIso(d.startedAt),
    completedAt: toIso(d.completedAt),
    blockedAt: toIso(d.blockedAt),
    blockedReason: d.blockedReason ?? null,
    escalatedAt: toIso(d.escalatedAt),
    entityType: d.entityType ?? null,
    entityId: d.entityId ?? null,
    entityName: d.entityName ?? null,
    masterJobId: d.masterJobId ?? null,
    iwoId: d.iwoId ?? null,
    brandId: d.brandId ?? null,
    sourceModule: d.sourceModule ?? null,
    source: d.source ?? null,
    sourceEventType: d.sourceEventType ?? null,
    estimateMinutes: typeof d.estimateMinutes === 'number' ? d.estimateMinutes : null,
    checklistItems: Array.isArray(d.checklistItems) ? d.checklistItems : undefined,
    aiChecklist: Array.isArray(d.aiChecklist) ? d.aiChecklist : undefined,
    checklistProgress: typeof d.checklistProgress === 'number' ? d.checklistProgress : undefined,
    aiUrgencyScore: typeof d.aiUrgencyScore === 'number' ? d.aiUrgencyScore : null,
    aiUrgencyReason: d.aiUrgencyReason ?? null,
    createdBy: d.createdBy ?? null,
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

/** Soonest due first, undated last, then by title. */
export function sortTasksByDue<T extends { dueAt?: string | null; title?: string }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => {
    const da = toMs(a.dueAt);
    const dbm = toMs(b.dueAt);
    if (da !== dbm) {
      if (da === null) return 1;
      if (dbm === null) return -1;
      return da - dbm;
    }
    return (a.title || '').localeCompare(b.title || '');
  });
}

/** "Open record" target for a plan item or task — the record first, else the task in the inbox. */
export function taskInboxUrl(taskId: string): string {
  return `/intelligence/inbox?task=${encodeURIComponent(taskId)}`;
}

// ─── Names ───────────────────────────────────────────────────────────────────

export function firstNameOf(name?: string | null): string {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

export function initialsOf(name?: string | null): string {
  return (
    String(name || '')
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}
