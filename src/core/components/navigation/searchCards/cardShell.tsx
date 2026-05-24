/**
 * Common row shell shared by every search card. Owns:
 *   - selected/hover styling
 *   - icon column
 *   - click handler
 *   - right-arrow affordance
 *
 * Card components only have to render their middle content (title + meta).
 */

import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { getIconByName } from '@/shared/utils/iconMap';

interface CardShellProps {
  selected: boolean;
  onSelect: () => void;
  iconName?: string;
  children: ReactNode;
  /** Optional right-side accessory (e.g. a status badge). */
  accessory?: ReactNode;
}

export function CardShell({ selected, onSelect, iconName, children, accessory }: CardShellProps) {
  const Icon = iconName ? getIconByName(iconName) : null;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
        selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
      )}
    >
      <span className="text-muted-foreground shrink-0">
        {Icon ? <Icon className="h-4 w-4" /> : null}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
      {accessory}
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

/** Small status pill helper — used by several cards. */
export function StatusPill({ tone, children }: { tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; children: ReactNode }) {
  const cls = {
    success: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)] border-[var(--rag-green)]',
    warning: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)] border-[var(--rag-amber)]',
    danger: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)] border-[var(--rag-red)]',
    info: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)] border-[var(--rag-blue)]',
    neutral: 'bg-[var(--bg-sunken)] text-muted-foreground border-[var(--border-subtle)]',
  }[tone ?? 'neutral'];
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border', cls)}>
      {children}
    </span>
  );
}
