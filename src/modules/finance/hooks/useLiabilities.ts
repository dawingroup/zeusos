// ============================================================================
// USE LIABILITIES HOOK
// React hook for liability register, upcoming deadlines, and payments
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Liability } from '../types/optimizer.types';
import { liabilityService } from '../services/liabilityService';

interface UseLiabilitiesOptions {
  companyId: string;
  autoLoad?: boolean;
}

interface UseLiabilitiesReturn {
  liabilities: Liability[];
  upcoming: Liability[];
  overdue: Liability[];
  statutoryDeadlines: ReturnType<typeof liabilityService.getStatutoryDeadlines>;
  totalOutstanding: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markPaid: (liabilityId: string, amount: number, reference: string) => Promise<void>;
}

export function useLiabilities({
  companyId,
  autoLoad = true,
}: UseLiabilitiesOptions): UseLiabilitiesReturn {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [upcoming, setUpcoming] = useState<Liability[]>([]);
  const [overdue, setOverdue] = useState<Liability[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statutoryDeadlines = useMemo(() => liabilityService.getStatutoryDeadlines(), []);

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [all, up, od] = await Promise.all([
        liabilityService.getLiabilities(companyId, { status: 'current' }),
        liabilityService.getUpcomingLiabilities(companyId, 30),
        liabilityService.getOverdueLiabilities(companyId),
      ]);
      setLiabilities(all);
      setUpcoming(up);
      setOverdue(od);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load liabilities');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (autoLoad) {
      loadAll();
    }
  }, [autoLoad, loadAll]);

  const totalOutstanding = useMemo(
    () => liabilities.reduce((sum, l) => sum + (l.amountRemaining || 0), 0),
    [liabilities]
  );

  const markPaid = useCallback(async (liabilityId: string, amount: number, reference: string) => {
    await liabilityService.markPaid(
      companyId,
      liabilityId,
      { amount, reference, method: 'bank_transfer' },
      'user'
    );
    await loadAll();
  }, [companyId, loadAll]);

  return {
    liabilities,
    upcoming,
    overdue,
    statutoryDeadlines,
    totalOutstanding,
    isLoading,
    error,
    refresh: loadAll,
    markPaid,
  };
}
