/**
 * Stage Progress Bar Component
 * Visual representation of stage progress with status indicators
 */

import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertTriangle,
  Pause,
  Loader2,
  Package,
  Hammer,
  ClipboardCheck,
} from 'lucide-react';
import type { StageProgress, StageStatus, StageHealth } from '../../types/stageProgress';

interface StageProgressBarProps {
  stage: StageProgress;
  showDetails?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

const statusConfig: Record<
  StageStatus,
  { label: string; icon: React.ElementType; color: string }
> = {
  not_started: { label: 'Not Started', icon: Circle, color: 'text-gray-400' },
  materials_pending: { label: 'Materials Pending', icon: Package, color: 'text-yellow-500' },
  in_progress: { label: 'In Progress', icon: Loader2, color: 'text-blue-500' },
  on_hold: { label: 'On Hold', icon: Pause, color: 'text-orange-500' },
  materials_complete: { label: 'Materials Complete', icon: Package, color: 'text-green-500' },
  work_complete: { label: 'Work Complete', icon: Hammer, color: 'text-purple-500' },
  verified: { label: 'Verified', icon: ClipboardCheck, color: 'text-emerald-500' },
  signed_off: { label: 'Signed Off', icon: CheckCircle2, color: 'text-green-600' },
};

const healthConfig: Record<StageHealth, { color: string; bgColor: string }> = {
  healthy: { color: 'text-green-600', bgColor: 'bg-green-100' },
  at_risk: { color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  critical: { color: 'text-red-600', bgColor: 'bg-red-100' },
  blocked: { color: 'text-gray-600', bgColor: 'bg-gray-200' },
};

export const StageProgressBar: React.FC<StageProgressBarProps> = ({
  stage,
  showDetails = false,
  compact = false,
  onClick,
}) => {
  const status = statusConfig[stage.status];
  const health = healthConfig[stage.health];
  const StatusIcon = status.icon;

  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-gray-50 transition-colors ${health.bgColor}`}
        onClick={onClick}
      >
        <StatusIcon className={`h-4 w-4 ${status.color}`} />
        <span className="text-sm font-medium truncate flex-1">
          {stage.stageName}
        </span>
        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${stage.overallProgress}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">
          {Math.round(stage.overallProgress)}%
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 cursor-pointer hover:shadow-md transition-shadow ${onClick ? 'hover:border-amber-500' : ''}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusIcon
            className={`h-5 w-5 ${status.color} ${stage.status === 'in_progress' ? 'animate-spin' : ''}`}
          />
          <h4 className="font-semibold">{stage.stageName}</h4>
        </div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${health.color} ${health.bgColor}`}>
          {status.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Overall Progress</span>
          <span className="font-medium">{Math.round(stage.overallProgress)}%</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-500 transition-all"
            style={{ width: `${stage.overallProgress}%` }}
          />
        </div>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          {/* Material Progress */}
          <div>
            <div className="flex items-center gap-1 text-gray-500 mb-1">
              <Package className="h-3 w-3" />
              <span>Materials</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500"
                  style={{ width: `${stage.materialProgress.percent}%` }}
                />
              </div>
              <span className="text-xs font-medium">
                {Math.round(stage.materialProgress.percent)}%
              </span>
            </div>
          </div>

          {/* Work Progress */}
          <div>
            <div className="flex items-center gap-1 text-gray-500 mb-1">
              <Hammer className="h-3 w-3" />
              <span>Work</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500"
                  style={{ width: `${stage.workProgress.percent}%` }}
                />
              </div>
              <span className="text-xs font-medium">
                {Math.round(stage.workProgress.percent)}%
              </span>
            </div>
          </div>

          {/* BOQ Items */}
          <div>
            <span className="text-gray-500">BOQ Items</span>
            <p className="font-medium">
              {stage.completedBOQItems} / {stage.totalBOQItems}
            </p>
          </div>

          {/* Milestones */}
          <div>
            <span className="text-gray-500">Milestones</span>
            <p className="font-medium">
              {stage.completedMilestones} / {stage.totalMilestones}
            </p>
          </div>

          {/* Cost Variance */}
          <div className="col-span-2">
            <span className="text-gray-500">Cost Variance</span>
            <p className={`font-medium ${
              stage.costVariancePercent < 0 ? 'text-green-600' :
              stage.costVariancePercent > 5 ? 'text-red-600' : 'text-gray-700'
            }`}>
              {stage.costVariancePercent > 0 ? '+' : ''}
              {stage.costVariancePercent.toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Blockers Warning */}
      {stage.activeBlockers.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-2 rounded">
          <AlertTriangle className="h-4 w-4" />
          <span>
            {stage.activeBlockers.length} active blocker
            {stage.activeBlockers.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Next Milestone */}
      {stage.nextMilestone && (
        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <Clock className="h-4 w-4" />
          <span>
            Next: <strong>{stage.nextMilestone.name}</strong>
            {stage.nextMilestone.daysUntilDue <= 0 ? (
              <span className="text-red-500 ml-1">(Overdue)</span>
            ) : (
              <span className="ml-1">
                (in {stage.nextMilestone.daysUntilDue} days)
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default StageProgressBar;
