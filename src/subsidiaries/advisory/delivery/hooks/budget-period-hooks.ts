/**
 * BUDGET PERIOD HOOKS
 *
 * React hooks for calendar-year budget period management,
 * including carry-forward requests.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';
import { BudgetPeriodService } from '../services/budget-period-service';
import type {
  BudgetPeriod,
  CarryForwardRequest,
  CarryForwardStatus,
} from '../types/budget-period';
import type { Money } from '../../core/types/money';

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramBudgetPeriods
// ─────────────────────────────────────────────────────────────────

interface UseProgramBudgetPeriodsResult {
  periods: BudgetPeriod[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch all budget periods for a program.
 */
export function useProgramBudgetPeriods(
  db: Firestore,
  programId: string | null
): UseProgramBudgetPeriodsResult {
  const [periods, setPeriods] = useState<BudgetPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => BudgetPeriodService.getInstance(db), [db]);

  const fetchPeriods = useCallback(async () => {
    if (!programId) {
      setPeriods([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getPeriods(programId);
      setPeriods(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch budget periods'));
    } finally {
      setLoading(false);
    }
  }, [service, programId]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  return { periods, loading, error, refresh: fetchPeriods };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useActiveBudgetPeriod
// ─────────────────────────────────────────────────────────────────

interface UseActiveBudgetPeriodResult {
  period: BudgetPeriod | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Fetch the currently active budget period for a program.
 */
export function useActiveBudgetPeriod(
  db: Firestore,
  programId: string | null
): UseActiveBudgetPeriodResult {
  const [period, setPeriod] = useState<BudgetPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => BudgetPeriodService.getInstance(db), [db]);

  const fetchActivePeriod = useCallback(async () => {
    if (!programId) {
      setPeriod(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getActivePeriod(programId);
      setPeriod(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch active budget period'));
    } finally {
      setLoading(false);
    }
  }, [service, programId]);

  useEffect(() => {
    fetchActivePeriod();
  }, [fetchActivePeriod]);

  return { period, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useCarryForwardRequests
// ─────────────────────────────────────────────────────────────────

interface UseCarryForwardRequestsResult {
  requests: CarryForwardRequest[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch carry-forward requests for a program with optional filters.
 */
export function useCarryForwardRequests(
  db: Firestore,
  programId: string | null,
  options?: { year?: number; status?: CarryForwardStatus }
): UseCarryForwardRequestsResult {
  const [requests, setRequests] = useState<CarryForwardRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => BudgetPeriodService.getInstance(db), [db]);
  const optionsKey = JSON.stringify(options);

  const fetchRequests = useCallback(async () => {
    if (!programId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getCarryForwardRequests(programId, options);
      setRequests(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch carry-forward requests'));
    } finally {
      setLoading(false);
    }
  }, [service, programId, optionsKey]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { requests, loading, error, refresh: fetchRequests };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useBudgetPeriodMutations
// ─────────────────────────────────────────────────────────────────

interface UseBudgetPeriodMutationsResult {
  createPeriod: (programId: string, data: { year: number; allocatedBudget: Money; carryForward?: Money }) => Promise<string>;
  updatePeriod: (programId: string, periodId: string, updates: Partial<BudgetPeriod>) => Promise<void>;
  closePeriod: (programId: string, periodId: string) => Promise<void>;
  activatePeriod: (programId: string, periodId: string) => Promise<void>;
  requestCarryForward: (programId: string, data: Omit<CarryForwardRequest, 'id' | 'requestedBy' | 'requestedAt' | 'createdAt' | 'status'>) => Promise<string>;
  approveCarryForward: (programId: string, requestId: string, notes?: string) => Promise<void>;
  rejectCarryForward: (programId: string, requestId: string, notes?: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Mutation hooks for budget periods and carry-forward requests.
 */
export function useBudgetPeriodMutations(
  db: Firestore,
  userId: string
): UseBudgetPeriodMutationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => BudgetPeriodService.getInstance(db), [db]);

  const createPeriod = useCallback(
    async (
      programId: string,
      data: { year: number; allocatedBudget: Money; carryForward?: Money }
    ): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.createPeriod(programId, data.year, data.allocatedBudget, data.carryForward, userId);
        return id;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to create budget period');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const updatePeriod = useCallback(
    async (programId: string, periodId: string, updates: Partial<BudgetPeriod>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updatePeriod(programId, periodId, updates, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update budget period');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const closePeriod = useCallback(
    async (programId: string, periodId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.closePeriod(programId, periodId, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to close budget period');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const activatePeriod = useCallback(
    async (programId: string, periodId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.activatePeriod(programId, periodId, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to activate budget period');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const requestCarryForward = useCallback(
    async (
      programId: string,
      data: Omit<CarryForwardRequest, 'id' | 'requestedBy' | 'requestedAt' | 'createdAt' | 'status'>
    ): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.requestCarryForward(programId, data, userId);
        return id;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to request carry-forward');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const approveCarryForward = useCallback(
    async (programId: string, requestId: string, notes?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.approveCarryForward(programId, requestId, userId, notes);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to approve carry-forward');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const rejectCarryForward = useCallback(
    async (programId: string, requestId: string, notes?: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.rejectCarryForward(programId, requestId, userId, notes);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to reject carry-forward');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  return {
    createPeriod,
    updatePeriod,
    closePeriod,
    activatePeriod,
    requestCarryForward,
    approveCarryForward,
    rejectCarryForward,
    loading,
    error,
  };
}
