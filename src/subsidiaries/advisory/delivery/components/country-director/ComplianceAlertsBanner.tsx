/**
 * ComplianceAlertsBanner - Critical alerts requiring attention
 */

import { useState } from 'react';
import {
  AlertTriangle,
  XCircle,
  Clock,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import {
  ComplianceAlert,
  getAlertTypeLabel,
  getAlertSeverityStyles,
} from '../../types/country-director-dashboard';

interface ComplianceAlertsBannerProps {
  alerts: ComplianceAlert[];
  onAlertClick?: (alert: ComplianceAlert) => void;
  maxVisible?: number;
}

function getAlertIcon(type: ComplianceAlert['type']) {
  switch (type) {
    case 'severe_variance':
      return XCircle;
    case 'overdue_accountability':
    case 'overdue_reconciliation':
    case 'overdue_investigation':
      return Clock;
    case 'variance_investigation':
      return Search;
    default:
      return AlertTriangle;
  }
}

export function ComplianceAlertsBanner({
  alerts,
  onAlertClick,
  maxVisible = 3,
}: ComplianceAlertsBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (alerts.length === 0) {
    return null;
  }

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  const displayAlerts = expanded ? alerts : alerts.slice(0, maxVisible);
  const hasMore = alerts.length > maxVisible;

  // Determine banner color based on most severe alert
  const bannerColor =
    criticalAlerts.length > 0
      ? 'bg-red-50 border-red-200'
      : 'bg-yellow-50 border-yellow-200';

  return (
    <div className={`rounded-lg border p-4 ${bannerColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`w-5 h-5 ${
              criticalAlerts.length > 0 ? 'text-red-600' : 'text-yellow-600'
            }`}
          />
          <span className="font-medium text-gray-900">
            {alerts.length} Compliance Alert{alerts.length !== 1 ? 's' : ''} Requiring Attention
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {criticalAlerts.length > 0 && (
            <span className="text-red-600 font-medium">
              {criticalAlerts.length} Critical
            </span>
          )}
          {warningAlerts.length > 0 && (
            <span className="text-yellow-600 font-medium">
              {warningAlerts.length} Warning
            </span>
          )}
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        {displayAlerts.map((alert) => {
          const Icon = getAlertIcon(alert.type);
          const styles = getAlertSeverityStyles(alert.severity);

          return (
            <button
              key={alert.id}
              onClick={() => onAlertClick?.(alert)}
              className={`w-full flex items-start gap-3 p-3 rounded-md ${styles.bg} ${styles.border} border text-left hover:opacity-90 transition-opacity`}
            >
              <Icon className={`w-5 h-5 ${styles.text} flex-shrink-0 mt-0.5`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${styles.text}`}>
                    {getAlertTypeLabel(alert.type)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {alert.projectName}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{alert.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Action: {alert.actionRequired}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Expand/Collapse */}
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {alerts.length - maxVisible} more alerts
            </>
          )}
        </button>
      )}
    </div>
  );
}

interface AlertsSummaryProps {
  criticalCount: number;
  warningCount: number;
  onClick?: () => void;
}

export function AlertsSummary({ criticalCount, warningCount, onClick }: AlertsSummaryProps) {
  const total = criticalCount + warningCount;

  if (total === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">
        <span className="w-2 h-2 rounded-full bg-green-500" />
        No compliance alerts
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 hover:opacity-90 transition-opacity ${
        criticalCount > 0 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
      }`}
    >
      <AlertTriangle className="w-4 h-4" />
      <span>
        {total} alert{total !== 1 ? 's' : ''}
        {criticalCount > 0 && (
          <span className="ml-1 font-medium">({criticalCount} critical)</span>
        )}
      </span>
    </button>
  );
}
