/**
 * Performance Layout
 * Sub-navigation for Performance Management module
 */

import { Outlet } from 'react-router-dom';
import { ModuleTabNav, TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const PERFORMANCE_TABS: TabNavItem[] = [
  {
    id: 'reviews',
    label: 'Reviews',
    path: '/hr/performance/reviews',
    icon: 'ClipboardCheck',
  },
  {
    id: 'goals',
    label: 'Goals',
    path: '/hr/performance/goals',
    icon: 'Target',
  },
  {
    id: 'development',
    label: 'Development Plans',
    path: '/hr/performance/development',
    icon: 'GraduationCap',
  },
  {
    id: 'competencies',
    label: 'Competencies',
    path: '/hr/performance/competencies',
    icon: 'Award',
  },
  {
    id: 'training',
    label: 'Training Catalog',
    path: '/hr/performance/training',
    icon: 'BookOpen',
  },
];

export function PerformanceLayout() {
  return (
    <div className="flex flex-col min-h-full">
      <ModuleTabNav
        title="Performance Management"
        subtitle="Reviews, Goals & Development"
        tabs={PERFORMANCE_TABS}
        accentColor="purple"
        className="lg:top-12"
      />
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default PerformanceLayout;
