/**
 * Conflict Firewall · Walls — Phase 6.UI.C.
 *
 * Lists every conflict_wall row. Each row pins a (brand, category,
 * client) triple — `routeBrand`'s `excludeConflicted` queries this
 * collection to decide whether a candidate brand is already serving
 * a competitor in the same category.
 *
 * Manual creation opens a small editor (client picker + brand picker
 * + category picker + free-text notes). Removal is one-click and
 * calls `removeConflictWall`.
 */

import { useEffect, useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { Plus, X, Shield } from 'lucide-react';
// Local mirror of the 5 delivery sub-brands. PR 1
// (`src/core/settings/brand-capabilities.ts`) hoists this into a
// shared module — once that lands, replace this local list with
// `import { ALL_DELIVERY_SUBSIDIARIES }`.
type DeliverySubsidiaryId =
  | 'zeus-the-agency'
  | 'zeus-digital'
  | 'labyrinth'
  | 'odd-gorilla'
  | 'house-of-zeus';
const ALL_DELIVERY_SUBSIDIARIES: DeliverySubsidiaryId[] = [
  'zeus-the-agency',
  'zeus-digital',
  'labyrinth',
  'odd-gorilla',
  'house-of-zeus',
];
import { subscribeClients } from '@/modules/contracts/services/firestore';
import type { Client } from '@/modules/contracts/types/client.types';
import type {
  Category,
  CategoryId,
  ConflictWall,
  ConflictWallReason,
} from '@/modules/contracts/types/conflict-firewall.types';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import {
  addConflictWallFn,
  removeConflictWallFn,
  subscribeCategories,
  subscribeConflictWalls,
} from '../services/conflict-firewall.service';

const REASONS: ConflictWallReason[] = [
  'MANUAL_OVERRIDE',
  'EXCLUSIVE_RETAINER',
  'SERVING_ACCOUNT',
  'COMPETITOR_CLAUSE',
];

export default function WallsPage() {
  const [walls, setWalls] = useState<ConflictWall[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Filters
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');

  // New-wall form
  const [showForm, setShowForm] = useState(false);
  const [formClientId, setFormClientId] = useState('');
  const [formBrand, setFormBrand] = useState<DeliverySubsidiaryId>('zeus-the-agency');
  const [formCategoryId, setFormCategoryId] = useState<CategoryId>('');
  const [formReason, setFormReason] = useState<ConflictWallReason>('MANUAL_OVERRIDE');
  const [formNotes, setFormNotes] = useState('');
  const [formErr, setFormErr] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeConflictWalls(setWalls, (e) =>
      setErr(`Walls subscription failed: ${e.message}`),
    );
    const u2 = subscribeClients(setClients);
    const u3 = subscribeCategories(setCategories);
    return () => { u1(); u2(); u3(); };
  }, []);

  const clientName = (id: string): string =>
    clients.find((c) => c.id === id)?.name ?? id;
  const categoryName = (id: string): string =>
    categories.find((c) => c.id === id)?.name ?? id;

  const filteredWalls = useMemo(() => {
    return walls.filter((w) => {
      if (brandFilter && w.servingOrgId !== brandFilter) return false;
      if (categoryFilter && w.categoryId !== categoryFilter) return false;
      return true;
    });
  }, [walls, brandFilter, categoryFilter]);

  const submit = async () => {
    setBusy('new');
    setFormErr(null);
    try {
      await addConflictWallFn({
        clientId: formClientId,
        servingOrgId: formBrand,
        categoryId: formCategoryId,
        reason: formReason,
        notes: formNotes.trim() || undefined,
      });
      setShowForm(false);
      setFormClientId('');
      setFormCategoryId('');
      setFormNotes('');
    } catch (e) {
      setFormErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (wallId: string) => {
    setBusy(wallId);
    try {
      await removeConflictWallFn({ wallId });
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section data-testid="walls-page" className="space-y-4">
      {err && (
        <div
          role="alert"
          data-testid="walls-error"
          className="p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] text-[13px]"
        >
          {err}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
            Brand
          </span>
          <select
            data-testid="walls-brand-filter"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
          >
            <option value="">All brands</option>
            {ALL_DELIVERY_SUBSIDIARIES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
            Category
          </span>
          <select
            data-testid="walls-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <div className="ml-auto">
          {!showForm ? (
            <Button size="sm" data-testid="add-wall-btn" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Add wall
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* New-wall form */}
      {showForm && (
        <div
          data-testid="add-wall-form"
          className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
                Client
              </span>
              <select
                data-testid="wall-client-input"
                value={formClientId}
                onChange={(e) => setFormClientId(e.target.value)}
                className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
              >
                <option value="">— Pick client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
                Brand (servingOrgId)
              </span>
              <select
                data-testid="wall-brand-input"
                value={formBrand}
                onChange={(e) => setFormBrand(e.target.value as DeliverySubsidiaryId)}
                className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
              >
                {ALL_DELIVERY_SUBSIDIARIES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
                Category
              </span>
              <select
                data-testid="wall-category-input"
                value={formCategoryId}
                onChange={(e) => setFormCategoryId(e.target.value as CategoryId)}
                className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
              >
                <option value="">— Pick category —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
                Reason
              </span>
              <select
                data-testid="wall-reason-input"
                value={formReason}
                onChange={(e) => setFormReason(e.target.value as ConflictWallReason)}
                className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
              >
                {REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
              Notes (recommended)
            </span>
            <Input
              data-testid="wall-notes-input"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Why is this wall going up?"
            />
          </label>
          {formErr && (
            <p role="alert" data-testid="add-wall-error" className="text-[12px] text-[var(--rag-red)]">
              {formErr}
            </p>
          )}
          <Button
            data-testid="submit-wall-btn"
            size="sm"
            disabled={busy === 'new' || !formClientId || !formCategoryId}
            onClick={submit}
          >
            {busy === 'new' ? 'Saving…' : 'Create wall'}
          </Button>
        </div>
      )}

      {/* Walls list */}
      <p className="text-[12px] text-[var(--fg-tertiary)]">
        Showing <strong>{filteredWalls.length}</strong> of {walls.length}{' '}
        {walls.length === 1 ? 'wall' : 'walls'}.
      </p>

      {filteredWalls.length === 0 ? (
        <p
          data-testid="walls-empty"
          className="text-[13px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          No walls match the current filters.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {filteredWalls.map((w) => (
            <li
              key={w.id}
              data-testid={`wall-row-${w.id}`}
              className="flex items-center gap-3 p-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)]"
            >
              <Shield className="h-3.5 w-3.5 text-[var(--accent)] flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-[var(--fg-primary)]">
                  <strong>{w.servingOrgId}</strong> serves <strong>{clientName(w.clientId)}</strong> in{' '}
                  <strong>{categoryName(w.categoryId)}</strong>
                </p>
                <p className="text-[11px] text-[var(--fg-tertiary)]">
                  {w.reason}
                  {w.notes ? ` · ${w.notes}` : ''}
                </p>
              </div>
              <button
                onClick={() => remove(w.id)}
                disabled={busy === w.id}
                data-testid={`remove-wall-${w.id}`}
                aria-label="Remove wall"
                className="text-[var(--fg-tertiary)] hover:text-[var(--rag-red)] disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
