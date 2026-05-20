/**
 * CRM Task Service
 * CRUD operations for sales tasks (follow-ups, site visits, etc.)
 */

import {
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument,
  where,
  orderBy,
  type QueryConstraint,
} from '@/shared/services/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import type { SalesTask, SalesTaskStatus } from '../types';
import { CRM_TASKS_COLLECTION } from '../constants/crm.constants';

/**
 * Create a new sales task
 */
export async function createTask(
  task: Omit<SalesTask, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Timestamp.now();

  await saveDocument(CRM_TASKS_COLLECTION, id, {
    ...task,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
  });

  return id;
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  data: Partial<SalesTask>
): Promise<void> {
  await updateDocument(CRM_TASKS_COLLECTION, taskId, {
    ...data,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Complete a task
 */
export async function completeTask(taskId: string): Promise<void> {
  await updateDocument(CRM_TASKS_COLLECTION, taskId, {
    status: 'completed' as SalesTaskStatus,
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<void> {
  await removeDocument(CRM_TASKS_COLLECTION, taskId);
}

/**
 * Fetch all tasks (ordered by due date)
 */
export async function fetchAllTasks(filters?: {
  status?: SalesTaskStatus;
  assignedTo?: string;
}): Promise<SalesTask[]> {
  const constraints: QueryConstraint[] = [];
  if (filters?.status) constraints.push(where('status', '==', filters.status));
  if (filters?.assignedTo) constraints.push(where('assignedTo', '==', filters.assignedTo));
  constraints.push(orderBy('dueDate', 'asc'));

  return fetchCollection<SalesTask>(CRM_TASKS_COLLECTION, constraints);
}

/**
 * Fetch tasks for a specific deal
 */
export async function fetchTasksByDeal(dealId: string): Promise<SalesTask[]> {
  return fetchCollection<SalesTask>(CRM_TASKS_COLLECTION, [
    where('dealId', '==', dealId),
    orderBy('dueDate', 'asc'),
  ]);
}
