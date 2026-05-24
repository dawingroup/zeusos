/**
 * FreelancerContractForm — inline form for creating a contract on a talent
 * profile. Used from FreelancerContractsPage and (optionally) the contracts
 * tab on TalentProfilePage.
 *
 * The form takes the major-unit fee in the user-visible field and converts
 * to minor units before handing the value to the service layer (which
 * persists `totalFeeMinor`). Keep the conversion here so callers don't have
 * to remember to multiply.
 */

import { useState } from 'react';
import type { ContractStatus, FreelancerContract } from '../types/freelancer-contract.types';

const STATUS_OPTIONS: ContractStatus[] = ['DRAFT', 'SIGNED', 'EXPIRED'];
const CURRENCIES = ['UGX', 'USD', 'KES', 'EUR', 'GBP'] as const;

interface Props {
  talentProfileId: string;
  createdBy: string;
  onSave: (
    values: Omit<FreelancerContract, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;
  onCancel: () => void;
}

export function FreelancerContractForm({ talentProfileId, createdBy, onSave, onCancel }: Props) {
  const [projectTitle, setProjectTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalFee, setTotalFee] = useState('');
  const [currency, setCurrency] = useState<typeof CURRENCIES[number]>('UGX');
  const [status, setStatus] = useState<ContractStatus>('DRAFT');
  const [signedContractStorageRef, setSignedContractStorageRef] = useState('');
  const [notes, setNotes] = useState('');
  const [masterJobId, setMasterJobId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!projectTitle.trim() || !startDate || !endDate || !totalFee) {
      setError('Project title, dates, and fee are required.');
      return;
    }
    if (endDate < startDate) {
      setError('End date must be on or after start date.');
      return;
    }
    const feeNumber = Number(totalFee);
    if (!Number.isFinite(feeNumber) || feeNumber <= 0) {
      setError('Total fee must be a positive number.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        talentProfileId,
        projectTitle: projectTitle.trim(),
        startDate,
        endDate,
        totalFeeMinor: Math.round(feeNumber * 100),
        currency,
        status,
        signedContractStorageRef: signedContractStorageRef.trim() || undefined,
        notes: notes.trim() || undefined,
        masterJobId: masterJobId.trim() || undefined,
        createdBy,
      });
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded border bg-card p-4"
      data-testid="freelancer-contract-form"
    >
      <h3 className="text-sm font-medium">New contract</h3>

      <div>
        <label className="mb-1 block text-xs font-medium">Project title *</label>
        <input
          required
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
          placeholder="e.g. Pilsner Lite — print campaign Q3"
          className="w-full rounded border px-2 py-1.5 text-sm"
          data-testid="contract-title"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Start date *</label>
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded border px-2 py-1.5 text-sm"
            data-testid="contract-start"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">End date *</label>
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded border px-2 py-1.5 text-sm"
            data-testid="contract-end"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className="mb-1 block text-xs font-medium">Total fee *</label>
          <input
            required
            type="number"
            min={0}
            step="any"
            value={totalFee}
            onChange={(e) => setTotalFee(e.target.value)}
            placeholder="e.g. 1500000"
            className="w-full rounded border px-2 py-1.5 text-sm"
            data-testid="contract-fee"
          />
          <p className="mt-1 text-xs text-muted-foreground">Major units ({currency}).</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as typeof CURRENCIES[number])}
            className="w-full rounded border px-2 py-1.5 text-sm"
          >
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContractStatus)}
            className="w-full rounded border px-2 py-1.5 text-sm"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Master job ID (optional)</label>
          <input
            value={masterJobId}
            onChange={(e) => setMasterJobId(e.target.value)}
            placeholder="link to master_job/{id}"
            className="w-full rounded border px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Signed contract reference</label>
        <input
          value={signedContractStorageRef}
          onChange={(e) => setSignedContractStorageRef(e.target.value)}
          placeholder="contracts/2026/INV-001.pdf"
          className="w-full rounded border px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
        />
      </div>

      {error && <p className="text-sm text-destructive" data-testid="contract-form-error">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded border px-4 py-1.5 text-sm">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          data-testid="contract-submit"
        >
          {saving ? 'Creating…' : 'Create contract'}
        </button>
      </div>
    </form>
  );
}
