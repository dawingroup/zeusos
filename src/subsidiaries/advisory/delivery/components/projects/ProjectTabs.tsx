/**
 * Project Tabs - Route-based tab navigation for project sections
 */

import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Target,
  DollarSign,
  TrendingUp,
  Calendar,
  CalendarClock,
  Users,
  FileText,
  Receipt,
  MapPin,
  Wallet,
  Package,
  Settings,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type ProjectTabId =
  | 'overview'
  | 'scope'
  | 'budget'
  | 'progress'
  | 'timeline'
  | 'schedule'
  | 'team'
  | 'documents'
  | 'payments'
  | 'requisitions'
  | 'visits'
  | 'boq'
  | 'procurement'
  | 'reports'
  | 'settings';

interface Tab {
  id: ProjectTabId;
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  matchPaths?: string[]; // Additional paths that should activate this tab
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '' }, // Empty path for index route
  { id: 'boq', label: 'Control BOQ', icon: FileText, path: 'boq', matchPaths: ['boq/summary', 'boq/details', 'boq/materials', 'boq/import', 'boq/review'] },
  { id: 'scope', label: 'Scope', icon: Target, path: 'scope' },
  { id: 'budget', label: 'Budget', icon: DollarSign, path: 'budget' },
  { id: 'payments', label: 'Payments', icon: Receipt, path: 'payments' },
  { id: 'requisitions', label: 'Requisitions', icon: Wallet, path: 'requisitions' },
  { id: 'procurement', label: 'Procurement', icon: Package, path: 'procurement' },
  { id: 'progress', label: 'Progress', icon: TrendingUp, path: 'progress' },
  { id: 'visits', label: 'Site Visits', icon: MapPin, path: 'visits' },
  { id: 'timeline', label: 'Timeline', icon: Calendar, path: 'timeline' },
  { id: 'schedule', label: 'Schedule', icon: CalendarClock, path: 'schedule' },
  { id: 'team', label: 'Team', icon: Users, path: 'team' },
  { id: 'documents', label: 'Documents', icon: FileText, path: 'documents' },
  { id: 'reports', label: 'Reports', icon: ClipboardList, path: 'reports' },
  { id: 'settings', label: 'Settings', icon: Settings, path: 'settings' },
];

export function ProjectTabs() {
  const location = useLocation();

  const isTabActive = (tab: Tab): boolean => {
    // Get the relative path within the project (after /projects/:projectId/)
    const pathParts = location.pathname.split('/');
    const projectIndex = pathParts.indexOf('projects');
    if (projectIndex === -1) return false;

    const relativePath = pathParts.slice(projectIndex + 2).join('/'); // Skip 'projects' and projectId

    // Check if this is the overview tab (empty path means index route)
    if (tab.path === '' && (!relativePath || relativePath === '')) {
      return true;
    }

    // Check if current path starts with tab path
    if (relativePath.startsWith(tab.path + '/') || relativePath === tab.path) {
      return true;
    }

    // Check additional match paths
    if (tab.matchPaths) {
      return tab.matchPaths.some(matchPath =>
        relativePath.startsWith(matchPath) || relativePath === matchPath
      );
    }

    return false;
  };

  return (
    <div className="border-b bg-white sticky top-0 z-20">
      <nav className="flex overflow-x-auto">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = isTabActive(tab);

          return (
            <NavLink
              key={tab.id}
              to={tab.path}
              end={tab.path === ''} // Use 'end' for index route to avoid matching all sub-routes
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export function MobileTabSelector() {
  const location = useLocation();

  const getActiveTab = (): ProjectTabId => {
    const pathParts = location.pathname.split('/');
    const projectIndex = pathParts.indexOf('projects');
    if (projectIndex === -1) return 'overview';

    const relativePath = pathParts.slice(projectIndex + 2).join('/');
    if (!relativePath) return 'overview';

    const activeTab = TABS.find(tab => {
      if (tab.path === '') return false;
      if (relativePath.startsWith(tab.path)) return true;
      if (tab.matchPaths) {
        return tab.matchPaths.some(matchPath => relativePath.startsWith(matchPath));
      }
      return false;
    });

    return activeTab?.id || 'overview';
  };

  const handleChange = (tabId: string) => {
    const tab = TABS.find(t => t.id === tabId);
    if (tab) {
      // This would need to use navigate, but for simplicity we'll use NavLink approach
      // Mobile selector can be enhanced later if needed
      window.location.hash = `#${tab.path}`;
    }
  };

  return (
    <div className="md:hidden">
      <select
        value={getActiveTab()}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-4 py-3 border rounded-lg bg-white text-gray-900"
      >
        {TABS.map(tab => (
          <option key={tab.id} value={tab.id}>
            {tab.label}
          </option>
        ))}
      </select>
    </div>
  );
}
