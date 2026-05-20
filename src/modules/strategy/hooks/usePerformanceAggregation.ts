// ============================================================================
// USE PERFORMANCE AGGREGATION HOOK
// DawinOS v2.0 - CEO Strategy Command Module
// React hook for performance aggregation management
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { aggregationService } from '../services/aggregation.service';
import {
  AggregatedPerformance,
  PerformanceHierarchy,
  PerformanceComparison,
  PerformanceHeatmap,
  PerformanceWeights,
  AggregationInput,
} from '../types/aggregation.types';
import {
  AggregationLevel,
  PerformanceDomain,
  AGGREGATION_LEVELS,
} from '../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface UsePerformanceAggregationOptions {
  companyId: string;
  level: AggregationLevel;
  entityId: string;
  entityName: string;
  fiscalYear: number;
  quarter?: number;
  month?: number;
  weights?: PerformanceWeights;
  includeChildren?: boolean;
  autoFetch?: boolean;
}

export interface UsePerformanceAggregationReturn {
  aggregation: AggregatedPerformance | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  recalculate: () => Promise<AggregatedPerformance>;
  // Computed
  isHealthy: boolean;
  hasWarnings: boolean;
  hasCritical: boolean;
  domainScores: { strategy: number; okr: number; kpi: number; combined: number };
}

// ----------------------------------------------------------------------------
// Hook Implementation
// ----------------------------------------------------------------------------

export function usePerformanceAggregation(
  options: UsePerformanceAggregationOptions
): UsePerformanceAggregationReturn {
  const { user } = useAuth();
  const {
    companyId,
    level,
    entityId,
    entityName,
    fiscalYear,
    quarter,
    month,
    weights,
    includeChildren = false,
    autoFetch = true,
  } = options;

  const [aggregation, setAggregation] = useState<AggregatedPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId || !entityId) return;

    setLoading(true);
    setError(null);

    try {
      const input: AggregationInput = {
        level,
        entityId,
        entityName,
        fiscalYear,
        quarter,
        month,
        weights,
        includeChildren,
      };

      const result = await aggregationService.calculateAggregation(
        companyId,
        input,
        user?.uid || 'system'
      );
      setAggregation(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to calculate aggregation'));
    } finally {
      setLoading(false);
    }
  }, [companyId, level, entityId, entityName, fiscalYear, quarter, month, includeChildren, user?.uid, JSON.stringify(weights)]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  const recalculate = useCallback(async (): Promise<AggregatedPerformance> => {
    if (!companyId || !entityId || !user?.uid) {
      throw new Error('Missing required parameters');
    }

    const input: AggregationInput = {
      level,
      entityId,
      entityName,
      fiscalYear,
      quarter,
      month,
      weights,
      includeChildren,
    };

    const result = await aggregationService.calculateAggregation(companyId, input, user.uid);
    setAggregation(result);
    
    // Save the aggregation
    await aggregationService.saveAggregation(companyId, result);
    
    return result;
  }, [companyId, level, entityId, entityName, fiscalYear, quarter, month, includeChildren, user?.uid, weights]);

  // Computed values
  const isHealthy = useMemo(() => 
    aggregation?.health.overall === 'healthy', 
    [aggregation]
  );

  const hasWarnings = useMemo(() => 
    (aggregation?.health.warningIssues || 0) > 0, 
    [aggregation]
  );

  const hasCritical = useMemo(() => 
    (aggregation?.health.criticalIssues || 0) > 0, 
    [aggregation]
  );

  const domainScores = useMemo(() => ({
    strategy: aggregation?.strategyScore || 0,
    okr: aggregation?.okrScore || 0,
    kpi: aggregation?.kpiScore || 0,
    combined: aggregation?.combinedScore || 0,
  }), [aggregation]);

  return {
    aggregation,
    loading,
    error,
    refresh,
    recalculate,
    isHealthy,
    hasWarnings,
    hasCritical,
    domainScores,
  };
}

// ----------------------------------------------------------------------------
// HIERARCHY HOOK
// ----------------------------------------------------------------------------

export interface UsePerformanceHierarchyOptions {
  companyId: string;
  fiscalYear: number;
  quarter?: number;
  autoFetch?: boolean;
}

export interface UsePerformanceHierarchyReturn {
  hierarchy: PerformanceHierarchy | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function usePerformanceHierarchy(
  options: UsePerformanceHierarchyOptions
): UsePerformanceHierarchyReturn {
  const { companyId, fiscalYear, quarter, autoFetch = true } = options;

  const [hierarchy, setHierarchy] = useState<PerformanceHierarchy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await aggregationService.buildPerformanceHierarchy(
        companyId,
        fiscalYear,
        quarter
      );
      setHierarchy(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to build hierarchy'));
    } finally {
      setLoading(false);
    }
  }, [companyId, fiscalYear, quarter]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  return {
    hierarchy,
    loading,
    error,
    refresh,
  };
}

// ----------------------------------------------------------------------------
// COMPARISON HOOK
// ----------------------------------------------------------------------------

export interface UsePerformanceComparisonOptions {
  companyId: string;
  entityIds: string[];
  domain: PerformanceDomain;
  fiscalYear: number;
  quarter?: number;
  autoFetch?: boolean;
}

export interface UsePerformanceComparisonReturn {
  comparison: PerformanceComparison | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function usePerformanceComparison(
  options: UsePerformanceComparisonOptions
): UsePerformanceComparisonReturn {
  const { companyId, entityIds, domain, fiscalYear, quarter, autoFetch = true } = options;

  const [comparison, setComparison] = useState<PerformanceComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId || entityIds.length < 2) return;

    setLoading(true);
    setError(null);

    try {
      const result = await aggregationService.comparePerformance(
        companyId,
        entityIds,
        domain,
        fiscalYear,
        quarter
      );
      setComparison(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to compare performance'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(entityIds), domain, fiscalYear, quarter]);

  useEffect(() => {
    if (autoFetch && entityIds.length >= 2) {
      refresh();
    }
  }, [refresh, autoFetch, entityIds.length]);

  return {
    comparison,
    loading,
    error,
    refresh,
  };
}

// ----------------------------------------------------------------------------
// HEATMAP HOOK
// ----------------------------------------------------------------------------

export interface UsePerformanceHeatmapOptions {
  companyId: string;
  entityIds: string[];
  domains: PerformanceDomain[];
  fiscalYear: number;
  quarter?: number;
  autoFetch?: boolean;
}

export interface UsePerformanceHeatmapReturn {
  heatmap: PerformanceHeatmap | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function usePerformanceHeatmap(
  options: UsePerformanceHeatmapOptions
): UsePerformanceHeatmapReturn {
  const { companyId, entityIds, domains, fiscalYear, quarter, autoFetch = true } = options;

  const [heatmap, setHeatmap] = useState<PerformanceHeatmap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId || entityIds.length === 0 || domains.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const result = await aggregationService.generateHeatmap(
        companyId,
        entityIds,
        domains,
        fiscalYear,
        quarter
      );
      setHeatmap(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate heatmap'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(entityIds), JSON.stringify(domains), fiscalYear, quarter]);

  useEffect(() => {
    if (autoFetch && entityIds.length > 0 && domains.length > 0) {
      refresh();
    }
  }, [refresh, autoFetch, entityIds.length, domains.length]);

  return {
    heatmap,
    loading,
    error,
    refresh,
  };
}

// ----------------------------------------------------------------------------
// GROUP AGGREGATION HOOK (Convenience)
// ----------------------------------------------------------------------------

export function useGroupPerformance(options: {
  companyId: string;
  fiscalYear: number;
  quarter?: number;
}) {
  return usePerformanceAggregation({
    ...options,
    level: AGGREGATION_LEVELS.GROUP,
    entityId: options.companyId,
    entityName: 'Dawin Group',
    includeChildren: true,
  });
}
