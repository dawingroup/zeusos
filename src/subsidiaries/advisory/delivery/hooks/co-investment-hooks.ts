/**
 * CO-INVESTMENT HOOKS
 *
 * React hooks for program-level co-investment tracking.
 * Wraps CoInvestmentService for fetching, creating, updating, and deleting entries.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';
import { CoInvestmentService } from '../services/co-investment-service';
import type {
  CoInvestmentEntry,
  CoInvestmentSourceType,
  CoInvestmentSummary,
} from '../types/program-budget';
import { computeCoInvestmentSummary } from '../types/program-budget';

// ─────────────────────────────────────────────────────────────────
// HOOK: useCoInvestments
// ─────────────────────────────────────────────────────────────────

interface UseCoInvestmentsResult {
  entries: CoInvestmentEntry[];
  summary: CoInvestmentSummary;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch all co-investment entries for a program with computed summary.
 */
export function useCoInvestments(
  db: Firestore,
  programId: string | null,
  currency: string = 'USD'
): UseCoInvestmentsResult {
  const [entries, setEntries] = useState<CoInvestmentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => CoInvestmentService.getInstance(db), [db]);

  const fetchEntries = useCallback(async () => {
    if (!programId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getEntries(programId);
      setEntries(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch co-investment entries'));
    } finally {
      setLoading(false);
    }
  }, [service, programId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const summary = useMemo(
    () => computeCoInvestmentSummary(entries, currency),
    [entries, currency]
  );

  return { entries, summary, loading, error, refresh: fetchEntries };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useCoInvestmentMutations
// ─────────────────────────────────────────────────────────────────

interface UseCoInvestmentMutationsResult {
  addEntry: (
    programId: string,
    data: {
      projectId: string;
      projectName: string;
      sourceType: CoInvestmentSourceType;
      sourceName: string;
      pledgedAmount: number;
      currency: string;
      conditions?: string;
      isConfirmed?: boolean;
      budgetPeriodId?: string;
      notes?: string;
    }
  ) => Promise<string>;
  updateAmounts: (
    programId: string,
    entryId: string,
    updates: {
      disbursedAmount?: number;
      spentAmount?: number;
      pledgedAmount?: number;
      isConfirmed?: boolean;
      notes?: string;
      projectId?: string;
      projectName?: string;
    }
  ) => Promise<void>;
  deleteEntry: (programId: string, entryId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Mutation hooks for co-investment CRUD operations.
 */
export function useCoInvestmentMutations(
  db: Firestore,
  userId: string
): UseCoInvestmentMutationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => CoInvestmentService.getInstance(db), [db]);

  const addEntry = useCallback(
    async (
      programId: string,
      data: {
        projectId: string;
        projectName: string;
        sourceType: CoInvestmentSourceType;
        sourceName: string;
        pledgedAmount: number;
        currency: string;
        conditions?: string;
        isConfirmed?: boolean;
        budgetPeriodId?: string;
        notes?: string;
      }
    ): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.addEntry(programId, data, userId);
        return id;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to add co-investment entry');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const updateAmounts = useCallback(
    async (
      programId: string,
      entryId: string,
      updates: {
        disbursedAmount?: number;
        spentAmount?: number;
        pledgedAmount?: number;
        isConfirmed?: boolean;
        notes?: string;
        projectId?: string;
        projectName?: string;
      }
    ): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updateAmounts(programId, entryId, updates);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update co-investment entry');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service]
  );

  const deleteEntry = useCallback(
    async (programId: string, entryId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.deleteEntry(programId, entryId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to delete co-investment entry');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service]
  );

  return { addEntry, updateAmounts, deleteEntry, loading, error };
}
