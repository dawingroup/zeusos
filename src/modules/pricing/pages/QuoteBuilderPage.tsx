/**
 * QuoteBuilderPage — the AM workhorse.
 *
 *   1. Pick a Client → pick one of its open SOWs (DRAFT, PENDING_APPROVAL,
 *      or ACTIVE). clientId is resolved from the picked SOW.
 *   2. Add lines: pick subsidiary + roleCode + unit + qty.
 *   3. Hit "Compute" → calls `priceQuote` CFn; preview pane shows the
 *      derived client_minor, totals, and margin band.
 *   4. If a quoteId is in the URL, the page acts as the quote detail view
 *      and exposes Issue / Accept / Void actions per spec §6.2.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  acceptQuoteFn,
  issueQuoteFn,
  priceQuoteFn,
  voidQuoteFn,
} from '../services/firebase';
import { getQuote, listQuoteLines } from '../services/firestore';
import {
  listClients,
  listSowsForClient,
} from '@/modules/contracts/services/firestore';
import type { Client } from '@/modules/contracts/types/client.types';
import type { SOW } from '@/modules/contracts/types/sow.types';
import type { PricedQuote, Quote, QuoteLine, QuoteLineInput } from '../types';
import { MARGIN_FLOOR_DEFAULT_PCT } from '../constants/floors';
import { MarginBadge } from '../components/MarginBadge';
import type { SubsidiaryId } from '@/core/settings/types';

const QUOTABLE_SOW_STATUSES: SOW['status'][] = ['DRAFT', 'PENDING_APPROVAL', 'ACTIVE'];

const SUBSIDIARIES: { id: SubsidiaryId; label: string }[] = [
  { id: 'zeus-the-agency', label: 'Zeus The Agency' },
  { id: 'zeus-digital',    label: 'Zeus Digital' },
  { id: 'labyrinth',       label: 'Labyrinth' },
  { id: 'odd-gorilla',     label: 'Odd Gorilla' },
  { id: 'house-of-zeus',   label: 'House of Zeus' },
];
const UNITS = ['HOUR', 'DAY', 'UNIT', 'PASS_THROUGH'] as const;

const EMPTY_LINE: QuoteLineInput = {
  subsidiaryOrgId: 'zeus-the-agency',
  roleCode: 'ACCOUNT_DIRECTOR',
  unit: 'HOUR',
  qty: 1,
};

export default function QuoteBuilderPage() {
  const { id: quoteIdParam } = useParams<{ id: string }>();
  const isExisting = !!quoteIdParam && quoteIdParam !== 'new';

  const [clientId, setClientId] = useState('');
  const [sowId, setSowId] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [sows, setSows] = useState<SOW[]>([]);
  const [sowsLoading, setSowsLoading] = useState(false);

  const [lines, setLines] = useState<QuoteLineInput[]>([{ ...EMPTY_LINE }]);
  const [priced, setPriced] = useState<PricedQuote | null>(null);
  const [busy, setBusy] = useState(false);

  const [existingQuote, setExistingQuote] = useState<Quote | null>(null);
  const [existingLines, setExistingLines] = useState<QuoteLine[]>([]);

  // Load client list once (only the picker needs it — existing-quote view
  // skips it).
  useEffect(() => {
    if (isExisting) return;
    listClients().then(setClients).catch(() => setClients([]));
  }, [isExisting]);

  // When the client changes, refresh the list of quotable SOWs and clear
  // any stale SOW selection.
  useEffect(() => {
    if (isExisting || !clientId) {
      setSows([]);
      setSowId('');
      return;
    }
    setSowsLoading(true);
    listSowsForClient(clientId)
      .then(rows => {
        const quotable = rows.filter(s => QUOTABLE_SOW_STATUSES.includes(s.status));
        setSows(quotable);
        // If the previously-picked SOW is no longer in the list, reset.
        setSowId(prev => (quotable.some(s => s.id === prev) ? prev : ''));
      })
      .catch(() => setSows([]))
      .finally(() => setSowsLoading(false));
  }, [clientId, isExisting]);

  useEffect(() => {
    if (!isExisting || !quoteIdParam) return;
    Promise.all([getQuote(quoteIdParam), listQuoteLines(quoteIdParam)]).then(
      ([q, ls]) => {
        setExistingQuote(q);
        setExistingLines(ls);
        if (q) setSowId(q.sowId);
      },
    );
  }, [isExisting, quoteIdParam]);

  const pickedSow = useMemo(
    () => sows.find(s => s.id === sowId) ?? null,
    [sows, sowId],
  );

  const handleCompute = async () => {
    if (!sowId) return alert('Pick a client + SOW first.');
    setBusy(true);
    try {
      // clientId is resolved from the picked SOW — never sent freehand.
      const resolvedClientId = pickedSow?.clientId ?? clientId;
      const { data } = await priceQuoteFn({ sowId, clientId: resolvedClientId, lines });
      setPriced(data);
    } catch (err) {
      alert(`Pricing failed: ${(err as Error).message}`);
      setPriced(null);
    } finally {
      setBusy(false);
    }
  };

  const handleIssue = async () => {
    if (!quoteIdParam) return;
    setBusy(true);
    try {
      await issueQuoteFn({ quoteId: quoteIdParam });
      const fresh = await getQuote(quoteIdParam);
      setExistingQuote(fresh);
    } catch (err) {
      alert(`Issue failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!quoteIdParam) return;
    const name = prompt('Client signatory name (for the audit log):') || '';
    setBusy(true);
    try {
      await acceptQuoteFn({ quoteId: quoteIdParam, acceptedByClientName: name });
      const fresh = await getQuote(quoteIdParam);
      setExistingQuote(fresh);
    } catch (err) {
      alert(`Accept failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleVoid = async () => {
    if (!quoteIdParam) return;
    const reason = prompt('Reason for voiding:') || '';
    if (!reason) return;
    setBusy(true);
    try {
      await voidQuoteFn({ quoteId: quoteIdParam, reason });
      const fresh = await getQuote(quoteIdParam);
      setExistingQuote(fresh);
    } catch (err) {
      alert(`Void failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (isExisting && existingQuote) {
    return (
      <div style={{ padding: 24 }}>
        <header style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Quote {existingQuote.code || existingQuote.id}</h1>
          <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 13 }}>
            SOW {existingQuote.sowId} · Status {existingQuote.status} · Client total{' '}
            {(existingQuote.clientTotalMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
            {existingQuote.currency}
            {typeof existingQuote.marginPctAtIssue === 'number' && (
              <span style={{ marginLeft: 8 }}>
                <MarginBadge marginPct={existingQuote.marginPctAtIssue} floorPct={existingQuote.marginFloorPct} compact />
              </span>
            )}
          </p>
        </header>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {existingQuote.status === 'DRAFT' && (
            <button type="button" onClick={handleIssue} disabled={busy}
              style={{ padding: '6px 12px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
              Issue to client
            </button>
          )}
          {existingQuote.status === 'ISSUED' && (
            <button type="button" onClick={handleAccept} disabled={busy}
              style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
              Mark accepted by client
            </button>
          )}
          {(existingQuote.status === 'DRAFT' || existingQuote.status === 'ISSUED') && (
            <button type="button" onClick={handleVoid} disabled={busy}
              style={{ padding: '6px 12px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
              Void
            </button>
          )}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Description</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Qty</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Client total</th>
            </tr>
          </thead>
          <tbody>
            {existingLines.map(line => (
              <tr key={line.id}>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{line.description}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{line.qty}</td>
                <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {(line.clientMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Quote Builder</h1>
        <p style={{ margin: '4px 0 0', color: '#475569', fontSize: 13 }}>
          Spec §8.1 pricing pipeline. Cost is internal; only the client total reaches the client.
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
        <label style={{ fontSize: 13 }}>
          Client
          <select
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            style={{ width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff' }}
          >
            <option value="">Select a client…</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name || c.id}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13 }}>
          SOW
          <select
            value={sowId}
            onChange={e => setSowId(e.target.value)}
            disabled={!clientId || sowsLoading}
            style={{ width: '100%', marginTop: 4, padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4, background: clientId ? '#fff' : '#f1f5f9' }}
          >
            <option value="">
              {!clientId
                ? 'Pick a client first'
                : sowsLoading
                  ? 'Loading SOWs…'
                  : sows.length === 0
                    ? 'No open SOWs for this client'
                    : 'Select a SOW…'}
            </option>
            {sows.map(s => (
              <option key={s.id} value={s.id}>
                {(s.code || s.id)} · {s.status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
            <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Subsidiary</th>
            <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Role code</th>
            <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Unit</th>
            <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Qty</th>
            <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }} />
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx}>
              <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                <select
                  value={line.subsidiaryOrgId}
                  onChange={e => updateLine(setLines, idx, { subsidiaryOrgId: e.target.value as SubsidiaryId })}
                  style={{ padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
                >
                  {SUBSIDIARIES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                <input
                  type="text"
                  value={line.roleCode}
                  onChange={e => updateLine(setLines, idx, { roleCode: e.target.value })}
                  style={{ padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4, fontFamily: 'monospace' }}
                />
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                <select
                  value={line.unit}
                  onChange={e => updateLine(setLines, idx, { unit: e.target.value as QuoteLineInput['unit'] })}
                  style={{ padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: 4 }}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                <input
                  type="number"
                  value={line.qty}
                  min={0}
                  step={0.25}
                  onChange={e => updateLine(setLines, idx, { qty: Number(e.target.value) })}
                  style={{ padding: '4px 6px', width: 80, border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </td>
              <td style={{ padding: 8, borderBottom: '1px solid #f1f5f9' }}>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    ✕
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setLines(prev => [...prev, { ...EMPTY_LINE }])}
          style={{ padding: '6px 12px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer' }}
        >
          + Add line
        </button>
        <button
          type="button"
          onClick={handleCompute}
          disabled={busy || !sowId}
          style={{ padding: '6px 12px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}
        >
          Compute price
        </button>
      </div>

      {priced && <PricePreview priced={priced} />}
    </div>
  );

  // (function returns above; nothing after this line)
}

function updateLine(
  setter: React.Dispatch<React.SetStateAction<QuoteLineInput[]>>,
  idx: number,
  patch: Partial<QuoteLineInput>,
) {
  setter(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
}

function PricePreview({ priced }: { priced: PricedQuote }) {
  return (
    <section style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 16 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: '#64748b' }}>Client total</div>
          <div style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {(priced.totalClientMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} {priced.currency}
          </div>
        </div>
        <MarginBadge marginPct={priced.marginPct} floorPct={priced.marginFloorPct ?? MARGIN_FLOOR_DEFAULT_PCT} />
      </header>

      {!priced.meetsFloor && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: 8, borderRadius: 4, fontSize: 12, marginBottom: 12 }}>
          Margin {priced.marginPct.toFixed(1)}% is below the floor of {priced.marginFloorPct}%. Issuing this quote will be rejected unless an owner-role principal overrides.
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 11, textTransform: 'uppercase' }}>
            <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0' }}>Description</th>
            <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0' }}>Subsidiary</th>
            <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Qty</th>
            <th style={{ padding: '6px 10px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Client</th>
          </tr>
        </thead>
        <tbody>
          {priced.lines.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9' }}>{l.description}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9' }}>{l.subsidiaryOrgId}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>{l.qty}</td>
              <td style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {(l.clientMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
        Cost basis and markup percentages are internal — they are not projected onto the client view above.
      </p>
    </section>
  );
}
