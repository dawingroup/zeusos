/**
 * CRM Pipeline Service
 * Pipeline analytics and KPI calculations
 */

import type { CRMDeal, CRMDealStage, PipelineSummary, PipelineStageMetrics } from '../types';
import { CRM_ACTIVE_DEAL_STAGES, CRM_DEAL_STAGE_ORDER } from '../constants/crm.constants';

/**
 * Calculate pipeline summary from a list of deals
 */
export function calculatePipelineSummary(deals: CRMDeal[]): PipelineSummary {
  const now = Date.now();

  // Initialize stage metrics
  const byStage = {} as Record<CRMDealStage, PipelineStageMetrics>;
  for (const stage of CRM_DEAL_STAGE_ORDER) {
    byStage[stage] = {
      stage,
      count: 0,
      totalValue: 0,
      weightedValue: 0,
      averageAge: 0,
    };
  }

  let totalPipelineValue = 0;
  let weightedPipelineValue = 0;
  let wonCount = 0;
  let lostCount = 0;
  let wonThisMonth = 0;
  let wonThisQuarter = 0;
  let lostThisMonth = 0;
  let totalWonValue = 0;
  let totalSalesCycleDays = 0;
  let closedDealsCount = 0;

  const currentMonth = new Date().getMonth();
  const currentQuarter = Math.floor(currentMonth / 3);
  const currentYear = new Date().getFullYear();

  for (const deal of deals) {
    const stage = deal.stage;
    const stageMetrics = byStage[stage];
    if (!stageMetrics) continue;

    stageMetrics.count++;
    stageMetrics.totalValue += deal.estimatedValue;
    stageMetrics.weightedValue += deal.weightedValue;

    // Age in days since stage entered
    if (deal.stageEnteredAt) {
      const enteredMs = deal.stageEnteredAt.toMillis?.() ?? (deal.stageEnteredAt as unknown as { seconds: number }).seconds * 1000;
      const ageDays = (now - enteredMs) / (1000 * 60 * 60 * 24);
      stageMetrics.averageAge = stageMetrics.count > 0
        ? (stageMetrics.averageAge * (stageMetrics.count - 1) + ageDays) / stageMetrics.count
        : ageDays;
    }

    // Active pipeline
    if (CRM_ACTIVE_DEAL_STAGES.includes(stage)) {
      totalPipelineValue += deal.estimatedValue;
      weightedPipelineValue += deal.weightedValue;
    }

    // Closed deals
    if (stage === 'won') {
      wonCount++;
      totalWonValue += deal.estimatedValue;

      if (deal.actualCloseDate) {
        const closeDate = deal.actualCloseDate.toDate?.() ?? new Date((deal.actualCloseDate as unknown as { seconds: number }).seconds * 1000);
        if (closeDate.getFullYear() === currentYear) {
          if (closeDate.getMonth() === currentMonth) wonThisMonth++;
          if (Math.floor(closeDate.getMonth() / 3) === currentQuarter) wonThisQuarter++;
        }
      }

      // Sales cycle calculation
      if (deal.createdAt && deal.actualCloseDate) {
        const createdMs = deal.createdAt.toMillis?.() ?? (deal.createdAt as unknown as { seconds: number }).seconds * 1000;
        const closedMs = deal.actualCloseDate.toMillis?.() ?? (deal.actualCloseDate as unknown as { seconds: number }).seconds * 1000;
        totalSalesCycleDays += (closedMs - createdMs) / (1000 * 60 * 60 * 24);
        closedDealsCount++;
      }
    }

    if (stage === 'lost') {
      lostCount++;
      if (deal.actualCloseDate) {
        const closeDate = deal.actualCloseDate.toDate?.() ?? new Date((deal.actualCloseDate as unknown as { seconds: number }).seconds * 1000);
        if (closeDate.getFullYear() === currentYear && closeDate.getMonth() === currentMonth) {
          lostThisMonth++;
        }
      }
    }
  }

  const totalClosed = wonCount + lostCount;
  const conversionRate = totalClosed > 0 ? (wonCount / totalClosed) * 100 : 0;
  const averageDealSize = wonCount > 0 ? totalWonValue / wonCount : 0;
  const averageSalesCycle = closedDealsCount > 0 ? totalSalesCycleDays / closedDealsCount : 0;

  return {
    totalDeals: deals.length,
    totalPipelineValue,
    weightedPipelineValue,
    byStage,
    conversionRate,
    averageDealSize,
    averageSalesCycle,
    wonThisMonth,
    wonThisQuarter,
    lostThisMonth,
  };
}

/**
 * Get deals grouped by stage for kanban display
 */
export function groupDealsByStage(deals: CRMDeal[]): Record<CRMDealStage, CRMDeal[]> {
  const grouped = {} as Record<CRMDealStage, CRMDeal[]>;
  for (const stage of CRM_DEAL_STAGE_ORDER) {
    grouped[stage] = [];
  }
  for (const deal of deals) {
    if (grouped[deal.stage]) {
      grouped[deal.stage].push(deal);
    }
  }
  return grouped;
}
