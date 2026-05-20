import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { useCapitalDashboard } from '../hooks/useCapitalDashboard';
import { ScoreGauge } from '../components/shared/ScoreGauge';
import { StatusChip } from '../components/shared/StatusChip';
import { formatCurrency } from '../components/shared/CurrencyDisplay';
import {
  NEED_TYPE_LABELS,
  NEED_TYPE_COLORS,
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGE_COLORS,
  FACILITY_STATUS_LABELS,
  FACILITY_STATUS_COLORS,
  URGENCY_LABELS,
} from '../constants/capital.constants';
import { useNavigate } from 'react-router-dom';
import { KPICard } from '@/shared/components/data-display';

// TODO: Replace with actual company ID from auth context
const COMPANY_ID = 'default';

export default function CapitalDashboardPage() {
  const { data, loading, error, refresh } = useCapitalDashboard(COMPANY_ID);
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={refresh} variant="outline">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Capital Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your capital position, readiness, and pipeline
          </p>
        </div>
        <Button onClick={() => navigate('/capital/readiness')}>
          Assess Readiness
        </Button>
      </div>

      {/* Top metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6 flex flex-col items-center">
            <ScoreGauge
              score={data?.readinessScore ?? 0}
              label="Readiness Score"
              size="md"
            />
          </CardContent>
        </Card>

        <KPICard
          label="Active Capital Needs"
          value={data?.activeNeeds.length ?? 0}
          delta={`${data?.activeNeeds.filter(n => n.urgency === 'immediate').length ?? 0} immediate`}
        />

        <KPICard
          label="Outstanding Debt"
          value={formatCurrency(data?.totalOutstandingDebt ?? 0, 'UGX', true)}
          delta={`of ${formatCurrency(data?.totalFacilityLimit ?? 0, 'UGX', true)} total limit`}
        />

        <KPICard
          label="Pipeline Applications"
          value={data?.pendingApplications.length ?? 0}
          delta="in progress"
        />
      </div>

      {/* Active needs and applications */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Active Capital Needs</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/capital/needs')}
              >
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data?.activeNeeds.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No active capital needs identified
              </p>
            ) : (
              <div className="space-y-3">
                {data?.activeNeeds.slice(0, 5).map(need => (
                  <div
                    key={need.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{need.title}</div>
                      <div className="flex gap-2">
                        <StatusChip
                          label={NEED_TYPE_LABELS[need.type]}
                          color={NEED_TYPE_COLORS[need.type]}
                        />
                        <span className="text-xs text-muted-foreground">
                          {URGENCY_LABELS[need.urgency]}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">
                        {formatCurrency(need.amountRequired, need.currency, true)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Application Pipeline</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/capital/applications')}
              >
                View all
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {data?.pendingApplications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No pending applications
              </p>
            ) : (
              <div className="space-y-3">
                {data?.pendingApplications.slice(0, 5).map(app => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/capital/applications/${app.id}`)}
                  >
                    <div className="space-y-1">
                      <div className="font-medium text-sm">{app.provider}</div>
                      <StatusChip
                        label={APPLICATION_STAGE_LABELS[app.stage]}
                        color={APPLICATION_STAGE_COLORS[app.stage]}
                      />
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">
                        {formatCurrency(app.amountRequested, app.currency, true)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active facilities */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Active Facilities</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/capital/facilities')}
            >
              View all
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data?.activeFacilities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No active facilities
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.activeFacilities.map(facility => (
                <div
                  key={facility.id}
                  className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/capital/facilities/${facility.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{facility.facilityName}</span>
                    <StatusChip
                      label={FACILITY_STATUS_LABELS[facility.status]}
                      color={FACILITY_STATUS_COLORS[facility.status]}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">{facility.provider}</div>
                  <div className="flex justify-between text-sm">
                    <span>Outstanding</span>
                    <span className="font-semibold">
                      {formatCurrency(facility.outstandingBalance, facility.currency, true)}
                    </span>
                  </div>
                  {facility.isRevolving && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Utilization</span>
                        <span>
                          {Math.round(
                            ((facility.currentUtilization ?? 0) / facility.facilityLimit) * 100,
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-amber-500 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, ((facility.currentUtilization ?? 0) / facility.facilityLimit) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
