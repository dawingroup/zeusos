/**
 * UNIFIED DASHBOARD
 * 
 * Main dashboard showing cross-module summary and quick actions.
 */

import React, { useMemo } from 'react';
import {
  Building2,
  TrendingUp,
  Briefcase,
  Clock,
  CheckCircle,
  DollarSign,
  ArrowRight,
  Plus,
  Bell,
  FileText,
  Package,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

// ============================================================================
// Types
// ============================================================================

type EngagementStatus = 'draft' | 'active' | 'on_hold' | 'completed' | 'closed' | 'cancelled' | 'archived';
type EngagementModule = 'delivery' | 'investment' | 'advisory' | 'matflow';

interface FundingSource {
  committedAmount?: number;
  currency?: string;
}

interface Engagement {
  id: string;
  name: string;
  status: EngagementStatus;
  modules?: { [key: string]: { enabled: boolean } };
  fundingSources?: FundingSource[];
  updatedAt?: { toMillis: () => number };
}

interface ApprovalRequest {
  id: string;
  title: string;
  type: string;
  status: string;
  amount?: number;
  currency?: string;
  dueDate?: { toDate: () => Date; toMillis: () => number };
}

interface Notification {
  id: string;
  title: string;
  readAt?: unknown;
}

interface UnifiedDashboardProps {
  engagements: Engagement[];
  pendingApprovals: ApprovalRequest[];
  recentNotifications: Notification[];
  onEngagementClick: (engagement: Engagement) => void;
  onApprovalClick: (approval: ApprovalRequest) => void;
  onNotificationClick: (notification: Notification) => void;
  onCreateEngagement: () => void;
  onViewAllEngagements: () => void;
  onViewAllApprovals: () => void;
  loading?: boolean;
  className?: string;
}

interface ModuleStats {
  module: EngagementModule;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  count: number;
  activeCount: number;
  totalValue: number;
}

// ============================================================================
// Configuration
// ============================================================================

const MODULE_CONFIG: Record<EngagementModule, { 
  label: string; 
  icon: React.ElementType; 
  color: string;
  bgColor: string;
}> = {
  delivery: {
    label: 'Infrastructure',
    icon: Building2,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  investment: {
    label: 'Investment',
    icon: TrendingUp,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  advisory: {
    label: 'Advisory',
    icon: Briefcase,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  matflow: {
    label: 'MatFlow',
    icon: Package,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
};

// ============================================================================
// Sub-components
// ============================================================================

const StatCard: React.FC<{
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: { value: number; positive: boolean };
}> = ({ label, value, subValue, icon: Icon, iconColor, iconBg, trend }) => (
  <div
    className="flex flex-col gap-1 rounded-[10px] border bg-[var(--bg-surface)] overflow-hidden"
    style={{
      padding: 'var(--pad-card)',
      borderColor: 'var(--border-default)',
    }}
  >
    <div className="flex items-start justify-between gap-2">
      <span
        className="text-[11px] font-medium uppercase tracking-[0.08em]"
        style={{ color: 'var(--fg-tertiary)' }}
      >
        {label}
      </span>
      <div className="flex items-center gap-2">
        {trend && (
          <span
            className="text-[12px] font-medium tabular-nums"
            style={{ color: trend.positive ? 'var(--rag-green)' : 'var(--rag-red)' }}
          >
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
        <span className={`p-1.5 rounded-md grid place-items-center shrink-0 ${iconBg}`}>
          <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        </span>
      </div>
    </div>
    <div
      className="text-[26px] font-semibold tabular-nums mt-1"
      style={{ color: 'var(--fg-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
    >
      {value}
    </div>
    {subValue && (
      <div className="text-[12px] mt-0.5" style={{ color: 'var(--fg-secondary)' }}>
        {subValue}
      </div>
    )}
  </div>
);

const ModuleStatCard: React.FC<{
  stats: ModuleStats;
  onClick?: () => void;
}> = ({ stats, onClick }) => {
  const Icon = stats.icon;
  const inner = (
    <div
      className="rounded-[10px] border bg-[var(--bg-surface)] p-4 transition-shadow"
      style={{
        borderColor: 'var(--border-default)',
        boxShadow: onClick ? undefined : undefined,
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = '';
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`p-1.5 rounded-md ${stats.bgColor}`}>
          <Icon className={`w-3.5 h-3.5 ${stats.color}`} />
        </span>
        <h3
          className="text-[13px] font-semibold m-0"
          style={{ color: 'var(--fg-primary)' }}
        >
          {stats.label}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p
            className="text-[20px] font-semibold tabular-nums m-0"
            style={{ color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}
          >
            {stats.count}
          </p>
          <p className="text-[11px] m-0" style={{ color: 'var(--fg-tertiary)' }}>Total</p>
        </div>
        <div>
          <p
            className="text-[20px] font-semibold tabular-nums m-0"
            style={{ color: 'var(--rag-green)', letterSpacing: '-0.01em' }}
          >
            {stats.activeCount}
          </p>
          <p className="text-[11px] m-0" style={{ color: 'var(--fg-tertiary)' }}>Active</p>
        </div>
      </div>
      {stats.totalValue > 0 && (
        <div
          className="mt-3 pt-3 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-[11.5px] m-0" style={{ color: 'var(--fg-tertiary)' }}>
            Total Value:{' '}
            <span className="font-semibold" style={{ color: 'var(--fg-primary)' }}>
              {formatCurrency(stats.totalValue, 'USD')}
            </span>
          </p>
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left w-full cursor-pointer">
        {inner}
      </button>
    );
  }
  return inner;
};

const QuickActionButton: React.FC<{
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}> = ({ icon: Icon, label, onClick, variant = 'secondary' }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
      ${variant === 'primary' 
        ? 'bg-blue-600 text-white hover:bg-blue-700' 
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }
    `}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const EngagementListItem: React.FC<{
  engagement: Engagement;
  onClick: () => void;
}> = ({ engagement, onClick }) => {
  // Get first enabled module
  const module = useMemo(() => {
    if (!engagement.modules) return 'delivery' as EngagementModule;
    const enabled = Object.entries(engagement.modules)
      .filter(([, v]) => v.enabled)
      .map(([k]) => k as EngagementModule);
    return enabled[0] || 'delivery';
  }, [engagement.modules]);
  
  const config = MODULE_CONFIG[module];
  const Icon = config.icon;
  
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
    >
      <div className={`p-2 rounded-lg ${config.bgColor}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{engagement.name}</p>
        <p className="text-sm text-gray-500">{config.label}</p>
      </div>
      <div className={`
        px-2 py-0.5 rounded text-xs font-medium
        ${engagement.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}
      `}>
        {engagement.status}
      </div>
    </div>
  );
};

const ApprovalListItem: React.FC<{
  approval: ApprovalRequest;
  onClick: () => void;
}> = ({ approval, onClick }) => {
  const isOverdue = approval.dueDate && approval.dueDate.toDate() < new Date();
  
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
    >
      <div className={`p-2 rounded-lg ${isOverdue ? 'bg-red-100' : 'bg-amber-100'}`}>
        <Clock className={`w-4 h-4 ${isOverdue ? 'text-red-600' : 'text-amber-600'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{approval.title}</p>
        <p className="text-sm text-gray-500">
          {approval.type.replace(/_/g, ' ')}
          {approval.amount && ` • ${formatCurrency(approval.amount, approval.currency || 'USD')}`}
        </p>
      </div>
      {isOverdue && (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
          Overdue
        </span>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const UnifiedDashboard: React.FC<UnifiedDashboardProps> = ({
  engagements,
  pendingApprovals,
  recentNotifications,
  onEngagementClick,
  onApprovalClick,
  onCreateEngagement,
  onViewAllEngagements,
  onViewAllApprovals,
  loading = false,
  className = '',
}) => {
  // Calculate module stats
  const moduleStats = useMemo<ModuleStats[]>(() => {
    const stats: Record<EngagementModule, ModuleStats> = {
      delivery: {
        module: 'delivery',
        ...MODULE_CONFIG.delivery,
        count: 0,
        activeCount: 0,
        totalValue: 0,
      },
      investment: {
        module: 'investment',
        ...MODULE_CONFIG.investment,
        count: 0,
        activeCount: 0,
        totalValue: 0,
      },
      advisory: {
        module: 'advisory',
        ...MODULE_CONFIG.advisory,
        count: 0,
        activeCount: 0,
        totalValue: 0,
      },
      matflow: {
        module: 'matflow',
        ...MODULE_CONFIG.matflow,
        count: 0,
        activeCount: 0,
        totalValue: 0,
      },
    };
    
    engagements.forEach(eng => {
      // Get first enabled module
      let module: EngagementModule = 'delivery';
      if (eng.modules) {
        const enabled = Object.entries(eng.modules)
          .filter(([, v]) => v.enabled)
          .map(([k]) => k as EngagementModule);
        if (enabled[0]) module = enabled[0];
      }
      
      stats[module].count++;
      if (eng.status === 'active') {
        stats[module].activeCount++;
      }
      if (eng.fundingSources) {
        eng.fundingSources.forEach(fs => {
          stats[module].totalValue += fs.committedAmount || 0;
        });
      }
    });
    
    return Object.values(stats);
  }, [engagements]);
  
  // Overall stats
  const overallStats = useMemo(() => ({
    totalEngagements: engagements.length,
    activeEngagements: engagements.filter(e => e.status === 'active').length,
    pendingApprovalCount: pendingApprovals.length,
    overdueApprovals: pendingApprovals.filter(a => 
      a.dueDate && a.dueDate.toDate() < new Date()
    ).length,
    unreadNotifications: recentNotifications.filter(n => !n.readAt).length,
  }), [engagements, pendingApprovals, recentNotifications]);
  
  // Recent engagements
  const recentEngagements = useMemo(() => 
    engagements
      .sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0))
      .slice(0, 5),
    [engagements]
  );
  
  // Urgent approvals
  const urgentApprovals = useMemo(() =>
    pendingApprovals
      .filter(a => a.status === 'pending')
      .sort((a, b) => {
        const aOverdue = a.dueDate && a.dueDate.toDate() < new Date();
        const bOverdue = b.dueDate && b.dueDate.toDate() < new Date();
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        return (a.dueDate?.toMillis() || 0) - (b.dueDate?.toMillis() || 0);
      })
      .slice(0, 5),
    [pendingApprovals]
  );
  
  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="h-48 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Overview of all your engagements</p>
        </div>
        <div className="flex items-center gap-3">
          <QuickActionButton
            icon={Plus}
            label="New Engagement"
            onClick={onCreateEngagement}
            variant="primary"
          />
        </div>
      </div>
      
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Engagements"
          value={overallStats.totalEngagements}
          subValue={`${overallStats.activeEngagements} active`}
          icon={Briefcase}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          label="Pending Approvals"
          value={overallStats.pendingApprovalCount}
          subValue={overallStats.overdueApprovals > 0 ? `${overallStats.overdueApprovals} overdue` : undefined}
          icon={Clock}
          iconColor={overallStats.overdueApprovals > 0 ? 'text-red-600' : 'text-amber-600'}
          iconBg={overallStats.overdueApprovals > 0 ? 'bg-red-100' : 'bg-amber-100'}
        />
        <StatCard
          label="Notifications"
          value={overallStats.unreadNotifications}
          subValue="unread"
          icon={Bell}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
        />
        <StatCard
          label="Total Value"
          value={formatCurrency(
            moduleStats.reduce((sum, m) => sum + m.totalValue, 0),
            'USD'
          )}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBg="bg-green-100"
        />
      </div>
      
      {/* Module stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {moduleStats.map(stats => (
          <ModuleStatCard key={stats.module} stats={stats} />
        ))}
      </div>
      
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent engagements */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Engagements</h2>
            <button
              onClick={onViewAllEngagements}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentEngagements.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No engagements yet</p>
                <button
                  onClick={onCreateEngagement}
                  className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Create your first engagement
                </button>
              </div>
            ) : (
              recentEngagements.map(engagement => (
                <EngagementListItem
                  key={engagement.id}
                  engagement={engagement}
                  onClick={() => onEngagementClick(engagement)}
                />
              ))
            )}
          </div>
        </div>
        
        {/* Pending approvals */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              Pending Approvals
              {overallStats.overdueApprovals > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  {overallStats.overdueApprovals} overdue
                </span>
              )}
            </h2>
            <button
              onClick={onViewAllApprovals}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {urgentApprovals.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto text-green-300 mb-3" />
                <p>No pending approvals</p>
              </div>
            ) : (
              urgentApprovals.map(approval => (
                <ApprovalListItem
                  key={approval.id}
                  approval={approval}
                  onClick={() => onApprovalClick(approval)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UnifiedDashboard;
