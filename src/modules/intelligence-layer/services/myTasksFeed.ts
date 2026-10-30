/**
 * The signed-in person's OPEN tasks — the one `generated_tasks` listener the app
 * shell runs for them (see MyTasksContext).
 *
 * It has NO `orderBy`: Firestore silently drops a document that lacks the ordered
 * field, so a due-date-ordered feed never sees a task written without one.
 * Ranking happens client-side anyway.
 */
import { collection, onSnapshot, query, where } from 'firebase/firestore';

import { db } from '@/shared/services/firebase/firestore';
import { OPEN_TASK_STATUSES } from '../daily-plan/format';
import { computeUrgencyScore, toInboxTask, type EmployeeTask } from '../hooks/useEmployeeTaskInbox';

/** Should this task be listed as work the person gets through? */
export function isPlannableTask(t: Pick<EmployeeTask, 'kind' | 'entityType'>): boolean {
  if (t.kind === 'notify') return false; // FYI noise, not work
  if (t.entityType === 'daily_plan_review') return false; // pinned onto a manager's plan separately
  return true;
}

export function subscribeToMyOpenTasks(
  uid: string,
  onChange: (tasks: EmployeeTask[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = query(
    collection(db, 'generated_tasks'),
    where('assignedToUserId', '==', uid),
    where('status', 'in', [...OPEN_TASK_STATUSES]),
  );
  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map((d) => toInboxTask(d.id, d.data()));
      tasks.forEach((t) => {
        t.urgencyScore = computeUrgencyScore(t);
      });
      tasks.sort((a, b) => b.urgencyScore - a.urgencyScore);
      onChange(tasks);
    },
    (err) => onError?.(err),
  );
}
