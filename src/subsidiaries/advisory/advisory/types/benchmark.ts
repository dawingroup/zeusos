/**
 * Benchmark Management
 * 
 * Support for various benchmark types:
 * - Public market indices (MSCI, S&P, etc.)
 * - Infrastructure indices
 * - Custom benchmarks
 * - PME (Public Market Equivalent) analysis
 * - Peer universe benchmarks
 */

import { Timestamp } from 'firebase/firestore';
import type { Currency, MoneyAmount } from './portfolio';
import type { ReturnPeriod } from './performance';

// ============================================================================
// BENCHMARK DEFINITION
// ============================================================================

export type BenchmarkType =
  | 'public_index'
  | 'infrastructure_index'
  | 'custom_benchmark'
  | 'peer_universe'
  | 'absolute_return'
  | 'risk_free_rate'
  | 'inflation';

export type BenchmarkCategory =
  | 'equity'
  | 'fixed_income'
  | 'real_assets'
  | 'infrastructure'
  | 'private_equity'
  | 'alternatives'
  | 'multi_asset'
  | 'custom';

export interface Benchmark {
  id: string;
  
  code: string;
  name: string;
  description?: string;
  
  type: BenchmarkType;
  category: BenchmarkCategory;
  
  provider: string;
  providerCode?: string;
  
  baseCurrency: Currency;
  availableCurrencies: Currency[];
  
  indexDetails?: {
    baseDate: Timestamp;
    baseValue: number;
    reconstitutionFrequency: 'daily' | 'monthly' | 'quarterly' | 'annual';
    methodology: string;
    numberOfConstituents?: number;
  };
  
  absoluteTarget?: {
    annualTarget: number;
    compoundingFrequency: 'daily' | 'monthly' | 'quarterly' | 'annual';
    premium?: number;
    baseRate?: 'risk_free' | 'inflation' | 'custom';
  };
  
  compositeWeights?: {
    benchmarkId: string;
    weight: number;
    rebalanceFrequency: 'daily' | 'monthly' | 'quarterly' | 'annual';
  }[];
  
  dataStart: Timestamp;
  dataEnd: Timestamp;
  dataFrequency: 'daily' | 'weekly' | 'monthly';
  
  isActive: boolean;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// BENCHMARK DATA
// ============================================================================

export interface BenchmarkData {
  id: string;
  benchmarkId: string;
  
  date: Timestamp;
  
  level: number;
  previousLevel: number;
  
  return1d?: number;
  return1w?: number;
  returnMtd: number;
  returnQtd: number;
  returnYtd: number;
  return1y: number;
  return3y?: number;
  return5y?: number;
  return10y?: number;
  
  volatility1y?: number;
  volatility3y?: number;
  
  currency: Currency;
  
  source: string;
  lastUpdated: Timestamp;
}

// ============================================================================
// BENCHMARK COMPARISON
// ============================================================================

export interface BenchmarkComparison {
  benchmarkId: string;
  benchmarkName: string;
  benchmarkCode: string;
  
  period: ReturnPeriod;
  startDate: Timestamp;
  endDate: Timestamp;
  
  portfolioReturn: number;
  benchmarkReturn: number;
  excessReturn: number;
  
  trackingError: number;
  informationRatio: number;
  beta: number;
  alpha: number;
  rSquared: number;
  correlation: number;
  
  upCaptureRatio: number;
  downCaptureRatio: number;
  
  periodsBeatBenchmark: number;
  totalPeriods: number;
  hitRate: number;
  
  annualizedExcessReturn: number;
  annualizedTrackingError: number;
}

// ============================================================================
// PUBLIC MARKET EQUIVALENT (PME)
// ============================================================================

export type PmeMethod =
  | 'long_nickels'
  | 'kaplan_schoar'
  | 'pme_plus'
  | 'direct_alpha';

export interface PmeAnalysis {
  id: string;
  portfolioId: string;
  benchmarkId: string;
  
  method: PmeMethod;
  
  startDate: Timestamp;
  endDate: Timestamp;
  
  results: {
    longNickels?: {
      fundFutureValue: MoneyAmount;
      indexFutureValue: MoneyAmount;
      pmeRatio: number;
      outperformance: MoneyAmount;
    };
    
    kaplanSchoar?: {
      pmeMultiple: number;
      interpretation: 'outperformed' | 'underperformed' | 'matched';
    };
    
    pmePlus?: {
      lambda: number;
      scaledIrr: number;
      directComparison: {
        fundIrr: number;
        pmeIrr: number;
        spread: number;
      };
    };
    
    directAlpha?: {
      alpha: number;
      tStatistic: number;
      isSignificant: boolean;
    };
  };
  
  timeSeries: PmeTimeSeriesPoint[];
  
  calculatedAt: Timestamp;
  notes?: string;
}

export interface PmeTimeSeriesPoint {
  date: Timestamp;
  
  fundNav: MoneyAmount;
  fundCumulativeCashFlow: MoneyAmount;
  fundIrr: number;
  
  pmeNav: MoneyAmount;
  pmeCumulativeCashFlow: MoneyAmount;
  pmeIrr: number;
  
  navDifference: MoneyAmount;
  outperformance: number;
}

// ============================================================================
// BENCHMARK ASSIGNMENT
// ============================================================================

export interface BenchmarkAssignment {
  id: string;
  
  scope: 'portfolio' | 'strategy' | 'sector' | 'client' | 'engagement';
  scopeId: string;
  
  benchmarkId: string;
  
  role: 'primary' | 'secondary' | 'pme';
  weight?: number;
  
  effectiveFrom: Timestamp;
  effectiveTo?: Timestamp;
  
  assignedBy: string;
  assignedAt: Timestamp;
  rationale?: string;
}

// ============================================================================
// BENCHMARK SUMMARY
// ============================================================================

export interface BenchmarkSummary {
  id: string;
  code: string;
  name: string;
  type: BenchmarkType;
  category: BenchmarkCategory;
  latestReturn: number;
  ytdReturn: number;
  oneYearReturn: number;
  lastUpdated: Timestamp;
}

export interface BenchmarkPerformance {
  benchmarkId: string;
  period: ReturnPeriod;
  
  startDate: Timestamp;
  endDate: Timestamp;
  
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  
  monthlyReturns: { date: Timestamp; return: number }[];
}
