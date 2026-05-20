/**
 * Deals Funnel - Visual representation of deal flow through stages
 */

import { useMemo } from 'react';

type DealStage = 
  | 'screening'
  | 'initial_review'
  | 'preliminary_dd'
  | 'detailed_dd'
  | 'ic_memo'
  | 'ic_approval'
  | 'negotiation'
  | 'documentation'
  | 'closing'
  | 'post_closing';

const DEAL_STAGES: DealStage[] = [
  'screening',
  'initial_review',
  'preliminary_dd',
  'detailed_dd',
  'ic_memo',
  'ic_approval',
  'negotiation',
  'documentation',
  'closing',
  'post_closing'
];

interface StageMetrics {
  count: number;
  totalValue: { amount: number; currency: string };
  weightedValue: { amount: number; currency: string };
  averageDaysInStage: number;
}

interface PipelineAnalytics {
  byStage: Record<string, StageMetrics>;
  conversionRate: number;
}

interface DealsFunnelProps {
  analytics: PipelineAnalytics;
  onStageClick: (stage: DealStage) => void;
}

function formatCurrency(amount: number, _currency: string): string {
  if (amount >= 1000000000) {
    return `$${(amount / 1000000000).toFixed(1)}B`;
  }
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function getStageColor(index: number): string {
  const colors = [
    'bg-gray-500',      // screening
    'bg-blue-500',      // initial_review
    'bg-indigo-500',    // preliminary_dd
    'bg-violet-500',    // detailed_dd
    'bg-purple-500',    // ic_memo
    'bg-fuchsia-500',   // ic_approval
    'bg-pink-500',      // negotiation
    'bg-rose-500',      // documentation
    'bg-emerald-600',   // closing
    'bg-green-700'      // post_closing
  ];
  return colors[index] || 'bg-gray-500';
}

export function DealsFunnel({ analytics, onStageClick }: DealsFunnelProps) {
  const stageData = useMemo(() => {
    const maxCount = Math.max(
      ...DEAL_STAGES.map(stage => analytics.byStage[stage]?.count || 0)
    );
    
    return DEAL_STAGES.map((stage, index) => {
      const stageMetrics = analytics.byStage[stage] || {
        count: 0,
        totalValue: { amount: 0, currency: 'USD' },
        weightedValue: { amount: 0, currency: 'USD' },
        averageDaysInStage: 0
      };
      
      const widthPercentage = stageMetrics.count > 0 
        ? Math.max(30, (stageMetrics.count / maxCount) * 100)
        : 30;
      
      return {
        stage,
        label: stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        count: stageMetrics.count,
        value: stageMetrics.totalValue,
        weightedValue: stageMetrics.weightedValue,
        avgDays: stageMetrics.averageDaysInStage,
        widthPercentage,
        color: getStageColor(index)
      };
    });
  }, [analytics]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Deal Pipeline Funnel</h3>
      
      <div className="space-y-2">
        {stageData.map((stage) => (
          <button
            key={stage.stage}
            className="w-full text-left group"
            onClick={() => onStageClick(stage.stage)}
          >
            <div 
              className={`relative h-12 ${stage.color} rounded-lg transition-all group-hover:opacity-90 group-hover:shadow-md`}
              style={{ 
                width: `${stage.widthPercentage}%`, 
                marginLeft: `${(100 - stage.widthPercentage) / 2}%` 
              }}
            >
              <div className="absolute inset-0 flex items-center justify-between px-4 text-white">
                <span className="font-medium truncate text-sm">{stage.label}</span>
                <span className="flex items-center gap-2 text-sm">
                  <span className="opacity-90">{stage.count} deals</span>
                  <span className="font-semibold">
                    {formatCurrency(stage.value.amount, stage.value.currency)}
                  </span>
                </span>
              </div>
            </div>
            <div className="flex justify-center text-xs text-gray-400 mt-1">
              Avg. {stage.avgDays} days • Weighted: {formatCurrency(stage.weightedValue.amount, stage.weightedValue.currency)}
            </div>
          </button>
        ))}
      </div>
      
      {/* Conversion Rate */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Screening → Closing Conversion</span>
          <span className="font-semibold">{analytics.conversionRate.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export default DealsFunnel;
