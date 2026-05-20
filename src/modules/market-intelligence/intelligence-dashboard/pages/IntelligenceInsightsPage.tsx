import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { useAuth } from '@/shared/hooks';
import { INSIGHT_PRIORITY_CONFIG } from '../constants/dashboard.constants';
import { useIntelligenceDashboard } from '../hooks/useIntelligenceDashboard';

const DEFAULT_ORG_ID = 'default';

export default function IntelligenceInsightsPage() {
  const { user } = useAuth();

  const organizationId = useMemo(() => {
    return (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  }, [user]);

  const { insights, error, insightsLoading, loadInsights } = useIntelligenceDashboard({
    organizationId,
  });

  return (
    <>
      <Helmet>
        <title>Market Intelligence | Insights</title>
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
              <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
              <p className="text-muted-foreground">Cross-module insights and signals</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadInsights()} disabled={insightsLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {insights.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">No insights found</p>
              </CardContent>
            </Card>
          ) : (
            insights.map((insight) => {
              const priorityLabel = INSIGHT_PRIORITY_CONFIG[insight.priority]?.label || insight.priority;

              return (
                <Card key={insight.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{insight.title}</CardTitle>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {insight.type} • {insight.status} • {new Date(insight.createdAt.toMillis()).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={insight.priority === 'critical' ? 'destructive' : 'secondary'}>
                      {priorityLabel}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">{insight.description}</p>
                    {!!insight.tags?.length && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {insight.tags.slice(0, 8).map((t) => (
                          <Badge key={t} variant="outline">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
