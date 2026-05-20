/**
 * ProjectAccountabilitySummary - Table showing accountability status by project
 */

import { Link } from 'react-router-dom';
import { ChevronRight, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { ProjectAccountabilitySummary as ProjectSummaryType } from '../../hooks/accountability-hooks';

interface ProjectAccountabilitySummaryProps {
  projects: ProjectSummaryType[];
  currency?: string;
  onProjectClick?: (projectId: string) => void;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

const STATUS_CONFIG = {
  healthy: {
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    icon: CheckCircle,
    label: 'Healthy',
  },
  warning: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    icon: AlertTriangle,
    label: 'Warning',
  },
  critical: {
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    icon: XCircle,
    label: 'Critical',
  },
};

export function ProjectAccountabilitySummaryTable({
  projects,
  currency = 'UGX',
  onProjectClick,
}: ProjectAccountabilitySummaryProps) {
  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Data Available</h3>
        <p className="text-gray-500">No projects with paid requisitions found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Project Accountability Summary</h3>
        <p className="text-sm text-gray-500">Overview of accountability status by project</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Project</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Requisitions</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Disbursed</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Accounted</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Unaccounted</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Rate</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {projects.map(project => {
              const statusConfig = STATUS_CONFIG[project.status];
              const StatusIcon = statusConfig.icon;

              return (
                <tr
                  key={project.projectId}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onProjectClick?.(project.projectId)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{project.projectName}</div>
                    {project.programName && (
                      <div className="text-xs text-gray-500">{project.programName}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-medium">{project.requisitionCount}</span>
                    {project.overdueCount > 0 && (
                      <span className="ml-1 text-xs text-red-600">
                        ({project.overdueCount} overdue)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(project.totalDisbursed, currency)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 font-medium">
                    {formatCurrency(project.totalAccounted, currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`font-medium ${
                        project.unaccountedAmount > 0 ? 'text-amber-600' : 'text-green-600'
                      }`}
                    >
                      {formatCurrency(project.unaccountedAmount, currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            project.accountabilityRate >= 90
                              ? 'bg-green-500'
                              : project.accountabilityRate >= 70
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(project.accountabilityRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">
                        {project.accountabilityRate.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectSummaryType;
  currency?: string;
}

export function ProjectAccountabilityCard({ project, currency = 'UGX' }: ProjectCardProps) {
  const statusConfig = STATUS_CONFIG[project.status];
  const StatusIcon = statusConfig.icon;

  return (
    <Link
      to={`/advisory/delivery/projects/${project.projectId}/requisitions`}
      className="block bg-white rounded-lg border p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-medium text-gray-900">{project.projectName}</h4>
          {project.programName && (
            <p className="text-sm text-gray-500">{project.programName}</p>
          )}
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}
        >
          <StatusIcon className="w-3 h-3" />
          {statusConfig.label}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Requisitions</span>
          <span className="font-medium">
            {project.requisitionCount}
            {project.overdueCount > 0 && (
              <span className="text-red-600 ml-1">({project.overdueCount} overdue)</span>
            )}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Disbursed</span>
          <span className="font-medium">{formatCurrency(project.totalDisbursed, currency)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Unaccounted</span>
          <span
            className={`font-medium ${
              project.unaccountedAmount > 0 ? 'text-amber-600' : 'text-green-600'
            }`}
          >
            {formatCurrency(project.unaccountedAmount, currency)}
          </span>
        </div>

        <div className="pt-2">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Accountability Rate</span>
            <span className="font-medium">{project.accountabilityRate.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                project.accountabilityRate >= 90
                  ? 'bg-green-500'
                  : project.accountabilityRate >= 70
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(project.accountabilityRate, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
