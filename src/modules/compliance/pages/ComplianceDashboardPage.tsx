/**
 * ComplianceDashboardPage
 * Score card, expiry timeline, status breakdown, quick actions.
 */

import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Loader2, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { useComplianceDashboard } from '../hooks/useComplianceDashboard';
import { ComplianceScoreCard } from '../components/ComplianceScoreCard';
import { ExpiryTimeline } from '../components/ExpiryTimeline';
import { StatusBreakdown } from '../components/StatusBreakdown';
import { REGULATORY_BODY_LABELS, OBLIGATION_PRIORITY_LABELS } from '../types/constants';
import { RagBadge, Banner, EmptyStateV2 } from '@/shared/components/data-display';

const PRIORITY_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  critical: 'red',
  high: 'amber',
  medium: 'blue',
  low: 'na',
};

// TODO: Replace with actual company context
const COMPANY_ID = 'default';

export function ComplianceDashboardPage() {
  const { data, loading, error, refresh } = useComplianceDashboard(COMPANY_ID);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-6 max-w-[1640px] mx-auto">
        <Banner
          tone="danger"
          title="Couldn't load compliance data"
          message={error}
          actions={
            <Button variant="outline" size="sm" onClick={refresh}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>System · Compliance</div>
          <h1 className="display">Compliance dashboard</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Document registry, obligations, and regulatory scorecard
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Top Row: Score + Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <ComplianceScoreCard score={data.score} totalDocuments={data.totalDocuments} />
        <StatusBreakdown breakdown={data.statusBreakdown} total={data.totalDocuments} />
        <ExpiryTimeline documents={data.upcomingExpirations} />
      </div>

      {/* Overdue Obligations */}
      {data.overdueObligations.length > 0 && (
        <Card style={{ borderColor: 'var(--rag-red)' }}>
          <CardHeader className="pb-2">
            <CardTitle
              className="flex items-center gap-2 text-[14.5px]"
              style={{ color: 'var(--rag-red)' }}
            >
              <AlertTriangle className="h-4 w-4" />
              Overdue Obligations ({data.overdueObligations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.overdueObligations.map(o => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-[8px] px-3 py-2"
                style={{
                  backgroundColor: 'var(--rag-red-soft)',
                  borderLeft: '3px solid var(--rag-red)',
                }}
              >
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--fg-primary)' }}>{o.title}</p>
                  <p className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
                    {REGULATORY_BODY_LABELS[o.regulatoryBody]} · Due: {o.nextDueDate?.toDate().toLocaleDateString()}
                  </p>
                </div>
                <RagBadge tone={PRIORITY_TONE[o.priority] ?? 'na'}>
                  {OBLIGATION_PRIORITY_LABELS[o.priority]}
                </RagBadge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Obligations */}
      {data.upcomingObligations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[14.5px]">
              <Clock className="h-4 w-4" style={{ color: 'var(--rag-amber)' }} />
              Upcoming Obligations ({data.upcomingObligations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.upcomingObligations.map(o => (
              <div
                key={o.id}
                className="flex items-center justify-between rounded-[8px] px-3 py-2 border"
                style={{ borderColor: 'var(--border-default)' }}
              >
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--fg-primary)' }}>{o.title}</p>
                  <p className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>
                    {REGULATORY_BODY_LABELS[o.regulatoryBody]} · Due: {o.nextDueDate?.toDate().toLocaleDateString()}
                  </p>
                </div>
                <RagBadge tone={PRIORITY_TONE[o.priority] ?? 'na'}>
                  {OBLIGATION_PRIORITY_LABELS[o.priority]}
                </RagBadge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {data.totalDocuments === 0 && data.overdueObligations.length === 0 && (
        <div className="rounded-[10px] border bg-[var(--bg-surface)]" style={{ borderColor: 'var(--border-subtle)' }}>
          <EmptyStateV2
            title="No compliance data yet"
            message="Start by adding documents in the Documents tab or setting up obligations in the Obligations tab."
          />
        </div>
      )}
    </div>
  );
}
