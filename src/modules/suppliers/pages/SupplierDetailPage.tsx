/**
 * /suppliers/:supplierId — detail view with status actions
 * (activate / deactivate / blacklist).
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import {
  getSupplier,
  activateSupplier,
  deactivateSupplier,
  blacklistSupplier,
} from '../services/supplier.service';
import type { Supplier } from '../types/supplier.types';
import { SupplierKindBadge } from '../components/SupplierKindBadge';
import { SupplierStatusBadge } from '../components/SupplierStatusBadge';

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return '—';
}

export default function SupplierDetailPage() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const { user } = useAuth();
  const userId = user?.uid ?? 'unknown-user';

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  async function reload() {
    if (!supplierId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getSupplier(supplierId);
      setSupplier(result);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [supplierId]);

  async function handleDeactivate() {
    if (!supplierId) return;
    if (!confirm('Deactivate this supplier? They will be hidden from default lists.')) return;
    setActionPending(true);
    try {
      await deactivateSupplier(supplierId);
      await reload();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setActionPending(false);
    }
  }

  async function handleActivate() {
    if (!supplierId) return;
    setActionPending(true);
    try {
      await activateSupplier(supplierId);
      await reload();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setActionPending(false);
    }
  }

  async function handleBlacklist() {
    if (!supplierId) return;
    const reason = prompt('Reason for blacklisting? (required for audit log)');
    if (!reason || !reason.trim()) return;
    setActionPending(true);
    try {
      await blacklistSupplier(supplierId, userId, reason);
      await reload();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setActionPending(false);
    }
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading supplier…</p>;
  if (error) return <p className="p-6 text-sm text-destructive">Error: {error}</p>;
  if (!supplier) return <p className="p-6 text-sm text-muted-foreground">Supplier not found.</p>;

  return (
    <div className="space-y-6 p-6">
      <header>
        <Link to="/suppliers" className="text-xs text-muted-foreground hover:underline">
          ← All suppliers
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold" data-testid="supplier-name">{supplier.name}</h1>
            <SupplierKindBadge kind={supplier.kind} />
            <SupplierStatusBadge status={supplier.status} />
          </div>
          <div className="flex gap-2">
            <Link
              to={`/suppliers/${supplier.id}/edit`}
              className="rounded border px-3 py-1 text-sm"
              data-testid="supplier-edit"
            >
              Edit
            </Link>
            {supplier.status === 'ACTIVE' && (
              <button
                onClick={handleDeactivate}
                disabled={actionPending}
                className="rounded border px-3 py-1 text-sm disabled:opacity-60"
              >
                Deactivate
              </button>
            )}
            {supplier.status === 'INACTIVE' && (
              <button
                onClick={handleActivate}
                disabled={actionPending}
                className="rounded border px-3 py-1 text-sm disabled:opacity-60"
              >
                Reactivate
              </button>
            )}
            {supplier.status !== 'BLACKLISTED' && (
              <button
                onClick={handleBlacklist}
                disabled={actionPending}
                className="rounded border border-[var(--rag-red)] px-3 py-1 text-sm text-[var(--rag-red)] disabled:opacity-60"
              >
                Blacklist…
              </button>
            )}
            {supplier.status === 'BLACKLISTED' && (
              <button
                onClick={handleActivate}
                disabled={actionPending}
                className="rounded border border-[var(--rag-red)] px-3 py-1 text-sm text-[var(--rag-red)] disabled:opacity-60"
              >
                Lift blacklist
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="rounded border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Profile</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Country</dt>
            <dd>{supplier.countryCode ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Currency</dt>
            <dd>{supplier.currency}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Payment terms</dt>
            <dd>{supplier.paymentTerms}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Tax ID</dt>
            <dd className="font-mono text-xs">{supplier.taxId ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Created</dt>
            <dd>{formatDate(supplier.createdAt)}</dd>
          </div>
        </dl>
      </section>

      {supplier.primaryContact && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium">Primary contact</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Name</dt>
              <dd>{supplier.primaryContact.name}</dd>
            </div>
            {supplier.primaryContact.role && (
              <div>
                <dt className="text-xs text-muted-foreground">Role</dt>
                <dd>{supplier.primaryContact.role}</dd>
              </div>
            )}
            {supplier.primaryContact.email && (
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd>
                  <a href={`mailto:${supplier.primaryContact.email}`} className="hover:underline">
                    {supplier.primaryContact.email}
                  </a>
                </dd>
              </div>
            )}
            {supplier.primaryContact.phone && (
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd>{supplier.primaryContact.phone}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      {supplier.address && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">Address</h2>
          <p className="whitespace-pre-line text-sm">{supplier.address}</p>
        </section>
      )}

      {supplier.notes && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">Notes</h2>
          <p className="whitespace-pre-line text-sm">{supplier.notes}</p>
        </section>
      )}

      {supplier.tags && supplier.tags.length > 0 && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">Tags</h2>
          <div className="flex flex-wrap gap-1">
            {supplier.tags.map((t) => (
              <span key={t} className="rounded bg-muted px-2 py-0.5 text-xs">{t}</span>
            ))}
          </div>
        </section>
      )}

      {supplier.status === 'BLACKLISTED' && supplier.blacklistReason && (
        <section className="rounded border border-[var(--rag-red)] bg-[var(--rag-red-soft)] p-4">
          <h2 className="mb-2 text-sm font-medium text-[var(--rag-red)]">Blacklisted</h2>
          <p className="text-sm text-[var(--rag-red)]">{supplier.blacklistReason}</p>
          <p className="mt-1 text-xs text-[var(--rag-red)]">
            on {formatDate(supplier.blacklistedAt)} by {supplier.blacklistedBy}
          </p>
        </section>
      )}
    </div>
  );
}
