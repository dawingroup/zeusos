/**
 * Design Manager Layout
 * Tab-based navigation for Design Manager module sub-pages
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const DESIGN_TABS: TabNavItem[] = [
  { id: 'projects', label: 'Projects', path: '/design', icon: 'FolderOpen', exact: true },
  { id: 'materials', label: 'Materials', path: '/design/materials', icon: 'Boxes' },
  { id: 'features', label: 'Features', path: '/design/features', icon: 'Layers' },
  { id: 'knowledge-base', label: 'Knowledge Base', path: '/design/knowledge-base', icon: 'Brain' },
];

export default function DesignManagerLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Design Manager"
        subtitle="Projects, Materials & Features"
        tabs={DESIGN_TABS}
        accentColor="cyan"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
