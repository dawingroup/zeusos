/**
 * Critical Path Summary - Shows critical path activities and metrics
 */

import { AlertTriangle, ArrowRight } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { ScheduleActivity, ScheduleSummary } from '../../types/schedule';
import { getActivityStatusColor } from '../../types/schedule';

interface CriticalPathSummaryProps {
  activities: ScheduleActivity[];
  criticalPathIds: string[];
  summary: ScheduleSummary | null;
}

export function CriticalPathSummary({ activities, criticalPathIds, summary }: CriticalPathSummaryProps) {
  const criticalActivities = activities
    .filter(a => criticalPathIds.includes(a.id))
    .sort((a, b) => new Date(a.plannedStartDate).getTime() - new Date(b.plannedStartDate).getTime());

  if (criticalActivities.length === 0) {
    return (
      <BaseCard padding="lg">
        <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-gray-400" />
          Critical Path
        </h3>
        <p className="text-sm text-gray-500 text-center py-4">
          No critical path identified (add dependencies to calculate)
        </p>
      </BaseCard>
    );
  }

  const delayedOnCriticalPath = criticalActivities.filter(
    a => a.status === 'delayed' || a.status === 'blocked'
  ).length;

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          Critical Path
        </h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{criticalActivities.length} activities</span>
          <span>{summary?.criticalPathLength || 0} days total</span>
        </div>
      </div>

      {delayedOnCriticalPath > 0 && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {delayedOnCriticalPath} critical path {delayedOnCriticalPath === 1 ? 'activity is' : 'activities are'} delayed
        </div>
      )}

      {/* Critical path chain */}
      <div className="flex items-center flex-wrap gap-1">
        {criticalActivities.map((activity, i) => {
          return (
            <div key={activity.id} className="flex items-center gap-1">
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getActivityStatusColor(activity.status)}`}>
                {activity.name}
                <span className="ml-1 opacity-70">{activity.durationDays}d</span>
              </span>
              {i < criticalActivities.length - 1 && (
                <ArrowRight className="w-3 h-3 text-gray-300 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </BaseCard>
  );
}
