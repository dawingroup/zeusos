/**
 * Table primitive (shadcn-style).
 * Re-skinned to match the portal redesign's <DataTable> look:
 *   - Sunken header row with uppercase 10.5px caption
 *   - 13px body rows with --border-subtle separators
 *   - --bg-sunken on row hover
 *   - Rounded card wrapper around the whole table
 */

import * as React from 'react';
import { cn } from '@/core/lib/utils';

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div
    className="relative w-full overflow-x-auto rounded-[10px] border shadow-[var(--shadow-sm)]"
    style={{
      backgroundColor: 'var(--bg-surface)',
      borderColor: 'var(--border-subtle)',
    }}
  >
    <table
      ref={ref}
      className={cn('w-full caption-bottom text-[13px] border-collapse', className)}
      {...props}
    />
  </div>
));
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('[&_tr]:border-b', className)}
    style={{ backgroundColor: 'var(--bg-sunken)' }}
    {...props}
  />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-b-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t font-medium text-[12.5px] [&>tr]:last:border-b-0',
      className
    )}
    style={{
      borderTopColor: 'var(--border-default)',
      backgroundColor: 'var(--bg-sunken)',
      color: 'var(--fg-primary)',
    }}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, style, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors',
      'hover:bg-[var(--bg-sunken)] data-[state=selected]:bg-[var(--bg-sunken)]',
      className
    )}
    style={{ borderColor: 'var(--border-subtle)', ...style }}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, style, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-10 px-3 text-left align-middle font-medium select-none',
      'text-[10.5px] uppercase tracking-wider',
      '[&:has([role=checkbox])]:pr-0 whitespace-nowrap',
      className
    )}
    style={{ color: 'var(--fg-tertiary)', ...style }}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, style, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'px-3 py-2 align-middle [&:has([role=checkbox])]:pr-0',
      className
    )}
    style={{ color: 'var(--fg-primary)', ...style }}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, style, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-3 text-[12px]', className)}
    style={{ color: 'var(--fg-tertiary)', ...style }}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
