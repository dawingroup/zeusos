/**
 * Typed wrappers around the Phase 6.E task-engine callables
 * (functions/src/event-task-engine/callables/*). All live in `europe-west1`.
 *
 * `generated_tasks` and `daily_plans` are admin-write in the rules; every
 * person-driven write comes through here so the history row and the
 * who-may-act check happen once, server-side.
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import type { HttpsCallable } from 'firebase/functions';
import { app } from '@/core/services/firebase/config';
import type { DailyPlan, DailyPlanItem, PlanItemOutcome, TaskPriority, TaskStatus } from '../types';

const functions = getFunctions(app, 'europe-west1');

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

// ─── taskAction ──────────────────────────────────────────────────────────────

export type TaskActionName =
  | 'start' | 'complete' | 'block' | 'unblock' | 'cancel' | 'reopen'
  | 'claim' | 'assign' | 'submit_review' | 'checklist';

export interface TaskActionRequest {
  taskId: string;
  action: TaskActionName;
  note?: string;
  reason?: string;
  /** For `assign`: a uid, an employee doc id or an email. */
  assigneeId?: string;
  outcome?: 'completed' | 'approved' | 'rejected';
  /** For `checklist`. */
  itemId?: string;
  completed?: boolean;
  /** For `complete`: skip the required-checklist gate (admin use). */
  force?: boolean;
}
export interface TaskActionResponse {
  id: string;
  status: TaskStatus;
  action: TaskActionName;
}
export const taskActionFn: HttpsCallable<TaskActionRequest, TaskActionResponse> =
  httpsCallable(functions, 'taskAction');

// ─── createTask ──────────────────────────────────────────────────────────────

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority | 'urgent' | 'high' | 'medium' | 'low';
  /** ISO timestamp, or … */
  dueAt?: string;
  /** … a plan date; the task is then due at the end of that working day. */
  dueDate?: string;
  /** Omit for your own task. A uid, an employee doc id or an email. */
  assigneeId?: string;
  kind?: 'approval' | 'review' | 'action' | 'followup' | 'notify';
  estimateMinutes?: number;
  masterJobId?: string;
  iwoId?: string;
  brandId?: string;
  sourceModule?: string;
}
export interface CreateTaskResponse {
  id: string;
  status: TaskStatus;
}
export const createTaskFn: HttpsCallable<CreateTaskRequest, CreateTaskResponse> =
  httpsCallable(functions, 'createTask');

// ─── dailyPlanAction ─────────────────────────────────────────────────────────

export type DailyPlanActionName =
  | 'acknowledge' | 'setItemOutcome' | 'clearItemOutcome' | 'wrapUp'
  | 'createEmptyPlan' | 'saveItems' | 'saveNotes' | 'markReviewed';

export interface DailyPlanActionRequest {
  action: DailyPlanActionName;
  /** YYYY-MM-DD (Africa/Nairobi). */
  date: string;
  /** Whose plan. Omit for your own. */
  assigneeUid?: string;
  assigneeName?: string;
  taskId?: string;
  outcome?: PlanItemOutcome;
  note?: string;
  outcomes?: Record<string, { outcome: PlanItemOutcome; note?: string }>;
  summary?: string;
  blockers?: string;
  items?: Array<Partial<DailyPlanItem> & { taskId: string }>;
  dayGoal?: string;
  managerNote?: string;
}
export interface DailyPlanActionResponse {
  ok?: boolean;
  created?: boolean;
  plan?: DailyPlan;
  taskId?: string;
  outcome?: PlanItemOutcome;
  /** `setItemOutcome` with `done`: why the task was left open (the item was NOT marked done). */
  taskLeftOpen?: string;
  carriedTaskIds?: string[];
  notClosed?: Array<{ taskId: string; title: string; reason: string }>;
  reviewTaskClosed?: boolean;
  count?: number;
  acknowledgedAt?: string;
}
export const dailyPlanActionFn: HttpsCallable<DailyPlanActionRequest, DailyPlanActionResponse> =
  httpsCallable(functions, 'dailyPlanAction');

// ─── taskEngineRunNow (admin) ────────────────────────────────────────────────

export interface TaskEngineRunNowRequest {
  run: 'publish' | 'draft' | 'close' | 'hygiene' | 'stale';
  now?: string;
}
export const taskEngineRunNowFn: HttpsCallable<TaskEngineRunNowRequest, { ok: boolean; run: string; summary: unknown }> =
  httpsCallable(functions, 'taskEngineRunNow');
