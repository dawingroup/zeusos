import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { useAuth } from '@/shared/hooks';
import { useIntelligenceDashboard } from '../hooks/useIntelligenceDashboard';

const DEFAULT_ORG_ID = 'default';

export default function IntelligenceAnalyticsPage() {
  const { user } = useAuth();

  const organizationId = useMemo(() => {
    return (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  }, [user]);

  const { analytics, error, executiveLoading, loadAnalytics } = useIntelligenceDashboard({
    organizationId,
  });

  return (
    <>
      <Helmet>
        <title>Market Intelligence | Analytics</title>
      </Helmet>

      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/market-intelligence">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
              <p className="text-muted-foreground">Cross-module analytics snapshot</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadAnalytics('monthly')}
            disabled={executiveLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Period Overview</CardTitle>
          </CardHeader>
          <CardContent>
            {!analytics ? (
              <p className="text-muted-foreground">No analytics available</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Period</div>
                  <div className="text-xl font-semibold">{analytics.period}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Insights</div>
                  <div className="text-2xl font-bold">{analytics.keyMetrics.find((m) => m.metricType === 'insight_count')?.currentValue ?? 0}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Overdue Action Items</div>
                  <div className="text-2xl font-bold">{analytics.actionItemsSummary.overdue}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Breakdowns</CardTitle>
          </CardHeader>
          <CardContent>
            {!analytics ? (
              <p className="text-muted-foreground">No breakdowns available</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="text-sm font-medium">Insights by Type</div>
                  <div className="mt-2 space-y-1">
                    {Object.entries(analytics.insightsByType).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">Insights by Priority</div>
                  <div className="mt-2 space-y-1">
                    {Object.entries(analytics.insightsByPriority).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
