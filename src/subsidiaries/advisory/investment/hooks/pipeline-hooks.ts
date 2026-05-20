/**
 * React hooks for pipeline management
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PipelineColumn,
  PipelineFilters,
  PipelineStats,
  StageTransitionApproval,
  DealMovement,
} from '../types/pipeline';
import { PipelineView, UserPipelinePreferences } from '../types/pipeline-view';
import { DealStage, StageConfig } from '../types/deal-stage';
import { pipelineService } from '../services/pipeline-service';

/**
 * Hook for Kanban pipeline view with real-time updates
 */
export function usePipelineKanban(initialFilters?: PipelineFilters) {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [filters, setFilters] = useState<PipelineFilters>(initialFilters || {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = pipelineService.subscribeToPipeline(filters, (updatedColumns) => {
      setColumns(updatedColumns);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [filters]);

  const moveDeal = useCallback(
    async (movement: DealMovement, userId: string) => {
      try {
        await pipelineService.moveDeal(movement, userId);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to move deal'));
        throw err;
      }
    },
    []
  );

  const toggleColumnCollapse = useCallback((stage: DealStage) => {
    setColumns(prev =>
      prev.map(col =>
        col.stage === stage ? { ...col, isCollapsed: !col.isCollapsed } : col
      )
    );
  }, []);

  // Calculate totals
  const totals = useMemo(() => {
    return {
      dealCount: columns.reduce((sum, col) => sum + col.count, 0),
      totalValue: columns.reduce((sum, col) => sum + col.totalValue.amount, 0),
    };
  }, [columns]);

  return {
    columns,
    filters,
    setFilters,
    moveDeal,
    toggleColumnCollapse,
    totals,
    loading,
    error,
  };
}

/**
 * Hook for pipeline statistics
 */
export function usePipelineStats(filters?: PipelineFilters) {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const result = await pipelineService.getPipelineStats(filters);
        setStats(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch pipeline stats'));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [filters]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await pipelineService.getPipelineStats(filters);
      setStats(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh pipeline stats'));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  return { stats, refresh, loading, error };
}

/**
 * Hook for stage configurations
 */
export function useStageConfigs() {
  const [configs, setConfigs] = useState<StageConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        setLoading(true);
        const result = await pipelineService.getStageConfigs();
        setConfigs(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch stage configs'));
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, []);

  return { configs, loading, error };
}

/**
 * Hook for stage transitions
 */
export function useStageTransitionRequest() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestTransition = useCallback(
    async (
      dealId: string,
      fromStage: DealStage,
      toStage: DealStage,
      userId: string,
      notes?: string
    ): Promise<StageTransitionApproval | null> => {
      try {
        setLoading(true);
        setError(null);
        const result = await pipelineService.requestStageTransition({
          dealId,
          fromStage,
          toStage,
          requestedBy: userId,
          notes,
        });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to request transition');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { requestTransition, loading, error };
}

/**
 * Hook for pending approvals
 */
export function usePendingApprovals(userId?: string) {
  const [approvals, setApprovals] = useState<StageTransitionApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchApprovals = async () => {
      try {
        setLoading(true);
        const result = await pipelineService.getPendingApprovals(userId);
        setApprovals(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch pending approvals'));
      } finally {
        setLoading(false);
      }
    };

    fetchApprovals();
  }, [userId]);

  const approve = useCallback(
    async (approvalId: string, approverId: string, notes?: string) => {
      await pipelineService.approveTransition(approvalId, approverId, notes);
      setApprovals(prev => prev.filter(a => a.id !== approvalId));
    },
    []
  );

  const reject = useCallback(
    async (approvalId: string, rejectedBy: string, reason: string) => {
      await pipelineService.rejectTransition(approvalId, rejectedBy, reason);
      setApprovals(prev => prev.filter(a => a.id !== approvalId));
    },
    []
  );

  return { approvals, approve, reject, loading, error };
}

/**
 * Hook for pipeline views
 */
export function usePipelineViews(userId: string) {
  const [views, setViews] = useState<PipelineView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchViews = async () => {
      try {
        setLoading(true);
        const result = await pipelineService.getPipelineViews(userId);
        setViews(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch pipeline views'));
      } finally {
        setLoading(false);
      }
    };

    fetchViews();
  }, [userId]);

  const saveView = useCallback(
    async (view: Omit<PipelineView, 'id' | 'createdAt' | 'updatedAt'>) => {
      const savedView = await pipelineService.savePipelineView(view);
      setViews(prev => [savedView, ...prev]);
      return savedView;
    },
    []
  );

  const deleteView = useCallback(async (viewId: string) => {
    await pipelineService.deletePipelineView(viewId);
    setViews(prev => prev.filter(v => v.id !== viewId));
  }, []);

  return { views, saveView, deleteView, loading, error };
}

/**
 * Hook for user pipeline preferences
 */
export function useUserPipelinePreferences(userId: string) {
  const [preferences, setPreferences] = useState<UserPipelinePreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setLoading(true);
        const result = await pipelineService.getUserPreferences(userId);
        setPreferences(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch preferences'));
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [userId]);

  const updatePreferences = useCallback(
    async (updates: Partial<UserPipelinePreferences>) => {
      await pipelineService.saveUserPreferences(userId, updates);
      setPreferences(prev => prev ? { ...prev, ...updates } : null);
    },
    [userId]
  );

  return { preferences, updatePreferences, loading, error };
}
