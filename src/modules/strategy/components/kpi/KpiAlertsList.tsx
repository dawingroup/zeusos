import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Bell, Check, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { useAuth } from '@/shared/hooks/useAuth';
import { kpiDataService } from '../../services/kpiData.service';
import type { KPIAlert } from '../../types/kpi.types';
import {
  KPI_ALERT_SEVERITY,
  type KPIAlertSeverity,
} from '../../constants/kpi.constants';

interface KpiAlertsListProps {
  companyId: string;
  kpiId: string;
  // Re-fetch trigger — bumped when a new measurement is logged so any
  // newly-triggered alerts surface without a manual refresh.
  refreshKey?: number;
}

const SEVERITY_STYLE: Record<KPIAlertSeverity, { icon: React.ComponentType<{ className?: string }>; chip: string }> = {
  [KPI_ALERT_SEVERITY.INFO]: { icon: Info, chip: 'bg-blue-50 text-blue-700 border-blue-200' },
  [KPI_ALERT_SEVERITY.WARNING]: { icon: AlertTriangle, chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  [KPI_ALERT_SEVERITY.CRITICAL]: { icon: AlertCircle, chip: 'bg-red-50 text-red-700 border-red-200' },
};

export const KpiAlertsList: React.FC<KpiAlertsListProps> = ({ companyId, kpiId, refreshKey }) => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<KPIAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await kpiDataService.getAlertsByKPI(companyId, kpiId);
      setAlerts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, kpiId, refreshKey]);

  const handleAcknowledge = async (alert: KPIAlert) => {
    if (!user?.uid) return;
    setBusyId(alert.id);
    try {
      await kpiDataService.acknowledgeAlert(companyId, alert.id, user.uid);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleResolve = async (alert: KPIAlert) => {
    if (!user?.uid) return;
    setBusyId(alert.id);
    try {
      await kpiDataService.resolveAlert(companyId, alert.id, user.uid);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const unresolved = alerts.filter((a) => !a.resolvedAt);
  const resolved = alerts.filter((a) => a.resolvedAt);
  const visible = showResolved ? alerts : unresolved;

  if (loading) {
    return (
      <div className="flex items-center text-gray-400 text-[12px]">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading alerts…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[12px] text-gray-500">
          <span className="text-gray-900 font-medium">{unresolved.length}</span> open
          {resolved.length > 0 && (
            <>
              {' · '}
              <button
                type="button"
                onClick={() => setShowResolved((v) => !v)}
                className="text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
              >
                {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
              </button>
            </>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-[12.5px] rounded-md border border-dashed border-gray-200">
          {unresolved.length === 0 && resolved.length === 0
            ? 'No alerts — define thresholds with alerts enabled to start tracking breaches.'
            : 'No open alerts. Everything is within thresholds.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity] || SEVERITY_STYLE[KPI_ALERT_SEVERITY.INFO];
            const Icon = style.icon;
            const isResolved = !!alert.resolvedAt;
            const isAcknowledged = !!alert.acknowledgedAt;
            return (
              <li
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-md border ${
                  isResolved
                    ? 'bg-gray-50 border-gray-200 opacity-70'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[12.5px] font-medium text-gray-900">
                      {alert.title}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border ${style.chip}`}
                    >
                      {alert.severity}
                    </span>
                    {isResolved && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-600">{alert.message}</p>
                  <p className="text-[10.5px] text-gray-400 mt-1">
                    Triggered {alert.triggeredAt.toDate().toLocaleString()}
                    {alert.currentValue !== undefined && (
                      <>
                        {' · '}
                        Value {alert.currentValue}
                        {alert.thresholdValue !== undefined &&
                          ` vs threshold ${alert.thresholdValue}`}
                      </>
                    )}
                    {isAcknowledged && !isResolved && (
                      <>
                        {' · '}
                        Acknowledged {alert.acknowledgedAt!.toDate().toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
                {!isResolved && (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!isAcknowledged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAcknowledge(alert)}
                        disabled={busyId === alert.id}
                      >
                        {busyId === alert.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Bell className="h-3 w-3" />
                        )}
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleResolve(alert)}
                      disabled={busyId === alert.id}
                    >
                      {busyId === alert.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Resolve
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
