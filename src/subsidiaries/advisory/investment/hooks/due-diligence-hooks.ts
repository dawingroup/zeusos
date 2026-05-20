/**
 * React hooks for due diligence management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DueDiligence,
  DDStatus,
  DDRating,
  DDScope,
  DDSummary,
} from '../types/due-diligence';
import { DDWorkstream, WorkstreamStatus } from '../types/dd-workstream';
import { DDFinding, FindingFilters, RedFlagSummary } from '../types/dd-finding';
import { DDTask, TaskStatus, TaskSummary } from '../types/dd-task';
import { dueDiligenceService } from '../services/due-diligence-service';

/**
 * Hook for fetching DD with real-time updates
 */
export function useDueDiligence(ddId: string | undefined) {
  const [dd, setDD] = useState<DueDiligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    if (!ddId) {
      setDD(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = dueDiligenceService.subscribeToDueDiligence(ddId, (updatedDD) => {
      setDD(updatedDD);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ddId]);

  return { dd, loading, error };
}

/**
 * Hook for fetching DD by deal ID
 */
export function useDealDueDiligence(dealId: string | undefined) {
  const [dd, setDD] = useState<DueDiligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dealId) {
      setDD(null);
      setLoading(false);
      return;
    }

    const fetchDD = async () => {
      try {
        setLoading(true);
        const result = await dueDiligenceService.getDueDiligenceByDeal(dealId);
        setDD(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch DD'));
      } finally {
        setLoading(false);
      }
    };

    fetchDD();
  }, [dealId]);

  return { dd, loading, error };
}

/**
 * Hook for initializing DD
 */
export function useInitializeDueDiligence() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const initialize = useCallback(
    async (
      dealId: string,
      engagementId: string,
      scope: DDScope,
      userId: string
    ): Promise<DueDiligence> => {
      try {
        setLoading(true);
        setError(null);
        const newDD = await dueDiligenceService.initializeDueDiligence(
          dealId,
          engagementId,
          scope,
          userId
        );
        return newDD;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to initialize DD');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { initialize, loading, error };
}

/**
 * Hook for updating DD status
 */
export function useUpdateDDStatus(ddId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateStatus = useCallback(
    async (status: DDStatus, userId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await dueDiligenceService.updateStatus(ddId, status, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update DD status');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [ddId]
  );

  return { updateStatus, loading, error };
}

/**
 * Hook for workstreams with real-time updates
 */
export function useWorkstreams(ddId: string | undefined) {
  const [workstreams, setWorkstreams] = useState<DDWorkstream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    if (!ddId) {
      setWorkstreams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = dueDiligenceService.subscribeToWorkstreams(ddId, (updated) => {
      setWorkstreams(updated);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [ddId]);

  return { workstreams, loading, error };
}

/**
 * Hook for workstream management
 */
export function useWorkstream(ddId: string, workstreamId: string) {
  const [workstream, setWorkstream] = useState<DDWorkstream | null>(null);
  const [tasks, setTasks] = useState<DDTask[]>([]);
  const [findings, setFindings] = useState<DDFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [ws, wsTasks, wsFindings] = await Promise.all([
        dueDiligenceService.getWorkstream(ddId, workstreamId),
        dueDiligenceService.getWorkstreamTasks(ddId, workstreamId),
        dueDiligenceService.getWorkstreamFindings(ddId, workstreamId),
      ]);
      setWorkstream(ws);
      setTasks(wsTasks);
      setFindings(wsFindings);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch workstream'));
    } finally {
      setLoading(false);
    }
  }, [ddId, workstreamId]);

  useEffect(() => {
    if (ddId && workstreamId) {
      fetchData();
    }
  }, [ddId, workstreamId, fetchData]);

  const updateStatus = useCallback(
    async (status: WorkstreamStatus) => {
      await dueDiligenceService.updateWorkstreamStatus(ddId, workstreamId, status);
      await fetchData();
    },
    [ddId, workstreamId, fetchData]
  );

  const assignLead = useCallback(
    async (lead: { userId: string; name: string; email: string }) => {
      await dueDiligenceService.assignWorkstreamLead(ddId, workstreamId, lead);
      await fetchData();
    },
    [ddId, workstreamId, fetchData]
  );

  const signOff = useCallback(
    async (userId: string) => {
      await dueDiligenceService.signOffWorkstream(ddId, workstreamId, userId);
      await fetchData();
    },
    [ddId, workstreamId, fetchData]
  );

  return {
    workstream,
    tasks,
    findings,
    updateStatus,
    assignLead,
    signOff,
    refresh: fetchData,
    loading,
    error,
  };
}

/**
 * Hook for task management
 */
export function useTasks(ddId: string, workstreamId: string) {
  const [tasks, setTasks] = useState<DDTask[]>([]);
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const [taskList, taskSummary] = await Promise.all([
        dueDiligenceService.getWorkstreamTasks(ddId, workstreamId),
        dueDiligenceService.getTaskSummary(ddId, workstreamId),
      ]);
      setTasks(taskList);
      setSummary(taskSummary);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch tasks'));
    } finally {
      setLoading(false);
    }
  }, [ddId, workstreamId]);

  useEffect(() => {
    if (ddId && workstreamId) {
      fetchTasks();
    }
  }, [ddId, workstreamId, fetchTasks]);

  const createTask = useCallback(
    async (taskData: Partial<DDTask>, userId: string) => {
      const task = await dueDiligenceService.createTask(ddId, workstreamId, taskData, userId);
      await fetchTasks();
      return task;
    },
    [ddId, workstreamId, fetchTasks]
  );

  const updateTaskStatus = useCallback(
    async (taskId: string, status: TaskStatus) => {
      await dueDiligenceService.updateTaskStatus(ddId, workstreamId, taskId, status);
      await fetchTasks();
    },
    [ddId, workstreamId, fetchTasks]
  );

  const assignTask = useCallback(
    async (taskId: string, assignee: { userId: string; name: string; email: string }) => {
      await dueDiligenceService.assignTask(ddId, workstreamId, taskId, assignee);
      await fetchTasks();
    },
    [ddId, workstreamId, fetchTasks]
  );

  return {
    tasks,
    summary,
    createTask,
    updateTaskStatus,
    assignTask,
    refresh: fetchTasks,
    loading,
    error,
  };
}

/**
 * Hook for findings management
 */
export function useFindings(ddId: string, filters?: FindingFilters) {
  const [findings, setFindings] = useState<DDFinding[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlagSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchFindings = useCallback(async () => {
    try {
      setLoading(true);
      const [allFindings, redFlagsSummary] = await Promise.all([
        dueDiligenceService.getAllFindings(ddId, filters),
        dueDiligenceService.getRedFlagsSummary(ddId),
      ]);
      setFindings(allFindings);
      setRedFlags(redFlagsSummary);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch findings'));
    } finally {
      setLoading(false);
    }
  }, [ddId, filters]);

  useEffect(() => {
    if (ddId) {
      fetchFindings();
    }
  }, [ddId, fetchFindings]);

  const createFinding = useCallback(
    async (workstreamId: string, findingData: Partial<DDFinding>, userId: string) => {
      const finding = await dueDiligenceService.createFinding(
        ddId,
        workstreamId,
        findingData,
        userId
      );
      await fetchFindings();
      return finding;
    },
    [ddId, fetchFindings]
  );

  const updateFinding = useCallback(
    async (workstreamId: string, findingId: string, updates: Partial<DDFinding>, userId: string) => {
      await dueDiligenceService.updateFinding(ddId, workstreamId, findingId, updates, userId);
      await fetchFindings();
    },
    [ddId, fetchFindings]
  );

  const resolveFinding = useCallback(
    async (workstreamId: string, findingId: string, resolution: string, userId: string) => {
      await dueDiligenceService.resolveFinding(ddId, workstreamId, findingId, resolution, userId);
      await fetchFindings();
    },
    [ddId, fetchFindings]
  );

  const escalateFinding = useCallback(
    async (
      workstreamId: string,
      findingId: string,
      reason: string,
      escalatedTo: string,
      userId: string
    ) => {
      await dueDiligenceService.escalateFinding(
        ddId,
        workstreamId,
        findingId,
        reason,
        escalatedTo,
        userId
      );
      await fetchFindings();
    },
    [ddId, fetchFindings]
  );

  return {
    findings,
    redFlags,
    createFinding,
    updateFinding,
    resolveFinding,
    escalateFinding,
    refresh: fetchFindings,
    loading,
    error,
  };
}

/**
 * Hook for DD summary (for deal view)
 */
export function useDDSummary(ddId: string | undefined) {
  const [summary, setSummary] = useState<DDSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ddId) {
      setSummary(null);
      setLoading(false);
      return;
    }

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const result = await dueDiligenceService.getDDSummary(ddId);
        setSummary(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch DD summary'));
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [ddId]);

  return { summary, loading, error };
}

/**
 * Hook for DD sign-off
 */
export function useDDSignOff(ddId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signOff = useCallback(
    async (rating: DDRating, notes: string, userId: string) => {
      try {
        setLoading(true);
        setError(null);
        await dueDiligenceService.signOff(ddId, rating, notes, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to sign off DD');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [ddId]
  );

  return { signOff, loading, error };
}
