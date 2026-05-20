/**
 * Dashboard Hooks
 * Hooks for MatFlow dashboard data
 */

import { useState, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface BudgetSummary {
  budgetAmount: number;
  requisitionedAmount: number;
  orderedAmount: number;
  deliveredAmount: number;
  utilizationPercentage: number;
  variancePercentage: number;
}

export interface ProjectMetrics {
  activeRequisitions: number;
  openPOs: number;
  pendingDeliveries: number;
  overdueDeliveries: number;
  openPOValue: number;
}

// ============================================================================
// USE BUDGET SUMMARY
// ============================================================================

export interface UseBudgetSummaryReturn {
  summary: BudgetSummary | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export const useBudgetSummary = (projectId: string): UseBudgetSummaryReturn => {
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSummary = async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);

    try {
      // Placeholder - will connect to actual service
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setSummary({
        budgetAmount: 500000000,
        requisitionedAmount: 120000000,
        orderedAmount: 80000000,
        deliveredAmount: 45000000,
        utilizationPercentage: 24,
        variancePercentage: -5,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch budget summary'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [projectId]);

  return {
    summary,
    loading,
    error,
    refresh: fetchSummary,
  };
};

// ============================================================================
// USE PROJECT METRICS
// ============================================================================

export interface UseProjectMetricsReturn {
  metrics: ProjectMetrics | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export const useProjectMetrics = (projectId: string): UseProjectMetricsReturn => {
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);

    try {
      // Placeholder - will connect to actual service
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setMetrics({
        activeRequisitions: 12,
        openPOs: 8,
        pendingDeliveries: 5,
        overdueDeliveries: 2,
        openPOValue: 150000000,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch project metrics'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [projectId]);

  return {
    metrics,
    loading,
    error,
    refresh: fetchMetrics,
  };
};

export default {
  useBudgetSummary,
  useProjectMetrics,
};
