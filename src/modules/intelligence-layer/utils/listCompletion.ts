/**
 * May a compact list (the rail's Tasks and Actions segments) close this task in
 * one click, or start it?
 *
 * A shortcut for a click the person could make anyway, never a new power — and
 * never a way round the step the task exists for:
 *
 *  - an `approval` is decided on its record (a memo addressee signs on the memo;
 *    closing the task would leave the memo waiting on nobody);
 *  - a `review` is a clearance on its record, the same way;
 *  - a `followup` asks for a follow-up to happen, read on the task;
 *  - a `notify` is read, not done;
 *  - a task submitted for sign-off (`pending_review`) waits on the reviewer;
 *  - required checks still open would be refused by `taskAction` anyway.
 *
 * Those rows have no Done box and open the task instead.
 */
import type { EmployeeTask } from '../hooks/useEmployeeTaskInbox';

type ListTask = Pick<EmployeeTask, 'status'> &
  Partial<Pick<EmployeeTask, 'kind' | 'rawStatus' | 'checklistItems'>>;

const OPEN: ReadonlyArray<EmployeeTask['status']> = ['pending', 'in_progress', 'blocked'];

export function canCompleteFromList(task: ListTask): boolean {
  if (!OPEN.includes(task.status)) return false;
  if (task.rawStatus === 'pending_review') return false;
  if (task.kind && task.kind !== 'action') return false;
  return !(task.checklistItems ?? []).some((i) => i.isRequired && !i.completed);
}

/** Start is offered on work you can begin — never on an approval or a notice. */
export function canStartFromList(task: ListTask): boolean {
  return task.status === 'pending' && task.kind !== 'approval' && task.kind !== 'notify';
}
