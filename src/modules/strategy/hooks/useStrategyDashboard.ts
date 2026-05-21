// ============================================================================
// USE STRATEGY DASHBOARD HOOK
// ZeusOS v2.0 - CEO Strategy Command
// Composite hook aggregating OKRs, KPIs, and strategy reviews
// for the Executive Dashboard page
// ============================================================================

import { useMemo } from 'react';
import { useOKRs } from './useOKRs';
import { useKPIs } from './useKPIs';

const COMPANY_ID = 'dawinos';

interface StrategyDashboardMetrics {
  totalOKRs: number;
  activeOKRs: number;
  okrProgress: number;
  totalKPIs: number;
  activeKPIs: number;
  criticalKPIs: number;
  staleKPIs: number;
}

interface OKRSummaryItem {
  id: string;
  title: string;
  progress: number;
  status: string;
  keyResultCount: number;
}

interface KPISummaryItem {
  id: string;
  name: string;
  currentValue: number | null;
  status: string;
  category: string;
}

export interface UseStrategyDashboardReturn {
  metrics: StrategyDashboardMetrics;
  topOKRs: OKRSummaryItem[];
  topKPIs: KPISummaryItem[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useStrategyDashboard(): UseStrategyDashboardReturn {
  const {
    objectives,
    activeObjectives,
    totalProgress,
    loading: okrLoading,
    error: okrError,
    refresh: refreshOKRs,
  } = useOKRs({ companyId: COMPANY_ID, autoFetch: true });

  const {
    kpis,
    activeKPIs,
    criticalKPIs,
    staleKPIs,
    loading: kpiLoading,
    error: kpiError,
    refresh: refreshKPIs,
  } = useKPIs({ companyId: COMPANY_ID, autoFetch: true });

  const metrics: StrategyDashboardMetrics = useMemo(() => ({
    totalOKRs: objectives.length,
    activeOKRs: activeObjectives.length,
    okrProgress: Math.round(totalProgress),
    totalKPIs: kpis.length,
    activeKPIs: activeKPIs.length,
    criticalKPIs: criticalKPIs.length,
    staleKPIs: staleKPIs.length,
  }), [objectives, activeObjectives, totalProgress, kpis, activeKPIs, criticalKPIs, staleKPIs]);

  const topOKRs: OKRSummaryItem[] = useMemo(() => {
    return activeObjectives.slice(0, 5).map(o => ({
      id: o.id,
      title: o.title,
      progress: o.progress || 0,
      status: o.status,
      keyResultCount: o.keyResults?.length || 0,
    }));
  }, [activeObjectives]);

  const topKPIs: KPISummaryItem[] = useMemo(() => {
    return activeKPIs.slice(0, 5).map(k => ({
      id: k.id,
      name: k.name,
      currentValue: k.currentValue ?? null,
      status: k.status,
      category: k.category,
    }));
  }, [activeKPIs]);

  const loading = okrLoading || kpiLoading;
  const error = okrError?.message || kpiError?.message || null;

  const refresh = async () => {
    await Promise.all([refreshOKRs(), refreshKPIs()]);
  };

  return { metrics, topOKRs, topKPIs, loading, error, refresh };
}
