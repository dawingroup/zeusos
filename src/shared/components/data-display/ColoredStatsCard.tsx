/**
 * ColoredStatsCard
 * Legacy primitive — kept for API back-compat; visually aligned with the
 * portal redesign. The `color` prop drives a soft tinted background +
 * matching icon hue, mapped to design-system RAG / brand tokens.
 */

import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export type StatsCardColor =
  | 'primary'
  | 'blue'
  | 'amber'
  | 'green'
  | 'red'
  | 'purple'
  | 'indigo'
  | 'teal';

interface ColoredStatsCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color: StatsCardColor;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  onClick?: () => void;
  className?: string;
}

const COLOR_VARS: Record<StatsCardColor, { fg: string; bg: string }> = {
  primary: { fg: 'var(--accent)',     bg: 'var(--accent-soft)' },
  blue:    { fg: 'var(--rag-blue)',   bg: 'var(--rag-blue-soft)' },
  amber:   { fg: 'var(--rag-amber)',  bg: 'var(--rag-amber-soft)' },
  green:   { fg: 'var(--rag-green)',  bg: 'var(--rag-green-soft)' },
  red:     { fg: 'var(--rag-red)',    bg: 'var(--rag-red-soft)' },
  purple:  { fg: 'var(--boysenberry)', bg: 'var(--boysenberry-50)' },
  indigo:  { fg: 'var(--rag-blue)',   bg: 'var(--rag-blue-soft)' },
  teal:    { fg: 'var(--seafoam)',    bg: '#e8f3f6' },
};

export function ColoredStatsCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  onClick,
  className,
}: ColoredStatsCardProps) {
  const tone = COLOR_VARS[color];

  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span
          className="h-7 w-7 rounded-md grid place-items-center shrink-0"
          style={{ backgroundColor: tone.bg, color: tone.fg }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <span
          className="text-[26px] font-semibold tabular-nums"
          style={{ color: 'var(--fg-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
        >
          {value}
        </span>
        {trend && (
          <span
            className="inline-flex items-center gap-1 text-[12px] font-medium"
            style={{
              color: trend.direction === 'up' ? 'var(--rag-green)' : 'var(--rag-red)',
            }}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.direction === 'up' ? '+' : '−'}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      {subtitle && (
        <span
          className="block text-[11.5px] mt-0.5"
          style={{ color: 'var(--fg-secondary)' }}
        >
          {subtitle}
        </span>
      )}
    </>
  );

  const baseClass = cn(
    'flex flex-col rounded-[10px] border-l-[3px] border border-[var(--border-default)] bg-[var(--bg-surface)]',
    onClick && 'cursor-pointer hover:shadow-[var(--shadow-md)] transition-shadow',
    className
  );

  const style = {
    padding: 'var(--pad-card)',
    borderLeftColor: tone.fg,
  };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(baseClass, 'text-left w-full')}
        style={style}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={baseClass} style={style}>
      {inner}
    </div>
  );
}
