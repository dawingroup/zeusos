/**
 * StatsCard
 * Legacy primitive — kept for API back-compat; visually aligned with the
 * portal redesign's KPICard look (warm-neutral surface, design-system
 * typography, accent-aware trend chip).
 */

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-[10px] border bg-[var(--bg-surface)]',
        className
      )}
      style={{
        padding: 'var(--pad-card)',
        borderColor: 'var(--border-default)',
        color: 'var(--fg-primary)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          {title}
        </span>
        {Icon && (
          <Icon className="h-3.5 w-3.5" style={{ color: 'var(--fg-tertiary)' }} />
        )}
      </div>
      <div
        className="text-[26px] font-semibold tabular-nums mt-1"
        style={{ color: 'var(--fg-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
      >
        {value}
      </div>
      {(description || trend) && (
        <div className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium">
          {trend && (
            <span
              className="inline-flex items-center gap-1"
              style={{
                color: trend.isPositive
                  ? 'var(--rag-green)'
                  : 'var(--rag-red)',
              }}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {trend.isPositive ? '+' : ''}
              {trend.value}%
            </span>
          )}
          {description && (
            <span style={{ color: 'var(--fg-secondary)' }}>{description}</span>
          )}
        </div>
      )}
    </div>
  );
}
