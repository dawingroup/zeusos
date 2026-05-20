// ============================================================================
// USE PERFORMANCE TRENDS HOOK
// DawinOS v2.0 - CEO Strategy Command Module
// React hook for performance trend analysis
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { performanceSnapshotService } from '../services/performanceSnapshot.service';
import {
  PerformanceTrend,
  TrendDataPoint,
} from '../types/aggregation.types';
import {
  AggregationLevel,
  PerformanceDomain,
  SnapshotFrequency,
  AGGREGATION_DEFAULTS,
  TREND_INDICATORS,
} from '../constants/aggregation.constants';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface UsePerformanceTrendsOptions {
  companyId: string;
  entityId: string;
  entityName: string;
  level: AggregationLevel;
  domain?: PerformanceDomain;
  frequency?: SnapshotFrequency;
  periods?: number;
  autoFetch?: boolean;
}

export interface UsePerformanceTrendsReturn {
  trend: PerformanceTrend | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setDomain: (domain: PerformanceDomain) => void;
  setFrequency: (frequency: SnapshotFrequency) => void;
  // Computed
  isImproving: boolean;
  isDeclining: boolean;
  isStable: boolean;
  latestScore: number | null;
  projectedScore: number | null;
  dataPoints: TrendDataPoint[];
  averageScore: number;
  highestScore: number;
  lowestScore: number;
}

// ----------------------------------------------------------------------------
// Hook Implementation
// ----------------------------------------------------------------------------

export function usePerformanceTrends(
  options: UsePerformanceTrendsOptions
): UsePerformanceTrendsReturn {
  const {
    companyId,
    entityId,
    entityName,
    level,
    domain: initialDomain = 'combined',
    frequency: initialFrequency = 'monthly',
    periods = AGGREGATION_DEFAULTS.TREND_PERIODS,
    autoFetch = true,
  } = options;

  const [trend, setTrend] = useState<PerformanceTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [domain, setDomain] = useState<PerformanceDomain>(initialDomain);
  const [frequency, setFrequency] = useState<SnapshotFrequency>(initialFrequency);

  const refresh = useCallback(async () => {
    if (!companyId || !entityId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await performanceSnapshotService.calculateTrend(
        companyId,
        entityId,
        entityName,
        level,
        domain,
        frequency,
        periods
      );
      setTrend(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to calculate trend'));
    } finally {
      setLoading(false);
    }
  }, [companyId, entityId, entityName, level, domain, frequency, periods]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  // Computed values
  const isImproving = useMemo(
    () => trend?.trend === TREND_INDICATORS.UP || trend?.trend === TREND_INDICATORS.STRONG_UP,
    [trend]
  );

  const isDeclining = useMemo(
    () => trend?.trend === TREND_INDICATORS.DOWN || trend?.trend === TREND_INDICATORS.STRONG_DOWN,
    [trend]
  );

  const isStable = useMemo(
    () => trend?.trend === TREND_INDICATORS.STABLE,
    [trend]
  );

  const dataPoints = useMemo(
    () => trend?.dataPoints || [],
    [trend]
  );

  const latestScore = useMemo(
    () => dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].score : null,
    [dataPoints]
  );

  const projectedScore = useMemo(
    () => trend?.projectedScore ?? null,
    [trend]
  );

  const averageScore = useMemo(() => {
    if (dataPoints.length === 0) return 0;
    return dataPoints.reduce((sum, dp) => sum + dp.score, 0) / dataPoints.length;
  }, [dataPoints]);

  const highestScore = useMemo(() => {
    if (dataPoints.length === 0) return 0;
    return Math.max(...dataPoints.map(dp => dp.score));
  }, [dataPoints]);

  const lowestScore = useMemo(() => {
    if (dataPoints.length === 0) return 0;
    return Math.min(...dataPoints.map(dp => dp.score));
  }, [dataPoints]);

  return {
    trend,
    loading,
    error,
    refresh,
    setDomain,
    setFrequency,
    isImproving,
    isDeclining,
    isStable,
    latestScore,
    projectedScore,
    dataPoints,
    averageScore,
    highestScore,
    lowestScore,
  };
}

// ----------------------------------------------------------------------------
// MULTI-ENTITY TRENDS HOOK
// ----------------------------------------------------------------------------

export interface UseMultiEntityTrendsOptions {
  companyId: string;
  entities: { id: string; name: string; level: AggregationLevel }[];
  domain?: PerformanceDomain;
  frequency?: SnapshotFrequency;
  periods?: number;
  autoFetch?: boolean;
}

export interface UseMultiEntityTrendsReturn {
  trends: Record<string, PerformanceTrend>;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useMultiEntityTrends(
  options: UseMultiEntityTrendsOptions
): UseMultiEntityTrendsReturn {
  const {
    companyId,
    entities,
    domain = 'combined',
    frequency = 'monthly',
    periods = AGGREGATION_DEFAULTS.TREND_PERIODS,
    autoFetch = true,
  } = options;

  const [trends, setTrends] = useState<Record<string, PerformanceTrend>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId || entities.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const results: Record<string, PerformanceTrend> = {};

      for (const entity of entities) {
        const trend = await performanceSnapshotService.calculateTrend(
          companyId,
          entity.id,
          entity.name,
          entity.level,
          domain,
          frequency,
          periods
        );
        results[entity.id] = trend;
      }

      setTrends(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to calculate trends'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(entities), domain, frequency, periods]);

  useEffect(() => {
    if (autoFetch && entities.length > 0) {
      refresh();
    }
  }, [refresh, autoFetch, entities.length]);

  return {
    trends,
    loading,
    error,
    refresh,
  };
}
