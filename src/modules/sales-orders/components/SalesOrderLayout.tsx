/**
 * SalesOrderLayout — Module layout with tab navigation.
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const TABS: TabNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/sales-orders', icon: 'LayoutDashboard', exact: true },
  { id: 'orders', label: 'Orders', path: '/sales-orders/list', icon: 'FileCheck' },
];

export default function SalesOrderLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Sales Orders"
        subtitle="Commercial Protection & Approvals"
        tabs={TABS}
        accentColor="blue"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
