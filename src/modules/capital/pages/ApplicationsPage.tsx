import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { useApplications } from '../hooks/useApplications';
import { StatusChip } from '../components/shared/StatusChip';
import { formatCurrency } from '../components/shared/CurrencyDisplay';
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGE_COLORS,
  PRODUCT_TYPE_LABELS,
  ACTIVE_APPLICATION_STAGES,
} from '../constants/capital.constants';
import { useNavigate } from 'react-router-dom';

const COMPANY_ID = 'default';

export default function ApplicationsPage() {
  const { applications, loading } = useApplications(COMPANY_ID);
  const navigate = useNavigate();

  const activeApps = applications.filter(a =>
    ACTIVE_APPLICATION_STAGES.includes(a.stage),
  );
  const closedApps = applications.filter(
    a => !ACTIVE_APPLICATION_STAGES.includes(a.stage),
  );

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Capital Applications</h1>
          <p
            className="mt-1 text-[12.5px]"
            style={{ color: 'var(--fg-secondary)' }}
          >
            Track your capital applications across banks, DFIs, and other providers
          </p>
        </div>
        <Button variant="primary" size="sm">New Application</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div
            className="animate-spin rounded-full h-7 w-7 border-2 border-t-transparent"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <>
          {/* Pipeline summary */}
          <div className="flex flex-wrap gap-2">
            {ACTIVE_APPLICATION_STAGES.map(stage => {
              const count = applications.filter(a => a.stage === stage).length;
              if (count === 0) return null;
              return (
                <div
                  key={stage}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
                  style={{
                    backgroundColor: `${APPLICATION_STAGE_COLORS[stage]}20`,
                    color: APPLICATION_STAGE_COLORS[stage],
                  }}
                >
                  <span className="font-medium">{count}</span>
                  <span>{APPLICATION_STAGE_LABELS[stage]}</span>
                </div>
              );
            })}
          </div>

          {/* Active applications */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Active Applications ({activeApps.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeApps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No active applications. Start a new application to begin tracking.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeApps.map(app => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/capital/applications/${app.id}`)}
                    >
                      <div className="space-y-1.5">
                        <div className="font-medium">{app.provider}</div>
                        <div className="flex gap-2 flex-wrap">
                          <StatusChip
                            label={APPLICATION_STAGE_LABELS[app.stage]}
                            color={APPLICATION_STAGE_COLORS[app.stage]}
                          />
                          <StatusChip
                            label={PRODUCT_TYPE_LABELS[app.productType]}
                            variant="outline"
                          />
                        </div>
                        {app.notes && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {app.notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <div className="text-lg font-bold">
                          {formatCurrency(app.amountRequested, app.currency, true)}
                        </div>
                        {app.expectedDecisionDate && (
                          <span className="text-xs text-muted-foreground">
                            Decision expected soon
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Closed applications */}
          {closedApps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Closed Applications ({closedApps.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {closedApps.map(app => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-3 border rounded-lg opacity-75"
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-sm">{app.provider}</div>
                        <div className="flex gap-2">
                          <StatusChip
                            label={APPLICATION_STAGE_LABELS[app.stage]}
                            color={APPLICATION_STAGE_COLORS[app.stage]}
                          />
                          <StatusChip
                            label={PRODUCT_TYPE_LABELS[app.productType]}
                            variant="outline"
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">
                          {formatCurrency(app.amountRequested, app.currency, true)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
