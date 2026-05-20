/**
 * Project Card - Summary card for project lists
 */

import { Link } from 'react-router-dom';
import { Project } from '../../types/project';
import { StatusBadge } from '../common/StatusBadge';
import { ProgressBar } from '../common/ProgressBar';
import { MapPin, Calendar, DollarSign, TrendingUp } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  showProgram?: boolean;
}

function formatCurrency(amount: number, currency: string, compact = true): string {
  if (compact) {
    if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(1)}K`;
  }
  return `${currency} ${amount.toLocaleString()}`;
}

export function ProjectCard({ project, showProgram = false }: ProjectCardProps) {
  const isDelayed = project.timeline.isDelayed;
  const isCritical = project.progress.progressStatus === 'critical';

  return (
    <Link 
      to={`/advisory/delivery/projects/${project.id}`}
      className={`
        block bg-white rounded-lg border p-4 hover:shadow-md transition-shadow
        ${isCritical ? 'border-red-200' : isDelayed ? 'border-amber-200' : 'border-gray-200'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-xs text-gray-500 font-mono">{project.projectCode}</span>
          <h3 className="font-medium text-gray-900">{project.name}</h3>
          {showProgram && (
            <span className="text-xs text-gray-500">Program: {project.programId}</span>
          )}
        </div>
        <StatusBadge status={project.status} type="project" size="sm" />
      </div>

      {/* Location */}
      <div className="flex items-center text-sm text-gray-600 mb-3">
        <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
        <span className="truncate">
          {project.location.siteName}, {project.location.district}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600">Physical Progress</span>
          <span className="font-medium">
            {project.progress.physicalProgress.toFixed(1)}%
          </span>
        </div>
        <ProgressBar 
          value={project.progress.physicalProgress}
          status={project.progress.progressStatus}
        />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="flex items-center text-gray-600">
          <DollarSign className="w-4 h-4 mr-1" />
          <span>{formatCurrency(project.budget.totalBudget, project.budget.currency)}</span>
        </div>
        
        <div className="flex items-center text-gray-600">
          <TrendingUp className="w-4 h-4 mr-1" />
          <span>{project.progress.financialProgress.toFixed(1)}%</span>
        </div>
        
        <div className={`flex items-center ${isDelayed ? 'text-amber-600' : 'text-gray-600'}`}>
          <Calendar className="w-4 h-4 mr-1" />
          <span>{project.timeline.daysRemaining}d</span>
        </div>
      </div>
    </Link>
  );
}
