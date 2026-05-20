import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { useAuth } from '@/shared/hooks';
import { REPORT_STATUS_CONFIG } from '../constants/dashboard.constants';
import { useIntelligenceDashboard } from '../hooks/useIntelligenceDashboard';

const DEFAULT_ORG_ID = 'default';

export default function IntelligenceReportsPage() {
  const { user } = useAuth();

  const organizationId = useMemo(() => {
    return (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;
  }, [user]);

  const { reports, error, reportsLoading, loadReports } = useIntelligenceDashboard({
    organizationId,
  });

  return (
    <>
      <Helmet>
        <title>Market Intelligence | Reports</title>
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
              <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
              <p className="text-muted-foreground">Generated and scheduled reports</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => loadReports()} disabled={reportsLoading}>
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
          {reports.length === 0 ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-muted-foreground">No reports found</p>
              </CardContent>
            </Card>
          ) : (
            reports.map((report) => {
              const statusLabel = REPORT_STATUS_CONFIG[report.status]?.label || report.status;
              const badgeVariant = report.status === 'published' ? 'default' : report.status === 'approved' ? 'secondary' : 'outline';

              return (
                <Card key={report.id}>
                  <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{report.title}</CardTitle>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {report.type} • {new Date(report.createdAt.toMillis()).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant={badgeVariant}>{statusLabel}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3">{report.description}</p>
                    {!!report.tags?.length && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {report.tags.slice(0, 8).map((t) => (
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
