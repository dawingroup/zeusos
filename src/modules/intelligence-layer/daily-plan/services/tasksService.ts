/**
 * Reads of `generated_tasks` the daily-plan surfaces need, and the task
 * actions (through the `taskAction` callable). The collection is admin-write
 * in the rules; people act through the callable.
 */

import {
  collection,
  documentId,
  getDocs,
  limit as fsLimit,
  onSnapshot,
  orderBy,
  query,
  where,
  type QuerySnapshot,
} from 'firebase/firestore';

import { db } from '@/shared/services/firebase/firestore';
import { OPEN_TASK_STATUSES, sortTasksByDue, toTaskRecord } from '../format';
import type { TaskRecord } from '../types';
import { taskActionFn, type TaskActionResponse } from './taskEngineFunctions';

export const TASKS_COLLECTION = 'generated_tasks';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** What the live task says now. `status: 'missing'` when the doc is gone. */
export interface TaskState {
  status: string;
  assignedToUserId?: string | null;
  task?: TaskRecord;
}

/**
 * Live status for a plan's tasks — one listener per chunk of 10 (a plan holds
 * at most 7), so a task finished elsewhere strikes through the moment it is
 * done. `onChange` fires only once every chunk has answered.
 */
export function subscribeTaskStates(
  taskIds: string[],
  onChange: (states: Map<string, TaskState>) => void,
  onError?: (err: Error) => void,
): () => void {
  const ids = [...new Set(taskIds.filter(Boolean))];
  if (ids.length === 0) {
    onChange(new Map());
    return () => {};
  }
  const parts = chunk(ids, 10);
  const seen = parts.map(() => new Map<string, TaskState>());
  const loaded = parts.map(() => false);
  const publish = () => {
    if (!loaded.every(Boolean)) return;
    const next = new Map<string, TaskState>();
    for (const m of seen) for (const [id, st] of m) next.set(id, st);
    for (const id of ids) if (!next.has(id)) next.set(id, { status: 'missing' });
    onChange(next);
  };
  const unsubs = parts.map((part, idx) =>
    onSnapshot(
      query(collection(db, TASKS_COLLECTION), where(documentId(), 'in', part)),
      (snap) => {
        const m = new Map<string, TaskState>();
        for (const d of snap.docs) {
          const task = toTaskRecord(d.id, d.data());
          m.set(d.id, { status: task.status, assignedToUserId: task.assignedToUserId ?? null, task });
        }
        seen[idx] = m;
        loaded[idx] = true;
        publish();
      },
      (err) => {
        console.warn('[tasksService] status listener failed:', err);
        onError?.(err as Error);
      },
    ),
  );
  return () => unsubs.forEach((u) => u());
}

/** Live list of one person's OPEN tasks (the inbox's source, and the focus card's "live task"). */
export function subscribeMyOpenTasks(
  uid: string,
  onChange: (tasks: TaskRecord[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const q = query(
    collection(db, TASKS_COLLECTION),
    where('assignedToUserId', '==', uid),
    where('status', 'in', [...OPEN_TASK_STATUSES]),
  );
  return onSnapshot(
    q,
    (snap) => onChange(sortTasksByDue(snap.docs.map((d) => toTaskRecord(d.id, d.data())))),
    (err) => {
      console.warn('[tasksService] open tasks listener failed:', err);
      onError?.(err as Error);
    },
  );
}

/** Per uid, the soonest-due open tasks. */
const MAX_ORDERED = 60;
/** Per uid, open tasks in any order — the net for undated work. */
const MAX_UNORDERED = 200;

/**
 * Every open, actionable task on a person — for the manager's "add to plan"
 * picker. Two reads per uid (ordered by due date, and unordered so undated
 * work is seen); throws only when EVERY read failed.
 */
export async function fetchAssigneeOpenTasks(uids: string[]): Promise<TaskRecord[]> {
  const ids = [...new Set(uids.filter(Boolean))];
  if (ids.length === 0) return [];
  const tasksRef = collection(db, TASKS_COLLECTION);
  const statuses = [...OPEN_TASK_STATUSES];
  const reads = ids.flatMap((uid) => [
    query(tasksRef, where('assignedToUserId', '==', uid), where('status', 'in', statuses), orderBy('dueAt', 'asc'), fsLimit(MAX_ORDERED)),
    query(tasksRef, where('assignedToUserId', '==', uid), where('status', 'in', statuses), fsLimit(MAX_UNORDERED)),
  ]);
  const settled = await Promise.allSettled(reads.map((q) => getDocs(q)));
  const ok = settled.filter((r): r is PromiseFulfilledResult<QuerySnapshot> => r.status === 'fulfilled');
  if (ok.length === 0) {
    const first = settled.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    throw first?.reason instanceof Error ? first.reason : new Error('Could not load tasks');
  }
  const byId = new Map<string, TaskRecord>();
  for (const r of ok) {
    for (const d of r.value.docs) {
      if (byId.has(d.id)) continue;
      const t = toTaskRecord(d.id, d.data());
      if (t.kind === 'notify') continue; // a notice is read, not done
      if (t.entityType === 'daily_plan_review') continue;
      byId.set(d.id, t);
    }
  }
  return sortTasksByDue([...byId.values()]);
}

export interface UnassignedSummary {
  /** Open, assignable tasks with no owner. */
  total: number;
  /** Largest sources, biggest first — where the backlog actually comes from. */
  topSources: { sourceModule: string; count: number }[];
  sampleTitles: string[];
}

export const EMPTY_UNASSIGNED: UnassignedSummary = { total: 0, topSources: [], sampleTitles: [] };

/** Open work that belongs to nobody — the hygiene run places it, this shows the backlog. */
export async function fetchUnassignedSummary(): Promise<UnassignedSummary> {
  const snap = await getDocs(query(collection(db, TASKS_COLLECTION), where('status', '==', 'pending_assignment'), fsLimit(1000)));
  const rows = snap.docs.map((d) => toTaskRecord(d.id, d.data())).filter((t) => t.kind !== 'notify');
  const bySource = new Map<string, number>();
  const titles: string[] = [];
  for (const t of rows) {
    const src = t.sourceModule || 'unknown';
    bySource.set(src, (bySource.get(src) || 0) + 1);
    if (titles.length < 5 && t.title) titles.push(t.title);
  }
  return {
    total: rows.length,
    topSources: [...bySource.entries()]
      .map(([sourceModule, count]) => ({ sourceModule, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4),
    sampleTitles: titles,
  };
}

// ─── Actions (through the callable) ──────────────────────────────────────────

async function act(req: Parameters<typeof taskActionFn>[0]): Promise<TaskActionResponse> {
  const res = await taskActionFn(req);
  return res.data;
}

export const startTask = (taskId: string) => act({ taskId, action: 'start' });
export const completeTask = (taskId: string, note?: string) => act({ taskId, action: 'complete', ...(note ? { note } : {}) });
/** Mark blocked asks why — the reason is what reaches the person who can unblock it. */
export const blockTask = (taskId: string, reason: string) => act({ taskId, action: 'block', reason });
export const unblockTask = (taskId: string) => act({ taskId, action: 'unblock' });
export const cancelTask = (taskId: string, reason?: string) => act({ taskId, action: 'cancel', ...(reason ? { reason } : {}) });
export const reopenTask = (taskId: string, note?: string) => act({ taskId, action: 'reopen', ...(note ? { note } : {}) });
export const claimTask = (taskId: string) => act({ taskId, action: 'claim' });
export const assignTaskTo = (taskId: string, assigneeId: string, note?: string) => act({ taskId, action: 'assign', assigneeId, ...(note ? { note } : {}) });
export const tickChecklist = (taskId: string, itemId: string, completed: boolean) => act({ taskId, action: 'checklist', itemId, completed });
