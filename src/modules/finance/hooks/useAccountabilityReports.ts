// ============================================================================
// USE ACCOUNTABILITY REPORTS HOOK
// ZeusOS v2.0 - Financial Management Module
// React hook for accountability report management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { AccountabilityReport } from '../types/operations.types';
import { getAccountabilityReports } from '../services/accountabilityService';

export interface UseAccountabilityReportsOptions {
  companyId: string;
  status?: string;
  autoLoad?: boolean;
}

export interface UseAccountabilityReportsReturn {
  reports: AccountabilityReport[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAccountabilityReports({
  companyId,
  status,
  autoLoad = true,
}: UseAccountabilityReportsOptions): UseAccountabilityReportsReturn {
  const [reports, setReports] = useState<AccountabilityReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAccountabilityReports(companyId, status);
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accountability reports');
    } finally {
      setLoading(false);
    }
  }, [companyId, status]);

  useEffect(() => {
    if (autoLoad && companyId) {
      refresh();
    }
  }, [autoLoad, companyId, refresh]);

  return {
    reports,
    loading,
    error,
    refresh,
  };
}
