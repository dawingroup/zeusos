/**
 * Manufacturing Layout
 * Tab-based navigation for Manufacturing module sub-pages
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const MFG_TABS: TabNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/manufacturing', icon: 'LayoutDashboard', exact: true },
  { id: 'orders', label: 'Production Orders', path: '/manufacturing/orders', icon: 'ClipboardList' },
  { id: 'shop-floor', label: 'Shop Floor', path: '/manufacturing/shop-floor', icon: 'Factory' },
  { id: 'workstations', label: 'Workstations', path: '/manufacturing/workstations', icon: 'Monitor' },
  { id: 'routing', label: 'Routing Templates', path: '/manufacturing/routing-templates', icon: 'Route' },
];

export default function ManufacturingLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Manufacturing"
        subtitle="Production & Shop Floor"
        tabs={MFG_TABS}
        accentColor="orange"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
