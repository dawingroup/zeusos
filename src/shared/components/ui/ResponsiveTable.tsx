/**
 * ResponsiveTable Component
 * Switches between table view on desktop and card view on mobile
 * Standardized across ZeusOS for consistent mobile experience
 */

import React from 'react';
import { cn } from '@/shared/lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => React.ReactNode;
  mobileLabel?: string; // Label to show in mobile card view
  hideOnMobile?: boolean; // Hide this column on mobile cards
  priority?: number; // Lower = shown first on mobile (1-5)
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T, index: number) => string;
  onRowClick?: (item: T) => void;
  selectedKeys?: Set<string>;
  onSelect?: (key: string) => void;
  onSelectAll?: () => void;
  emptyState?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'orange' | 'purple' | 'green';
  mobileCardRenderer?: (item: T, index: number) => React.ReactNode;
  /** Freeze first column on horizontal scroll. Defaults to true. */
  stickyFirstColumn?: boolean;
}

const variantStyles = {
  default: {
    header: 'bg-[var(--bg-sunken)] border-[var(--border-subtle)]',
    headerText: 'text-muted-foreground',
    row: 'hover:bg-[var(--bg-sunken)]',
    rowSelected: 'bg-primary/5',
    border: 'border-[var(--border-subtle)]',
    divider: 'divide-[var(--border-subtle)]',
    cardBorder: 'border-[var(--border-subtle)]',
  },
  orange: {
    header: 'bg-[var(--rag-amber-soft)] border-[var(--rag-amber)]',
    headerText: 'text-[var(--rag-amber)]',
    row: 'hover:bg-[var(--rag-amber-soft)]/50',
    rowSelected: 'bg-[var(--rag-amber-soft)]',
    border: 'border-[var(--rag-amber)]',
    divider: 'divide-[var(--rag-amber)]',
    cardBorder: 'border-[var(--rag-amber)]',
  },
  purple: {
    header: 'bg-purple-50 border-purple-200',
    headerText: 'text-purple-800',
    row: 'hover:bg-purple-50/50',
    rowSelected: 'bg-purple-100',
    border: 'border-purple-200',
    divider: 'divide-purple-100',
    cardBorder: 'border-purple-200',
  },
  green: {
    header: 'bg-[var(--rag-green-soft)] border-[var(--rag-green)]',
    headerText: 'text-[var(--rag-green)]',
    row: 'hover:bg-[var(--rag-green-soft)]/50',
    rowSelected: 'bg-[var(--rag-green-soft)]',
    border: 'border-[var(--rag-green)]',
    divider: 'divide-[var(--rag-green)]',
    cardBorder: 'border-[var(--rag-green)]',
  },
};

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  selectedKeys,
  onSelect,
  onSelectAll,
  emptyState,
  className,
  variant = 'default',
  mobileCardRenderer,
  stickyFirstColumn = true,
}: ResponsiveTableProps<T>) {
  const styles = variantStyles[variant];
  const showCheckbox = onSelect !== undefined;

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  // Get visible columns for mobile (sorted by priority)
  const mobileColumns = columns
    .filter(col => !col.hideOnMobile)
    .sort((a, b) => (a.priority || 5) - (b.priority || 5))
    .slice(0, 4); // Show max 4 fields on mobile cards

  return (
    <div className={cn('bg-card rounded-lg border overflow-hidden', styles.border, className)}>
      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className={cn(
          'w-full text-sm',
          stickyFirstColumn && (showCheckbox ? 'table-sticky-first-two-col' : 'table-sticky-first-col')
        )}>
          <thead className={cn('border-b', styles.header)}>
            <tr>
              {showCheckbox && (
                <th className="px-3 py-2 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectedKeys?.size === data.length && data.length > 0}
                    onChange={onSelectAll}
                    className="rounded border-[var(--border-default)]"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('px-3 py-2 font-medium', styles.headerText, col.headerClassName)}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={cn('divide-y', styles.divider)}>
            {data.map((item, index) => {
              const key = keyExtractor(item, index);
              const isSelected = selectedKeys?.has(key);
              return (
                <tr
                  key={key}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    onRowClick && 'cursor-pointer',
                    isSelected ? styles.rowSelected : styles.row
                  )}
                >
                  {showCheckbox && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onSelect?.(key);
                        }}
                        className="rounded border-[var(--border-default)]"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-3 py-2', col.className)}>
                      {col.render ? col.render(item, index) : (item as any)[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
        {data.map((item, index) => {
          const key = keyExtractor(item, index);
          const isSelected = selectedKeys?.has(key);

          // Use custom card renderer if provided
          if (mobileCardRenderer) {
            return (
              <div key={key} className="p-3">
                {mobileCardRenderer(item, index)}
              </div>
            );
          }

          return (
            <div
              key={key}
              onClick={() => onRowClick?.(item)}
              className={cn(
                'p-3',
                onRowClick && 'cursor-pointer active:bg-[var(--bg-sunken)]',
                isSelected && styles.rowSelected
              )}
            >
              {/* Card Header with checkbox and primary info */}
              <div className="flex items-start gap-3">
                {showCheckbox && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      onSelect?.(key);
                    }}
                    className="rounded border-[var(--border-default)] mt-1"
                  />
                )}
                <div className="flex-1 min-w-0">
                  {/* Primary field (first column or priority 1) */}
                  {mobileColumns[0] && (
                    <div className="font-medium text-foreground truncate">
                      {mobileColumns[0].render
                        ? mobileColumns[0].render(item, index)
                        : (item as any)[mobileColumns[0].key]}
                    </div>
                  )}
                  
                  {/* Secondary fields */}
                  <div className="mt-1 space-y-1">
                    {mobileColumns.slice(1).map((col) => (
                      <div key={col.key} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{col.mobileLabel || col.header}:</span>
                        <span className="text-foreground font-medium">
                          {col.render ? col.render(item, index) : (item as any)[col.key]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ResponsiveTable;
