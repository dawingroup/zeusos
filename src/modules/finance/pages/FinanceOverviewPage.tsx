// ============================================================================
// FINANCE OVERVIEW PAGE
// Data-rich landing page replacing the old AnalysisLandingPage card grid.
// Shows: Alerts, KPI cards with sparklines, health score, cash projection,
//        budget utilization, and compact quick-access links.
// ============================================================================

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Skeleton } from '@/core/components/ui/skeleton';
import {
  DollarSign,
  TrendingUp,
  Percent,
  PieChart,
  BarChart3,
  LineChart,
  Crosshair,
  Heart,
  FileText,
  Brain,
  GitBranch,
  Search,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';
import { useFinanceDashboard } from '../hooks/useFinanceDashboard';
import { usePLHistory } from '../hooks/usePLHistory';
import { useOptimizer } from '../hooks/useOptimizer';
import { computeProfitability } from '../services/profitabilityEngine';
import { KPISparkCard } from '../components/overview/KPISparkCard';
import { CircularHealthScore, computeHealthScore } from '../components/overview/CircularHealthScore';
import { FinanceAlertsStrip } from '../components/overview/FinanceAlertsStrip';
import { ProjectionChart } from '../components/optimizer/ProjectionChart';

const COMPANY_ID = 'zeus-group';

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ── Quick Access Links ─────────────────────────────────────────────────────

interface QuickLink {
  label: string;
  icon: React.ElementType;
  path: string;
  color: string;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'KPI Explorer', icon: Search, path: '/finance/overview/kpi-explorer', color: '#7C3AED' },
  { label: 'Growth', icon: TrendingUp, path: '/finance/overview/growth', color: '#059669' },
  { label: 'Trend', icon: LineChart, path: '/finance/overview/trend', color: '#2563EB' },
  { label: 'Goal Seek', icon: Crosshair, path: '/finance/overview/goal-seek', color: '#EA580C' },
  { label: 'AI Reports', icon: FileText, path: '/finance/overview/reports', color: '#6366F1' },
  { label: 'CFO Briefing', icon: Brain, path: '/finance/cash/briefing', color: '#8B5CF6' },
  { label: 'Scenarios', icon: GitBranch, path: '/finance/cash/scenarios', color: '#BE185D' },
  { label: 'Health Detail', icon: Heart, path: '/finance/overview/financial-health', color: '#16a34a' },
];

// ── Loading Skeleton ───────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="lg:col-span-2 h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export function FinanceOverviewPage() {
  const navigate = useNavigate();
  useAuth();

  const {
    metrics,
    budgets,
    loading: dashLoading,
  } = useFinanceDashboard(COMPANY_ID);

  const {
    periodData,
    periods,
    loading: plLoading,
  } = usePLHistory(12);

  const {
    projection,
    criticalCount,
    totalPendingAmount,
    config,
    isLoading: optLoading,
  } = useOptimizer({ companyId: COMPANY_ID });

  // Compute health score from latest P&L
  const healthData = useMemo(() => {
    if (periods.length === 0) return null;
    const latestPeriod = periods[periods.length - 1];
    const pl = periodData[latestPeriod]?.pl;
    if (!pl) return null;
    const profMetrics = computeProfitability(pl);
    const score = computeHealthScore(profMetrics);
    return { score, metrics: profMetrics, period: latestPeriod };
  }, [periodData, periods]);

  // Revenue sparkline data
  const revenueSparkline = useMemo(() => {
    return periods.map((p) => periodData[p]?.pl?.revenue || 0);
  }, [periods, periodData]);

  // Net margin sparkline
  const marginSparkline = useMemo(() => {
    return periods.map((p) => {
      const pl = periodData[p]?.pl;
      if (!pl || pl.revenue === 0) return 0;
      return ((pl.revenue - pl.cogs - pl.opex - pl.depreciation - pl.interest - pl.tax) / pl.revenue) * 100;
    });
  }, [periods, periodData]);

  // Latest revenue & margin values
  const latestRevenue = revenueSparkline.length > 0 ? revenueSparkline[revenueSparkline.length - 1] : 0;
  const latestMargin = marginSparkline.length > 0 ? marginSparkline[marginSparkline.length - 1] : 0;
  const prevRevenue = revenueSparkline.length > 1 ? revenueSparkline[revenueSparkline.length - 2] : 0;
  const revenueChange = prevRevenue > 0 ? ((latestRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  // Budget overspends for alerts
  const budgetOverspends = budgets
    .filter((b) => b.utilization >= 85)
    .map((b) => ({ name: b.name, utilization: b.utilization }));

  const loading = dashLoading || plLoading;

  if (loading && !healthData) return <OverviewSkeleton />;

  const bufferAmount = config?.cashBufferSettings?.minimumCashBuffer || 5_000_000;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Operations · Finance</div>
          <h2 className="h1">Financial overview</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Performance summary and key metrics
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/finance/overview/reports')}
        >
          <FileText className="w-4 h-4 mr-1.5" />
          Generate Report
        </Button>
      </div>

      {/* Row 1: Alerts */}
      <FinanceAlertsStrip
        criticalExpenditures={criticalCount}
        budgetOverspends={budgetOverspends}
        pendingAmount={totalPendingAmount}
      />

      {/* Row 2: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPISparkCard
          label="Cash Position"
          value={`${formatCompact(metrics.totalCash)}`}
          subtitle="UGX"
          icon={DollarSign}
          color="#2563EB"
          href="/finance/cash"
        />
        <KPISparkCard
          label="Revenue"
          value={`${formatCompact(latestRevenue)}`}
          subtitle="Latest month"
          icon={TrendingUp}
          color="#059669"
          href="/finance/overview/trend"
          sparkData={revenueSparkline}
          change={revenueChange}
        />
        <KPISparkCard
          label="Net Margin"
          value={`${latestMargin.toFixed(1)}%`}
          subtitle="Latest month"
          icon={Percent}
          color="#7C3AED"
          href="/finance/overview/profitability"
          sparkData={marginSparkline}
        />
        <KPISparkCard
          label="Budget Util."
          value={`${metrics.budgetUtilization}%`}
          subtitle={`${metrics.activeBudgetCount} active`}
          icon={PieChart}
          color="#EA580C"
          href="/finance/operations/budgets"
        />
      </div>

      {/* Row 3: Detail Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Health + Profitability */}
        <div className="lg:col-span-2 space-y-4">
          <Card
            className="p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/finance/overview/financial-health')}
          >
            <div className="flex items-start gap-6">
              <CircularHealthScore score={healthData?.score || 0} />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Financial Health
                </h3>
                {healthData?.metrics && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Gross Profit</p>
                      <p className="text-sm font-bold text-foreground">
                        {formatCompact(healthData.metrics.grossProfit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Operating</p>
                      <p className="text-sm font-bold text-foreground">
                        {formatCompact(healthData.metrics.operatingProfit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Net Profit</p>
                      <p className={`text-sm font-bold ${healthData.metrics.netProfit >= 0 ? 'text-foreground' : 'text-[var(--rag-red)]'}`}>
                        {formatCompact(healthData.metrics.netProfit)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--fg-tertiary)] shrink-0 mt-2" />
            </div>
          </Card>

          {/* Cash Projection Chart */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">90-Day Cash Projection</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/finance/cash/projections')}
                className="text-xs"
              >
                Details <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            {optLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ProjectionChart
                projection={projection}
                bufferAmount={bufferAmount}
                height={200}
              />
            )}
          </Card>
        </div>

        {/* Right: Budgets */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Budget Status</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/finance/operations/budgets')}
                className="text-xs"
              >
                All <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            {budgets.length > 0 ? (
              <div className="space-y-3">
                {budgets.slice(0, 4).map((b) => (
                  <div key={b.id}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground truncate max-w-[60%]">{b.name}</span>
                      <span className={`text-xs font-medium ${b.utilization >= 100 ? 'text-[var(--rag-red)]' : b.utilization >= 85 ? 'text-[var(--rag-amber)]' : 'text-muted-foreground'}`}>
                        {b.utilization}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${b.utilization >= 100 ? 'bg-[var(--rag-red)]' : b.utilization >= 85 ? 'bg-[var(--rag-amber)]' : 'bg-[var(--rag-green)]'}`}
                        style={{ width: `${Math.min(b.utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--fg-tertiary)] text-center py-4">No active budgets</p>
            )}
          </Card>

          {/* KPIs Mini Card */}
          <Card
            className="p-5 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/finance/overview/kpis')}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground">KPI Dashboard</h3>
              <BarChart3 className="w-4 h-4 text-[var(--fg-tertiary)]" />
            </div>
            <p className="text-xs text-muted-foreground">
              6 core financial KPIs with 12-month trends
            </p>
            <div className="flex items-center gap-1 mt-2 text-xs text-[var(--rag-green)] font-medium">
              View KPIs <ArrowRight className="w-3 h-3" />
            </div>
          </Card>
        </div>
      </div>

      {/* Row 4: Cross-Module Links */}
      <Card className="p-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Connected Modules</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/manufacturing/procurement')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--rag-blue)]" />
            Purchase Orders
          </button>
          <button
            onClick={() => navigate('/assets')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--rag-blue)]" />
            Asset Registry
          </button>
          <button
            onClick={() => navigate('/hr/payroll')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--rag-amber)]" />
            Payroll / PAYE
          </button>
          <button
            onClick={() => navigate('/strategy')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
          >
            <div className="w-2 h-2 rounded-full bg-[var(--rag-green)]" />
            Strategy KPIs
          </button>
        </div>
      </Card>

      {/* Row 5: Quick Access Grid */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Access</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-card border border-[var(--border-subtle)] rounded-lg hover:border-[var(--border-default)] hover:shadow-sm transition-all text-left"
              >
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-md shrink-0"
                  style={{ backgroundColor: `${link.color}12` }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: link.color }} />
                </div>
                <span className="text-sm text-muted-foreground truncate">{link.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default FinanceOverviewPage;
