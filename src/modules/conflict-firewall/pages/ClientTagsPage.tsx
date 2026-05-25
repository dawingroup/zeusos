/**
 * Conflict Firewall · Client Tags — Phase 6.UI.C.
 *
 * Lists clients with their current category tags + an "Add tag"
 * affordance per row that opens the `CategoryPickerDialog`. Tags
 * carry an `exclusive` flag — when true (the default), the firewall
 * blocks routing of competing clients to brands serving this one.
 */

import { useEffect, useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { Plus, X, Tag } from 'lucide-react';
import { subscribeClients } from '@/modules/contracts/services/firestore';
import type { Client } from '@/modules/contracts/types/client.types';
import type {
  Category,
  CategoryId,
  ClientCategory,
} from '@/modules/contracts/types/conflict-firewall.types';
import { Button } from '@/core/components/ui/button';
import {
  addClientCategoryFn,
  removeClientCategoryFn,
  subscribeCategories,
  subscribeClientCategories,
} from '../services/conflict-firewall.service';
import { CategoryPickerDialog } from '../components/CategoryPickerDialog';

export default function ClientTagsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [tags, setTags] = useState<ClientCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const u1 = subscribeClients(setClients);
    const u2 = subscribeClientCategories(setTags, (e) =>
      setErr(`Client tags subscription failed: ${e.message}`),
    );
    const u3 = subscribeCategories(setCategories);
    return () => { u1(); u2(); u3(); };
  }, []);

  const tagsByClient = useMemo(() => {
    const out: Record<string, ClientCategory[]> = {};
    for (const t of tags) {
      (out[t.clientId] ??= []).push(t);
    }
    return out;
  }, [tags]);

  const categoryName = (id: CategoryId): string =>
    categories.find((c) => c.id === id)?.name ?? id;

  const handlePick = async (
    clientId: string,
    categoryId: CategoryId,
    opts: { exclusive: boolean },
  ) => {
    setBusy(clientId);
    try {
      await addClientCategoryFn({ clientId, categoryId, exclusive: opts.exclusive });
      setPickerOpenFor(null);
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleRemove = async (clientId: string, categoryId: CategoryId) => {
    setBusy(`${clientId}__${categoryId}`);
    try {
      await removeClientCategoryFn({ clientId, categoryId });
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (clients.length === 0 && !err) {
    return (
      <p className="text-[13px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center">
        No clients found. Add clients in Account Management before tagging them.
      </p>
    );
  }

  return (
    <section data-testid="client-tags-page" className="space-y-3">
      {err && (
        <div
          role="alert"
          data-testid="client-tags-error"
          className="p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] text-[13px]"
        >
          {err}
        </div>
      )}

      <ul className="space-y-2">
        {clients.map((client) => {
          const rows = tagsByClient[client.id] ?? [];
          return (
            <li
              key={client.id}
              data-testid={`client-row-${client.id}`}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
            >
              <header className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-[var(--fg-primary)]">
                    {client.name}
                  </p>
                  {client.code && (
                    <p className="text-[11.5px] text-[var(--fg-tertiary)] font-mono">
                      {client.code}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  data-testid={`add-tag-btn-${client.id}`}
                  onClick={() => setPickerOpenFor(client.id)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Add tag
                </Button>
              </header>

              {rows.length === 0 ? (
                <p className="text-[11.5px] text-[var(--fg-tertiary)] italic">
                  No categories — this client doesn't trigger the firewall.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {rows.map((t) => (
                    <li
                      key={t.id}
                      data-testid={`tag-${client.id}-${t.categoryId}`}
                      className="inline-flex items-center gap-1.5 text-[11.5px] px-2 py-0.5 rounded-full border border-[var(--border-default)] bg-[var(--bg-sunken)]"
                    >
                      <Tag className="h-3 w-3 text-[var(--fg-tertiary)]" aria-hidden="true" />
                      <span className="text-[var(--fg-secondary)]">{categoryName(t.categoryId)}</span>
                      {t.exclusive ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                          excl
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-tertiary)]">
                          info
                        </span>
                      )}
                      <button
                        data-testid={`remove-tag-${client.id}-${t.categoryId}`}
                        onClick={() => handleRemove(client.id, t.categoryId)}
                        disabled={busy === `${client.id}__${t.categoryId}`}
                        aria-label={`Remove ${categoryName(t.categoryId)} tag`}
                        className="text-[var(--fg-tertiary)] hover:text-[var(--rag-red)] disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <CategoryPickerDialog
        open={pickerOpenFor !== null}
        title={pickerOpenFor ? `Tag ${clients.find((c) => c.id === pickerOpenFor)?.name ?? ''}` : ''}
        showExclusiveToggle
        onClose={() => setPickerOpenFor(null)}
        onPick={(categoryId, opts) => pickerOpenFor && handlePick(pickerOpenFor, categoryId, opts)}
      />
    </section>
  );
}
