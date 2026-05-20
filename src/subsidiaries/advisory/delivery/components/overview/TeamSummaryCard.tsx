/**
 * Team Summary Card - Project team members
 */

import { Link, useParams } from 'react-router-dom';
import { Users, ChevronRight, Mail } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { Project } from '@/subsidiaries/advisory/core/project/types/project.types';

interface TeamSummaryCardProps {
  project: Project;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const ROLE_LABELS: Record<string, string> = {
  quantity_surveyor: 'QS',
  site_engineer: 'Site Eng.',
  project_manager: 'PM',
  advisor: 'Advisor',
};

const ROLE_COLORS: Record<string, string> = {
  quantity_surveyor: 'bg-purple-100 text-purple-700',
  site_engineer: 'bg-blue-100 text-blue-700',
  project_manager: 'bg-green-100 text-green-700',
  advisor: 'bg-amber-100 text-amber-700',
};

export function TeamSummaryCard({ project }: TeamSummaryCardProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const members = project.members || [];

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-gray-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          Team ({members.length})
        </h3>
        <Link
          to={`/advisory/delivery/projects/${projectId}/team`}
          className="text-primary text-xs hover:underline flex items-center"
        >
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No team members assigned</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {members.slice(0, 6).map(member => (
            <div key={member.userId} className="flex items-center gap-3">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-medium text-primary">
                  {getInitials(member.displayName)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{member.displayName}</div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    ROLE_COLORS[member.role] || 'bg-gray-100 text-gray-600'
                  }`}>
                    {ROLE_LABELS[member.role] || member.role}
                  </span>
                  {member.email && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5 truncate">
                      <Mail className="w-2.5 h-2.5" />
                      {member.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {members.length > 6 && (
            <Link
              to={`/advisory/delivery/projects/${projectId}/team`}
              className="block text-center text-xs text-primary hover:underline pt-1"
            >
              +{members.length - 6} more members
            </Link>
          )}
        </div>
      )}
    </BaseCard>
  );
}
