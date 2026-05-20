// Persistent pill sub-navigation for the Overview section.
// Wraps all /finance/overview/* sub-pages so pills remain visible.

import { Outlet } from 'react-router-dom';
import {
  BarChart3,
  Percent,
  DollarSign,
  TrendingUp,
  LineChart,
  Crosshair,
  Heart,
  FileText,
} from 'lucide-react';
import { SubNavPills, type SubNavPill } from '../SubNavPills';

const OVERVIEW_NAV: SubNavPill[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/finance/overview' },
  { id: 'kpis', label: 'KPIs', icon: BarChart3, path: '/finance/overview/kpis' },
  { id: 'profitability', label: 'Profitability', icon: Percent, path: '/finance/overview/profitability' },
  { id: 'cash-flow', label: 'Cash Flow', icon: DollarSign, path: '/finance/overview/cash-flow' },
  { id: 'growth', label: 'Growth', icon: TrendingUp, path: '/finance/overview/growth' },
  { id: 'trend', label: 'Trend', icon: LineChart, path: '/finance/overview/trend' },
  { id: 'goal-seek', label: 'Goal Seek', icon: Crosshair, path: '/finance/overview/goal-seek' },
  { id: 'health', label: 'Health', icon: Heart, path: '/finance/overview/financial-health' },
  { id: 'reports', label: 'Reports', icon: FileText, path: '/finance/overview/reports' },
];

export function OverviewLayout() {
  return (
    <div className="space-y-5">
      <SubNavPills pills={OVERVIEW_NAV} />
      <Outlet />
    </div>
  );
}
