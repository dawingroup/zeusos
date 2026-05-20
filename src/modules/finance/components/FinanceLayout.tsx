/**
 * Finance Layout
 * Tab-based navigation for Finance module sub-pages
 * Coordinates with main header for sticky positioning
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const FINANCE_TABS: TabNavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/finance/overview',
    icon: 'BarChart3',
  },
  {
    id: 'cash',
    label: 'Cash & Forecast',
    path: '/finance/cash',
    icon: 'TrendingUp',
  },
  {
    id: 'operations',
    label: 'Operations',
    path: '/finance/operations',
    icon: 'Receipt',
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/finance/settings',
    icon: 'Settings',
  },
];

export function FinanceLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Finance"
        subtitle="Financial Management & Reporting"
        tabs={FINANCE_TABS}
        accentColor="green"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default FinanceLayout;
