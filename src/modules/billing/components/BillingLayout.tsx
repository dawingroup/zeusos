/**
 * Billing Layout — tab navigation across the Phase 3.F surfaces.
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const BILLING_TABS: TabNavItem[] = [
  {
    id: 'client-invoices',
    label: 'Client Invoices',
    path: '/billing/client-invoices',
    icon: 'FileText',
  },
  {
    id: 'intercompany',
    label: 'Inter-Company',
    path: '/billing/intercompany',
    icon: 'Briefcase',
  },
  {
    id: 'gl-status',
    label: 'GL Adapter Status',
    path: '/billing/gl-status',
    icon: 'Plug',
  },
];

export function BillingLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Billing"
        subtitle="Client invoices & inter-company settlement"
        tabs={BILLING_TABS}
        accentColor="green"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default BillingLayout;
