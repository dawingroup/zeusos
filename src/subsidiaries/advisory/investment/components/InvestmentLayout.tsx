/**
 * Investment Layout - Tab-based navigation for investment module
 * Refactored from nested sidebar to horizontal tabs
 */

import { Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Kanban, 
  List, 
  PlusCircle,
  BarChart3
} from 'lucide-react';
import { ModuleTabNav, type TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

const investmentTabs: TabNavItem[] = [
  { id: 'dashboard', path: '/advisory/investment', label: 'Overview', icon: LayoutDashboard, exact: true },
  { id: 'pipeline', path: '/advisory/investment/pipeline', label: 'Pipeline', icon: Kanban },
  { id: 'deals', path: '/advisory/investment/deals', label: 'Deals', icon: List },
  { id: 'new-deal', path: '/advisory/investment/deals/new', label: 'New Deal', icon: PlusCircle },
  { id: 'reports', path: '/advisory/investment/reports', label: 'Reports', icon: BarChart3 },
];

export function InvestmentLayout() {
  return (
    <div className="flex flex-col h-full min-h-0">
      <ModuleTabNav
        title="Investment"
        subtitle="Deal Pipeline & Portfolio Management"
        tabs={investmentTabs}
        backPath="/advisory"
        backLabel="Advisory"
        accentColor="emerald"
      />

      {/* Main Content */}
      <ModuleContentWrapper className="bg-gray-50">
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}

export default InvestmentLayout;
