/**
 * Conflict Firewall · Categories — Phase 6.UI.C.
 *
 * Admin-curated master list of competitive categories. IDs are
 * UPPER_SNAKE_CASE so they're diffable when the seed list grows.
 */

import { useEffect, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { Plus, Tag } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import {
  addCategoryFn,
  subscribeCategories,
} from '../services/conflict-firewall.service';
import type { Category } from '@/modules/contracts/types/conflict-firewall.types';

export default function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCategories(setRows, (e) =>
      setErr(`Categories subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  const reset = () => {
    setId('');
    setName('');
    setDescription('');
    setFormErr(null);
  };

  const submit = async () => {
    setBusy(true);
    setFormErr(null);
    try {
      await addCategoryFn({
        id: id.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
      reset();
      setShowForm(false);
    } catch (e) {
      setFormErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="categories-page" className="space-y-4">
      {err && (
        <div
          role="alert"
          data-testid="categories-error"
          className="p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] text-[13px]"
        >
          {err}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-[var(--fg-tertiary)]">
          {rows.length} {rows.length === 1 ? 'category' : 'categories'}
        </p>
        {!showForm ? (
          <Button size="sm" data-testid="add-category-btn" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            Add category
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); reset(); }}>
            Cancel
          </Button>
        )}
      </div>

      {showForm && (
        <div
          data-testid="add-category-form"
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              ID (UPPER_SNAKE_CASE)
            </label>
            <Input
              data-testid="category-id-input"
              value={id}
              onChange={(e) => setId(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
              placeholder="CARBONATED_BEVERAGE"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              Name
            </label>
            <Input
              data-testid="category-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Carbonated Beverage"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              Description (optional)
            </label>
            <Input
              data-testid="category-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Soft drinks, sodas, energy drinks"
            />
          </div>
          {formErr && (
            <p
              role="alert"
              data-testid="add-category-error"
              className="text-[12px] text-[var(--rag-red)]"
            >
              {formErr}
            </p>
          )}
          <Button
            data-testid="submit-category-btn"
            size="sm"
            disabled={busy || !id || !name}
            onClick={submit}
          >
            {busy ? 'Saving…' : 'Save category'}
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p
          data-testid="categories-empty"
          className="text-[13px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          No categories yet. Add the first one to start tagging clients.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((c) => (
            <li
              key={c.id}
              data-testid={`category-row-${c.id}`}
              className="flex items-center gap-3 p-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              <Tag className="h-3.5 w-3.5 text-[var(--fg-tertiary)] flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-[var(--fg-primary)]">
                  {c.name}
                </p>
                {c.description && (
                  <p className="text-[11.5px] text-[var(--fg-tertiary)] truncate">
                    {c.description}
                  </p>
                )}
              </div>
              <code className="font-mono text-[10.5px] text-[var(--fg-tertiary)]">
                {c.id}
              </code>
              {!c.isActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-sunken)] text-[var(--fg-tertiary)] uppercase tracking-wide">
                  Inactive
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
