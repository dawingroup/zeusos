/**
 * AccountabilityAgingChart - Visual aging analysis of pending accountabilities
 */

import { AgingBucket } from '../../hooks/accountability-hooks';

interface AccountabilityAgingChartProps {
  aging: AgingBucket[];
  totalPending: { count: number; amount: number };
  currency?: string;
  onBucketClick?: (bucket: AgingBucket) => void;
}

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

const BUCKET_COLORS = [
  { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50' },
  { bg: 'bg-yellow-500', text: 'text-yellow-700', light: 'bg-yellow-50' },
  { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-50' },
  { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' },
];

export function AccountabilityAgingChart({
  aging,
  totalPending,
  currency = 'UGX',
  onBucketClick,
}: AccountabilityAgingChartProps) {
  const maxCount = Math.max(...aging.map(b => b.count), 1);

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Accountability Aging</h3>
          <p className="text-sm text-gray-500">
            Time since payment for pending accountabilities
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">{totalPending.count}</div>
          <div className="text-sm text-gray-500">
            {formatCurrency(totalPending.amount, currency)} pending
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {aging.map((bucket, index) => {
          const color = BUCKET_COLORS[index] || BUCKET_COLORS[BUCKET_COLORS.length - 1];
          const widthPercent = (bucket.count / maxCount) * 100;
          const isOverdue = index >= 3;

          return (
            <button
              key={bucket.range}
              onClick={() => onBucketClick?.(bucket)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                bucket.count > 0
                  ? `${color.light} hover:opacity-80 cursor-pointer`
                  : 'bg-gray-50'
              }`}
              disabled={bucket.count === 0}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isOverdue ? 'text-red-700' : 'text-gray-900'}`}>
                    {bucket.range}
                  </span>
                  {isOverdue && bucket.count > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                      OVERDUE
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className={`font-semibold ${color.text}`}>{bucket.count}</span>
                  <span className="text-gray-500 text-sm ml-2">
                    ({formatCurrency(bucket.amount, currency)})
                  </span>
                </div>
              </div>

              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color.bg} rounded-full transition-all duration-500`}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Legend:</span>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-gray-600">On time</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="text-gray-600">Warning</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-gray-600">Overdue</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AgingBarProps {
  aging: AgingBucket[];
  totalPending: { count: number; amount: number };
}

export function AgingStackedBar({ aging, totalPending }: AgingBarProps) {
  if (totalPending.count === 0) {
    return (
      <div className="h-8 bg-green-100 rounded-full flex items-center justify-center">
        <span className="text-sm text-green-700 font-medium">All Accounted</span>
      </div>
    );
  }

  return (
    <div className="h-8 bg-gray-200 rounded-full overflow-hidden flex">
      {aging.map((bucket, index) => {
        if (bucket.count === 0) return null;
        const widthPercent = (bucket.count / totalPending.count) * 100;
        const color = BUCKET_COLORS[index] || BUCKET_COLORS[BUCKET_COLORS.length - 1];

        return (
          <div
            key={bucket.range}
            className={`${color.bg} flex items-center justify-center`}
            style={{ width: `${widthPercent}%` }}
            title={`${bucket.range}: ${bucket.count}`}
          >
            {widthPercent > 15 && (
              <span className="text-xs text-white font-medium">{bucket.count}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
