/**
 * Schedule Stats Bar - Row of metric cards for schedule overview
 */

import { StatCard } from '../common/MetricCard';
import type { ScheduleSummary } from '../../types/schedule';

interface ScheduleStatsBarProps {
  summary: ScheduleSummary | null;
}

export function ScheduleStatsBar({ summary }: ScheduleStatsBarProps) {
  if (!summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Activities" value={0} />
        <StatCard label="Completed" value={0} />
        <StatCard label="In Progress" value={0} />
        <StatCard label="Delayed" value={0} />
        <StatCard label="Milestones" value="0/0" />
        <StatCard label="Overall Progress" value="0%" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard
        label="Total Activities"
        value={summary.totalActivities}
      />
      <StatCard
        label="Completed"
        value={summary.completedActivities}
        variant="success"
      />
      <StatCard
        label="In Progress"
        value={summary.inProgressActivities}
      />
      <StatCard
        label="Delayed"
        value={summary.delayedActivities}
        variant={summary.delayedActivities > 0 ? 'danger' : undefined}
      />
      <StatCard
        label="Milestones"
        value={`${summary.completedMilestones}/${summary.milestoneCount}`}
      />
      <StatCard
        label="Overall Progress"
        value={`${summary.overallProgress}%`}
        variant={summary.overallProgress >= 75 ? 'success' : summary.overallProgress >= 50 ? undefined : 'warning'}
      />
    </div>
  );
}
