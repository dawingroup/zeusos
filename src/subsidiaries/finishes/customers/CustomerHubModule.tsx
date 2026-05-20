/**
 * Customer Hub Module Entry Point (Finishes Subsidiary)
 * Layout-based routing with tab navigation
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const CUSTOMER_TABS: TabNavItem[] = [
  { id: 'customers', label: 'Customers', path: '/customers', icon: 'Users', exact: true },
];

export default function CustomerHubModule() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Customer Hub"
        subtitle="Customer Management"
        tabs={CUSTOMER_TABS}
        accentColor="blue"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
