/**
 * Variance Hooks
 * React hooks for variance analysis data
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/core/hooks/useAuth';
import {
  calculateProjectVariance,
  getVarianceTrends,
  getCachedVarianceSummary,
  cacheVarianceSummary,
  filterMaterialVariances,
} from '../services/varianceService';
import type {
  ProjectVarianceSummary,
  VarianceFilters,
  VarianceThresholds,
  VarianceTrend,
  CostTrend,
} from '../types/variance';
import { DEFAULT_THRESHOLDS } from '../types/variance';

const DEFAULT_ORG_ID = 'default';

// ============================================================================
// PROJECT VARIANCE HOOK
// ============================================================================

export function useProjectVariance(
  projectId: string | undefined,
  thresholds: VarianceThresholds = DEFAULT_THRESHOLDS,
  options?: {
    useCached?: boolean;
    cacheMaxAgeMinutes?: number;
  }
) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [summary, setSummary] = useState<ProjectVarianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadVariance = useCallback(async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Try cached first
      if (options?.useCached !== false) {
        const cached = await getCachedVarianceSummary(
          projectId,
          options?.cacheMaxAgeMinutes ?? 15,
          orgId
        );
        if (cached) {
          setSummary(cached);
          setLoading(false);
          return;
        }
      }

      // Calculate fresh
      const result = await calculateProjectVariance(projectId, thresholds, orgId);
      setSummary(result);

      // Cache in background
      cacheVarianceSummary(projectId, result, orgId).catch(console.error);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [projectId, thresholds, options?.useCached, options?.cacheMaxAgeMinutes, orgId]);

  useEffect(() => {
    loadVariance();
  }, [loadVariance]);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const result = await calculateProjectVariance(projectId, thresholds, orgId);
      setSummary(result);
      await cacheVarianceSummary(projectId, result, orgId);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [projectId, thresholds, orgId]);

  return { summary, loading, error, refresh };
}

// ============================================================================
// VARIANCE TRENDS HOOK
// ============================================================================

export function useVarianceTrends(
  projectId: string | undefined,
  days: number = 30
) {
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [trends, setTrends] = useState<{ quantity: VarianceTrend[]; cost: CostTrend[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const loadTrends = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getVarianceTrends(projectId, days, orgId);
        setTrends(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    loadTrends();
  }, [projectId, days, orgId]);

  return { trends, loading, error };
}

// ============================================================================
// FILTERED MATERIALS HOOK
// ============================================================================

export function useFilteredMaterialVariances(
  projectId: string | undefined,
  filters: VarianceFilters = {}
) {
  const { summary, loading, error, refresh } = useProjectVariance(projectId);

  const filteredMaterials = useMemo(() => {
    if (!summary) return [];
    const allMaterials = summary.stages.flatMap(s => s.materials);
    return filterMaterialVariances(allMaterials, filters);
  }, [summary, filters]);

  return {
    materials: filteredMaterials,
    summary,
    loading,
    error,
    refresh,
  };
}

// ============================================================================
// DASHBOARD METRICS HOOK
// ============================================================================

export function useDashboardMetrics(projectId: string | undefined) {
  const { summary, loading, error, refresh } = useProjectVariance(projectId);
  const { trends } = useVarianceTrends(projectId, 30);

  const metrics = useMemo(() => {
    if (!summary) return null;

    return {
      totalBudget: summary.totalPlannedCost,
      totalSpent: summary.totalActualCost,
      totalCommitted: summary.totalCommittedCost,
      budgetRemaining: summary.totalPlannedCost - summary.totalCommittedCost,
      costVariance: summary.costVariance,
      costVariancePercent: summary.costVariancePercent,
      fulfillmentPercent: summary.overallFulfillmentPercent,
      acceptanceRate: summary.overallAcceptanceRate,
      materialsOnTrack: summary.materialsFullyProcured + summary.materialsPartiallyProcured,
      materialsAtRisk: summary.materialsNotStarted + summary.materialsOverProcured,
      alertCount: summary.recentAlerts.length,
      criticalAlerts: summary.recentAlerts.filter(a => a.severity === 'critical').length,
    };
  }, [summary]);

  return {
    summary,
    metrics,
    trends,
    loading,
    error,
    refresh,
  };
}

// ============================================================================
// STAGE VARIANCE HOOK
// ============================================================================

export function useStageVariance(projectId: string | undefined, stageId: string | undefined) {
  const { summary, loading, error } = useProjectVariance(projectId);

  const stageVariance = useMemo(() => {
    if (!summary || !stageId) return null;
    return summary.stages.find(s => s.stageId === stageId) || null;
  }, [summary, stageId]);

  return { stageVariance, loading, error };
}
