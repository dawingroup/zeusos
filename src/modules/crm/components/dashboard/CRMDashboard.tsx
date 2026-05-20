/**
 * CRMDashboardStats
 * KPI strip for the CRM pipeline overview — migrated to shared <KPICard>.
 */

import { AlertCircle } from 'lucide-react';
import { KPICard, KPIGrid, EmptyStateV2 } from '@/shared/components/data-display';
import type { PipelineSummary } from '../../types';

interface CRMDashboardProps {
  summary: PipelineSummary | null;
  loading: boolean;
}

function formatCurrency(value: number, abbreviated = true): string {
  if (abbreviated) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toLocaleString();
}

export function CRMDashboardStats({ summary, loading }: CRMDashboardProps) {
  if (loading) {
    return (
      <KPIGrid>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[10px] border bg-[var(--bg-surface)] animate-pulse"
            style={{
              padding: 'var(--pad-card)',
              borderColor: 'var(--border-subtle)',
              minHeight: 96,
            }}
          />
        ))}
      </KPIGrid>
    );
  }

  if (!summary) {
    return (
      <div
        className="rounded-[10px] border bg-[var(--bg-surface)]"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <EmptyStateV2
          icon={<AlertCircle className="h-5 w-5" />}
          title="No deal data yet"
          message="Create your first deal to see pipeline stats."
          size="compact"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KPICard
        label="Active Deals"
        value={summary.totalDeals}
        delta={`${summary.totalDeals - summary.wonThisMonth - summary.lostThisMonth} in pipeline`}
        sparkColor="var(--rag-blue)"
      />
      <KPICard
        label="Pipeline Value"
        value={formatCurrency(summary.totalPipelineValue)}
        delta={`Weighted: ${formatCurrency(summary.weightedPipelineValue)}`}
        sparkColor="var(--accent)"
      />
      <KPICard
        label="Won This Month"
        value={summary.wonThisMonth}
        delta={`${summary.wonThisQuarter} this quarter`}
        trend={summary.wonThisMonth > 0 ? 'up' : 'flat'}
        sparkColor="var(--rag-green)"
      />
      <KPICard
        label="Conversion Rate"
        value={`${summary.conversionRate.toFixed(0)}`}
        unit="%"
        delta="Won / closed"
        sparkColor="var(--boysenberry)"
      />
      <KPICard
        label="Avg Deal Size"
        value={formatCurrency(summary.averageDealSize)}
        delta="Won deals avg"
        sparkColor="var(--rag-amber)"
      />
      <KPICard
        label="Avg Sales Cycle"
        value={`${summary.averageSalesCycle.toFixed(0)}`}
        unit="d"
        delta="Lead to won"
        sparkColor="var(--seafoam)"
      />
    </div>
  );
}
