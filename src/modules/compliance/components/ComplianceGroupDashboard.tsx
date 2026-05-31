/**
 * ComplianceGroupDashboard — Phase 2.1
 * Holding-level consolidated compliance view: group score, status breakdown,
 * per-brand table, and brand-tagged obligations. Ported from DawinOS.
 */

import { Button } from '@/core/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Loader2, AlertTriangle, Clock } from 'lucide-react';
import { ComplianceScoreCard } from './ComplianceScoreCard';
import { StatusBreakdown } from './StatusBreakdown';
import { RagBadge } from '@/shared/components/data-display';
import { REGULATORY_BODY_LABELS, OBLIGATION_PRIORITY_LABELS } from '../types/constants';
import { useComplianceGroupDashboard } from '../hooks/useComplianceGroupDashboard';

const PRIORITY_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  critical: 'red',
  high: 'amber',
  medium: 'blue',
  low: 'na',
};

function SubsidiaryChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--fg-tertiary)' }}>
      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {name}
    </span>
  );
}

export function ComplianceGroupDashboard() {
  const { data, loading, error, refresh } = useComplianceGroupDashboard();

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: 'var(--accent)' }} />
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

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        No operating brands to consolidate.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1>Group Compliance Overview</h1>
        <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
          Consolidated regulatory posture across {data.subsidiaryCount} operating{' '}
          {data.subsidiaryCount === 1 ? 'brand' : 'brands'}
        </p>
      </div>

      {/* Score + breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComplianceScoreCard score={data.score} totalDocuments={data.totalDocuments} />
        <StatusBreakdown breakdown={data.statusBreakdown} total={data.totalDocuments} />
      </div>

      {/* Per-brand breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[14.5px]">By Brand</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs border-b" style={{ color: 'var(--fg-tertiary)' }}>
                  <th className="text-left font-medium py-2 pr-4">Brand</th>
                  <th className="text-right font-medium py-2 px-3">Score</th>
                  <th className="text-right font-medium py-2 px-3">Documents</th>
                  <th className="text-right font-medium py-2 px-3">Expiring</th>
                  <th className="text-right font-medium py-2 pl-3">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.bySubsidiary.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <SubsidiaryChip name={row.name} color={row.color} />
                    </td>
                    <td className="text-right py-2 px-3 font-medium">{row.score}</td>
                    <td className="text-right py-2 px-3">{row.totalDocuments}</td>
                    <td className="text-right py-2 px-3">
                      {row.expiringCount > 0 ? (
                        <span style={{ color: 'var(--rag-amber)' }}>{row.expiringCount}</span>
                      ) : (
                        0
                      )}
                    </td>
                    <td className="text-right py-2 pl-3">
                      {row.overdueCount > 0 ? (
                        <span style={{ color: 'var(--rag-red)' }}>{row.overdueCount}</span>
                      ) : (
                        0
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Overdue obligations */}
      {data.overdueObligations.length > 0 && (
        <Card style={{ borderColor: 'var(--rag-red)' }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[14.5px]" style={{ color: 'var(--rag-red)' }}>
              <AlertTriangle className="h-4 w-4" />
              Overdue Obligations ({data.overdueObligations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.overdueObligations.map((o) => (
              <div
                key={`${o.subsidiaryId}-${o.id}`}
                className="flex items-center justify-between rounded-[8px] px-3 py-2"
                style={{ backgroundColor: 'var(--rag-red-soft)', borderLeft: '3px solid var(--rag-red)' }}
              >
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--fg-primary)' }}>{o.title}</p>
                  <p className="text-[11.5px] flex items-center gap-2" style={{ color: 'var(--fg-tertiary)' }}>
                    <SubsidiaryChip name={o.subsidiaryName} color={o.subsidiaryColor} />
                    · {REGULATORY_BODY_LABELS[o.regulatoryBody]} · Due:{' '}
                    {o.nextDueDate?.toDate().toLocaleDateString()}
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

      {/* Upcoming obligations */}
      {data.upcomingObligations.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-[14.5px]">
              <Clock className="h-4 w-4" style={{ color: 'var(--rag-amber)' }} />
              Upcoming Obligations ({data.upcomingObligations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {data.upcomingObligations.map((o) => (
              <div
                key={`${o.subsidiaryId}-${o.id}`}
                className="flex items-center justify-between rounded-[8px] px-3 py-2 border"
                style={{ borderColor: 'var(--border-default)' }}
              >
                <div>
                  <p className="text-[13px] font-medium" style={{ color: 'var(--fg-primary)' }}>{o.title}</p>
                  <p className="text-[11.5px] flex items-center gap-2" style={{ color: 'var(--fg-tertiary)' }}>
                    <SubsidiaryChip name={o.subsidiaryName} color={o.subsidiaryColor} />
                    · {REGULATORY_BODY_LABELS[o.regulatoryBody]} · Due:{' '}
                    {o.nextDueDate?.toDate().toLocaleDateString()}
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

      {data.totalDocuments === 0 &&
        data.overdueObligations.length === 0 &&
        data.upcomingObligations.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No compliance data across the group yet.
          </p>
        )}
    </div>
  );
}

export default ComplianceGroupDashboard;
