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
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Inter-Company Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Subsidiary → Parent settlement. Amounts shown in the
            subsidiary's currency — FX conversion happens later, at the
            client-invoice consolidation step.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InterCompanyInvoiceStatus | 'ALL')}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="ALL">All statuses</option>
          {INTERCOMPANY_INVOICE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {INTERCOMPANY_INVOICE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">Failed to load: {error}</p>}

      {!loading && !error && invoices.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No inter-company invoices yet. The onIWOClosed trigger that
          raises these automatically lands in Phase 3.B (IWO state machine).
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Invoice</th>
              <th className="py-2">Flow</th>
              <th className="py-2">IWO</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2">Tax</th>
              <th className="py-2">GL</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-t">
                <td className="py-2 font-mono">{inv.id}</td>
                <td className="py-2 text-xs">
                  {inv.fromOrgId} → {inv.toOrgId}
                </td>
                <td className="py-2 font-mono text-xs">{inv.iwoId || '—'}</td>
                <td className="py-2 text-right font-mono">
                  {inv.amount.currency} {(inv.amount.amountMinor / 100).toLocaleString()}
                </td>
                <td className="py-2 text-xs">
                  {inv.taxTreatment.type} ({(inv.taxTreatment.rateBps / 100).toFixed(2)}%)
                </td>
                <td className="py-2">
                  {inv.postedToGL ? (
                    <span className="rounded bg-[var(--rag-green-soft)] px-2 py-0.5 text-xs text-[var(--rag-green)]">
                      Posted
                    </span>
                  ) : (
                    <span className="rounded bg-[var(--rag-amber-soft)] px-2 py-0.5 text-xs text-[var(--rag-amber)]">
                      Pending
                    </span>
                  )}
                </td>
                <td className="py-2 text-xs">
                  {INTERCOMPANY_INVOICE_STATUS_LABEL[inv.status]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default InterCompanyInvoicesPage;
