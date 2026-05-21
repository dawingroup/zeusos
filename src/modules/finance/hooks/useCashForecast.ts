// ============================================================================
// USE CASH FORECAST HOOK
// ZeusOS v2.0 - Financial Management Module
// React hook for cash flow forecasting
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useCurrentUserId } from '@/contexts/AuthContext';
import {
  CashForecast,
  ForecastInput,
  CashForecastPeriod,
  BankReconciliation,
  ReconciliationInput,
} from '../types/cashflow.types';
import {
  createCashForecast,
  getCashForecast,
  getCashForecasts,
  updateForecastPeriod,
  createBankReconciliation,
  getBankReconciliation,
  getBankReconciliations,
  reconcileTransaction,
  completeReconciliation,
} from '../services/cashflowService';
import { ForecastHorizon } from '../constants/cashflow.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface UseCashForecastOptions {
  companyId: string;
  autoLoad?: boolean;
}

interface UseCashForecastReturn {
  // Forecast data
  forecasts: CashForecast[];
  currentForecast: CashForecast | null;
  
  // Reconciliation data
  reconciliations: BankReconciliation[];
  currentReconciliation: BankReconciliation | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Forecast actions
  loadForecasts: (filters?: { status?: string; horizon?: string }) => Promise<void>;
  loadForecast: (id: string) => Promise<void>;
  createForecast: (input: ForecastInput) => Promise<CashForecast>;
  updatePeriod: (forecastId: string, periodIndex: number, updates: Partial<CashForecastPeriod>) => Promise<void>;
  setActiveForecast: (id: string) => void;
  
  // Reconciliation actions
  loadReconciliations: (bankAccountId?: string) => Promise<void>;
  loadReconciliation: (id: string) => Promise<void>;
  createReconciliation: (input: ReconciliationInput) => Promise<BankReconciliation>;
  matchTransaction: (reconciliationId: string, transactionId: string, bankRef?: string) => Promise<void>;
  completeRecon: (reconciliationId: string) => Promise<void>;
  
  // Helpers
  getDefaultAssumptions: () => ForecastInput['assumptions'];
  calculatePeriodCount: (horizon: ForecastHorizon) => number;
}

// ----------------------------------------------------------------------------
// HOOK
// ----------------------------------------------------------------------------

export const useCashForecast = ({
  companyId,
  autoLoad = true,
}: UseCashForecastOptions): UseCashForecastReturn => {
  const userId = useCurrentUserId();
  // Forecast state
  const [forecasts, setForecasts] = useState<CashForecast[]>([]);
  const [currentForecast, setCurrentForecast] = useState<CashForecast | null>(null);
  
  // Reconciliation state
  const [reconciliations, setReconciliations] = useState<BankReconciliation[]>([]);
  const [currentReconciliation, setCurrentReconciliation] = useState<BankReconciliation | null>(null);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load forecasts
  const loadForecasts = useCallback(async (filters?: { status?: string; horizon?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCashForecasts(companyId, filters);
      setForecasts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecasts');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Load single forecast
  const loadForecast = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCashForecast(id);
      setCurrentForecast(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forecast');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Create forecast
  const createForecast = useCallback(async (input: ForecastInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const forecast = await createCashForecast(companyId, input, userId);
      setForecasts(prev => [forecast, ...prev]);
      setCurrentForecast(forecast);
      return forecast;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create forecast');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Update forecast period
  const updatePeriod = useCallback(async (
    forecastId: string,
    periodIndex: number,
    updates: Partial<CashForecastPeriod>
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await updateForecastPeriod(forecastId, periodIndex, updates);
      // Reload the forecast to get updated data
      await loadForecast(forecastId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update period');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadForecast]);
  
  // Set active forecast
  const setActiveForecast = useCallback((id: string) => {
    const forecast = forecasts.find(f => f.id === id);
    if (forecast) {
      setCurrentForecast(forecast);
    }
  }, [forecasts]);
  
  // Load reconciliations
  const loadReconciliations = useCallback(async (bankAccountId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getBankReconciliations(companyId, bankAccountId);
      setReconciliations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reconciliations');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Load single reconciliation
  const loadReconciliation = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getBankReconciliation(id);
      setCurrentReconciliation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reconciliation');
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Create reconciliation
  const createReconciliation = useCallback(async (input: ReconciliationInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const reconciliation = await createBankReconciliation(companyId, input, userId);
      setReconciliations(prev => [reconciliation, ...prev]);
      setCurrentReconciliation(reconciliation);
      return reconciliation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create reconciliation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);
  
  // Match transaction in reconciliation
  const matchTransaction = useCallback(async (
    reconciliationId: string,
    transactionId: string,
    bankRef?: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      await reconcileTransaction(reconciliationId, transactionId, bankRef);
      // Reload to get updated data
      await loadReconciliation(reconciliationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to match transaction');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadReconciliation]);
  
  // Complete reconciliation
  const completeRecon = useCallback(async (reconciliationId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await completeReconciliation(reconciliationId, userId);
      await loadReconciliation(reconciliationId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete reconciliation');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [loadReconciliation]);
  
  // Get default forecast assumptions
  const getDefaultAssumptions = useCallback((): ForecastInput['assumptions'] => {
    return {
      salesGrowthRate: 5,
      collectionDays: 30,
      expenseGrowthRate: 3,
      paymentDays: 30,
      fixedMonthlyCosts: [
        { category: 'salary_wages', description: 'Salaries', amount: 10000000 },
        { category: 'rent_utilities', description: 'Rent', amount: 2000000, dueDay: 1 },
        { category: 'rent_utilities', description: 'Utilities', amount: 500000, dueDay: 15 },
      ],
      oneTimeItems: [],
    };
  }, []);
  
  // Calculate period count based on horizon
  const calculatePeriodCount = useCallback((horizon: ForecastHorizon): number => {
    switch (horizon) {
      case 'weekly':
        return 13; // 13 weeks (quarter)
      case 'monthly':
        return 12; // 12 months (year)
      case 'quarterly':
        return 4; // 4 quarters (year)
      default:
        return 12;
    }
  }, []);
  
  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && companyId) {
      loadForecasts();
      loadReconciliations();
    }
  }, [autoLoad, companyId, loadForecasts, loadReconciliations]);
  
  return {
    forecasts,
    currentForecast,
    reconciliations,
    currentReconciliation,
    isLoading,
    error,
    loadForecasts,
    loadForecast,
    createForecast,
    updatePeriod,
    setActiveForecast,
    loadReconciliations,
    loadReconciliation,
    createReconciliation,
    matchTransaction,
    completeRecon,
    getDefaultAssumptions,
    calculatePeriodCount,
  };
};

export default useCashForecast;
