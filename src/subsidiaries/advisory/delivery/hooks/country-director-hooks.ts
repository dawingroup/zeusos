/**
 * COUNTRY DIRECTOR DASHBOARD HOOKS
 *
 * React hooks for the Country Director Dashboard with ADD-FIN-001 compliance monitoring.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Firestore } from 'firebase/firestore';
import {
  UnifiedRequisitionSummary,
  CountryDirectorSummary,
  ComplianceAlert,
  UnifiedAgingAnalysis,
  ComplianceScore,
  InvestigationWithCountdown,
  CountryDirectorFilters,
  ProgramOption,
} from '../types/country-director-dashboard';
import {
  getCountryDirectorDashboardService,
} from '../services/country-director-dashboard.service';

// ─────────────────────────────────────────────────────────────────
// HOOK: useAvailablePrograms
// ─────────────────────────────────────────────────────────────────

/**
 * Hook to fetch available programs for the selector
 */
export function useAvailablePrograms(db: Firestore) {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const service = getCountryDirectorDashboardService(db);
      const data = await service.getAvailablePrograms();
      setPrograms(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch programs'));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  return {
    programs,
    loading,
    error,
    refresh: fetchPrograms,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useCountryDirectorDashboard
// ─────────────────────────────────────────────────────────────────

/**
 * Main hook for the Country Director Dashboard
 * Combines all data sources for a unified view
 */
export function useCountryDirectorDashboard(
  db: Firestore,
  programId: string | null,
  filters?: Partial<CountryDirectorFilters>
) {
  const [summary, setSummary] = useState<CountryDirectorSummary | null>(null);
  const [unifiedRequisitions, setUnifiedRequisitions] = useState<UnifiedRequisitionSummary[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<ComplianceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!programId) {
      setSummary(null);
      setUnifiedRequisitions([]);
      setComplianceAlerts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const service = getCountryDirectorDashboardService(db);

      // Fetch all data in parallel
      const [summaryData, requisitionsData, alertsData] = await Promise.all([
        service.getDashboardSummary(programId),
        service.getUnifiedRequisitions(programId, filters),
        service.getComplianceAlerts(programId),
      ]);

      setSummary(summaryData);
      setUnifiedRequisitions(requisitionsData);
      setComplianceAlerts(alertsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch dashboard data'));
    } finally {
      setLoading(false);
    }
  }, [db, programId, filters?.accountabilityStatus, filters?.source, filters?.varianceStatus, filters?.dateRange?.start?.getTime(), filters?.dateRange?.end?.getTime()]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived statistics
  const criticalAlertsCount = useMemo(() => {
    return complianceAlerts.filter(a => a.severity === 'critical').length;
  }, [complianceAlerts]);

  const warningAlertsCount = useMemo(() => {
    return complianceAlerts.filter(a => a.severity === 'warning').length;
  }, [complianceAlerts]);

  return {
    summary,
    unifiedRequisitions,
    complianceAlerts,
    criticalAlertsCount,
    warningAlertsCount,
    loading,
    error,
    refresh: fetchData,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useComplianceOverview
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for compliance score and breakdown
 */
export function useComplianceOverview(
  db: Firestore,
  programId: string | null
) {
  const [complianceScore, setComplianceScore] = useState<ComplianceScore | null>(null);
  const [investigations, setInvestigations] = useState<InvestigationWithCountdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!programId) {
      setComplianceScore(null);
      setInvestigations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const service = getCountryDirectorDashboardService(db);

      const [scoreData, investigationsData] = await Promise.all([
        service.calculateComplianceScore(programId),
        service.getActiveInvestigations(programId),
      ]);

      setComplianceScore(scoreData);
      setInvestigations(investigationsData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch compliance data'));
    } finally {
      setLoading(false);
    }
  }, [db, programId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derived statistics
  const overdueInvestigations = useMemo(() => {
    return investigations.filter(i => i.isOverdue);
  }, [investigations]);

  const activeInvestigations = useMemo(() => {
    return investigations.filter(i => !i.isOverdue);
  }, [investigations]);

  return {
    complianceScore,
    investigations,
    overdueInvestigations,
    activeInvestigations,
    loading,
    error,
    refresh: fetchData,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useUnifiedAccountabilityAging
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for unified aging analysis
 */
export function useUnifiedAccountabilityAging(
  db: Firestore,
  programId: string | null
) {
  const [aging, setAging] = useState<UnifiedAgingAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!programId) {
      setAging(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const service = getCountryDirectorDashboardService(db);
      const agingData = await service.getUnifiedAging(programId);
      setAging(agingData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch aging data'));
    } finally {
      setLoading(false);
    }
  }, [db, programId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    aging,
    buckets: aging?.buckets || [],
    totalPending: aging?.totalPending || { count: 0, amount: 0 },
    manualTotal: aging?.manualTotal || { count: 0, amount: 0 },
    systemTotal: aging?.systemTotal || { count: 0, amount: 0 },
    loading,
    error,
    refresh: fetchData,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useVarianceInvestigations
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for variance investigation tracking
 */
export function useVarianceInvestigations(
  db: Firestore,
  programId: string | null
) {
  const [investigations, setInvestigations] = useState<InvestigationWithCountdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!programId) {
      setInvestigations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const service = getCountryDirectorDashboardService(db);
      const data = await service.getActiveInvestigations(programId);
      setInvestigations(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch investigations'));
    } finally {
      setLoading(false);
    }
  }, [db, programId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Categorize investigations
  const active = useMemo(() => {
    return investigations.filter(i => i.status === 'pending' || i.status === 'in_progress');
  }, [investigations]);

  const overdue = useMemo(() => {
    return investigations.filter(i => i.isOverdue);
  }, [investigations]);

  const completed = useMemo(() => {
    return investigations.filter(i => i.status === 'completed');
  }, [investigations]);

  return {
    investigations,
    active,
    overdue,
    completed,
    loading,
    error,
    refresh: fetchData,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramSelector
// ─────────────────────────────────────────────────────────────────

/**
 * Hook for program selection state management
 */
export function useProgramSelector(db: Firestore) {
  const { programs, loading: programsLoading, error: programsError, refresh } = useAvailablePrograms(db);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  // Auto-select first program when loaded
  useEffect(() => {
    if (programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(programs[0].id);
    }
  }, [programs, selectedProgramId]);

  const selectedProgram = useMemo(() => {
    return programs.find(p => p.id === selectedProgramId) || null;
  }, [programs, selectedProgramId]);

  return {
    programs,
    selectedProgramId,
    selectedProgram,
    setSelectedProgramId,
    loading: programsLoading,
    error: programsError,
    refresh,
  };
}
