/**
 * /clients/:clientId — client detail. Renders the client record + every
 * MSA + the SOWs nested under each MSA. Phase 3.D.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  getClient,
  listMsasForClient,
  listSowsForMsa,
} from '@/modules/contracts/services/firestore';
import { upsertClientFn } from '@/modules/contracts/services/firebase';
import type { Client, ClientStatus } from '@/modules/contracts/types/client.types';
import type { MSA } from '@/modules/contracts/types/msa.types';
import type { SOW } from '@/modules/contracts/types/sow.types';
import {
  BackBar,
  DetailLayout,
  SideCard,
  MetaRow,
  SectionH,
  Pill,
  type RagTone,
} from '@/shared/components/refresh';
import { formatMinor } from '../utils/money';
import { CompetitorListPanel } from '@/modules/conflict-firewall/components/CompetitorListPanel';
import { ClientStrategyAssistantPanel } from '../components/ClientStrategyAssistantPanel';

const STATUS_TONE: Record<ClientStatus, RagTone> = {
  ACTIVE: 'green',
  PROSPECT: 'blue',
  CHURNED: 'neutral',
  BLOCKED: 'red',
};

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

  if (loading) return <div style={{ padding: 'var(--pad-page)', color: 'var(--fg-tertiary)' }}>Loading…</div>;
  if (!client)
    return (
      <div style={{ padding: 'var(--pad-page)' }}>
        Client not found. <Link to="/clients" className="text-[var(--rag-blue)]">Back</Link>
      </div>
    );

  const editForm = editing && (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <h2 className="h1" style={{ fontSize: 15, marginBottom: 12 }}>Edit client</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label className="block">
          <span className="eyebrow" style={{ fontSize: 10.5 }}>Name</span>
          <input className="input" style={{ marginTop: 4 }} value={draft.name ?? ''} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
        </label>
        <label className="block">
          <span className="eyebrow" style={{ fontSize: 10.5 }}>Code</span>
          <input className="input" style={{ marginTop: 4 }} value={draft.code ?? ''} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
        </label>
        <label className="block">
          <span className="eyebrow" style={{ fontSize: 10.5 }}>Billing currency</span>
          <select className="input" style={{ marginTop: 4 }} value={(draft.billingCurrency ?? 'USD') as string} onChange={(e) => setDraft((d) => ({ ...d, billingCurrency: e.target.value as Client['billingCurrency'] }))}>
            {['UGX', 'USD', 'KES', 'EUR', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow" style={{ fontSize: 10.5 }}>Status</span>
          <select className="input" style={{ marginTop: 4 }} value={(draft.status ?? 'PROSPECT') as string} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value as Client['status'] }))}>
            {['PROSPECT', 'ACTIVE', 'CHURNED', 'BLOCKED'].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="block" style={{ gridColumn: '1 / -1' }}>
          <span className="eyebrow" style={{ fontSize: 10.5 }}>Sector</span>
          <input className="input" style={{ marginTop: 4 }} value={draft.sector ?? ''} onChange={(e) => setDraft((d) => ({ ...d, sector: e.target.value }))} />
        </label>
        <label className="block" style={{ gridColumn: '1 / -1' }}>
          <span className="eyebrow" style={{ fontSize: 10.5 }}>Notes</span>
          <textarea className="input" style={{ marginTop: 4 }} rows={3} value={draft.notes ?? ''} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} />
        </label>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
        <button onClick={handleSave} disabled={busy} className="btn btn-primary">{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={() => setEditing(false)} className="btn btn-secondary">Cancel</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <BackBar label="Clients" onBack={() => navigate('/clients')} />

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Account Management</div>
          <h1 className="display">{client.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <Pill tone={STATUS_TONE[client.status]}>{client.status.toLowerCase()}</Pill>
            {client.code && <span className="mono" style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{client.code}</span>}
            <span style={{ fontSize: 12.5, color: 'var(--fg-tertiary)' }}>billed in {client.billingCurrency}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
          {!editing && client.status !== 'BLOCKED' && (
            <>
              <button type="button" onClick={() => { setDraft(client); setEditing(true); }} className="btn btn-secondary">
                Edit
              </button>
              <button type="button" onClick={handleArchive} disabled={archiving} className="btn btn-reject" data-testid="client-archive-btn">
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            </>
          )}
          <Link to={`/clients/${client.id}/msas/new`} className="btn btn-primary">
            <Plus size={13} /> New MSA
          </Link>
        </div>
      </div>

      {editForm}

      <DetailLayout
        left={
          <>
            {/* ADR-2026-05-25 §2.Q4 — named-competitor list. Routing excludes
                any brand currently serving a listed competitor. */}
            <section data-testid="client-competitor-section">
              <CompetitorListPanel clientId={client.id} clientName={client.name} />
            </section>

            {/* Phase 3.5 — AI strategy brief from stakeholders + competitors +
                regulatory exposure + business memory. */}
            <section data-testid="client-strategy-assistant-section">
              <ClientStrategyAssistantPanel clientId={client.id} clientName={client.name} />
            </section>

            <SectionH
              title="MSAs"
              titleSize={15}
              action={
                <Link to={`/clients/${client.id}/msas/new`} className="btn btn-ghost">
                  <Plus size={13} /> New MSA
                </Link>
              }
            />
            {msas.length === 0 && (
              <div className="card card-pad" style={{ color: 'var(--fg-tertiary)', fontSize: 13 }}>No MSAs yet.</div>
            )}
            {msas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {msas.map((msa) => (
                  <div key={msa.id} className="card" style={{ overflow: 'hidden' }}>
                    <div className="card-head" style={{ alignItems: 'center' }}>
                      <div>
                        <Link to={`/clients/${client.id}/msas/${msa.id}`} style={{ fontWeight: 600 }} className="hover:underline">
                          {msa.code || msa.title}
                        </Link>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-tertiary)' }}>{msa.title} · {msa.status}</div>
                      </div>
                      <Link to={`/clients/${client.id}/msas/${msa.id}/sows/new`} className="btn btn-ghost" style={{ fontSize: 11 }}>
                        + New SOW
                      </Link>
                    </div>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>SOW</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Ceiling</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(sowsByMsa[msa.id] || []).map((sow) => (
                          <tr key={sow.id}>
                            <td>
                              <Link to={`/clients/${client.id}/msas/${msa.id}/sows/${sow.id}`} className="mono hover:underline" style={{ fontSize: 12, color: 'var(--rag-blue)' }}>
                                {sow.code || sow.id}
                              </Link>
                              <div style={{ fontSize: 11.5, color: 'var(--fg-tertiary)' }}>{sow.title}</div>
                            </td>
                            <td>{sow.type}</td>
                            <td>{sow.status}</td>
                            <td className="tabular" style={{ textAlign: 'right' }}>{formatMinor(sow.ceilingMinor, sow.currency)}</td>
                          </tr>
                        ))}
                        {(sowsByMsa[msa.id] || []).length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ fontSize: 11.5, color: 'var(--fg-tertiary)' }}>No SOWs yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </>
        }
        right={
          <SideCard title="Client">
            <MetaRow label="Status" value={<Pill tone={STATUS_TONE[client.status]}>{client.status.toLowerCase()}</Pill>} />
            <MetaRow label="Billing" value={client.billingCurrency} />
            <MetaRow
              label="Primary brand"
              value={<span data-testid="client-primary-brand">{client.primaryBrandId || '—'}</span>}
            />
            <MetaRow label="Sector" value={client.sector || '—'} />
            <MetaRow label="Code" value={client.code || '—'} />
          </SideCard>
        }
      />
    </div>
  );
}
