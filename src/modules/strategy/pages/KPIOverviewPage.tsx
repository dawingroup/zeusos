/**
 * KPI Overview Page
 * Landing page for the KPI section showing category cards, stats, and quick actions.
 * Replaces the previous "Coming Soon" KPIDashboard placeholder.
 */

import { useNavigate, Link } from 'react-router-dom';
import {
  BookOpen,
  Activity,
  ArrowRight,
  DollarSign,
  Megaphone,
  Users,
  UserCheck,
  Settings,
  HeartPulse,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useKPIs } from '../hooks/useKPIs';
import { KPI_LIBRARY } from '../constants/kpiLibrary.constants';
import { KPI_LIBRARY_CATEGORIES } from '../constants/kpiLibrary.constants';
import { KPI_PERFORMANCE } from '../constants/kpi.constants';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

// ── Category icon map ─────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  financial_performance: DollarSign,
  sales_marketing: Megaphone,
  customer_success: Users,
  human_resources: UserCheck,
  operations_safety: Settings,
  healthcare: HeartPulse,
};

// ── Category Card ─────────────────────────────────────────────────────────

function CategoryCard({ category, kpiCount }: {
  category: typeof KPI_LIBRARY_CATEGORIES[number];
  kpiCount: number;
}) {
  const Icon = CATEGORY_ICONS[category.id] || BarChart3;

  return (
    <Link
      to={`/strategy/kpis/library?category=${category.id}`}
      className="bg-card rounded-lg border border-[var(--border-subtle)] p-4 hover:shadow-md hover:border-[var(--border-default)] transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="rounded-lg p-2.5"
          style={{ backgroundColor: `${category.color}15` }}
        >
          <Icon className="w-5 h-5" style={{ color: category.color }} />
        </div>
        <ArrowRight className="w-4 h-4 text-[var(--fg-tertiary)] group-hover:text-muted-foreground transition-colors" />
      </div>
      <h3 className="text-sm font-semibold text-foreground mb-1">{category.label}</h3>
      <p className="text-xs text-muted-foreground">
        {kpiCount} KPIs &middot; {category.subCategories.length} sub-categories
      </p>
    </Link>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

const COMPANY_ID = 'dawinos';

export function KPIOverviewPage() {
  const navigate = useNavigate();

  const { activeKPIs, criticalKPIs, staleKPIs } = useKPIs({
    companyId: COMPANY_ID,
    activeOnly: false,
    autoFetch: true,
  });

  const onTargetCount = activeKPIs.filter(
    (k) => k.currentPerformance === KPI_PERFORMANCE.ON_TARGET || k.currentPerformance === KPI_PERFORMANCE.EXCEEDING
  ).length;

  // Count KPIs per library category
  const categoryCounts: Record<string, number> = {};
  for (const cat of KPI_LIBRARY_CATEGORIES) {
    const entries = KPI_LIBRARY.filter((entry) => {
      const mapping: Record<string, string> = {
        financial_performance: 'financial',
        sales_marketing: 'sales_marketing',
        customer_success: 'customer',
        human_resources: 'people',
        operations_safety: 'operational',
        healthcare: 'healthcare',
      };
      return entry.category === mapping[cat.id] ||
        (cat.id === 'operations_safety' && entry.category === 'quality');
    });
    categoryCounts[cat.id] = entries.length;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">KPI Library & Tracking</h1>
        <p className="text-muted-foreground text-sm">
          Browse {KPI_LIBRARY.length}+ industry-standard KPIs, add them to active tracking, and build scorecards.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="mb-8">
        <KPIGrid cols={5}>
          <KPICard label="Library KPIs" value={KPI_LIBRARY.length} />
          <KPICard label="Tracked" value={activeKPIs.length} />
          <KPICard label="On Target" value={onTargetCount} trend="up" />
          <KPICard label="Critical" value={criticalKPIs.length} trend={criticalKPIs.length > 0 ? 'down' : undefined} />
          <KPICard label="Stale" value={staleKPIs.length} />
        </KPIGrid>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => navigate('/strategy/kpis/library')}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--rag-blue)] text-white text-sm font-medium rounded-lg hover:bg-[var(--rag-blue)] transition-colors"
        >
          <BookOpen className="w-4 h-4" />
          Browse Library
        </button>
        <button
          onClick={() => navigate('/strategy/kpis/active')}
          className="flex items-center gap-2 px-4 py-2 bg-card text-muted-foreground text-sm font-medium rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-sunken)] transition-colors"
        >
          <Activity className="w-4 h-4" />
          Active Tracking
        </button>
        <button
          onClick={() => navigate('/strategy/kpis/scorecards')}
          className="flex items-center gap-2 px-4 py-2 bg-card text-muted-foreground text-sm font-medium rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--bg-sunken)] transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          Scorecards
        </button>
      </div>

      {/* Category Cards */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Browse by Category</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {KPI_LIBRARY_CATEGORIES.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              kpiCount={categoryCounts[cat.id] || 0}
            />
          ))}
        </div>
      </div>

      {/* Cross-Module Links */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Module Integrations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Finance Link */}
          <Link
            to="/finance/overview/kpis"
            className="bg-card rounded-lg border border-[var(--border-subtle)] p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-[var(--rag-green-soft)] rounded-lg p-2.5">
                <DollarSign className="w-5 h-5 text-[var(--rag-green)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Finance Module KPIs</h3>
                <p className="text-xs text-muted-foreground">6 auto-computed financial metrics from QBO</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--fg-tertiary)] group-hover:text-muted-foreground ml-auto" />
            </div>
            <p className="text-xs text-muted-foreground">
              Gross Margin, Operating Margin, Net Margin, EBITDA Margin, Revenue, COGS Ratio
            </p>
          </Link>

          {/* HR Link */}
          <Link
            to="/hr/performance/reviews"
            className="bg-card rounded-lg border border-[var(--border-subtle)] p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="bg-purple-50 rounded-lg p-2.5">
                <UserCheck className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">HR Module</h3>
                <p className="text-xs text-muted-foreground">8 people KPIs available in library</p>
              </div>
              <ArrowRight className="w-4 h-4 text-[var(--fg-tertiary)] group-hover:text-muted-foreground ml-auto" />
            </div>
            <p className="text-xs text-muted-foreground">
              Staff Turnover, Retention, Absenteeism, Training, Performance Reviews, Headcount
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default KPIOverviewPage;
