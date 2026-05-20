/**
 * Peer Comparison & Ranking
 * 
 * Compare portfolio/fund performance against:
 * - Custom peer groups
 * - Industry universes
 * - Vintage year cohorts
 * - Strategy peers
 */

import { Timestamp } from 'firebase/firestore';
import type { MoneyAmount } from './portfolio';

// ============================================================================
// PEER UNIVERSE
// ============================================================================

export type PeerUniverseCategory =
  | 'infrastructure'
  | 'private_equity'
  | 'real_estate'
  | 'private_debt'
  | 'venture_capital'
  | 'natural_resources'
  | 'fund_of_funds'
  | 'custom';

export interface PeerUniverse {
  id: string;
  
  name: string;
  code: string;
  description?: string;
  
  category: PeerUniverseCategory;
  strategy?: string;
  geography?: string;
  vintage?: number;
  
  provider: string;
  providerUniverseId?: string;
  
  composition: {
    totalFunds: number;
    totalAum: MoneyAmount;
    vintageRange: { start: number; end: number };
    geographicFocus: string[];
    strategies: string[];
  };
  
  statistics: PeerStatistics;
  
  dataAsOf: Timestamp;
  updateFrequency: 'monthly' | 'quarterly';
  
  isActive: boolean;
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================================================
// PEER STATISTICS
// ============================================================================

export interface PeerStatistics {
  asOfDate: Timestamp;
  
  numberOfFunds: number;
  totalCapital: MoneyAmount;
  
  irr: PercentileDistribution;
  tvpi: PercentileDistribution;
  dpi: PercentileDistribution;
  rvpi?: PercentileDistribution;
  
  paidInPercent?: PercentileDistribution;
  distributedPercent?: PercentileDistribution;
}

export interface PercentileDistribution {
  min: number;
  percentile5: number;
  percentile10: number;
  percentile25: number;
  median: number;
  percentile75: number;
  percentile90: number;
  percentile95: number;
  max: number;
  mean: number;
  standardDeviation: number;
  count: number;
}

// ============================================================================
// PEER RANKING
// ============================================================================

export interface PeerRanking {
  id: string;
  
  portfolioId: string;
  portfolioName: string;
  
  universeId: string;
  universeName: string;
  
  asOfDate: Timestamp;
  
  rankings: MetricRanking[];
  
  summary: {
    overallQuartile: 1 | 2 | 3 | 4;
    metricsInTopQuartile: number;
    metricsInBottomQuartile: number;
    strongestMetric: string;
    weakestMetric: string;
  };
  
  rankingHistory?: RankingHistoryPoint[];
  
  calculatedAt: Timestamp;
}

export interface MetricRanking {
  metric: 'irr' | 'tvpi' | 'dpi' | 'rvpi' | 'moic';
  
  value: number;
  
  universeMedian: number;
  universeTopQuartile: number;
  universeBottomQuartile: number;
  universeCount: number;
  
  percentileRank: number;
  quartile: 1 | 2 | 3 | 4;
  decile: number;
  
  spreadToMedian: number;
  spreadToTopQuartile: number;
}

export interface RankingHistoryPoint {
  date: Timestamp;
  
  irrRank: number;
  irrQuartile: 1 | 2 | 3 | 4;
  
  tvpiRank: number;
  tvpiQuartile: 1 | 2 | 3 | 4;
  
  dpiRank: number;
  dpiQuartile: 1 | 2 | 3 | 4;
}

// ============================================================================
// VINTAGE YEAR ANALYSIS
// ============================================================================

export interface VintageAnalysis {
  portfolioId: string;
  vintage: number;
  asOfDate: Timestamp;
  
  portfolioMetrics: {
    irr: number;
    tvpi: number;
    dpi: number;
    rvpi: number;
    paidInPercent: number;
    fundAge: number;
  };
  
  vintagePeerComparison: {
    universeId: string;
    numberOfPeers: number;
    
    irrPercentile: number;
    irrQuartile: 1 | 2 | 3 | 4;
    vintageMedianIrr: number;
    
    tvpiPercentile: number;
    tvpiQuartile: 1 | 2 | 3 | 4;
    vintageMedianTvpi: number;
    
    dpiPercentile: number;
    dpiQuartile: 1 | 2 | 3 | 4;
    vintageMedianDpi: number;
  };
  
  jCurvePosition: {
    quartileOnJCurve: 1 | 2 | 3 | 4;
    expectedVsActual: 'ahead' | 'on_track' | 'behind';
    typicalIrrAtThisAge: number;
    typicalTvpiAtThisAge: number;
  };
  
  vintageCharacteristics: {
    totalCapitalRaised: MoneyAmount;
    avgFundSize: MoneyAmount;
    marketEnvironment: string;
    notableEvents?: string[];
  };
}

// ============================================================================
// CUSTOM PEER GROUP
// ============================================================================

export interface CustomPeerGroup {
  id: string;
  
  name: string;
  description?: string;
  
  createdBy: string;
  createdAt: Timestamp;
  
  members: PeerGroupMember[];
  
  selectionCriteria?: {
    vintageRange?: { start: number; end: number };
    sizeRange?: { min: MoneyAmount; max: MoneyAmount };
    strategies?: string[];
    geographies?: string[];
    otherCriteria?: string;
  };
  
  statistics?: PeerStatistics;
  lastCalculated?: Timestamp;
  
  isPublic: boolean;
  sharedWith?: string[];
}

export interface PeerGroupMember {
  externalFundId?: string;
  externalFundName?: string;
  provider?: string;
  
  portfolioId?: string;
  
  metrics?: {
    irr: number;
    tvpi: number;
    dpi: number;
    vintage: number;
    asOfDate: Timestamp;
  };
  
  addedAt: Timestamp;
  addedBy: string;
}

// ============================================================================
// PEER COMPARISON SUMMARY
// ============================================================================

export interface PeerComparisonSummary {
  portfolioId: string;
  asOfDate: Timestamp;
  
  primaryUniverse: {
    id: string;
    name: string;
    irrQuartile: 1 | 2 | 3 | 4;
    tvpiQuartile: 1 | 2 | 3 | 4;
    percentileRank: number;
  };
  
  vintageComparison?: {
    vintage: number;
    irrVsMedian: number;
    tvpiVsMedian: number;
    quartile: 1 | 2 | 3 | 4;
  };
  
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    quartersInTopQuartile: number;
    quartersInBottomQuartile: number;
  };
}
