/**
 * /procurement/purchase-orders/:poId — Detail view for a single PO with
 * its linked journal entry (if posted to GL).
 *
 * Shows the source invoice link, GL posting status, and breakdown of the
 * double-entry that posted on this PO's behalf.
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from '../services/purchase-order.service';
import { getJournalEntryForPO } from '../services/journal-entry.service';
import type {
  PurchaseOrder,
  PurchaseOrderStatus,
  CurrencyCode,
} from '../types/purchase-order.types';
import type { JournalEntry } from '../types/journal-entry.types';
import { PurchaseOrderStatusBadge } from '../components/PurchaseOrderStatusBadge';
import { PurchaseOrderKindBadge } from '../components/PurchaseOrderKindBadge';
import { getSupplier } from '@/modules/suppliers/services/supplier.service';
import type { Supplier } from '@/modules/suppliers/types/supplier.types';

const STATUSES: PurchaseOrderStatus[] = ['OPEN', 'POSTED', 'CLOSED', 'VOID'];
const CURRENCIES: CurrencyCode[] = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];

function formatMoney(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return '—';
}

export default function PurchaseOrderDetailPage() {
  const navigate = useNavigate();
  const { poId } = useParams<{ poId: string }>();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [je, setJe] = useState<JournalEntry | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<PurchaseOrder>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    if (!poId) return;
    const [poDoc, jeDoc] = await Promise.all([getPurchaseOrder(poId), getJournalEntryForPO(poId)]);
    setPo(poDoc);
    setJe(jeDoc);
    // Resolve supplierOrgId → Supplier (only relevant for media POs)
    if (poDoc?.supplierOrgId) {
      const s = await getSupplier(poDoc.supplierOrgId).catch(() => null);
      setSupplier(s);
    } else {
      setSupplier(null);
    }
  }

  useEffect(() => {
    if (!poId) return;
    setLoading(true);
    setError(null);
    reload()
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [poId]);

  const isManualVendor = po?.kind === 'VENDOR_OTHER';

  async function handleSave() {
    if (!poId || !po) return;
    setSaving(true);
    setError(null);
    try {
      await updatePurchaseOrder(poId, {
        amountMinor: draft.amountMinor ?? po.amountMinor,
        currency: (draft.currency ?? po.currency) as CurrencyCode,
        status: (draft.status ?? po.status) as PurchaseOrderStatus,
        masterJobId: draft.masterJobId ?? po.masterJobId,
        supplierOrgId: draft.supplierOrgId ?? po.supplierOrgId,
        sourceInvoiceId: draft.sourceInvoiceId ?? po.sourceInvoiceId,
        notes: draft.notes ?? po.notes,
      });
      await reload();
      setEditing(false);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!poId || !po) return;
    const ok = window.confirm(
      `Delete purchase order ${po.id}? This is permanent. ` +
      `Only manual VENDOR_OTHER POs can be deleted — auto-raised TALENT/MEDIA POs are protected by Firestore rules.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deletePurchaseOrder(poId);
      navigate('/procurement/purchase-orders');
    } catch (err) {
      setError(String((err as Error).message));
      setDeleting(false);
    }
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading purchase order…</p>;
  if (error && !po) return <p className="p-6 text-sm text-destructive">Error: {error}</p>;
  if (!po) return <p className="p-6 text-sm text-muted-foreground">Purchase order not found.</p>;

  return (
    <div className="space-y-6 p-6">
      <header>
        <Link
          to="/procurement/purchase-orders"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← All purchase orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-xl font-semibold" data-testid="po-id">{po.id}</h1>
            <PurchaseOrderKindBadge kind={po.kind} />
            <PurchaseOrderStatusBadge status={po.status} />
          </div>
          {isManualVendor && (
            <div className="flex gap-2">
              {!editing && (
                <button
                  type="button"
                  onClick={() => { setDraft(po); setEditing(true); }}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--bg-sunken)]"
                  data-testid="po-edit-btn"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded border border-[var(--rag-red)] px-3 py-1.5 text-sm text-[var(--rag-red)] hover:bg-[var(--rag-red-soft)] disabled:opacity-50"
                data-testid="po-delete-btn"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
        </div>
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {editing && isManualVendor && (
        <section className="rounded border bg-[var(--bg-sunken)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Edit PO</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="block text-xs text-muted-foreground">Amount (major units)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={((draft.amountMinor ?? po.amountMinor) / 100).toString()}
                onChange={e => setDraft(d => ({ ...d, amountMinor: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Currency</span>
              <select
                value={(draft.currency ?? po.currency) as string}
                onChange={e => setDraft(d => ({ ...d, currency: e.target.value as CurrencyCode }))}
                className="mt-1 w-full rounded border px-2 py-1"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Status</span>
              <select
                value={(draft.status ?? po.status) as string}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value as PurchaseOrderStatus }))}
                className="mt-1 w-full rounded border px-2 py-1"
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Master Job ID</span>
              <input
                value={draft.masterJobId ?? ''}
                onChange={e => setDraft(d => ({ ...d, masterJobId: e.target.value }))}
                className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Supplier org id</span>
              <input
                value={draft.supplierOrgId ?? ''}
                onChange={e => setDraft(d => ({ ...d, supplierOrgId: e.target.value }))}
                className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Source invoice / ref</span>
              <input
                value={draft.sourceInvoiceId ?? ''}
                onChange={e => setDraft(d => ({ ...d, sourceInvoiceId: e.target.value }))}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="col-span-2 block">
              <span className="block text-xs text-muted-foreground">Notes</span>
              <textarea
                value={draft.notes ?? ''}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded border px-3 py-1.5 text-sm hover:bg-card"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      <section className="rounded border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Procurement details</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Amount</dt>
            <dd className="font-medium" data-testid="po-amount">
              {formatMoney(po.amountMinor, po.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Master Job</dt>
            <dd className="font-mono text-xs">{po.masterJobId}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Source invoice</dt>
            <dd className="font-mono text-xs">{po.sourceInvoiceId}</dd>
          </div>
          {po.supplierProfileId && (
            <div>
              <dt className="text-xs text-muted-foreground">Talent profile</dt>
              <dd className="font-mono text-xs">{po.supplierProfileId}</dd>
            </div>
          )}
          {po.supplierOrgId && (
            <div>
              <dt className="text-xs text-muted-foreground">Supplier</dt>
              <dd className="text-xs">
                {supplier ? (
                  <Link
                    to={`/suppliers/${supplier.id}`}
                    className="hover:underline"
                    data-testid="po-supplier-link"
                  >
                    {supplier.name}
                  </Link>
                ) : (
                  <span className="font-mono text-muted-foreground">{po.supplierOrgId}</span>
                )}
              </dd>
            </div>
          )}
          {po.mediaPlanId && (
            <div>
              <dt className="text-xs text-muted-foreground">Media plan</dt>
              <dd className="font-mono text-xs">{po.mediaPlanId}</dd>
            </div>
          )}
          {po.vehicleType && (
            <div>
              <dt className="text-xs text-muted-foreground">Vehicle type</dt>
              <dd>{po.vehicleType}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-muted-foreground">Raised at</dt>
            <dd>{formatDate(po.raisedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">GL posted</dt>
            <dd>{po.postedToGL ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
        {po.notes && (
          <div className="mt-3 border-t pt-3">
            <dt className="text-xs text-muted-foreground mb-1">Notes</dt>
            <dd className="text-sm whitespace-pre-wrap">{po.notes}</dd>
          </div>
        )}
      </section>

      <section className="rounded border bg-card p-4" data-testid="po-je-section">
        <h2 className="mb-3 text-sm font-medium">Linked journal entry</h2>
        {!je && (
          <p className="text-sm text-muted-foreground">
            No journal entry posted yet. The finance consumer posts a JE within seconds
            of the PO being raised.
          </p>
        )}
        {je && (
          <>
            <div className="mb-4 flex items-center justify-between text-sm">
              <Link
                to={`/procurement/journal-entries/${je.id}`}
                className="font-mono text-xs hover:underline"
                data-testid="je-link"
              >
                {je.id}
              </Link>
              <span className="text-xs text-muted-foreground">
                Posted {formatDate(je.postedAt)}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left uppercase text-muted-foreground">
                    <th className="py-1 font-medium">Account</th>
                    <th className="py-1 text-right font-medium">Debit</th>
                    <th className="py-1 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {je.debits.map((line, i) => (
                    <tr key={`debit-${i}`} className="border-t">
                      <td className="py-1">
                        <span className="font-mono text-[10px]">{line.accountCode}</span>{' '}
                        <span className="text-muted-foreground">{line.accountName}</span>
                      </td>
                      <td className="py-1 text-right font-medium">
                        {formatMoney(line.amountMinor, je.currency)}
                      </td>
                      <td className="py-1 text-right text-muted-foreground">—</td>
                    </tr>
                  ))}
                  {je.credits.map((line, i) => (
                    <tr key={`credit-${i}`} className="border-t">
                      <td className="py-1">
                        <span className="font-mono text-[10px]">{line.accountCode}</span>{' '}
                        <span className="text-muted-foreground">{line.accountName}</span>
                      </td>
                      <td className="py-1 text-right text-muted-foreground">—</td>
                      <td className="py-1 text-right font-medium">
                        {formatMoney(line.amountMinor, je.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
