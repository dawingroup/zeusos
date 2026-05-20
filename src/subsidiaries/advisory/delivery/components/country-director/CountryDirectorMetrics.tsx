/**
 * CountryDirectorMetrics - Summary metrics for Country Director Dashboard
 */

import {
  Receipt,
  Wallet,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
  FileText,
  Search,
} from 'lucide-react';
import { MetricCard } from '../common/MetricCard';
import { CountryDirectorSummary } from '../../types/country-director-dashboard';

interface CountryDirectorMetricsProps {
  summary: CountryDirectorSummary;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

export function CountryDirectorMetrics({ summary, currency = 'UGX' }: CountryDirectorMetricsProps) {
  return (
    <div className="space-y-4">
      {/* Primary Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={Receipt}
          label="Total Requisitions"
          value={summary.totalRequisitions}
          iconColor="text-purple-500"
        />

        <MetricCard
          icon={FileText}
          label="Manual Entries"
          value={summary.manualRequisitions}
          iconColor="text-indigo-500"
        />

        <MetricCard
          icon={DollarSign}
          label="System Generated"
          value={summary.systemRequisitions}
          iconColor="text-blue-500"
        />

        <MetricCard
          icon={TrendingUp}
          label="Compliance Rate"
          value={`${summary.complianceRate.toFixed(1)}%`}
          iconColor="text-green-500"
          highlight={
            summary.complianceRate >= 90
              ? 'success'
              : summary.complianceRate >= 70
              ? undefined
              : 'warning'
          }
        />

        <MetricCard
          icon={Search}
          label="Active Investigations"
          value={summary.activeInvestigations}
          iconColor="text-amber-500"
          highlight={summary.activeInvestigations > 0 ? 'warning' : undefined}
        />

        <MetricCard
          icon={XCircle}
          label="Overdue"
          value={summary.overdueCount}
          iconColor="text-red-500"
          highlight={summary.overdueCount > 0 ? 'danger' : undefined}
        />
      </div>

      {/* Financial Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Total Disbursed"
          value={formatCurrency(summary.totalDisbursed, currency)}
          iconColor="text-blue-500"
        />

        <MetricCard
          icon={CheckCircle}
          label="Total Accounted"
          value={formatCurrency(summary.totalAccounted, currency)}
          iconColor="text-green-500"
        />

        <MetricCard
          icon={Wallet}
          label="Unaccounted Amount"
          value={formatCurrency(summary.totalUnaccounted, currency)}
          iconColor="text-amber-500"
          highlight={summary.totalUnaccounted > 0 ? 'warning' : undefined}
        />
      </div>
    </div>
  );
}

interface VarianceSummaryCardsProps {
  summary: CountryDirectorSummary;
  onFilterChange?: (status: string) => void;
  activeFilter?: string;
}

export function VarianceSummaryCards({
  summary,
  onFilterChange,
  activeFilter = 'all',
}: VarianceSummaryCardsProps) {
  const statuses = [
    {
      key: 'all',
      label: 'All',
      count: summary.totalRequisitions,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      key: 'compliant',
      label: 'Compliant',
      count: summary.varianceSummary.compliant,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      key: 'minor',
      label: 'Minor Variance',
      count: summary.varianceSummary.minor,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      key: 'moderate',
      label: 'Moderate',
      count: summary.varianceSummary.moderate,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      key: 'severe',
      label: 'Severe',
      count: summary.varianceSummary.severe,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {statuses.map(status => {
        const isActive = activeFilter === status.key;

        return (
          <button
            key={status.key}
            onClick={() => onFilterChange?.(status.key)}
            className={`p-4 rounded-lg border text-left transition-colors ${
              isActive
                ? 'bg-primary/10 border-primary'
                : `${status.bgColor} hover:opacity-80 border-gray-200`
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm text-gray-600">{status.label}</span>
            </div>
            <div
              className={`text-2xl font-bold ${
                status.key === 'severe' && status.count > 0 ? 'text-red-600' : status.color
              }`}
            >
              {status.count}
            </div>
          </button>
        );
      })}
    </div>
  );
}
