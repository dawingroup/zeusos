/**
 * Budget Summary Cards - 6 key budget metrics with edit trigger
 */

import { DollarSign, Clock, TrendingUp, TrendingDown, Shield, Edit3 } from 'lucide-react';
import { MetricCard } from '../common/MetricCard';
import { formatBudgetAmount } from '../../types/project-budget';
import type { ProjectBudget, BudgetSummary } from '../../types/project-budget';

interface BudgetSummaryCardsProps {
  budget: ProjectBudget;
  summary: BudgetSummary;
  requisitionSummary: {
    totalRequisitioned: number;
    totalPaid: number;
    count: number;
  };
  onEditBudget: () => void;
}

export function BudgetSummaryCards({
  budget,
  summary,
  onEditBudget,
}: BudgetSummaryCardsProps) {
  // Use computed summary values for consistency (not stored budget.remaining which may be stale)
  const utilizationPct = summary.totalBudget > 0
    ? (((summary.totalSpent + summary.totalCommitted) / summary.totalBudget) * 100).toFixed(1)
    : '0';

  const remainingHighlight = summary.status === 'critical'
    ? 'danger' as const
    : summary.status === 'over_budget'
    ? 'warning' as const
    : summary.remaining < 0
    ? 'danger' as const
    : 'success' as const;

  const contingencyPct = budget.contingencyPercent ?? 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Budget Overview</h3>
        <button
          onClick={onEditBudget}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Edit Budget
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Budget"
          value={formatBudgetAmount(summary.totalBudget, budget.currency)}
          iconColor="text-blue-500"
        />
        <MetricCard
          icon={DollarSign}
          label="Spent"
          value={formatBudgetAmount(summary.totalSpent, budget.currency)}
          iconColor="text-indigo-500"
        />
        <MetricCard
          icon={Clock}
          label="Committed"
          value={formatBudgetAmount(summary.totalCommitted, budget.currency)}
          iconColor="text-amber-500"
        />
        <MetricCard
          icon={summary.remaining >= 0 ? TrendingUp : TrendingDown}
          label="Remaining"
          value={formatBudgetAmount(Math.abs(summary.remaining), budget.currency)}
          iconColor={summary.remaining >= 0 ? 'text-green-500' : 'text-red-500'}
          highlight={remainingHighlight}
        />
        <MetricCard
          icon={Shield}
          label="Contingency"
          value={`${contingencyPct}%`}
          iconColor="text-yellow-500"
        />
        <MetricCard
          icon={summary.remaining >= 0 ? TrendingUp : TrendingDown}
          label="Utilization"
          value={`${utilizationPct}%`}
          iconColor={Number(utilizationPct) > 90 ? 'text-red-500' : 'text-blue-500'}
        />
      </div>
    </div>
  );
}
