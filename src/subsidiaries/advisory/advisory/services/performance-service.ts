/**
 * Performance Service
 * 
 * Core service for performance calculations, benchmarking, and analytics.
 * Handles complex return calculations, attribution analysis, and peer comparison.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  ReturnMetrics,
  RiskAdjustedReturns,
  PerformanceSnapshot,
  JCurveAnalysis,
  ReturnCalculationMethodology,
  PerformanceScope,
  PeriodReturns,
  JCurveDataPoint,
} from '../types/performance';
import type {
  Benchmark,
  BenchmarkData,
  PmeAnalysis,
  PmeMethod,
  BenchmarkAssignment,
} from '../types/benchmark';
import type { PerformanceAttribution } from '../types/attribution';
import type {
  PeerUniverse,
  PeerRanking,
  MetricRanking,
  PercentileDistribution,
} from '../types/peer-comparison';

// Collection references
const PERFORMANCE_SNAPSHOTS = 'advisoryPlatform/advisory/performanceSnapshots';
// const PERFORMANCE_HISTORY = 'advisoryPlatform/advisory/performanceHistory';
const BENCHMARKS = 'advisoryPlatform/advisory/benchmarks';
const BENCHMARK_ASSIGNMENTS = 'advisoryPlatform/advisory/benchmarkAssignments';
const PME_ANALYSES = 'advisoryPlatform/advisory/pmeAnalyses';
const PEER_UNIVERSES = 'advisoryPlatform/advisory/peerUniverses';
const PEER_RANKINGS = 'advisoryPlatform/advisory/peerRankings';
const ATTRIBUTIONS = 'advisoryPlatform/advisory/attributions';

// ============================================================================
// IRR CALCULATION ENGINE
// ============================================================================

export function calculateIrr(
  cashFlows: { date: Date; amount: number }[],
  guess: number = 0.1,
  maxIterations: number = 100,
  tolerance: number = 0.00001
): number | null {
  if (cashFlows.length < 2) return null;
  
  const sorted = [...cashFlows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const baseDate = sorted[0].date;
  
  const flows = sorted.map(cf => ({
    amount: cf.amount,
    days: (cf.date.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24)
  }));
  
  let rate = guess;
  
  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let derivative = 0;
    
    for (const flow of flows) {
      const factor = Math.pow(1 + rate, flow.days / 365);
      npv += flow.amount / factor;
      derivative -= (flow.days / 365) * flow.amount / (factor * (1 + rate));
    }
    
    if (Math.abs(npv) < tolerance) {
      return rate;
    }
    
    if (derivative === 0) {
      return calculateIrrBisection(flows);
    }
    
    rate = rate - npv / derivative;
    
    if (rate < -0.99 || rate > 10) {
      return calculateIrrBisection(flows);
    }
  }
  
  return calculateIrrBisection(flows);
}

function calculateIrrBisection(
  flows: { amount: number; days: number }[],
  maxIterations: number = 1000
): number | null {
  let low = -0.99;
  let high = 10.0;
  
  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const npv = flows.reduce((sum, flow) => {
      return sum + flow.amount / Math.pow(1 + mid, flow.days / 365);
    }, 0);
    
    if (Math.abs(npv) < 0.00001) {
      return mid;
    }
    
    if (npv > 0) {
      low = mid;
    } else {
      high = mid;
    }
    
    if (high - low < 0.0000001) {
      return mid;
    }
  }
  
  return null;
}

// ============================================================================
// TWR CALCULATION ENGINE
// ============================================================================

export function calculateTwr(
  startValue: number,
  endValue: number,
  cashFlows: { date: Date; amount: number }[],
  startDate: Date,
  endDate: Date
): number {
  const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (totalDays === 0) return 0;
  
  let weightedCashFlows = 0;
  let totalCashFlows = 0;
  
  for (const cf of cashFlows) {
    const daysFromStart = (cf.date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const weight = (totalDays - daysFromStart) / totalDays;
    weightedCashFlows += cf.amount * weight;
    totalCashFlows += cf.amount;
  }
  
  const avgCapital = startValue + weightedCashFlows;
  
  if (avgCapital === 0) return 0;
  
  return (endValue - startValue - totalCashFlows) / avgCapital;
}

export function calculateTrueTwr(
  valuations: { date: Date; value: number; cashFlow: number }[]
): number {
  if (valuations.length < 2) return 0;
  
  const sorted = [...valuations].sort((a, b) => a.date.getTime() - b.date.getTime());
  
  let cumulativeReturn = 1;
  
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    
    const startValue = prev.value + prev.cashFlow;
    
    if (startValue === 0) continue;
    
    const subReturn = curr.value / startValue;
    cumulativeReturn *= subReturn;
  }
  
  return cumulativeReturn - 1;
}

// ============================================================================
// RISK-ADJUSTED RETURNS
// ============================================================================

export function calculateRiskAdjustedReturns(
  returns: number[],
  riskFreeRate: number,
  benchmarkReturns?: number[]
): RiskAdjustedReturns {
  const n = returns.length;
  
  if (n < 2) {
    return createEmptyRiskAdjustedReturns(riskFreeRate);
  }
  
  // Mean return
  const meanReturn = returns.reduce((a, b) => a + b, 0) / n;
  
  // Volatility (standard deviation)
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (n - 1);
  const volatility = Math.sqrt(variance);
  
  // Downside deviation
  const downsideReturns = returns.filter(r => r < riskFreeRate);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((sum, r) => sum + Math.pow(r - riskFreeRate, 2), 0) / downsideReturns.length
    : 0;
  const downsideDeviation = Math.sqrt(downsideVariance);
  
  // Max drawdown
  const { maxDrawdown } = calculateMaxDrawdown(returns);
  
  // Sharpe ratio
  const excessReturn = meanReturn - riskFreeRate;
  const sharpeRatio = volatility > 0 ? excessReturn / volatility : null;
  
  // Sortino ratio
  const sortinoRatio = downsideDeviation > 0 ? excessReturn / downsideDeviation : null;
  
  // Calmar ratio
  const calmarRatio = maxDrawdown > 0 ? (meanReturn * 12) / maxDrawdown : null;
  
  // Benchmark-relative metrics
  let alpha: number | null = null;
  let beta: number | null = null;
  let trackingError: number | null = null;
  let informationRatio: number | null = null;
  let treynorRatio: number | null = null;
  
  if (benchmarkReturns && benchmarkReturns.length === n) {
    const benchmarkMean = benchmarkReturns.reduce((a, b) => a + b, 0) / n;
    
    // Covariance and variance
    let covariance = 0;
    let benchmarkVariance = 0;
    
    for (let i = 0; i < n; i++) {
      covariance += (returns[i] - meanReturn) * (benchmarkReturns[i] - benchmarkMean);
      benchmarkVariance += Math.pow(benchmarkReturns[i] - benchmarkMean, 2);
    }
    
    covariance /= (n - 1);
    benchmarkVariance /= (n - 1);
    
    beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : null;
    alpha = beta !== null ? meanReturn - (riskFreeRate + beta * (benchmarkMean - riskFreeRate)) : null;
    
    // Tracking error
    const excessReturns = returns.map((r, i) => r - benchmarkReturns[i]);
    const excessMean = excessReturns.reduce((a, b) => a + b, 0) / n;
    const teVariance = excessReturns.reduce((sum, r) => sum + Math.pow(r - excessMean, 2), 0) / (n - 1);
    trackingError = Math.sqrt(teVariance);
    
    informationRatio = trackingError > 0 ? excessMean / trackingError : null;
    treynorRatio = beta !== null && beta > 0 ? excessReturn / beta : null;
  }
  
  // VaR calculations (parametric)
  const var95 = meanReturn - 1.645 * volatility;
  const var99 = meanReturn - 2.326 * volatility;
  
  // CVaR (simplified)
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const cutoff5 = Math.floor(n * 0.05);
  const cvar95 = cutoff5 > 0
    ? sortedReturns.slice(0, cutoff5).reduce((a, b) => a + b, 0) / cutoff5
    : sortedReturns[0];
  
  return {
    volatility,
    downsideDeviation,
    maxDrawdown,
    maxDrawdownDuration: null,
    maxDrawdownPeak: null,
    maxDrawdownTrough: null,
    maxDrawdownRecovery: null,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    treynorRatio,
    informationRatio,
    alpha,
    beta,
    trackingError,
    var95,
    var99,
    cvar95,
    riskFreeRate,
    benchmarkReturn: benchmarkReturns ? benchmarkReturns.reduce((a, b) => a + b, 0) / n : 0,
    calculationPeriod: 'since_inception',
    dataFrequency: 'monthly'
  };
}

function calculateMaxDrawdown(returns: number[]): {
  maxDrawdown: number;
  peak: number;
  trough: number;
} {
  let peak = 1;
  let maxDrawdown = 0;
  let peakValue = 1;
  let troughValue = 1;
  let cumulative = 1;
  
  for (const r of returns) {
    cumulative *= (1 + r);
    
    if (cumulative > peak) {
      peak = cumulative;
    }
    
    const drawdown = (peak - cumulative) / peak;
    
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
      peakValue = peak;
      troughValue = cumulative;
    }
  }
  
  return { maxDrawdown, peak: peakValue, trough: troughValue };
}

function createEmptyRiskAdjustedReturns(riskFreeRate: number): RiskAdjustedReturns {
  return {
    volatility: null,
    downsideDeviation: null,
    maxDrawdown: null,
    maxDrawdownDuration: null,
    maxDrawdownPeak: null,
    maxDrawdownTrough: null,
    maxDrawdownRecovery: null,
    sharpeRatio: null,
    sortinoRatio: null,
    calmarRatio: null,
    treynorRatio: null,
    informationRatio: null,
    alpha: null,
    beta: null,
    trackingError: null,
    var95: null,
    var99: null,
    cvar95: null,
    riskFreeRate,
    benchmarkReturn: 0,
    calculationPeriod: 'since_inception',
    dataFrequency: 'monthly'
  };
}

// ============================================================================
// RETURN METRICS CALCULATION
// ============================================================================

export async function calculateReturnMetrics(
  portfolioId: string,
  asOfDate: Date,
  methodology: ReturnCalculationMethodology
): Promise<ReturnMetrics> {
  const portfolioRef = doc(db, 'advisoryPlatform/advisory/portfolios', portfolioId);
  const portfolioSnap = await getDoc(portfolioRef);
  
  if (!portfolioSnap.exists()) {
    throw new Error(`Portfolio ${portfolioId} not found`);
  }
  
  const portfolio = portfolioSnap.data();
  
  // Get capital transactions
  const txRef = collection(db, 'advisoryPlatform/advisory/portfolios', portfolioId, 'capitalTransactions');
  const txSnap = await getDocs(txRef);
  
  const cashFlows: { date: Date; amount: number }[] = [];
  let totalContributions = 0;
  let totalDistributions = 0;
  
  txSnap.docs.forEach(d => {
    const tx = d.data();
    if (tx.status !== 'completed') return;
    
    const date = tx.settlementDate?.toDate() || tx.effectiveDate?.toDate();
    if (!date || date > asOfDate) return;
    
    if (tx.type === 'capital_call') {
      cashFlows.push({ date, amount: -tx.netAmount.amount });
      totalContributions += tx.netAmount.amount;
    } else if (tx.type === 'distribution') {
      cashFlows.push({ date, amount: tx.netAmount.amount });
      totalDistributions += tx.netAmount.amount;
    }
  });
  
  const currentNav = portfolio.currentNAV?.netAssetValue?.amount || 0;
  cashFlows.push({ date: asOfDate, amount: currentNav });
  
  const grossIrr = calculateIrr(cashFlows);
  
  const paidIn = totalContributions;
  const totalValue = currentNav + totalDistributions;
  
  const tvpi = paidIn > 0 ? totalValue / paidIn : null;
  const dpi = paidIn > 0 ? totalDistributions / paidIn : null;
  const rvpi = paidIn > 0 ? currentNav / paidIn : null;
  const moic = tvpi;
  
  const periodReturns = await calculatePeriodReturns(portfolioId, asOfDate);
  
  return {
    grossIrr,
    netIrr: grossIrr ? grossIrr * 0.85 : null,
    grossTwr: periodReturns.sinceInception,
    netTwr: periodReturns.sinceInception ? periodReturns.sinceInception * 0.85 : null,
    grossMoic: moic,
    netMoic: moic ? moic * 0.95 : null,
    dpi,
    rvpi,
    tvpi,
    currentYield: portfolio.performanceSummary?.currentYield || null,
    yieldOnCost: null,
    cashOnCash: dpi,
    periodReturns,
    asOfDate: Timestamp.fromDate(asOfDate),
    calculationDate: Timestamp.now(),
    methodology
  };
}

async function calculatePeriodReturns(
  _portfolioId: string,
  _asOfDate: Date
): Promise<PeriodReturns> {
  // Simplified - would need NAV history for full implementation
  return {
    mtd: null,
    qtd: null,
    ytd: null,
    oneYear: null,
    threeYear: null,
    fiveYear: null,
    tenYear: null,
    sinceInception: null,
    sinceInceptionCumulative: null
  };
}

// ============================================================================
// PERFORMANCE SNAPSHOTS
// ============================================================================

export async function createPerformanceSnapshot(
  scope: PerformanceScope,
  scopeId: string,
  asOfDate: Date,
  methodology: ReturnCalculationMethodology,
  createdBy: string
): Promise<PerformanceSnapshot> {
  const id = doc(collection(db, PERFORMANCE_SNAPSHOTS)).id;
  
  let capitalMetrics;
  let returnMetrics;
  
  if (scope === 'portfolio') {
    returnMetrics = await calculateReturnMetrics(scopeId, asOfDate, methodology);
    capitalMetrics = await getPortfolioCapitalMetrics(scopeId);
  } else if (scope === 'holding') {
    returnMetrics = await calculateHoldingReturnMetrics(scopeId, asOfDate, methodology);
    capitalMetrics = await getHoldingCapitalMetrics(scopeId);
  } else {
    const portfolioIds = await getPortfolioIdsForScope(scope, scopeId);
    returnMetrics = await aggregateReturnMetrics(portfolioIds, asOfDate, methodology);
    capitalMetrics = await aggregateCapitalMetrics(portfolioIds);
  }
  
  const snapshot: PerformanceSnapshot = {
    id,
    scope,
    scopeId,
    asOfDate: Timestamp.fromDate(asOfDate),
    periodStart: Timestamp.fromDate(new Date(asOfDate.getFullYear(), 0, 1)),
    periodEnd: Timestamp.fromDate(asOfDate),
    period: 'ytd',
    capitalMetrics,
    returnMetrics,
    status: 'draft',
    calculatedAt: Timestamp.now(),
    calculatedBy: createdBy,
    methodology
  };
  
  await setDoc(doc(db, PERFORMANCE_SNAPSHOTS, id), snapshot);
  
  return snapshot;
}

export async function getPerformanceSnapshot(id: string): Promise<PerformanceSnapshot | null> {
  const snap = await getDoc(doc(db, PERFORMANCE_SNAPSHOTS, id));
  return snap.exists() ? (snap.data() as PerformanceSnapshot) : null;
}

export async function getPerformanceSnapshots(
  scope: PerformanceScope,
  scopeId: string,
  limitCount?: number
): Promise<PerformanceSnapshot[]> {
  const constraints: QueryConstraint[] = [
    where('scope', '==', scope),
    where('scopeId', '==', scopeId),
    orderBy('asOfDate', 'desc')
  ];
  
  if (limitCount) constraints.push(limit(limitCount));
  
  const q = query(collection(db, PERFORMANCE_SNAPSHOTS), ...constraints);
  const snap = await getDocs(q);
  
  return snap.docs.map(d => d.data() as PerformanceSnapshot);
}

async function getPortfolioCapitalMetrics(portfolioId: string) {
  const portfolioRef = doc(db, 'advisoryPlatform/advisory/portfolios', portfolioId);
  const portfolioSnap = await getDoc(portfolioRef);
  
  if (!portfolioSnap.exists()) {
    throw new Error(`Portfolio ${portfolioId} not found`);
  }
  
  const portfolio = portfolioSnap.data();
  const cap = portfolio.capitalStructure || {};
  const nav = portfolio.currentNAV || {};
  
  return {
    totalCommitment: cap.totalCommitted || { amount: 0, currency: 'USD' },
    paidInCapital: cap.paidInCapital || { amount: 0, currency: 'USD' },
    uncalledCapital: cap.uncalledCommitments || { amount: 0, currency: 'USD' },
    distributions: cap.totalDistributions || { amount: 0, currency: 'USD' },
    recallableDistributions: { amount: 0, currency: 'USD' as const },
    netContributions: {
      amount: (cap.paidInCapital?.amount || 0) - (cap.totalDistributions?.amount || 0),
      currency: 'USD' as const
    },
    currentNav: nav.netAssetValue || { amount: 0, currency: 'USD' },
    totalValue: {
      amount: (nav.netAssetValue?.amount || 0) + (cap.totalDistributions?.amount || 0),
      currency: 'USD' as const
    }
  };
}

async function getHoldingCapitalMetrics(holdingId: string) {
  const holdingRef = doc(db, 'advisoryPlatform/advisory/holdings', holdingId);
  const holdingSnap = await getDoc(holdingRef);
  
  if (!holdingSnap.exists()) {
    throw new Error(`Holding ${holdingId} not found`);
  }
  
  const holding = holdingSnap.data();
  
  return {
    totalCommitment: holding.costBasis?.totalCost || { amount: 0, currency: 'USD' },
    paidInCapital: holding.costBasis?.totalCost || { amount: 0, currency: 'USD' },
    uncalledCapital: { amount: holding.costBasis?.unfundedCommitment?.amount || 0, currency: 'USD' as const },
    distributions: { amount: holding.realizationSummary?.totalRealizedProceeds?.amount || 0, currency: 'USD' as const },
    recallableDistributions: { amount: 0, currency: 'USD' as const },
    netContributions: holding.costBasis?.adjustedCostBasis || { amount: 0, currency: 'USD' },
    currentNav: holding.currentValuation?.fairValue || { amount: 0, currency: 'USD' },
    totalValue: {
      amount: (holding.currentValuation?.fairValue?.amount || 0) +
              (holding.realizationSummary?.totalRealizedProceeds?.amount || 0),
      currency: 'USD' as const
    }
  };
}

async function calculateHoldingReturnMetrics(
  holdingId: string,
  asOfDate: Date,
  methodology: ReturnCalculationMethodology
): Promise<ReturnMetrics> {
  const holdingRef = doc(db, 'advisoryPlatform/advisory/holdings', holdingId);
  const holdingSnap = await getDoc(holdingRef);
  
  if (!holdingSnap.exists()) {
    throw new Error(`Holding ${holdingId} not found`);
  }
  
  const holding = holdingSnap.data();
  const metrics = holding.returnMetrics || {};
  
  return {
    grossIrr: metrics.grossIRR || null,
    netIrr: metrics.netIRR || null,
    grossTwr: null,
    netTwr: null,
    grossMoic: metrics.grossMOIC || null,
    netMoic: metrics.netMOIC || null,
    dpi: metrics.dpi || null,
    rvpi: metrics.rvpi || null,
    tvpi: metrics.tvpi || null,
    currentYield: null,
    yieldOnCost: null,
    cashOnCash: null,
    periodReturns: {
      mtd: null, qtd: null, ytd: null, oneYear: null,
      threeYear: null, fiveYear: null, tenYear: null,
      sinceInception: null, sinceInceptionCumulative: null
    },
    asOfDate: Timestamp.fromDate(asOfDate),
    calculationDate: Timestamp.now(),
    methodology
  };
}

async function getPortfolioIdsForScope(scope: PerformanceScope, scopeId: string): Promise<string[]> {
  const portfoliosRef = collection(db, 'advisoryPlatform/advisory/portfolios');
  let q;
  
  switch (scope) {
    case 'client':
      q = query(portfoliosRef, where('clientId', '==', scopeId));
      break;
    case 'engagement':
      q = query(portfoliosRef, where('engagementId', '==', scopeId));
      break;
    default:
      q = query(portfoliosRef);
  }
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.id);
}

async function aggregateReturnMetrics(
  portfolioIds: string[],
  asOfDate: Date,
  methodology: ReturnCalculationMethodology
): Promise<ReturnMetrics> {
  const metrics: ReturnMetrics[] = [];
  const weights: number[] = [];
  
  for (const portfolioId of portfolioIds) {
    try {
      const m = await calculateReturnMetrics(portfolioId, asOfDate, methodology);
      const cap = await getPortfolioCapitalMetrics(portfolioId);
      metrics.push(m);
      weights.push(cap.paidInCapital.amount);
    } catch (e) {
      console.error(`Error calculating metrics for ${portfolioId}:`, e);
    }
  }
  
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  
  const weightedIrr = totalWeight > 0
    ? metrics.reduce((sum, m, i) => sum + (m.grossIrr || 0) * weights[i], 0) / totalWeight
    : null;
  
  return {
    grossIrr: weightedIrr,
    netIrr: weightedIrr ? weightedIrr * 0.85 : null,
    grossTwr: null,
    netTwr: null,
    grossMoic: null,
    netMoic: null,
    dpi: null,
    rvpi: null,
    tvpi: null,
    currentYield: null,
    yieldOnCost: null,
    cashOnCash: null,
    periodReturns: {
      mtd: null, qtd: null, ytd: null, oneYear: null,
      threeYear: null, fiveYear: null, tenYear: null,
      sinceInception: null, sinceInceptionCumulative: null
    },
    asOfDate: Timestamp.fromDate(asOfDate),
    calculationDate: Timestamp.now(),
    methodology
  };
}

async function aggregateCapitalMetrics(portfolioIds: string[]) {
  let totalCommitment = 0;
  let paidInCapital = 0;
  let uncalledCapital = 0;
  let distributions = 0;
  let currentNav = 0;
  
  for (const portfolioId of portfolioIds) {
    try {
      const cap = await getPortfolioCapitalMetrics(portfolioId);
      totalCommitment += cap.totalCommitment.amount;
      paidInCapital += cap.paidInCapital.amount;
      uncalledCapital += cap.uncalledCapital.amount;
      distributions += cap.distributions.amount;
      currentNav += cap.currentNav.amount;
    } catch (e) {
      console.error(`Error getting capital for ${portfolioId}:`, e);
    }
  }
  
  return {
    totalCommitment: { amount: totalCommitment, currency: 'USD' as const },
    paidInCapital: { amount: paidInCapital, currency: 'USD' as const },
    uncalledCapital: { amount: uncalledCapital, currency: 'USD' as const },
    distributions: { amount: distributions, currency: 'USD' as const },
    recallableDistributions: { amount: 0, currency: 'USD' as const },
    netContributions: { amount: paidInCapital - distributions, currency: 'USD' as const },
    currentNav: { amount: currentNav, currency: 'USD' as const },
    totalValue: { amount: currentNav + distributions, currency: 'USD' as const }
  };
}

// ============================================================================
// BENCHMARK MANAGEMENT
// ============================================================================

export async function createBenchmark(
  benchmark: Omit<Benchmark, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Benchmark> {
  const id = doc(collection(db, BENCHMARKS)).id;
  
  const newBenchmark: Benchmark = {
    ...benchmark,
    id,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };
  
  await setDoc(doc(db, BENCHMARKS, id), newBenchmark);
  return newBenchmark;
}

export async function getBenchmark(id: string): Promise<Benchmark | null> {
  const snap = await getDoc(doc(db, BENCHMARKS, id));
  return snap.exists() ? (snap.data() as Benchmark) : null;
}

export async function getBenchmarks(): Promise<Benchmark[]> {
  const q = query(collection(db, BENCHMARKS), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as Benchmark);
}

export async function updateBenchmarkData(
  benchmarkId: string,
  data: Omit<BenchmarkData, 'id'>
): Promise<BenchmarkData> {
  const dataRef = collection(db, BENCHMARKS, benchmarkId, 'data');
  const id = doc(dataRef).id;
  
  const newData: BenchmarkData = {
    ...data,
    id,
    benchmarkId
  };
  
  await setDoc(doc(dataRef, id), newData);
  return newData;
}

export async function assignBenchmark(
  scope: BenchmarkAssignment['scope'],
  scopeId: string,
  benchmarkId: string,
  role: BenchmarkAssignment['role'],
  assignedBy: string
): Promise<BenchmarkAssignment> {
  const id = doc(collection(db, BENCHMARK_ASSIGNMENTS)).id;
  
  const assignment: BenchmarkAssignment = {
    id,
    scope,
    scopeId,
    benchmarkId,
    role,
    effectiveFrom: Timestamp.now(),
    assignedBy,
    assignedAt: Timestamp.now()
  };
  
  await setDoc(doc(db, BENCHMARK_ASSIGNMENTS, id), assignment);
  return assignment;
}

export async function getBenchmarkAssignments(
  scope: BenchmarkAssignment['scope'],
  scopeId: string
): Promise<BenchmarkAssignment[]> {
  const q = query(
    collection(db, BENCHMARK_ASSIGNMENTS),
    where('scope', '==', scope),
    where('scopeId', '==', scopeId),
    orderBy('effectiveFrom', 'desc')
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as BenchmarkAssignment);
}

// ============================================================================
// PME ANALYSIS
// ============================================================================

export async function calculatePme(
  portfolioId: string,
  benchmarkId: string,
  method: PmeMethod,
  startDate: Date,
  endDate: Date
): Promise<PmeAnalysis> {
  const id = doc(collection(db, PME_ANALYSES)).id;
  
  // Get portfolio cash flows
  const txRef = collection(db, 'advisoryPlatform/advisory/portfolios', portfolioId, 'capitalTransactions');
  const txSnap = await getDocs(txRef);
  
  const cashFlows: { date: Date; amount: number; type: string }[] = [];
  
  txSnap.docs.forEach(d => {
    const tx = d.data();
    if (tx.status !== 'completed') return;
    
    const date = tx.settlementDate?.toDate() || tx.effectiveDate?.toDate();
    if (!date || date < startDate || date > endDate) return;
    
    if (tx.type === 'capital_call') {
      cashFlows.push({ date, amount: -tx.netAmount.amount, type: 'contribution' });
    } else if (tx.type === 'distribution') {
      cashFlows.push({ date, amount: tx.netAmount.amount, type: 'distribution' });
    }
  });
  
  // Get benchmark data
  const benchmarkReturns = await getBenchmarkReturnSeries(benchmarkId, startDate, endDate);
  
  // Get current NAV
  const portfolioRef = doc(db, 'advisoryPlatform/advisory/portfolios', portfolioId);
  const portfolioSnap = await getDoc(portfolioRef);
  const currentNav = portfolioSnap.data()?.currentNAV?.netAssetValue?.amount || 0;
  
  // Calculate PME
  const results = calculateLongNickels(cashFlows, currentNav, benchmarkReturns);
  
  const analysis: PmeAnalysis = {
    id,
    portfolioId,
    benchmarkId,
    method,
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    results,
    timeSeries: [],
    calculatedAt: Timestamp.now()
  };
  
  await setDoc(doc(db, PME_ANALYSES, id), analysis);
  
  return analysis;
}

async function getBenchmarkReturnSeries(
  benchmarkId: string,
  startDate: Date,
  endDate: Date
): Promise<{ date: Date; return: number; level: number }[]> {
  const dataRef = collection(db, BENCHMARKS, benchmarkId, 'data');
  const q = query(
    dataRef,
    where('date', '>=', Timestamp.fromDate(startDate)),
    where('date', '<=', Timestamp.fromDate(endDate)),
    orderBy('date')
  );
  
  const snap = await getDocs(q);
  
  return snap.docs.map(d => {
    const data = d.data() as BenchmarkData;
    return {
      date: data.date.toDate(),
      return: data.returnMtd || 0,
      level: data.level
    };
  });
}

function calculateLongNickels(
  cashFlows: { date: Date; amount: number; type: string }[],
  currentNav: number,
  benchmarkReturns: { date: Date; return: number; level: number }[]
): PmeAnalysis['results'] {
  let fundFV = currentNav;
  let indexFV = 0;
  
  for (const cf of cashFlows) {
    const startLevel = benchmarkReturns.find(b =>
      b.date.getTime() >= cf.date.getTime()
    )?.level || 100;
    const endLevel = benchmarkReturns[benchmarkReturns.length - 1]?.level || 100;
    const indexReturn = endLevel / startLevel;
    
    if (cf.type === 'contribution') {
      indexFV += Math.abs(cf.amount) * indexReturn;
    } else {
      indexFV -= cf.amount * indexReturn;
    }
  }
  
  const pmeRatio = indexFV > 0 ? fundFV / indexFV : 0;
  
  return {
    longNickels: {
      fundFutureValue: { amount: fundFV, currency: 'USD' },
      indexFutureValue: { amount: indexFV, currency: 'USD' },
      pmeRatio,
      outperformance: { amount: fundFV - indexFV, currency: 'USD' }
    },
    kaplanSchoar: {
      pmeMultiple: pmeRatio,
      interpretation: pmeRatio > 1 ? 'outperformed' : pmeRatio < 1 ? 'underperformed' : 'matched'
    }
  };
}

// ============================================================================
// PEER COMPARISON
// ============================================================================

export async function getPeerUniverse(id: string): Promise<PeerUniverse | null> {
  const snap = await getDoc(doc(db, PEER_UNIVERSES, id));
  return snap.exists() ? (snap.data() as PeerUniverse) : null;
}

export async function getPeerUniverses(): Promise<PeerUniverse[]> {
  const q = query(collection(db, PEER_UNIVERSES), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as PeerUniverse);
}

export async function calculatePeerRanking(
  portfolioId: string,
  universeId: string,
  asOfDate: Date
): Promise<PeerRanking> {
  const portfolioRef = doc(db, 'advisoryPlatform/advisory/portfolios', portfolioId);
  const portfolioSnap = await getDoc(portfolioRef);
  
  if (!portfolioSnap.exists()) {
    throw new Error(`Portfolio ${portfolioId} not found`);
  }
  
  const portfolio = portfolioSnap.data();
  const perf = portfolio.performanceSummary || {};
  
  const universe = await getPeerUniverse(universeId);
  if (!universe) {
    throw new Error(`Universe ${universeId} not found`);
  }
  
  const stats = universe.statistics;
  
  const rankings: MetricRanking[] = [];
  
  // IRR ranking
  const irrValue = perf.netIRR || 0;
  rankings.push(calculateMetricRanking('irr', irrValue, stats.irr));
  
  // TVPI ranking
  const tvpiValue = perf.tvpi || 0;
  rankings.push(calculateMetricRanking('tvpi', tvpiValue, stats.tvpi));
  
  // DPI ranking
  const dpiValue = perf.dpi || 0;
  rankings.push(calculateMetricRanking('dpi', dpiValue, stats.dpi));
  
  // Summary
  const quartiles = rankings.map(r => r.quartile);
  const topQuartileCount = quartiles.filter(q => q === 1).length;
  const bottomQuartileCount = quartiles.filter(q => q === 4).length;
  
  const avgQuartile = quartiles.reduce((a, b) => a + b, 0) / quartiles.length;
  const overallQuartile = Math.round(avgQuartile) as 1 | 2 | 3 | 4;
  
  const id = doc(collection(db, PEER_RANKINGS)).id;
  
  const ranking: PeerRanking = {
    id,
    portfolioId,
    portfolioName: portfolio.name,
    universeId,
    universeName: universe.name,
    asOfDate: Timestamp.fromDate(asOfDate),
    rankings,
    summary: {
      overallQuartile,
      metricsInTopQuartile: topQuartileCount,
      metricsInBottomQuartile: bottomQuartileCount,
      strongestMetric: rankings.reduce((best, r) =>
        r.percentileRank > (rankings.find(x => x.metric === best)?.percentileRank || 0) ? r.metric : best
      , rankings[0].metric),
      weakestMetric: rankings.reduce((worst, r) =>
        r.percentileRank < (rankings.find(x => x.metric === worst)?.percentileRank || 100) ? r.metric : worst
      , rankings[0].metric)
    },
    calculatedAt: Timestamp.now()
  };
  
  await setDoc(doc(db, PEER_RANKINGS, id), ranking);
  
  return ranking;
}

function calculateMetricRanking(
  metric: 'irr' | 'tvpi' | 'dpi' | 'rvpi' | 'moic',
  value: number,
  distribution: PercentileDistribution
): MetricRanking {
  let percentileRank: number;
  
  if (value >= distribution.percentile95) percentileRank = 97;
  else if (value >= distribution.percentile90) percentileRank = 92;
  else if (value >= distribution.percentile75) percentileRank = 82;
  else if (value >= distribution.median) percentileRank = 62;
  else if (value >= distribution.percentile25) percentileRank = 37;
  else if (value >= distribution.percentile10) percentileRank = 15;
  else if (value >= distribution.percentile5) percentileRank = 7;
  else percentileRank = 2;
  
  const quartile: 1 | 2 | 3 | 4 =
    percentileRank >= 75 ? 1 :
    percentileRank >= 50 ? 2 :
    percentileRank >= 25 ? 3 : 4;
  
  const decile = Math.min(10, Math.max(1, Math.ceil(percentileRank / 10)));
  
  return {
    metric,
    value,
    universeMedian: distribution.median,
    universeTopQuartile: distribution.percentile75,
    universeBottomQuartile: distribution.percentile25,
    universeCount: distribution.count,
    percentileRank,
    quartile,
    decile,
    spreadToMedian: value - distribution.median,
    spreadToTopQuartile: value - distribution.percentile75
  };
}

// ============================================================================
// J-CURVE ANALYSIS
// ============================================================================

export async function calculateJCurve(
  portfolioId: string,
  asOfDate: Date
): Promise<JCurveAnalysis> {
  const portfolioRef = doc(db, 'advisoryPlatform/advisory/portfolios', portfolioId);
  const portfolioSnap = await getDoc(portfolioRef);
  
  if (!portfolioSnap.exists()) {
    throw new Error(`Portfolio ${portfolioId} not found`);
  }
  
  const portfolio = portfolioSnap.data();
  const inceptionDate = portfolio.lifecycle?.inceptionDate?.toDate() || new Date();
  
  // Get NAV history
  const navHistoryRef = collection(portfolioRef, 'navHistory');
  const navHistorySnap = await getDocs(query(navHistoryRef, orderBy('valuationDate')));
  
  const dataPoints: JCurveDataPoint[] = [];
  let jCurveBottom: JCurveAnalysis['jCurveBottom'] = null;
  let lowestIrr = Infinity;
  let hasReachedBreakeven = false;
  let breakevenQuarter: number | null = null;
  let breakevenDate: Date | null = null;
  
  navHistorySnap.docs.forEach((d) => {
    const nav = d.data();
    const navDate = nav.valuationDate?.toDate() || asOfDate;
    const quartersSinceInception = Math.floor(
      (navDate.getTime() - inceptionDate.getTime()) / (1000 * 60 * 60 * 24 * 90)
    );
    
    const paidIn = portfolio.capitalStructure?.paidInCapital?.amount || 0;
    const distributions = portfolio.capitalStructure?.totalDistributions?.amount || 0;
    const navValue = nav.netAssetValue?.amount || 0;
    
    const tvpi = paidIn > 0 ? (navValue + distributions) / paidIn : 0;
    const dpi = paidIn > 0 ? distributions / paidIn : 0;
    const rvpi = paidIn > 0 ? navValue / paidIn : 0;
    const irr = (tvpi - 1) / Math.max(1, quartersSinceInception / 4);
    
    dataPoints.push({
      quarter: quartersSinceInception,
      date: Timestamp.fromDate(navDate),
      paidInCapital: { amount: paidIn, currency: 'USD' },
      distributions: { amount: distributions, currency: 'USD' },
      nav: { amount: navValue, currency: 'USD' },
      irr,
      moic: tvpi,
      dpi,
      rvpi,
      tvpi
    });
    
    if (irr < lowestIrr) {
      lowestIrr = irr;
      jCurveBottom = {
        quarter: quartersSinceInception,
        irr,
        moic: tvpi,
        date: Timestamp.fromDate(navDate)
      };
    }
    
    if (!hasReachedBreakeven && tvpi >= 1) {
      hasReachedBreakeven = true;
      breakevenQuarter = quartersSinceInception;
      breakevenDate = navDate;
    }
  });
  
  const lastPoint = dataPoints[dataPoints.length - 1];
  
  return {
    portfolioId,
    asOfDate: Timestamp.fromDate(asOfDate),
    dataPoints,
    jCurveBottom,
    breakeven: {
      quarterToBreakeven: breakevenQuarter,
      dateOfBreakeven: breakevenDate ? Timestamp.fromDate(breakevenDate) : null,
      hasReachedBreakeven
    },
    currentPosition: lastPoint ? {
      quartersSinceInception: lastPoint.quarter,
      irr: lastPoint.irr,
      moic: lastPoint.moic,
      dpi: lastPoint.dpi,
      rvpi: lastPoint.rvpi
    } : {
      quartersSinceInception: 0,
      irr: 0,
      moic: 0,
      dpi: 0,
      rvpi: 0
    }
  };
}

// ============================================================================
// ATTRIBUTION ANALYSIS
// ============================================================================

export async function calculateAttribution(
  scope: 'holding' | 'portfolio' | 'client',
  scopeId: string,
  startDate: Date,
  endDate: Date
): Promise<PerformanceAttribution> {
  const id = doc(collection(db, ATTRIBUTIONS)).id;
  
  const attribution: PerformanceAttribution = {
    id,
    scope,
    scopeId,
    period: 'custom',
    startDate: Timestamp.fromDate(startDate),
    endDate: Timestamp.fromDate(endDate),
    totalReturn: 0,
    totalReturnAmount: { amount: 0, currency: 'USD' },
    valueCreationAttribution: {
      entryValue: { amount: 0, currency: 'USD' },
      exitValue: { amount: 0, currency: 'USD' },
      components: [],
      totalValueCreated: { amount: 0, currency: 'USD' },
      totalValueCreatedPercent: 0
    },
    feeAttribution: {
      totalFeeDrag: 0,
      totalFeeAmount: { amount: 0, currency: 'USD' },
      managementFee: { amount: { amount: 0, currency: 'USD' }, basisPoints: 0, impact: 0 },
      performanceFee: { amount: { amount: 0, currency: 'USD' }, effectiveRate: 0, impact: 0 },
      transactionCosts: { amount: { amount: 0, currency: 'USD' }, impact: 0 },
      otherFees: { amount: { amount: 0, currency: 'USD' }, breakdown: [], impact: 0 },
      grossReturn: 0,
      netReturn: 0,
      feeDrag: 0
    },
    currencyAttribution: {
      totalCurrencyImpact: 0,
      totalCurrencyAmount: { amount: 0, currency: 'USD' },
      byCurrency: []
    },
    calculatedAt: Timestamp.now(),
    methodology: 'value_creation'
  };
  
  await setDoc(doc(db, ATTRIBUTIONS, id), attribution);
  
  return attribution;
}

export async function getAttribution(id: string): Promise<PerformanceAttribution | null> {
  const snap = await getDoc(doc(db, ATTRIBUTIONS, id));
  return snap.exists() ? (snap.data() as PerformanceAttribution) : null;
}

// ============================================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================================

export function subscribeToPerformanceSnapshot(
  snapshotId: string,
  callback: (snapshot: PerformanceSnapshot | null) => void
): () => void {
  return onSnapshot(
    doc(db, PERFORMANCE_SNAPSHOTS, snapshotId),
    (snap) => {
      callback(snap.exists() ? (snap.data() as PerformanceSnapshot) : null);
    }
  );
}

export function subscribeToPortfolioPerformance(
  portfolioId: string,
  callback: (snapshots: PerformanceSnapshot[]) => void
): () => void {
  const q = query(
    collection(db, PERFORMANCE_SNAPSHOTS),
    where('scope', '==', 'portfolio'),
    where('scopeId', '==', portfolioId),
    orderBy('asOfDate', 'desc'),
    limit(12)
  );
  
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => d.data() as PerformanceSnapshot));
  });
}

export function subscribeToPeerRankings(
  portfolioId: string,
  callback: (rankings: PeerRanking[]) => void
): () => void {
  const q = query(
    collection(db, PEER_RANKINGS),
    where('portfolioId', '==', portfolioId),
    orderBy('asOfDate', 'desc'),
    limit(12)
  );
  
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => d.data() as PeerRanking));
  });
}
