/**
 * UnifiedAgingChart - Stacked aging chart showing manual vs system requisitions
 */

import { BarChart, Calendar, FileText, Zap } from 'lucide-react';
import { UnifiedAgingAnalysis, AgingBucket } from '../../types/country-director-dashboard';

interface UnifiedAgingChartProps {
  aging: UnifiedAgingAnalysis;
  currency?: string;
  onBucketClick?: (bucket: AgingBucket) => void;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

const BUCKET_COLORS = [
  { manual: 'bg-purple-400', system: 'bg-blue-400', label: 'text-green-600' },
  { manual: 'bg-purple-500', system: 'bg-blue-500', label: 'text-amber-600' },
  { manual: 'bg-purple-600', system: 'bg-blue-600', label: 'text-orange-600' },
  { manual: 'bg-purple-700', system: 'bg-blue-700', label: 'text-red-600' },
];

export function UnifiedAgingChart({
  aging,
  currency = 'UGX',
  onBucketClick,
}: UnifiedAgingChartProps) {
  // Calculate max amount for scaling
  const maxAmount = Math.max(...aging.buckets.map((b) => b.amount), 1);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Accountability Aging</h3>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-purple-500" />
            <span className="text-gray-600">Manual</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span className="text-gray-600">System</span>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-sm text-gray-600">Total Pending</div>
          <div className="text-xl font-semibold text-gray-900">
            {aging.totalPending.count}
          </div>
          <div className="text-sm text-gray-500">
            {formatCurrency(aging.totalPending.amount, currency)}
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="flex items-center gap-1 text-sm text-purple-600">
            <FileText className="w-4 h-4" />
            Manual
          </div>
          <div className="text-xl font-semibold text-purple-700">
            {aging.manualTotal.count}
          </div>
          <div className="text-sm text-purple-500">
            {formatCurrency(aging.manualTotal.amount, currency)}
          </div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center gap-1 text-sm text-blue-600">
            <Zap className="w-4 h-4" />
            System
          </div>
          <div className="text-xl font-semibold text-blue-700">
            {aging.systemTotal.count}
          </div>
          <div className="text-sm text-blue-500">
            {formatCurrency(aging.systemTotal.amount, currency)}
          </div>
        </div>
      </div>

      {/* Stacked Bar Chart */}
      <div className="space-y-4">
        {aging.buckets.map((bucket, index) => {
          const manualWidth = maxAmount > 0 ? (bucket.manualAmount / maxAmount) * 100 : 0;
          const systemWidth = maxAmount > 0 ? (bucket.systemAmount / maxAmount) * 100 : 0;
          const colors = BUCKET_COLORS[index] || BUCKET_COLORS[3];

          return (
            <button
              key={bucket.range}
              onClick={() => onBucketClick?.(bucket)}
              className="w-full text-left hover:bg-gray-50 p-2 -m-2 rounded transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${colors.label}`}>
                  {bucket.range}
                </span>
                <span className="text-sm text-gray-600">
                  {bucket.count} ({formatCurrency(bucket.amount, currency)})
                </span>
              </div>
              <div className="h-6 bg-gray-100 rounded-full overflow-hidden flex">
                {manualWidth > 0 && (
                  <div
                    className={`${colors.manual} h-full transition-all`}
                    style={{ width: `${manualWidth}%` }}
                    title={`Manual: ${bucket.manualCount} (${formatCurrency(bucket.manualAmount, currency)})`}
                  />
                )}
                {systemWidth > 0 && (
                  <div
                    className={`${colors.system} h-full transition-all`}
                    style={{ width: `${systemWidth}%` }}
                    title={`System: ${bucket.systemCount} (${formatCurrency(bucket.systemAmount, currency)})`}
                  />
                )}
              </div>
              <div className="flex justify-between mt-1 text-xs text-gray-500">
                <span>
                  Manual: {bucket.manualCount} ({formatCurrency(bucket.manualAmount, currency)})
                </span>
                <span>
                  System: {bucket.systemCount} ({formatCurrency(bucket.systemAmount, currency)})
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Warning for older buckets */}
      {aging.buckets[3] && aging.buckets[3].count > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-700">
              <strong>{aging.buckets[3].count}</strong> requisition(s) pending for over 30 days
              totaling <strong>{formatCurrency(aging.buckets[3].amount, currency)}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface AgingCompactProps {
  aging: UnifiedAgingAnalysis;
  currency?: string;
}

export function AgingCompact({ aging, currency = 'UGX' }: AgingCompactProps) {
  const hasOldPending = aging.buckets[3] && aging.buckets[3].count > 0;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-gray-900">Pending Accountabilities</h4>
          <p className="text-sm text-gray-500 mt-1">
            {aging.totalPending.count} pending ({formatCurrency(aging.totalPending.amount, currency)})
          </p>
        </div>
        {hasOldPending && (
          <div className="flex items-center gap-1 text-red-600 text-sm">
            <Calendar className="w-4 h-4" />
            {aging.buckets[3].count} over 30d
          </div>
        )}
      </div>
      <div className="flex gap-1 mt-3 h-2 rounded-full overflow-hidden bg-gray-100">
        {aging.buckets.map((bucket, index) => {
          const width = aging.totalPending.count > 0
            ? (bucket.count / aging.totalPending.count) * 100
            : 0;
          const colors = ['bg-green-400', 'bg-amber-400', 'bg-orange-400', 'bg-red-400'];

          return width > 0 ? (
            <div
              key={bucket.range}
              className={`${colors[index]} h-full`}
              style={{ width: `${width}%` }}
              title={`${bucket.range}: ${bucket.count}`}
            />
          ) : null;
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        <span>0-7d</span>
        <span>8-14d</span>
        <span>15-30d</span>
        <span>30+d</span>
      </div>
    </div>
  );
}
