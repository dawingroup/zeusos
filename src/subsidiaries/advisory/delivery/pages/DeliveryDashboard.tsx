/**
 * Delivery Dashboard - Comprehensive portfolio overview with live data
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAllPrograms } from '../hooks/program-hooks';
import { useAllProjects } from '../hooks/project-hooks';
import { usePendingApprovals } from '../hooks/payment-hooks';
import { useRecentActivity } from '../hooks/activity-hooks';
import { db } from '@/core/services/firebase';
import { ColoredStatsCard } from '@/shared/components/data-display';
import { BaseCard, InteractiveCard } from '@/shared/components/cards';
import {
  ProgramBreakdownCard,
  BudgetTrendsChart,
  TimelineAlertsCard,
  RequisitionSummaryCard,
  RecentActivityFeed,
  ProgressDistributionChart,
} from '../components/dashboard';

export function DeliveryDashboard() {
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  // Fetch real data
  const { programs, loading: programsLoading } = useAllPrograms(db, {});
  const { projects, loading: projectsLoading, refresh: refreshProjects } = useAllProjects(db, {});
  const { approvals } = usePendingApprovals(db, 'project_manager', { realtime: true });
  const { activities, loading: activitiesLoading, refresh: refreshActivities } = useRecentActivity(db, { limit: 10 });

  const loading = programsLoading || projectsLoading;

  // Filter projects by selected program
  const filteredProjects = useMemo(() => {
    if (!selectedProgramId) return projects;
    return projects.filter(p => p.programId === selectedProgramId);
  }, [projects, selectedProgramId]);

  // Calculate stats from real data
  const stats = useMemo(() => {
    const activeProjects = filteredProjects.filter(p =>
      ['active', 'in_progress', 'mobilization'].includes(p.status)
    ).length;

    const completedProjects = filteredProjects.filter(p => p.status === 'completed').length;

    const delayedProjects = filteredProjects.filter(p =>
      p.timeline?.isDelayed ||
      ['slightly_behind', 'significantly_behind', 'critical'].includes(p.progress?.progressStatus || '')
    ).length;

    const totalBudget = filteredProjects.reduce((sum, p) => sum + (p.budget?.totalBudget || 0), 0);
    const totalSpent = filteredProjects.reduce((sum, p) => sum + (p.budget?.spent || 0), 0);

    const avgProgress = filteredProjects.length > 0
      ? Math.round(filteredProjects.reduce((sum, p) => sum + (p.progress?.physicalProgress || 0), 0) / filteredProjects.length)
      : 0;

    return {
      totalPrograms: programs.length,
      totalProjects: filteredProjects.length,
      activeProjects,
      completedProjects,
      delayedProjects,
      totalBudget,
      totalSpent,
      avgProgress,
      pendingApprovals: approvals.length,
    };
  }, [programs, filteredProjects, approvals]);

  // Top projects by progress
  const topProjects = useMemo(() => {
    return filteredProjects
      .filter(p => p.status !== 'completed')
      .sort((a, b) => (b.progress?.physicalProgress || 0) - (a.progress?.physicalProgress || 0))
      .slice(0, 4);
  }, [filteredProjects]);

  // Derive dominant currency from projects (most common budget currency)
  const dominantCurrency = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredProjects.forEach(p => {
      const c = p.budget?.currency || 'UGX';
      counts[c] = (counts[c] || 0) + 1;
    });
    let max = 0;
    let currency = 'UGX';
    for (const [c, n] of Object.entries(counts)) {
      if (n > max) { max = n; currency = c; }
    }
    return currency;
  }, [filteredProjects]);

  const formatCurrency = (amount: number, currency?: string): string => {
    const c = currency || dominantCurrency;
    if (amount >= 1000000000) return `${c} ${(amount / 1000000000).toFixed(1)}B`;
    if (amount >= 1000000) return `${c} ${(amount / 1000000).toFixed(1)}M`;
    return `${c} ${amount.toLocaleString()}`;
  };

  const handleRefresh = () => {
    refreshProjects();
    refreshActivities();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Infrastructure Delivery</h1>
          <p className="text-gray-600">
            {stats.totalPrograms} active programs &middot; {stats.totalProjects} projects
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          <select
            className="px-3 py-2 border rounded-lg bg-white"
            value={selectedProgramId || 'all'}
            onChange={(e) => setSelectedProgramId(e.target.value === 'all' ? null : e.target.value)}
          >
            <option value="all">All Programs</option>
            {programs.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <ColoredStatsCard
          icon={Building2}
          label="Total Projects"
          value={stats.totalProjects}
          subtitle="All projects"
          color="blue"
        />
        <ColoredStatsCard
          icon={Clock}
          label="Active"
          value={stats.activeProjects}
          subtitle="In progress"
          color="amber"
        />
        <ColoredStatsCard
          icon={CheckCircle}
          label="Completed"
          value={stats.completedProjects}
          subtitle="Finished"
          color="green"
        />
        <ColoredStatsCard
          icon={DollarSign}
          label="Total Budget"
          value={formatCurrency(stats.totalBudget)}
          subtitle="Allocated"
          color="primary"
        />
        <ColoredStatsCard
          icon={TrendingUp}
          label="Avg. Progress"
          value={`${stats.avgProgress}%`}
          subtitle="Completion"
          color="indigo"
        />
        <ColoredStatsCard
          icon={AlertTriangle}
          label="Delayed"
          value={stats.delayedProjects}
          subtitle="Need attention"
          color="red"
        />
      </div>

      {/* Program Breakdown - Full width */}
      <ProgramBreakdownCard programs={programs} projects={filteredProjects} />

      {/* Budget + Progress Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BudgetTrendsChart programs={programs} projects={filteredProjects} />
        <ProgressDistributionChart projects={filteredProjects} />
      </div>

      {/* Timeline Alerts + Requisition Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TimelineAlertsCard projects={filteredProjects} />
        <RequisitionSummaryCard projects={filteredProjects} />
      </div>

      {/* Main Grid: Projects + Budget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Projects Overview */}
        <BaseCard padding="lg" className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">Top Active Projects</h2>
            <Link
              to="/advisory/delivery/projects"
              className="text-primary text-sm hover:underline flex items-center"
            >
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {topProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No active projects</p>
              </div>
            ) : (
              topProjects.map(project => (
                <InteractiveCard
                  key={project.id}
                  to={`/advisory/delivery/projects/${project.id}`}
                  padding="sm"
                  hoverBorderColor="hover:border-blue-200"
                  className="flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-gray-900">{project.name}</div>
                    <div className="text-sm text-gray-500">
                      {project.location?.district || 'Location TBD'} &middot; {project.location?.region || ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{project.progress?.physicalProgress || 0}%</div>
                    <div className="w-24 h-2 bg-gray-200 rounded-full mt-1">
                      <div
                        className={`h-full rounded-full ${
                          project.progress?.progressStatus === 'on_track' || project.progress?.progressStatus === 'ahead'
                            ? 'bg-green-500'
                            : project.progress?.progressStatus === 'behind'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${project.progress?.physicalProgress || 0}%` }}
                      />
                    </div>
                  </div>
                </InteractiveCard>
              ))
            )}
          </div>
        </BaseCard>

        {/* Budget Overview */}
        <BaseCard padding="lg">
          <h2 className="text-lg font-medium mb-4">Budget Overview</h2>

          <div className="space-y-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats.totalBudget)}
              </div>
              <div className="text-sm text-gray-500">Total Budget</div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Utilized</span>
                <span className="font-medium">
                  {stats.totalBudget > 0 ? ((stats.totalSpent / stats.totalBudget) * 100).toFixed(1) : 0}%
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${stats.totalBudget > 0 ? (stats.totalSpent / stats.totalBudget) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">
                  {formatCurrency(stats.totalSpent)}
                </div>
                <div className="text-xs text-gray-500">Spent</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {formatCurrency(stats.totalBudget - stats.totalSpent)}
                </div>
                <div className="text-xs text-gray-500">Remaining</div>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      {/* Recent Activity Feed */}
      <RecentActivityFeed activities={activities} loading={activitiesLoading} />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InteractiveCard to="/advisory/delivery/projects" hoverBorderColor="hover:border-blue-200">
          <Building2 className="w-8 h-8 text-blue-500 mb-2" />
          <div className="font-medium">All Projects</div>
          <div className="text-sm text-gray-500">View and manage projects</div>
        </InteractiveCard>

        <InteractiveCard to="/advisory/delivery/approvals" hoverBorderColor="hover:border-green-200">
          <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
          <div className="font-medium">Approvals</div>
          <div className="text-sm text-gray-500">
            {stats.pendingApprovals > 0
              ? `${stats.pendingApprovals} pending approval${stats.pendingApprovals !== 1 ? 's' : ''}`
              : 'No pending approvals'}
          </div>
        </InteractiveCard>

        <InteractiveCard to="/advisory/delivery/programs" hoverBorderColor="hover:border-indigo-200">
          <TrendingUp className="w-8 h-8 text-indigo-500 mb-2" />
          <div className="font-medium">Programs</div>
          <div className="text-sm text-gray-500">Program management</div>
        </InteractiveCard>

        <InteractiveCard to="/advisory/delivery/reports" hoverBorderColor="hover:border-primary/30">
          <DollarSign className="w-8 h-8 text-primary mb-2" />
          <div className="font-medium">Reports</div>
          <div className="text-sm text-gray-500">Generate reports</div>
        </InteractiveCard>
      </div>
    </div>
  );
}
