/**
 * Investment Metrics - Key investment KPIs card
 */

import { TrendingUp, Briefcase, CheckCircle, Target } from 'lucide-react';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface InvestmentMetricsProps {
  metrics: {
    totalDeployed: { amount: number; currency: string };
    averageIRR: number;
    averageMOIC: number;
    activeDeals: number;
    closedDeals: number;
    conversionRate: number;
  };
}

function formatCurrency(amount: number): string {
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

export function InvestmentMetrics({ metrics }: InvestmentMetricsProps) {
  const items = [
    {
      label: 'Capital Deployed',
      value: formatCurrency(metrics.totalDeployed.amount),
      icon: Briefcase,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Average IRR',
      value: `${(metrics.averageIRR * 100).toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Average MOIC',
      value: `${metrics.averageMOIC.toFixed(2)}x`,
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      label: 'Active Deals',
      value: metrics.activeDeals.toString(),
      subValue: `${metrics.closedDeals} closed`,
      icon: Briefcase,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100'
    },
    {
      label: 'Win Rate',
      value: `${metrics.conversionRate.toFixed(0)}%`,
      icon: CheckCircle,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100'
    }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-4">Investment Performance</h3>
      
      <div className="space-y-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${item.bgColor}`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{item.label}</p>
                  {item.subValue && (
                    <p className="text-xs text-gray-400">{item.subValue}</p>
                  )}
                </div>
              </div>
              <p className="text-xl font-semibold">{item.value}</p>
            </div>
          );
        })}
      </div>
      
      {/* Quick Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <KPIGrid cols={2}>
          <KPICard
            label="Total Deals"
            value={metrics.activeDeals + metrics.closedDeals}
          />
          <KPICard
            label="Deal Score"
            value={((metrics.averageIRR * metrics.averageMOIC) * 10).toFixed(0)}
          />
        </KPIGrid>
      </div>
    </div>
  );
}

export default InvestmentMetrics;
