/**
 * /talent/invoices — invoice queue with approve/reject actions (AM-only).
 */

import { useEffect, useState } from 'react';
import {
  listTalentInvoices,
} from '../services/talent-invoice.service';
import type { TalentInvoice, TalentInvoiceStatus } from '../types/talent-invoice.types';
import { InvoiceApprovalPanel } from '../components/InvoiceApprovalPanel';

const STATUS_OPTIONS: Array<TalentInvoiceStatus | 'ALL'> = [
  'ALL', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED',
];

export default function TalentInvoicesPage() {
  const [invoices, setInvoices] = useState<TalentInvoice[]>([]);
  const [statusFilter, setStatusFilter] = useState<TalentInvoiceStatus | 'ALL'>('SUBMITTED');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listTalentInvoices({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setInvoices(rows);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [statusFilter]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Talent Invoice Queue</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve freelancer invoices. Only Account Management staff can approve.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TalentInvoiceStatus | 'ALL')}
          className="rounded border px-2 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
          ))}
        </select>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading invoices…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && invoices.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No invoices in this status.
        </div>
      )}

      <div className="space-y-3">
        {invoices.map((inv) => (
          <InvoiceApprovalPanel key={inv.id} invoice={inv} onUpdated={reload} />
        ))}
      </div>
    </div>
  );
}
