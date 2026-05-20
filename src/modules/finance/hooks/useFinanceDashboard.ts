// ============================================================================
// USE FINANCE DASHBOARD HOOK
// DawinOS v2.0 - Financial Management Module
// Composite hook that aggregates data from accounts, budgets, and cash flow
// for the Finance Dashboard page
// ============================================================================

import { useCallback, useMemo } from 'react';
import { useAccounts } from './useAccounts';
import { useBudgets } from './useBudgets';
import { useCashFlow } from './useCashFlow';

interface DashboardMetrics {
  totalCash: number;
  accountCount: number;
  totalBudget: number;
  totalSpent: number;
  budgetUtilization: number;
  activeBudgetCount: number;
  recentTransactionCount: number;
}

interface DashboardBudget {
  id: string;
  name: string;
  category: string;
  spent: number;
  allocated: number;
  utilization: number;
  remaining: number;
}

interface DashboardAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
}

export interface UseFinanceDashboardReturn {
  metrics: DashboardMetrics;
  budgets: DashboardBudget[];
  accounts: DashboardAccount[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFinanceDashboard(companyId: string): UseFinanceDashboardReturn {
  const {
    accounts: rawAccounts,
    loading: accountsLoading,
    error: accountsError,
    refresh: refreshAccounts,
  } = useAccounts({ companyId, autoFetch: true });

  const {
    totalBudget,
    totalActual,
    loading: budgetsLoading,
    error: budgetsError,
    refresh: refreshBudgets,
    activeBudgets,
  } = useBudgets({ companyId, autoLoad: true });

  const {
    transactions,
    isLoading: cashLoading,
    error: cashError,
    loadTransactions,
  } = useCashFlow({ companyId, autoLoad: true });

  // Map accounts to dashboard format
  const accounts: DashboardAccount[] = useMemo(() => {
    return rawAccounts
      .filter(a => a.status === 'active' && a.isPostable)
      .slice(0, 10)
      .map(a => {
        const net = (a.balance?.debit || 0) - (a.balance?.credit || 0);
        return {
          id: a.id,
          name: a.name,
          type: a.type || 'asset',
          balance: Math.abs(net),
        };
      });
  }, [rawAccounts]);

  // Map budgets to dashboard format
  const budgets: DashboardBudget[] = useMemo(() => {
    return activeBudgets.slice(0, 5).map(b => {
      const spent = b.totalActual || 0;
      const allocated = b.totalBudget || 0;
      const utilization = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
      return {
        id: b.id,
        name: b.name,
        category: b.type || 'General',
        spent,
        allocated,
        utilization,
        remaining: allocated - spent,
      };
    });
  }, [activeBudgets]);

  // Compute aggregate metrics
  const metrics: DashboardMetrics = useMemo(() => {
    const totalCash = accounts.reduce((sum, a) => sum + a.balance, 0);
    const utilization = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

    return {
      totalCash,
      accountCount: accounts.length,
      totalBudget,
      totalSpent: totalActual,
      budgetUtilization: utilization,
      activeBudgetCount: activeBudgets.length,
      recentTransactionCount: transactions.length,
    };
  }, [accounts, totalBudget, totalActual, activeBudgets, transactions]);

  const loading = accountsLoading || budgetsLoading || cashLoading;
  const error = accountsError?.message || budgetsError?.message || cashError || null;

  const refresh = useCallback(async () => {
    await Promise.all([
      refreshAccounts(),
      refreshBudgets(),
      loadTransactions(),
    ]);
  }, [refreshAccounts, refreshBudgets, loadTransactions]);

  return {
    metrics,
    budgets,
    accounts,
    loading,
    error,
    refresh,
  };
}
