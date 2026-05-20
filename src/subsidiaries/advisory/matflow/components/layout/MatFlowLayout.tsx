/**
 * MatFlow Layout Component
 * Tab-based navigation - refactored from nested sidebar
 */

import React, { useState } from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  Receipt,
  Bell,
  WifiOff,
  RefreshCw,
  FolderOpen,
  Settings,
  Calculator,
  Package,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { ModuleTabNav, type TabNavItem } from '@/core/components/navigation/ModuleTabNav';
import { ModuleContentWrapper } from '@/shared/components/layout/ModuleContentWrapper';
import { Button } from '@/core/components/ui/button';

export const MatFlowLayout: React.FC = () => {
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [syncStatus, _setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const pendingChanges = 0;
  const pendingApprovals: Array<{ id: string; number: string; description: string; status: string }> = [];

  // Tab navigation items
  const matflowTabs: TabNavItem[] = [
    { id: 'dashboard', path: '/advisory/matflow', label: 'Overview', icon: LayoutDashboard, exact: true },
    { id: 'projects', path: '/advisory/matflow/projects', label: 'Projects', icon: FolderOpen },
    { id: 'boq', path: '/advisory/matflow/boq', label: 'BOQ', icon: FileText },
    { id: 'formulas', path: '/advisory/matflow/formulas', label: 'Formulas', icon: Calculator },
    { id: 'materials', path: '/advisory/matflow/materials', label: 'Materials', icon: Package },
    { id: 'procurement', path: '/advisory/matflow/procurement', label: 'Procurement', icon: ShoppingCart, badge: pendingApprovals.length || undefined },
    { id: 'reports', path: '/advisory/matflow/reports', label: 'Reports', icon: Receipt },
    { id: 'settings', path: '/advisory/matflow/settings', label: 'Settings', icon: Settings },
  ];

  const syncNow = async () => {
    console.log('Syncing...');
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {/* Tab Navigation Header */}
      <ModuleTabNav
        title="MatFlow"
        subtitle="Material Flow & Project Management"
        tabs={matflowTabs}
        backPath="/advisory"
        backLabel="Advisory"
        accentColor="amber"
      />

      {/* Status Bar */}
      <div className="bg-background border-b px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Offline Status */}
          {!isOnline && (
            <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full text-sm">
              <WifiOff className="w-4 h-4" />
              <span>Offline Mode • {pendingChanges} pending</span>
            </div>
          )}

          {/* Sync Progress */}
          {syncStatus === 'syncing' && (
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Syncing...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Sync Button */}
          {pendingChanges > 0 && isOnline && (
            <Button
              variant="outline"
              size="sm"
              onClick={syncNow}
              disabled={syncStatus === 'syncing'}
              className="gap-2"
            >
              <RefreshCw className={cn('w-4 h-4', syncStatus === 'syncing' && 'animate-spin')} />
              Sync ({pendingChanges})
            </Button>
          )}

          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationOpen(!notificationOpen)}
              className="relative"
            >
              <Bell className="w-5 h-5" />
              {pendingApprovals.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {pendingApprovals.length}
                </span>
              )}
            </Button>

            {/* Notification Dropdown */}
            {notificationOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setNotificationOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-3 border-b border-gray-200">
                    <h3 className="font-semibold">Pending Approvals</h3>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {pendingApprovals.length > 0 ? (
                      pendingApprovals.slice(0, 5).map((req) => (
                        <button
                          key={req.id}
                          onClick={() => {
                            navigate(`/advisory/matflow/requisitions/${req.id}`);
                            setNotificationOpen(false);
                          }}
                          className="w-full p-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{req.number}</p>
                              <p className="text-xs text-gray-500 truncate">{req.description}</p>
                            </div>
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded">
                              {req.status}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="p-4 text-sm text-gray-500 text-center">
                        No pending approvals
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Page Content */}
      <ModuleContentWrapper>
        <Outlet />
      </ModuleContentWrapper>
    </div>
  );
};

export default MatFlowLayout;
