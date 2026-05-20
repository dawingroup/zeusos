// ============================================================================
// useAccountBalance HOOK
// DawinOS v2.0 - Financial Management Module
// React hooks for account balance management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { balanceService } from '../services/balanceService';
import { AccountBalance } from '../types/account.types';
import { formatCurrency, CurrencyCode, DEFAULT_CURRENCY } from '../constants/currency.constants';

/**
 * Hook options for useAccountBalance
 */
export interface UseAccountBalanceOptions {
  companyId: string;
  accountId: string;
  currency?: CurrencyCode;
  autoFetch?: boolean;
}

/**
 * Hook return type for useAccountBalance
 */
export interface UseAccountBalanceReturn {
  balance: AccountBalance | null;
  formattedBalance: string;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching and formatting account balance
 */
export function useAccountBalance(options: UseAccountBalanceOptions): UseAccountBalanceReturn {
  const { companyId, accountId, currency = DEFAULT_CURRENCY, autoFetch = true } = options;

  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!companyId || !accountId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await balanceService.getBalanceAsOf(
        companyId,
        accountId,
        new Date()
      );
      setBalance(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch balance'));
    } finally {
      setLoading(false);
    }
  }, [companyId, accountId]);

  const refresh = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  const formattedBalance = balance
    ? formatCurrency(balance.balance, currency)
    : formatCurrency(0, currency);

  useEffect(() => {
    if (autoFetch && companyId && accountId) {
      fetchBalance();
    }
  }, [autoFetch, companyId, accountId]);

  return {
    balance,
    formattedBalance,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook for balance as of a specific date
 */
export interface UseBalanceAsOfOptions {
  companyId: string;
  accountId: string;
  asOfDate: Date;
  currency?: CurrencyCode;
  autoFetch?: boolean;
}

export interface UseBalanceAsOfReturn {
  balance: AccountBalance | null;
  formattedBalance: string;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useBalanceAsOf(options: UseBalanceAsOfOptions): UseBalanceAsOfReturn {
  const { companyId, accountId, asOfDate, currency = DEFAULT_CURRENCY, autoFetch = true } = options;

  const [balance, setBalance] = useState<AccountBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!companyId || !accountId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await balanceService.getBalanceAsOf(
        companyId,
        accountId,
        asOfDate
      );
      setBalance(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch balance'));
    } finally {
      setLoading(false);
    }
  }, [companyId, accountId, asOfDate]);

  const refresh = useCallback(async () => {
    await fetchBalance();
  }, [fetchBalance]);

  const formattedBalance = balance
    ? formatCurrency(balance.balance, currency)
    : formatCurrency(0, currency);

  useEffect(() => {
    if (autoFetch && companyId && accountId) {
      fetchBalance();
    }
  }, [autoFetch, companyId, accountId, asOfDate]);

  return {
    balance,
    formattedBalance,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook for multiple account balances
 */
export interface UseMultipleBalancesOptions {
  companyId: string;
  accountIds: string[];
  currency?: CurrencyCode;
  autoFetch?: boolean;
}

export interface UseMultipleBalancesReturn {
  balances: Map<string, AccountBalance>;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  getFormattedBalance: (accountId: string) => string;
}

export function useMultipleBalances(options: UseMultipleBalancesOptions): UseMultipleBalancesReturn {
  const { companyId, accountIds, currency = DEFAULT_CURRENCY, autoFetch = true } = options;

  const [balances, setBalances] = useState<Map<string, AccountBalance>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!companyId || accountIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const results = new Map<string, AccountBalance>();
      
      for (const accountId of accountIds) {
        const result = await balanceService.getBalanceAsOf(
          companyId,
          accountId,
          new Date()
        );
        if (result) {
          results.set(accountId, result);
        }
      }
      
      setBalances(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch balances'));
    } finally {
      setLoading(false);
    }
  }, [companyId, accountIds]);

  const refresh = useCallback(async () => {
    await fetchBalances();
  }, [fetchBalances]);

  const getFormattedBalance = useCallback((accountId: string): string => {
    const balance = balances.get(accountId);
    return balance ? formatCurrency(balance.balance, currency) : formatCurrency(0, currency);
  }, [balances, currency]);

  useEffect(() => {
    if (autoFetch && companyId && accountIds.length > 0) {
      fetchBalances();
    }
  }, [autoFetch, companyId, accountIds.join(',')]);

  return {
    balances,
    loading,
    error,
    refresh,
    getFormattedBalance,
  };
}
