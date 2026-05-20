/**
 * Project Header - Header section for project detail page
 */

import { Project } from '../../types/project';
import { StatusBadge } from '../common/StatusBadge';
import { DualProgressRing } from '../charts/ProgressDonut';
import { 
  MapPin, 
  Calendar, 
  Users, 
  FileText,
  MoreVertical,
  Edit,
  Pause,
  XCircle
} from 'lucide-react';
import { useState } from 'react';

interface ProjectHeaderProps {
  project: Project;
  onEdit?: () => void;
  onSuspend?: () => void;
  onCancel?: () => void;
}

export function ProjectHeader({ 
  project, 
  onEdit,
  onSuspend,
  onCancel 
}: ProjectHeaderProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex flex-col lg:flex-row lg:items-start gap-6">
        {/* Left: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-gray-500 font-mono">
                  {project.projectCode}
                </span>
                <StatusBadge status={project.status} type="project" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-gray-600 mt-1">{project.description}</p>
              )}
            </div>

            {/* Actions menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <MoreVertical className="w-5 h-5 text-gray-500" />
              </button>
              
              {showMenu && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 z-10">
                  {onEdit && (
                    <button
                      onClick={() => { onEdit(); setShowMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit Project
                    </button>
                  )}
                  {onSuspend && project.status !== 'suspended' && (
                    <button
                      onClick={() => { onSuspend(); setShowMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-amber-600"
                    >
                      <Pause className="w-4 h-4" />
                      Suspend Project
                    </button>
                  )}
                  {onCancel && project.status !== 'cancelled' && (
                    <button
                      onClick={() => { onCancel(); setShowMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Project
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Meta info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <MapPin className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {project.location.siteName}, {project.location.district}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span>
                {formatDate(project.timeline.currentStartDate)} - {formatDate(project.timeline.currentEndDate)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <Users className="w-4 h-4 flex-shrink-0" />
              <span>
                {project.implementationType === 'contractor' 
                  ? project.contractor?.companyName || 'No contractor'
                  : 'Direct Implementation'
                }
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-600">
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span>{project.projectType.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Timeline status */}
          {project.timeline.isDelayed && (
            <div className="mt-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              ⚠️ Project is delayed by {project.timeline.delayDays} days
            </div>
          )}
        </div>

        {/* Right: Progress rings */}
        <div className="flex flex-col items-center">
          <DualProgressRing
            physical={project.progress.physicalProgress}
            financial={project.progress.financialProgress}
            size={140}
          />
          <div className="text-sm text-gray-500 mt-2">
            {project.timeline.daysRemaining} days remaining
          </div>
        </div>
      </div>
    </div>
  );
}
