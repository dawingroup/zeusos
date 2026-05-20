// ============================================================================
// useAccounts HOOK
// DawinOS v2.0 - Financial Management Module
// React hooks for account management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { DocumentSnapshot } from 'firebase/firestore';
import { accountService } from '../services/accountService';
import { useCurrentUserId } from '@/contexts/AuthContext';
import {
  Account,
  AccountTreeNode,
  AccountCreateInput,
  AccountUpdateInput,
  AccountFilter,
  AccountSort,
  TrialBalance,
} from '../types/account.types';

/**
 * Hook options for useAccounts
 */
export interface UseAccountsOptions {
  companyId: string;
  filter?: AccountFilter;
  sort?: AccountSort;
  pageSize?: number;
  autoFetch?: boolean;
}

/**
 * Hook return type for useAccounts
 */
export interface UseAccountsReturn {
  accounts: Account[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  createAccount: (input: AccountCreateInput) => Promise<Account>;
  updateAccount: (id: string, input: AccountUpdateInput) => Promise<Account>;
  deleteAccount: (id: string) => Promise<void>;
}

/**
 * Hook for managing accounts list
 */
export function useAccounts(options: UseAccountsOptions): UseAccountsReturn {
  const { companyId, filter, sort, pageSize = 100, autoFetch = true } = options;
  const userId = useCurrentUserId();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchAccounts = useCallback(async (isLoadMore = false) => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await accountService.getAll(
        companyId,
        filter,
        sort,
        pageSize,
        isLoadMore ? lastDoc || undefined : undefined
      );

      if (isLoadMore) {
        setAccounts((prev) => [...prev, ...result.accounts]);
      } else {
        setAccounts(result.accounts);
      }

      setLastDoc(result.lastDoc);
      setHasMore(result.accounts.length === pageSize);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch accounts'));
    } finally {
      setLoading(false);
    }
  }, [companyId, filter, sort, pageSize, lastDoc]);

  const refresh = useCallback(async () => {
    setLastDoc(null);
    setHasMore(true);
    await fetchAccounts(false);
  }, [fetchAccounts]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    await fetchAccounts(true);
  }, [fetchAccounts, hasMore, loading]);

  const createAccount = useCallback(async (input: AccountCreateInput): Promise<Account> => {
    if (!companyId) throw new Error('Company ID is required');
    const account = await accountService.create(companyId, userId, input);
    setAccounts((prev) => [...prev, account].sort((a, b) => a.code.localeCompare(b.code)));
    return account;
  }, [companyId]);

  const updateAccount = useCallback(async (id: string, input: AccountUpdateInput): Promise<Account> => {
    if (!companyId) throw new Error('Company ID is required');
    const updated = await accountService.update(companyId, id, userId, input);
    setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
    return updated;
  }, [companyId]);

  const deleteAccount = useCallback(async (id: string): Promise<void> => {
    if (!companyId) throw new Error('Company ID is required');
    await accountService.delete(companyId, id, userId);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
  }, [companyId]);

  useEffect(() => {
    if (autoFetch && companyId) {
      fetchAccounts(false);
    }
  }, [autoFetch, companyId, filter, sort]);

  return {
    accounts,
    loading,
    error,
    hasMore,
    refresh,
    loadMore,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}

/**
 * Hook options for useAccountTree
 */
export interface UseAccountTreeOptions {
  companyId: string;
  autoFetch?: boolean;
}

/**
 * Hook return type for useAccountTree
 */
export interface UseAccountTreeReturn {
  tree: AccountTreeNode[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;
  toggleNode: (nodeId: string) => void;
  expandedIds: Set<string>;
}

/**
 * Hook for managing account tree structure
 */
export function useAccountTree(options: UseAccountTreeOptions): UseAccountTreeReturn {
  const { companyId, autoFetch = true } = options;

  const [tree, setTree] = useState<AccountTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchTree = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await accountService.getTree(companyId);
      setTree(result);
      
      // Auto-expand first level
      const firstLevelIds = new Set(result.map((node) => node.id));
      setExpandedIds(firstLevelIds);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch account tree'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const refresh = useCallback(async () => {
    await fetchTree();
  }, [fetchTree]);

  const expandNode = useCallback((nodeId: string) => {
    setExpandedIds((prev) => new Set([...prev, nodeId]));
  }, []);

  const collapseNode = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (autoFetch && companyId) {
      fetchTree();
    }
  }, [autoFetch, companyId]);

  return {
    tree,
    loading,
    error,
    refresh,
    expandNode,
    collapseNode,
    toggleNode,
    expandedIds,
  };
}

/**
 * Hook options for useAccount (single account)
 */
export interface UseAccountOptions {
  companyId: string;
  accountId: string;
  autoFetch?: boolean;
}

/**
 * Hook return type for useAccount
 */
export interface UseAccountReturn {
  account: Account | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  update: (input: AccountUpdateInput) => Promise<Account>;
}

/**
 * Hook for single account
 */
export function useAccount(options: UseAccountOptions): UseAccountReturn {
  const { companyId, accountId, autoFetch = true } = options;
  const userId = useCurrentUserId();

  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!companyId || !accountId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await accountService.getById(companyId, accountId);
      setAccount(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch account'));
    } finally {
      setLoading(false);
    }
  }, [companyId, accountId]);

  const refresh = useCallback(async () => {
    await fetchAccount();
  }, [fetchAccount]);

  const update = useCallback(async (input: AccountUpdateInput): Promise<Account> => {
    if (!companyId || !accountId) throw new Error('Company ID and Account ID are required');
    const updated = await accountService.update(companyId, accountId, userId, input);
    setAccount(updated);
    return updated;
  }, [companyId, accountId]);

  useEffect(() => {
    if (autoFetch && companyId && accountId) {
      fetchAccount();
    }
  }, [autoFetch, companyId, accountId]);

  return {
    account,
    loading,
    error,
    refresh,
    update,
  };
}

/**
 * Hook for trial balance
 */
export interface UseTrialBalanceOptions {
  companyId: string;
  asOfDate: Date;
  fiscalYear: number;
  fiscalPeriod?: number;
  autoFetch?: boolean;
}

export interface UseTrialBalanceReturn {
  trialBalance: TrialBalance | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useTrialBalance(options: UseTrialBalanceOptions): UseTrialBalanceReturn {
  const { companyId, asOfDate, fiscalYear, fiscalPeriod, autoFetch = true } = options;
  const userId = useCurrentUserId();

  const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrialBalance = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await accountService.generateTrialBalance(
        companyId,
        userId,
        asOfDate,
        fiscalYear,
        fiscalPeriod
      );
      setTrialBalance(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate trial balance'));
    } finally {
      setLoading(false);
    }
  }, [companyId, asOfDate, fiscalYear, fiscalPeriod]);

  const refresh = useCallback(async () => {
    await fetchTrialBalance();
  }, [fetchTrialBalance]);

  useEffect(() => {
    if (autoFetch && companyId) {
      fetchTrialBalance();
    }
  }, [autoFetch, companyId, asOfDate, fiscalYear, fiscalPeriod]);

  return {
    trialBalance,
    loading,
    error,
    refresh,
  };
}
