/**
 * useMarketingTasks Hook
 * React hook for marketing task tracker with real-time updates
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  MarketingTask,
  MarketingTaskFormData,
  MarketingTaskFilters,
  MarketingTaskStatus,
} from '../types/marketing-task.types';
import {
  createMarketingTask,
  getMarketingTasks,
  updateTaskStatus,
  updateMarketingTask,
  deleteMarketingTask,
  toggleChecklistItem,
  subscribeToMarketingTasks,
  createTasksFromKeyDate,
} from '../services/marketingTaskService';

interface UseMarketingTasksReturn {
  tasks: MarketingTask[];
  loading: boolean;
  error: Error | null;

  // CRUD
  createTask: (data: MarketingTaskFormData) => Promise<string | null>;
  updateTask: (taskId: string, updates: Partial<MarketingTask>) => Promise<void>;
  changeStatus: (taskId: string, status: MarketingTaskStatus) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;
  toggleChecklist: (taskId: string, itemId: string, completed: boolean) => Promise<void>;

  // Bulk
  createFromKeyDate: (
    keyDateId: string,
    keyDateName: string,
    suggestedActions: string[],
    dueDate: Date
  ) => Promise<string[]>;

  // Filters
  filters: MarketingTaskFilters;
  setFilters: (filters: MarketingTaskFilters) => void;
  refresh: () => Promise<void>;

  // Stats
  stats: {
    total: number;
    todo: number;
    inProgress: number;
    review: number;
    done: number;
    overdue: number;
  };
}

export function useMarketingTasks(companyId?: string): UseMarketingTasksReturn {
  const { user } = useAuth();
  const effectiveCompanyId = companyId || (user as any)?.companyId || user?.uid || '';

  const [tasks, setTasks] = useState<MarketingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<MarketingTaskFilters>({});

  // Real-time subscription
  useEffect(() => {
    if (!effectiveCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToMarketingTasks(
      effectiveCompanyId,
      (allTasks) => {
        // Apply client-side filters
        let filtered = allTasks;
        if (filters.status) filtered = filtered.filter((t) => t.status === filters.status);
        if (filters.priority) filtered = filtered.filter((t) => t.priority === filters.priority);
        if (filters.source) filtered = filtered.filter((t) => t.source === filters.source);
        if (filters.taskType) filtered = filtered.filter((t) => t.taskType === filters.taskType);
        if (filters.search) {
          const s = filters.search.toLowerCase();
          filtered = filtered.filter(
            (t) => t.title.toLowerCase().includes(s) || t.description.toLowerCase().includes(s)
          );
        }
        if (filters.linkedKeyDateId) {
          filtered = filtered.filter((t) => t.linkedKeyDateId === filters.linkedKeyDateId);
        }
        if (filters.linkedCampaignId) {
          filtered = filtered.filter((t) => t.linkedCampaignId === filters.linkedCampaignId);
        }

        setTasks(filtered);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsub;
  }, [effectiveCompanyId, filters]);

  // Stats computed from tasks
  const now = new Date();
  const stats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'todo').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    review: tasks.filter((t) => t.status === 'review').length,
    done: tasks.filter((t) => t.status === 'done').length,
    overdue: tasks.filter(
      (t) =>
        t.dueDate &&
        t.dueDate.toDate() < now &&
        t.status !== 'done' &&
        t.status !== 'cancelled'
    ).length,
  };

  const createTask = useCallback(
    async (data: MarketingTaskFormData): Promise<string | null> => {
      if (!effectiveCompanyId) return null;
      setError(null);
      try {
        return await createMarketingTask(
          effectiveCompanyId,
          data,
          user?.uid || '',
          user?.displayName || 'Unknown'
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create task'));
        return null;
      }
    },
    [effectiveCompanyId, user]
  );

  const updateTask = useCallback(async (taskId: string, updates: Partial<MarketingTask>) => {
    setError(null);
    try {
      await updateMarketingTask(taskId, updates);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update task'));
    }
  }, []);

  const changeStatus = useCallback(async (taskId: string, status: MarketingTaskStatus) => {
    setError(null);
    try {
      await updateTaskStatus(taskId, status);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update status'));
    }
  }, []);

  const removeTask = useCallback(async (taskId: string) => {
    setError(null);
    try {
      await deleteMarketingTask(taskId);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete task'));
    }
  }, []);

  const toggleChecklist = useCallback(
    async (taskId: string, itemId: string, completed: boolean) => {
      setError(null);
      try {
        await toggleChecklistItem(taskId, itemId, completed);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to toggle checklist'));
      }
    },
    []
  );

  const createFromKeyDate = useCallback(
    async (
      keyDateId: string,
      keyDateName: string,
      suggestedActions: string[],
      dueDate: Date
    ): Promise<string[]> => {
      if (!effectiveCompanyId) return [];
      setError(null);
      try {
        return await createTasksFromKeyDate(
          effectiveCompanyId,
          keyDateId,
          keyDateName,
          suggestedActions,
          dueDate,
          user?.uid || '',
          user?.displayName || 'Unknown'
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to create tasks from key date'));
        return [];
      }
    },
    [effectiveCompanyId, user]
  );

  const refresh = useCallback(async () => {
    if (!effectiveCompanyId) return;
    setLoading(true);
    try {
      const result = await getMarketingTasks(effectiveCompanyId, filters);
      setTasks(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh tasks'));
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId, filters]);

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    changeStatus,
    removeTask,
    toggleChecklist,
    createFromKeyDate,
    filters,
    setFilters,
    refresh,
    stats,
  };
}
