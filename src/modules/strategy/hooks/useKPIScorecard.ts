// ============================================================================
// USE KPI SCORECARD HOOK - DawinOS CEO Strategy Command
// React hook for KPI scorecard management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { kpiService } from '../services/kpi.service';
import {
  KPIScorecard,
  KPIDefinition,
  ScorecardSection,
  ScorecardFilters,
  CreateScorecardInput,
  UpdateScorecardInput,
  CreateScorecardSectionInput,
  UpdateScorecardSectionInput,
} from '../types/kpi.types';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface UseKPIScorecardsOptions {
  companyId: string;
  filters?: ScorecardFilters;
  autoFetch?: boolean;
}

export interface UseKPIScorecardsReturn {
  scorecards: KPIScorecard[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createScorecard: (input: CreateScorecardInput) => Promise<KPIScorecard>;
  updateScorecard: (scorecardId: string, input: UpdateScorecardInput) => Promise<KPIScorecard>;
  deleteScorecard: (scorecardId: string) => Promise<void>;
}

export interface UseKPIScorecardOptions {
  companyId: string;
  scorecardId: string | null;
  autoFetch?: boolean;
}

export interface UseKPIScorecardReturn {
  scorecard: KPIScorecard | null;
  kpis: KPIDefinition[];
  overallScore: number;
  sectionScores: Record<string, number>;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  recalculateScores: () => Promise<void>;
  // Section Management
  addSection: (section: CreateScorecardSectionInput) => Promise<ScorecardSection>;
  updateSection: (sectionId: string, updates: UpdateScorecardSectionInput) => Promise<ScorecardSection>;
  removeSection: (sectionId: string) => Promise<void>;
  reorderSections: (sectionIds: string[]) => Promise<void>;
}

// ----------------------------------------------------------------------------
// useKPIScorecards Hook - For managing multiple scorecards
// ----------------------------------------------------------------------------
export function useKPIScorecards(options: UseKPIScorecardsOptions): UseKPIScorecardsReturn {
  const { user } = useAuth();
  const { companyId, filters, autoFetch = true } = options;

  const [scorecards, setScorecards] = useState<KPIScorecard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await kpiService.getScorecards(companyId, filters);
      setScorecards(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch scorecards'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(filters)]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  const createScorecard = useCallback(
    async (input: CreateScorecardInput): Promise<KPIScorecard> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const scorecard = await kpiService.createScorecard(companyId, input, user.uid);
      setScorecards((prev) => [scorecard, ...prev]);
      return scorecard;
    },
    [companyId, user?.uid]
  );

  const updateScorecard = useCallback(
    async (scorecardId: string, input: UpdateScorecardInput): Promise<KPIScorecard> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await kpiService.updateScorecard(companyId, scorecardId, input, user.uid);
      setScorecards((prev) => prev.map((s) => (s.id === scorecardId ? updated : s)));
      return updated;
    },
    [companyId, user?.uid]
  );

  const deleteScorecard = useCallback(
    async (scorecardId: string): Promise<void> => {
      if (!companyId) {
        throw new Error('Company not available');
      }
      await kpiService.deleteScorecard(companyId, scorecardId);
      setScorecards((prev) => prev.filter((s) => s.id !== scorecardId));
    },
    [companyId]
  );

  return {
    scorecards,
    loading,
    error,
    refresh,
    createScorecard,
    updateScorecard,
    deleteScorecard,
  };
}

// ----------------------------------------------------------------------------
// useKPIScorecard Hook - For managing a single scorecard
// ----------------------------------------------------------------------------
export function useKPIScorecard(options: UseKPIScorecardOptions): UseKPIScorecardReturn {
  const { user } = useAuth();
  const { companyId, scorecardId, autoFetch = true } = options;

  const [scorecard, setScorecard] = useState<KPIScorecard | null>(null);
  const [kpis, setKPIs] = useState<KPIDefinition[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [sectionScores, setSectionScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId || !scorecardId) return;

    setLoading(true);
    setError(null);

    try {
      const [scorecardData, allKPIs] = await Promise.all([
        kpiService.getScorecard(companyId, scorecardId),
        kpiService.getActiveKPIs(companyId),
      ]);

      if (!scorecardData) {
        throw new Error('Scorecard not found');
      }

      setScorecard(scorecardData);

      // Filter KPIs that are in the scorecard
      const scorecardKPIIds = scorecardData.sections.flatMap((s) => s.kpiIds);
      const filteredKPIs = allKPIs.filter((k) => scorecardKPIIds.includes(k.id));
      setKPIs(filteredKPIs);

      // Calculate scores
      const { overallScore: overall, sectionScores: sections } =
        await kpiService.calculateScorecardScore(companyId, scorecardId, filteredKPIs);
      setOverallScore(overall);
      setSectionScores(sections);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch scorecard'));
    } finally {
      setLoading(false);
    }
  }, [companyId, scorecardId]);

  useEffect(() => {
    if (autoFetch && scorecardId) {
      refresh();
    }
  }, [refresh, autoFetch, scorecardId]);

  const recalculateScores = useCallback(async () => {
    if (!companyId || !scorecardId) return;

    try {
      const { overallScore: overall, sectionScores: sections } =
        await kpiService.calculateScorecardScore(companyId, scorecardId, kpis);
      setOverallScore(overall);
      setSectionScores(sections);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to recalculate scores'));
    }
  }, [companyId, scorecardId, kpis]);

  const addSection = useCallback(
    async (section: CreateScorecardSectionInput): Promise<ScorecardSection> => {
      if (!companyId || !scorecardId || !user?.uid) {
        throw new Error('Company, scorecard, or user not available');
      }
      const newSection = await kpiService.addScorecardSection(
        companyId,
        scorecardId,
        section,
        user.uid
      );
      await refresh();
      return newSection;
    },
    [companyId, scorecardId, user?.uid, refresh]
  );

  const updateSection = useCallback(
    async (sectionId: string, updates: UpdateScorecardSectionInput): Promise<ScorecardSection> => {
      if (!companyId || !scorecardId || !user?.uid) {
        throw new Error('Company, scorecard, or user not available');
      }
      const updated = await kpiService.updateScorecardSection(
        companyId,
        scorecardId,
        sectionId,
        updates,
        user.uid
      );
      await refresh();
      return updated;
    },
    [companyId, scorecardId, user?.uid, refresh]
  );

  const removeSection = useCallback(
    async (sectionId: string): Promise<void> => {
      if (!companyId || !scorecardId || !user?.uid) {
        throw new Error('Company, scorecard, or user not available');
      }
      await kpiService.removeScorecardSection(companyId, scorecardId, sectionId, user.uid);
      await refresh();
    },
    [companyId, scorecardId, user?.uid, refresh]
  );

  const reorderSections = useCallback(
    async (sectionIds: string[]): Promise<void> => {
      if (!scorecard || !companyId || !user?.uid) return;

      // Update order for each section
      for (let i = 0; i < sectionIds.length; i++) {
        const section = scorecard.sections.find((s) => s.id === sectionIds[i]);
        if (section && section.order !== i) {
          await kpiService.updateScorecardSection(
            companyId,
            scorecard.id,
            sectionIds[i],
            { order: i } as any,
            user.uid
          );
        }
      }
      await refresh();
    },
    [scorecard, companyId, user?.uid, refresh]
  );

  return {
    scorecard,
    kpis,
    overallScore,
    sectionScores,
    loading,
    error,
    refresh,
    recalculateScores,
    addSection,
    updateSection,
    removeSection,
    reorderSections,
  };
}

// ----------------------------------------------------------------------------
// useKPIAlerts Hook
// ----------------------------------------------------------------------------
export interface UseKPIAlertsOptions {
  companyId: string;
  kpiId?: string;
  autoFetch?: boolean;
}

export interface UseKPIAlertsReturn {
  alerts: any[]; // KPIAlert type
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  resolveAlert: (alertId: string) => Promise<void>;
}

export function useKPIAlerts(options: UseKPIAlertsOptions): UseKPIAlertsReturn {
  const { user } = useAuth();
  const { companyId, kpiId, autoFetch = true } = options;

  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Import kpiDataService dynamically to avoid circular dependency
  const refresh = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const { kpiDataService } = await import('../services/kpiData.service');
      let result;
      if (kpiId) {
        result = await kpiDataService.getAlertsByKPI(companyId, kpiId);
      } else {
        result = await kpiDataService.getActiveAlerts(companyId);
      }
      setAlerts(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch alerts'));
    } finally {
      setLoading(false);
    }
  }, [companyId, kpiId]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  const acknowledgeAlert = useCallback(
    async (alertId: string): Promise<void> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const { kpiDataService } = await import('../services/kpiData.service');
      await kpiDataService.acknowledgeAlert(companyId, alertId, user.uid);
      await refresh();
    },
    [companyId, user?.uid, refresh]
  );

  const resolveAlert = useCallback(
    async (alertId: string): Promise<void> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const { kpiDataService } = await import('../services/kpiData.service');
      await kpiDataService.resolveAlert(companyId, alertId, user.uid);
      await refresh();
    },
    [companyId, user?.uid, refresh]
  );

  return {
    alerts,
    loading,
    error,
    refresh,
    acknowledgeAlert,
    resolveAlert,
  };
}
