/**
 * React hook for the monthly payroll run flow.
 *
 *   - listMonthlyRuns / load(runId) — read
 *   - generate(input) — fan-out create
 *   - bulk actions (calculateAll / submitAllForReview / approveAll /
 *     payAll / cancelAll) — fan a single user action across all
 *     applicable sub-batches and refresh the cached run
 */

import { useCallback, useEffect, useState } from 'react';
import { useCurrentUserId } from '@/contexts/AuthContext';

import {
  generateMonthlyRun,
  getMonthlyRun,
  listMonthlyRuns,
  recomputeAggregates,
  calculateAllSubBatches,
  submitAllForReview,
  approveAllAtLevel,
  payAllSubBatches,
  cancelAllSubBatches,
} from '../services/monthly-payroll-run.service';
import type {
  MonthlyPayrollRun,
  CreateMonthlyPayrollRunInput,
} from '../types/monthly-payroll-run.types';

interface UseMonthlyPayrollRunsReturn {
  runs: MonthlyPayrollRun[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  generate: (input: CreateMonthlyPayrollRunInput) => Promise<MonthlyPayrollRun>;
}

export function useMonthlyPayrollRuns(filters?: { year?: number }): UseMonthlyPayrollRunsReturn {
  const userId = useCurrentUserId();
  const [runs, setRuns] = useState<MonthlyPayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMonthlyRuns(filters);
      setRuns(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch monthly payroll runs');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters?.year]);

  useEffect(() => { fetch(); }, [fetch]);

  const generate = useCallback(async (input: CreateMonthlyPayrollRunInput) => {
    const run = await generateMonthlyRun(input, userId);
    setRuns(prev => [run, ...prev]);
    return run;
  }, [userId]);

  return { runs, loading, error, refetch: fetch, generate };
}

interface UseMonthlyPayrollRunReturn {
  run: MonthlyPayrollRun | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  calculateAll: () => Promise<void>;
  submitAll: () => Promise<void>;
  approveAll: (level: 'hr' | 'finance' | 'ceo', comments?: string) => Promise<void>;
  payAll: () => Promise<void>;
  cancelAll: (reason?: string) => Promise<void>;
}

export function useMonthlyPayrollRun(runId: string | undefined): UseMonthlyPayrollRunReturn {
  const userId = useCurrentUserId();
  const [run, setRun] = useState<MonthlyPayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMonthlyRun(runId);
      setRun(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch run');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { fetch(); }, [fetch]);

  const refreshAfter = async (op: () => Promise<unknown>) => {
    if (!runId) return;
    try {
      await op();
      await recomputeAggregates(runId);
      await fetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk action failed');
      throw e;
    }
  };

  return {
    run,
    loading,
    error,
    refetch: fetch,
    calculateAll: () => refreshAfter(() => calculateAllSubBatches(runId!, userId)),
    submitAll: () => refreshAfter(() => submitAllForReview(runId!, userId)),
    approveAll: (level, comments) =>
      refreshAfter(() => approveAllAtLevel(runId!, level, userId, '', comments)),
    payAll: () => refreshAfter(() => payAllSubBatches(runId!, userId)),
    cancelAll: (reason) => refreshAfter(() => cancelAllSubBatches(runId!, userId, '', reason)),
  };
}
