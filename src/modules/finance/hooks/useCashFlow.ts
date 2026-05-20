// ============================================================================
// USE CASH FLOW HOOK
// DawinOS v2.0 - Financial Management Module
// React hook for cash flow management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useCurrentUserId } from '@/contexts/AuthContext';
import {
  CashTransaction,
  CashTransactionInput,
  CashPosition,
  CashFlowSummary,
  CashFlowFilters,
  CashFlowTrend,
  CashFlowAnalysis,
} from '../types/cashflow.types';
import {
  createCashTransaction,
  getCashTransaction,
  getCashTransactions,
  updateCashTransaction,
  deleteCashTransaction,
  getCashPosition,
  getCashFlowSummary,
  getCashFlowTrends,
  analyzeCashFlow,
} from '../services/cashflowService';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface UseCashFlowOptions {
  companyId: string;
  autoLoad?: boolean;
  defaultFilters?: CashFlowFilters;
}

interface UseCashFlowReturn {
  // Data
  transactions: CashTransaction[];
  position: CashPosition | null;
  summary: CashFlowSummary | null;
  trends: CashFlowTrend[];
  analysis: CashFlowAnalysis | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  filters: CashFlowFilters;
  
  // Actions
  loadTransactions: (filters?: CashFlowFilters) => Promise<void>;
  loadPosition: (asOfDate?: Date) => Promise<void>;
  loadSummary: (startDate: Date, endDate: Date) => Promise<void>;
  loadTrends: (startDate: Date, endDate: Date, interval?: 'weekly' | 'monthly') => Promise<void>;
  loadAnalysis: (startDate: Date, endDate: Date) => Promise<void>;
  
  // CRUD
  createTransaction: (input: CashTransactionInput) => Promise<CashTransaction>;
  updateTransaction: (id: string, updates: Partial<CashTransactionInput>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  
  // Filters
  setFilters: (filters: CashFlowFilters) => void;
  clearFilters: () => void;
  
  // Refresh
  refresh: () => Promise<void>;
}

// ----------------------------------------------------------------------------
// HOOK
// ----------------------------------------------------------------------------

export const useCashFlow = ({
  companyId,
  autoLoad = true,
  defaultFilters = {},
}: UseCashFlowOptions): UseCashFlowReturn => {
  const userId = useCurrentUserId();
  // State
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [position, setPosition] = useState<CashPosition | null>(null);
  const [summary, setSummary] = useState<CashFlowSummary | null>(null);
  const [trends, setTrends] = useState<CashFlowTrend[]>([]);
  const [analysis, setAnalysis] = useState<CashFlowAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CashFlowFilters>(defaultFilters);
  
  // Load transactions
  const loadTransactions = useCallback(async (customFilters?: CashFlowFilters) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCashTransactions(companyId, customFilters || filters);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, filters]);
  
  // Load position
  const loadPosition = useCallback(async (asOfDate?: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCashPosition(companyId, asOfDate);
      setPosition(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load position');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Load summary
  const loadSummary = useCallback(async (startDate: Date, endDate: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCashFlowSummary(companyId, startDate, endDate);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Load trends
  const loadTrends = useCallback(async (
    startDate: Date,
    endDate: Date,
    interval: 'weekly' | 'monthly' = 'monthly'
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCashFlowTrends(companyId, startDate, endDate, interval);
      setTrends(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trends');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Load analysis
  const loadAnalysis = useCallback(async (startDate: Date, endDate: Date) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await analyzeCashFlow(companyId, startDate, endDate);
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Create transaction
  const createTransaction = useCallback(async (input: CashTransactionInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const transaction = await createCashTransaction(companyId, input, userId);
      setTransactions(prev => [transaction, ...prev]);
      return transaction;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Update transaction
  const updateTransaction = useCallback(async (id: string, updates: Partial<CashTransactionInput>) => {
    setIsLoading(true);
    setError(null);
    try {
      await updateCashTransaction(id, updates);
      const updated = await getCashTransaction(id);
      if (updated) {
        setTransactions(prev => prev.map(t => t.id === id ? updated : t));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Delete transaction
  const deleteTransaction = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await deleteCashTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transaction');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Clear filters
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);
  
  // Refresh all data
  const refresh = useCallback(async () => {
    await Promise.all([
      loadTransactions(),
      loadPosition(),
    ]);
  }, [loadTransactions, loadPosition]);
  
  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && companyId) {
      loadTransactions();
      loadPosition();
    }
  }, [autoLoad, companyId, loadTransactions, loadPosition]);
  
  // Reload when filters change
  useEffect(() => {
    if (companyId) {
      loadTransactions(filters);
    }
  }, [filters, companyId, loadTransactions]);
  
  return {
    transactions,
    position,
    summary,
    trends,
    analysis,
    isLoading,
    error,
    filters,
    loadTransactions,
    loadPosition,
    loadSummary,
    loadTrends,
    loadAnalysis,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    setFilters,
    clearFilters,
    refresh,
  };
};

export default useCashFlow;
