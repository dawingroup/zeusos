import * as React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface EmptyStateProps {
  /** Icon component or rendered node — defaults to an inbox glyph. */
  icon?: React.ReactNode;
  /** Headline. */
  title: React.ReactNode;
  /** Supporting body copy. */
  message?: React.ReactNode;
  /** Optional CTA button (or any node). */
  action?: React.ReactNode;
  /** Visual size — `compact` for small inline placements. */
  size?: 'default' | 'compact';
  className?: string;
}

/**
 * Empty state — 56×56 icon tile + title + message + optional CTA.
 * Used in tables/dashboards when the result set is empty.
 */
export function EmptyState({
  icon,
  title,
  message,
  action,
  size = 'default',
  className,
}: EmptyStateProps) {
  const tileSize = size === 'compact' ? 'h-10 w-10' : 'h-14 w-14';
  const titleSize = size === 'compact' ? 'text-[14px]' : 'text-[15px]';
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center mx-auto',
        size === 'compact' ? 'py-6 max-w-sm' : 'py-12 max-w-md',
        className
      )}
    >
      <div
        className={cn(
          tileSize,
          'rounded-[10px] grid place-items-center mb-3'
        )}
        style={{
          backgroundColor: 'var(--bg-sunken)',
          color: 'var(--fg-tertiary)',
        }}
      >
        {icon ?? <Inbox className={size === 'compact' ? 'h-5 w-5' : 'h-6 w-6'} />}
      </div>
      <div
        className={cn(titleSize, 'font-semibold')}
        style={{ color: 'var(--fg-primary)', letterSpacing: '-0.01em' }}
      >
        {title}
      </div>
      {message && (
        <div
          className="mt-1 text-[12.5px] leading-snug"
          style={{ color: 'var(--fg-secondary)' }}
        >
          {message}
        </div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
