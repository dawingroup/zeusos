/**
 * Account Management layout — tab navigation across the Phase 3.D AM
 * surfaces. Mirrors the BillingLayout pattern; routes inside the layout
 * are guarded by AMAccessGuard at the router level.
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const AM_TABS: TabNavItem[] = [
  { id: 'clients',      label: 'Clients',           path: '/clients',                  icon: 'Building2' },
  { id: 'master-jobs',  label: 'Master Jobs',       path: '/master-jobs',              icon: 'Briefcase' },
  { id: 'reviews',      label: 'Deliverable Review',path: '/account-mgmt/reviews',     icon: 'CheckSquare' },
  { id: 'intake',       label: 'Intake Queue',      path: '/account-mgmt/intake',      icon: 'Inbox' },
];

export function AMLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Account Management"
        subtitle="Clients, contracts, jobs and deliverable review (Zeus Group commercial core)"
        tabs={AM_TABS}
        accentColor="blue"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default AMLayout;
