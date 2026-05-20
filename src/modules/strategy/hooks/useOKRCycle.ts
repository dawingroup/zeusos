// ============================================================================
// USE OKR CYCLE HOOK - DawinOS CEO Strategy Command
// React hook for managing OKR cycles
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { okrService } from '../services/okr.service';
import {
  OKRCyclePeriod,
  OKRAnalytics,
  CreateCycleInput,
  UpdateCycleInput,
} from '../types/okr.types';
// OKRCycleStatus type used for status comparisons inline

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface UseOKRCyclesOptions {
  companyId: string;
  year?: number;
  autoFetch?: boolean;
}

export interface UseOKRCyclesReturn {
  cycles: OKRCyclePeriod[];
  activeCycle: OKRCyclePeriod | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createCycle: (input: CreateCycleInput) => Promise<OKRCyclePeriod>;
  updateCycle: (cycleId: string, input: UpdateCycleInput) => Promise<OKRCyclePeriod>;
  activateCycle: (cycleId: string) => Promise<OKRCyclePeriod>;
  closeCycle: (cycleId: string) => Promise<OKRCyclePeriod>;
  // Computed
  planningCycles: OKRCyclePeriod[];
  reviewCycles: OKRCyclePeriod[];
  closedCycles: OKRCyclePeriod[];
}

export interface UseOKRCycleOptions {
  companyId: string;
  cycleId: string;
  autoFetch?: boolean;
}

export interface UseOKRCycleReturn {
  cycle: OKRCyclePeriod | null;
  analytics: OKRAnalytics | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  refreshAnalytics: () => Promise<void>;
  updateCycle: (input: UpdateCycleInput) => Promise<OKRCyclePeriod>;
  activateCycle: () => Promise<OKRCyclePeriod>;
  startReview: () => Promise<OKRCyclePeriod>;
  closeCycle: () => Promise<OKRCyclePeriod>;
  // Computed
  daysRemaining: number | null;
  isActive: boolean;
  isPlanning: boolean;
  isReview: boolean;
  isClosed: boolean;
  progressPercentage: number;
}

// ----------------------------------------------------------------------------
// useOKRCycles Hook - For managing multiple cycles
// ----------------------------------------------------------------------------
export function useOKRCycles(options: UseOKRCyclesOptions): UseOKRCyclesReturn {
  const { user } = useAuth();
  const { companyId, year, autoFetch = true } = options;

  const [cycles, setCycles] = useState<OKRCyclePeriod[]>([]);
  const [activeCycle, setActiveCycle] = useState<OKRCyclePeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const [allCycles, active] = await Promise.all([
        okrService.getCycles(companyId, year),
        okrService.getActiveCycle(companyId),
      ]);
      setCycles(allCycles);
      setActiveCycle(active);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch OKR cycles'));
    } finally {
      setLoading(false);
    }
  }, [companyId, year]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  const createCycle = useCallback(
    async (input: CreateCycleInput): Promise<OKRCyclePeriod> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const cycle = await okrService.createCycle(companyId, input, user.uid);
      setCycles((prev) => [cycle, ...prev]);
      return cycle;
    },
    [companyId, user?.uid]
  );

  const updateCycle = useCallback(
    async (cycleId: string, input: UpdateCycleInput): Promise<OKRCyclePeriod> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await okrService.updateCycle(companyId, cycleId, input, user.uid);
      setCycles((prev) => prev.map((c) => (c.id === cycleId ? updated : c)));
      if (activeCycle?.id === cycleId) {
        setActiveCycle(updated);
      }
      return updated;
    },
    [companyId, user?.uid, activeCycle?.id]
  );

  const activateCycle = useCallback(
    async (cycleId: string): Promise<OKRCyclePeriod> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const activated = await okrService.activateCycle(companyId, cycleId, user.uid);
      await refresh(); // Refresh to update all cycle statuses
      return activated;
    },
    [companyId, user?.uid, refresh]
  );

  const closeCycle = useCallback(
    async (cycleId: string): Promise<OKRCyclePeriod> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const closed = await okrService.updateCycle(companyId, cycleId, { status: 'closed' }, user.uid);
      setCycles((prev) => prev.map((c) => (c.id === cycleId ? closed : c)));
      if (activeCycle?.id === cycleId) {
        setActiveCycle(null);
      }
      return closed;
    },
    [companyId, user?.uid, activeCycle?.id]
  );

  const planningCycles = useMemo(
    () => cycles.filter((c) => c.status === 'planning'),
    [cycles]
  );

  const reviewCycles = useMemo(
    () => cycles.filter((c) => c.status === 'review'),
    [cycles]
  );

  const closedCycles = useMemo(
    () => cycles.filter((c) => c.status === 'closed'),
    [cycles]
  );

  return {
    cycles,
    activeCycle,
    loading,
    error,
    refresh,
    createCycle,
    updateCycle,
    activateCycle,
    closeCycle,
    planningCycles,
    reviewCycles,
    closedCycles,
  };
}

// ----------------------------------------------------------------------------
// useOKRCycle Hook - For managing a single cycle
// ----------------------------------------------------------------------------
export function useOKRCycle(options: UseOKRCycleOptions): UseOKRCycleReturn {
  const { user } = useAuth();
  const { companyId, cycleId, autoFetch = true } = options;

  const [cycle, setCycle] = useState<OKRCyclePeriod | null>(null);
  const [analytics, setAnalytics] = useState<OKRAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId || !cycleId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await okrService.getCycle(companyId, cycleId);
      setCycle(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch OKR cycle'));
    } finally {
      setLoading(false);
    }
  }, [companyId, cycleId]);

  const refreshAnalytics = useCallback(async () => {
    if (!companyId || !cycleId) return;

    try {
      const result = await okrService.getAnalytics(companyId, cycleId);
      setAnalytics(result);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    }
  }, [companyId, cycleId]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
      refreshAnalytics();
    }
  }, [refresh, refreshAnalytics, autoFetch]);

  const updateCycle = useCallback(
    async (input: UpdateCycleInput): Promise<OKRCyclePeriod> => {
      if (!companyId || !cycleId || !user?.uid) {
        throw new Error('Company, cycle, or user not available');
      }
      const updated = await okrService.updateCycle(companyId, cycleId, input, user.uid);
      setCycle(updated);
      return updated;
    },
    [companyId, cycleId, user?.uid]
  );

  const activateCycle = useCallback(async (): Promise<OKRCyclePeriod> => {
    if (!companyId || !cycleId || !user?.uid) {
      throw new Error('Company, cycle, or user not available');
    }
    const activated = await okrService.activateCycle(companyId, cycleId, user.uid);
    setCycle(activated);
    return activated;
  }, [companyId, cycleId, user?.uid]);

  const startReview = useCallback(async (): Promise<OKRCyclePeriod> => {
    if (!companyId || !cycleId || !user?.uid) {
      throw new Error('Company, cycle, or user not available');
    }
    const updated = await okrService.updateCycle(companyId, cycleId, { status: 'review' }, user.uid);
    setCycle(updated);
    return updated;
  }, [companyId, cycleId, user?.uid]);

  const closeCycle = useCallback(async (): Promise<OKRCyclePeriod> => {
    if (!companyId || !cycleId || !user?.uid) {
      throw new Error('Company, cycle, or user not available');
    }
    const closed = await okrService.updateCycle(companyId, cycleId, { status: 'closed' }, user.uid);
    setCycle(closed);
    return closed;
  }, [companyId, cycleId, user?.uid]);

  // Computed values
  const daysRemaining = useMemo(() => {
    if (!cycle) return null;
    const now = new Date();
    const end = cycle.endDate.toDate();
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [cycle]);

  const isActive = cycle?.status === 'active';
  const isPlanning = cycle?.status === 'planning';
  const isReview = cycle?.status === 'review';
  const isClosed = cycle?.status === 'closed';

  const progressPercentage = useMemo(() => {
    if (!cycle) return 0;
    const now = new Date();
    const start = cycle.startDate.toDate();
    const end = cycle.endDate.toDate();
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  }, [cycle]);

  return {
    cycle,
    analytics,
    loading,
    error,
    refresh,
    refreshAnalytics,
    updateCycle,
    activateCycle,
    startReview,
    closeCycle,
    daysRemaining,
    isActive,
    isPlanning,
    isReview,
    isClosed,
    progressPercentage,
  };
}

// ----------------------------------------------------------------------------
// useActiveCycle Hook - Convenience hook for active cycle
// ----------------------------------------------------------------------------
export function useActiveCycle(options: { companyId: string }) {
  const [cycle, setCycle] = useState<OKRCyclePeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!options.companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await okrService.getActiveCycle(options.companyId);
      setCycle(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch active cycle'));
    } finally {
      setLoading(false);
    }
  }, [options.companyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { cycle, loading, error, refresh };
}
