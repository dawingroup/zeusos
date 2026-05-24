/**
 * /clients/:clientId/msas/:msaId/sows/(new|:sowId) — SOW editor.
 *
 * State machine (spec §6.2):
 *   DRAFT → PENDING_APPROVAL → ACTIVE → CLOSED
 *                                    └→ CANCELLED
 *
 * Only DRAFT SOWs are editable. The approve button is gated on
 * PENDING_APPROVAL. Approving emits `SowActivated` (spec §10) which the
 * pricing engine listens for.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSow, getMsa } from '@/modules/contracts/services/firestore';
import {
  approveSowFn,
  cancelSowFn,
  submitSowForApprovalFn,
  upsertSowFn,
} from '@/modules/contracts/services/firebase';
import type { SOW } from '@/modules/contracts/types/sow.types';
import type { MSA } from '@/modules/contracts/types/msa.types';
import type { Timestamp } from 'firebase/firestore';
import { formatMinor, parseMajorToMinor } from '../utils/money';

function toDateInput(v: Timestamp | string | undefined): string {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  try {
    return (v as Timestamp).toDate().toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

const CURRENCIES: SOW['currency'][] = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];

export default function SOWEditorPage() {
  const { clientId, msaId, sowId } = useParams<{ clientId: string; msaId: string; sowId?: string }>();
  const navigate = useNavigate();
  const isExisting = !!sowId && sowId !== 'new';

  const [sow, setSow] = useState<SOW | null>(null);
  const [msa, setMsa] = useState<MSA | null>(null);
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [type, setType] = useState<SOW['type']>('PROJECT');
  const [ceilingMajor, setCeilingMajor] = useState('');
  const [currency, setCurrency] = useState<SOW['currency']>('USD');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scopeDocRef, setScopeDocRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!msaId) return;
    (async () => {
      const m = await getMsa(msaId);
      setMsa(m);
      if (isExisting && sowId) {
        const s = await getSow(sowId);
        setSow(s);
        if (s) {
          setTitle(s.title);
          setCode(s.code);
          setType(s.type);
          setCeilingMajor(String(s.ceilingMinor / 100));
          setCurrency(s.currency);
          setStartDate(toDateInput(s.startDate));
          setEndDate(toDateInput(s.endDate));
          setScopeDocRef(s.scopeDocRef || '');
        }
      }
      setLoading(false);
    })();
  }, [isExisting, sowId, msaId]);

  const isDraft = !sow || sow.status === 'DRAFT';

  const handleSave = async () => {
    if (!msaId) return;
    if (!title.trim()) return alert('Title required');
    const ceilingMinor = parseMajorToMinor(ceilingMajor);
    if (!ceilingMinor || ceilingMinor <= 0) return alert('Ceiling must be a positive amount.');
    setBusy(true);
    try {
      const { data } = await upsertSowFn({
        id: sow?.id,
        msaId,
        title: title.trim(),
        code: code.trim() || undefined,
        type,
        ceilingMinor,
        currency,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        scopeDocRef: scopeDocRef.trim() || undefined,
      });
      if (!isExisting) navigate(`/clients/${clientId}/msas/${msaId}/sows/${data.id}`);
      else setSow(await getSow(data.id));
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!sow) return;
    setBusy(true);
    try {
      await submitSowForApprovalFn({ sowId: sow.id });
      setSow(await getSow(sow.id));
    } catch (err) {
      alert(`Submit failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!sow) return;
    if (!confirm(`Approve SOW with ceiling ${formatMinor(sow.ceilingMinor, sow.currency)}? This emits SowActivated and locks the ceiling until a Change Order.`)) return;
    setBusy(true);
    try {
      await approveSowFn({ sowId: sow.id });
      setSow(await getSow(sow.id));
    } catch (err) {
      alert(`Approve failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!sow) return;
    const reason = prompt('Reason for cancelling this SOW?');
    if (!reason) return;
    setBusy(true);
    try {
      await cancelSowFn({ sowId: sow.id, reason });
      setSow(await getSow(sow.id));
    } catch (err) {
      alert(`Cancel failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6" data-testid="sow-loading">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6" data-testid="sow-editor-page">
      <Link to={`/clients/${clientId}`} className="text-xs text-muted-foreground">← Client</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{isExisting ? `SOW ${sow?.code || sow?.id}` : 'New SOW'}</h1>
          {sow && (
            <p className="text-sm text-muted-foreground">
              Status: <span data-testid="sow-status">{sow.status}</span> · MSA: {msa?.code || msaId}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {sow?.status === 'DRAFT' && (
            <button onClick={handleSubmitForApproval} disabled={busy}
              data-testid="sow-submit-for-approval"
              className="rounded border border-amber-500 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50">
              Submit for approval
            </button>
          )}
          {sow?.status === 'PENDING_APPROVAL' && (
            <button onClick={handleApprove} disabled={busy}
              data-testid="sow-approve"
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
              Approve (→ ACTIVE)
            </button>
          )}
          {sow && sow.status !== 'CLOSED' && sow.status !== 'CANCELLED' && (
            <button onClick={handleCancel} disabled={busy}
              data-testid="sow-cancel"
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
              Cancel SOW
            </button>
          )}
        </div>
      </header>

      {msa && msa.status !== 'ACTIVE' && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          Parent MSA is {msa.status}; SOWs cannot be submitted for approval until the MSA is ACTIVE.
        </div>
      )}

      <fieldset disabled={!isDraft} className="space-y-3 disabled:opacity-60">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2 block">
            <span className="block text-xs text-muted-foreground">Title *</span>
            <input data-testid="sow-title" value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Code (auto if blank)</span>
            <input data-testid="sow-code" value={code} onChange={e => setCode(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Type *</span>
            <select data-testid="sow-type" value={type} onChange={e => setType(e.target.value as SOW['type'])} className="mt-1 w-full rounded border px-2 py-1">
              <option value="PROJECT">PROJECT</option>
              <option value="RETAINER">RETAINER</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Ceiling (major units) *</span>
            <input
              data-testid="sow-ceiling-major"
              value={ceilingMajor}
              onChange={e => setCeilingMajor(e.target.value)}
              placeholder="e.g. 15000.00"
              className="mt-1 w-full rounded border px-2 py-1 tabular-nums"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Currency *</span>
            <select data-testid="sow-currency" value={currency} onChange={e => setCurrency(e.target.value as SOW['currency'])} className="mt-1 w-full rounded border px-2 py-1">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Start date</span>
            <input data-testid="sow-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">End date</span>
            <input data-testid="sow-end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
          <label className="col-span-2 block">
            <span className="block text-xs text-muted-foreground">Scope doc reference</span>
            <input data-testid="sow-scope-doc-ref" value={scopeDocRef} onChange={e => setScopeDocRef(e.target.value)} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
        </div>

        {isDraft && (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={busy} data-testid="sow-save"
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {busy ? 'Saving…' : isExisting ? 'Save' : 'Create'}
            </button>
            <Link to={`/clients/${clientId}`} className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--bg-sunken)]">Cancel</Link>
          </div>
        )}
      </fieldset>

      {sow && sow.status === 'ACTIVE' && (
        <div className="rounded border bg-emerald-50 p-3 text-xs text-emerald-900">
          <strong>This SOW is ACTIVE.</strong> The ceiling of {formatMinor(sow.ceilingMinor, sow.currency)} is now a
          hard cap on all IWO allocations. To raise it, file a Change Order.{' '}
          <Link to={`/clients/${clientId}/msas/${msaId}/sows/${sow.id}/change-orders/new`} className="text-emerald-800 underline">
            New Change Order →
          </Link>
        </div>
      )}
    </div>
  );
}
