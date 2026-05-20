/**
 * Launch Pipeline Module Entry Point (Finishes Subsidiary)
 * Layout-based routing with tab navigation
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const PIPELINE_TABS: TabNavItem[] = [
  { id: 'pipeline', label: 'Pipeline', path: '/launch-pipeline', icon: 'Rocket', exact: true },
  { id: 'audit', label: 'Audit', path: '/launch-pipeline/audit', icon: 'ClipboardCheck' },
];

export default function LaunchPipelineModule() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Launch Pipeline"
        subtitle="Product Launches"
        tabs={PIPELINE_TABS}
        accentColor="purple"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
