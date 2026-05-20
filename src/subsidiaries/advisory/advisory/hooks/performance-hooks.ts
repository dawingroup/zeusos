/**
 * Performance Hooks
 * 
 * React hooks for performance calculation, benchmarking, and analytics.
 */

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  PerformanceSnapshot,
  PerformanceScope,
  ReturnCalculationMethodology,
} from '../types/performance';
import type {
  PmeMethod,
  BenchmarkAssignment,
} from '../types/benchmark';
import type { PeerRanking } from '../types/peer-comparison';
import {
  calculateReturnMetrics,
  calculateRiskAdjustedReturns,
  createPerformanceSnapshot,
  getPerformanceSnapshot,
  getPerformanceSnapshots,
  calculatePme,
  calculatePeerRanking,
  calculateAttribution,
  calculateJCurve,
  getBenchmark,
  getBenchmarks,
  assignBenchmark,
  getBenchmarkAssignments,
  getPeerUniverse,
  getPeerUniverses,
  subscribeToPerformanceSnapshot,
  subscribeToPortfolioPerformance,
  subscribeToPeerRankings,
  calculateIrr,
  calculateTwr,
} from '../services/performance-service';

// Query keys
export const performanceKeys = {
  all: ['performance'] as const,
  snapshots: () => [...performanceKeys.all, 'snapshots'] as const,
  snapshot: (id: string) => [...performanceKeys.snapshots(), id] as const,
  snapshotsByScope: (scope: PerformanceScope, scopeId: string) => 
    [...performanceKeys.snapshots(), scope, scopeId] as const,
  metrics: (portfolioId: string) => [...performanceKeys.all, 'metrics', portfolioId] as const,
  jCurve: (portfolioId: string) => [...performanceKeys.all, 'jcurve', portfolioId] as const,
  benchmarks: () => [...performanceKeys.all, 'benchmarks'] as const,
  benchmark: (id: string) => [...performanceKeys.benchmarks(), id] as const,
  benchmarkAssignments: (scope: string, scopeId: string) => 
    [...performanceKeys.benchmarks(), 'assignments', scope, scopeId] as const,
  pme: (portfolioId: string, benchmarkId: string) => 
    [...performanceKeys.all, 'pme', portfolioId, benchmarkId] as const,
  peerUniverses: () => [...performanceKeys.all, 'peerUniverses'] as const,
  peerUniverse: (id: string) => [...performanceKeys.peerUniverses(), id] as const,
  peerRanking: (portfolioId: string, universeId: string) => 
    [...performanceKeys.all, 'peerRanking', portfolioId, universeId] as const,
  attribution: (scope: string, scopeId: string) => 
    [...performanceKeys.all, 'attribution', scope, scopeId] as const,
};

// ============================================================================
// RETURN METRICS HOOKS
// ============================================================================

export function useReturnMetrics(
  portfolioId: string | undefined,
  asOfDate: Date,
  methodology: ReturnCalculationMethodology
) {
  return useQuery({
    queryKey: performanceKeys.metrics(portfolioId!),
    queryFn: () => calculateReturnMetrics(portfolioId!, asOfDate, methodology),
    enabled: !!portfolioId,
  });
}

export function useRiskAdjustedReturns(
  returns: number[],
  riskFreeRate: number,
  benchmarkReturns?: number[]
) {
  return useMemo(() => {
    if (returns.length < 2) return null;
    return calculateRiskAdjustedReturns(returns, riskFreeRate, benchmarkReturns);
  }, [returns, riskFreeRate, benchmarkReturns]);
}

export function useIrrCalculation(cashFlows: { date: Date; amount: number }[]) {
  return useMemo(() => {
    if (cashFlows.length < 2) return null;
    return calculateIrr(cashFlows);
  }, [cashFlows]);
}

export function useTwrCalculation(
  startValue: number,
  endValue: number,
  cashFlows: { date: Date; amount: number }[],
  startDate: Date,
  endDate: Date
) {
  return useMemo(() => {
    return calculateTwr(startValue, endValue, cashFlows, startDate, endDate);
  }, [startValue, endValue, cashFlows, startDate, endDate]);
}

// ============================================================================
// PERFORMANCE SNAPSHOT HOOKS
// ============================================================================

export function usePerformanceSnapshot(snapshotId: string | undefined) {
  return useQuery({
    queryKey: performanceKeys.snapshot(snapshotId!),
    queryFn: () => getPerformanceSnapshot(snapshotId!),
    enabled: !!snapshotId,
  });
}

export function usePerformanceSnapshots(
  scope: PerformanceScope,
  scopeId: string | undefined,
  limit?: number
) {
  return useQuery({
    queryKey: performanceKeys.snapshotsByScope(scope, scopeId!),
    queryFn: () => getPerformanceSnapshots(scope, scopeId!, limit),
    enabled: !!scopeId,
  });
}

export function usePerformanceSnapshotSubscription(snapshotId: string | undefined) {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!snapshotId) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToPerformanceSnapshot(snapshotId, (data) => {
      setSnapshot(data);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [snapshotId]);
  
  return { data: snapshot, isLoading: loading };
}

export function usePortfolioPerformanceHistory(portfolioId: string | undefined) {
  const [snapshots, setSnapshots] = useState<PerformanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!portfolioId) {
      setSnapshots([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToPortfolioPerformance(portfolioId, (data) => {
      setSnapshots(data);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [portfolioId]);
  
  return { data: snapshots, isLoading: loading };
}

export function useCreatePerformanceSnapshot() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ scope, scopeId, asOfDate, methodology, createdBy }: {
      scope: PerformanceScope;
      scopeId: string;
      asOfDate: Date;
      methodology: ReturnCalculationMethodology;
      createdBy: string;
    }) => createPerformanceSnapshot(scope, scopeId, asOfDate, methodology, createdBy),
    onSuccess: (snapshot) => {
      queryClient.invalidateQueries({ queryKey: performanceKeys.snapshotsByScope(snapshot.scope, snapshot.scopeId) });
      queryClient.setQueryData(performanceKeys.snapshot(snapshot.id), snapshot);
    },
  });
}

// ============================================================================
// BENCHMARK HOOKS
// ============================================================================

export function useBenchmark(benchmarkId: string | undefined) {
  return useQuery({
    queryKey: performanceKeys.benchmark(benchmarkId!),
    queryFn: () => getBenchmark(benchmarkId!),
    enabled: !!benchmarkId,
  });
}

export function useBenchmarks() {
  return useQuery({
    queryKey: performanceKeys.benchmarks(),
    queryFn: () => getBenchmarks(),
  });
}

export function useBenchmarkAssignments(
  scope: BenchmarkAssignment['scope'],
  scopeId: string | undefined
) {
  return useQuery({
    queryKey: performanceKeys.benchmarkAssignments(scope, scopeId!),
    queryFn: () => getBenchmarkAssignments(scope, scopeId!),
    enabled: !!scopeId,
  });
}

export function useAssignBenchmark() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ scope, scopeId, benchmarkId, role, assignedBy }: {
      scope: BenchmarkAssignment['scope'];
      scopeId: string;
      benchmarkId: string;
      role: BenchmarkAssignment['role'];
      assignedBy: string;
    }) => assignBenchmark(scope, scopeId, benchmarkId, role, assignedBy),
    onSuccess: (_, { scope, scopeId }) => {
      queryClient.invalidateQueries({ queryKey: performanceKeys.benchmarkAssignments(scope, scopeId) });
    },
  });
}

// ============================================================================
// PME HOOKS
// ============================================================================

export function usePmeAnalysis(
  portfolioId: string | undefined,
  benchmarkId: string | undefined,
  method: PmeMethod,
  startDate: Date,
  endDate: Date
) {
  return useQuery({
    queryKey: performanceKeys.pme(portfolioId!, benchmarkId!),
    queryFn: () => calculatePme(portfolioId!, benchmarkId!, method, startDate, endDate),
    enabled: !!portfolioId && !!benchmarkId,
  });
}

export function useCalculatePme() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, benchmarkId, method, startDate, endDate }: {
      portfolioId: string;
      benchmarkId: string;
      method: PmeMethod;
      startDate: Date;
      endDate: Date;
    }) => calculatePme(portfolioId, benchmarkId, method, startDate, endDate),
    onSuccess: (analysis) => {
      queryClient.setQueryData(
        performanceKeys.pme(analysis.portfolioId, analysis.benchmarkId),
        analysis
      );
    },
  });
}

// ============================================================================
// PEER COMPARISON HOOKS
// ============================================================================

export function usePeerUniverse(universeId: string | undefined) {
  return useQuery({
    queryKey: performanceKeys.peerUniverse(universeId!),
    queryFn: () => getPeerUniverse(universeId!),
    enabled: !!universeId,
  });
}

export function usePeerUniverses() {
  return useQuery({
    queryKey: performanceKeys.peerUniverses(),
    queryFn: () => getPeerUniverses(),
  });
}

export function usePeerRanking(
  portfolioId: string | undefined,
  universeId: string | undefined,
  asOfDate: Date
) {
  return useQuery({
    queryKey: performanceKeys.peerRanking(portfolioId!, universeId!),
    queryFn: () => calculatePeerRanking(portfolioId!, universeId!, asOfDate),
    enabled: !!portfolioId && !!universeId,
  });
}

export function usePeerRankingsSubscription(portfolioId: string | undefined) {
  const [rankings, setRankings] = useState<PeerRanking[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!portfolioId) {
      setRankings([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const unsubscribe = subscribeToPeerRankings(portfolioId, (data) => {
      setRankings(data);
      setLoading(false);
    });
    
    return unsubscribe;
  }, [portfolioId]);
  
  return { data: rankings, isLoading: loading };
}

export function useCalculatePeerRanking() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ portfolioId, universeId, asOfDate }: {
      portfolioId: string;
      universeId: string;
      asOfDate: Date;
    }) => calculatePeerRanking(portfolioId, universeId, asOfDate),
    onSuccess: (ranking) => {
      queryClient.setQueryData(
        performanceKeys.peerRanking(ranking.portfolioId, ranking.universeId),
        ranking
      );
    },
  });
}

// ============================================================================
// ATTRIBUTION HOOKS
// ============================================================================

export function useAttribution(
  scope: 'holding' | 'portfolio' | 'client',
  scopeId: string | undefined,
  startDate: Date,
  endDate: Date
) {
  return useQuery({
    queryKey: performanceKeys.attribution(scope, scopeId!),
    queryFn: () => calculateAttribution(scope, scopeId!, startDate, endDate),
    enabled: !!scopeId,
  });
}

export function useCalculateAttribution() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ scope, scopeId, startDate, endDate }: {
      scope: 'holding' | 'portfolio' | 'client';
      scopeId: string;
      startDate: Date;
      endDate: Date;
    }) => calculateAttribution(scope, scopeId, startDate, endDate),
    onSuccess: (attribution) => {
      queryClient.setQueryData(
        performanceKeys.attribution(attribution.scope, attribution.scopeId),
        attribution
      );
    },
  });
}

// ============================================================================
// J-CURVE HOOKS
// ============================================================================

export function useJCurveAnalysis(portfolioId: string | undefined, asOfDate: Date) {
  return useQuery({
    queryKey: performanceKeys.jCurve(portfolioId!),
    queryFn: () => calculateJCurve(portfolioId!, asOfDate),
    enabled: !!portfolioId,
  });
}

// ============================================================================
// DERIVED PERFORMANCE HOOKS
// ============================================================================

const defaultMethodology: ReturnCalculationMethodology = {
  irrMethod: 'newton_raphson',
  twrMethod: 'modified_dietz',
  annualizationMethod: 'compound',
  dayCountConvention: 'actual/365',
  feesTreatment: 'deducted_from_nav',
  uncommittedCapitalTreatment: 'excluded',
  recallableDistributionTreatment: 'distribution',
  currencyTreatment: 'reporting',
  reportingCurrency: 'USD',
  fxRateSource: 'WMR'
};

export function usePortfolioPerformanceSummary(portfolioId: string | undefined) {
  const { data: metrics, isLoading: metricsLoading } = useReturnMetrics(
    portfolioId,
    new Date(),
    defaultMethodology
  );
  
  const { data: jCurve, isLoading: jCurveLoading } = useJCurveAnalysis(
    portfolioId,
    new Date()
  );
  
  return useMemo(() => ({
    irr: metrics?.grossIrr,
    netIrr: metrics?.netIrr,
    tvpi: metrics?.tvpi,
    dpi: metrics?.dpi,
    rvpi: metrics?.rvpi,
    moic: metrics?.grossMoic,
    
    ytdReturn: metrics?.periodReturns.ytd,
    oneYearReturn: metrics?.periodReturns.oneYear,
    sinceInceptionReturn: metrics?.periodReturns.sinceInception,
    
    jCurvePosition: jCurve?.currentPosition,
    hasReachedBreakeven: jCurve?.breakeven.hasReachedBreakeven,
    quartersSinceInception: jCurve?.currentPosition.quartersSinceInception,
    
    isLoading: metricsLoading || jCurveLoading,
    
    metrics,
    jCurve
  }), [metrics, jCurve, metricsLoading, jCurveLoading]);
}

export function useQuartileAnalysis(
  portfolioId: string | undefined,
  universeId: string | undefined
) {
  const { data: ranking, isLoading } = usePeerRanking(
    portfolioId,
    universeId,
    new Date()
  );
  
  return useMemo(() => {
    if (!ranking) return { data: null, isLoading };
    
    return {
      data: {
        overallQuartile: ranking.summary.overallQuartile,
        irrQuartile: ranking.rankings.find(r => r.metric === 'irr')?.quartile,
        tvpiQuartile: ranking.rankings.find(r => r.metric === 'tvpi')?.quartile,
        dpiQuartile: ranking.rankings.find(r => r.metric === 'dpi')?.quartile,
        
        irrPercentile: ranking.rankings.find(r => r.metric === 'irr')?.percentileRank,
        tvpiPercentile: ranking.rankings.find(r => r.metric === 'tvpi')?.percentileRank,
        
        topQuartileMetrics: ranking.rankings
          .filter(r => r.quartile === 1)
          .map(r => r.metric),
        
        spreadToMedian: {
          irr: ranking.rankings.find(r => r.metric === 'irr')?.spreadToMedian,
          tvpi: ranking.rankings.find(r => r.metric === 'tvpi')?.spreadToMedian
        },
      },
      isLoading
    };
  }, [ranking, isLoading]);
}

export function usePerformanceComparison(
  portfolioId: string | undefined,
  benchmarkIds: string[],
  asOfDate: Date
) {
  const { data: metrics } = useReturnMetrics(portfolioId, asOfDate, defaultMethodology);
  const { data: benchmarks } = useBenchmarks();
  
  return useMemo(() => {
    if (!metrics || !benchmarks) return null;
    
    const portfolioReturn = metrics.grossIrr || 0;
    
    return {
      portfolio: { 
        name: 'Portfolio', 
        return: portfolioReturn 
      },
      benchmarks: benchmarkIds
        .map(id => benchmarks.find(b => b.id === id))
        .filter(Boolean)
        .map(b => ({
          id: b!.id,
          name: b!.name,
          return: 0, // Would need benchmark return data
          spread: portfolioReturn
        })),
      asOfDate
    };
  }, [metrics, benchmarks, benchmarkIds, asOfDate]);
}

export function useClientPerformanceAggregate(clientId: string | undefined) {
  const { data: snapshots, isLoading } = usePerformanceSnapshots('client', clientId);
  
  return useMemo(() => {
    if (!snapshots || snapshots.length === 0) {
      return { data: null, isLoading };
    }
    
    const latest = snapshots[0];
    
    return {
      data: {
        totalCommitment: latest.capitalMetrics.totalCommitment.amount,
        paidInCapital: latest.capitalMetrics.paidInCapital.amount,
        currentNav: latest.capitalMetrics.currentNav.amount,
        distributions: latest.capitalMetrics.distributions.amount,
        totalValue: latest.capitalMetrics.totalValue.amount,
        weightedIrr: latest.returnMetrics.grossIrr || 0,
        weightedTvpi: latest.returnMetrics.tvpi || 0,
      },
      isLoading
    };
  }, [snapshots, isLoading]);
}

export function usePerformanceRiskMetrics(portfolioId: string | undefined) {
  const { data: snapshots } = usePerformanceSnapshots('portfolio', portfolioId, 24);
  
  return useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null;
    
    const returns = snapshots
      .filter(s => s.returnMetrics.periodReturns.mtd !== null)
      .map(s => s.returnMetrics.periodReturns.mtd!);
    
    if (returns.length < 2) return null;
    
    return calculateRiskAdjustedReturns(returns, 0.02);
  }, [snapshots]);
}
