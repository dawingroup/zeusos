/**
 * CRM Layout
 * Tab-based navigation for CRM module sub-pages
 * Follows FinanceLayout pattern with ModuleTabNav + Outlet
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, type TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const CRM_TABS: TabNavItem[] = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    path: '/crm/pipeline',
    icon: 'Kanban',
  },
  {
    id: 'deals',
    label: 'Deals',
    path: '/crm/deals',
    icon: 'Handshake',
  },
  {
    id: 'projects',
    label: 'Project Tracker',
    path: '/crm/projects',
    icon: 'FolderKanban',
  },
  {
    id: 'activities',
    label: 'Activities',
    path: '/crm/activities',
    icon: 'Activity',
  },
  {
    id: 'tasks',
    label: 'Sales Tasks',
    path: '/crm/tasks',
    icon: 'CheckSquare',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/crm/reports',
    icon: 'BarChart3',
  },
];

export function CRMLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="CRM"
        subtitle="Sales Pipeline & Customer Relationships"
        tabs={CRM_TABS}
        accentColor="blue"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default CRMLayout;
