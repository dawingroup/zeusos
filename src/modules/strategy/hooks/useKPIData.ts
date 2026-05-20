// ============================================================================
// USE KPI DATA HOOK - DawinOS CEO Strategy Command
// React hook for KPI data point management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { kpiDataService } from '../services/kpiData.service';
import {
  KPIDataPoint,
  KPITrend,
  CreateDataPointInput,
  DataPointFilters,
} from '../types/kpi.types';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface UseKPIDataOptions {
  companyId: string;
  kpiId: string | null;
  filters?: DataPointFilters;
  autoRefresh?: number; // Interval in ms
  autoFetch?: boolean;
}

export interface UseKPIDataReturn {
  dataPoints: KPIDataPoint[];
  latestDataPoint: KPIDataPoint | null;
  trend: KPITrend | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  recordValue: (input: Omit<CreateDataPointInput, 'kpiId'>) => Promise<KPIDataPoint>;
  updateDataPoint: (
    dataPointId: string,
    updates: { value?: number; note?: string; adjustmentReason?: string }
  ) => Promise<KPIDataPoint>;
  loadMoreHistory: () => Promise<void>;
  hasMore: boolean;
}

// ----------------------------------------------------------------------------
// Hook Implementation
// ----------------------------------------------------------------------------
export function useKPIData(options: UseKPIDataOptions): UseKPIDataReturn {
  const { user } = useAuth();
  const { companyId, kpiId, filters, autoRefresh, autoFetch = true } = options;

  const [dataPoints, setDataPoints] = useState<KPIDataPoint[]>([]);
  const [latestDataPoint, setLatestDataPoint] = useState<KPIDataPoint | null>(null);
  const [trend, setTrend] = useState<KPITrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const maxResults = filters?.maxResults || 20;

  // --------------------------------------------------------------------------
  // Fetch Data
  // --------------------------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!companyId || !kpiId) return;

    setLoading(true);
    setError(null);

    try {
      const [points, latest, trendData] = await Promise.all([
        kpiDataService.getDataPoints(companyId, kpiId, {
          ...filters,
          maxResults,
        }),
        kpiDataService.getLatestDataPoint(companyId, kpiId),
        kpiDataService.getKPITrend(companyId, kpiId),
      ]);

      setDataPoints(points);
      setLatestDataPoint(latest);
      setTrend(trendData);
      setOffset(0);
      setHasMore(points.length >= maxResults);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch KPI data'));
    } finally {
      setLoading(false);
    }
  }, [companyId, kpiId, maxResults, JSON.stringify(filters)]);

  useEffect(() => {
    if (autoFetch && kpiId) {
      refresh();
    }
  }, [refresh, autoFetch, kpiId]);

  // Auto-refresh interval
  useEffect(() => {
    if (autoRefresh && autoRefresh > 0 && kpiId) {
      const interval = setInterval(refresh, autoRefresh);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refresh, kpiId]);

  // --------------------------------------------------------------------------
  // Data Operations
  // --------------------------------------------------------------------------
  const recordValue = useCallback(
    async (input: Omit<CreateDataPointInput, 'kpiId'>): Promise<KPIDataPoint> => {
      if (!companyId || !kpiId || !user?.uid) {
        throw new Error('Company, KPI, or user not available');
      }

      const fullInput: CreateDataPointInput = {
        ...input,
        kpiId,
      };

      const dataPoint = await kpiDataService.recordDataPoint(
        companyId,
        fullInput,
        user.uid,
        user.displayName || undefined
      );

      await refresh();
      return dataPoint;
    },
    [companyId, kpiId, user?.uid, user?.displayName, refresh]
  );

  const updateDataPoint = useCallback(
    async (
      dataPointId: string,
      updates: { value?: number; note?: string; adjustmentReason?: string }
    ): Promise<KPIDataPoint> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }

      const updated = await kpiDataService.updateDataPoint(
        companyId,
        dataPointId,
        updates,
        user.uid
      );

      await refresh();
      return updated;
    },
    [companyId, user?.uid, refresh]
  );

  const loadMoreHistory = useCallback(async () => {
    if (!companyId || !kpiId || !hasMore) return;

    const newOffset = offset + maxResults;

    try {
      const morePoints = await kpiDataService.getDataPoints(companyId, kpiId, {
        ...filters,
        maxResults: newOffset + maxResults,
      });

      setDataPoints(morePoints);
      setOffset(newOffset);
      setHasMore(morePoints.length >= newOffset + maxResults);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more data'));
    }
  }, [companyId, kpiId, offset, maxResults, hasMore, JSON.stringify(filters)]);

  return {
    dataPoints,
    latestDataPoint,
    trend,
    loading,
    error,
    refresh,
    recordValue,
    updateDataPoint,
    loadMoreHistory,
    hasMore,
  };
}

// ----------------------------------------------------------------------------
// COMPARISON HOOK
// ----------------------------------------------------------------------------
export interface UseKPIComparisonOptions {
  companyId: string;
  kpiId: string;
  currentPeriod: { startDate: Date; endDate: Date };
  previousPeriod: { startDate: Date; endDate: Date };
}

export interface UseKPIComparisonReturn {
  currentAvg: number;
  previousAvg: number;
  change: number;
  changePercent: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useKPIComparison(options: UseKPIComparisonOptions): UseKPIComparisonReturn {
  const { companyId, kpiId, currentPeriod, previousPeriod } = options;

  const [data, setData] = useState({
    currentAvg: 0,
    previousAvg: 0,
    change: 0,
    changePercent: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId || !kpiId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await kpiDataService.compareKPIPerformance(
        companyId,
        kpiId,
        currentPeriod,
        previousPeriod
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to compare KPI data'));
    } finally {
      setLoading(false);
    }
  }, [companyId, kpiId, JSON.stringify(currentPeriod), JSON.stringify(previousPeriod)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...data,
    loading,
    error,
    refresh,
  };
}
