/**
 * AccountabilityMetrics - Summary metrics for accountability overview
 */

import {
  Receipt,
  Wallet,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { MetricCard } from '../common/MetricCard';
import { AccountabilitySummary } from '../../hooks/accountability-hooks';

interface AccountabilityMetricsProps {
  summary: AccountabilitySummary;
  currency?: string;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

export function AccountabilityMetrics({ summary, currency = 'UGX' }: AccountabilityMetricsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricCard
        icon={Receipt}
        label="Total Requisitions"
        value={summary.totalRequisitions}
        iconColor="text-purple-500"
      />

      <MetricCard
        icon={DollarSign}
        label="Total Disbursed"
        value={formatCurrency(summary.totalDisbursed, currency)}
        iconColor="text-blue-500"
      />

      <MetricCard
        icon={CheckCircle}
        label="Accounted For"
        value={formatCurrency(summary.totalAccounted, currency)}
        iconColor="text-green-500"
      />

      <MetricCard
        icon={Wallet}
        label="Unaccounted"
        value={formatCurrency(summary.totalUnaccounted, currency)}
        iconColor="text-amber-500"
        highlight={summary.totalUnaccounted > 0 ? 'warning' : undefined}
      />

      <MetricCard
        icon={XCircle}
        label="Overdue"
        value={summary.overdueCount}
        iconColor="text-red-500"
        highlight={summary.overdueCount > 0 ? 'danger' : undefined}
      />

      <MetricCard
        icon={TrendingUp}
        label="Accountability Rate"
        value={`${summary.accountabilityRate.toFixed(1)}%`}
        iconColor="text-indigo-500"
        highlight={
          summary.accountabilityRate >= 90
            ? 'success'
            : summary.accountabilityRate >= 70
            ? undefined
            : 'warning'
        }
      />
    </div>
  );
}

interface AccountabilityStatusCardsProps {
  summary: AccountabilitySummary;
  onFilterChange?: (status: string) => void;
  activeFilter?: string;
}

export function AccountabilityStatusCards({
  summary,
  onFilterChange,
  activeFilter = 'all',
}: AccountabilityStatusCardsProps) {
  const statuses = [
    {
      key: 'all',
      label: 'All',
      count: summary.totalRequisitions,
      icon: Receipt,
      color: 'text-purple-500',
    },
    {
      key: 'pending',
      label: 'Pending',
      count: summary.pendingCount,
      icon: Clock,
      color: 'text-amber-500',
    },
    {
      key: 'partial',
      label: 'Partial',
      count: summary.partialCount,
      icon: AlertTriangle,
      color: 'text-blue-500',
    },
    {
      key: 'overdue',
      label: 'Overdue',
      count: summary.overdueCount,
      icon: XCircle,
      color: 'text-red-500',
    },
    {
      key: 'complete',
      label: 'Complete',
      count: summary.completeCount,
      icon: CheckCircle,
      color: 'text-green-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {statuses.map(status => {
        const Icon = status.icon;
        const isActive = activeFilter === status.key;

        return (
          <button
            key={status.key}
            onClick={() => onFilterChange?.(status.key)}
            className={`p-4 rounded-lg border text-left transition-colors ${
              isActive
                ? 'bg-primary/10 border-primary'
                : 'bg-white hover:bg-gray-50 border-gray-200'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${status.color}`} />
              <span className="text-sm text-gray-600">{status.label}</span>
            </div>
            <div
              className={`text-2xl font-bold ${
                status.key === 'overdue' && status.count > 0 ? 'text-red-600' : ''
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
