/**
 * /procurement/purchase-orders/new — manual VENDOR_OTHER PO entry.
 *
 * TALENT_FREELANCER and MEDIA_SUPPLIER POs are auto-raised by Cloud
 * Functions when their upstream invoices land. This form covers the
 * remaining bucket: print runs, props, catering, ad-hoc vendor spend
 * that doesn't flow through the talent/media invoice path.
 *
 * Rules enforce: only admin can write, only kind=VENDOR_OTHER.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { createManualPurchaseOrder } from '../services/purchase-order.service';
import type { CurrencyCode } from '../types/purchase-order.types';

const DEFAULT_ORG_ID = 'default';
const CURRENCIES: CurrencyCode[] = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];

export default function PurchaseOrderCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = (user as { organizationId?: string })?.organizationId || DEFAULT_ORG_ID;

  const [supplierOrgId, setSupplierOrgId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('UGX');
  const [masterJobId, setMasterJobId] = useState('');
  const [sourceInvoiceId, setSourceInvoiceId] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!masterJobId.trim()) return setError('Master Job ID is required');
    const amountNum = parseFloat(amount);
    if (Number.isNaN(amountNum) || amountNum <= 0) return setError('Amount must be a positive number');

    setBusy(true);
    try {
      const po = await createManualPurchaseOrder({
        orgId,
        supplierOrgId: supplierOrgId.trim() || undefined,
        amountMinor: Math.round(amountNum * 100),
        currency,
        masterJobId: masterJobId.trim(),
        sourceInvoiceId: sourceInvoiceId.trim() || undefined,
        notes: notes.trim() || undefined,
        raisedBy: user?.uid || 'unknown',
      });
      navigate(`/procurement/purchase-orders/${po.id}`);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/procurement/purchase-orders" className="text-xs text-muted-foreground">← Purchase Orders</Link>
      <h1 className="text-xl font-semibold">New manual purchase order</h1>
      <p className="text-xs text-muted-foreground">
        VENDOR_OTHER only — for one-off vendor spend that doesn't come through
        the talent or media supplier invoice flow. Admin only.
      </p>

      {error && <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="block">
          <span className="block text-xs text-muted-foreground">Supplier org id</span>
          <input
            value={supplierOrgId}
            onChange={e => setSupplierOrgId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
            placeholder="(optional)"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">Master Job ID *</span>
          <input
            value={masterJobId}
            onChange={e => setMasterJobId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
            placeholder="mj_..."
            data-testid="po-master-job"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">Amount * (major units)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="e.g. 2500000"
            data-testid="po-amount"
            autoFocus
          />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">Currency *</span>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value as CurrencyCode)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className="col-span-2 block">
          <span className="block text-xs text-muted-foreground">Source invoice / ref</span>
          <input
            value={sourceInvoiceId}
            onChange={e => setSourceInvoiceId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="Supplier invoice number or external reference (optional)"
          />
        </label>

        <label className="col-span-2 block">
          <span className="block text-xs text-muted-foreground">Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="What is this for? (e.g. Diageo Q3 TVC — props supplier)"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={busy}
          className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          data-testid="po-create-btn"
        >
          {busy ? 'Creating…' : 'Create PO'}
        </button>
        <Link to="/procurement/purchase-orders" className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--bg-sunken)]">Cancel</Link>
      </div>
    </div>
  );
}
