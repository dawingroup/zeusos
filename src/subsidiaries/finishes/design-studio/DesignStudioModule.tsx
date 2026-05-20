/**
 * Design Studio Module Entry Point (Finishes Subsidiary)
 *
 * Quick Review is the primary landing experience — a unified 3D viewer
 * that lets a user drop in any model and work it end-to-end: inspect,
 * auto-detect cabinets with AI, run AI assembly grouping, and optionally
 * promote the result into a persistent multi-cabinet Scene.
 *
 * Scenes is the secondary persistent workspace for multi-cabinet projects
 * that need production handoff.
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const DESIGN_STUDIO_TABS: TabNavItem[] = [
  { id: 'viewer', label: 'Quick Review', path: '/workshop', icon: 'Box', exact: true },
  { id: 'scenes', label: 'Scenes', path: '/workshop/scenes', icon: 'Layout' },
];

export default function DesignStudioModule() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Design Studio"
        subtitle="Viewer, AI Grouping & Scene Composition"
        tabs={DESIGN_STUDIO_TABS}
        accentColor="blue"
        className="lg:top-12"
      />
      <ModuleContentWrapper className="min-h-0 px-2 sm:px-4 pt-3 sm:pt-6 pb-3 sm:pb-6">
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
