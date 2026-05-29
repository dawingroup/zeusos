/**
 * /billing/intercompany — IC invoices. AM + Finance roles only.
 *
 * Standalone-slice scope: lists whatever IC invoices already exist in
 * Firestore and shows the From→To flow + "Posted to GL" badge. The
 * automatic raise happens when Phase 3.B's onIWOClosed trigger lands.
 */

import { useEffect, useState } from 'react';
import {
  listInterCompanyInvoices,
} from '../services/intercompany-invoice.service';
import type {
  InterCompanyInvoice,
  InterCompanyInvoiceStatus,
} from '../types/intercompany-invoice.types';
import {
  INTERCOMPANY_INVOICE_STATUSES,
  INTERCOMPANY_INVOICE_STATUS_LABEL,
} from '../constants/statuses';
import { PageHero, Pill } from '@/shared/components/refresh';

export function InterCompanyInvoicesPage() {
  const [invoices, setInvoices] = useState<InterCompanyInvoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<InterCompanyInvoiceStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listInterCompanyInvoices({
      status: statusFilter === 'ALL' ? undefined : statusFilter,
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
  }, [statusFilter]);

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <PageHero
        eyebrow="Billing · Inter-co"
        title="Inter-company invoices"
        body="Subsidiary → Parent settlement. Amounts shown in the subsidiary's currency — FX conversion happens later, at the client-invoice consolidation step."
        actions={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InterCompanyInvoiceStatus | 'ALL')}
            className="input"
            style={{ width: 'auto' }}
          >
            <option value="ALL">All statuses</option>
            {INTERCOMPANY_INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {INTERCOMPANY_INVOICE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        }
      />

      {loading && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading…</p>}
      {error && <p style={{ fontSize: 13, color: 'var(--rag-red)' }}>Failed to load: {error}</p>}

      {!loading && !error && invoices.length === 0 && (
        <div className="card card-pad" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}>
          No inter-company invoices yet. The onIWOClosed trigger that
          raises these automatically lands in Phase 3.B (IWO state machine).
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Flow</th>
                <th>IWO</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Tax</th>
                <th>GL</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{inv.id}</td>
                  <td style={{ fontSize: 12 }}>
                    {inv.fromOrgId} <span style={{ color: 'var(--fg-quaternary)' }}>→</span> {inv.toOrgId}
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{inv.iwoId || '—'}</td>
                  <td className="mono tabular" style={{ textAlign: 'right' }}>
                    {inv.amount.currency} {(inv.amount.amountMinor / 100).toLocaleString()}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                    {inv.taxTreatment.type} ({(inv.taxTreatment.rateBps / 100).toFixed(2)}%)
                  </td>
                  <td>
                    <Pill tone={inv.postedToGL ? 'green' : 'amber'} dot={false}>
                      {inv.postedToGL ? 'Posted' : 'Pending'}
                    </Pill>
                  </td>
                  <td style={{ fontSize: 12 }}>{INTERCOMPANY_INVOICE_STATUS_LABEL[inv.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default InterCompanyInvoicesPage;
