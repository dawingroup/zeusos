/**
 * Project Overview Page
 * Comprehensive dashboard showing key project metrics, info, and status
 */

import { useOutletContext } from 'react-router-dom';
import { StatCard } from '../components/common/MetricCard';
import { DualProgressBar } from '../components/common/ProgressBar';
import { SimpleBudgetBar } from '../components/charts/BudgetBarChart';
import {
  ProjectInfoCard,
  LocationCard,
  ContractorCard,
  TimelineVisualization,
  AccountabilitySummaryCard,
  StagesProgressCard,
  TeamSummaryCard,
  RiskIndicatorsCard,
} from '../components/overview';
import type { ProjectOutletContext } from '../components/projects/ProjectLayout';

export function ProjectOverview() {
  const { project } = useOutletContext<ProjectOutletContext>();

  // Computed values
  const accountabilityRate = project.accountabilitySummary?.accountabilityRate || 0;
  const stageCompletion = project.stages?.length > 0
    ? Math.round(project.stages.reduce((sum, s) => sum + s.completionPercent, 0) / project.stages.length)
    : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Quick Stats - 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Physical Progress"
          value={`${project.progress.physicalProgress}%`}
          variant={
            project.progress.progressStatus === 'on_track' || project.progress.progressStatus === 'ahead'
              ? 'success' : project.progress.progressStatus === 'behind' ? 'warning' : 'danger'
          }
        />
        <StatCard
          label="Financial Progress"
          value={`${project.progress.financialProgress}%`}
        />
        <StatCard
          label="Days Remaining"
          value={project.timeline.daysRemaining}
          variant={project.timeline.daysRemaining < 30 ? 'danger' : project.timeline.daysRemaining < 60 ? 'warning' : undefined}
        />
        <StatCard
          label="Budget Status"
          value={project.budget.varianceStatus.replace(/_/g, ' ')}
          variant={project.budget.varianceStatus === 'on_track' ? 'success' : 'warning'}
        />
        <StatCard
          label="Accountability"
          value={`${accountabilityRate.toFixed(0)}%`}
          variant={accountabilityRate >= 80 ? 'success' : accountabilityRate >= 60 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Stage Completion"
          value={`${stageCompletion}%`}
          variant={stageCompletion >= 75 ? 'success' : stageCompletion >= 50 ? undefined : 'warning'}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <ProjectInfoCard project={project} />
          <LocationCard project={project} />
          <ContractorCard project={project} />
          <TeamSummaryCard project={project} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <TimelineVisualization project={project} />

          {/* Progress Section */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="text-base font-medium text-gray-900">Progress Overview</h3>
            <DualProgressBar
              physical={project.progress.physicalProgress}
              financial={project.progress.financialProgress}
            />
          </div>

          {/* Budget Section */}
          <div className="bg-white rounded-lg border p-6 space-y-4">
            <h3 className="text-base font-medium text-gray-900">Budget Utilization</h3>
            <SimpleBudgetBar
              allocated={project.budget.totalBudget}
              spent={project.budget.spent}
              committed={project.budget.committed}
              currency={project.budget.currency}
              compact
            />
          </div>

          <RiskIndicatorsCard project={project} />
        </div>
      </div>

      {/* Full-width sections */}
      <StagesProgressCard project={project} />
      <AccountabilitySummaryCard project={project} />
    </div>
  );
}

export default ProjectOverview;
