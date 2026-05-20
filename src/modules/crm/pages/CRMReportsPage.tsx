/**
 * CRM Reports Page
 * Pipeline analytics, conversion rates, and revenue metrics
 */

import { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  AlertCircle,
} from 'lucide-react';
import { getDeals } from '../services/crmDealService';
import { calculatePipelineSummary } from '../services/crmPipelineService';
import {
  CRM_DEAL_STAGE_ORDER,
  CRM_DEAL_STAGE_LABELS,
  CRM_DEAL_STAGE_COLORS,
  CRM_DEAL_STAGE_DOT_COLORS,
  CRM_ACTIVE_DEAL_STAGES,
} from '../constants/crm.constants';
import type { CRMDeal, CRMDealStage, PipelineSummary } from '../types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

function formatCurrency(value: number, currency = 'UGX'): string {
  if (value >= 1_000_000_000) return `${currency} ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${currency} ${(value / 1_000).toFixed(0)}K`;
  return `${currency} ${value.toLocaleString()}`;
}

function StageBar({
  stage,
  count,
  totalValue,
  maxCount,
}: {
  stage: CRMDealStage;
  count: number;
  totalValue: number;
  maxCount: number;
}) {
  const dotColor = CRM_DEAL_STAGE_DOT_COLORS[stage] || 'bg-gray-400';
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-28 flex-shrink-0 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <span className="text-xs text-gray-600 truncate">{CRM_DEAL_STAGE_LABELS[stage]}</span>
      </div>
      <div className="flex-1">
        <div className="h-6 bg-gray-50 rounded overflow-hidden">
          <div
            className={`h-full rounded ${dotColor} opacity-70 transition-all duration-500`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
      </div>
      <div className="w-24 flex-shrink-0 text-right">
        <span className="text-sm font-semibold text-gray-900">{count}</span>
        <span className="text-xs text-gray-400 ml-1">({formatCurrency(totalValue)})</span>
      </div>
    </div>
  );
}

export default function CRMReportsPage() {
  const [deals, setDeals] = useState<CRMDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getDeals();
        setDeals(data);
      } catch (err) {
        console.error('Failed to load deals for report:', err);
        setError('Failed to load pipeline data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const summary: PipelineSummary | null = useMemo(() => {
    if (deals.length === 0) return null;
    return calculatePipelineSummary(deals);
  }, [deals]);

  // Win/loss breakdown
  const winLoss = useMemo(() => {
    const won = deals.filter((d) => d.stage === 'won');
    const lost = deals.filter((d) => d.stage === 'lost');
    const active = deals.filter((d) => CRM_ACTIVE_DEAL_STAGES.includes(d.stage));
    return { won, lost, active };
  }, [deals]);

  // Find max count for bar scaling
  const maxStageCount = useMemo(() => {
    if (!summary) return 1;
    return Math.max(1, ...Object.values(summary.byStage).map((s) => s.count));
  }, [summary]);

  // Top deals by value
  const topDeals = useMemo(() => {
    return [...deals]
      .filter((d) => CRM_ACTIVE_DEAL_STAGES.includes(d.stage))
      .sort((a, b) => b.estimatedValue - a.estimatedValue)
      .slice(0, 5);
  }, [deals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!summary || deals.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Reports & Forecast</h2>
          <p className="text-sm text-gray-500">Pipeline analytics, conversion rates, and revenue forecasting.</p>
        </div>
        <div className="bg-white rounded-lg border p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-600 mb-1">No data yet</h3>
          <p className="text-xs text-gray-400">Reports will populate once deals are created in the pipeline.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Reports & Forecast</h2>
        <p className="text-sm text-gray-500">
          Pipeline analytics across {summary.totalDeals} deal{summary.totalDeals !== 1 ? 's' : ''}.
        </p>
      </div>

      {/* KPI Cards */}
      <KPIGrid cols={4}>
        <KPICard
          label="Pipeline Value"
          value={formatCurrency(summary.totalPipelineValue)}
          delta={`Weighted: ${formatCurrency(summary.weightedPipelineValue)}`}
        />
        <KPICard
          label="Conversion Rate"
          value={`${summary.conversionRate.toFixed(1)}%`}
          delta={`${winLoss.won.length} won / ${winLoss.won.length + winLoss.lost.length} closed`}
        />
        <KPICard
          label="Avg Deal Size"
          value={formatCurrency(summary.averageDealSize)}
          delta={`Based on ${winLoss.won.length} won deals`}
        />
        <KPICard
          label="Avg Sales Cycle"
          value={summary.averageSalesCycle > 0 ? `${Math.round(summary.averageSalesCycle)} days` : '-'}
          delta="From creation to close"
        />
      </KPIGrid>

      {/* Period Performance */}
      <KPIGrid cols={3}>
        <KPICard label="Won This Month" value={summary.wonThisMonth} trend="up" />
        <KPICard label="Won This Quarter" value={summary.wonThisQuarter} trend="up" />
        <KPICard
          label="Lost This Month"
          value={summary.lostThisMonth}
          trend={summary.lostThisMonth > 0 ? 'down' : undefined}
        />
      </KPIGrid>

      {/* Pipeline Funnel / Stage Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Pipeline by Stage</h3>
        <div className="space-y-3">
          {CRM_DEAL_STAGE_ORDER.map((stage) => {
            const metrics = summary.byStage[stage];
            if (!metrics) return null;
            return (
              <StageBar
                key={stage}
                stage={stage}
                count={metrics.count}
                totalValue={metrics.totalValue}
                maxCount={maxStageCount}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage Age Analysis */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Average Days in Stage</h3>
          <div className="space-y-3">
            {CRM_DEAL_STAGE_ORDER.filter((s) => CRM_ACTIVE_DEAL_STAGES.includes(s)).map((stage) => {
              const metrics = summary.byStage[stage];
              if (!metrics || metrics.count === 0) return null;
              const isStale = metrics.averageAge > 30;
              return (
                <div key={stage} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${CRM_DEAL_STAGE_DOT_COLORS[stage]}`} />
                    <span className="text-sm text-gray-700">{CRM_DEAL_STAGE_LABELS[stage]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {isStale && <AlertCircle className="h-3 w-3 text-orange-400" />}
                    <span className={`text-sm font-medium ${isStale ? 'text-orange-600' : 'text-gray-900'}`}>
                      {Math.round(metrics.averageAge)} days
                    </span>
                    <span className="text-xs text-gray-400">({metrics.count})</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Deals */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Top Active Deals by Value</h3>
          {topDeals.length === 0 ? (
            <p className="text-sm text-gray-400">No active deals</p>
          ) : (
            <div className="space-y-3">
              {topDeals.map((deal, idx) => (
                <div key={deal.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-5 text-right">{idx + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{deal.title}</div>
                    <div className="text-xs text-gray-400">{deal.customerName}</div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${CRM_DEAL_STAGE_COLORS[deal.stage] || 'bg-gray-100 text-gray-500'}`}>
                    {CRM_DEAL_STAGE_LABELS[deal.stage]}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                    {formatCurrency(deal.estimatedValue, deal.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Win/Loss Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Deal Outcomes</h3>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl font-bold text-green-600">{winLoss.won.length}</div>
            <div className="text-xs text-gray-500 mt-1">Won</div>
            <div className="text-xs text-gray-400">
              {formatCurrency(winLoss.won.reduce((s, d) => s + d.estimatedValue, 0))}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">{winLoss.active.length}</div>
            <div className="text-xs text-gray-500 mt-1">Active</div>
            <div className="text-xs text-gray-400">
              {formatCurrency(winLoss.active.reduce((s, d) => s + d.estimatedValue, 0))}
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-red-600">{winLoss.lost.length}</div>
            <div className="text-xs text-gray-500 mt-1">Lost</div>
            <div className="text-xs text-gray-400">
              {formatCurrency(winLoss.lost.reduce((s, d) => s + d.estimatedValue, 0))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
