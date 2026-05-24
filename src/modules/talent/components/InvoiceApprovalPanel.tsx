/**
 * InvoiceApprovalPanel — AM-facing approval/reject controls for a talent invoice.
 */

import { useState } from 'react';
import type { TalentInvoice } from '../types/talent-invoice.types';
import {
  approveTalentInvoice,
  rejectTalentInvoice,
} from '../services/talent-invoice.service';

interface Props {
  invoice: TalentInvoice;
  onUpdated: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  APPROVED:  'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  PAID:      'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  REJECTED:  'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
};

export function InvoiceApprovalPanel({ invoice, onUpdated }: Props) {
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    try {
      await approveTalentInvoice(invoice.id, 'current-user');
      onUpdated();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await rejectTalentInvoice(invoice.id, 'current-user', rejectionReason);
      setShowRejectForm(false);
      onUpdated();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">Invoice #{invoice.id.slice(-6)}</p>
          <p className="text-xs text-muted-foreground">
            {invoice.currency} {(invoice.amountMinor / 100).toLocaleString()} ·{' '}
            <a href={invoice.invoiceStorageRef} target="_blank" rel="noreferrer" className="underline">
              View document
            </a>
          </p>
        </div>
        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[invoice.status] ?? ''}`}>
          {invoice.status}
        </span>
      </div>

      {invoice.status === 'SUBMITTED' && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="rounded bg-[var(--rag-green)] px-3 py-1.5 text-sm text-white disabled:opacity-60"
          >
            Approve
          </button>
          <button
            onClick={() => setShowRejectForm(true)}
            disabled={loading}
            className="rounded border border-[var(--rag-red)] px-3 py-1.5 text-sm text-[var(--rag-red)] disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}

      {showRejectForm && (
        <div className="space-y-2">
          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={2}
            placeholder="Reason for rejection…"
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleReject}
              disabled={loading || !rejectionReason.trim()}
              className="rounded bg-[var(--rag-red)] px-3 py-1.5 text-sm text-white disabled:opacity-60"
            >
              Confirm Reject
            </button>
            <button
              onClick={() => setShowRejectForm(false)}
              className="rounded border px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {invoice.status === 'REJECTED' && invoice.rejectionReason && (
        <p className="text-sm text-[var(--rag-red)]">
          Rejected: {invoice.rejectionReason}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
