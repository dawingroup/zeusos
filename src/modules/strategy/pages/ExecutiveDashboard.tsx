// ============================================================================
// ExecutiveDashboard PAGE
// ZeusOS v2.0 - CEO Strategy Command Module
// Main executive dashboard combining all performance views
// ============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  TrendingUp,
  BarChart3,
  Activity,
  ArrowRight,
  Zap,
  AlertTriangle,
  FileText,
  RefreshCw,
} from 'lucide-react';

import { ColoredStatsCard, QuickActionsGrid, Banner } from '@/shared/components/data-display';
import { Button } from '@/core/components/ui/button';
import { useStrategyDashboard } from '../hooks/useStrategyDashboard';

export const ExecutiveDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { metrics, topOKRs, topKPIs, loading, error, refresh } = useStrategyDashboard();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-6">
          <div className="h-8 w-64 bg-[var(--bg-sunken)] rounded animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 bg-card rounded-lg border animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="inline-flex items-center gap-2">
              <Target className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              Executive Dashboard
            </h1>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
              Strategic performance overview for Zeus Group
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Error Banner */}
        {error && (
          <Banner tone="danger" title="Error" message={error} icon={<AlertTriangle className="h-4 w-4" />} />
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ColoredStatsCard
            label="Active OKRs"
            value={metrics.activeOKRs}
            icon={Zap}
            color="purple"
            subtitle={`${metrics.totalOKRs} total`}
            onClick={() => navigate('/strategy/okrs')}
          />
          <ColoredStatsCard
            label="OKR Progress"
            value={`${metrics.okrProgress}%`}
            icon={TrendingUp}
            color="blue"
            subtitle="Average completion"
            onClick={() => navigate('/strategy/okrs')}
          />
          <ColoredStatsCard
            label="Active KPIs"
            value={metrics.activeKPIs}
            icon={BarChart3}
            color="green"
            subtitle={`${metrics.criticalKPIs} critical`}
            onClick={() => navigate('/strategy/kpis')}
          />
          <ColoredStatsCard
            label="Stale KPIs"
            value={metrics.staleKPIs}
            icon={AlertTriangle}
            color={metrics.staleKPIs > 0 ? 'red' : 'green'}
            subtitle="Need data update"
            onClick={() => navigate('/strategy/kpis')}
          />
        </div>

        {/* Quick Actions */}
        <QuickActionsGrid
          columns={4}
          actions={[
            { label: 'Strategy Plans', description: 'View strategic plans', icon: Target, onClick: () => navigate('/strategy/plans') },
            { label: 'OKRs', description: 'Objectives & Key Results', icon: Zap, onClick: () => navigate('/strategy/okrs') },
            { label: 'KPI Dashboard', description: 'Performance indicators', icon: BarChart3, onClick: () => navigate('/strategy/kpis') },
            { label: 'Analytics', description: 'Performance analytics', icon: Activity, onClick: () => navigate('/strategy/analytics') },
          ]}
        />

        {/* OKR Progress & KPI Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* OKR Progress */}
          <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">OKR Progress</h2>
              <button
                onClick={() => navigate('/strategy/okrs')}
                className="text-sm text-[var(--rag-blue)] hover:text-[var(--rag-blue)] flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {topOKRs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active OKRs found</p>
                <button
                  onClick={() => navigate('/strategy/okrs')}
                  className="mt-2 text-sm text-[var(--rag-blue)] hover:underline"
                >
                  Create your first OKR
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {topOKRs.map(okr => (
                  <div key={okr.id} className="p-3 border border-[var(--border-subtle)] rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-foreground truncate flex-1 mr-2">
                        {okr.title}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {okr.keyResultCount} KRs
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-[var(--bg-sunken)] rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(okr.progress, 100)}%`,
                            backgroundColor: okr.progress >= 70 ? '#22c55e' : okr.progress >= 40 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground w-10 text-right">
                        {okr.progress}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KPI Summary */}
          <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">KPI Scorecard</h2>
              <button
                onClick={() => navigate('/strategy/kpis')}
                className="text-sm text-[var(--rag-blue)] hover:text-[var(--rag-blue)] flex items-center gap-1"
              >
                View All <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            {topKPIs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No active KPIs found</p>
                <button
                  onClick={() => navigate('/strategy/kpis')}
                  className="mt-2 text-sm text-[var(--rag-blue)] hover:underline"
                >
                  Set up KPIs
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {topKPIs.map(kpi => (
                  <div key={kpi.id} className="flex items-center justify-between p-3 border border-[var(--border-subtle)] rounded-lg">
                    <div className="flex-1 min-w-0 mr-3">
                      <span className="text-sm font-medium text-foreground truncate block">
                        {kpi.name}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{kpi.category}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">
                        {kpi.currentValue !== null ? kpi.currentValue : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Strategy Review Link */}
        <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--rag-blue-soft)] rounded-lg">
                <FileText className="h-5 w-5 text-[var(--rag-blue)]" />
              </div>
              <div>
                <h3 className="font-medium text-foreground">Strategy Reviews</h3>
                <p className="text-sm text-muted-foreground">
                  AI-powered business strategy review tool with SWOT, BMC, and OKR generation
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/strategy/plans')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[var(--rag-blue)] border border-[var(--rag-blue)] rounded-lg hover:bg-[var(--rag-blue-soft)] transition-colors"
            >
              Open
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Alignment Heatmap Placeholder (rendered by parent when sections exist) */}
        {metrics && 'sectionsNeedingRewrite' in metrics && (metrics as Record<string, unknown>).sectionsNeedingRewrite != null && (
          <div className="bg-card rounded-lg shadow-sm border border-[var(--border-subtle)] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--rag-blue)]" />
                Strategy Alignment
              </h3>
              <span className="text-xs text-[var(--rag-amber)] font-medium">
                {String((metrics as Record<string, unknown>).sectionsNeedingRewrite)} sections need review
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Open a strategy review to see the full alignment heatmap.
            </p>
          </div>
        )}
    </div>
  );
};

export default ExecutiveDashboard;
