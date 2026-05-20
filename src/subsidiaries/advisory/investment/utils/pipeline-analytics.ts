/**
 * Pipeline analytics utility functions
 */

import { Deal, DealSummary, MoneyAmount } from '../types/deal';
import { DealStage, DEFAULT_STAGE_CONFIGS } from '../types/deal-stage';

/**
 * Calculate deal velocity (time through pipeline)
 */
export function calculateDealVelocity(deal: Deal): number {
  if (!deal.stageHistory || deal.stageHistory.length === 0) {
    return 0;
  }

  const firstEntry = deal.stageHistory[0];
  const lastEntry = deal.stageHistory[deal.stageHistory.length - 1];

  const startDate = firstEntry.enteredAt.toDate();
  const endDate = lastEntry.exitedAt?.toDate() || new Date();

  return Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate stage aging (days in current stage)
 */
export function calculateStageAging(deal: Deal): number {
  const now = new Date();
  const stageEnteredDate = deal.stageEnteredAt.toDate();
  return Math.floor((now.getTime() - stageEnteredDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if deal is overdue in stage
 */
export function isOverdueInStage(deal: Deal): boolean {
  const stageConfig = DEFAULT_STAGE_CONFIGS.find(c => c.stage === deal.currentStage);
  if (!stageConfig) return false;

  const daysInStage = calculateStageAging(deal);
  return daysInStage > stageConfig.typicalDuration * 1.5;  // 150% of typical duration
}

/**
 * Calculate pipeline funnel conversion
 */
export function calculateFunnelConversion(deals: Deal[]): FunnelMetrics {
  const stages: DealStage[] = [
    'screening', 'preliminary', 'due_diligence', 'negotiation',
    'documentation', 'closing'
  ];

  const funnel: FunnelMetrics = {
    stages: [],
    overallConversion: 0,
  };

  let previousCount = 0;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const dealsInStage = deals.filter(d => 
      d.stageHistory?.some(h => h.stage === stage)
    ).length;

    const conversionRate = previousCount > 0 
      ? (dealsInStage / previousCount) * 100 
      : 100;

    funnel.stages.push({
      stage,
      count: dealsInStage,
      conversionRate: i === 0 ? 100 : conversionRate,
    });

    previousCount = dealsInStage;
  }

  // Overall conversion from screening to closing
  const screeningCount = funnel.stages[0]?.count || 0;
  const closingCount = funnel.stages[funnel.stages.length - 1]?.count || 0;
  funnel.overallConversion = screeningCount > 0 
    ? (closingCount / screeningCount) * 100 
    : 0;

  return funnel;
}

export interface FunnelMetrics {
  stages: Array<{
    stage: DealStage;
    count: number;
    conversionRate: number;
  }>;
  overallConversion: number;
}

/**
 * Calculate weighted pipeline value
 */
export function calculateWeightedPipelineValue(deals: DealSummary[]): number {
  // Stage weights for probability-weighted value
  const stageWeights: Record<DealStage, number> = {
    screening: 0.05,
    preliminary: 0.10,
    due_diligence: 0.25,
    negotiation: 0.50,
    documentation: 0.75,
    closing: 0.90,
    post_closing: 1.0,
    asset_management: 1.0,
    exit_planning: 1.0,
    exit: 1.0,
  };

  return deals.reduce((sum, deal) => {
    const weight = stageWeights[deal.currentStage] || 0;
    return sum + (deal.targetAmount.amount * weight);
  }, 0);
}

/**
 * Group deals by time period
 */
export function groupDealsByPeriod(
  deals: Deal[],
  period: 'week' | 'month' | 'quarter' | 'year'
): Map<string, Deal[]> {
  const grouped = new Map<string, Deal[]>();

  for (const deal of deals) {
    const date = deal.createdAt.toDate();
    let key: string;

    switch (period) {
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
        break;
      case 'year':
        key = `${date.getFullYear()}`;
        break;
    }

    const existing = grouped.get(key) || [];
    existing.push(deal);
    grouped.set(key, existing);
  }

  return grouped;
}

/**
 * Calculate expected close by month
 */
export function calculateExpectedClosesByMonth(deals: DealSummary[]): Map<string, MoneyAmount> {
  const byMonth = new Map<string, number>();

  for (const deal of deals) {
    if (!deal.expectedCloseDate) continue;

    const date = new Date(deal.expectedCloseDate);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    const current = byMonth.get(key) || 0;
    byMonth.set(key, current + deal.targetAmount.amount);
  }

  const result = new Map<string, MoneyAmount>();
  for (const [key, value] of byMonth) {
    result.set(key, { amount: value, currency: 'USD' });
  }

  return result;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: MoneyAmount): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount.amount);
}

/**
 * Format large numbers (e.g., $1.5M)
 */
export function formatLargeNumber(amount: MoneyAmount): string {
  const value = amount.amount;
  const symbol = amount.currency === 'USD' ? '$' : amount.currency;

  if (value >= 1_000_000_000) {
    return `${symbol}${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${symbol}${(value / 1_000).toFixed(0)}K`;
  }
  return `${symbol}${value.toFixed(0)}`;
}

/**
 * Calculate average deal size
 */
export function calculateAverageDealSize(deals: DealSummary[]): MoneyAmount {
  if (deals.length === 0) {
    return { amount: 0, currency: 'USD' };
  }

  const total = deals.reduce((sum, deal) => sum + deal.targetAmount.amount, 0);
  return { amount: total / deals.length, currency: 'USD' };
}

/**
 * Get deals at risk (overdue in stage or flagged)
 */
export function getDealsAtRisk(deals: Deal[]): Deal[] {
  return deals.filter(deal => {
    // Check if overdue in stage
    if (isOverdueInStage(deal)) return true;
    
    // Check if due diligence has red flags
    if (deal.dueDiligenceStatus.redFlagsCount > 0) return true;
    
    // Check if deal status suggests issues
    if (deal.status === 'on_hold') return true;
    
    return false;
  });
}

/**
 * Calculate stage distribution
 */
export function calculateStageDistribution(deals: DealSummary[]): Record<DealStage, number> {
  const distribution: Record<DealStage, number> = {
    screening: 0,
    preliminary: 0,
    due_diligence: 0,
    negotiation: 0,
    documentation: 0,
    closing: 0,
    post_closing: 0,
    asset_management: 0,
    exit_planning: 0,
    exit: 0,
  };

  for (const deal of deals) {
    if (distribution[deal.currentStage] !== undefined) {
      distribution[deal.currentStage]++;
    }
  }

  return distribution;
}

/**
 * Get top deals by value
 */
export function getTopDealsByValue(deals: DealSummary[], count = 5): DealSummary[] {
  return [...deals]
    .sort((a, b) => b.targetAmount.amount - a.targetAmount.amount)
    .slice(0, count);
}

/**
 * Calculate deal win rate by sector
 */
export function calculateWinRateBySector(deals: Deal[]): Map<string, number> {
  const sectorStats = new Map<string, { won: number; total: number }>();

  for (const deal of deals) {
    if (deal.status === 'closed_won' || deal.status === 'closed_lost') {
      const current = sectorStats.get(deal.sector) || { won: 0, total: 0 };
      if (deal.status === 'closed_won') {
        current.won++;
      }
      current.total++;
      sectorStats.set(deal.sector, current);
    }
  }

  const winRates = new Map<string, number>();
  for (const [sector, stats] of sectorStats) {
    winRates.set(sector, stats.total > 0 ? (stats.won / stats.total) * 100 : 0);
  }

  return winRates;
}
