/**
 * ProgressBar
 * Legacy primitive — kept for API back-compat. Renders against the design
 * system tokens: sunken track + accent (or RAG-toned) fill.
 */

import { cn } from '@/shared/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const HEIGHT: Record<NonNullable<ProgressBarProps['size']>, string> = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
};

const FILL: Record<NonNullable<ProgressBarProps['colorScheme']>, string> = {
  default: 'var(--accent)',
  success: 'var(--rag-green)',
  warning: 'var(--rag-amber)',
  danger:  'var(--rag-red)',
};

export function ProgressBar({
  value,
  max = 100,
  showLabel = false,
  label,
  size = 'md',
  colorScheme = 'default',
  className,
}: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(Math.round((value / (max || 1)) * 100), 100));

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {(showLabel || label) && (
        <div className="flex justify-between text-[11.5px]">
          <span style={{ color: 'var(--fg-secondary)' }}>{label}</span>
          {showLabel && (
            <span
              className="font-medium tabular-nums"
              style={{ color: 'var(--fg-primary)' }}
            >
              {percentage}%
            </span>
          )}
        </div>
      )}
      <div
        className={cn('w-full overflow-hidden rounded-full', HEIGHT[size])}
        style={{ backgroundColor: 'var(--bg-sunken)' }}
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: FILL[colorScheme] }}
        />
      </div>
    </div>
  );
}
