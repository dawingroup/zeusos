/**
 * ComplianceLayout
 * Tab-based navigation for Compliance module sub-pages
 * Uses standard ModuleTabNav + ModuleContentWrapper pattern
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const COMPLIANCE_TABS: TabNavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/compliance',
    icon: 'LayoutDashboard',
    exact: true,
  },
  {
    id: 'documents',
    label: 'Documents',
    path: '/compliance/documents',
    icon: 'FileText',
  },
  {
    id: 'obligations',
    label: 'Obligations',
    path: '/compliance/obligations',
    icon: 'ClipboardCheck',
  },
];

export function ComplianceLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Compliance"
        subtitle="Document Management & Regulatory Compliance"
        tabs={COMPLIANCE_TABS}
        accentColor="green"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default ComplianceLayout;
