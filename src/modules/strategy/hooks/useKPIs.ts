// ============================================================================
// USE KPIs HOOK - DawinOS CEO Strategy Command
// React hook for KPI management
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { kpiService } from '../services/kpi.service';
import {
  KPIDefinition,
  KPITarget,
  KPIThreshold,
  KPIAnalytics,
  KPIFilters,
  KPISummary,
  CreateKPIInput,
  UpdateKPIInput,
} from '../types/kpi.types';
import {
  KPI_PERFORMANCE,
  KPI_DEFAULTS,
} from '../constants/kpi.constants';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface UseKPIsOptions {
  companyId: string;
  filters?: KPIFilters;
  activeOnly?: boolean;
  autoFetch?: boolean;
}

export interface UseKPIsReturn {
  kpis: KPIDefinition[];
  analytics: KPIAnalytics | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  // CRUD
  createKPI: (input: CreateKPIInput) => Promise<KPIDefinition>;
  updateKPI: (kpiId: string, input: UpdateKPIInput) => Promise<KPIDefinition>;
  deleteKPI: (kpiId: string) => Promise<void>;
  activateKPI: (kpiId: string) => Promise<KPIDefinition>;
  pauseKPI: (kpiId: string) => Promise<KPIDefinition>;
  archiveKPI: (kpiId: string) => Promise<KPIDefinition>;
  // Target & Thresholds
  updateTarget: (kpiId: string, target: KPITarget) => Promise<KPIDefinition>;
  addThreshold: (kpiId: string, threshold: Omit<KPIThreshold, 'id'>) => Promise<KPIThreshold>;
  updateThreshold: (kpiId: string, thresholdId: string, updates: Partial<KPIThreshold>) => Promise<KPIThreshold>;
  removeThreshold: (kpiId: string, thresholdId: string) => Promise<void>;
  toggleFavorite: (kpiId: string) => Promise<KPIDefinition>;
  // Computed
  summaries: KPISummary[];
  activeKPIs: KPIDefinition[];
  criticalKPIs: KPIDefinition[];
  staleKPIs: KPIDefinition[];
  getKPIById: (kpiId: string) => KPIDefinition | undefined;
}

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------
function kpiToSummary(kpi: KPIDefinition): KPISummary {
  const now = new Date();
  const staleThreshold = KPI_DEFAULTS.STALE_DATA_DAYS * 24 * 60 * 60 * 1000;
  const lastUpdated = kpi.lastDataPointDate?.toDate();
  const isStale = kpi.status === 'active' && (!lastUpdated || now.getTime() - lastUpdated.getTime() > staleThreshold);

  const targetValue = kpi.target?.value ?? 0;
  const currentValue = kpi.currentValue ?? 0;
  const variance = currentValue - targetValue;
  const variancePercent = targetValue !== 0 ? (variance / targetValue) * 100 : 0;

  return {
    id: kpi.id,
    code: kpi.code,
    name: kpi.name,
    category: kpi.category,
    type: kpi.type,
    currentValue: kpi.currentValue,
    targetValue,
    unit: kpi.unit,
    performance: kpi.currentPerformance || KPI_PERFORMANCE.NO_DATA,
    trend: kpi.trendDirection || 'stable',
    variance,
    variancePercent,
    lastUpdated: kpi.lastDataPointDate,
    isStale,
  };
}

// ----------------------------------------------------------------------------
// Hook Implementation
// ----------------------------------------------------------------------------
export function useKPIs(options: UseKPIsOptions): UseKPIsReturn {
  const { user } = useAuth();
  const { companyId, filters, activeOnly = false, autoFetch = true } = options;

  const [kpis, setKPIs] = useState<KPIDefinition[]>([]);
  const [analytics, setAnalytics] = useState<KPIAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // --------------------------------------------------------------------------
  // Fetch KPIs
  // --------------------------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      let result: KPIDefinition[];
      if (activeOnly) {
        result = await kpiService.getActiveKPIs(companyId);
      } else {
        result = await kpiService.getKPIs(companyId, filters);
      }
      setKPIs(result);

      // Fetch analytics
      const analyticsData = await kpiService.getKPIAnalytics(companyId);
      setAnalytics(analyticsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch KPIs'));
    } finally {
      setLoading(false);
    }
  }, [companyId, activeOnly, JSON.stringify(filters)]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------
  const createKPI = useCallback(
    async (input: CreateKPIInput): Promise<KPIDefinition> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const kpi = await kpiService.createKPI(companyId, input, user.uid);
      setKPIs((prev) => [kpi, ...prev]);
      return kpi;
    },
    [companyId, user?.uid]
  );

  const updateKPI = useCallback(
    async (kpiId: string, input: UpdateKPIInput): Promise<KPIDefinition> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await kpiService.updateKPI(companyId, kpiId, input, user.uid);
      setKPIs((prev) => prev.map((k) => (k.id === kpiId ? updated : k)));
      return updated;
    },
    [companyId, user?.uid]
  );

  const deleteKPI = useCallback(
    async (kpiId: string): Promise<void> => {
      if (!companyId) {
        throw new Error('Company not available');
      }
      await kpiService.deleteKPI(companyId, kpiId);
      setKPIs((prev) => prev.filter((k) => k.id !== kpiId));
    },
    [companyId]
  );

  const activateKPI = useCallback(
    async (kpiId: string): Promise<KPIDefinition> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const activated = await kpiService.activateKPI(companyId, kpiId, user.uid);
      setKPIs((prev) => prev.map((k) => (k.id === kpiId ? activated : k)));
      return activated;
    },
    [companyId, user?.uid]
  );

  const pauseKPI = useCallback(
    async (kpiId: string): Promise<KPIDefinition> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const paused = await kpiService.pauseKPI(companyId, kpiId, user.uid);
      setKPIs((prev) => prev.map((k) => (k.id === kpiId ? paused : k)));
      return paused;
    },
    [companyId, user?.uid]
  );

  const archiveKPI = useCallback(
    async (kpiId: string): Promise<KPIDefinition> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const archived = await kpiService.archiveKPI(companyId, kpiId, user.uid);
      setKPIs((prev) => prev.filter((k) => k.id !== kpiId));
      return archived;
    },
    [companyId, user?.uid]
  );

  // --------------------------------------------------------------------------
  // Target & Threshold Operations
  // --------------------------------------------------------------------------
  const updateTarget = useCallback(
    async (kpiId: string, target: KPITarget): Promise<KPIDefinition> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await kpiService.updateTarget(companyId, kpiId, target, user.uid);
      setKPIs((prev) => prev.map((k) => (k.id === kpiId ? updated : k)));
      return updated;
    },
    [companyId, user?.uid]
  );

  const addThreshold = useCallback(
    async (kpiId: string, threshold: Omit<KPIThreshold, 'id'>): Promise<KPIThreshold> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const newThreshold = await kpiService.addThreshold(companyId, kpiId, threshold, user.uid);
      await refresh();
      return newThreshold;
    },
    [companyId, user?.uid, refresh]
  );

  const updateThreshold = useCallback(
    async (kpiId: string, thresholdId: string, updates: Partial<KPIThreshold>): Promise<KPIThreshold> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await kpiService.updateThreshold(companyId, kpiId, thresholdId, updates, user.uid);
      await refresh();
      return updated;
    },
    [companyId, user?.uid, refresh]
  );

  const removeThreshold = useCallback(
    async (kpiId: string, thresholdId: string): Promise<void> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      await kpiService.removeThreshold(companyId, kpiId, thresholdId, user.uid);
      await refresh();
    },
    [companyId, user?.uid, refresh]
  );

  const toggleFavorite = useCallback(
    async (kpiId: string): Promise<KPIDefinition> => {
      const kpi = kpis.find((k) => k.id === kpiId);
      if (!kpi) {
        throw new Error('KPI not found');
      }
      return updateKPI(kpiId, { isFavorite: !kpi.isFavorite });
    },
    [kpis, updateKPI]
  );

  // --------------------------------------------------------------------------
  // Computed Values
  // --------------------------------------------------------------------------
  const summaries = useMemo(() => kpis.map(kpiToSummary), [kpis]);

  const activeKPIs = useMemo(
    () => kpis.filter((k) => k.status === 'active'),
    [kpis]
  );

  const criticalKPIs = useMemo(
    () => kpis.filter((k) => k.currentPerformance === KPI_PERFORMANCE.CRITICAL),
    [kpis]
  );

  const staleKPIs = useMemo(() => {
    const now = new Date();
    const staleThreshold = KPI_DEFAULTS.STALE_DATA_DAYS * 24 * 60 * 60 * 1000;
    return kpis.filter((k) => {
      if (k.status !== 'active') return false;
      const lastUpdated = k.lastDataPointDate?.toDate();
      return !lastUpdated || now.getTime() - lastUpdated.getTime() > staleThreshold;
    });
  }, [kpis]);

  const getKPIById = useCallback(
    (kpiId: string) => kpis.find((k) => k.id === kpiId),
    [kpis]
  );

  return {
    kpis,
    analytics,
    loading,
    error,
    refresh,
    createKPI,
    updateKPI,
    deleteKPI,
    activateKPI,
    pauseKPI,
    archiveKPI,
    updateTarget,
    addThreshold,
    updateThreshold,
    removeThreshold,
    toggleFavorite,
    summaries,
    activeKPIs,
    criticalKPIs,
    staleKPIs,
    getKPIById,
  };
}

// ----------------------------------------------------------------------------
// ADDITIONAL HOOKS
// ----------------------------------------------------------------------------

/**
 * Hook for fetching KPIs by category
 */
export function useKPIsByCategory(options: { companyId: string; category: string }) {
  return useKPIs({
    companyId: options.companyId,
    filters: { category: options.category as any },
  });
}

/**
 * Hook for fetching KPIs linked to a strategy pillar
 */
export function useKPIsByStrategyPillar(options: { companyId: string; pillarId: string }) {
  return useKPIs({
    companyId: options.companyId,
    filters: { linkedStrategyPillarId: options.pillarId },
  });
}

/**
 * Hook for fetching favorite KPIs
 */
export function useFavoriteKPIs(options: { companyId: string }) {
  return useKPIs({
    companyId: options.companyId,
    filters: { favoritesOnly: true },
  });
}
