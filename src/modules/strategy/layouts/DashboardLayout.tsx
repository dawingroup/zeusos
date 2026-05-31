/**
 * Strategy Layout
 * Tab-based navigation for CEO Strategy module sub-pages
 * Standardized to use ModuleTabNav like all other modules
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, type TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const STRATEGY_TABS: TabNavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/strategy',
    icon: 'LayoutDashboard',
    exact: true,
  },
  {
    id: 'plans',
    label: 'Strategic Plans',
    path: '/strategy/overview',
    icon: 'Flag',
  },
  {
    id: 'okrs',
    label: 'OKRs',
    path: '/strategy/okrs',
    icon: 'Target',
  },
  {
    id: 'kpis',
    label: 'KPIs',
    path: '/strategy/kpis',
    icon: 'Gauge',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    path: '/strategy/analytics',
    icon: 'BarChart3',
  },
  {
    id: 'experiments',
    label: 'Experiments',
    path: '/strategy/experiments',
    icon: 'FlaskConical',
  },
  {
    id: 'options',
    label: 'Options Analysis',
    path: '/strategy/options',
    icon: 'GitBranch',
  },
  {
    id: 'assistant',
    label: 'Strategy Assistant',
    path: '/strategy/assistant',
    icon: 'Sparkles',
  },
];

export const DashboardLayout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="CEO Strategy"
        subtitle="Strategy & Performance Management"
        tabs={STRATEGY_TABS}
        accentColor="blue"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
};

export default DashboardLayout;
