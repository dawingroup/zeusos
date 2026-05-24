/**
 * KPI Layout
 * Sub-navigation for the KPI section within CEO Strategy module.
 * Uses pill-style tabs (not ModuleTabNav) to avoid double headers.
 */

import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, BookOpen, Activity, ClipboardCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SubTab {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  exact?: boolean;
}

const KPI_SUB_TABS: SubTab[] = [
  { id: 'overview', label: 'Overview', path: '/strategy/kpis', icon: LayoutDashboard, exact: true },
  { id: 'library', label: 'Library', path: '/strategy/kpis/library', icon: BookOpen },
  { id: 'active', label: 'Active Tracking', path: '/strategy/kpis/active', icon: Activity },
  { id: 'scorecards', label: 'Scorecards', path: '/strategy/kpis/scorecards', icon: ClipboardCheck },
];

export function KPILayout() {
  const location = useLocation();

  function isActive(tab: SubTab): boolean {
    if (tab.exact) {
      return location.pathname === tab.path;
    }
    return location.pathname.startsWith(tab.path);
  }

  return (
    <div>
      {/* Pill-style sub-navigation */}
      <div className="mb-6">
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-sunken)] rounded-lg w-fit">
          {KPI_SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab);
            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                end={tab.exact}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
                  ${active
                    ? 'bg-card text-[var(--rag-blue)] shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)]'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* Page content */}
      <Outlet />
    </div>
  );
}

export default KPILayout;
