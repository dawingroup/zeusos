/**
 * ProjectTable Component
 *
 * Table-based view of delivery projects with sortable columns,
 * color-coded status/stage indicators, progress bars, and budget info.
 * Inspired by the DesignItemsTable in Zeus Group.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronUp,
  ChevronDown,
  MapPin,
  AlertTriangle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { Project, ProjectStatus } from '../../types/project';
import { PROJECT_STATUSES } from '../../types/project';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

interface ProjectTableProps {
  projects: Project[];
}

type SortField =
  | 'projectCode'
  | 'name'
  | 'status'
  | 'location'
  | 'budget'
  | 'physicalProgress'
  | 'financialProgress'
  | 'daysRemaining';
type SortDirection = 'asc' | 'desc';

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

const STATUS_ORDER: ProjectStatus[] = [
  'active',
  'mobilization',
  'procurement',
  'planning',
  'substantial_completion',
  'defects_liability',
  'completed',
  'suspended',
  'cancelled',
];

function formatCurrency(amount: number, currency: string): string {
  if (amount >= 1_000_000_000) return `${currency} ${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${currency} ${(amount / 1_000).toFixed(0)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

function progressColor(pct: number): string {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-amber-500';
  if (pct >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

function budgetHealthColor(project: Project): string {
  const { totalBudget, spent, committed } = project.budget;
  if (totalBudget <= 0) return 'text-gray-500';
  const utilization = ((spent + committed) / totalBudget) * 100;
  if (utilization > 95) return 'text-red-600 font-semibold';
  if (utilization > 80) return 'text-amber-600';
  return 'text-gray-900';
}

function daysRemainingColor(project: Project): string {
  if (project.timeline.isDelayed) return 'text-red-600 font-semibold';
  if (project.timeline.daysRemaining <= 30) return 'text-amber-600';
  return 'text-gray-700';
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function ProjectTable({ projects }: ProjectTableProps) {
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'projectCode':
          comparison = (a.projectCode || '').localeCompare(b.projectCode || '');
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          break;
        case 'location':
          comparison = (a.location?.siteName || '').localeCompare(b.location?.siteName || '');
          break;
        case 'budget':
          comparison = (a.budget?.totalBudget || 0) - (b.budget?.totalBudget || 0);
          break;
        case 'physicalProgress':
          comparison = (a.progress?.physicalProgress || 0) - (b.progress?.physicalProgress || 0);
          break;
        case 'financialProgress':
          comparison = (a.progress?.financialProgress || 0) - (b.progress?.financialProgress || 0);
          break;
        case 'daysRemaining':
          comparison = (a.timeline?.daysRemaining || 0) - (b.timeline?.daysRemaining || 0);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [projects, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortHeader = ({
    field,
    children,
    className = '',
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      onClick={() => handleSort(field)}
      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className}`}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field &&
          (sortDirection === 'asc' ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          ))}
      </div>
    </th>
  );

  if (projects.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 font-outfit">
          <thead className="bg-gray-50">
            <tr>
              <SortHeader field="projectCode" className="w-28">
                Code
              </SortHeader>
              <SortHeader field="name">Project</SortHeader>
              <SortHeader field="status" className="w-36">
                Status
              </SortHeader>
              <SortHeader field="location" className="w-40">
                Location
              </SortHeader>
              <SortHeader field="budget" className="w-36 text-right">
                Budget
              </SortHeader>
              <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                Spent
              </th>
              <SortHeader field="physicalProgress" className="w-40">
                Physical
              </SortHeader>
              <SortHeader field="financialProgress" className="w-40">
                Financial
              </SortHeader>
              <SortHeader field="daysRemaining" className="w-28">
                Timeline
              </SortHeader>
              <th className="w-12 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedProjects.map((project, idx) => {
              const statusConfig = PROJECT_STATUSES[project.status];
              const budget = project.budget || { currency: 'UGX', totalBudget: 0, spent: 0, committed: 0 };
              const progress = project.progress || { physicalProgress: 0, financialProgress: 0, progressStatus: 'on_track' };
              const timeline = project.timeline || { daysRemaining: 0, isDelayed: false };
              const physPct = progress.physicalProgress || 0;
              const finPct = progress.financialProgress || 0;
              const isDelayed = timeline.isDelayed;
              const isCritical = progress.progressStatus === 'critical';

              return (
                <tr
                  key={project.id}
                  className={`
                    hover:bg-gray-50 transition-colors
                    ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                    ${isCritical ? 'border-l-4 border-l-red-400' : isDelayed ? 'border-l-4 border-l-amber-400' : ''}
                  `}
                >
                  {/* Code */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="text-xs text-gray-500">{project.projectCode}</span>
                  </td>

                  {/* Name */}
                  <td className="px-3 py-3">
                    <Link
                      to={`/advisory/delivery/projects/${project.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {project.name}
                    </Link>
                    {project.programName && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                        {project.programName}
                      </p>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig?.color || 'text-gray-700'} ${statusConfig?.bgColor || 'bg-gray-100'}`}
                    >
                      {statusConfig?.label || project.status}
                    </span>
                    {isCritical && (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline ml-1" />
                    )}
                  </td>

                  {/* Location */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-3.5 h-3.5 mr-1 flex-shrink-0 text-gray-400" />
                      <span className="truncate max-w-[130px]">
                        {project.location?.siteName || '—'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {project.location?.district || ''}
                      {project.location?.region ? `, ${project.location.region}` : ''}
                    </span>
                  </td>

                  {/* Budget Total */}
                  <td className={`px-3 py-3 whitespace-nowrap text-right text-sm tabular-nums ${budgetHealthColor(project)}`}>
                    {formatCurrency(budget.totalBudget, budget.currency)}
                  </td>

                  {/* Spent */}
                  <td className="px-3 py-3 whitespace-nowrap text-right text-sm tabular-nums text-gray-600">
                    {formatCurrency(budget.spent, budget.currency)}
                  </td>

                  {/* Physical Progress */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden min-w-[60px]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${progressColor(physPct)}`}
                          style={{ width: `${Math.min(100, physPct)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-10 text-right">
                        {physPct.toFixed(0)}%
                      </span>
                    </div>
                  </td>

                  {/* Financial Progress */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden min-w-[60px]">
                        <div
                          className="h-full rounded-full transition-all duration-300 bg-blue-500"
                          style={{ width: `${Math.min(100, finPct)}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-10 text-right">
                        {finPct.toFixed(0)}%
                      </span>
                    </div>
                  </td>

                  {/* Timeline */}
                  <td className={`px-3 py-3 whitespace-nowrap text-sm ${daysRemainingColor(project)}`}>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{timeline.daysRemaining}d</span>
                      {isDelayed && (
                        <span className="text-xs text-red-500 ml-0.5">late</span>
                      )}
                    </div>
                  </td>

                  {/* Link */}
                  <td className="px-2 py-3 text-center">
                    <Link
                      to={`/advisory/delivery/projects/${project.id}`}
                      className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 rounded transition-colors inline-flex"
                      title="View project"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
        <span>{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-4">
          <span>
            Total Budget:{' '}
            <span className="font-medium text-gray-700 tabular-nums">
              {formatCurrency(
                projects.reduce((sum, p) => sum + (p.budget?.totalBudget || 0), 0),
                projects[0]?.budget?.currency || 'UGX'
              )}
            </span>
          </span>
          <span>
            Total Spent:{' '}
            <span className="font-medium text-gray-700 tabular-nums">
              {formatCurrency(
                projects.reduce((sum, p) => sum + (p.budget?.spent || 0), 0),
                projects[0]?.budget?.currency || 'UGX'
              )}
            </span>
          </span>
          <span>
            Avg Physical:{' '}
            <span className="font-medium text-gray-700">
              {projects.length > 0
                ? (
                    projects.reduce((sum, p) => sum + (p.progress?.physicalProgress || 0), 0) /
                    projects.length
                  ).toFixed(1)
                : 0}
              %
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
