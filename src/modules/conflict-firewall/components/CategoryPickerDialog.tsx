/**
 * CategoryPickerDialog — Phase 6.UI.C.
 *
 * Modal picker shared between the Client Tags page and Walls page.
 * Subscribes to the `categories` collection and lets the user pick
 * one. `exclusive` toggle is surfaced for the client-tags case.
 */

import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { subscribeCategories } from '../services/conflict-firewall.service';
import type { Category, CategoryId } from '@/modules/contracts/types/conflict-firewall.types';
import { cn } from '@/shared/lib/utils';

interface Props {
  /** When non-null, the dialog is open. */
  open: boolean;
  title?: string;
  showExclusiveToggle?: boolean;
  onClose: () => void;
  onPick: (categoryId: CategoryId, opts: { exclusive: boolean }) => void;
}

export function CategoryPickerDialog({
  open,
  title = 'Pick a category',
  showExclusiveToggle = false,
  onClose,
  onPick,
}: Props) {
  const [rows, setRows] = useState<Category[]>([]);
  const [filter, setFilter] = useState('');
  const [exclusive, setExclusive] = useState(true);

  useEffect(() => {
    if (!open) return;
    const unsubscribe = subscribeCategories(setRows);
    return () => unsubscribe();
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  if (!open) return null;

  return (
    <div
      data-testid="category-picker-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] shadow-lg flex flex-col max-h-[70vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 p-3 border-b border-[var(--border-default)]">
          <h2 className="text-[14px] font-semibold text-[var(--fg-primary)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--fg-tertiary)] hover:text-[var(--fg-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-3 border-b border-[var(--border-default)]">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--fg-tertiary)]" aria-hidden="true" />
            <Input
              data-testid="category-picker-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter categories…"
              className="pl-8"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-[12.5px] text-[var(--fg-tertiary)] text-center">
              No matching categories.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border-default)]">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    data-testid={`category-picker-option-${c.id}`}
                    className={cn(
                      'w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-[var(--bg-sunken)]',
                      !c.isActive && 'opacity-50',
                    )}
                    disabled={!c.isActive}
                    onClick={() => onPick(c.id, { exclusive })}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-[var(--fg-primary)]">{c.name}</p>
                      {c.description && (
                        <p className="text-[11.5px] text-[var(--fg-tertiary)] truncate">
                          {c.description}
                        </p>
                      )}
                    </div>
                    <code className="font-mono text-[10.5px] text-[var(--fg-tertiary)]">
                      {c.id}
                    </code>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {showExclusiveToggle && (
          <footer className="p-3 border-t border-[var(--border-default)] flex items-center gap-2">
            <input
              id="exclusive-toggle"
              data-testid="category-picker-exclusive"
              type="checkbox"
              checked={exclusive}
              onChange={(e) => setExclusive(e.target.checked)}
            />
            <label htmlFor="exclusive-toggle" className="text-[12.5px] text-[var(--fg-secondary)]">
              Exclusive (the wall will block competing clients)
            </label>
          </footer>
        )}
        <footer className="p-3 border-t border-[var(--border-default)] flex justify-end">
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </footer>
      </div>
    </div>
  );
}
