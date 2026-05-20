/**
 * SCHEDULE HOOKS
 *
 * React hooks for schedule management operations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';
import {
  ScheduleActivity,
  ScheduleActivityFormData,
  ScheduleActivityStatus,
  ScheduleSummary,
} from '../types/schedule';
import { ScheduleService } from '../services/schedule-service';

// ─────────────────────────────────────────────────────────────────
// HOOK: useScheduleActivities
// ─────────────────────────────────────────────────────────────────

interface UseScheduleActivitiesResult {
  activities: ScheduleActivity[];
  milestones: ScheduleActivity[];
  phases: ScheduleActivity[];
  tasks: ScheduleActivity[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useScheduleActivities(
  db: Firestore,
  projectId: string | null,
  options: { realtime?: boolean } = { realtime: true }
): UseScheduleActivitiesResult {
  const [activities, setActivities] = useState<ScheduleActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ScheduleService.getInstance(db), [db]);

  const fetchActivities = useCallback(async () => {
    if (!projectId) {
      setActivities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await service.getActivities(projectId);
      setActivities(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch schedule'));
    } finally {
      setLoading(false);
    }
  }, [service, projectId]);

  useEffect(() => {
    if (!projectId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    if (options.realtime) {
      setLoading(true);
      const unsubscribe = service.subscribeToActivities(projectId, (data) => {
        setActivities(data);
        setLoading(false);
      });
      return unsubscribe;
    } else {
      fetchActivities();
    }
  }, [projectId, options.realtime, service, fetchActivities]);

  const milestones = useMemo(
    () => activities.filter(a => a.activityType === 'milestone'),
    [activities]
  );

  const phases = useMemo(
    () => activities.filter(a => a.activityType === 'phase'),
    [activities]
  );

  const tasks = useMemo(
    () => activities.filter(a => a.activityType === 'task'),
    [activities]
  );

  return { activities, milestones, phases, tasks, loading, error, refresh: fetchActivities };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useScheduleMutations
// ─────────────────────────────────────────────────────────────────

interface UseScheduleMutationsResult {
  createActivity: (data: ScheduleActivityFormData) => Promise<ScheduleActivity>;
  updateActivity: (activityId: string, updates: Partial<ScheduleActivity>) => Promise<void>;
  deleteActivity: (activityId: string) => Promise<void>;
  updateProgress: (activityId: string, percentComplete: number) => Promise<void>;
  updateStatus: (activityId: string, status: ScheduleActivityStatus) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export function useScheduleMutations(
  db: Firestore,
  projectId: string | null,
  userId: string
): UseScheduleMutationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ScheduleService.getInstance(db), [db]);

  const createActivity = useCallback(
    async (data: ScheduleActivityFormData): Promise<ScheduleActivity> => {
      if (!projectId) throw new Error('No project selected');
      setLoading(true);
      setError(null);
      try {
        return await service.createActivity(projectId, data, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to create activity');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  const updateActivity = useCallback(
    async (activityId: string, updates: Partial<ScheduleActivity>): Promise<void> => {
      if (!projectId) throw new Error('No project selected');
      setLoading(true);
      setError(null);
      try {
        await service.updateActivity(projectId, activityId, updates, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update activity');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  const deleteActivity = useCallback(
    async (activityId: string): Promise<void> => {
      if (!projectId) throw new Error('No project selected');
      setLoading(true);
      setError(null);
      try {
        await service.deleteActivity(projectId, activityId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to delete activity');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId]
  );

  const updateProgress = useCallback(
    async (activityId: string, percentComplete: number): Promise<void> => {
      if (!projectId) throw new Error('No project selected');
      setLoading(true);
      setError(null);
      try {
        await service.updateProgress(projectId, activityId, percentComplete, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update progress');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  const updateStatus = useCallback(
    async (activityId: string, status: ScheduleActivityStatus): Promise<void> => {
      if (!projectId) throw new Error('No project selected');
      setLoading(true);
      setError(null);
      try {
        await service.updateStatus(projectId, activityId, status, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update status');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, userId]
  );

  return { createActivity, updateActivity, deleteActivity, updateProgress, updateStatus, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useScheduleSummary
// ─────────────────────────────────────────────────────────────────

interface UseScheduleSummaryResult {
  summary: ScheduleSummary | null;
  criticalPath: string[];
  loading: boolean;
}

export function useScheduleSummary(
  db: Firestore,
  projectId: string | null
): UseScheduleSummaryResult {
  const { activities, loading } = useScheduleActivities(db, projectId);

  const service = useMemo(() => ScheduleService.getInstance(db), [db]);

  const summary = useMemo(() => {
    if (activities.length === 0) return null;
    return service.calculateScheduleSummary(activities);
  }, [activities, service]);

  const criticalPath = useMemo(() => {
    if (activities.length === 0) return [];
    return service.calculateCriticalPath(activities);
  }, [activities, service]);

  return { summary, criticalPath, loading };
}
