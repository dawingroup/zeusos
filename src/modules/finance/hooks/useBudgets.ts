// ============================================================================
// USE BUDGETS HOOK
// DawinOS v2.0 - Financial Management Module
// Hook for managing budget list and filtering
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { budgetService } from '../services/budgetService';
import {
  Budget,
  BudgetFilters,
  BudgetQueryResult,
} from '../types/budget.types';
import { BudgetType, BudgetStatus } from '../constants/budget.constants';

interface UseBudgetsOptions {
  companyId: string;
  initialFilters?: BudgetFilters;
  autoLoad?: boolean;
}

interface UseBudgetsReturn {
  // Data
  budgets: Budget[];
  total: number;
  totalBudget: number;
  totalActual: number;
  
  // Loading state
  loading: boolean;
  error: Error | null;
  
  // Filters
  filters: BudgetFilters;
  setFilters: (filters: BudgetFilters) => void;
  updateFilter: <K extends keyof BudgetFilters>(key: K, value: BudgetFilters[K]) => void;
  clearFilters: () => void;
  
  // Actions
  refresh: () => Promise<void>;
  
  // Grouped data
  budgetsByType: Record<BudgetType, Budget[]>;
  budgetsByStatus: Record<BudgetStatus, Budget[]>;
  budgetsByFiscalYear: Record<number, Budget[]>;
  
  // Summary
  activeBudgets: Budget[];
  draftBudgets: Budget[];
  pendingApprovalBudgets: Budget[];
}

export function useBudgets(options: UseBudgetsOptions): UseBudgetsReturn {
  const { companyId, initialFilters = {}, autoLoad = true } = options;
  
  const [result, setResult] = useState<BudgetQueryResult>({
    budgets: [],
    total: 0,
    totalBudget: 0,
    totalActual: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [filters, setFilters] = useState<BudgetFilters>(initialFilters);

  const loadBudgets = useCallback(async () => {
    if (!companyId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await budgetService.getBudgets(companyId, filters);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load budgets'));
    } finally {
      setLoading(false);
    }
  }, [companyId, filters]);

  useEffect(() => {
    if (autoLoad) {
      loadBudgets();
    }
  }, [loadBudgets, autoLoad]);

  const updateFilter = useCallback(<K extends keyof BudgetFilters>(
    key: K,
    value: BudgetFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Group budgets by type
  const budgetsByType = useMemo(() => {
    const grouped: Record<string, Budget[]> = {};
    result.budgets.forEach(budget => {
      if (!grouped[budget.type]) {
        grouped[budget.type] = [];
      }
      grouped[budget.type].push(budget);
    });
    return grouped as Record<BudgetType, Budget[]>;
  }, [result.budgets]);

  // Group budgets by status
  const budgetsByStatus = useMemo(() => {
    const grouped: Record<string, Budget[]> = {};
    result.budgets.forEach(budget => {
      if (!grouped[budget.status]) {
        grouped[budget.status] = [];
      }
      grouped[budget.status].push(budget);
    });
    return grouped as Record<BudgetStatus, Budget[]>;
  }, [result.budgets]);

  // Group budgets by fiscal year
  const budgetsByFiscalYear = useMemo(() => {
    const grouped: Record<number, Budget[]> = {};
    result.budgets.forEach(budget => {
      if (!grouped[budget.fiscalYear]) {
        grouped[budget.fiscalYear] = [];
      }
      grouped[budget.fiscalYear].push(budget);
    });
    return grouped;
  }, [result.budgets]);

  // Filtered views
  const activeBudgets = useMemo(() => 
    result.budgets.filter(b => b.status === 'active'),
    [result.budgets]
  );

  const draftBudgets = useMemo(() => 
    result.budgets.filter(b => b.status === 'draft'),
    [result.budgets]
  );

  const pendingApprovalBudgets = useMemo(() => 
    result.budgets.filter(b => b.status === 'pending_approval'),
    [result.budgets]
  );

  return {
    budgets: result.budgets,
    total: result.total,
    totalBudget: result.totalBudget,
    totalActual: result.totalActual,
    
    loading,
    error,
    
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    
    refresh: loadBudgets,
    
    budgetsByType,
    budgetsByStatus,
    budgetsByFiscalYear,
    
    activeBudgets,
    draftBudgets,
    pendingApprovalBudgets,
  };
}
