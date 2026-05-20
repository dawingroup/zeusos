/**
 * Return Metrics Card - Key financial metrics display
 */

import { TrendingUp, DollarSign, Target, Clock } from 'lucide-react';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface ReturnMetrics {
  projectIRR: number;
  equityIRR: number;
  moic: number;
  npvAtWacc: number;
  paybackPeriod?: number;
}

interface ReturnMetricsCardProps {
  metrics: ReturnMetrics;
  compact?: boolean;
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export function ReturnMetricsCard({ metrics, compact = false }: ReturnMetricsCardProps) {
  const items = [
    {
      label: 'Project IRR',
      value: `${metrics.projectIRR.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Equity IRR',
      value: `${metrics.equityIRR.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'MOIC',
      value: `${metrics.moic.toFixed(2)}x`,
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      label: 'NPV @ WACC',
      value: formatCurrency(metrics.npvAtWacc),
      icon: DollarSign,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100'
    },
  ];

  if (metrics.paybackPeriod) {
    items.push({
      label: 'Payback Period',
      value: `${metrics.paybackPeriod.toFixed(1)} yrs`,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100'
    });
  }

  if (compact) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold mb-3 text-gray-700">Return Metrics</h3>
        <div className="space-y-2">
          {items.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${item.color}`} />
                  <span className="text-sm text-gray-500">{item.label}</span>
                </div>
                <span className="font-semibold">{item.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Return Metrics</h3>

      <KPIGrid cols={4}>
        {items.map((item) => (
          <KPICard key={item.label} label={item.label} value={item.value} />
        ))}
      </KPIGrid>
    </div>
  );
}

export default ReturnMetricsCard;
