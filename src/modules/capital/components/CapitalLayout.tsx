/**
 * Capital Hub Layout
 * Tab-based navigation for the Capital Hub module
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const CAPITAL_TABS: TabNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/capital/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    id: 'needs',
    label: 'Capital Needs',
    path: '/capital/needs',
    icon: 'Target',
  },
  {
    id: 'products',
    label: 'Products',
    path: '/capital/products',
    icon: 'Package',
  },
  {
    id: 'readiness',
    label: 'Readiness',
    path: '/capital/readiness',
    icon: 'ClipboardCheck',
  },
  {
    id: 'applications',
    label: 'Applications',
    path: '/capital/applications',
    icon: 'FileText',
  },
  {
    id: 'facilities',
    label: 'Facilities',
    path: '/capital/facilities',
    icon: 'Building',
  },
];

export function CapitalLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Capital Hub"
        subtitle="Capital Planning, Readiness & Application Tracking"
        tabs={CAPITAL_TABS}
        accentColor="amber"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default CapitalLayout;
