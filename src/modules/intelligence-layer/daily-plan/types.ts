/**
 * Daily focus plan — the day's contract between a person and their manager
 * (Phase 6.E, DawinOS stream E port).
 *
 * A plan is drafted by `dailyPlanDraftRun` at 17:00 Africa/Nairobi, shaped by
 * the manager that evening at /tasks/review, published at 06:00 and closed at
 * 20:00. The person sees it at /tasks/today and in the Action Center strip.
 *
 * Server mirror: functions/src/event-task-engine/lib/dailyPlan.js. The two
 * must agree on field names — the plan doc is written by the server only
 * (`dailyPlanAction`), and timestamps are ISO strings.
 */

/** Why an item earned a place on today's list. Drives the chip in the UI. */
export type FocusReason =
  | 'carry_over'   // promised yesterday and not finished
  | 'overdue'      // past its due date
  | 'manager_pick' // added by hand during the evening review
  | 'due_today'
  | 'auto_rank';

/** What actually happened to an item. Set by the person, or inferred at close. */
export type PlanItemOutcome = 'done' | 'carried' | 'blocked' | 'dropped';

export type DailyPlanStatus = 'draft' | 'published' | 'closed';

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

/** One status vocabulary — functions/src/event-task-engine/lib/taskModel.js. */
export type TaskStatus =
  | 'pending_assignment'
  | 'assigned'
  | 'pending' // legacy spelling of `assigned`, read only
  | 'in_progress'
  | 'pending_review'
  | 'blocked'
  | 'completed'
  | 'cancelled'
  | 'escalated'; // legacy, read only

export type TaskKind = 'approval' | 'review' | 'action' | 'followup' | 'notify';

export interface DailyPlanItem {
  taskId: string;
  order: number;
  /** Denormalised at draft time so one doc read renders the whole card. */
  title: string;
  priority: string;
  /** ISO. */
  dueAt?: string;
  kind?: string;
  sourceModule?: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  masterJobId?: string;
  iwoId?: string;
  brandId?: string;
  /** Minutes the manager set aside for this. Falls back to the task estimate. */
  timeboxMinutes?: number;
  focusReason?: FocusReason;
  outcome?: PlanItemOutcome;
  /** Free-text the person left when they carried or blocked it. */
  outcomeNote?: string;
  outcomeAt?: string;
  /** Set by the 20:00 close when it resolved the outcome from the live task. */
  outcomeInferred?: boolean;
  /** The record as people name it ("IWO-0142"). Only when a fact backs it. */
  entityRef?: string;
  /** Why today: the AI enrichment's urgency reason. */
  whyToday?: string;
  /** Where you left it: your last note, checklist progress, or when it started. */
  resumeNote?: string;
}

export interface DailyPlanWrapUp {
  /** Only a person's own wrap-up carries `at`; the 20:00 close writes wrapUp without it. */
  at?: string;
  summary?: string;
  blockers?: string;
  carriedTaskIds: string[];
  closedBy?: string;
}

export interface DailyPlan {
  /** Doc id is `${date}_${assigneeUid}`. */
  id: string;
  date: string; // YYYY-MM-DD, Africa/Nairobi
  assigneeUid: string;
  assigneeEmployeeId?: string | null;
  assigneeName?: string | null;
  subsidiaryId?: string | null;
  managerUid?: string | null;
  managerEmployeeId?: string | null;
  /** Written by the draft run so the card can say who a block notifies. */
  managerName?: string | null;

  status: DailyPlanStatus;
  /**
   * Whether a manager actually looked at this. An unreviewed plan is still
   * published — nobody should start the day blank because a manager was
   * travelling — but the gap is shown, never hidden.
   */
  reviewed: boolean;
  reviewedBy?: string;
  reviewedByName?: string | null;
  reviewedAt?: string;
  dayGoal?: string;
  managerNote?: string;
  /** 'manager' means a human shaped it; the draft run will not overwrite it. */
  source: 'system' | 'manager';

  items: DailyPlanItem[];

  acknowledgedAt?: string;
  wrapUp?: DailyPlanWrapUp;
  /** Closed as a day this person does not work — never worked, excluded from reliability. */
  nonWorkingDay?: boolean;
  /** AI brief (Phase 6.E PR 3), when configured. */
  brief?: string | null;

  generatedAt?: string;
  publishedAt?: string;
  closedAt?: string;
  updatedAt?: string;
}

/** What `recordOutcome` reports back: `done` may leave the task open, with the reason. */
export interface DailyPlanActionResult {
  ok: boolean;
  taskLeftOpen?: string;
}

/** How the person is doing at landing what they committed to. */
export interface FocusReliability {
  days: number;
  planned: number;
  done: number;
  carried: number;
  blocked: number;
  acknowledged: number;
  /** done / planned, 0–100. */
  completionRate: number;
  /** Per-day done-count, oldest first — feeds the sparkline. */
  trail: number[];
}

export interface TaskChecklistEntry {
  id: string;
  title: string;
  description?: string;
  isRequired?: boolean;
  completed?: boolean;
}

/** A `generated_tasks` row as the client reads it (timestamps as ISO strings). */
export interface TaskRecord {
  id: string;
  title: string;
  description?: string | null;
  aiDescription?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  kind?: TaskKind | string;
  dueAt?: string | null;
  assignedToUserId?: string | null;
  assignedToName?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  blockedAt?: string | null;
  blockedReason?: string | null;
  escalatedAt?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  masterJobId?: string | null;
  iwoId?: string | null;
  brandId?: string | null;
  sourceModule?: string | null;
  source?: string | null;
  sourceEventType?: string | null;
  estimateMinutes?: number | null;
  checklistItems?: TaskChecklistEntry[];
  aiChecklist?: TaskChecklistEntry[];
  checklistProgress?: number;
  aiUrgencyScore?: number | null;
  aiUrgencyReason?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
