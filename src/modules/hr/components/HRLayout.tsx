/**
 * HR Central Layout
 * Tab-based navigation for HR module sub-pages
 * Coordinates with main header for sticky positioning
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const HR_TABS: TabNavItem[] = [
  {
    id: 'employees',
    label: 'Employees',
    path: '/hr/employees',
    icon: 'Users',
  },
  {
    id: 'performance',
    label: 'Performance',
    path: '/hr/performance/reviews',
    icon: 'TrendingUp',
  },
  {
    id: 'org-structure',
    label: 'Org Structure',
    path: '/hr/org-structure',
    icon: 'Building2',
  },
  {
    id: 'leave',
    label: 'Leave Management',
    path: '/hr/leave',
    icon: 'Calendar',
  },
  {
    id: 'payroll',
    label: 'Payroll',
    path: '/hr/payroll',
    icon: 'DollarSign',
  },
  {
    id: 'kpis',
    label: 'KPIs',
    path: '/strategy/kpis/library?category=human_resources',
    icon: 'Gauge',
  },
];

export function HRLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="HR Central"
        subtitle="Human Resources Management"
        tabs={HR_TABS}
        accentColor="blue"
        className="lg:top-12" // Offset for desktop header height
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default HRLayout;
