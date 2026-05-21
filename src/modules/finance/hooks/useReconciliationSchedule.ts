// ============================================================================
// USE RECONCILIATION SCHEDULE HOOK
// ZeusOS v2.0 - Financial Management Module
// React hook for reconciliation schedule management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type {
  ReconciliationSchedule,
  ReconciliationScheduleInput,
  ReconciliationTask,
} from '../types/integrations.types';
import {
  createReconciliationSchedule,
  getReconciliationSchedules,
  updateReconciliationSchedule,
  toggleReconciliationSchedule,
  deleteReconciliationSchedule,
  completeReconciliationSchedule,
  getReconciliationTasks,
  subscribeToReconciliationSchedules,
} from '../services/financeAdminService';

export interface UseReconciliationScheduleOptions {
  companyId: string;
  autoLoad?: boolean;
  subscribe?: boolean;
}

export interface UseReconciliationScheduleReturn {
  schedules: ReconciliationSchedule[];
  tasks: ReconciliationTask[];
  loading: boolean;
  error: string | null;

  // CRUD
  create: (input: ReconciliationScheduleInput, userId: string) => Promise<ReconciliationSchedule>;
  update: (scheduleId: string, updates: Partial<ReconciliationScheduleInput>) => Promise<void>;
  toggle: (scheduleId: string, isActive: boolean) => Promise<void>;
  remove: (scheduleId: string) => Promise<void>;
  complete: (scheduleId: string, userId: string, notes?: string) => Promise<void>;

  // Data loading
  refresh: () => Promise<void>;
  loadTasks: (scheduleId?: string) => Promise<void>;

  // Computed
  overdueCount: number;
  dueThisWeekCount: number;
}

export function useReconciliationSchedule({
  companyId,
  autoLoad = true,
  subscribe = true,
}: UseReconciliationScheduleOptions): UseReconciliationScheduleReturn {
  const [schedules, setSchedules] = useState<ReconciliationSchedule[]>([]);
  const [tasks, setTasks] = useState<ReconciliationTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load schedules
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReconciliationSchedules(companyId);
      setSchedules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedules');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Load tasks
  const loadTasks = useCallback(
    async (scheduleId?: string) => {
      try {
        const data = await getReconciliationTasks(companyId, scheduleId);
        setTasks(data);
      } catch (err) {
        console.error('Failed to load tasks:', err);
      }
    },
    [companyId]
  );

  // Create
  const create = useCallback(
    async (input: ReconciliationScheduleInput, userId: string) => {
      setError(null);
      try {
        const schedule = await createReconciliationSchedule(companyId, input, userId);
        setSchedules((prev) => [...prev, schedule].sort(
          (a, b) => (a.nextDueDate as any)?.seconds - (b.nextDueDate as any)?.seconds
        ));
        return schedule;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create schedule');
        throw err;
      }
    },
    [companyId]
  );

  // Update
  const update = useCallback(
    async (scheduleId: string, updates: Partial<ReconciliationScheduleInput>) => {
      setError(null);
      try {
        await updateReconciliationSchedule(companyId, scheduleId, updates);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update schedule');
        throw err;
      }
    },
    [companyId, refresh]
  );

  // Toggle
  const toggle = useCallback(
    async (scheduleId: string, isActive: boolean) => {
      try {
        await toggleReconciliationSchedule(companyId, scheduleId, isActive);
        setSchedules((prev) =>
          prev.map((s) => (s.id === scheduleId ? { ...s, isActive } : s))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to toggle schedule');
      }
    },
    [companyId]
  );

  // Remove
  const remove = useCallback(
    async (scheduleId: string) => {
      try {
        await deleteReconciliationSchedule(companyId, scheduleId);
        setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete schedule');
      }
    },
    [companyId]
  );

  // Complete
  const completeFn = useCallback(
    async (scheduleId: string, userId: string, notes?: string) => {
      try {
        await completeReconciliationSchedule(companyId, scheduleId, userId, notes);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete reconciliation');
      }
    },
    [companyId, refresh]
  );

  // Computed: overdue count
  const overdueCount = schedules.filter((s) => {
    const dueDate = (s.nextDueDate as any)?.toDate?.() || new Date(s.nextDueDate as any);
    return dueDate < new Date() && s.isActive;
  }).length;

  // Computed: due this week
  const dueThisWeekCount = schedules.filter((s) => {
    const dueDate = (s.nextDueDate as any)?.toDate?.() || new Date(s.nextDueDate as any);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return dueDate <= weekFromNow && dueDate >= new Date() && s.isActive;
  }).length;

  // Auto-load
  useEffect(() => {
    if (autoLoad && companyId) {
      refresh();
    }
  }, [autoLoad, companyId, refresh]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!subscribe || !companyId) return;

    const unsub = subscribeToReconciliationSchedules(companyId, setSchedules);
    return () => unsub();
  }, [subscribe, companyId]);

  return {
    schedules,
    tasks,
    loading,
    error,
    create,
    update,
    toggle,
    remove,
    complete: completeFn,
    refresh,
    loadTasks,
    overdueCount,
    dueThisWeekCount,
  };
}
