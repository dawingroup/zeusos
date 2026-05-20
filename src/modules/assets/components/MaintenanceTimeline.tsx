/**
 * Maintenance Timeline
 * Visual vertical timeline of maintenance history for an asset.
 */

import { Wrench, Eye, Settings, Gauge } from 'lucide-react';
import type { MaintenanceLog, MaintenanceType } from '../types';

const TYPE_CONFIG: Record<
  MaintenanceType,
  { icon: React.ElementType; label: string; color: string; bgColor: string }
> = {
  SCHEDULED: {
    icon: Wrench,
    label: 'Scheduled',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  REPAIR: {
    icon: Settings,
    label: 'Repair',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  INSPECTION: {
    icon: Eye,
    label: 'Inspection',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  CALIBRATION: {
    icon: Gauge,
    label: 'Calibration',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
};

function formatDate(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (value instanceof Date) return value.toLocaleDateString();
  if (typeof value === 'string') return new Date(value).toLocaleDateString();
  return 'Unknown';
}

interface MaintenanceTimelineProps {
  logs: MaintenanceLog[];
}

export function MaintenanceTimeline({ logs }: MaintenanceTimelineProps) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Wrench className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No maintenance records yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {logs.map((log) => {
          const config = TYPE_CONFIG[log.type] || TYPE_CONFIG.SCHEDULED;
          const Icon = config.icon;

          return (
            <div key={log.id} className="relative flex gap-4 pl-1">
              {/* Icon circle */}
              <div
                className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-full ${config.bgColor} shrink-0`}
              >
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>

              {/* Content card */}
              <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 -mt-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}
                    >
                      {config.label}
                    </span>
                    {log.cost != null && log.cost > 0 && (
                      <span className="text-xs text-gray-500 font-medium">
                        {log.cost.toLocaleString()} UGX
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDate(log.performedAt)}
                  </span>
                </div>

                <p className="text-sm text-gray-800 mb-1">{log.description}</p>

                {log.tasksCompleted.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-gray-500 mb-1">
                      Tasks completed:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {log.tasksCompleted.map((task, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-0.5 bg-gray-50 text-gray-600 text-xs rounded"
                        >
                          {task}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {log.hoursAtService > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    {log.hoursAtService} hours at service
                  </div>
                )}

                {log.notes && (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    {log.notes}
                  </div>
                )}

                <div className="mt-2 text-xs text-gray-400">
                  Performed by: {log.performedBy}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
