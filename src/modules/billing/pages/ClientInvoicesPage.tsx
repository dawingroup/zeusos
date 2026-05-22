/**
 * /billing/client-invoices — grouped by status.
 *
 * Standalone-slice scope: renders an empty state plus the filter shell
 * so the route + RBAC are working. Actual list rendering wires in once
 * Phase 3.D's AM UI lands and provides the Quote → Invoice flow.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listClientInvoices,
} from '../services/client-invoice.service';
import type {
  ClientInvoice,
  ClientInvoiceStatus,
} from '../types/client-invoice.types';
import {
  CLIENT_INVOICE_STATUSES,
  CLIENT_INVOICE_STATUS_LABEL,
} from '../constants/statuses';

export function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<ClientInvoiceStatus | 'ALL'>('ALL');
  const [clientIdFilter, setClientIdFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listClientInvoices({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      clientId: clientIdFilter || undefined,
    })
      .then((rows) => {
        if (!cancelled) setInvoices(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message ?? err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, clientIdFilter]);

  const grouped = useMemo(() => {
    const buckets: Record<string, ClientInvoice[]> = {};
    for (const inv of invoices) {
      (buckets[inv.status] ??= []).push(inv);
    }
    return buckets;
  }, [invoices]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Client Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Issued by Zeus Group to external clients. Subsidiary identity is
            never shown on these documents.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ClientInvoiceStatus | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
          >
            <option value="ALL">All statuses</option>
            {CLIENT_INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CLIENT_INVOICE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={clientIdFilter}
            onChange={(e) => setClientIdFilter(e.target.value)}
            placeholder="Filter by client ID"
            className="rounded border px-2 py-1 text-sm"
          />
        </div>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading invoices…</p>}
      {error && (
        <p className="text-sm text-destructive">Failed to load invoices: {error}</p>
      )}

      {!loading && !error && invoices.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No client invoices yet. The Quote → Invoice flow lands once
          Phase 3.C (Pricing) and Phase 3.D (AM UI) ship.
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="space-y-4">
          {CLIENT_INVOICE_STATUSES.map((status) => {
            const bucket = grouped[status];
            if (!bucket?.length) return null;
            return (
              <section key={status} className="space-y-2">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                  {CLIENT_INVOICE_STATUS_LABEL[status]} · {bucket.length}
                </h2>
                <ul className="divide-y rounded border">
                  {bucket.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between p-3">
                      <div>
                        <Link
                          to={`/billing/client-invoices/${inv.id}`}
                          className="font-mono text-sm hover:underline"
                        >
                          {inv.id}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          Client {inv.clientId} · Job {inv.masterJobId}
                        </div>
                      </div>
                      <div className="text-right font-mono text-sm">
                        {inv.total.currency} {(inv.total.amountMinor / 100).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClientInvoicesPage;
