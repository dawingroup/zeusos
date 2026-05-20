import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { StatusChip } from '../components/shared/StatusChip';
import { formatCurrency } from '../components/shared/CurrencyDisplay';
import {
  APPLICATION_STAGE_LABELS,
  APPLICATION_STAGE_COLORS,
  PRODUCT_TYPE_LABELS,
  APPLICATION_STAGES,
  INTEREST_TYPE_LABELS,
  REPAYMENT_FREQUENCY_LABELS,
} from '../constants/capital.constants';
import { applicationService } from '../services/applicationService';
import type { CapitalApplication } from '../types/capital.types';

const COMPANY_ID = 'default';

export default function ApplicationDetailPage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const [app, setApp] = useState<CapitalApplication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!applicationId) return;
    setLoading(true);
    applicationService
      .getApplication(COMPANY_ID, applicationId)
      .then(setApp)
      .finally(() => setLoading(false));
  }, [applicationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Application not found</p>
        <Button onClick={() => navigate('/capital/applications')} variant="outline">
          Back to Applications
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/capital/applications')}>
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{app.provider}</h1>
          <p className="text-muted-foreground">
            {PRODUCT_TYPE_LABELS[app.productType]} —{' '}
            {formatCurrency(app.amountRequested, app.currency)}
          </p>
        </div>
        <StatusChip
          label={APPLICATION_STAGE_LABELS[app.stage]}
          color={APPLICATION_STAGE_COLORS[app.stage]}
        />
      </div>

      {/* Stage progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 overflow-x-auto">
            {APPLICATION_STAGES.filter(
              s => !['declined', 'withdrawn'].includes(s),
            ).map(stage => {
              const isCurrent = app.stage === stage;
              const isPast = APPLICATION_STAGES.indexOf(stage) < APPLICATION_STAGES.indexOf(app.stage);
              return (
                <div
                  key={stage}
                  className={`flex-1 min-w-[80px] text-center px-2 py-2 rounded text-xs font-medium ${
                    isCurrent
                      ? 'text-white'
                      : isPast
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-muted text-muted-foreground'
                  }`}
                  style={isCurrent ? { backgroundColor: APPLICATION_STAGE_COLORS[stage] } : undefined}
                >
                  {APPLICATION_STAGE_LABELS[stage]}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Terms */}
        {(app.proposedTerms || app.approvedTerms) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {app.approvedTerms ? 'Approved Terms' : 'Proposed Terms'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const terms = app.approvedTerms || app.proposedTerms!;
                return (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Interest Rate</span>
                      <span className="font-medium">{terms.interestRate}% p.a.</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Type</span>
                      <span className="font-medium">{INTEREST_TYPE_LABELS[terms.interestType]}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Tenor</span>
                      <span className="font-medium">{terms.tenorMonths} months</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Repayment</span>
                      <span className="font-medium">
                        {REPAYMENT_FREQUENCY_LABELS[terms.repaymentFrequency]}
                      </span>
                    </div>
                    {terms.processingFee !== undefined && (
                      <div>
                        <span className="text-xs text-muted-foreground block">Processing Fee</span>
                        <span className="font-medium">{terms.processingFee}%</span>
                      </div>
                    )}
                    {terms.gracePeriodMonths !== undefined && terms.gracePeriodMonths > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground block">Grace Period</span>
                        <span className="font-medium">{terms.gracePeriodMonths} months</span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Documents ({app.documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {app.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No documents uploaded yet
              </p>
            ) : (
              <div className="space-y-2">
                {app.documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-2 border rounded text-sm"
                  >
                    <span>{doc.name}</span>
                    <StatusChip
                      label={doc.status}
                      variant={doc.status === 'accepted' ? 'default' : 'outline'}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Communication log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Communication Log ({app.communications.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {app.communications.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No communications logged yet
            </p>
          ) : (
            <div className="space-y-3">
              {app.communications.map(comm => (
                <div key={comm.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <StatusChip label={comm.type} variant="outline" />
                    {comm.contactPerson && (
                      <span className="text-xs text-muted-foreground">{comm.contactPerson}</span>
                    )}
                  </div>
                  <p className="text-sm">{comm.summary}</p>
                  {comm.outcome && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Outcome: {comm.outcome}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stage history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stage History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {app.stageHistory.map((change, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm p-2 border-l-2"
                style={{ borderColor: APPLICATION_STAGE_COLORS[change.to as keyof typeof APPLICATION_STAGE_COLORS] || '#ccc' }}
              >
                <StatusChip
                  label={APPLICATION_STAGE_LABELS[change.to as keyof typeof APPLICATION_STAGE_LABELS] || change.to}
                  color={APPLICATION_STAGE_COLORS[change.to as keyof typeof APPLICATION_STAGE_COLORS]}
                />
                {change.notes && (
                  <span className="text-muted-foreground">{change.notes}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
