/**
 * Alerts Widget
 * 
 * Shows alerts and notifications on the dashboard.
 */

import React from 'react';
import { AlertTriangle, Bell, CheckCircle, XCircle } from 'lucide-react';

type AlertSeverity = 'info' | 'warning' | 'critical';

interface Alert {
  id: string;
  message: string;
  severity: AlertSeverity;
  timestamp: Date;
  module: string;
  entityId?: string;
}

export function AlertsWidget() {
  // Mock alerts data - would come from hooks in production
  const alerts: Alert[] = [
    {
      id: '1',
      message: 'Capital call deadline in 3 days for Growth Fund I',
      severity: 'warning',
      timestamp: new Date(),
      module: 'advisory',
    },
    {
      id: '2',
      message: 'Valuation update required for 5 holdings',
      severity: 'info',
      timestamp: new Date(Date.now() - 3600000),
      module: 'advisory',
    },
    {
      id: '3',
      message: 'Project milestone payment pending approval',
      severity: 'critical',
      timestamp: new Date(Date.now() - 7200000),
      module: 'delivery',
    },
  ];
  
  const severityConfig: Record<AlertSeverity, { bg: string; icon: React.ReactNode; border: string }> = {
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: <Bell className="h-4 w-4 text-blue-500" />,
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    },
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: <XCircle className="h-4 w-4 text-red-500" />,
    },
  };
  
  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Alerts</h3>
        </div>
        {alerts.length > 0 && (
          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>
      
      <div className="p-4 space-y-3">
        {alerts.map((alert) => {
          const config = severityConfig[alert.severity];
          
          return (
            <div
              key={alert.id}
              className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{config.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {formatTimeAgo(alert.timestamp)}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500 capitalize">
                      {alert.module}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        
        {alerts.length === 0 && (
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-gray-500">No active alerts</p>
          </div>
        )}
      </div>
      
      {alerts.length > 0 && (
        <div className="p-4 border-t">
          <button className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium">
            View All Alerts →
          </button>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default AlertsWidget;
