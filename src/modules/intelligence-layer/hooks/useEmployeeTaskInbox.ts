/**
 * useEmployeeTaskInbox Hook
 * Manages task data, filters, and real-time subscriptions for the Employee Task Inbox
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { useAuth } from '@/integration/store';
import { taskGenerationService } from '../services/taskGenerationService';
import { useEmployeeDocId } from './useEmployeeDocId';

// ============================================
// Types
// ============================================

export interface TaskChecklistItem {
  id: string;
  title: string;
  description?: string;
  isRequired: boolean;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
}

export interface EmployeeTask {
  id: string;
  businessEventId: string;
  templateId: string;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: Date;
  dueDate?: Date;
  startedAt?: Date;
  completedAt?: Date;
  checklistItems: TaskChecklistItem[];
  checklistProgress: number;
  sourceModule: string;
  subsidiary: string;
  entityType?: string;
  entityId?: string;
  entityName?: string;
  projectId?: string;
  projectName?: string;
  createdAt: Date;
  updatedAt?: Date;
  createdBy: string;
  notes?: string;
  aiDescription?: string;
  aiChecklist?: AIChecklistItem[];
  aiRelevantDocuments?: AIRelevantDocument[];
  aiUrgencyScore?: number;
  aiUrgencyReason?: string;
  urgencyScore: number;
}

export interface AIChecklistItem {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  order: number;
  completed: boolean;
}

export interface AIRelevantDocument {
  name: string;
  type: string;
  reason: string;
}

export type TaskStatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'blocked';
export type TaskPriorityFilter = 'all' | 'P0' | 'P1' | 'P2' | 'P3';
export type TaskGroupBy = 'none' | 'status' | 'priority' | 'dueDate';

export interface TaskFilters {
  status: TaskStatusFilter;
  priority: TaskPriorityFilter;
  groupBy: TaskGroupBy;
  searchQuery: string;
}

export interface TaskInboxStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  blocked: number;
  overdue: number;
  dueToday: number;
  dueSoon: number; // Within 3 days
}

export interface GroupedTasks {
  [groupKey: string]: EmployeeTask[];
}

export type SnapshotFilter = 'burning' | 'nextUp' | 'stuck' | 'moved' | null;

export interface SnapshotStats {
  burning: { count: number; topTask?: string };
  nextUp: { count: number; nearestDue?: string };
  stuck: { count: number; oldestTask?: string };
  moved: { count: number };
}

// ============================================
// Urgency Score Calculation
// ============================================

const PRIORITY_WEIGHTS: Record<string, number> = {
  P0: 100,
  P1: 70,
  P2: 40,
  P3: 10,
};

function computeUrgencyScore(task: {
  priority: string;
  status: string;
  dueDate?: Date;
  createdAt: Date;
  updatedAt?: Date;
  startedAt?: Date;
  aiUrgencyScore?: number;
}): number {
  // Completed/cancelled tasks get score 0 so they sink to the bottom
  if (task.status === 'completed' || task.status === 'cancelled') return 0;

  let score = PRIORITY_WEIGHTS[task.priority] ?? 40;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (task.dueDate) {
    const dueDateOnly = new Date(
      task.dueDate.getFullYear(),
      task.dueDate.getMonth(),
      task.dueDate.getDate()
    );
    const diffDays = Math.ceil(
      (dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) {
      // Overdue — base 80 + scale by days overdue (max +40 extra)
      score += 80 + Math.min(Math.abs(diffDays) * 5, 40);
    } else if (diffDays === 0) {
      score += 50; // Due today
    } else if (diffDays === 1) {
      score += 30; // Due tomorrow
    } else if (diffDays <= 3) {
      score += 15; // Due within 3 days
    }
  }

  // Blocked tasks get penalized — user can't act on them
  if (task.status === 'blocked') {
    score -= 20;
  }

  // Stale tasks: pending for >3 days with no start
  if (task.status === 'pending' && !task.startedAt) {
    const taskAgeDays = Math.floor(
      (now.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (taskAgeDays > 3) {
      score += 20;
    }
  }

  // AI urgency boost (0-50, scaled from 0-100 AI score)
  if (task.aiUrgencyScore != null && task.aiUrgencyScore > 0) {
    score += Math.round(task.aiUrgencyScore / 2);
  }

  return Math.max(score, 1); // Ensure non-completed tasks always score > 0
}

// ============================================
// Snapshot Types
// ============================================

export interface SnapshotStats {
  burning: { count: number; topTask?: string };
  nextUp: { count: number; nearestDue?: string };
  stuck: { count: number; oldestTask?: string };
  moved: { count: number };
}

// ============================================
// Hook Implementation
// ============================================

export function useEmployeeTaskInbox() {
  const { user, userId: authUid, email: authEmail } = useAuth();
  const { employeeDocId, loading: resolvingEmployee } = useEmployeeDocId(authUid, authEmail);
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    priority: 'all',
    groupBy: 'none',
    searchQuery: '',
  });
  const [snapshotFilter, setSnapshotFilter] = useState<SnapshotFilter>(null);

  // Fetch tasks with real-time subscription
  useEffect(() => {
    // Keep loading while employee doc ID is still resolving
    if (resolvingEmployee) {
      setLoading(true);
      return;
    }

    if (!employeeDocId) {
      console.warn('[TaskInbox] No employeeDocId resolved — cannot query tasks');
      setLoading(false);
      setTasks([]);
      return;
    }

    setLoading(true);
    setError(null);

    // Build query based on status filter.
    // Use 'in' to match both employee doc ID and auth UID, because tasks
    // assigned before the ID-resolution fix stored the auth UID directly.
    const tasksRef = collection(db, 'generatedTasks');
    const assigneeIds = employeeDocId === authUid
      ? [employeeDocId]
      : [employeeDocId, ...(authUid ? [authUid] : [])];

    let constraints: any[] = [
      where('assignedTo', 'in', assigneeIds),
      orderBy('dueDate', 'asc'),
    ];

    // Only add status filter if not 'all'
    if (filters.status !== 'all') {
      constraints = [
        where('assignedTo', 'in', assigneeIds),
        where('status', '==', filters.status),
        orderBy('dueDate', 'asc'),
      ];
    }

    const q = query(tasksRef, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const taskData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            businessEventId: data.businessEventId || '',
            templateId: data.templateId || '',
            title: data.title || '',
            description: data.description || '',
            priority: data.priority || 'P2',
            status: data.status || 'pending',
            assignedTo: data.assignedTo,
            assignedToName: data.assignedToName,
            assignedAt: data.assignedAt?.toDate(),
            dueDate: data.dueDate?.toDate(),
            startedAt: data.startedAt?.toDate(),
            completedAt: data.completedAt?.toDate(),
            checklistItems: (data.checklistItems || []).map((item: any, idx: number) => ({
              id: item.id || String(idx + 1),
              title: item.title || item.text || '',
              description: item.description || '',
              isRequired: item.isRequired ?? false,
              completed: item.completed ?? false,
              completedAt: item.completedAt?.toDate?.() || item.completedAt,
              completedBy: item.completedBy,
            })),
            checklistProgress: data.checklistProgress || 0,
            sourceModule: data.sourceModule || '',
            subsidiary: data.subsidiary || '',
            entityType: data.entityType,
            entityId: data.entityId,
            entityName: data.entityName,
            projectId: data.projectId,
            projectName: data.projectName,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate(),
            createdBy: data.createdBy || 'system',
            notes: data.notes,
            aiDescription: data.aiDescription,
            aiChecklist: data.aiChecklist,
            aiRelevantDocuments: data.aiRelevantDocuments,
            aiUrgencyScore: data.aiUrgencyScore,
            aiUrgencyReason: data.aiUrgencyReason,
            urgencyScore: 0, // computed below
          } as EmployeeTask;
        });

        // Compute urgency scores and sort by urgency descending
        taskData.forEach((t) => {
          t.urgencyScore = computeUrgencyScore(t);
        });
        taskData.sort((a, b) => b.urgencyScore - a.urgencyScore);

        setTasks(taskData);
        setLoading(false);
      },
      (err) => {
        console.error('[TaskInbox] Error fetching tasks:', err);
        // Show actionable error — Firestore missing index errors include a URL to create it
        const errMsg = err?.message || 'Unknown error';
        if (errMsg.includes('index')) {
          setError('Missing Firestore index — check console for creation link');
        } else {
          setError(`Failed to load tasks: ${errMsg}`);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [employeeDocId, authUid, resolvingEmployee, filters.status]);

  // Calculate stats from tasks
  const stats = useMemo((): TaskInboxStats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let blocked = 0;
    let overdue = 0;
    let dueToday = 0;
    let dueSoon = 0;

    tasks.forEach((task) => {
      // Count by status
      switch (task.status) {
        case 'pending':
          pending++;
          break;
        case 'in_progress':
          inProgress++;
          break;
        case 'completed':
          completed++;
          break;
        case 'blocked':
          blocked++;
          break;
      }

      // Count due dates (only for non-completed tasks)
      if (task.dueDate && task.status !== 'completed' && task.status !== 'cancelled') {
        const dueDate = new Date(task.dueDate);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        if (dueDateOnly < today) {
          overdue++;
        } else if (dueDateOnly.getTime() === today.getTime()) {
          dueToday++;
        } else if (dueDateOnly <= threeDaysFromNow) {
          dueSoon++;
        }
      }
    });

    return {
      total: tasks.length,
      pending,
      inProgress,
      completed,
      blocked,
      overdue,
      dueToday,
      dueSoon,
    };
  }, [tasks]);

  // Compute snapshot stats from tasks
  const snapshotStats = useMemo((): SnapshotStats => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Burning: overdue or P0/P1 tasks that are not completed/cancelled
    const burningTasks = tasks.filter((t) => {
      if (t.status === 'completed' || t.status === 'cancelled') return false;
      if (t.priority === 'P0' || t.priority === 'P1') return true;
      if (t.dueDate && new Date(t.dueDate) < today) return true;
      return false;
    });

    // Next Up: pending tasks with upcoming due dates (not overdue, not burning)
    const burningIds = new Set(burningTasks.map((t) => t.id));
    const nextUpTasks = tasks.filter((t) => {
      if (burningIds.has(t.id)) return false;
      if (t.status === 'blocked') return false;
      if (t.status !== 'pending') return false;
      if (t.dueDate) {
        const d = new Date(t.dueDate);
        return d >= today && d <= threeDaysFromNow;
      }
      return true;
    });
    const nearestDueTask = nextUpTasks
      .filter((t) => t.dueDate)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

    // Stuck: blocked tasks or in_progress for > 3 days with no checklist progress
    const stuckTasks = tasks.filter((t) => {
      if (t.status === 'blocked') return true;
      if (t.status === 'in_progress' && t.startedAt) {
        const started = new Date(t.startedAt);
        const daysSinceStart = (now.getTime() - started.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceStart > 3 && t.checklistProgress < 50) return true;
      }
      return false;
    });
    const oldestStuck = stuckTasks.sort((a, b) => {
      const aDate = a.startedAt || a.createdAt;
      const bDate = b.startedAt || b.createdAt;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    })[0];

    // Moved: tasks that transitioned status in the last 24 hours
    const movedTasks = tasks.filter((t) => {
      if (t.completedAt && new Date(t.completedAt) >= twentyFourHoursAgo) return true;
      if (t.startedAt && new Date(t.startedAt) >= twentyFourHoursAgo) return true;
      if (t.updatedAt && new Date(t.updatedAt) >= twentyFourHoursAgo && t.status !== 'pending') return true;
      return false;
    });

    return {
      burning: {
        count: burningTasks.length,
        topTask: burningTasks[0]?.title,
      },
      nextUp: {
        count: nextUpTasks.length,
        nearestDue: nearestDueTask?.dueDate
          ? formatDueDate(nearestDueTask.dueDate)
          : undefined,
      },
      stuck: {
        count: stuckTasks.length,
        oldestTask: oldestStuck?.title,
      },
      moved: {
        count: movedTasks.length,
      },
    };
  }, [tasks]);

  // Filter tasks based on current filters + snapshot filter
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return tasks.filter((task) => {
      // Snapshot filter
      if (snapshotFilter) {
        const isActive = task.status !== 'completed' && task.status !== 'cancelled';
        switch (snapshotFilter) {
          case 'burning': {
            if (!isActive) return false;
            const isOverdue =
              task.dueDate &&
              new Date(task.dueDate.getFullYear(), task.dueDate.getMonth(), task.dueDate.getDate()) < today;
            const isHighPriority = task.priority === 'P0' || task.priority === 'P1';
            if (!isOverdue && !isHighPriority) return false;
            break;
          }
          case 'nextUp': {
            if (!isActive || task.status === 'blocked') return false;
            if (task.dueDate) {
              const dueDateOnly = new Date(
                task.dueDate.getFullYear(),
                task.dueDate.getMonth(),
                task.dueDate.getDate()
              );
              // Exclude burning tasks (overdue or P0/P1)
              const isOverdue = dueDateOnly < today;
              const isHighPriority = task.priority === 'P0' || task.priority === 'P1';
              if (isOverdue || isHighPriority) return false;
              if (dueDateOnly > threeDaysFromNow) return false;
            }
            break;
          }
          case 'stuck':
            if (task.status === 'blocked') break;
            if (task.status === 'in_progress' && task.startedAt) {
              const daysSinceStart = (now.getTime() - new Date(task.startedAt).getTime()) / (1000 * 60 * 60 * 24);
              if (daysSinceStart > 3 && task.checklistProgress < 50) break;
            }
            return false;
          case 'moved':
            if (task.completedAt && new Date(task.completedAt) >= twentyFourHoursAgo) break;
            else if (task.startedAt && new Date(task.startedAt) >= twentyFourHoursAgo) break;
            else if (task.updatedAt && new Date(task.updatedAt) >= twentyFourHoursAgo && task.status !== 'pending') break;
            else return false;
        }
      }

      // Priority filter
      if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
      }

      // Search filter
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDescription = task.description?.toLowerCase().includes(q);
        const matchesAiDescription = task.aiDescription?.toLowerCase().includes(q);
        const matchesProject = task.projectName?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDescription && !matchesAiDescription && !matchesProject) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, filters.priority, filters.searchQuery, snapshotFilter]);

  // Group tasks based on groupBy filter
  const groupedTasks = useMemo((): GroupedTasks => {
    if (filters.groupBy === 'none') {
      return { 'All Tasks': filteredTasks };
    }

    const groups: GroupedTasks = {};

    filteredTasks.forEach((task) => {
      let groupKey: string;

      switch (filters.groupBy) {
        case 'status':
          groupKey = task.status.charAt(0).toUpperCase() + task.status.slice(1).replace('_', ' ');
          break;
        case 'priority':
          const priorityLabels: Record<string, string> = {
            P0: 'Critical (P0)',
            P1: 'High (P1)',
            P2: 'Medium (P2)',
            P3: 'Low (P3)',
          };
          groupKey = priorityLabels[task.priority] || task.priority;
          break;
        case 'dueDate':
          groupKey = getDueDateGroup(task.dueDate);
          break;
        default:
          groupKey = 'Other';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });

    return groups;
  }, [filteredTasks, filters.groupBy]);

  // Task actions
  const startTask = useCallback(async (taskId: string) => {
    try {
      await taskGenerationService.updateTaskStatus(taskId, 'in_progress');
    } catch (err) {
      console.error('Error starting task:', err);
      throw err;
    }
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    try {
      await taskGenerationService.updateTaskStatus(taskId, 'completed');
    } catch (err) {
      console.error('Error completing task:', err);
      throw err;
    }
  }, []);

  const blockTask = useCallback(async (taskId: string) => {
    try {
      await taskGenerationService.updateTaskStatus(taskId, 'blocked');
    } catch (err) {
      console.error('Error blocking task:', err);
      throw err;
    }
  }, []);

  const updateChecklistItem = useCallback(
    async (taskId: string, itemId: string, completed: boolean) => {
      if (!employeeDocId) return;
      try {
        await taskGenerationService.updateChecklistItem(taskId, itemId, completed, employeeDocId);
      } catch (err) {
        console.error('Error updating checklist item:', err);
        throw err;
      }
    },
    [employeeDocId]
  );

  const updateFilters = useCallback((newFilters: Partial<TaskFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const refresh = useCallback(() => {
    // Trigger a re-render by updating a state
    // The real-time subscription will handle the actual refresh
    setLoading(true);
    setTimeout(() => setLoading(false), 500);
  }, []);

  return {
    tasks: filteredTasks,
    groupedTasks,
    stats,
    snapshotStats,
    snapshotFilter,
    setSnapshotFilter,
    loading,
    error,
    filters,
    updateFilters,
    startTask,
    completeTask,
    blockTask,
    updateChecklistItem,
    refresh,
    userId: employeeDocId,
    userName: user?.displayName || user?.email || 'User',
  };
}

// ============================================
// Helper Functions
// ============================================

function getDueDateGroup(dueDate?: Date): string {
  if (!dueDate) return 'No Due Date';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  const diffDays = Math.ceil((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Overdue';
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return 'This Week';
  if (diffDays <= 30) return 'This Month';
  return 'Later';
}

export function getDueDateStatus(dueDate?: Date): 'overdue' | 'today' | 'soon' | 'ok' | 'none' {
  if (!dueDate) return 'none';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

  const diffDays = Math.ceil((dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 3) return 'soon';
  return 'ok';
}

export function formatDueDate(dueDate?: Date): string {
  if (!dueDate) return '-';
  return dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: dueDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export default useEmployeeTaskInbox;
