/**
 * Metric Card - Display key metrics with icons
 */

import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconColor?: string;
  highlight?: 'success' | 'warning' | 'danger';
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  compact?: boolean;
}

const HIGHLIGHT_CLASSES = {
  success: 'border-green-200 bg-green-50',
  warning: 'border-amber-200 bg-amber-50',
  danger: 'border-red-200 bg-red-50',
};

const TREND_CLASSES = {
  up: 'text-green-600',
  down: 'text-red-600',
};

export function MetricCard({ 
  icon: Icon, 
  label, 
  value, 
  iconColor = 'text-gray-500',
  highlight,
  trend,
  compact = false
}: MetricCardProps) {
  const baseClasses = 'rounded-lg border bg-white';
  const highlightClass = highlight ? HIGHLIGHT_CLASSES[highlight] : 'border-gray-200';
  const paddingClass = compact ? 'p-3' : 'p-4';

  return (
    <div className={`${baseClasses} ${highlightClass} ${paddingClass}`}>
      <div className="flex items-center gap-3">
        <div className={`${iconColor} flex-shrink-0`}>
          <Icon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-gray-600 truncate">{label}</p>
          <div className="flex items-baseline gap-2">
            <p className={`font-semibold ${compact ? 'text-lg' : 'text-xl'} text-gray-900`}>
              {value}
            </p>
            {trend && (
              <span className={`text-sm ${TREND_CLASSES[trend.direction]}`}>
                {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  subtitle?: string;
}

const VARIANT_CLASSES = {
  default: 'text-gray-900',
  success: 'text-green-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

export function StatCard({ label, value, variant = 'default', subtitle }: StatCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-sm text-gray-600">{label}</div>
      <div className={`text-2xl font-semibold ${VARIANT_CLASSES[variant]}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}
