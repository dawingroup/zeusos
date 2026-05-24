/**
 * /clients/:clientId/msas/(new|:msaId) — create or edit an MSA.
 * On ACTIVATE the MSA transitions DRAFT → ACTIVE (Cloud Function call,
 * emits no domain event but unlocks SOW submissions per spec §4.2).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getMsa } from '@/modules/contracts/services/firestore';
import { activateMsaFn, upsertMsaFn } from '@/modules/contracts/services/firebase';
import type { MSA } from '@/modules/contracts/types/msa.types';
import type { Timestamp } from 'firebase/firestore';

function toDateInput(v: Timestamp | string | undefined): string {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  try {
    const d = (v as Timestamp).toDate();
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export default function MSAEditorPage() {
  const { clientId, msaId } = useParams<{ clientId: string; msaId?: string }>();
  const navigate = useNavigate();
  const isExisting = !!msaId && msaId !== 'new';

  const [msa, setMsa] = useState<MSA | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [hasNda, setHasNda] = useState(false);
  const [agreementDocRef, setAgreementDocRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isExisting);

  useEffect(() => {
    if (!isExisting || !msaId) return;
    getMsa(msaId).then(m => {
      setMsa(m);
      if (m) {
        setTitle(m.title);
        setCode(m.code);
        setEffectiveFrom(toDateInput(m.effectiveFrom));
        setEffectiveTo(toDateInput(m.effectiveTo));
        setHasNda(!!m.hasNda);
        setAgreementDocRef(m.agreementDocRef || '');
      }
      setLoading(false);
    });
  }, [isExisting, msaId]);

  const isDraft = !msa || msa.status === 'DRAFT';

  const handleSave = async () => {
    if (!clientId) return;
    if (!title.trim()) return alert('Title required');
    if (!effectiveFrom) return alert('Effective from required');
    setBusy(true);
    try {
      const { data } = await upsertMsaFn({
        id: msa?.id,
        clientId,
        title: title.trim(),
        code: code.trim() || undefined,
        effectiveFrom,
        effectiveTo: effectiveTo || undefined,
        hasNda,
        agreementDocRef: agreementDocRef.trim() || undefined,
      });
      if (!isExisting) navigate(`/clients/${clientId}/msas/${data.id}`);
      else {
        const refreshed = await getMsa(data.id);
        setMsa(refreshed);
      }
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async () => {
    if (!msa) return;
    if (!confirm('Activate this MSA? Once ACTIVE it can no longer be edited.')) return;
    setBusy(true);
    try {
      await activateMsaFn({ msaId: msa.id });
      const refreshed = await getMsa(msa.id);
      setMsa(refreshed);
    } catch (err) {
      alert(`Activate failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link to={`/clients/${clientId}`} className="text-xs text-muted-foreground">← Client</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {isExisting ? `MSA ${msa?.code || msa?.id}` : 'New MSA'}
          </h1>
          {msa && <p className="text-sm text-muted-foreground">Status: {msa.status}</p>}
        </div>
        {msa && msa.status === 'DRAFT' && (
          <button
            onClick={handleActivate}
            disabled={busy}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            Activate (DRAFT → ACTIVE)
          </button>
        )}
      </header>

      <fieldset disabled={!isDraft} className="space-y-3 disabled:opacity-60">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2 block">
            <span className="block text-xs text-muted-foreground">Title *</span>
            <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Code (auto if blank)</span>
            <input value={code} onChange={e => setCode(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Has NDA</span>
            <input type="checkbox" checked={hasNda} onChange={e => setHasNda(e.target.checked)} className="mt-2" />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Effective from *</span>
            <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Effective to (optional)</span>
            <input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
          <label className="col-span-2 block">
            <span className="block text-xs text-muted-foreground">Agreement doc reference (Storage path)</span>
            <input value={agreementDocRef} onChange={e => setAgreementDocRef(e.target.value)} placeholder="e.g. gs://zeusos.firebasestorage.app/msas/…" className="mt-1 w-full rounded border px-2 py-1" />
          </label>
        </div>

        {isDraft && (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={busy} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {busy ? 'Saving…' : isExisting ? 'Save' : 'Create'}
            </button>
            <Link to={`/clients/${clientId}`} className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--bg-sunken)]">Cancel</Link>
          </div>
        )}
      </fieldset>

      {msa && msa.status !== 'DRAFT' && (
        <p className="text-xs text-muted-foreground">
          MSA is {msa.status} — fields are read-only. SOWs continue to be editable until activated.
        </p>
      )}
    </div>
  );
}
