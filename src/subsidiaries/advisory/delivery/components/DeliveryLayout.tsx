/**
 * Delivery Layout Component
 * Tab-based navigation for Infrastructure Delivery module
 * Hides tabs when in project context for focused work
 * Consolidated with MatFlow features (BOQ, Materials, Procurement)
 */

import { Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Package2,
  FlaskConical,
  Users2,
  FileBarChart,
  ClipboardCheck,
  FileStack,
  FileCode2,
  Camera,
  Scale,
  FileCheck,
} from 'lucide-react';
import { ModuleTabNav, type TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { QuickCaptureFAB } from './quick-capture/QuickCaptureFAB';

const deliveryTabs: TabNavItem[] = [
  { id: 'dashboard', path: '/advisory/delivery', label: 'Overview', icon: LayoutDashboard, exact: true },
  { id: 'programs', path: '/advisory/delivery/programs', label: 'Programs', icon: FolderKanban },
  { id: 'projects', path: '/advisory/delivery/projects', label: 'Projects', icon: FileText },
  { id: 'materials', path: '/advisory/delivery/materials', label: 'Materials', icon: Package2 },
  { id: 'formulas', path: '/advisory/delivery/formulas', label: 'Formulas', icon: FlaskConical },
  { id: 'suppliers', path: '/advisory/delivery/suppliers', label: 'Suppliers', icon: Users2 },
  { id: 'quick-captures', path: '/advisory/delivery/quick-captures', label: 'Quick Captures', icon: Camera },
  { id: 'accountability', path: '/advisory/delivery/accountability', label: 'Accountability', icon: ClipboardCheck },
  { id: 'backlog', path: '/advisory/delivery/backlog', label: 'Backlog', icon: FileStack },
  { id: 'reports', path: '/advisory/delivery/reports', label: 'Reports', icon: FileBarChart },
  { id: 'amh-reports', path: '/advisory/delivery/amh-reports', label: 'AMH Reports', icon: FileCheck },
  { id: 'reconciliation', path: '/advisory/delivery/reconciliation', label: 'Reconciliation', icon: Scale },
  { id: 'templates', path: '/advisory/delivery/templates', label: 'Templates', icon: FileCode2 },
];

export function DeliveryLayout() {
  const location = useLocation();

  // Detect if user is in project detail context
  // Pattern: /advisory/delivery/projects/:projectId/*
  const isInProjectContext = () => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const deliveryIndex = pathParts.indexOf('delivery');
    if (deliveryIndex === -1) return false;

    const afterDelivery = pathParts.slice(deliveryIndex + 1);
    // Check if path is: projects/:projectId/... (at least 2 segments after 'projects')
    return afterDelivery[0] === 'projects' && afterDelivery.length >= 2;
  };

  const inProjectContext = isInProjectContext();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Conditionally render tabs - hide when in project context */}
      {!inProjectContext && (
        <ModuleTabNav
          title="Infrastructure Delivery"
          subtitle="Program & Project Management"
          tabs={deliveryTabs}
          backPath="/advisory"
          backLabel="Advisory"
          accentColor="blue"
        />
      )}

      {/* Main Content */}
      <ModuleContentWrapper noPadding={inProjectContext} className="bg-gray-50">
        <Outlet />
      </ModuleContentWrapper>

      {/* Quick Capture FAB — visible on all delivery pages */}
      <QuickCaptureFAB />
    </div>
  );
}

export default DeliveryLayout;
