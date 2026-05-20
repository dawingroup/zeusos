/**
 * KanbanColumn — shared kanban column primitive matching the portal redesign.
 *
 * Layout (per the Claude design template):
 *   ┌─────────────────────────────────────┐
 *   │ Label · 5         UGX 12.4M total   │  ← 12px header row
 *   │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │  ← 3px stripe (green when terminal)
 *   │ ┌─ card ─┐                          │
 *   │ │ …     │                          │
 *   │ └────────┘                          │
 *   │ ┌─ card ─┐                          │
 *   │ └────────┘                          │
 *   │ + Add                              │  ← optional ghost button
 *   └─────────────────────────────────────┘
 *
 * Doesn't dictate card markup — render `children` to keep module-specific
 * cards/drag-handlers intact.
 */

import * as React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface KanbanColumnProps {
  label: React.ReactNode;
  /** Total count shown after the label as "· N". */
  count: number;
  /** Optional aggregate value shown top-right (already formatted). */
  total?: React.ReactNode;
  /** Stripe color under the header. Defaults to --border-strong; green for terminal columns. */
  stripeColor?: string;
  /** Marks a terminal column (won / complete / shipped) — stripe turns green. */
  terminal?: boolean;
  /** Empty-state copy when the column has no cards. */
  emptyLabel?: React.ReactNode;
  /** Click handler for the "+ Add" button. Hides the button when omitted. */
  onAdd?: () => void;
  /** Native drag-and-drop hooks — let parent boards wire stage swaps. */
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
  /** Tweaks the column min/max width — defaults match the template. */
  width?: number;
  className?: string;
  children?: React.ReactNode;
}

export function KanbanColumn({
  label,
  count,
  total,
  stripeColor,
  terminal,
  emptyLabel = 'No items',
  onAdd,
  onDragOver,
  onDragLeave,
  onDrop,
  width = 280,
  className,
  children,
}: KanbanColumnProps) {
  const stripe =
    stripeColor ??
    (terminal ? 'var(--rag-green)' : 'var(--border-strong)');

  const childArray = React.Children.toArray(children);
  const isEmpty = childArray.length === 0;

  return (
    <div
      className={cn('flex flex-col gap-2 shrink-0', className)}
      style={{ width, minWidth: width }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header row */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span
            className="text-[12px] font-medium leading-tight truncate"
            style={{ color: 'var(--fg-primary)' }}
          >
            {label}
          </span>
          <span
            className="text-[11px] shrink-0 tabular-nums"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            · {count}
          </span>
        </div>
        {total != null && total !== '' && (
          <span
            className="text-[11px] tabular-nums shrink-0 ml-2"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            {total}
          </span>
        )}
      </div>

      {/* Stripe */}
      <div
        className="h-[3px] rounded-[2px]"
        style={{ backgroundColor: stripe }}
        aria-hidden="true"
      />

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {isEmpty ? (
          <div
            className="text-center py-4 text-[11px]"
            style={{ color: 'var(--fg-quaternary)' }}
          >
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </div>

      {/* + Add */}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11.5px] font-medium transition-colors self-start"
          style={{ color: 'var(--fg-tertiary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg-sunken)';
            e.currentTarget.style.color = 'var(--fg-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--fg-tertiary)';
          }}
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      )}
    </div>
  );
}

/**
 * KanbanCard — opt-in shared card chrome (12px padding, hover lift).
 * Card content remains module-specific; use this when you want the
 * default skin without rolling your own wrapper.
 */
export interface KanbanCardProps
  extends React.HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export const KanbanCard = React.forwardRef<HTMLDivElement, KanbanCardProps>(
  ({ className, style, selected, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-[10px] border bg-[var(--bg-surface)] cursor-grab active:cursor-grabbing transition-shadow',
        'hover:shadow-[var(--shadow-md)]',
        className,
      )}
      style={{
        padding: 12,
        borderColor: selected ? 'var(--accent)' : 'var(--border-subtle)',
        boxShadow: selected ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        ...style,
      }}
      {...props}
    />
  ),
);
KanbanCard.displayName = 'KanbanCard';
