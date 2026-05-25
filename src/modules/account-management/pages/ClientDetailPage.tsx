/**
 * /clients/:clientId — client detail. Renders the client record + every
 * MSA + the SOWs nested under each MSA. Phase 3.D.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  getClient,
  listMsasForClient,
  listSowsForMsa,
} from '@/modules/contracts/services/firestore';
import { upsertClientFn } from '@/modules/contracts/services/firebase';
import type { Client } from '@/modules/contracts/types/client.types';
import type { MSA } from '@/modules/contracts/types/msa.types';
import type { SOW } from '@/modules/contracts/types/sow.types';
import { formatMinor } from '../utils/money';
import { CompetitorListPanel } from '@/modules/conflict-firewall/components/CompetitorListPanel';

export default function ClientDetailPage() {
  const navigate = useNavigate();
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [msas, setMsas] = useState<MSA[]>([]);
  const [sowsByMsa, setSowsByMsa] = useState<Record<string, SOW[]>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Client>>({});
  const [busy, setBusy] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const c = await getClient(clientId);
      if (cancelled) return;
      setClient(c);
      setDraft(c ?? {});
      const ms = c ? await listMsasForClient(clientId) : [];
      if (cancelled) return;
      setMsas(ms);
      const sows: Record<string, SOW[]> = {};
      for (const m of ms) {
        sows[m.id] = await listSowsForMsa(m.id);
      }
      if (cancelled) return;
      setSowsByMsa(sows);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [clientId]);

  const handleSave = async () => {
    if (!client) return;
    setBusy(true);
    try {
      await upsertClientFn({
        id: client.id,
        name: draft.name || client.name,
        code: draft.code,
        billingCurrency: (draft.billingCurrency || client.billingCurrency) as Client['billingCurrency'],
        sector: draft.sector,
        status: (draft.status || client.status) as Client['status'],
        contacts: draft.contacts,
        relationshipManagerUserId: draft.relationshipManagerUserId,
        notes: draft.notes,
      });
      const refreshed = await getClient(client.id);
      setClient(refreshed);
      setEditing(false);
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!client) return;
    const ok = window.confirm(
      `Archive client "${client.name}"? This sets status=BLOCKED. ` +
      `Existing MSAs and SOWs are preserved. You can reactivate later by editing the client.`,
    );
    if (!ok) return;
    setArchiving(true);
    try {
      await upsertClientFn({
        id: client.id,
        name: client.name,
        code: client.code,
        billingCurrency: client.billingCurrency,
        sector: client.sector,
        status: 'BLOCKED',
        contacts: client.contacts,
        relationshipManagerUserId: client.relationshipManagerUserId,
        notes: client.notes,
      });
      navigate('/clients');
    } catch (err) {
      alert(`Archive failed: ${(err as Error).message}`);
    } finally {
      setArchiving(false);
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!client) return <div className="p-6">Client not found. <Link to="/clients" className="text-[var(--rag-blue)]">Back</Link></div>;

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/clients" className="text-xs text-muted-foreground">← Clients</Link>
          <h1 className="mt-1 text-xl font-semibold">{client.name}</h1>
          <p className="text-sm text-muted-foreground">
            {client.code ? `${client.code} · ` : ''}{client.status} · billed in {client.billingCurrency}
          </p>
        </div>
        <div className="flex gap-2">
          {!editing && client.status !== 'BLOCKED' && (
            <>
              <button
                type="button"
                onClick={() => { setDraft(client); setEditing(true); }}
                className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--bg-sunken)]"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving}
                className="rounded border border-[var(--rag-red)] px-3 py-1.5 text-sm text-[var(--rag-red)] hover:bg-[var(--rag-red-soft)] disabled:opacity-50"
                data-testid="client-archive-btn"
              >
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </>
          )}
          <Link
            to={`/clients/${client.id}/msas/new`}
            className="rounded bg-[var(--rag-blue)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-blue)]"
          >
            + New MSA
          </Link>
        </div>
      </header>

      {editing && (
        <section className="rounded border bg-[var(--bg-sunken)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Edit client</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="block text-xs text-muted-foreground">Name</span>
              <input
                value={draft.name ?? ''}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Code</span>
              <input
                value={draft.code ?? ''}
                onChange={e => setDraft(d => ({ ...d, code: e.target.value }))}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Billing currency</span>
              <select
                value={(draft.billingCurrency ?? 'USD') as string}
                onChange={e => setDraft(d => ({ ...d, billingCurrency: e.target.value as Client['billingCurrency'] }))}
                className="mt-1 w-full rounded border px-2 py-1"
              >
                {['UGX','USD','KES','EUR','GBP'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Status</span>
              <select
                value={(draft.status ?? 'PROSPECT') as string}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value as Client['status'] }))}
                className="mt-1 w-full rounded border px-2 py-1"
              >
                {['PROSPECT','ACTIVE','CHURNED','BLOCKED'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="block text-xs text-muted-foreground">Sector</span>
              <input
                value={draft.sector ?? ''}
                onChange={e => setDraft(d => ({ ...d, sector: e.target.value }))}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="col-span-2 block">
              <span className="block text-xs text-muted-foreground">Notes</span>
              <textarea
                value={draft.notes ?? ''}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleSave} disabled={busy} className="rounded bg-[var(--rag-blue)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-blue)] disabled:opacity-50">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} className="rounded border px-3 py-1.5 text-sm hover:bg-card">Cancel</button>
          </div>
        </section>
      )}

      {/* ADR-2026-05-25 §2.Q4 — named-competitor list. Replaces the
          earlier category model; routing excludes any brand currently
          serving a listed competitor. */}
      <section data-testid="client-competitor-section">
        <CompetitorListPanel clientId={client.id} clientName={client.name} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">MSAs</h2>
        {msas.length === 0 && (
          <p className="text-sm text-muted-foreground">No MSAs yet.</p>
        )}
        {msas.length > 0 && (
          <div className="space-y-3">
            {msas.map(msa => (
              <div key={msa.id} className="rounded border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                  <div>
                    <Link to={`/clients/${client.id}/msas/${msa.id}`} className="font-medium text-[var(--rag-blue)] hover:underline">
                      {msa.code || msa.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{msa.title} · {msa.status}</div>
                  </div>
                  <Link
                    to={`/clients/${client.id}/msas/${msa.id}/sows/new`}
                    className="rounded border px-2 py-1 text-xs hover:bg-[var(--bg-sunken)]"
                  >
                    + New SOW
                  </Link>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="px-3 py-2">SOW</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Ceiling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sowsByMsa[msa.id] || []).map(sow => (
                      <tr key={sow.id} className="border-t hover:bg-[var(--bg-sunken)]">
                        <td className="px-3 py-2">
                          <Link to={`/clients/${client.id}/msas/${msa.id}/sows/${sow.id}`} className="font-mono text-xs text-[var(--rag-blue)] hover:underline">
                            {sow.code || sow.id}
                          </Link>
                          <div className="text-xs text-muted-foreground">{sow.title}</div>
                        </td>
                        <td className="px-3 py-2">{sow.type}</td>
                        <td className="px-3 py-2">{sow.status}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMinor(sow.ceilingMinor, sow.currency)}</td>
                      </tr>
                    ))}
                    {(sowsByMsa[msa.id] || []).length === 0 && (
                      <tr><td colSpan={4} className="px-3 py-3 text-xs text-muted-foreground">No SOWs yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
