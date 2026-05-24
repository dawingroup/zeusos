/**
 * /clients/:clientId/msas/:msaId/sows/:sowId/change-orders/(new|:coId) —
 * the only way to amend a SOW's ceiling. Spec §4.2 / §11.4.
 *
 * On APPROVE, the CO's `deltaMinor` is atomically applied to the parent
 * SOW's `ceilingMinor` (+ pushed onto every OPEN/DELIVERING master_job
 * for that SOW). Concurrent approvals against the same SOW serialise
 * through the SOW doc — see `approveChangeOrder` CF.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getChangeOrder,
  getSow,
  listChangeOrdersForSow,
} from '@/modules/contracts/services/firestore';
import {
  approveChangeOrderFn,
  rejectChangeOrderFn,
  upsertChangeOrderFn,
} from '@/modules/contracts/services/firebase';
import type { ChangeOrder } from '@/modules/contracts/types/change-order.types';
import type { SOW } from '@/modules/contracts/types/sow.types';
import { formatMinor, parseMajorToMinor } from '../utils/money';

export default function ChangeOrderPage() {
  const { clientId, msaId, sowId, coId } = useParams<{
    clientId: string; msaId: string; sowId: string; coId?: string;
  }>();
  const navigate = useNavigate();
  const isExisting = !!coId && coId !== 'new';

  const [sow, setSow] = useState<SOW | null>(null);
  const [co, setCo] = useState<ChangeOrder | null>(null);
  const [history, setHistory] = useState<ChangeOrder[]>([]);
  const [deltaMajor, setDeltaMajor] = useState('');
  const [sign, setSign] = useState<'+' | '-'>('+');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sowId) return;
    (async () => {
      const s = await getSow(sowId);
      setSow(s);
      setHistory(await listChangeOrdersForSow(sowId));
      if (isExisting && coId) {
        const c = await getChangeOrder(coId);
        setCo(c);
        if (c) {
          setDeltaMajor(String(Math.abs(c.deltaMinor) / 100));
          setSign(c.deltaMinor < 0 ? '-' : '+');
          setReason(c.reason);
        }
      }
      setLoading(false);
    })();
  }, [isExisting, coId, sowId]);

  const isDraft = !co || co.status === 'DRAFT';

  const handleSave = async () => {
    if (!sowId || !sow) return;
    const magnitude = parseMajorToMinor(deltaMajor);
    if (!magnitude || magnitude <= 0) return alert('Delta must be a positive amount.');
    const deltaMinor = sign === '-' ? -magnitude : magnitude;
    if (!reason.trim()) return alert('Reason required.');
    setBusy(true);
    try {
      const { data } = await upsertChangeOrderFn({
        id: co?.id,
        sowId,
        deltaMinor,
        reason: reason.trim(),
      });
      if (!isExisting) navigate(`/clients/${clientId}/msas/${msaId}/sows/${sowId}/change-orders/${data.id}`);
      else setCo(await getChangeOrder(data.id));
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!co) return;
    if (!confirm(`Approve change order? This will adjust SOW ceiling by ${formatMinor(co.deltaMinor, co.currency)}.`)) return;
    setBusy(true);
    try {
      const { data } = await approveChangeOrderFn({ changeOrderId: co.id });
      setCo(await getChangeOrder(co.id));
      setSow(await getSow(co.sowId));
      setHistory(await listChangeOrdersForSow(co.sowId));
      alert(`Approved. SOW ceiling is now ${formatMinor(data.appliedCeilingMinorAfter, co.currency)}.`);
    } catch (err) {
      alert(`Approve failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!co) return;
    const r = prompt('Reason for rejecting?');
    if (!r) return;
    setBusy(true);
    try {
      await rejectChangeOrderFn({ changeOrderId: co.id, reason: r });
      setCo(await getChangeOrder(co.id));
    } catch (err) {
      alert(`Reject failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link to={`/clients/${clientId}/msas/${msaId}/sows/${sowId}`} className="text-xs text-muted-foreground">← SOW</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{isExisting ? `Change Order ${co?.code || co?.id}` : 'New Change Order'}</h1>
          {co && <p className="text-sm text-muted-foreground">Status: {co.status}</p>}
          {sow && <p className="text-xs text-muted-foreground">SOW {sow.code} · current ceiling {formatMinor(sow.ceilingMinor, sow.currency)}</p>}
        </div>
        <div className="flex gap-2">
          {co?.status === 'DRAFT' && (
            <>
              <button onClick={handleApprove} disabled={busy}
                className="rounded bg-[var(--rag-green)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-green)] disabled:opacity-50">
                Approve
              </button>
              <button onClick={handleReject} disabled={busy}
                className="rounded border border-[var(--rag-red)] px-3 py-1.5 text-sm text-[var(--rag-red)] hover:bg-[var(--rag-red-soft)] disabled:opacity-50">
                Reject
              </button>
            </>
          )}
        </div>
      </header>

      <fieldset disabled={!isDraft} className="space-y-3 disabled:opacity-60">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="block">
            <span className="block text-xs text-muted-foreground">Direction</span>
            <select value={sign} onChange={e => setSign(e.target.value as '+' | '-')} className="mt-1 w-full rounded border px-2 py-1">
              <option value="+">+ Increase ceiling</option>
              <option value="-">− De-scope</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-muted-foreground">Amount (major units) *</span>
            <input value={deltaMajor} onChange={e => setDeltaMajor(e.target.value)} placeholder="e.g. 2500.00" className="mt-1 w-full rounded border px-2 py-1 tabular-nums" />
          </label>
          <label className="col-span-2 block">
            <span className="block text-xs text-muted-foreground">Reason *</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded border px-2 py-1" />
          </label>
        </div>

        {isDraft && (
          <button onClick={handleSave} disabled={busy} className="rounded bg-[var(--rag-blue)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-blue)] disabled:opacity-50">
            {busy ? 'Saving…' : isExisting ? 'Save' : 'Draft Change Order'}
          </button>
        )}
      </fieldset>

      {co?.status === 'APPROVED' && (
        <div className="rounded border bg-[var(--rag-green-soft)] p-3 text-xs text-[var(--rag-green)]">
          Approved {new Date((co as any).approvedAt?._seconds ? (co as any).approvedAt._seconds * 1000 : Date.now()).toLocaleString()} by {co.approvedByUserId}.
        </div>
      )}

      {history.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Change order history</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2 text-right">Δ</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {history.map(h => (
                <tr key={h.id} className="border-t">
                  <td className="px-3 py-2">
                    <Link to={`/clients/${clientId}/msas/${msaId}/sows/${sowId}/change-orders/${h.id}`} className="font-mono text-xs text-[var(--rag-blue)] hover:underline">{h.code || h.id}</Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMinor(h.deltaMinor, h.currency)}</td>
                  <td className="px-3 py-2">{h.status}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
