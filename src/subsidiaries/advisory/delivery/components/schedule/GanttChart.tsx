/**
 * Gantt Chart - Custom SVG Gantt visualization
 */

import { useMemo } from 'react';
import type { ScheduleActivity } from '../../types/schedule';
import { getActivityBarColor } from '../../types/schedule';

interface GanttChartProps {
  activities: ScheduleActivity[];
  criticalPathIds: string[];
  height?: number;
}

const ROW_HEIGHT = 32;
const LABEL_WIDTH = 200;
const CHART_PADDING = 16;
const HEADER_HEIGHT = 40;

export function GanttChart({ activities, criticalPathIds, height }: GanttChartProps) {
  const sortedActivities = useMemo(() => {
    return [...activities]
      .filter(a => a.activityType !== 'phase')
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [activities]);

  // Calculate time range
  const timeRange = useMemo(() => {
    if (sortedActivities.length === 0) return { start: new Date(), end: new Date(), totalDays: 1 };
    const dates = sortedActivities.flatMap(a => [
      new Date(a.plannedStartDate).getTime(),
      new Date(a.plannedEndDate).getTime(),
    ]);
    const start = new Date(Math.min(...dates));
    const end = new Date(Math.max(...dates));
    // Add buffer
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 7);
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return { start, end, totalDays };
  }, [sortedActivities]);

  // Generate month markers
  const months = useMemo(() => {
    const result: Array<{ label: string; startPct: number; widthPct: number }> = [];
    const current = new Date(timeRange.start);
    current.setDate(1);

    while (current <= timeRange.end) {
      const monthStart = Math.max(current.getTime(), timeRange.start.getTime());
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      const monthEnd = Math.min(nextMonth.getTime(), timeRange.end.getTime());

      const startPct = ((monthStart - timeRange.start.getTime()) / (timeRange.end.getTime() - timeRange.start.getTime())) * 100;
      const widthPct = ((monthEnd - monthStart) / (timeRange.end.getTime() - timeRange.start.getTime())) * 100;

      result.push({
        label: current.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
        startPct,
        widthPct,
      });

      current.setMonth(current.getMonth() + 1);
    }
    return result;
  }, [timeRange]);

  // Today marker
  const todayPct = useMemo(() => {
    const now = new Date();
    if (now < timeRange.start || now > timeRange.end) return null;
    return ((now.getTime() - timeRange.start.getTime()) / (timeRange.end.getTime() - timeRange.start.getTime())) * 100;
  }, [timeRange]);

  const chartHeight = height || Math.max(200, sortedActivities.length * ROW_HEIGHT + HEADER_HEIGHT + CHART_PADDING * 2);
  const chartWidth = 600;

  if (sortedActivities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No activities to display</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex" style={{ minWidth: LABEL_WIDTH + chartWidth }}>
        {/* Labels column */}
        <div className="shrink-0" style={{ width: LABEL_WIDTH }}>
          {/* Header spacer */}
          <div style={{ height: HEADER_HEIGHT }} className="border-b bg-gray-50 flex items-end px-2 pb-1">
            <span className="text-xs font-medium text-gray-500">Activity</span>
          </div>

          {/* Activity labels */}
          {sortedActivities.map(activity => {
            const isCritical = criticalPathIds.includes(activity.id);
            return (
              <div
                key={activity.id}
                style={{ height: ROW_HEIGHT }}
                className="flex items-center px-2 border-b border-gray-50"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {activity.activityType === 'milestone' && (
                    <span className="text-purple-500 text-xs">&#9670;</span>
                  )}
                  <span className={`text-xs truncate ${isCritical ? 'font-semibold text-red-700' : 'text-gray-700'}`}>
                    {activity.wbsCode && (
                      <span className="text-gray-400 mr-1">{activity.wbsCode}</span>
                    )}
                    {activity.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart area */}
        <div className="flex-1 relative" style={{ minWidth: chartWidth }}>
          <svg width="100%" height={chartHeight} className="block">
            {/* Month headers */}
            {months.map((month, i) => (
              <g key={i}>
                <rect
                  x={`${month.startPct}%`}
                  y={0}
                  width={`${month.widthPct}%`}
                  height={HEADER_HEIGHT}
                  fill={i % 2 === 0 ? '#F9FAFB' : '#F3F4F6'}
                />
                <text
                  x={`${month.startPct + month.widthPct / 2}%`}
                  y={HEADER_HEIGHT / 2 + 4}
                  textAnchor="middle"
                  className="text-[10px] fill-gray-500"
                >
                  {month.label}
                </text>
                {/* Vertical grid line */}
                <line
                  x1={`${month.startPct}%`}
                  y1={HEADER_HEIGHT}
                  x2={`${month.startPct}%`}
                  y2={chartHeight}
                  stroke="#E5E7EB"
                  strokeWidth={0.5}
                />
              </g>
            ))}

            {/* Header bottom border */}
            <line x1="0" y1={HEADER_HEIGHT} x2="100%" y2={HEADER_HEIGHT} stroke="#D1D5DB" strokeWidth={1} />

            {/* Activity bars */}
            {sortedActivities.map((activity, i) => {
              const startDate = new Date(activity.plannedStartDate);
              const endDate = new Date(activity.plannedEndDate);
              const startPct = ((startDate.getTime() - timeRange.start.getTime()) / (timeRange.end.getTime() - timeRange.start.getTime())) * 100;
              const widthPct = ((endDate.getTime() - startDate.getTime()) / (timeRange.end.getTime() - timeRange.start.getTime())) * 100;
              const y = HEADER_HEIGHT + i * ROW_HEIGHT + 6;
              const barHeight = ROW_HEIGHT - 12;
              const isCritical = criticalPathIds.includes(activity.id);
              const color = getActivityBarColor(activity);

              if (activity.activityType === 'milestone') {
                // Diamond marker for milestones
                const cx = startPct;
                const cy = y + barHeight / 2;
                return (
                  <g key={activity.id}>
                    <rect
                      x={`${cx}%`}
                      y={cy - 5}
                      width={7}
                      height={7}
                      transform={`rotate(45)`}
                      style={{ transformOrigin: `${cx}% ${cy}px`, transformBox: 'fill-box' }}
                      fill={color}
                      stroke={isCritical ? '#DC2626' : 'white'}
                      strokeWidth={isCritical ? 2 : 1}
                    />
                  </g>
                );
              }

              return (
                <g key={activity.id}>
                  {/* Row background stripe */}
                  {i % 2 === 1 && (
                    <rect
                      x="0"
                      y={HEADER_HEIGHT + i * ROW_HEIGHT}
                      width="100%"
                      height={ROW_HEIGHT}
                      fill="#FAFAFA"
                    />
                  )}
                  {/* Background bar */}
                  <rect
                    x={`${startPct}%`}
                    y={y}
                    width={`${Math.max(0.5, widthPct)}%`}
                    height={barHeight}
                    rx={3}
                    fill={color}
                    opacity={0.3}
                    stroke={isCritical ? '#DC2626' : 'none'}
                    strokeWidth={isCritical ? 1.5 : 0}
                  />
                  {/* Progress fill */}
                  {activity.percentComplete > 0 && (
                    <rect
                      x={`${startPct}%`}
                      y={y}
                      width={`${Math.max(0.2, widthPct * (activity.percentComplete / 100))}%`}
                      height={barHeight}
                      rx={3}
                      fill={color}
                    />
                  )}
                  {/* Progress label */}
                  {widthPct > 3 && (
                    <text
                      x={`${startPct + widthPct / 2}%`}
                      y={y + barHeight / 2 + 3}
                      textAnchor="middle"
                      className="text-[9px] fill-white font-medium"
                      style={{ paintOrder: 'stroke', stroke: color, strokeWidth: 2 }}
                    >
                      {activity.percentComplete}%
                    </text>
                  )}
                </g>
              );
            })}

            {/* Today marker */}
            {todayPct !== null && (
              <line
                x1={`${todayPct}%`}
                y1={HEADER_HEIGHT}
                x2={`${todayPct}%`}
                y2={chartHeight}
                stroke="#EF4444"
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            )}
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-2 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-4 h-2.5 rounded bg-green-500" /> Completed
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-2.5 rounded bg-blue-500" /> In Progress
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-2.5 rounded bg-red-500" /> Delayed
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-2.5 rounded bg-gray-300" /> Not Started
        </div>
        <div className="flex items-center gap-1">
          <span className="text-purple-500">&#9670;</span> Milestone
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-red-500" style={{ borderTop: '1.5px dashed #EF4444' }} /> Today
        </div>
      </div>
    </div>
  );
}
