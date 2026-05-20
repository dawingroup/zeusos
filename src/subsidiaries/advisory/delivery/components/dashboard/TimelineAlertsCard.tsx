/**
 * Timeline Alerts Card - Projects with timeline warnings
 */

import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface TimelineAlertsCardProps {
  projects: Project[];
}

interface TimelineAlert {
  project: Project;
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

export function TimelineAlertsCard({ projects }: TimelineAlertsCardProps) {
  const alerts: TimelineAlert[] = [];

  projects.forEach(project => {
    if (project.status === 'completed' || project.status === 'cancelled') return;

    const timeline = project.timeline;
    const progress = project.progress;

    // Critical: project is delayed
    if (timeline?.isDelayed) {
      alerts.push({
        project,
        severity: 'critical',
        message: `Delayed by ${timeline.delayDays} days`,
      });
      return; // Only show most severe alert per project
    }

    // Warning: high time elapsed but low progress
    if (
      timeline?.percentTimeElapsed > 80 &&
      progress?.physicalProgress < 60
    ) {
      alerts.push({
        project,
        severity: 'warning',
        message: `${timeline.percentTimeElapsed}% time elapsed, only ${progress.physicalProgress}% complete`,
      });
      return;
    }

    // Info: less than 30 days remaining
    if (timeline?.daysRemaining < 30 && timeline?.daysRemaining > 0) {
      alerts.push({
        project,
        severity: 'info',
        message: `${timeline.daysRemaining} days remaining`,
      });
    }
  });

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const severityColors = {
    critical: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };

  const severityIcons = {
    critical: <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />,
    info: <Clock className="w-4 h-4 text-blue-500 shrink-0" />,
  };

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Timeline Alerts</h2>
        {alerts.length > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            {alerts.length}
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Clock className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">All projects on track</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {alerts.slice(0, 8).map((alert, i) => (
            <Link
              key={`${alert.project.id}-${i}`}
              to={`/advisory/delivery/projects/${alert.project.id}/timeline`}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:opacity-80 ${severityColors[alert.severity]}`}
            >
              {severityIcons[alert.severity]}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{alert.project.name}</div>
                <div className="text-xs opacity-80">{alert.message}</div>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
            </Link>
          ))}
        </div>
      )}
    </BaseCard>
  );
}
