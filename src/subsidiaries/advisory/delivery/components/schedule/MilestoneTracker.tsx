/**
 * Milestone Tracker - Vertical timeline of project milestones
 */

import { CheckCircle, Clock, AlertTriangle, Circle } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { ScheduleActivity } from '../../types/schedule';
import { isActivityOverdue } from '../../types/schedule';

interface MilestoneTrackerProps {
  milestones: ScheduleActivity[];
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function MilestoneTracker({ milestones }: MilestoneTrackerProps) {
  const sorted = [...milestones].sort(
    (a, b) => new Date(a.plannedEndDate).getTime() - new Date(b.plannedEndDate).getTime()
  );

  if (sorted.length === 0) {
    return (
      <BaseCard padding="lg">
        <div className="text-center py-8 text-gray-500">
          <Circle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No milestones defined</p>
          <p className="text-xs text-gray-400 mt-1">Create milestones in the List view</p>
        </div>
      </BaseCard>
    );
  }

  // Find next upcoming milestone
  const now = new Date();
  const nextIdx = sorted.findIndex(m =>
    m.status !== 'completed' && m.status !== 'cancelled' && new Date(m.plannedEndDate) >= now
  );

  return (
    <div className="space-y-0">
      {sorted.map((milestone, i) => {
        const overdue = isActivityOverdue(milestone);
        const isNext = i === nextIdx;
        const isPast = milestone.status === 'completed' || milestone.status === 'cancelled';

        let icon;
        let lineColor;
        if (milestone.status === 'completed') {
          icon = <CheckCircle className="w-5 h-5 text-green-500" />;
          lineColor = 'bg-green-300';
        } else if (overdue) {
          icon = <AlertTriangle className="w-5 h-5 text-red-500" />;
          lineColor = 'bg-red-300';
        } else if (isNext) {
          icon = <Clock className="w-5 h-5 text-blue-500" />;
          lineColor = 'bg-blue-300';
        } else {
          icon = <Circle className="w-5 h-5 text-gray-300" />;
          lineColor = 'bg-gray-200';
        }

        return (
          <div key={milestone.id} className="flex gap-4">
            {/* Timeline line + icon */}
            <div className="flex flex-col items-center">
              <div className={`shrink-0 ${isNext ? 'ring-2 ring-blue-200 rounded-full' : ''}`}>
                {icon}
              </div>
              {i < sorted.length - 1 && (
                <div className={`w-0.5 flex-1 min-h-[32px] ${lineColor}`} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-6 flex-1 ${isPast ? 'opacity-60' : ''}`}>
              <div className={`text-sm font-medium ${
                isNext ? 'text-blue-700' :
                overdue ? 'text-red-700' :
                isPast ? 'text-gray-500' :
                'text-gray-900'
              }`}>
                {milestone.name}
              </div>

              <div className="flex items-center gap-3 mt-0.5">
                <span className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                  {formatDate(milestone.plannedEndDate)}
                </span>

                {milestone.status === 'completed' && milestone.actualEndDate && (
                  <span className="text-xs text-green-600">
                    Completed {formatDate(milestone.actualEndDate)}
                  </span>
                )}

                {overdue && (
                  <span className="text-xs text-red-500 font-medium">Overdue</span>
                )}

                {isNext && !overdue && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    Next
                  </span>
                )}
              </div>

              {milestone.responsibleParty && (
                <div className="text-xs text-gray-400 mt-0.5">
                  Assigned to: {milestone.responsibleParty}
                </div>
              )}

              {milestone.description && (
                <div className="text-xs text-gray-500 mt-1">{milestone.description}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
