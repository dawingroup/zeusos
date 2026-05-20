import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { QuickActions } from '@/core/components/navigation/QuickActions';
import { MODULE_DEFINITIONS } from '@/integration/constants';
import { useCrossModule } from '@/core/hooks/useCrossModule';

export interface UnifiedDashboardProps {
  organizationId: string;
  userId?: string;
}

export function UnifiedDashboard({ organizationId, userId }: UnifiedDashboardProps) {
  const navigate = useNavigate();
  const { moduleSummaries, recentActivity, loading, refresh } = useCrossModule({
    organizationId,
    userId,
  });

  const modules = useMemo(() => [...MODULE_DEFINITIONS].sort((a, b) => a.order - b.order), []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Unified Dashboard</h1>
          <p className="text-sm text-muted-foreground">Cross-module overview</p>
        </div>
        <Button variant="outline" onClick={() => refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <QuickActions max={8} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((m) => {
          const summary = moduleSummaries?.[m.id];

          return (
            <Card key={m.id} className="cursor-pointer" onClick={() => navigate(m.basePath)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{m.shortName}</CardTitle>
                  <Badge variant="outline">{m.id}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground line-clamp-2">{m.description}</div>
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary">Pending: {summary?.pendingItems ?? 0}</Badge>
                  <Badge variant="secondary">Alerts: {summary?.alerts?.length ?? 0}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/activity')}>
            View all
          </Button>
        </CardHeader>
        <CardContent>
          {!recentActivity || recentActivity.length === 0 ? (
            <div className="text-sm text-muted-foreground">No recent activity</div>
          ) : (
            <div className="space-y-2">
              {recentActivity.slice(0, 10).map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 p-2 rounded-lg hover:bg-muted">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{a.entityTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.module} · {a.action} · {a.entityType}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0">{a.module}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
