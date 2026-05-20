/**
 * Pipeline Summary - Key metrics cards for dashboard
 */

import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Clock,
  CheckCircle 
} from 'lucide-react';

interface PipelineAnalytics {
  totalPipelineValue: { amount: number; currency: string };
  weightedPipelineValue: { amount: number; currency: string };
  averageDealSize: { amount: number; currency: string };
  ytdClosings: { amount: number; currency: string };
  totalDeals: number;
  pipelineChange?: number;
  dealSizeChange?: number;
  averageDaysToClose: number;
  winRate: number;
  winRateChange?: number;
  ytdClosingsCount: number;
}

interface PipelineSummaryProps {
  analytics: PipelineAnalytics;
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

function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function PipelineSummary({ analytics }: PipelineSummaryProps) {
  const metrics = [
    {
      label: 'Total Pipeline',
      value: formatCurrency(analytics.totalPipelineValue.amount, analytics.totalPipelineValue.currency),
      change: analytics.pipelineChange,
      icon: DollarSign,
      color: 'blue'
    },
    {
      label: 'Weighted Pipeline',
      value: formatCurrency(analytics.weightedPipelineValue.amount, analytics.weightedPipelineValue.currency),
      subtitle: `${analytics.totalDeals} deals`,
      icon: Target,
      color: 'green'
    },
    {
      label: 'Avg. Deal Size',
      value: formatCurrency(analytics.averageDealSize.amount, analytics.averageDealSize.currency),
      change: analytics.dealSizeChange,
      icon: TrendingUp,
      color: 'purple'
    },
    {
      label: 'Avg. Days to Close',
      value: `${analytics.averageDaysToClose}`,
      subtitle: 'days',
      icon: Clock,
      color: 'orange'
    },
    {
      label: 'Win Rate',
      value: formatPercentage(analytics.winRate),
      change: analytics.winRateChange,
      icon: CheckCircle,
      color: 'emerald'
    },
    {
      label: 'YTD Closings',
      value: formatCurrency(analytics.ytdClosings.amount, analytics.ytdClosings.currency),
      subtitle: `${analytics.ytdClosingsCount} deals`,
      icon: TrendingUp,
      color: 'indigo'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
      green: { bg: 'bg-green-100', text: 'text-green-600' },
      purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
      emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600' },
      indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((metric) => {
        const colorClasses = getColorClasses(metric.color);
        const Icon = metric.icon;
        
        return (
          <div key={metric.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{metric.label}</p>
                <p className="text-2xl font-semibold mt-1">{metric.value}</p>
                {metric.subtitle && (
                  <p className="text-xs text-gray-400">{metric.subtitle}</p>
                )}
                {metric.change !== undefined && (
                  <div className={`flex items-center text-sm mt-1 ${
                    metric.change >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metric.change >= 0 ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {formatPercentage(Math.abs(metric.change / 100))}
                  </div>
                )}
              </div>
              <div className={`p-2 rounded-lg ${colorClasses.bg}`}>
                <Icon className={`w-5 h-5 ${colorClasses.text}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PipelineSummary;
