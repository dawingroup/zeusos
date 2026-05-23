/**
 * /production/new — create a new production job (TVC / Radio / Photo / etc).
 *
 * The job starts at stage BRIEF; stage advancement happens on the detail page
 * via advanceProductionStage (rule: one stage at a time, no skipping).
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import { createProductionJob } from '../services/production-job.service';
import type { ProductionJob, ProductionJobType } from '../types/production-job.types';
import { SUBSIDIARY_IDS } from '@/core/settings/types';

const TYPES: ProductionJobType[] = ['TVC', 'RADIO', 'PHOTOGRAPHY', 'PRINT', 'EXHIBITION', 'OTHER'];

export default function ProductionJobCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<ProductionJobType>('TVC');
  const [masterJobId, setMasterJobId] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [iwoId, setIwoId] = useState('');
  const [subsidiaryOrgId, setSubsidiaryOrgId] = useState<string>('zeus-the-agency');
  const [producerId, setProducerId] = useState('');
  const [scheduledShootDate, setScheduledShootDate] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);
    if (!title.trim()) return setError('Title is required');
    if (!masterJobId.trim()) return setError('Master Job ID is required');
    if (!producerId.trim()) return setError('Producer is required');

    setBusy(true);
    try {
      const job: Omit<ProductionJob, 'id' | 'stageHistory' | 'createdAt' | 'updatedAt'> = {
        title: title.trim(),
        type,
        masterJobId: masterJobId.trim(),
        campaignId: campaignId.trim() || undefined,
        iwoId: iwoId.trim() || undefined,
        stage: 'BRIEF',
        subsidiaryOrgId,
        producerId: producerId.trim(),
        scheduledShootDate: scheduledShootDate || undefined,
        notes: notes.trim() || undefined,
        createdBy: user?.uid || 'unknown',
      };
      const created = await createProductionJob(job);
      navigate(`/production/${created.id}`);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <Link to="/production" className="text-xs text-muted-foreground">← Production</Link>
      <h1 className="text-xl font-semibold">New production job</h1>

      {error && <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-2 gap-3 text-sm">
        <label className="col-span-2 block">
          <span className="block text-xs text-muted-foreground">Title *</span>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="e.g. Diageo Q3 TVC — Director's cut"
            autoFocus
            data-testid="production-title"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">Type *</span>
          <select
            value={type}
            onChange={e => setType(e.target.value as ProductionJobType)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">Subsidiary *</span>
          <select
            value={subsidiaryOrgId}
            onChange={e => setSubsidiaryOrgId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          >
            {SUBSIDIARY_IDS.filter(id => id !== 'zeus-group').map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">Master Job ID *</span>
          <input
            value={masterJobId}
            onChange={e => setMasterJobId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
            placeholder="mj_..."
            data-testid="production-master-job"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">IWO ID</span>
          <input
            value={iwoId}
            onChange={e => setIwoId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
            placeholder="iwo_... (optional)"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">Campaign ID</span>
          <input
            value={campaignId}
            onChange={e => setCampaignId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
            placeholder="(optional)"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">Producer *</span>
          <input
            value={producerId}
            onChange={e => setProducerId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="Producer user id or name"
            data-testid="production-producer"
          />
        </label>

        <label className="block">
          <span className="block text-xs text-muted-foreground">Scheduled shoot date</span>
          <input
            type="date"
            value={scheduledShootDate}
            onChange={e => setScheduledShootDate(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>

        <label className="col-span-2 block">
          <span className="block text-xs text-muted-foreground">Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          disabled={busy}
          className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          data-testid="production-create-btn"
        >
          {busy ? 'Creating…' : 'Create job'}
        </button>
        <Link to="/production" className="rounded border px-3 py-1.5 text-sm hover:bg-slate-50">Cancel</Link>
      </div>
    </div>
  );
}
