/**
 * "Now working on" — which of a person's open tasks is the one they are on.
 *
 * Several tasks can be in progress at once and nothing on the task records which
 * one the person is at right now, so the answer is two-tier:
 *
 *  1. The task they last picked in the rail (a per-device pick in localStorage)
 *     — only while it is still open and still theirs. A pick completed, cancelled
 *     or handed on is ignored, never shown stale.
 *  2. Otherwise the in-progress task they started most recently.
 */
import type { EmployeeTask } from '../hooks/useEmployeeTaskInbox';

export const CURRENT_TASK_STORAGE_KEY = 'zeus_my_tasks_current_v1';

type CurrentCandidate = Pick<EmployeeTask, 'id' | 'status' | 'startedAt'>;

export function selectCurrentTask<T extends CurrentCandidate>(
  openTasks: T[],
  pickedId: string | null | undefined,
): T | null {
  if (pickedId) {
    const picked = openTasks.find((t) => t.id === pickedId);
    if (picked) return picked;
  }
  let best: T | null = null;
  for (const t of openTasks) {
    if (t.status !== 'in_progress') continue;
    if (!best || (t.startedAt?.getTime() ?? 0) > (best.startedAt?.getTime() ?? 0)) best = t;
  }
  return best;
}

/** Read the stored pick. Never throws (private windows, blocked storage). */
export function readPickedTaskId(): string | null {
  try {
    const raw = window.localStorage.getItem(CURRENT_TASK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { taskId?: unknown };
    return typeof parsed?.taskId === 'string' ? parsed.taskId : null;
  } catch {
    return null;
  }
}

export function writePickedTaskId(taskId: string | null): void {
  try {
    if (taskId) window.localStorage.setItem(CURRENT_TASK_STORAGE_KEY, JSON.stringify({ taskId }));
    else window.localStorage.removeItem(CURRENT_TASK_STORAGE_KEY);
  } catch {
    /* storage unavailable — the pick just won't survive a reload */
  }
}
