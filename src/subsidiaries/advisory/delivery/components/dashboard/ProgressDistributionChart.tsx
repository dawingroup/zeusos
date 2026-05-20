/**
 * Progress Distribution Chart - SVG donut showing projects by progress bands
 */

import { useMemo } from 'react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface ProgressDistributionChartProps {
  projects: Project[];
}

interface ProgressBand {
  label: string;
  count: number;
  color: string;
  bgClass: string;
}

export function ProgressDistributionChart({ projects }: ProgressDistributionChartProps) {
  const activeProjects = useMemo(
    () => projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled'),
    [projects]
  );

  const bands: ProgressBand[] = useMemo(() => {
    const b = [
      { label: '0-25%', count: 0, color: '#EF4444', bgClass: 'bg-red-500' },
      { label: '25-50%', count: 0, color: '#F59E0B', bgClass: 'bg-amber-500' },
      { label: '50-75%', count: 0, color: '#3B82F6', bgClass: 'bg-blue-500' },
      { label: '75-100%', count: 0, color: '#10B981', bgClass: 'bg-green-500' },
    ];

    activeProjects.forEach(p => {
      const prog = p.progress?.physicalProgress || 0;
      if (prog < 25) b[0].count++;
      else if (prog < 50) b[1].count++;
      else if (prog < 75) b[2].count++;
      else b[3].count++;
    });

    return b;
  }, [activeProjects]);

  // Status distribution
  const statusDist = useMemo(() => {
    const dist = {
      ahead: activeProjects.filter(p => p.progress?.progressStatus === 'ahead').length,
      on_track: activeProjects.filter(p => p.progress?.progressStatus === 'on_track').length,
      behind: activeProjects.filter(p => p.progress?.progressStatus === 'behind').length,
      critical: activeProjects.filter(p => p.progress?.progressStatus === 'critical').length,
    };
    return dist;
  }, [activeProjects]);

  const total = activeProjects.length || 1;

  // SVG donut
  const size = 140;
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const segments = bands
    .filter(b => b.count > 0)
    .map(b => {
      const pct = b.count / total;
      const dashLength = pct * circumference;
      const offset = currentOffset;
      currentOffset += dashLength;
      return { ...b, dashLength, dashOffset: offset };
    });

  return (
    <BaseCard padding="lg">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Progress Distribution</h2>

      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="relative shrink-0">
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#E5E7EB"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {segments.map((seg, i) => (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={seg.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${seg.dashLength} ${circumference - seg.dashLength}`}
                strokeDashoffset={-seg.dashOffset}
                className="transition-all duration-500"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{activeProjects.length}</span>
            <span className="text-xs text-gray-500">Active</span>
          </div>
        </div>

        {/* Legend + Status */}
        <div className="flex-1 space-y-4">
          {/* Progress bands */}
          <div className="space-y-1.5">
            {bands.map((b, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${b.bgClass}`} />
                  <span className="text-gray-600">{b.label}</span>
                </div>
                <span className="font-medium text-gray-900">{b.count}</span>
              </div>
            ))}
          </div>

          {/* Status badges */}
          <div className="pt-3 border-t space-y-1.5">
            <div className="text-xs font-medium text-gray-500 uppercase">Status</div>
            <div className="grid grid-cols-2 gap-1.5">
              {statusDist.ahead > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700">
                  Ahead: {statusDist.ahead}
                </span>
              )}
              <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">
                On Track: {statusDist.on_track}
              </span>
              {statusDist.behind > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700">
                  Behind: {statusDist.behind}
                </span>
              )}
              {statusDist.critical > 0 && (
                <span className="text-xs px-2 py-1 rounded bg-red-50 text-red-700">
                  Critical: {statusDist.critical}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </BaseCard>
  );
}
