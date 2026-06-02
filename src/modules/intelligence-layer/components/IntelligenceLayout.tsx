/**
 * Intelligence Layer Layout
 * Tab navigation wrapper for AI Intelligence modules
 */

import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brain, ClipboardList, Users, Settings } from 'lucide-react';
import { useAuth } from '@/integration/store';
import { useCurrentDawinUser } from '@/core/settings';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

interface TabItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const INTELLIGENCE_TABS: TabItem[] = [
  // Paths align with the registered routes under /intelligence (the DawinOS
  // /ai base was never wired in ZeusOS — these 404'd).
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/intelligence',
    icon: Brain,
  },
  {
    id: 'my-tasks',
    label: 'My Tasks',
    path: '/intelligence/inbox',
    icon: ClipboardList,
  },
  {
    id: 'memory',
    label: 'Business Memory',
    path: '/intelligence/memory',
    icon: Brain,
  },
  {
    id: 'team',
    label: 'Team Dashboard',
    path: '/intelligence/manager',
    icon: Users,
    roles: ['manager', 'admin', 'owner', 'super_admin'],
  },
  {
    id: 'admin',
    label: 'Admin Console',
    path: '/intelligence/admin',
    icon: Settings,
    roles: ['admin', 'owner', 'super_admin'],
  },
];

export default function IntelligenceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { dawinUser } = useCurrentDawinUser();

  // Role-gate the manager/admin tabs. Zeus assigns authority via the user's
  // `globalRole` (PARENT-org owner/admin/super_admin, plus `manager`), NOT the
  // DawinOS `users/{uid}.roles` array that `hasRole()` reads — which is unset
  // for Zeus users. Honour both so the Team Dashboard + Admin Console tabs are
  // visible to the right people instead of hidden from everyone.
  const globalRole = dawinUser?.globalRole;
  const satisfiesRole = (roles: string[]) =>
    roles.some((role) => hasRole(role)) || (!!globalRole && roles.includes(globalRole));

  const visibleTabs = INTELLIGENCE_TABS.filter(tab => {
    if (!tab.roles) return true;
    return satisfiesRole(tab.roles);
  });

  const isActive = (path: string) => {
    if (path === '/ai') {
      return location.pathname === '/ai';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation */}
      <div className="border-b border-[var(--border-subtle)] bg-card">
        <div className="px-6">
          <nav className="flex space-x-8" aria-label="Intelligence Tabs">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = isActive(tab.path);

              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`
                    flex items-center gap-2 py-3.5 px-1 border-b-2 text-[13px]
                    transition-colors
                    ${
                      active
                        ? 'border-[var(--zeus-red)] text-[var(--fg-primary)] font-semibold'
                        : 'border-transparent text-[var(--fg-tertiary)] font-medium hover:text-[var(--fg-primary)]'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${active ? 'text-[var(--fg-primary)]' : 'text-[var(--fg-tertiary)]'}`} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <ModuleContentWrapper noPadding>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
}
