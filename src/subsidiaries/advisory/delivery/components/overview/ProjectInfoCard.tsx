/**
 * Project Info Card - Project metadata and description
 */

import { FileText, Tag, Calendar, Hash } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';
import { PROJECT_STATUSES } from '../../types/project';

interface ProjectInfoCardProps {
  project: Project;
}

export function ProjectInfoCard({ project }: ProjectInfoCardProps) {
  const statusConfig = PROJECT_STATUSES[project.status];

  const projectTypeLabels: Record<string, string> = {
    new_construction: 'New Construction',
    renovation: 'Renovation',
    expansion: 'Expansion',
    rehabilitation: 'Rehabilitation',
  };

  return (
    <BaseCard padding="lg">
      <h3 className="text-base font-medium text-gray-900 mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4 text-gray-400" />
        Project Information
      </h3>

      <div className="space-y-3">
        {project.description && (
          <p className="text-sm text-gray-600 leading-relaxed">{project.description}</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Hash className="w-3 h-3" /> Project Code
            </div>
            <div className="text-sm font-medium text-gray-900">{project.projectCode || 'N/A'}</div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Type</div>
            <div className="text-sm font-medium text-gray-900">
              {projectTypeLabels[project.projectType] || project.projectType}
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Status</div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig?.color || ''} ${statusConfig?.bgColor || ''}`}>
              {statusConfig?.label || project.status}
            </span>
          </div>

          <div>
            <div className="text-xs text-gray-500">Program</div>
            <div className="text-sm font-medium text-gray-900">{project.programName || 'Unassigned'}</div>
          </div>

          {project.customerName && (
            <div>
              <div className="text-xs text-gray-500">Client</div>
              <div className="text-sm font-medium text-gray-900">{project.customerName}</div>
            </div>
          )}

          <div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Created
            </div>
            <div className="text-sm text-gray-600">
              {project.createdAt?.toDate
                ? project.createdAt.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : 'N/A'}
            </div>
          </div>
        </div>

        {project.tags && project.tags.length > 0 && (
          <div className="pt-2 border-t">
            <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
              <Tag className="w-3 h-3" /> Tags
            </div>
            <div className="flex flex-wrap gap-1.5">
              {project.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseCard>
  );
}
