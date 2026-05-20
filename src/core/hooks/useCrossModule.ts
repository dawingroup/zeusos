import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ModuleId } from '@/integration/constants';
import type { CrossModuleMetric, CrossModuleSummary } from '@/integration/types';
import {
  getAllModuleSummaries,
  getCrossModuleMetrics,
  getRecentActivity,
  type ActivityEntry,
} from '@/core/services/crossModuleService';

export interface UseCrossModuleOptions {
  organizationId: string;
  userId?: string;
}

export function useCrossModule({ organizationId, userId }: UseCrossModuleOptions) {
  const [moduleSummaries, setModuleSummaries] = useState<Record<ModuleId, CrossModuleSummary> | null>(null);
  const [metrics, setMetrics] = useState<CrossModuleMetric[] | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    setError(null);

    try {
      const [summaries, metricsData, activity] = await Promise.all([
        getAllModuleSummaries(organizationId),
        getCrossModuleMetrics(organizationId),
        getRecentActivity(organizationId, userId, undefined, 20),
      ]);

      setModuleSummaries(summaries);
      setMetrics(metricsData);
      setRecentActivity(activity);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load cross-module data'));
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const byModule = useMemo(() => {
    const map = new Map<ModuleId, CrossModuleMetric[]>();
    (metrics || []).forEach((m) => {
      const list = map.get(m.module) || [];
      list.push(m);
      map.set(m.module, list);
    });
    return map;
  }, [metrics]);

  return {
    moduleSummaries,
    metrics,
    metricsByModule: byModule,
    recentActivity,
    loading,
    error,
    refresh,
  };
}
