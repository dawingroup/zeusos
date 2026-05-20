/**
 * Timeline Visualization - SVG horizontal timeline with milestones and delay overlay
 */

import { Calendar, AlertTriangle, Clock } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';
import { toJsDate, fmtDate } from '../../utils/dates';

interface TimelineVisualizationProps {
  project: Project;
}

/** @deprecated Use fmtDate from utils/dates instead */
const formatDate = fmtDate;

export function TimelineVisualization({ project }: TimelineVisualizationProps) {
  const timeline = project.timeline;
  if (!timeline) {
    return (
      <BaseCard padding="lg">
        <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          Timeline
        </h3>
        <p className="text-sm text-gray-500">Timeline data not available</p>
      </BaseCard>
    );
  }

  const plannedStart = toJsDate(timeline.plannedStartDate as never) ?? new Date();
  const plannedEnd = toJsDate(timeline.plannedEndDate as never) ?? new Date();
  const currentEnd = toJsDate(timeline.currentEndDate as never) ?? new Date();
  const now = new Date();

  const totalDuration = plannedEnd.getTime() - plannedStart.getTime();
  const elapsed = Math.min(now.getTime() - plannedStart.getTime(), totalDuration);
  const elapsedPct = totalDuration > 0 ? Math.max(0, Math.min(100, (elapsed / totalDuration) * 100)) : 0;
  const progressPct = project.progress?.physicalProgress || 0;

  // Determine if end date extended
  const isExtended = currentEnd.getTime() > plannedEnd.getTime();
  const extendedPct = isExtended && totalDuration > 0
    ? ((currentEnd.getTime() - plannedStart.getTime()) / totalDuration) * 100
    : 100;

  // Stage milestones
  const stages = project.stages || [];

  return (
    <BaseCard padding="lg">
      <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-400" />
        Timeline
      </h3>

      {/* SVG Timeline Bar */}
      <div className="mb-4">
        <div className="relative">
          {/* Background (planned) */}
          <div className="h-8 bg-gray-100 rounded-lg relative overflow-visible">
            {/* Extended period if any */}
            {isExtended && (
              <div
                className="absolute inset-y-0 bg-amber-50 border border-amber-200 rounded-r-lg"
                style={{ left: '100%', width: `${extendedPct - 100}%` }}
              />
            )}

            {/* Time elapsed */}
            <div
              className="absolute inset-y-0 left-0 bg-blue-100 rounded-l-lg"
              style={{ width: `${Math.min(elapsedPct, 100)}%` }}
            />

            {/* Progress overlay */}
            <div
              className={`absolute top-1 bottom-1 left-1 rounded ${
                progressPct >= elapsedPct ? 'bg-green-500' :
                progressPct >= elapsedPct * 0.8 ? 'bg-blue-500' :
                progressPct >= elapsedPct * 0.5 ? 'bg-amber-500' :
                'bg-red-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(progressPct, 100)) - 1}%` }}
            />

            {/* Current date marker */}
            {elapsedPct > 0 && elapsedPct < 100 && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gray-800 z-10"
                style={{ left: `${elapsedPct}%` }}
              >
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-gray-600 whitespace-nowrap">
                  Today
                </div>
              </div>
            )}

            {/* Stage milestones as dots */}
            {stages.map((stage, i) => {
              const position = stages.length > 1
                ? ((i + 1) / stages.length) * 95 + 2
                : 50;
              return (
                <div
                  key={stage.id}
                  className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white z-10 ${
                    stage.status === 'completed' ? 'bg-green-500' :
                    stage.status === 'in_progress' ? 'bg-blue-500' :
                    'bg-gray-300'
                  }`}
                  style={{ left: `${position}%` }}
                  title={`${stage.name}: ${stage.completionPercent}%`}
                />
              );
            })}
          </div>

          {/* Date labels */}
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-gray-500">{formatDate(timeline.plannedStartDate)}</span>
            <span className="text-xs text-gray-500">{formatDate(timeline.currentEndDate)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-blue-100 rounded" /> Time Elapsed
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-2 bg-green-500 rounded" /> Progress
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gray-300 border border-white" /> Milestone
          </div>
        </div>
      </div>

      {/* Delay warning */}
      {timeline.isDelayed && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Project is delayed by {timeline.delayDays} days
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="text-xs text-gray-500">Start Date</div>
          <div className="text-sm font-medium text-gray-900">{formatDate(timeline.currentStartDate)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="text-xs text-gray-500">End Date</div>
          <div className="text-sm font-medium text-gray-900">{formatDate(timeline.currentEndDate)}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Duration
          </div>
          <div className="text-sm font-medium text-gray-900">{timeline.currentDuration} days</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <div className="text-xs text-gray-500">Days Remaining</div>
          <div className={`text-sm font-medium ${
            timeline.daysRemaining < 30 ? 'text-red-600' :
            timeline.daysRemaining < 60 ? 'text-amber-600' :
            'text-gray-900'
          }`}>
            {timeline.daysRemaining}
          </div>
        </div>
      </div>
    </BaseCard>
  );
}
