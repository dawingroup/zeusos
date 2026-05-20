// ============================================================================
// USE BUDGET VARIANCE HOOK
// DawinOS v2.0 - Financial Management Module
// Hook for budget variance analysis and forecasting
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { budgetService } from '../services/budgetService';
import {
  BudgetVariance,
  BudgetForecast,
  LineVariance,
  VarianceStatus,
} from '../types/budget.types';
import { AccountType } from '../constants/account.constants';

interface UseBudgetVarianceOptions {
  companyId: string;
  budgetId: string;
  asOfDate?: Date;
  autoLoad?: boolean;
}

interface UseBudgetVarianceReturn {
  // Variance data
  variance: BudgetVariance | null;
  forecast: BudgetForecast | null;
  
  // Loading state
  loading: boolean;
  error: Error | null;
  
  // Actions
  refresh: () => Promise<void>;
  generateForecast: () => Promise<void>;
  
  // Filtered views
  linesByStatus: Record<VarianceStatus, LineVariance[]>;
  linesByAccountType: Record<AccountType, LineVariance[]>;
  
  // Summary
  favorableLines: LineVariance[];
  unfavorableLines: LineVariance[];
  criticalLines: LineVariance[];
  
  // Utilization
  utilizationPercent: number;
  ytdUtilizationPercent: number;
}

export function useBudgetVariance(options: UseBudgetVarianceOptions): UseBudgetVarianceReturn {
  const { companyId, budgetId, asOfDate, autoLoad = true } = options;
  
  const [variance, setVariance] = useState<BudgetVariance | null>(null);
  const [forecast, setForecast] = useState<BudgetForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadVariance = useCallback(async () => {
    if (!companyId || !budgetId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await budgetService.calculateBudgetVariance(companyId, budgetId, asOfDate);
      setVariance(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to calculate variance'));
    } finally {
      setLoading(false);
    }
  }, [companyId, budgetId, asOfDate]);

  const loadForecast = useCallback(async () => {
    if (!companyId || !budgetId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await budgetService.generateBudgetForecast(companyId, budgetId, asOfDate);
      setForecast(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate forecast'));
    } finally {
      setLoading(false);
    }
  }, [companyId, budgetId, asOfDate]);

  useEffect(() => {
    if (autoLoad) {
      loadVariance();
    }
  }, [loadVariance, autoLoad]);

  const refresh = useCallback(async () => {
    await loadVariance();
    if (forecast) {
      await loadForecast();
    }
  }, [loadVariance, loadForecast, forecast]);

  // Group lines by variance status
  const linesByStatus = useMemo(() => {
    const grouped: Record<VarianceStatus, LineVariance[]> = {
      favorable: [],
      minor: [],
      moderate: [],
      significant: [],
      critical: [],
    };
    
    variance?.lineVariances.forEach(line => {
      grouped[line.varianceStatus].push(line);
    });
    
    return grouped;
  }, [variance]);

  // Group lines by account type
  const linesByAccountType = useMemo(() => {
    const grouped: Record<string, LineVariance[]> = {};
    
    variance?.lineVariances.forEach(line => {
      if (!grouped[line.accountType]) {
        grouped[line.accountType] = [];
      }
      grouped[line.accountType].push(line);
    });
    
    return grouped as Record<AccountType, LineVariance[]>;
  }, [variance]);

  // Favorable lines (under budget)
  const favorableLines = useMemo(() => 
    variance?.lineVariances.filter(l => l.varianceStatus === 'favorable') || [],
    [variance]
  );

  // Unfavorable lines (over budget)
  const unfavorableLines = useMemo(() => 
    variance?.lineVariances.filter(l => l.varianceStatus !== 'favorable') || [],
    [variance]
  );

  // Critical lines
  const criticalLines = useMemo(() => 
    variance?.lineVariances.filter(l => l.varianceStatus === 'critical') || [],
    [variance]
  );

  // Utilization percentage (actual / budget)
  const utilizationPercent = useMemo(() => {
    if (!variance || variance.totalBudget === 0) return 0;
    return (variance.totalActual / variance.totalBudget) * 100;
  }, [variance]);

  // YTD utilization
  const ytdUtilizationPercent = useMemo(() => {
    if (!forecast) return utilizationPercent;
    if (forecast.ytdBudget === 0) return 0;
    return (forecast.ytdActual / forecast.ytdBudget) * 100;
  }, [forecast, utilizationPercent]);

  return {
    variance,
    forecast,
    
    loading,
    error,
    
    refresh,
    generateForecast: loadForecast,
    
    linesByStatus,
    linesByAccountType,
    
    favorableLines,
    unfavorableLines,
    criticalLines,
    
    utilizationPercent,
    ytdUtilizationPercent,
  };
}
