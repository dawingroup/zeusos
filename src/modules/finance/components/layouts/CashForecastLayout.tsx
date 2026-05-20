// Persistent pill sub-navigation for the Cash & Forecast section.
// Wraps all /finance/cash/* sub-pages so pills remain visible.

import { Outlet } from 'react-router-dom';
import {
  BarChart3,
  FileSpreadsheet,
  Calendar,
  ListOrdered,
  TrendingUp,
  PiggyBank,
  Scale,
  Brain,
  GitBranch,
  Building2,
  Landmark,
} from 'lucide-react';
import { SubNavPills, type SubNavPill } from '../SubNavPills';

const CASH_NAV: SubNavPill[] = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/finance/cash' },
  { id: 'forecast', label: '3-Way Forecast', icon: FileSpreadsheet, path: '/finance/cash/forecast' },
  { id: 'spend-plan', label: 'Spend Plan', icon: Calendar, path: '/finance/cash/spend-plan' },
  { id: 'expenditures', label: 'Queue', icon: ListOrdered, path: '/finance/cash/expenditures' },
  { id: 'receipts', label: 'Receipts', icon: Landmark, path: '/finance/cash/receipts' },
  { id: 'projections', label: 'Projections', icon: TrendingUp, path: '/finance/cash/projections' },
  { id: 'savings', label: 'Savings', icon: PiggyBank, path: '/finance/cash/savings' },
  { id: 'liabilities', label: 'Liabilities', icon: Scale, path: '/finance/cash/liabilities' },
  { id: 'briefing', label: 'CFO Briefing', icon: Brain, path: '/finance/cash/briefing' },
  { id: 'scenarios', label: 'Scenarios', icon: GitBranch, path: '/finance/cash/scenarios' },
  { id: 'group', label: 'Group View', icon: Building2, path: '/finance/cash/group' },
];

export function CashForecastLayout() {
  return (
    <div className="space-y-5">
      <SubNavPills pills={CASH_NAV} />
      <Outlet />
    </div>
  );
}
