import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { FileText, Lightbulb, ListTodo, Plus, Search, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { useAuth } from '@/shared/hooks';
import { StatsCard } from '@/shared/components/data-display/StatsCard';
import { QuickActionsGrid } from '@/shared/components/data-display';
import { useIntelligenceDashboard } from '../hooks/useIntelligenceDashboard';

const DEFAULT_ORG_ID = 'default';

export default function IntelligenceDashboardPage() {
  const { user } = useAuth();

  const organizationId = useMemo(() => {
    return (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  }, [user]);

  const {
    insights,
    reports,
    actionItems,
    executiveSummary,
    analytics,
    error,
    isLoading,
    loadExecutiveSummary,
    loadAnalytics,
  } = useIntelligenceDashboard({ organizationId });

  const insightCount = insights.length;
  const openActionItems = actionItems.filter((a) => a.status !== 'completed' && a.status !== 'cancelled').length;
  const reportCount = reports.length;

  return (
    <>
      <Helmet>
        <title>Market Intelligence | Intelligence Dashboard</title>
      </Helmet>

      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Market Intelligence</h1>
            <p className="text-muted-foreground">Unified dashboard across insights, analytics, and reports</p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/market-intelligence/insights">Insights</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/market-intelligence/reports">Reports</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/market-intelligence/analytics">Analytics</Link>
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg p-4 text-[var(--rag-red)]">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/market-intelligence/insights">
            <StatsCard title="Insights" value={insightCount} icon={Lightbulb} />
          </Link>
          <Link to="/market-intelligence/insights">
            <StatsCard title="Open Action Items" value={openActionItems} icon={ListTodo} />
          </Link>
          <Link to="/market-intelligence/reports">
            <StatsCard title="Reports" value={reportCount} icon={FileText} />
          </Link>
        </div>

        {/* Quick Actions */}
        <QuickActionsGrid
          columns={3}
          actions={[
            { label: 'New Insight', description: 'Record a market observation', icon: Plus, onClick: () => {} },
            { label: 'Search Insights', description: 'Find past intelligence', icon: Search, onClick: () => {} },
            { label: 'View Analytics', description: 'Performance metrics', icon: BarChart3, onClick: () => {} },
          ]}
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Executive Summary</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadExecutiveSummary()}
                disabled={isLoading}
              >
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!executiveSummary ? (
              <p className="text-muted-foreground">No summary available</p>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">
                  Generated at: {executiveSummary.generatedAt.toDate().toLocaleString()}
                </div>

                <div className="space-y-2">
                  {executiveSummary.headlines.slice(0, 5).map((h) => (
                    <div key={h.insightId} className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{h.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{h.summary}</p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/market-intelligence/insights">View</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Analytics Snapshot</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAnalytics('monthly')}
              disabled={isLoading}
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {!analytics ? (
              <p className="text-muted-foreground">No analytics available</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Insights (period)</div>
                  <div className="text-2xl font-bold">{analytics.keyMetrics.find((m) => m.metricType === 'insight_count')?.currentValue ?? 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Action Items</div>
                  <div className="text-2xl font-bold">{analytics.actionItemsSummary.total}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Published Reports</div>
                  <div className="text-2xl font-bold">{analytics.reportSummary.publishedThisPeriod}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
