/**
 * Variance Alerts Banner - Collapsible banner for over-budget warnings
 * Pattern adapted from BudgetWarningBanner.tsx
 */

import { useState } from 'react';
import { AlertTriangle, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import type { VarianceAlert } from '../../hooks/useProjectBudgetData';

interface VarianceAlertsBannerProps {
  alerts: VarianceAlert[];
  currency: string;
}

export function VarianceAlertsBanner({ alerts }: VarianceAlertsBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (alerts.length === 0 || dismissed) return null;

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const hasCritical = criticalCount > 0;

  const bgColor = hasCritical ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200';
  const textColor = hasCritical ? 'text-red-800' : 'text-amber-800';
  const iconColor = hasCritical ? 'text-red-500' : 'text-amber-500';

  const visibleAlerts = expanded ? alerts : alerts.slice(0, 2);

  return (
    <div className={`rounded-lg border p-4 ${bgColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
          <div>
            <div className={`text-sm font-medium ${textColor}`}>
              {criticalCount > 0 && `${criticalCount} critical`}
              {criticalCount > 0 && warningCount > 0 && ', '}
              {warningCount > 0 && `${warningCount} warning`}
              {' '}budget alert{alerts.length !== 1 ? 's' : ''}
            </div>

            <div className="mt-2 space-y-2">
              {visibleAlerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm"
                >
                  {alert.severity === 'critical' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className={`font-medium ${alert.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
                      {alert.description}
                    </span>
                    <span className={alert.severity === 'critical' ? 'text-red-600' : 'text-amber-600'}>
                      {' — '}{alert.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {alerts.length > 2 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`mt-2 text-xs font-medium flex items-center gap-1 ${hasCritical ? 'text-red-600 hover:text-red-800' : 'text-amber-600 hover:text-amber-800'}`}
              >
                {expanded ? (
                  <>Show less <ChevronUp className="w-3 h-3" /></>
                ) : (
                  <>Show {alerts.length - 2} more <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
            )}
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className={`p-1 rounded hover:bg-black/5 ${iconColor}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
