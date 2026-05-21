/**
 * Advisory Layout
 * Tab-based navigation for Advisory module
 * Follows Capital Hub UI patterns with QuickNav for power users
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { AdvisoryQuickNav } from './navigation/AdvisoryQuickNav';

const ADVISORY_TABS: TabNavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '/advisory',
    icon: 'LayoutDashboard',
    exact: true,
  },
  {
    id: 'investment',
    label: 'Investment',
    path: '/advisory/investment',
    icon: 'Briefcase',
  },
  {
    id: 'delivery',
    label: 'Infrastructure Delivery',
    path: '/advisory/delivery',
    icon: 'Building2',
  },
];

export function AdvisoryLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Zeus Group"
        subtitle="Construction Consulting & Project Management"
        tabs={ADVISORY_TABS}
        accentColor="amber"
        className="lg:top-12"
        rightContent={<AdvisoryQuickNav />}
      />
      <ModuleContentWrapper noPadding className="bg-gray-50">
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default AdvisoryLayout;
