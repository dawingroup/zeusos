// ============================================================================
// USE SAVINGS HOOK
// React hook for savings balance, history, allocations, and withdrawals
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type { SavingsEntry, SavingsPosition } from '../types/optimizer.types';
import { savingsService } from '../services/savingsService';

interface UseSavingsOptions {
  companyId: string;
  autoLoad?: boolean;
}

interface UseSavingsReturn {
  position: SavingsPosition | null;
  history: SavingsEntry[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  requestWithdrawal: (amount: number, reason: string) => Promise<void>;
  approveWithdrawal: (entryId: string) => Promise<void>;
}

export function useSavings({
  companyId,
  autoLoad = true,
}: UseSavingsOptions): UseSavingsReturn {
  const [position, setPosition] = useState<SavingsPosition | null>(null);
  const [history, setHistory] = useState<SavingsEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [pos, hist] = await Promise.all([
        savingsService.getSavingsBalance(companyId),
        savingsService.getSavingsHistory(companyId, 50),
      ]);
      setPosition(pos);
      setHistory(hist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load savings data');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (autoLoad) {
      loadAll();
    }
  }, [autoLoad, loadAll]);

  const requestWithdrawal = useCallback(async (amount: number, reason: string) => {
    await savingsService.requestWithdrawal(companyId, amount, reason, 'user');
    await loadAll();
  }, [companyId, loadAll]);

  const approveWithdrawal = useCallback(async (entryId: string) => {
    await savingsService.approveWithdrawal(companyId, entryId, 'user');
    await loadAll();
  }, [companyId, loadAll]);

  return {
    position,
    history,
    isLoading,
    error,
    refresh: loadAll,
    requestWithdrawal,
    approveWithdrawal,
  };
}
