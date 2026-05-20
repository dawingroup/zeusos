/**
 * Stages Progress Card - Project stages with progress bars
 */

import { Layers, CheckCircle, Clock, Circle } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface StagesProgressCardProps {
  project: Project;
}

export function StagesProgressCard({ project }: StagesProgressCardProps) {
  const stages = project.stages || [];

  if (stages.length === 0) {
    return (
      <BaseCard padding="lg">
        <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-400" />
          Construction Stages
        </h3>
        <div className="text-center py-4 text-gray-500">
          <Layers className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No stages defined</p>
        </div>
      </BaseCard>
    );
  }

  const completedStages = stages.filter(s => s.status === 'completed').length;
  const overallProgress = stages.length > 0
    ? Math.round(stages.reduce((sum, s) => sum + s.completionPercent, 0) / stages.length)
    : 0;

  const statusIcons = {
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    in_progress: <Clock className="w-4 h-4 text-blue-500" />,
    not_started: <Circle className="w-4 h-4 text-gray-300" />,
  };

  const statusColors = {
    completed: 'bg-green-500',
    in_progress: 'bg-blue-500',
    not_started: 'bg-gray-300',
  };

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-gray-400" />
          Construction Stages
        </h3>
        <span className="text-sm text-gray-500">
          {completedStages}/{stages.length} completed &middot; {overallProgress}% overall
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="mb-4">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Stage list */}
      <div className="space-y-3">
        {stages
          .sort((a, b) => a.order - b.order)
          .map(stage => (
            <div key={stage.id} className="flex items-center gap-3">
              <div className="shrink-0">{statusIcons[stage.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${
                    stage.status === 'completed' ? 'text-gray-500 line-through' :
                    stage.status === 'in_progress' ? 'text-gray-900' :
                    'text-gray-400'
                  }`}>
                    {stage.name}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">{stage.completionPercent}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                  <div
                    className={`h-full rounded-full transition-all ${statusColors[stage.status]}`}
                    style={{ width: `${stage.completionPercent}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
      </div>
    </BaseCard>
  );
}
