import * as React from 'react';
import { cn } from '@/shared/lib/utils';

export type RagTone = 'green' | 'amber' | 'red' | 'blue' | 'na';

export interface RagBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: RagTone;
  /** Hide the leading dot. */
  hideDot?: boolean;
  /** Label content (children are also accepted). */
  label?: React.ReactNode;
}

const TONE_VARS: Record<RagTone, { bg: string; fg: string }> = {
  green: { bg: 'var(--rag-green-soft)', fg: 'var(--rag-green)' },
  amber: { bg: 'var(--rag-amber-soft)', fg: 'var(--rag-amber)' },
  red:   { bg: 'var(--rag-red-soft)',   fg: 'var(--rag-red)'   },
  blue:  { bg: 'var(--rag-blue-soft)',  fg: 'var(--rag-blue)'  },
  na:    { bg: 'var(--bg-sunken)',      fg: 'var(--rag-na)'    },
};

/**
 * RagBadge — small status pill in one of five tones.
 * Used everywhere the user needs a quick visual cue (on-track,
 * at-risk, blocked, info, n/a).
 */
export function RagBadge({
  tone,
  hideDot,
  label,
  children,
  className,
  style,
  ...props
}: RagBadgeProps) {
  const { bg, fg } = TONE_VARS[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        'text-[11px] font-medium leading-tight whitespace-nowrap',
        className
      )}
      style={{ backgroundColor: bg, color: fg, ...style }}
      {...props}
    >
      {!hideDot && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
          style={{ backgroundColor: fg }}
          aria-hidden="true"
        />
      )}
      {label ?? children}
    </span>
  );
}
