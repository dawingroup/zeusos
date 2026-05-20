import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Input } from '@/core/components/ui/input';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { RagBadge, type RagTone } from './RagBadge';
import { AvatarGroup, type AvatarPerson } from './AvatarGroup';
import { EmptyState } from './EmptyState';

// ─────────────────────────── Types

export type CellType =
  | 'text'
  | 'mono'
  | 'money'
  | 'number'
  | 'date'
  | 'pill'
  | 'sub'
  | 'status'
  | 'person'
  | 'people'
  | 'progress'
  | 'rating'
  | 'actions';

export interface StatusMapEntry {
  tone: RagTone;
  label: string;
}

export interface DataTableColumn<T> {
  key: keyof T | string;
  label: React.ReactNode;
  type?: CellType;
  width?: number | string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  /** Per-column accessor for nested/computed values. */
  accessor?: (row: T) => unknown;
  /** Custom render — bypasses cell `type`. */
  render?: (row: T) => React.ReactNode;
  /** For `status` cells. */
  statusMap?: Record<string, StatusMapEntry>;
}

export interface DataTableFilter {
  label: string;
  key?: string;
  options: string[];
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  search?: string | boolean;
  /** Seed the search input — useful for URL-driven `?q=` deep links. */
  initialSearch?: string;
  filters?: DataTableFilter[];
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  /** Optional KPI row rendered above the table. */
  kpis?: React.ReactNode;
  /** Footer row (e.g. totals). Rendered inside the table. */
  footer?: Record<string, React.ReactNode>;
  /** Stable row key function — defaults to `id`. */
  rowKey?: (row: T) => string;
  className?: string;
  density?: 'dense' | 'balanced' | 'airy';
}

// ─────────────────────────── Cell renderer

function formatMoney(v: unknown) {
  if (typeof v !== 'number') return String(v ?? '');
  return new Intl.NumberFormat('en-US').format(v);
}

function Cell<T>({
  column,
  row,
}: {
  column: DataTableColumn<T>;
  row: T;
}) {
  if (column.render) return <>{column.render(row)}</>;
  const raw = column.accessor ? column.accessor(row) : (row as any)[column.key];

  switch (column.type) {
    case 'mono':
      return (
        <span className="font-mono text-[12px]" style={{ color: 'var(--fg-primary)' }}>
          {String(raw ?? '')}
        </span>
      );
    case 'money':
      return (
        <span className="tabular-nums" style={{ color: 'var(--fg-primary)' }}>
          {formatMoney(raw)}
        </span>
      );
    case 'number':
      return (
        <span className="tabular-nums" style={{ color: 'var(--fg-primary)' }}>
          {String(raw ?? '')}
        </span>
      );
    case 'date':
      return <span style={{ color: 'var(--fg-secondary)' }}>{String(raw ?? '')}</span>;
    case 'pill':
      return <Badge variant="muted">{String(raw ?? '')}</Badge>;
    case 'status': {
      const key = String(raw ?? '');
      const meta = column.statusMap?.[key];
      if (!meta) return <span style={{ color: 'var(--fg-secondary)' }}>{key}</span>;
      return <RagBadge tone={meta.tone}>{meta.label}</RagBadge>;
    }
    case 'sub':
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
          style={{
            backgroundColor: 'var(--bg-sunken)',
            color: 'var(--fg-primary)',
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: 'var(--accent)' }}
          />
          {String(raw ?? '')}
        </span>
      );
    case 'person': {
      const person = raw as { name?: string; avatarUrl?: string } | undefined;
      if (!person?.name) return null;
      return (
        <div className="flex items-center gap-2">
          <AvatarGroup people={[{ id: person.name, name: person.name, avatarUrl: person.avatarUrl }]} size={22} />
          <span className="text-[13px]" style={{ color: 'var(--fg-primary)' }}>
            {person.name}
          </span>
        </div>
      );
    }
    case 'people': {
      const list = (raw as AvatarPerson[]) ?? [];
      return <AvatarGroup people={list} size={22} />;
    }
    case 'progress': {
      const n = typeof raw === 'number' ? Math.max(0, Math.min(100, raw)) : 0;
      return (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-sunken)' }}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${n}%`, backgroundColor: 'var(--accent)' }}
            />
          </div>
          <span
            className="text-[11.5px] font-medium tabular-nums w-9 text-right"
            style={{ color: 'var(--fg-secondary)' }}
          >
            {n}%
          </span>
        </div>
      );
    }
    case 'rating': {
      const n = typeof raw === 'number' ? raw : 0;
      const full = Math.round(n);
      return (
        <div className="inline-flex items-center gap-1.5">
          <div className="inline-flex" aria-label={`${n} out of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <svg
                key={i}
                viewBox="0 0 12 12"
                width="12"
                height="12"
                fill={i < full ? 'var(--rag-amber)' : 'var(--border-default)'}
              >
                <path d="M6 1l1.5 3.2L11 4.8 8.5 7.3 9.2 11 6 9.2 2.8 11l.7-3.7L1 4.8l3.5-.6z" />
              </svg>
            ))}
          </div>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--fg-secondary)' }}>
            {n.toFixed(1)}
          </span>
        </div>
      );
    }
    case 'actions':
      return <>{raw as React.ReactNode}</>;
    default:
      return <span style={{ color: 'var(--fg-primary)' }}>{String(raw ?? '')}</span>;
  }
}

// ─────────────────────────── Sort helpers

type SortDir = 'asc' | 'desc' | null;

function sortRows<T>(rows: T[], col: DataTableColumn<T> | null, dir: SortDir): T[] {
  if (!col || !dir) return rows;
  const access = (r: T) => (col.accessor ? col.accessor(r) : (r as any)[col.key]);
  const cmp = (a: T, b: T): number => {
    const av = access(a);
    const bv = access(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return av - bv;
    return String(av).localeCompare(String(bv), undefined, { numeric: true });
  };
  const out = [...rows].sort(cmp);
  return dir === 'desc' ? out.reverse() : out;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, '-');
}

// ─────────────────────────── DataTable

export function DataTable<T>({
  data,
  columns,
  search = false,
  initialSearch = '',
  filters = [],
  onRowClick,
  emptyState,
  kpis,
  footer,
  rowKey,
  className,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = React.useState<string | null>(null);
  const [sortDir, setSortDir] = React.useState<SortDir>(null);
  const [query, setQuery] = React.useState(initialSearch);
  const [activeChips, setActiveChips] = React.useState<Record<string, string>>({});

  const onHeaderClick = (col: DataTableColumn<T>) => {
    if (col.sortable === false) return;
    const key = String(col.key);
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortKey(null);
      setSortDir(null);
    } else {
      setSortDir('asc');
    }
  };

  const setChip = (filterKey: string, option: string) => {
    setActiveChips((prev) => {
      if (prev[filterKey] === option || option === 'All') {
        const { [filterKey]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [filterKey]: option };
    });
  };

  // Filter pipeline
  const filtered = React.useMemo(() => {
    const lower = query.trim().toLowerCase();
    return data.filter((row) => {
      // search across stringified row values
      if (lower) {
        const blob = Object.values(row as Record<string, unknown>)
          .map((v) => (v == null ? '' : String(v)))
          .join(' ')
          .toLowerCase();
        if (!blob.includes(lower)) return false;
      }
      // filter chips
      for (const [k, v] of Object.entries(activeChips)) {
        const raw = String((row as any)[k] ?? '');
        if (normalize(raw) !== normalize(v)) return false;
      }
      return true;
    });
  }, [data, query, activeChips]);

  const sortCol = columns.find((c) => String(c.key) === sortKey) ?? null;
  const sorted = React.useMemo(
    () => sortRows(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir]
  );

  const filterActive =
    !!query.trim() || Object.keys(activeChips).length > 0;
  const clearAll = () => {
    setQuery('');
    setActiveChips({});
  };

  const getKey = rowKey ?? ((row: T) => String((row as any).id ?? Math.random()));

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {kpis}

      {/* Toolbar */}
      {(search || filters.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {search && (
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                style={{ color: 'var(--fg-tertiary)' }}
              />
              <Input
                placeholder={typeof search === 'string' ? search : 'Search…'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          )}
          {filters.map((filter) => (
            <div key={filter.label} className="flex items-center gap-1.5">
              <span
                className="text-[11px] font-medium uppercase tracking-wider"
                style={{ color: 'var(--fg-tertiary)' }}
              >
                {filter.label}:
              </span>
              <div className="flex items-center gap-1">
                {filter.options.map((option) => {
                  const isActive = filter.key
                    ? activeChips[filter.key] === option
                    : false;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => filter.key && setChip(filter.key, option)}
                      disabled={!filter.key}
                      className={cn(
                        'h-7 px-2.5 rounded-full text-[11.5px] font-medium transition-colors',
                        'border',
                        isActive
                          ? 'bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/40'
                          : 'bg-[var(--bg-surface)] text-[var(--fg-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-sunken)] hover:text-[var(--fg-primary)]'
                      )}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {filterActive && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
              <X className="h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      )}

      {/* Filtered indicator */}
      {filterActive && (
        <div
          className="text-[11.5px]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          Showing {sorted.length} of {data.length}
        </div>
      )}

      {/* Table */}
      <div
        className="overflow-x-auto rounded-[10px] border"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr
              className="border-b"
              style={{ borderColor: 'var(--border-default)' }}
            >
              {columns.map((col) => {
                const align =
                  col.align ?? (col.type === 'money' || col.type === 'number' ? 'right' : 'left');
                const isSorted = String(col.key) === sortKey;
                return (
                  <th
                    key={String(col.key)}
                    style={{
                      width: col.width,
                      textAlign: align,
                      backgroundColor: 'var(--bg-sunken)',
                      color: 'var(--fg-tertiary)',
                    }}
                    className={cn(
                      'px-3 py-2 text-[10.5px] font-medium uppercase tracking-wider',
                      'select-none',
                      col.sortable !== false && 'cursor-pointer hover:text-[var(--fg-primary)]'
                    )}
                    onClick={() => onHeaderClick(col)}
                    scope="col"
                  >
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5',
                        align === 'right' && 'flex-row-reverse'
                      )}
                    >
                      {col.label}
                      {col.sortable !== false &&
                        (isSorted && sortDir === 'asc' ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : isSorted && sortDir === 'desc' ? (
                          <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        ))}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-10">
                  {emptyState ?? (
                    <EmptyState
                      title={filterActive ? 'No rows match your filters' : 'No data'}
                      message={
                        filterActive
                          ? 'Try clearing filters or adjusting your search.'
                          : 'Nothing to show yet.'
                      }
                      action={
                        filterActive ? (
                          <Button variant="outline" size="sm" onClick={clearAll}>
                            Clear filters
                          </Button>
                        ) : undefined
                      }
                    />
                  )}
                </td>
              </tr>
            ) : (
              sorted.map((row) => (
                <tr
                  key={getKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b last:border-b-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-[var(--bg-sunken)]'
                  )}
                  style={{
                    borderColor: 'var(--border-subtle)',
                    height: 'var(--row-h)',
                  }}
                >
                  {columns.map((col) => {
                    const align =
                      col.align ?? (col.type === 'money' || col.type === 'number' ? 'right' : 'left');
                    return (
                      <td
                        key={String(col.key)}
                        style={{ textAlign: align }}
                        className="px-3 py-2 text-[13px] align-middle"
                      >
                        <Cell column={col} row={row} />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
            {footer && sorted.length > 0 && (
              <tr
                style={{
                  backgroundColor: 'var(--bg-sunken)',
                  borderTop: '1px solid var(--border-default)',
                }}
              >
                {columns.map((col) => {
                  const align =
                    col.align ?? (col.type === 'money' || col.type === 'number' ? 'right' : 'left');
                  const v = footer[String(col.key)];
                  return (
                    <td
                      key={String(col.key)}
                      style={{ textAlign: align }}
                      className="px-3 py-2 text-[12.5px] font-semibold"
                    >
                      {v ?? ''}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
