/**
 * Procurement Layout
 * Tab-based navigation for Procurement module sub-pages
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const PROCUREMENT_TABS: TabNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/procurement', icon: 'LayoutDashboard', exact: true },
  { id: 'orders', label: 'Purchase Orders', path: '/procurement/orders', icon: 'ShoppingCart' },
  { id: 'outsourcing', label: 'Outsourcing', path: '/procurement/outsourcing', icon: 'Factory' },
  { id: 'opo-analytics', label: 'OPO Analytics', path: '/procurement/outsourcing/analytics', icon: 'BarChart3' },
  { id: 'queue', label: 'Procurement Queue', path: '/procurement/queue', icon: 'ListTodo' },
  { id: 'advisor', label: 'Advisor', path: '/procurement/advisor', icon: 'Sparkles' },
];

export default function ProcurementLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Procurement"
        subtitle="Purchase Orders & Buying"
        tabs={PROCUREMENT_TABS}
        accentColor="blue"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
