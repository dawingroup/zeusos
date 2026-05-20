/**
 * Alerts List Component
 * Displays variance alerts with severity badges
 */

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  XCircle,
  Clock,
  Users,
  AlertTriangle,
} from 'lucide-react';
import type { VarianceAlert, VarianceAlertType } from '../../types/variance';

interface AlertsListProps {
  alerts: VarianceAlert[];
  maxItems?: number;
}

const alertConfig: Record<VarianceAlertType, {
  icon: React.ElementType;
  color: string;
}> = {
  'quantity-overrun': { icon: TrendingUp, color: 'text-red-600' },
  'quantity-shortage': { icon: TrendingDown, color: 'text-amber-600' },
  'cost-overrun': { icon: DollarSign, color: 'text-red-600' },
  'unit-price-spike': { icon: TrendingUp, color: 'text-amber-600' },
  'high-rejection-rate': { icon: XCircle, color: 'text-red-600' },
  'delivery-delay': { icon: Clock, color: 'text-amber-600' },
  'supplier-concentration': { icon: Users, color: 'text-blue-600' },
};

const formatTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

const SeverityBadge: React.FC<{ severity: 'info' | 'warning' | 'critical' }> = ({ severity }) => {
  const styles = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    info: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[severity]}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
};

export const AlertsList: React.FC<AlertsListProps> = ({ alerts, maxItems = 10 }) => {
  const displayAlerts = alerts.slice(0, maxItems);

  if (displayAlerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <AlertTriangle className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No active alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {displayAlerts.map(alert => {
        const config = alertConfig[alert.type];
        const Icon = config.icon;

        return (
          <div
            key={alert.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
          >
            <div className={`mt-0.5 ${config.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-gray-900">{alert.message}</p>
                <SeverityBadge severity={alert.severity} />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Threshold: {alert.threshold}% • Actual: {alert.actualValue.toFixed(1)}%
              </p>
            </div>
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {formatTimeAgo(alert.createdAt)}
            </div>
          </div>
        );
      })}

      {alerts.length > maxItems && (
        <p className="text-xs text-gray-500 text-center pt-2">
          +{alerts.length - maxItems} more alerts
        </p>
      )}
    </div>
  );
};

export default AlertsList;
