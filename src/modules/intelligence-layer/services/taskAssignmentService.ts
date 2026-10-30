/**
 * Task Assignment Service
 * Functions for managers to assign and reassign tasks.
 *
 * Phase 6.E: every write goes through the `taskAction` callable
 * (functions/src/event-task-engine/callables/taskActions.js), which checks who
 * may act, resolves an employee id / email to the person's login, and writes
 * the history row. `generated_tasks` is admin-write in the rules. Reads stay
 * client-side.
 */

import { db } from '@/shared/services/firebase/firestore';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { taskActionFn } from '../daily-plan/services/taskEngineFunctions';
import { toTaskRecord } from '../daily-plan/format';

const TASKS_COLLECTION = 'generated_tasks';

export interface TaskAssignment {
  taskId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: Date;
  reason?: string;
}

export interface TaskReassignment extends TaskAssignment {
  previousAssignee: string;
}

// ============================================
// Validation
// ============================================

function validateId(value: string, label: string): void {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required and must be a non-empty string`);
  }
  if (value.length > 200) {
    throw new Error(`${label} must be 200 characters or fewer`);
  }
}

// ============================================
// Assignment Functions
// ============================================

/**
 * Assign a task to a person. `assignedTo` may be a uid, an employee doc id
 * or an email — the callable resolves it to the login tasks are keyed by.
 * `assignedBy` is kept for the call signature; the server stamps the caller.
 */
export async function assignTask(
  taskId: string,
  assignedTo: string,
  assignedBy: string,
  reason?: string
): Promise<void> {
  validateId(taskId, 'Task ID');
  validateId(assignedTo, 'Assignee ID');
  validateId(assignedBy, 'Assigner ID');
  await taskActionFn({ taskId, action: 'assign', assigneeId: assignedTo, ...(reason ? { note: reason } : {}) });
}

/** Reassign a task from one person to another. */
export async function reassignTask(
  taskId: string,
  newAssignee: string,
  reassignedBy: string,
  reason?: string
): Promise<void> {
  validateId(taskId, 'Task ID');
  validateId(newAssignee, 'New assignee ID');
  validateId(reassignedBy, 'Reassigner ID');
  await taskActionFn({ taskId, action: 'assign', assigneeId: newAssignee, ...(reason ? { note: reason } : {}) });
}

/**
 * Take up (claim) a task: pool work is claimed; a task on someone else is
 * handed over to `newAssignee` and started.
 */
export async function takeUpTask(
  taskId: string,
  newAssignee: string,
  takenBy: string,
  reason?: string
): Promise<void> {
  validateId(taskId, 'Task ID');
  validateId(newAssignee, 'New assignee ID');
  validateId(takenBy, 'Taker ID');
  if (newAssignee === takenBy) {
    try {
      await taskActionFn({ taskId, action: 'claim' });
    } catch {
      await taskActionFn({ taskId, action: 'assign', assigneeId: newAssignee, ...(reason ? { note: reason } : {}) });
    }
  } else {
    await taskActionFn({ taskId, action: 'assign', assigneeId: newAssignee, ...(reason ? { note: reason } : {}) });
  }
  await taskActionFn({ taskId, action: 'start' });
}

/** Bulk assign — one callable per task; the first failure stops the run. */
export async function bulkAssignTasks(
  taskIds: string[],
  assignedTo: string,
  assignedBy: string,
  reason?: string
): Promise<void> {
  if (!taskIds || taskIds.length === 0) {
    throw new Error('At least one task ID is required');
  }
  if (taskIds.length > 200) {
    throw new Error('Cannot bulk assign more than 200 tasks at once');
  }
  validateId(assignedTo, 'Assignee ID');
  validateId(assignedBy, 'Assigner ID');
  for (const taskId of taskIds) {
    validateId(taskId, 'Task ID');
    await taskActionFn({ taskId, action: 'assign', assigneeId: assignedTo, ...(reason ? { note: reason } : {}) });
  }
}

// ============================================
// Query Functions
// ============================================

/** Open work that belongs to nobody (the hygiene run places what it can). */
export async function getUnassignedTasks() {
  const q = query(collection(db, TASKS_COLLECTION), where('status', '==', 'pending_assignment'), limit(500));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toTaskRecord(d.id, d.data()));
}

/** Tasks assigned to a person (by the uid their tasks are keyed by). */
export async function getEmployeeTasks(userId: string) {
  validateId(userId, 'User ID');
  const q = query(collection(db, TASKS_COLLECTION), where('assignedToUserId', '==', userId), limit(500));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => toTaskRecord(d.id, d.data()));
}
