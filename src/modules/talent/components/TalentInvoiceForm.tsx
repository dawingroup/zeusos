/**
 * TalentInvoiceForm — freelancer submits an invoice (file upload + metadata).
 */

import { useState } from 'react';
import type { TalentInvoice } from '../types/talent-invoice.types';

interface Props {
  talentProfileId: string;
  contractId?: string;
  masterJobId?: string;
  onSave: (values: Omit<TalentInvoice, 'id' | 'status' | 'linkedPoId' | 'approvedBy' | 'approvedAt' | 'rejectedBy' | 'rejectedAt' | 'rejectionReason' | 'paidAt' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

export function TalentInvoiceForm({ talentProfileId, contractId, masterJobId, onSave, onCancel }: Props) {
  const [amountMinor, setAmountMinor] = useState(0);
  const [currency, setCurrency] = useState('UGX');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceRef.trim()) {
      setError('Please provide an invoice document reference or upload a file.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        talentProfileId,
        contractId,
        masterJobId,
        amountMinor,
        currency,
        invoiceStorageRef: invoiceRef,
        createdBy: 'current-user',
      });
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded border p-4">
      <h3 className="font-medium">Submit Invoice</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Amount (minor units)</label>
          <input
            required
            type="number"
            min={1}
            value={amountMinor}
            onChange={(e) => setAmountMinor(Number(e.target.value))}
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded border px-2 py-1.5 text-sm"
          >
            <option value="UGX">UGX</option>
            <option value="USD">USD</option>
            <option value="KES">KES</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Invoice Document
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            (storage path or upload reference — Phase 5 wires real upload)
          </span>
        </label>
        <input
          required
          value={invoiceRef}
          onChange={(e) => setInvoiceRef(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
          placeholder="invoices/2026/INV-001.pdf"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded border px-4 py-1.5 text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
        >
          {saving ? 'Submitting…' : 'Submit Invoice'}
        </button>
      </div>
    </form>
  );
}
