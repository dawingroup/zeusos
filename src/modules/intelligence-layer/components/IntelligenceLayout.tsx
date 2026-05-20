/**
 * Intelligence Layer Layout
 * Tab navigation wrapper for AI Intelligence modules
 */

import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Brain, ClipboardList, Users, Settings } from 'lucide-react';
import { useAuth } from '@/integration/store';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';

interface TabItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

const INTELLIGENCE_TABS: TabItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/ai',
    icon: Brain,
  },
  {
    id: 'my-tasks',
    label: 'My Tasks',
    path: '/my-tasks',
    icon: ClipboardList,
  },
  {
    id: 'team',
    label: 'Team Dashboard',
    path: '/ai/team',
    icon: Users,
    roles: ['manager', 'admin', 'owner', 'super_admin'],
  },
  {
    id: 'admin',
    label: 'Admin Console',
    path: '/ai/admin',
    icon: Settings,
    roles: ['admin', 'owner', 'super_admin'],
  },
];

export default function IntelligenceLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  // Filter tabs based on user role using the standard hasRole() API
  const visibleTabs = INTELLIGENCE_TABS.filter(tab => {
    if (!tab.roles) return true;
    return tab.roles.some(role => hasRole(role));
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
      <div className="border-b border-gray-200 bg-white">
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
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                    transition-colors
                    ${
                      active
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-400'}`} />
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
