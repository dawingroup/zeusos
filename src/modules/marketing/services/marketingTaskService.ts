/**
 * Marketing Task Service
 * Firestore CRUD for marketing task tracker
 * Aggregates tasks from key dates, campaigns, calendar, and manual entries
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  MarketingTask,
  MarketingTaskFormData,
  MarketingTaskFilters,
  MarketingTaskStatus,
} from '../types/marketing-task.types';
import { MARKETING_TASKS_COLLECTION } from '../types/marketing-task.types';

// ============================================
// Task CRUD
// ============================================

/**
 * Create a new marketing task
 */
export async function createMarketingTask(
  companyId: string,
  data: MarketingTaskFormData,
  userId: string,
  userName: string
): Promise<string> {
  const task: Omit<MarketingTask, 'id'> = {
    companyId,
    title: data.title,
    description: data.description,
    taskType: data.taskType,
    status: 'todo',
    priority: data.priority,
    dueDate: data.dueDate ? Timestamp.fromDate(data.dueDate) : undefined,
    assignedTo: data.assignedTo,
    assignedToName: data.assignedToName,
    createdBy: userId,
    createdByName: userName,
    source: data.source,
    sourceId: data.sourceId,
    sourceName: data.sourceName,
    linkedKeyDateId: data.linkedKeyDateId,
    linkedKeyDateName: data.linkedKeyDateName,
    linkedCampaignId: data.linkedCampaignId,
    linkedCampaignName: data.linkedCampaignName,
    platforms: data.platforms,
    contentTheme: data.contentTheme,
    checklist: data.checklist?.map((item, i) => ({
      id: `cl_${i}_${Date.now()}`,
      text: item.text,
      completed: false,
    })),
    tags: data.tags,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  // Strip undefined values — Firestore rejects them
  const cleaned = Object.fromEntries(
    Object.entries(task).filter(([, v]) => v !== undefined)
  );

  const docRef = await addDoc(collection(db, MARKETING_TASKS_COLLECTION), cleaned);
  return docRef.id;
}

/**
 * Create tasks from a key date's suggested actions
 */
export async function createTasksFromKeyDate(
  companyId: string,
  keyDateId: string,
  keyDateName: string,
  suggestedActions: string[],
  dueDate: Date,
  userId: string,
  userName: string
): Promise<string[]> {
  const ids: string[] = [];
  for (const action of suggestedActions) {
    const id = await createMarketingTask(
      companyId,
      {
        title: action,
        description: `Task for key date: ${keyDateName}`,
        taskType: 'event_prep',
        priority: 'medium',
        dueDate,
        source: 'key_date',
        sourceId: keyDateId,
        sourceName: keyDateName,
        linkedKeyDateId: keyDateId,
        linkedKeyDateName: keyDateName,
        tags: ['auto-generated', 'key-date'],
      },
      userId,
      userName
    );
    ids.push(id);
  }
  return ids;
}

/**
 * Get a single task by ID
 */
export async function getMarketingTask(taskId: string): Promise<MarketingTask | null> {
  const docSnap = await getDoc(doc(db, MARKETING_TASKS_COLLECTION, taskId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as MarketingTask;
}

/**
 * Get tasks for a company with optional filters
 */
export async function getMarketingTasks(
  companyId: string,
  filters: MarketingTaskFilters = {}
): Promise<MarketingTask[]> {
  const constraints: any[] = [where('companyId', '==', companyId)];

  if (filters.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters.source) {
    constraints.push(where('source', '==', filters.source));
  }
  if (filters.linkedKeyDateId) {
    constraints.push(where('linkedKeyDateId', '==', filters.linkedKeyDateId));
  }
  if (filters.linkedCampaignId) {
    constraints.push(where('linkedCampaignId', '==', filters.linkedCampaignId));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(200));

  const q = query(collection(db, MARKETING_TASKS_COLLECTION), ...constraints);
  const snap = await getDocs(q);

  let tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MarketingTask));

  // Client-side filters
  if (filters.search) {
    const s = filters.search.toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(s) ||
        t.description.toLowerCase().includes(s)
    );
  }
  if (filters.priority) {
    tasks = tasks.filter((t) => t.priority === filters.priority);
  }
  if (filters.taskType) {
    tasks = tasks.filter((t) => t.taskType === filters.taskType);
  }
  if (filters.dueBefore) {
    const ts = Timestamp.fromDate(filters.dueBefore);
    tasks = tasks.filter((t) => t.dueDate && t.dueDate <= ts);
  }
  if (filters.dueAfter) {
    const ts = Timestamp.fromDate(filters.dueAfter);
    tasks = tasks.filter((t) => t.dueDate && t.dueDate >= ts);
  }

  return tasks;
}

/**
 * Get tasks linked to a specific key date
 */
export async function getTasksForKeyDate(
  companyId: string,
  keyDateId: string
): Promise<MarketingTask[]> {
  return getMarketingTasks(companyId, { linkedKeyDateId: keyDateId });
}

/**
 * Get tasks linked to a specific campaign
 */
export async function getTasksForCampaign(
  companyId: string,
  campaignId: string
): Promise<MarketingTask[]> {
  return getMarketingTasks(companyId, { linkedCampaignId: campaignId });
}

/**
 * Update a task's status
 */
export async function updateTaskStatus(
  taskId: string,
  status: MarketingTaskStatus
): Promise<void> {
  const updates: any = { status, updatedAt: serverTimestamp() };
  if (status === 'done') {
    updates.completedAt = serverTimestamp();
  }
  await updateDoc(doc(db, MARKETING_TASKS_COLLECTION, taskId), updates);
}

/**
 * Update a task
 */
export async function updateMarketingTask(
  taskId: string,
  updates: Partial<MarketingTask>
): Promise<void> {
  const { id, ...data } = { ...updates, id: undefined };
  const cleaned = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(db, MARKETING_TASKS_COLLECTION, taskId), {
    ...cleaned,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update a checklist item
 */
export async function toggleChecklistItem(
  taskId: string,
  checklistItemId: string,
  completed: boolean
): Promise<void> {
  const task = await getMarketingTask(taskId);
  if (!task?.checklist) return;

  const updatedChecklist = task.checklist.map((item) =>
    item.id === checklistItemId ? { ...item, completed } : item
  );

  await updateDoc(doc(db, MARKETING_TASKS_COLLECTION, taskId), {
    checklist: updatedChecklist,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a task
 */
export async function deleteMarketingTask(taskId: string): Promise<void> {
  await deleteDoc(doc(db, MARKETING_TASKS_COLLECTION, taskId));
}

/**
 * Subscribe to tasks (real-time)
 */
export function subscribeToMarketingTasks(
  companyId: string,
  callback: (tasks: MarketingTask[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    collection(db, MARKETING_TASKS_COLLECTION),
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc'),
    limit(200)
  );

  return onSnapshot(
    q,
    (snap) => {
      const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MarketingTask));
      callback(tasks);
    },
    (error) => {
      console.error('Marketing tasks subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Batch-create tasks from AI suggestions.
 * This is the primary entry point for AI-anchored task creation.
 */
export async function createAISuggestedTasks(
  companyId: string,
  suggestions: Array<{
    title: string;
    description: string;
    taskType: MarketingTask['taskType'];
    priority: MarketingTask['priority'];
    dueDate?: string;
    linkedKeyDateId?: string;
    linkedKeyDateName?: string;
    linkedCampaignId?: string;
    linkedCampaignName?: string;
    platforms?: string[];
    contentTheme?: string;
    tags: string[];
    checklist?: string[];
  }>,
  userId: string,
  userName: string
): Promise<string[]> {
  const ids: string[] = [];
  for (const s of suggestions) {
    const id = await createMarketingTask(
      companyId,
      {
        title: s.title,
        description: s.description,
        taskType: s.taskType,
        priority: s.priority,
        dueDate: s.dueDate ? new Date(s.dueDate) : undefined,
        source: 'ai_suggestion',
        sourceName: 'Marketing AI Agent',
        linkedKeyDateId: s.linkedKeyDateId || undefined,
        linkedKeyDateName: s.linkedKeyDateName || undefined,
        linkedCampaignId: s.linkedCampaignId || undefined,
        linkedCampaignName: s.linkedCampaignName || undefined,
        platforms: s.platforms as any,
        contentTheme: s.contentTheme,
        tags: [...(s.tags || []), 'ai-generated'],
        checklist: s.checklist?.map((text) => ({ text })),
      },
      userId,
      userName
    );
    ids.push(id);
  }
  return ids;
}

/**
 * Get task summary stats for dashboard
 */
export async function getTaskStats(companyId: string): Promise<{
  total: number;
  todo: number;
  inProgress: number;
  review: number;
  done: number;
  overdue: number;
}> {
  const tasks = await getMarketingTasks(companyId);
  const now = Timestamp.now();

  return {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    review: tasks.filter((t) => t.status === 'review').length,
    done: tasks.filter((t) => t.status === 'done').length,
    overdue: tasks.filter(
      (t) => t.dueDate && t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled'
    ).length,
  };
}
