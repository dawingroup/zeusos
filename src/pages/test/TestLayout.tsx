/**
 * Test Layout Component
 * DawinOS v2.0 - Testing Framework
 * Main layout for testing pages with navigation and status indicators
 */

import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Brain,
  Users,
  TrendingUp,
  Landmark,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Bug,
  Menu,
  X,
} from 'lucide-react';

// Test module configuration
interface TestSubItem {
  id: string;
  name: string;
  path: string;
  status: 'passed' | 'failed' | 'pending' | 'running';
}

interface TestModule {
  id: string;
  name: string;
  phase: string;
  icon: React.ReactNode;
  path: string;
  subItems?: TestSubItem[];
}

const TEST_MODULES: TestModule[] = [
  {
    id: 'dashboard',
    name: 'Test Dashboard',
    phase: 'Overview',
    icon: <LayoutDashboard className="w-5 h-5" />,
    path: '/test',
  },
  {
    id: 'intelligence',
    name: 'Intelligence Layer',
    phase: 'Phase 1',
    icon: <Brain className="w-5 h-5" />,
    path: '/test/intelligence',
    subItems: [
      { id: 'events', name: 'Business Events', path: '/test/intelligence/events', status: 'pending' },
      { id: 'roles', name: 'Role Profiles', path: '/test/intelligence/roles', status: 'pending' },
      { id: 'tasks', name: 'Task Generation', path: '/test/intelligence/task-generation', status: 'pending' },
      { id: 'grey-areas', name: 'Grey Area Detection', path: '/test/intelligence/grey-areas', status: 'pending' },
      { id: 'smart-tasks', name: 'Smart Tasks', path: '/test/intelligence/smart-tasks', status: 'pending' },
    ],
  },
  {
    id: 'hr',
    name: 'HR Central',
    phase: 'Phase 2',
    icon: <Users className="w-5 h-5" />,
    path: '/test/hr',
    subItems: [
      { id: 'employees', name: 'Employee Directory', path: '/test/hr/employees', status: 'pending' },
      { id: 'contracts', name: 'Contracts', path: '/test/hr/contracts', status: 'pending' },
      { id: 'payroll', name: 'Payroll', path: '/test/hr/payroll', status: 'pending' },
      { id: 'leave', name: 'Leave Management', path: '/test/hr/leave', status: 'pending' },
      { id: 'organization', name: 'Organization', path: '/test/hr/organization', status: 'pending' },
    ],
  },
  {
    id: 'strategy',
    name: 'CEO Strategy',
    phase: 'Phase 3',
    icon: <TrendingUp className="w-5 h-5" />,
    path: '/test/strategy',
    subItems: [
      { id: 'documents', name: 'Strategy Documents', path: '/test/strategy/documents', status: 'pending' },
      { id: 'okrs', name: 'OKR Hierarchy', path: '/test/strategy/okrs', status: 'pending' },
      { id: 'kpis', name: 'KPI Dashboard', path: '/test/strategy/kpis', status: 'pending' },
      { id: 'performance', name: 'Performance Aggregation', path: '/test/strategy/performance', status: 'pending' },
      { id: 'executive', name: 'Executive Dashboard', path: '/test/strategy/executive', status: 'pending' },
    ],
  },
  {
    id: 'finance',
    name: 'Financial Management',
    phase: 'Phase 4',
    icon: <Landmark className="w-5 h-5" />,
    path: '/test/finance',
    subItems: [
      { id: 'coa', name: 'Chart of Accounts', path: '/test/finance/chart-of-accounts', status: 'pending' },
      { id: 'budget', name: 'Budget Management', path: '/test/finance/budget', status: 'pending' },
    ],
  },
];

// Status indicator component
const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
  const getStatusProps = () => {
    switch (status) {
      case 'passed':
        return { icon: <CheckCircle className="w-4 h-4" />, className: 'text-green-500 bg-green-50' };
      case 'failed':
        return { icon: <XCircle className="w-4 h-4" />, className: 'text-red-500 bg-red-50' };
      case 'running':
        return { icon: <Play className="w-4 h-4" />, className: 'text-blue-500 bg-blue-50' };
      default:
        return { icon: <AlertCircle className="w-4 h-4" />, className: 'text-amber-500 bg-amber-50' };
    }
  };

  const { icon, className } = getStatusProps();
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${className}`} title={status}>
      {icon}
    </span>
  );
};

export const TestLayout: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [expandedModules, setExpandedModules] = useState<string[]>(['intelligence', 'hr', 'strategy', 'finance']);
  const navigate = useNavigate();
  const location = useLocation();

  const handleModuleClick = (moduleId: string, path: string, hasSubItems: boolean) => {
    if (hasSubItems) {
      setExpandedModules(prev =>
        prev.includes(moduleId)
          ? prev.filter(id => id !== moduleId)
          : [...prev, moduleId]
      );
    } else {
      navigate(path);
    }
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 h-16 px-4 border-b border-gray-200">
          <Bug className="w-6 h-6 text-[#872E5C]" />
          <span className="text-lg font-semibold text-gray-900">DawinOS Tests</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="lg:hidden ml-auto p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-2 overflow-y-auto h-[calc(100vh-4rem)]">
          {TEST_MODULES.map((module) => (
            <div key={module.id} className="mb-1">
              <button
                onClick={() => handleModuleClick(module.id, module.path, !!module.subItems)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  isActive(module.path)
                    ? 'bg-[#872E5C]/10 text-[#872E5C]'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="text-gray-500">{module.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{module.name}</div>
                  <div className="text-xs text-gray-400">{module.phase}</div>
                </div>
                {module.subItems && (
                  expandedModules.includes(module.id)
                    ? <ChevronDown className="w-4 h-4 text-gray-400" />
                    : <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {/* Sub Items */}
              {module.subItems && expandedModules.includes(module.id) && (
                <div className="ml-4 mt-1 space-y-1">
                  {module.subItems.map((subItem) => (
                    <button
                      key={subItem.id}
                      onClick={() => navigate(subItem.path)}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                        isActive(subItem.path)
                          ? 'bg-[#872E5C]/10 text-[#872E5C]'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="flex-1 text-left truncate">{subItem.name}</span>
                      <StatusIndicator status={subItem.status} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-4">
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">
            DawinOS v2.0 Testing Suite
          </h1>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
              <CheckCircle className="w-3 h-3" /> Passed: 0
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded-full">
              <XCircle className="w-3 h-3" /> Failed: 0
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full">
              <AlertCircle className="w-3 h-3" /> Pending: 17
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default TestLayout;
