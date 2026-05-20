/**
 * ResponsiveTable Component
 * Switches between table view on desktop and card view on mobile
 * Standardized across DawinOS for consistent mobile experience
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
    header: 'bg-gray-50 border-gray-200',
    headerText: 'text-gray-700',
    row: 'hover:bg-gray-50',
    rowSelected: 'bg-primary/5',
    border: 'border-gray-200',
    divider: 'divide-gray-100',
    cardBorder: 'border-gray-200',
  },
  orange: {
    header: 'bg-orange-50 border-orange-200',
    headerText: 'text-orange-800',
    row: 'hover:bg-orange-50/50',
    rowSelected: 'bg-orange-100',
    border: 'border-orange-200',
    divider: 'divide-orange-100',
    cardBorder: 'border-orange-200',
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
    header: 'bg-green-50 border-green-200',
    headerText: 'text-green-800',
    row: 'hover:bg-green-50/50',
    rowSelected: 'bg-green-100',
    border: 'border-green-200',
    divider: 'divide-green-100',
    cardBorder: 'border-green-200',
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
    <div className={cn('bg-white rounded-lg border overflow-hidden', styles.border, className)}>
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
                    className="rounded border-gray-300"
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
                        className="rounded border-gray-300"
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
      <div className="sm:hidden divide-y divide-gray-100">
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
                onRowClick && 'cursor-pointer active:bg-gray-50',
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
                    className="rounded border-gray-300 mt-1"
                  />
                )}
                <div className="flex-1 min-w-0">
                  {/* Primary field (first column or priority 1) */}
                  {mobileColumns[0] && (
                    <div className="font-medium text-gray-900 truncate">
                      {mobileColumns[0].render
                        ? mobileColumns[0].render(item, index)
                        : (item as any)[mobileColumns[0].key]}
                    </div>
                  )}
                  
                  {/* Secondary fields */}
                  <div className="mt-1 space-y-1">
                    {mobileColumns.slice(1).map((col) => (
                      <div key={col.key} className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{col.mobileLabel || col.header}:</span>
                        <span className="text-gray-900 font-medium">
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
