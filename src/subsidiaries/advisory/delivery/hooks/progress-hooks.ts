/**
 * PROGRESS HOOKS
 * 
 * React hooks for progress tracking operations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';
import {
  PlannedProgress,
  ProgressVariance,
  WorkPackageTracker,
} from '../types/progress-tracking';
import { SiteVisit, SiteVisitFormData } from '../types/site-visit';
import { ProgressService } from '../services/progress-service';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface ChartDataPoint {
  week: number;
  date: Date;
  planned: number;
  actual?: number;
  variance: number;
}

interface ProgressAnalysisResult {
  variance: ProgressVariance | null;
  plannedProgress: PlannedProgress | null;
  chartData: ChartDataPoint[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

interface WorkPackagesResult {
  workPackages: WorkPackageTracker[];
  updateProgress: (
    workPackageId: string,
    progress: number,
    notes: string
  ) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

interface SiteVisitsResult {
  visits: SiteVisit[];
  loading: boolean;
  error: Error | null;
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgressAnalysis
// ─────────────────────────────────────────────────────────────────

export function useProgressAnalysis(
  db: Firestore,
  projectId: string | null
): ProgressAnalysisResult {
  const [variance, setVariance] = useState<ProgressVariance | null>(null);
  const [plannedProgress, setPlannedProgress] = useState<PlannedProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgressService.getInstance(db), [db]);

  const loadAnalysis = useCallback(async () => {
    if (!projectId) {
      setVariance(null);
      setPlannedProgress(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const varianceData = await service.calculateVariance(projectId);
      setVariance(varianceData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load analysis'));
    } finally {
      setLoading(false);
    }
  }, [service, projectId]);

  useEffect(() => {
    loadAnalysis();
  }, [loadAnalysis]);

  // Chart data for S-curve visualization
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!plannedProgress) return [];

    return plannedProgress.weeklyProgress.map(w => ({
      week: w.weekNumber,
      date: w.weekStartDate,
      planned: w.plannedCumulative,
      actual: w.actualCumulative,
      variance: (w.actualCumulative || 0) - w.plannedCumulative,
    }));
  }, [plannedProgress]);

  return { variance, plannedProgress, chartData, loading, error, refresh: loadAnalysis };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useWorkPackages
// ─────────────────────────────────────────────────────────────────

export function useWorkPackages(
  db: Firestore,
  projectId: string | null,
  userId: string
): WorkPackagesResult {
  const [workPackages, setWorkPackages] = useState<WorkPackageTracker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgressService.getInstance(db), [db]);

  useEffect(() => {
    if (!projectId) {
      setWorkPackages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = service.subscribeToWorkPackages(projectId, wps => {
      setWorkPackages(wps);
      setLoading(false);
    });

    return unsubscribe;
  }, [service, projectId]);

  const updateProgress = useCallback(
    async (workPackageId: string, progress: number, notes: string) => {
      if (!projectId) throw new Error('No project selected');

      try {
        await service.updateWorkPackageProgress(
          projectId,
          workPackageId,
          progress,
          notes,
          userId
        );
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to update progress'));
        throw err;
      }
    },
    [service, projectId, userId]
  );

  return { workPackages, updateProgress, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useSiteVisits
// ─────────────────────────────────────────────────────────────────

export function useSiteVisits(
  db: Firestore,
  projectId: string | null
): SiteVisitsResult {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  const service = useMemo(() => ProgressService.getInstance(db), [db]);

  useEffect(() => {
    if (!projectId) {
      setVisits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = service.subscribeToSiteVisits(projectId, data => {
      setVisits(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [service, projectId]);

  return { visits, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useCreateSiteVisit
// ─────────────────────────────────────────────────────────────────

export function useCreateSiteVisit(
  db: Firestore,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgressService.getInstance(db), [db]);

  const createVisit = useCallback(
    async (data: SiteVisitFormData): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.createSiteVisit(data, userId);
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create visit');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const submitVisit = useCallback(
    async (projectId: string, visitId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.submitSiteVisit(projectId, visitId, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to submit visit');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return { createVisit, submitVisit, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useSiteVisitActions
// ─────────────────────────────────────────────────────────────────

export function useSiteVisitActions(
  db: Firestore,
  projectId: string | null,
  visitId: string | null,
  userId: string
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ProgressService.getInstance(db), [db]);

  const resolveIssue = useCallback(
    async (issueId: string, resolution: string): Promise<void> => {
      if (!projectId || !visitId) throw new Error('No visit selected');

      setLoading(true);
      setError(null);

      try {
        await service.resolveIssue(projectId, visitId, issueId, resolution, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to resolve issue');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, visitId, userId]
  );

  const completeActionItem = useCallback(
    async (actionItemId: string, notes: string): Promise<void> => {
      if (!projectId || !visitId) throw new Error('No visit selected');

      setLoading(true);
      setError(null);

      try {
        await service.completeActionItem(projectId, visitId, actionItemId, notes, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to complete action');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [service, projectId, visitId, userId]
  );

  return { resolveIssue, completeActionItem, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgressSummary
// ─────────────────────────────────────────────────────────────────

export function useProgressSummary(
  db: Firestore,
  projectId: string | null
) {
  const { variance, loading: varianceLoading } = useProgressAnalysis(db, projectId);
  const { workPackages, loading: wpLoading } = useWorkPackages(db, projectId, '');
  const { visits, loading: visitsLoading } = useSiteVisits(db, projectId);

  const summary = useMemo(() => {
    if (!variance) return null;

    const completedWPs = workPackages.filter(wp => wp.status === 'completed').length;
    const delayedWPs = workPackages.filter(wp => wp.status === 'delayed').length;
    const blockedWPs = workPackages.filter(wp => wp.status === 'blocked').length;

    const recentVisit = visits[0];
    const openIssues = visits.flatMap(v => v.issues).filter(
      i => i.status === 'open' || i.status === 'in_progress'
    ).length;

    return {
      physical: {
        actual: variance.scheduleVariance.actualProgress,
        planned: variance.scheduleVariance.plannedProgress,
        variance: variance.scheduleVariance.variancePercent,
        status: variance.scheduleVariance.status,
      },
      financial: {
        budgeted: variance.costVariance.plannedCost,
        earned: variance.costVariance.earnedValue,
        actual: variance.costVariance.actualCost,
        cpi: variance.costVariance.cpi,
        spi: variance.costVariance.spi,
      },
      workPackages: {
        total: workPackages.length,
        completed: completedWPs,
        delayed: delayedWPs,
        blocked: blockedWPs,
      },
      forecast: {
        estimateAtCompletion: variance.forecast.estimateAtCompletion,
        forecastEndDate: variance.forecast.forecastEndDate,
        daysSlippage: variance.forecast.daysSlippage,
      },
      siteVisits: {
        total: visits.length,
        lastVisit: recentVisit?.visitDate,
        openIssues,
      },
    };
  }, [variance, workPackages, visits]);

  return {
    summary,
    loading: varianceLoading || wpLoading || visitsLoading,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgressChart
// ─────────────────────────────────────────────────────────────────

export function useProgressChart(
  db: Firestore,
  projectId: string | null
) {
  const { variance, chartData, loading, error } = useProgressAnalysis(db, projectId);

  const chartConfig = useMemo(() => {
    if (!variance) return null;

    const currentWeek = chartData.findIndex(d => {
      const weekEnd = new Date(d.date);
      weekEnd.setDate(weekEnd.getDate() + 7);
      return new Date() < weekEnd;
    });

    return {
      data: chartData,
      currentWeek: currentWeek >= 0 ? currentWeek : chartData.length,
      status: variance.scheduleVariance.status,
      cpi: variance.costVariance.cpi,
      spi: variance.costVariance.spi,
    };
  }, [variance, chartData]);

  return { chartConfig, loading, error };
}
