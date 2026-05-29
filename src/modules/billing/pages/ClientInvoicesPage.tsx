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
import { PageHero, Pill, type RagTone } from '@/shared/components/refresh';

function invoiceTone(status: string): RagTone {
  const s = status.toUpperCase();
  if (s.includes('PAID')) return 'green';
  if (s.includes('OVERDUE') || s.includes('VOID') || s.includes('CANCEL')) return 'red';
  if (s.includes('ISSUED') || s.includes('SENT')) return 'blue';
  return 'neutral';
}

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
    <div style={{ padding: 'var(--pad-page)' }}>
      <PageHero
        eyebrow="Billing · Parent-org"
        title="Client invoices"
        body="Issued by Zeus Group to external clients. Subsidiary identity is never shown on these documents."
        actions={
          <>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ClientInvoiceStatus | 'ALL')}
              className="input"
              style={{ width: 'auto' }}
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
              className="input"
              style={{ width: 180 }}
            />
          </>
        }
      />

      {loading && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading invoices…</p>}
      {error && <p style={{ fontSize: 13, color: 'var(--rag-red)' }}>Failed to load invoices: {error}</p>}

      {!loading && !error && invoices.length === 0 && (
        <div className="card card-pad" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}>
          No client invoices yet. The Quote → Invoice flow lands once
          Phase 3.C (Pricing) and Phase 3.D (AM UI) ship.
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {CLIENT_INVOICE_STATUSES.map((status) => {
            const bucket = grouped[status];
            if (!bucket?.length) return null;
            return (
              <section key={status}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 10px' }}>
                  <Pill tone={invoiceTone(status)}>{CLIENT_INVOICE_STATUS_LABEL[status]}</Pill>
                  <span className="tabular" style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{bucket.length}</span>
                </div>
                <div className="card" style={{ overflow: 'hidden' }}>
                  {bucket.map((inv) => (
                    <Link
                      key={inv.id}
                      to={`/billing/client-invoices/${inv.id}`}
                      className="list-row"
                      style={{ justifyContent: 'space-between' }}
                    >
                      <div>
                        <div className="ttl mono">{inv.id}</div>
                        <div className="meta">
                          Client {inv.clientId} <span className="sep">·</span> Job {inv.masterJobId}
                        </div>
                      </div>
                      <div className="mono tabular" style={{ fontWeight: 600 }}>
                        {inv.total.currency} {(inv.total.amountMinor / 100).toLocaleString()}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClientInvoicesPage;
