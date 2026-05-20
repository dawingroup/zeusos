/**
 * Project Progress Page
 * Detailed progress tracking with S-curve and progress bars
 */

import { useOutletContext } from 'react-router-dom';
import { ProgressBar } from '../components/common/ProgressBar';
import { SCurveChart } from '../components/charts/SCurveChart';
import type { ProjectOutletContext } from '../components/projects/ProjectLayout';

export function ProjectProgressPage() {
  const { project } = useOutletContext<ProjectOutletContext>();

  // Mock S-curve data - in production this would come from the project or a separate service
  const scurveData = Array.from({ length: 20 }, (_, i) => ({
    weekNumber: i + 1,
    weekStartDate: new Date(2024, 0, 15 + i * 7),
    plannedCumulative: Math.min(100, (i + 1) * 5),
    plannedIncremental: 5,
    actualCumulative: i < 13 ? Math.min(100, (i + 1) * 5 + Math.random() * 5 - 2) : undefined,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* S-Curve Chart */}
      <SCurveChart data={scurveData} currentWeek={13} height={350} />

      {/* Progress Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-medium mb-4">Physical Progress</h3>
          <ProgressBar
            value={project.progress.physicalProgress}
            status={project.progress.progressStatus}
            size="lg"
            showLabel
          />
        </div>

        <div>
          <h3 className="text-lg font-medium mb-4">Financial Progress</h3>
          <ProgressBar
            value={project.progress.financialProgress}
            size="lg"
            showLabel
          />
        </div>
      </div>
    </div>
  );
}

export default ProjectProgressPage;
