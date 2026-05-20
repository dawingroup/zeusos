/**
 * Portfolio React Hooks
 * 
 * React Query hooks for portfolio management:
 * - Portfolio CRUD operations
 * - NAV management
 * - Allocation tracking
 * - Capital transactions
 * - Performance metrics
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  createPortfolio,
  getPortfolio,
  updatePortfolio,
  deletePortfolio,
  updatePortfolioStatus,
  calculateNAV,
  updateNAV,
  getNAVHistory,
  finalizeNAV,
  setStrategicAllocation,
  analyzeAllocation,
  createCapitalTransaction,
  processCapitalTransaction,
  getCapitalTransactions,
  updateCashPosition,
  createCashForecast,
  manageBankAccount,
  getPortfoliosByClient,
  getPortfoliosByEngagement,
  getActivePortfolios,
  getPortfolioSummaries,
  subscribeToPortfolio,
  subscribeToClientPortfolios,
  subscribeToNAVHistory,
} from '../services/portfolio-service';
import type {
  Portfolio,
  PortfolioStatus,
  CreatePortfolioInput,
  UpdatePortfolioInput,
  CapitalTransaction,
  PortfolioNAV,
  CashPosition,
} from '../types/portfolio';
import type { NAVHistory } from '../types/nav';
import type { StrategicAllocation } from '../types/allocation';
import type { CashForecast, BankAccount } from '../types/cash-management';

// Query keys
export const portfolioKeys = {
  all: ['portfolios'] as const,
  lists: () => [...portfolioKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...portfolioKeys.lists(), filters] as const,
  details: () => [...portfolioKeys.all, 'detail'] as const,
  detail: (id: string) => [...portfolioKeys.details(), id] as const,
  byClient: (clientId: string) => [...portfolioKeys.all, 'byClient', clientId] as const,
  byEngagement: (engagementId: string) => [...portfolioKeys.all, 'byEngagement', engagementId] as const,
  active: () => [...portfolioKeys.all, 'active'] as const,
  summaries: (filters?: Record<string, unknown>) => [...portfolioKeys.all, 'summaries', filters] as const,
  nav: (id: string) => [...portfolioKeys.detail(id), 'nav'] as const,
  navHistory: (id: string) => [...portfolioKeys.detail(id), 'navHistory'] as const,
  allocation: (id: string) => [...portfolioKeys.detail(id), 'allocation'] as const,
  transactions: (id: string) => [...portfolioKeys.detail(id), 'transactions'] as const,
};

// ============================================
// Portfolio CRUD Hooks
// ============================================

export function usePortfolio(portfolioId: string | undefined) {
  return useQuery({
    queryKey: portfolioKeys.detail(portfolioId!),
    queryFn: () => getPortfolio(portfolioId!),
    enabled: !!portfolioId,
  });
}

export function usePortfoliosByClient(clientId: string | undefined) {
  return useQuery({
    queryKey: portfolioKeys.byClient(clientId!),
    queryFn: () => getPortfoliosByClient(clientId!),
    enabled: !!clientId,
  });
}

export function usePortfoliosByEngagement(engagementId: string | undefined) {
  return useQuery({
    queryKey: portfolioKeys.byEngagement(engagementId!),
    queryFn: () => getPortfoliosByEngagement(engagementId!),
    enabled: !!engagementId,
  });
}

export function useActivePortfolios() {
  return useQuery({
    queryKey: portfolioKeys.active(),
    queryFn: () => getActivePortfolios(),
  });
}

export function usePortfolioSummaries(options?: { clientId?: string; status?: PortfolioStatus[] }) {
  return useQuery({
    queryKey: portfolioKeys.summaries(options),
    queryFn: () => getPortfolioSummaries(options),
  });
}

export function useCreatePortfolio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: CreatePortfolioInput) => createPortfolio(input),
    onSuccess: (portfolio) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
      queryClient.invalidateQueries({ queryKey: portfolioKeys.byClient(portfolio.clientId) });
      queryClient.setQueryData(portfolioKeys.detail(portfolio.id), portfolio);
    },
  });
}

export function useUpdatePortfolio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, updates, updatedBy }: { 
      portfolioId: string; 
      updates: UpdatePortfolioInput; 
      updatedBy: string 
    }) => updatePortfolio(portfolioId, updates, updatedBy),
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
    },
  });
}

export function useDeletePortfolio() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (portfolioId: string) => deletePortfolio(portfolioId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
    },
  });
}

export function useUpdatePortfolioStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, newStatus, reason, changedBy }: {
      portfolioId: string;
      newStatus: PortfolioStatus;
      reason: string;
      changedBy: string;
    }) => updatePortfolioStatus(portfolioId, newStatus, reason, changedBy),
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
      queryClient.invalidateQueries({ queryKey: portfolioKeys.lists() });
    },
  });
}

// ============================================
// Real-time Subscription Hooks
// ============================================

export function usePortfolioSubscription(portfolioId: string | undefined) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!portfolioId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToPortfolio(portfolioId, (data) => {
      setPortfolio(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [portfolioId]);
  
  return { data: portfolio, isLoading: loading };
}

export function useClientPortfoliosSubscription(clientId: string | undefined) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!clientId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToClientPortfolios(clientId, (data) => {
      setPortfolios(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [clientId]);
  
  return { data: portfolios, isLoading: loading };
}

// ============================================
// NAV Hooks
// ============================================

export function useCalculateNAV(portfolioId: string | undefined) {
  return useQuery({
    queryKey: portfolioKeys.nav(portfolioId!),
    queryFn: () => calculateNAV(portfolioId!),
    enabled: !!portfolioId,
  });
}

export function useNAVHistory(portfolioId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: portfolioKeys.navHistory(portfolioId!),
    queryFn: () => getNAVHistory(portfolioId!, limit),
    enabled: !!portfolioId,
  });
}

export function useNAVHistorySubscription(portfolioId: string | undefined) {
  const [history, setHistory] = useState<NAVHistory[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!portfolioId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToNAVHistory(portfolioId, (data) => {
      setHistory(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [portfolioId]);
  
  return { data: history, isLoading: loading };
}

export function useUpdateNAV() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, nav, updatedBy }: {
      portfolioId: string;
      nav: PortfolioNAV;
      updatedBy: string;
    }) => updateNAV(portfolioId, nav, updatedBy),
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.nav(portfolioId) });
      queryClient.invalidateQueries({ queryKey: portfolioKeys.navHistory(portfolioId) });
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
    },
  });
}

export function useFinalizeNAV() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, finalizedBy }: {
      portfolioId: string;
      finalizedBy: string;
    }) => finalizeNAV(portfolioId, finalizedBy),
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
    },
  });
}

// ============================================
// Allocation Hooks
// ============================================

export function useAllocationAnalysis(portfolioId: string | undefined) {
  return useQuery({
    queryKey: portfolioKeys.allocation(portfolioId!),
    queryFn: () => analyzeAllocation(portfolioId!),
    enabled: !!portfolioId,
  });
}

export function useSetStrategicAllocation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, allocation, createdBy }: {
      portfolioId: string;
      allocation: Omit<StrategicAllocation, 'id' | 'portfolioId' | 'createdAt'>;
      createdBy: string;
    }) => setStrategicAllocation(portfolioId, allocation, createdBy),
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.allocation(portfolioId) });
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
    },
  });
}

// ============================================
// Capital Transaction Hooks
// ============================================

export function useCapitalTransactions(portfolioId: string | undefined, type?: string) {
  return useQuery({
    queryKey: [...portfolioKeys.transactions(portfolioId!), type],
    queryFn: () => getCapitalTransactions(portfolioId!, type),
    enabled: !!portfolioId,
  });
}

export function useCreateCapitalTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (transaction: Omit<CapitalTransaction, 'id' | 'createdAt'>) => 
      createCapitalTransaction(transaction),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.transactions(transaction.portfolioId) });
    },
  });
}

export function useProcessCapitalTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, transactionId, processedBy }: {
      portfolioId: string;
      transactionId: string;
      processedBy: string;
    }) => processCapitalTransaction(portfolioId, transactionId, processedBy),
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.transactions(portfolioId) });
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
    },
  });
}

// ============================================
// Cash Management Hooks
// ============================================

export function useUpdateCashPosition() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, position, updatedBy }: {
      portfolioId: string;
      position: Partial<CashPosition>;
      updatedBy: string;
    }) => updateCashPosition(portfolioId, position, updatedBy),
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
    },
  });
}

export function useCreateCashForecast() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (forecast: Omit<CashForecast, 'id' | 'createdAt'>) => 
      createCashForecast(forecast),
    onSuccess: (forecast) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(forecast.portfolioId) });
    },
  });
}

export function useManageBankAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, account }: {
      portfolioId: string;
      account: Omit<BankAccount, 'id' | 'createdAt'> & { id?: string };
    }) => manageBankAccount(portfolioId, account),
    onSuccess: (_, { portfolioId }) => {
      queryClient.invalidateQueries({ queryKey: portfolioKeys.detail(portfolioId) });
    },
  });
}

// ============================================
// Derived Data Hooks
// ============================================

export function usePortfolioMetrics(portfolioId: string | undefined) {
  const { data: portfolio, isLoading } = usePortfolio(portfolioId);
  
  if (!portfolio) {
    return { data: null, isLoading };
  }
  
  const metrics = {
    // Capital metrics
    capitalDeployed: portfolio.capitalStructure.calledCapital.amount,
    capitalCommitted: portfolio.capitalStructure.totalCommitted.amount,
    deploymentRate: portfolio.capitalStructure.totalCommitted.amount > 0
      ? (portfolio.capitalStructure.calledCapital.amount / portfolio.capitalStructure.totalCommitted.amount) * 100
      : 0,
    uncalledCapital: portfolio.capitalStructure.uncalledCommitments.amount,
    
    // NAV metrics
    currentNAV: portfolio.currentNAV.netAssetValue.amount,
    navChange: portfolio.currentNAV.navChange.percentage,
    
    // Performance metrics
    netIRR: portfolio.performanceSummary.netIRR,
    netMOIC: portfolio.performanceSummary.netMOIC,
    tvpi: portfolio.performanceSummary.tvpi,
    dpi: portfolio.performanceSummary.dpi,
    
    // Holdings metrics
    activeHoldings: portfolio.holdingsSummary.activeHoldings,
    totalHoldings: portfolio.holdingsSummary.totalHoldings,
    unrealizedGain: portfolio.holdingsSummary.unrealizedGain.amount,
    
    // Concentration
    largestHoldingWeight: portfolio.holdingsSummary.largestHoldingPercentage,
    top5Concentration: portfolio.holdingsSummary.top5Concentration,
    
    // Cash
    availableCash: portfolio.cashPosition?.availableCash?.amount ?? 0,
    
    // Allocation drift
    hasDriftAlerts: (portfolio.allocations.driftAlerts?.length ?? 0) > 0,
    driftAlertCount: portfolio.allocations.driftAlerts?.length ?? 0,
  };
  
  return { data: metrics, isLoading };
}

export function usePortfolioPerformance(portfolioId: string | undefined) {
  const { data: portfolio, isLoading } = usePortfolio(portfolioId);
  const { data: navHistory } = useNAVHistory(portfolioId, 24);
  
  if (!portfolio) {
    return { data: null, isLoading };
  }
  
  const performance = {
    summary: portfolio.performanceSummary,
    
    navTimeSeries: navHistory?.map(h => ({
      date: h.valuationDate.toDate(),
      nav: h.netAssetValue.amount,
      change: h.changeFromPrevious?.percentage ?? 0,
    })) ?? [],
    
    periodReturns: portfolio.performanceSummary.periodReturns,
    pme: portfolio.performanceSummary.pme,
    attribution: portfolio.performanceSummary.attribution,
    volatility: portfolio.performanceSummary.volatility,
  };
  
  return { data: performance, isLoading };
}

export function usePortfolioCompliance(portfolioId: string | undefined) {
  const { data: portfolio, isLoading } = usePortfolio(portfolioId);
  const { data: allocationAnalysis } = useAllocationAnalysis(portfolioId);
  
  if (!portfolio) {
    return { data: null, isLoading };
  }
  
  const checkLimitBreaches = () => {
    const breaches: { type: string; limit: number; actual: number }[] = [];
    const limits = portfolio.capitalStructure.concentrationLimits;
    
    if (limits) {
      if (portfolio.holdingsSummary.largestHoldingPercentage > limits.singleAsset) {
        breaches.push({
          type: 'single_asset',
          limit: limits.singleAsset,
          actual: portfolio.holdingsSummary.largestHoldingPercentage,
        });
      }
    }
    
    return breaches;
  };
  
  const determineOverallStatus = (): 'compliant' | 'warning' | 'breach' => {
    if (allocationAnalysis?.overallDriftStatus === 'breach') return 'breach';
    if (allocationAnalysis?.concentrationAnalysis?.breaches?.length) return 'breach';
    if (allocationAnalysis?.overallDriftStatus === 'warning') return 'warning';
    if (portfolio.allocations.driftAlerts?.some(a => a.severity === 'high')) return 'warning';
    return 'compliant';
  };
  
  const countIssues = (): number => {
    let count = 0;
    count += portfolio.allocations.driftAlerts?.length ?? 0;
    count += allocationAnalysis?.concentrationAnalysis?.breaches?.length ?? 0;
    count += allocationAnalysis?.recommendations?.filter(r => r.priority === 'high').length ?? 0;
    return count;
  };
  
  const compliance = {
    allocationStatus: allocationAnalysis?.overallDriftStatus ?? 'in_range',
    driftAlerts: portfolio.allocations.driftAlerts ?? [],
    rebalancingNeeded: allocationAnalysis?.rebalancingNeeded ?? false,
    recommendations: allocationAnalysis?.recommendations ?? [],
    concentrationBreaches: allocationAnalysis?.concentrationAnalysis?.breaches ?? [],
    limitBreaches: checkLimitBreaches(),
    overallStatus: determineOverallStatus(),
    issueCount: countIssues(),
  };
  
  return { data: compliance, isLoading };
}

export function usePortfolioCapitalSummary(portfolioId: string | undefined) {
  const { data: portfolio, isLoading } = usePortfolio(portfolioId);
  
  if (!portfolio) {
    return { data: null, isLoading };
  }
  
  const cs = portfolio.capitalStructure;
  
  return {
    data: {
      targetSize: cs.targetSize,
      totalCommitted: cs.totalCommitted,
      calledCapital: cs.calledCapital,
      uncalledCommitments: cs.uncalledCommitments,
      paidInCapital: cs.paidInCapital,
      returnedCapital: cs.returnedCapital,
      totalDistributions: cs.totalDistributions,
      
      commitmentRate: cs.targetSize.amount > 0
        ? (cs.totalCommitted.amount / cs.targetSize.amount) * 100
        : 0,
      deploymentRate: cs.totalCommitted.amount > 0
        ? (cs.calledCapital.amount / cs.totalCommitted.amount) * 100
        : 0,
      distributionRate: cs.paidInCapital.amount > 0
        ? (cs.totalDistributions.amount / cs.paidInCapital.amount) * 100
        : 0,
    },
    isLoading,
  };
}
