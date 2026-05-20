/**
 * Schedule Activity List - Table view with inline editing
 */

import { useState } from 'react';
import { Edit, Trash2, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import type { ScheduleActivity, ScheduleActivityStatus } from '../../types/schedule';
import { SCHEDULE_STATUS_CONFIG, ACTIVITY_TYPE_CONFIG, getActivityStatusColor } from '../../types/schedule';

interface ScheduleActivityListProps {
  activities: ScheduleActivity[];
  criticalPathIds: string[];
  onEdit: (activity: ScheduleActivity) => void;
  onDelete: (activityId: string) => void;
  onUpdateProgress: (activityId: string, percentComplete: number) => void;
  onUpdateStatus: (activityId: string, status: ScheduleActivityStatus) => void;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

export function ScheduleActivityList({
  activities,
  criticalPathIds,
  onEdit,
  onDelete,
  onUpdateProgress,
  onUpdateStatus,
}: ScheduleActivityListProps) {
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [editingProgress, setEditingProgress] = useState<string | null>(null);

  const topLevelItems = activities.filter(a => !a.parentId);
  const childrenMap = new Map<string, ScheduleActivity[]>();

  activities.forEach(a => {
    if (a.parentId) {
      const children = childrenMap.get(a.parentId) || [];
      children.push(a);
      childrenMap.set(a.parentId, children);
    }
  });

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  const renderRow = (activity: ScheduleActivity, depth = 0): JSX.Element => {
    const isCritical = criticalPathIds.includes(activity.id);
    const isPhase = activity.activityType === 'phase';
    const children = childrenMap.get(activity.id) || [];
    const isExpanded = expandedPhases.has(activity.id);
    const statusConfig = SCHEDULE_STATUS_CONFIG[activity.status];
    const typeConfig = ACTIVITY_TYPE_CONFIG[activity.activityType];

    return (
      <>
        <tr
          key={activity.id}
          className={`border-b border-gray-50 hover:bg-gray-50 ${isCritical ? 'bg-red-50/30' : ''}`}
        >
          {/* Name */}
          <td className="py-2.5 px-3">
            <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
              {isPhase && children.length > 0 && (
                <button
                  onClick={() => togglePhase(activity.id)}
                  className="p-0.5 hover:bg-gray-200 rounded"
                >
                  {isExpanded
                    ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                  }
                </button>
              )}
              <span className={`text-xs ${typeConfig.color} mr-1`}>
                {activity.activityType === 'milestone' ? '◆' : isPhase ? '▸' : ''}
              </span>
              {activity.wbsCode && (
                <span className="text-xs text-gray-400 font-mono mr-1">{activity.wbsCode}</span>
              )}
              <span className={`text-sm ${isCritical ? 'font-semibold text-red-700' : isPhase ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                {activity.name}
              </span>
            </div>
          </td>

          {/* Type */}
          <td className="py-2.5 px-3">
            <span className={`text-xs ${typeConfig.color}`}>{typeConfig.label}</span>
          </td>

          {/* Start */}
          <td className="py-2.5 px-3 text-xs text-gray-600">{formatDate(activity.plannedStartDate)}</td>

          {/* End */}
          <td className="py-2.5 px-3 text-xs text-gray-600">{formatDate(activity.plannedEndDate)}</td>

          {/* Duration */}
          <td className="py-2.5 px-3 text-xs text-gray-600 text-center">{activity.durationDays}d</td>

          {/* Progress */}
          <td className="py-2.5 px-3">
            {editingProgress === activity.id ? (
              <input
                type="number"
                min={0}
                max={100}
                defaultValue={activity.percentComplete}
                className="w-16 px-1 py-0.5 text-xs border rounded"
                autoFocus
                onBlur={(e) => {
                  const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                  onUpdateProgress(activity.id, val);
                  setEditingProgress(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = Math.min(100, Math.max(0, parseInt((e.target as HTMLInputElement).value) || 0));
                    onUpdateProgress(activity.id, val);
                    setEditingProgress(null);
                  }
                  if (e.key === 'Escape') setEditingProgress(null);
                }}
              />
            ) : (
              <button
                onClick={() => setEditingProgress(activity.id)}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900"
              >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full">
                  <div
                    className={`h-full rounded-full ${
                      activity.percentComplete >= 100 ? 'bg-green-500' :
                      activity.percentComplete > 0 ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                    style={{ width: `${activity.percentComplete}%` }}
                  />
                </div>
                {activity.percentComplete}%
              </button>
            )}
          </td>

          {/* Status */}
          <td className="py-2.5 px-3">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${getActivityStatusColor(activity.status)}`}>
              {statusConfig.label}
            </span>
          </td>

          {/* Responsible */}
          <td className="py-2.5 px-3 text-xs text-gray-600 truncate max-w-[100px]">
            {activity.responsibleParty || '-'}
          </td>

          {/* Actions */}
          <td className="py-2.5 px-3">
            <div className="flex items-center gap-1">
              {activity.status !== 'completed' && (
                <button
                  onClick={() => onUpdateStatus(activity.id, 'completed')}
                  className="p-1 hover:bg-green-50 rounded"
                  title="Mark complete"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-gray-400 hover:text-green-500" />
                </button>
              )}
              <button
                onClick={() => onEdit(activity)}
                className="p-1 hover:bg-gray-100 rounded"
                title="Edit"
              >
                <Edit className="w-3.5 h-3.5 text-gray-400" />
              </button>
              <button
                onClick={() => onDelete(activity.id)}
                className="p-1 hover:bg-red-50 rounded"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
              </button>
            </div>
          </td>
        </tr>

        {/* Render children if phase is expanded */}
        {isPhase && isExpanded && children
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(child => renderRow(child, depth + 1))
        }
      </>
    );
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No schedule activities defined yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Activity</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Type</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Start</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">End</th>
            <th className="py-2 px-3 text-center text-xs font-medium text-gray-500">Duration</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Progress</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Status</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500">Responsible</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 w-24">Actions</th>
          </tr>
        </thead>
        <tbody>
          {topLevelItems
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(activity => renderRow(activity))}
        </tbody>
      </table>
    </div>
  );
}
