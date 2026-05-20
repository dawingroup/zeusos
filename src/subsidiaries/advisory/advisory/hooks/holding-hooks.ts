/**
 * Holding React Hooks
 * 
 * React Query hooks for holding management:
 * - Holding CRUD operations
 * - Transaction management
 * - Valuation tracking
 * - Income recording
 * - Performance metrics
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  createHolding,
  getHolding,
  updateHolding,
  deleteHolding,
  updateHoldingStatus,
  createTransaction,
  processTransaction,
  getTransactions,
  updateValuation,
  getValuationHistory,
  approveValuation,
  recordIncome,
  processIncome,
  getIncomeHistory,
  getHoldingsByPortfolio,
  getHoldingsByDeal,
  getActiveHoldings,
  getHoldingSummaries,
  subscribeToHolding,
  subscribeToPortfolioHoldings,
  subscribeToValuationHistory,
} from '../services/holding-service';
import type {
  Holding,
  HoldingStatus,
  CreateHoldingInput,
  UpdateHoldingInput,
} from '../types/holding';
import type { TransactionType, TransactionCreateInput } from '../types/holding-transaction';
import type { ValuationHistory } from '../types/holding-valuation';
import type { HoldingIncome, IncomeType } from '../types/holding-income';

// Query keys
export const holdingKeys = {
  all: ['holdings'] as const,
  lists: () => [...holdingKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...holdingKeys.lists(), filters] as const,
  details: () => [...holdingKeys.all, 'detail'] as const,
  detail: (id: string) => [...holdingKeys.details(), id] as const,
  byPortfolio: (portfolioId: string) => [...holdingKeys.all, 'byPortfolio', portfolioId] as const,
  byDeal: (dealId: string) => [...holdingKeys.all, 'byDeal', dealId] as const,
  active: () => [...holdingKeys.all, 'active'] as const,
  summaries: (portfolioId?: string) => [...holdingKeys.all, 'summaries', portfolioId] as const,
  transactions: (id: string) => [...holdingKeys.detail(id), 'transactions'] as const,
  valuations: (id: string) => [...holdingKeys.detail(id), 'valuations'] as const,
  income: (id: string) => [...holdingKeys.detail(id), 'income'] as const,
};

// ============================================
// Holding CRUD Hooks
// ============================================

export function useHolding(holdingId: string | undefined) {
  return useQuery({
    queryKey: holdingKeys.detail(holdingId!),
    queryFn: () => getHolding(holdingId!),
    enabled: !!holdingId,
  });
}

export function useHoldingsByPortfolio(portfolioId: string | undefined) {
  return useQuery({
    queryKey: holdingKeys.byPortfolio(portfolioId!),
    queryFn: () => getHoldingsByPortfolio(portfolioId!),
    enabled: !!portfolioId,
  });
}

export function useHoldingsByDeal(dealId: string | undefined) {
  return useQuery({
    queryKey: holdingKeys.byDeal(dealId!),
    queryFn: () => getHoldingsByDeal(dealId!),
    enabled: !!dealId,
  });
}

export function useActiveHoldings() {
  return useQuery({
    queryKey: holdingKeys.active(),
    queryFn: () => getActiveHoldings(),
  });
}

export function useHoldingSummaries(portfolioId?: string) {
  return useQuery({
    queryKey: holdingKeys.summaries(portfolioId),
    queryFn: () => getHoldingSummaries(portfolioId),
  });
}

export function useCreateHolding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: CreateHoldingInput) => createHolding(input),
    onSuccess: (holding) => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: holdingKeys.byPortfolio(holding.portfolioId) });
      queryClient.setQueryData(holdingKeys.detail(holding.id), holding);
    },
  });
}

export function useUpdateHolding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ holdingId, updates, updatedBy }: { 
      holdingId: string; 
      updates: UpdateHoldingInput; 
      updatedBy: string 
    }) => updateHolding(holdingId, updates, updatedBy),
    onSuccess: (_, { holdingId }) => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.detail(holdingId) });
    },
  });
}

export function useDeleteHolding() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (holdingId: string) => deleteHolding(holdingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.lists() });
    },
  });
}

export function useUpdateHoldingStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ holdingId, newStatus, reason, changedBy }: {
      holdingId: string;
      newStatus: HoldingStatus;
      reason: string;
      changedBy: string;
    }) => updateHoldingStatus(holdingId, newStatus, reason, changedBy),
    onSuccess: (_, { holdingId }) => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.detail(holdingId) });
    },
  });
}

// ============================================
// Real-time Subscription Hooks
// ============================================

export function useHoldingSubscription(holdingId: string | undefined) {
  const [holding, setHolding] = useState<Holding | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!holdingId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToHolding(holdingId, (data) => {
      setHolding(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [holdingId]);
  
  return { data: holding, isLoading: loading };
}

export function usePortfolioHoldingsSubscription(portfolioId: string | undefined) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!portfolioId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToPortfolioHoldings(portfolioId, (data) => {
      setHoldings(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [portfolioId]);
  
  return { data: holdings, isLoading: loading };
}

// ============================================
// Transaction Hooks
// ============================================

export function useTransactions(holdingId: string | undefined, type?: TransactionType) {
  return useQuery({
    queryKey: [...holdingKeys.transactions(holdingId!), type],
    queryFn: () => getTransactions(holdingId!, type),
    enabled: !!holdingId,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (input: TransactionCreateInput) => createTransaction(input),
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.transactions(transaction.holdingId) });
      queryClient.invalidateQueries({ queryKey: holdingKeys.detail(transaction.holdingId) });
    },
  });
}

export function useProcessTransaction() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ holdingId, transactionId, processedBy }: {
      holdingId: string;
      transactionId: string;
      processedBy: string;
    }) => processTransaction(holdingId, transactionId, processedBy),
    onSuccess: (_, { holdingId }) => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.transactions(holdingId) });
      queryClient.invalidateQueries({ queryKey: holdingKeys.detail(holdingId) });
    },
  });
}

// ============================================
// Valuation Hooks
// ============================================

export function useValuationHistory(holdingId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: holdingKeys.valuations(holdingId!),
    queryFn: () => getValuationHistory(holdingId!, limit),
    enabled: !!holdingId,
  });
}

export function useValuationHistorySubscription(holdingId: string | undefined) {
  const [history, setHistory] = useState<ValuationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!holdingId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToValuationHistory(holdingId, (data) => {
      setHistory(data);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [holdingId]);
  
  return { data: history, isLoading: loading };
}

export function useUpdateValuation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ holdingId, valuation, updatedBy }: {
      holdingId: string;
      valuation: Holding['currentValuation'];
      updatedBy: string;
    }) => updateValuation(holdingId, valuation, updatedBy),
    onSuccess: (_, { holdingId }) => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.valuations(holdingId) });
      queryClient.invalidateQueries({ queryKey: holdingKeys.detail(holdingId) });
    },
  });
}

export function useApproveValuation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ holdingId, valuationId, approvedBy }: {
      holdingId: string;
      valuationId: string;
      approvedBy: string;
    }) => approveValuation(holdingId, valuationId, approvedBy),
    onSuccess: (_, { holdingId }) => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.valuations(holdingId) });
    },
  });
}

// ============================================
// Income Hooks
// ============================================

export function useIncomeHistory(holdingId: string | undefined, type?: IncomeType) {
  return useQuery({
    queryKey: [...holdingKeys.income(holdingId!), type],
    queryFn: () => getIncomeHistory(holdingId!, type),
    enabled: !!holdingId,
  });
}

export function useRecordIncome() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (income: Omit<HoldingIncome, 'id' | 'createdAt'>) => recordIncome(income),
    onSuccess: (income) => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.income(income.holdingId) });
      queryClient.invalidateQueries({ queryKey: holdingKeys.detail(income.holdingId) });
    },
  });
}

export function useProcessIncome() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ holdingId, incomeId, processedBy }: {
      holdingId: string;
      incomeId: string;
      processedBy: string;
    }) => processIncome(holdingId, incomeId, processedBy),
    onSuccess: (_, { holdingId }) => {
      queryClient.invalidateQueries({ queryKey: holdingKeys.income(holdingId) });
      queryClient.invalidateQueries({ queryKey: holdingKeys.detail(holdingId) });
    },
  });
}

// ============================================
// Derived Data Hooks
// ============================================

export function useHoldingMetrics(holdingId: string | undefined) {
  const { data: holding, isLoading } = useHolding(holdingId);
  
  if (!holding) {
    return { data: null, isLoading };
  }
  
  const metrics = {
    totalCost: holding.costBasis.adjustedCostBasis.amount,
    currentValue: holding.currentValuation.fairValue.amount,
    unrealizedGainLoss: holding.currentValuation.unrealizedGainLoss.amount,
    unrealizedGainLossPercentage: holding.currentValuation.unrealizedGainLossPercentage,
    
    grossIRR: holding.returnMetrics.grossIRR,
    grossMOIC: holding.returnMetrics.grossMOIC,
    tvpi: holding.returnMetrics.tvpi,
    dpi: holding.returnMetrics.dpi,
    
    totalIncome: holding.incomeSummary.totalIncome.amount,
    currentYield: holding.incomeSummary.currentYield ?? 0,
    
    realizedProceeds: holding.realizationSummary.totalRealizedProceeds.amount,
    realizedGainLoss: holding.realizationSummary.realizedGainLoss.amount,
    isFullyRealized: holding.realizationSummary.isFullyRealized,
    
    holdingPeriodYears: holding.returnMetrics.holdingPeriodYears,
    
    riskRating: holding.riskAssessment?.overallRisk,
    onWatchList: holding.riskAssessment?.onWatchList ?? false,
  };
  
  return { data: metrics, isLoading };
}

export function useHoldingPerformance(holdingId: string | undefined) {
  const { data: holding, isLoading } = useHolding(holdingId);
  const { data: valuationHistory } = useValuationHistory(holdingId, 24);
  const { data: incomeHistory } = useIncomeHistory(holdingId);
  
  if (!holding) {
    return { data: null, isLoading };
  }
  
  const incomeCumulative = incomeHistory?.filter(i => i.status === 'received')
    .reduce((acc, income) => {
      const cumulative = (acc[acc.length - 1]?.cumulative ?? 0) + income.netAmount.amount;
      acc.push({
        date: income.receivedDate?.toDate() ?? income.paymentDate.toDate(),
        amount: income.netAmount.amount,
        type: income.type,
        cumulative,
      });
      return acc;
    }, [] as { date: Date; amount: number; type: string; cumulative: number }[]) ?? [];
  
  const performance = {
    returnMetrics: holding.returnMetrics,
    
    valuationTimeSeries: valuationHistory?.map(v => ({
      date: v.valuationDate.toDate(),
      value: v.fairValue.amount,
      change: v.percentageChange,
    })) ?? [],
    
    incomeByCumulative: incomeCumulative,
    
    totalValueCreation: holding.returnMetrics.totalValue.amount - holding.costBasis.adjustedCostBasis.amount,
    incomeContribution: holding.incomeSummary.totalIncome.amount,
    capitalAppreciation: holding.currentValuation.unrealizedGainLoss.amount,
    realizedGains: holding.realizationSummary.realizedGainLoss.amount,
  };
  
  return { data: performance, isLoading };
}

export function useHoldingRisk(holdingId: string | undefined) {
  const { data: holding, isLoading } = useHolding(holdingId);
  
  if (!holding || !holding.riskAssessment) {
    return { data: null, isLoading };
  }
  
  const risk = {
    overallRisk: holding.riskAssessment.overallRisk,
    
    dimensions: {
      market: holding.riskAssessment.marketRisk,
      credit: holding.riskAssessment.creditRisk,
      operational: holding.riskAssessment.operationalRisk,
      regulatory: holding.riskAssessment.regulatoryRisk,
      liquidity: holding.riskAssessment.liquidityRisk,
      country: holding.riskAssessment.countryRisk,
      currency: holding.riskAssessment.currencyRisk,
    },
    
    keyRisks: holding.riskAssessment.keyRisks ?? [],
    
    onWatchList: holding.riskAssessment.onWatchList,
    watchListReason: holding.riskAssessment.watchListReason,
    
    assessmentDate: holding.riskAssessment.assessmentDate.toDate(),
  };
  
  return { data: risk, isLoading };
}

export function usePortfolioHoldingsSummary(portfolioId: string | undefined) {
  const { data: holdings, isLoading } = useHoldingsByPortfolio(portfolioId);
  
  if (!holdings || holdings.length === 0) {
    return { data: null, isLoading };
  }
  
  const active = holdings.filter(h => !['fully_realized', 'written_off'].includes(h.status));
  const currency = holdings[0].costBasis.totalCost.currency;
  
  const calculateWeightedAverage = (
    items: Holding[],
    valueFn: (h: Holding) => number,
    weightFn: (h: Holding) => number
  ): number => {
    const totalWeight = items.reduce((sum, h) => sum + weightFn(h), 0);
    if (totalWeight === 0) return 0;
    return items.reduce((sum, h) => sum + valueFn(h) * weightFn(h), 0) / totalWeight;
  };
  
  const groupHoldings = (
    items: Holding[],
    keyFn: (h: Holding) => string
  ): { category: string; count: number; value: number; percentage: number }[] => {
    const totalValue = items.reduce((sum, h) => sum + h.currentValuation.fairValue.amount, 0);
    const groups: Record<string, { count: number; value: number }> = {};
    
    for (const item of items) {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = { count: 0, value: 0 };
      }
      groups[key].count++;
      groups[key].value += item.currentValuation.fairValue.amount;
    }
    
    return Object.entries(groups)
      .map(([category, data]) => ({
        category,
        count: data.count,
        value: data.value,
        percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  };
  
  const summary = {
    totalCount: holdings.length,
    activeCount: active.length,
    realizedCount: holdings.filter(h => h.status === 'fully_realized').length,
    
    totalCost: active.reduce((sum, h) => sum + h.costBasis.adjustedCostBasis.amount, 0),
    totalValue: active.reduce((sum, h) => sum + h.currentValuation.fairValue.amount, 0),
    totalUnrealized: active.reduce((sum, h) => sum + h.currentValuation.unrealizedGainLoss.amount, 0),
    totalIncome: holdings.reduce((sum, h) => sum + h.incomeSummary.totalIncome.amount, 0),
    totalRealized: holdings.reduce((sum, h) => sum + h.realizationSummary.totalRealizedProceeds.amount, 0),
    
    weightedIRR: calculateWeightedAverage(active, h => h.returnMetrics.grossIRR, h => h.currentValuation.fairValue.amount),
    weightedMOIC: calculateWeightedAverage(active, h => h.returnMetrics.grossMOIC, h => h.currentValuation.fairValue.amount),
    
    bySector: groupHoldings(active, h => h.underlyingAsset.sector),
    byGeography: groupHoldings(active, h => h.underlyingAsset.country),
    byType: groupHoldings(active, h => h.holdingType),
    
    currency,
  };
  
  return { data: summary, isLoading };
}

export function useHoldingESG(holdingId: string | undefined) {
  const { data: holding, isLoading } = useHolding(holdingId);
  
  if (!holding || !holding.esgProfile) {
    return { data: null, isLoading };
  }
  
  return {
    data: {
      rating: holding.esgProfile.esgRating,
      score: holding.esgProfile.esgScore,
      environmental: holding.esgProfile.environmentalScore,
      social: holding.esgProfile.socialScore,
      governance: holding.esgProfile.governanceScore,
      impactClassification: holding.esgProfile.impactClassification,
      sdgAlignment: holding.esgProfile.sdgAlignment ?? [],
      carbonMetrics: holding.esgProfile.carbonMetrics,
      keyFactors: holding.esgProfile.keyFactors ?? [],
      controversies: holding.esgProfile.controversies ?? [],
      assessmentDate: holding.esgProfile.assessmentDate.toDate(),
    },
    isLoading,
  };
}
