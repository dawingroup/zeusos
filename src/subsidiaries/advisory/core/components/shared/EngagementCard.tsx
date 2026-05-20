/**
 * ENGAGEMENT CARD
 * 
 * Displays engagement summary with status, progress, and quick actions.
 */

import React, { useMemo } from 'react';
import { 
  Building2, 
  Briefcase, 
  TrendingUp, 
  Calendar,
  Users,
  DollarSign,
  AlertCircle,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

// ============================================================================
// Types
// ============================================================================

type EngagementStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'closed' | 'cancelled' | 'archived';
type EngagementModule = 'delivery' | 'investment' | 'advisory' | 'matflow';

interface TeamMember {
  userId: string;
  name?: string;
  avatar?: string;
}

interface FundingSource {
  committedAmount?: number;
  currency?: string;
}

interface Timeline {
  plannedStart?: { toDate: () => Date };
  plannedEnd?: { toDate: () => Date };
}

interface Engagement {
  id: string;
  name: string;
  description?: string;
  status: EngagementStatus;
  referenceNumber?: string;
  modules?: { [key: string]: { enabled: boolean } };
  team?: { members?: TeamMember[] };
  fundingSources?: FundingSource[];
  timeline?: Timeline;
  alerts?: unknown[];
}

interface EngagementCardProps {
  engagement: Engagement;
  onClick?: (engagement: Engagement) => void;
  onMenuAction?: (action: string, engagement: Engagement) => void;
  variant?: 'default' | 'compact' | 'detailed';
  showProgress?: boolean;
  showTeam?: boolean;
  showFunding?: boolean;
  className?: string;
}

interface StatusConfig {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface ModuleConfig {
  icon: React.ElementType;
  color: string;
  label: string;
}

// ============================================================================
// Configuration
// ============================================================================

const STATUS_CONFIG: Record<EngagementStatus, StatusConfig> = {
  draft: {
    label: 'Draft',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
  },
  active: {
    label: 'Active',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
  },
  on_hold: {
    label: 'On Hold',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-300',
  },
  completed: {
    label: 'Completed',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-300',
  },
  closed: {
    label: 'Closed',
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    borderColor: 'border-red-300',
  },
  archived: {
    label: 'Archived',
    color: 'text-gray-400',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
  },
};

const MODULE_CONFIG: Record<EngagementModule, ModuleConfig> = {
  delivery: {
    icon: Building2,
    color: 'text-blue-600',
    label: 'Infrastructure',
  },
  investment: {
    icon: TrendingUp,
    color: 'text-green-600',
    label: 'Investment',
  },
  advisory: {
    icon: Briefcase,
    color: 'text-purple-600',
    label: 'Advisory',
  },
  matflow: {
    icon: Building2,
    color: 'text-orange-600',
    label: 'MatFlow',
  },
};

// ============================================================================
// Sub-components
// ============================================================================

const StatusBadge: React.FC<{ status: EngagementStatus }> = ({ status }) => {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`
      inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
      ${config.bgColor} ${config.color} border ${config.borderColor}
    `}>
      {config.label}
    </span>
  );
};

const ModuleBadge: React.FC<{ module: EngagementModule }> = ({ module }) => {
  const config = MODULE_CONFIG[module] || MODULE_CONFIG.delivery;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
};

const ProgressBar: React.FC<{ percentage: number; color?: string }> = ({ 
  percentage, 
  color = 'bg-blue-600' 
}) => (
  <div className="w-full bg-gray-200 rounded-full h-2">
    <div
      className={`h-2 rounded-full ${color} transition-all duration-300`}
      style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
    />
  </div>
);

const TeamAvatars: React.FC<{ 
  members: Array<{ id: string; name: string; avatar?: string }>;
  max?: number;
}> = ({ members, max = 3 }) => {
  const displayed = members.slice(0, max);
  const remaining = members.length - max;
  
  return (
    <div className="flex -space-x-2">
      {displayed.map((member) => (
        <div
          key={member.id}
          className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600"
          title={member.name}
        >
          {member.avatar ? (
            <img src={member.avatar} alt={member.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            member.name.split(' ').map(n => n[0]).join('').substring(0, 2)
          )}
        </div>
      ))}
      {remaining > 0 && (
        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
          +{remaining}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const EngagementCard: React.FC<EngagementCardProps> = ({
  engagement,
  onClick,
  onMenuAction,
  variant = 'default',
  showProgress = true,
  showTeam = true,
  showFunding = true,
  className = '',
}) => {
  // Calculate progress
  const progress = useMemo(() => {
    if (!engagement.timeline) return 0;
    const start = engagement.timeline.plannedStart?.toDate?.() || new Date();
    const end = engagement.timeline.plannedEnd?.toDate?.() || new Date();
    const now = new Date();
    
    if (now < start) return 0;
    if (now > end) return 100;
    
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.round((elapsed / total) * 100);
  }, [engagement.timeline]);
  
  // Get primary module
  const primaryModule = useMemo(() => {
    if (!engagement.modules) return 'delivery' as EngagementModule;
    const enabledModules = Object.entries(engagement.modules)
      .filter(([, config]) => config.enabled)
      .map(([key]) => key as EngagementModule);
    return enabledModules[0] || 'delivery';
  }, [engagement.modules]);
  
  // Team members
  const teamMembers = useMemo(() => {
    return (engagement.team?.members || []).map(member => ({
      id: member.userId,
      name: member.name || member.userId,
      avatar: member.avatar,
    }));
  }, [engagement.team]);
  
  // Funding summary
  const fundingSummary = useMemo(() => {
    if (!engagement.fundingSources || engagement.fundingSources.length === 0) return null;
    const total = engagement.fundingSources.reduce((sum, source) => {
      return sum + (source.committedAmount || 0);
    }, 0);
    const currency = engagement.fundingSources[0]?.currency || 'USD';
    return { total, currency };
  }, [engagement.fundingSources]);
  
  // Handle click
  const handleClick = () => {
    if (onClick) onClick(engagement);
  };
  
  // Handle menu action
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMenuAction) onMenuAction('menu', engagement);
  };
  
  // Compact variant
  if (variant === 'compact') {
    return (
      <div
        onClick={handleClick}
        className={`
          p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 
          hover:shadow-sm transition-all cursor-pointer
          ${className}
        `}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ModuleBadge module={primaryModule} />
            <span className="font-medium text-gray-900 truncate">
              {engagement.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={engagement.status} />
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    );
  }
  
  // Default and detailed variants
  return (
    <div
      onClick={handleClick}
      className={`
        bg-white border border-gray-200 rounded-xl hover:border-gray-300 
        hover:shadow-md transition-all cursor-pointer overflow-hidden
        ${className}
      `}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ModuleBadge module={primaryModule} />
              {engagement.referenceNumber && (
                <span className="text-xs text-gray-500">
                  #{engagement.referenceNumber}
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 truncate">
              {engagement.name}
            </h3>
            {engagement.description && variant === 'detailed' && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                {engagement.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={engagement.status} />
            {onMenuAction && (
              <button
                onClick={handleMenuClick}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Progress */}
      {showProgress && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar percentage={progress} />
        </div>
      )}
      
      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-2 gap-4">
        {/* Timeline */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div className="text-sm">
            {engagement.timeline?.plannedEnd ? (
              <span className="text-gray-600">
                Due {formatDate(engagement.timeline.plannedEnd.toDate())}
              </span>
            ) : (
              <span className="text-gray-400">No deadline</span>
            )}
          </div>
        </div>
        
        {/* Funding */}
        {showFunding && fundingSummary && (
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {formatCurrency(fundingSummary.total, fundingSummary.currency)}
            </span>
          </div>
        )}
        
        {/* Team */}
        {showTeam && teamMembers.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        
        {/* Alerts */}
        {engagement.alerts && engagement.alerts.length > 0 && (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm text-amber-600">
              {engagement.alerts.length} alert{engagement.alerts.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
      
      {/* Team Avatars (detailed only) */}
      {showTeam && teamMembers.length > 0 && variant === 'detailed' && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <TeamAvatars members={teamMembers} />
          <button className="text-xs text-blue-600 hover:text-blue-700">
            View team
          </button>
        </div>
      )}
    </div>
  );
};

export default EngagementCard;
