// ============================================================================
// CASH & FORECAST LANDING PAGE
// Replaces the Optimizer card grid + Forecasting tab with a unified view.
// Shows: KPI cards, pill sub-navigation, projection chart, spend plan,
//        top expenditures (same content as OptimizerDashboardPage but as a tab landing).
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  AlertTriangle,
  RefreshCw,
  Zap,
  TrendingUp,
  Clock,
  Loader2,
  ListOrdered,
  Calendar,
} from 'lucide-react';
import { useOptimizer } from '../hooks/useOptimizer';
import { ProjectionChart } from '../components/optimizer/ProjectionChart';
import { SpendPlanTimeline } from '../components/optimizer/SpendPlanTimeline';
import { TierBadge } from '../components/optimizer/ExpenditureScoreCard';
import { PRIORITY_TIER_COLORS } from '../constants/optimizer.constants';
import { useAuth } from '@/shared/hooks/useAuth';

function formatUGX(value: number): string {
  return `UGX ${value.toLocaleString('en-UG')}`;
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function CashForecastLandingPage() {
  const navigate = useNavigate();
  useAuth();
  const companyId = 'dawinos';

  const {
    projection,
    expenditureQueue,
    todaysSpendPlan,
    config,
    queueByTier,
    criticalCount,
    totalPendingAmount,
    isLoading,
    error,
    refresh,
    generatePlan,
    runIngestion,
    rescoreAll,
    approveItem,
    deferItem,
  } = useOptimizer({ companyId });

  const [isRunning, setIsRunning] = useState(false);

  const handleRunOptimizer = async () => {
    setIsRunning(true);
    try {
      await runIngestion();
      await rescoreAll();
      await generatePlan(
        todaysSpendPlan?.openingBankBalance || 0,
        todaysSpendPlan?.openingSavingsBalance || 0,
      );
    } finally {
      setIsRunning(false);
    }
  };

  if (isLoading && !expenditureQueue.length) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-80 rounded-lg" />
      </div>
    );
  }

  const cashPosition = todaysSpendPlan?.openingBankBalance || 0;
  const pendingCount = expenditureQueue.length;
  const scheduledToday = todaysSpendPlan?.scheduledExpenditures?.length || 0;
  const bufferAmount = config?.cashBufferSettings?.minimumCashBuffer || 5_000_000;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Cash & Forecast</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cash optimization, projections, and three-statement forecasting
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleRunOptimizer}
            disabled={isRunning}
            className="bg-[var(--rag-amber)] hover:bg-[var(--rag-amber)] text-white"
          >
            {isRunning ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-1.5" />
            )}
            Run Optimizer
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-[var(--rag-red-soft)] text-[var(--rag-red)] rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Crisis Alert */}
      {criticalCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg">
          <AlertTriangle className="w-5 h-5 text-[var(--rag-red)] shrink-0" />
          <div>
            <p className="text-sm font-semibold text-[var(--rag-red)]">
              {criticalCount} critical expenditure{criticalCount > 1 ? 's' : ''} require immediate attention
            </p>
            <p className="text-xs text-[var(--rag-red)] mt-0.5">
              Total: {formatUGX(queueByTier['CRITICAL']?.reduce((s: number, i: any) => s + i.amountUGX, 0) || 0)}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-[var(--rag-red)] border-[var(--rag-red)] hover:bg-[var(--rag-red-soft)]"
            onClick={() => navigate('/finance/cash/expenditures?tier=CRITICAL')}
          >
            View
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <KPIGrid cols={4}>
        <KPICard
          label="Cash Position"
          value={formatCompact(cashPosition)}
          unit="UGX"
        />
        <KPICard
          label="Pending Queue"
          value={pendingCount}
          delta={`${formatCompact(totalPendingAmount)} total`}
        />
        <KPICard
          label="Scheduled Today"
          value={scheduledToday}
          delta={todaysSpendPlan ? formatCompact(todaysSpendPlan.totalOutflow) : '—'}
        />
        <KPICard
          label="Priority Tiers"
          value={
            <div className="flex gap-1.5 mt-1">
              {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'DEFERRABLE'] as const).map(tier => {
                const count = queueByTier[tier]?.length || 0;
                return (
                  <div
                    key={tier}
                    className="flex-1 text-center"
                    title={`${tier}: ${count}`}
                  >
                    <div
                      className="text-base font-bold"
                      style={{ color: PRIORITY_TIER_COLORS[tier] }}
                    >
                      {count}
                    </div>
                    <div className="text-[9px] text-[var(--fg-tertiary)] truncate">{tier.slice(0, 4)}</div>
                  </div>
                );
              })}
            </div>
          }
        />
      </KPIGrid>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Projection Chart */}
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">90-Day Cash Projection</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/finance/cash/projections')}
              className="text-xs"
            >
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              Details
            </Button>
          </div>
          <ProjectionChart
            projection={projection}
            bufferAmount={bufferAmount}
            height={300}
          />
        </Card>

        {/* Today's Spend Plan */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Today&apos;s Spend Plan</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/finance/cash/spend-plan')}
              className="text-xs"
            >
              <Calendar className="w-3.5 h-3.5 mr-1" />
              Full Plan
            </Button>
          </div>
          {todaysSpendPlan ? (
            <SpendPlanTimeline
              plan={todaysSpendPlan}
              onApprove={(id) => todaysSpendPlan?.id && approveItem(todaysSpendPlan.id, id)}
              onDefer={(id) => deferItem(id, 'Deferred from dashboard')}
            />
          ) : (
            <Card className="p-6 text-center">
              <Clock className="w-8 h-8 text-[var(--fg-tertiary)] mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No spend plan generated yet</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleRunOptimizer}
                disabled={isRunning}
              >
                Generate Plan
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Top Critical Items */}
      {expenditureQueue.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Top Expenditures by Score</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/finance/cash/expenditures')}
              className="text-xs"
            >
              <ListOrdered className="w-3.5 h-3.5 mr-1" />
              View All
            </Button>
          </div>
          <div className="space-y-2">
            {expenditureQueue.slice(0, 5).map((item: any) => (
              <div key={item.id} className="flex items-center gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
                <span
                  className="text-sm font-bold w-8 text-center"
                  style={{ color: PRIORITY_TIER_COLORS[item.priorityTier as keyof typeof PRIORITY_TIER_COLORS] }}
                >
                  {item.compositeScore.toFixed(0)}
                </span>
                <TierBadge tier={item.priorityTier} />
                <span className="text-sm text-muted-foreground truncate flex-1">{item.description}</span>
                {item.vendor && (
                  <span className="text-xs text-[var(--fg-tertiary)] hidden sm:block">{item.vendor}</span>
                )}
                <span className="text-sm font-medium text-foreground shrink-0">{formatUGX(item.amountUGX)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Data Sources — Cross-module links */}
      <Card className="p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Cash Data Sources
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/finance/operations/bills')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--rag-red)]" />
            QBO Bills & Payables
          </button>
          <button
            onClick={() => navigate('/manufacturing/procurement')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--rag-blue)]" />
            Purchase Orders
          </button>
          <button
            onClick={() => navigate('/hr/payroll')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--rag-amber)]" />
            Salary & PAYE
          </button>
          <button
            onClick={() => navigate('/finance/operations/invoices')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--rag-green)]" />
            Invoices & Receipts
          </button>
        </div>
      </Card>
    </div>
  );
}

export default CashForecastLandingPage;
