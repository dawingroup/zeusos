// ============================================================================
// ANALYSIS LANDING PAGE
// ZeusOS v2.0 - Finance Module
// Section landing page with card grid linking to 8 analysis sub-pages
// ============================================================================

import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Search,
  Target,
  ArrowLeftRight,
  TrendingUp,
  LineChart,
  Crosshair,
  Heart,
  Library,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Card Definitions ─────────────────────────────────────────────────────────

interface AnalysisCard {
  icon: LucideIcon;
  label: string;
  description: string;
  path: string;
}

const CARDS: AnalysisCard[] = [
  {
    icon: BarChart3,
    label: 'KPIs',
    description: 'Key financial ratios and metrics',
    path: '/finance/analysis/kpis',
  },
  {
    icon: Search,
    label: 'KPI Explorer',
    description: 'Deep-dive into individual KPIs',
    path: '/finance/analysis/kpi-explorer',
  },
  {
    icon: Target,
    label: 'Profitability',
    description: 'Breakeven analysis & cost structure',
    path: '/finance/analysis/profitability',
  },
  {
    icon: ArrowLeftRight,
    label: 'Cash Flow',
    description: 'Cash flow analysis & waterfall',
    path: '/finance/analysis/cash-flow',
  },
  {
    icon: TrendingUp,
    label: 'Growth',
    description: 'Revenue & expense growth rates',
    path: '/finance/analysis/growth',
  },
  {
    icon: LineChart,
    label: 'Trend',
    description: 'Time-series trends across accounts',
    path: '/finance/analysis/trend',
  },
  {
    icon: Crosshair,
    label: 'Goal Seek',
    description: 'Sensitivity analysis & targets',
    path: '/finance/analysis/goal-seek',
  },
  {
    icon: Heart,
    label: 'Financial Health',
    description: 'Overall financial health score',
    path: '/finance/analysis/financial',
  },
  {
    icon: Library,
    label: 'KPI Library',
    description: 'Browse the full financial KPI library',
    path: '/strategy/kpis/library?category=financial_performance',
  },
];

// ── Card Component ───────────────────────────────────────────────────────────

function AnalysisNavCard({ card }: { card: AnalysisCard }) {
  const navigate = useNavigate();
  const Icon = card.icon;

  return (
    <div
      onClick={() => navigate(card.path)}
      className="bg-card border border-[var(--border-subtle)] rounded-xl p-5 hover:border-green-300 hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-10 h-10 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
          <Icon className="h-5 w-5 text-green-600" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground group-hover:text-green-700 transition-colors">
            {card.label}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {card.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export function AnalysisLandingPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Financial Analysis</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Analyse financial performance, ratios, and trends
        </p>
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CARDS.map((card) => (
          <AnalysisNavCard key={card.path} card={card} />
        ))}
      </div>
    </div>
  );
}

export default AnalysisLandingPage;
