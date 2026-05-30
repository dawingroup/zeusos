/* eslint-disable design-system/no-inline-style-literals -- TODO(U.4): early Phase 3.E scaffolding, uses inline px + hex throughout. Real Tailwind/token refactor scheduled for U.4. */
/**
 * IWOWorkspacePage — the per-IWO subsidiary workspace.
 *
 * Visible only to users of the receiving subsidiary (rules + the
 * `SubsidiaryDeliveryGuard` filter the route).
 *
 * Renders:
 *   • Read-only handoff header (budget, due dates, comms owner).
 *   • Burn meter — live cumulative vs budget. ≥90 % shows red warn,
 *     ≥100 % surfaces BLOCKED banner. Server enforces hard cap; this is
 *     the UI mirror.
 *   • Time entry form — `postTimeEntry` callable.
 *   • Cost entry form — `postCostEntry` callable.
 *   • Deliverable submission — `submitDeliverable` callable, gated by
 *     acceptance criteria from the handoff packet (spec §7.3).
 *
 * All commercial affordances (price, quote, client comms) are absent by
 * construction — there is no path from this page to any pricing or
 * billing UI. Spec §7.4 boundary, Layer 1 (auth) keeps subsidiary users
 * out of those routes if they URL-hop; this page is the "what they
 * actually see" half.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import type { InternalWorkOrder, HandoffPacket } from '@/modules/assignment';
import type { TimeEntry, CostEntry, Deliverable } from '@/modules/delivery';
import {
  subscribeIWO,
  subscribeHandoffPacket,
  subscribeTimeEntries,
  subscribeCostEntries,
  subscribeDeliverables,
} from '../services/firestore';
import {
  startWorkOrderFn,
  postTimeEntryFn,
  postCostEntryFn,
  submitDeliverableFn,
  type CostEntryKindForApi,
} from '../services/firebase';
import { computeBurnMeter } from '../services/burnMeter';
import { BurnMeterBar } from '../components/BurnMeterBar';
import { RouteToAMButton } from '../components/RouteToAMButton';
import { ApprovalLadderPanel } from '../components/ApprovalLadderPanel';
import { BackBar, Pill } from '@/shared/components/refresh';

function formatMinor(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTimestamp(ts: HandoffPacket['createdAt'] | undefined | null): string {
  if (!ts) return '—';
  if (typeof ts === 'string') return new Date(ts).toLocaleString();
  const maybe = ts as unknown as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toLocaleString();
  if (typeof maybe.seconds === 'number') return new Date(maybe.seconds * 1000).toLocaleString();
  return '—';
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function IWOWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();

  const [iwo, setIwo] = useState<InternalWorkOrder | null>(null);
  const [packet, setPacket] = useState<HandoffPacket | null>(null);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [costEntries, setCostEntries] = useState<CostEntry[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Time-entry form state
  const [teMinutes, setTeMinutes] = useState<string>('');
  const [teDate, setTeDate] = useState<string>(todayIso());
  const [teNote, setTeNote] = useState<string>('');

  // Cost-entry form state
  const [ceKind, setCeKind] = useState<CostEntryKindForApi>('VENDOR');
  const [ceAmount, setCeAmount] = useState<string>('');
  const [ceDesc, setCeDesc] = useState<string>('');
  const [cePassThrough, setCePassThrough] = useState(false);

  // Deliverable submission state — collect ≥1 asset id (free-text for
  // Phase 3.E; the Asset Library UI lands in Phase 4 and will replace
  // this with a real picker).
  const [delAssetIds, setDelAssetIds] = useState<string>('');
  const [delDesc, setDelDesc] = useState<string>('');

  useEffect(() => {
    if (!id) return;
    const u1 = subscribeIWO(id, setIwo, (e) => setErr(`IWO load failed: ${e.message}`));
    const u2 = subscribeHandoffPacket(id, setPacket, () => { /* packet may not exist yet */ });
    const u3 = subscribeTimeEntries(id, setTimeEntries, () => {});
    const u4 = subscribeCostEntries(id, setCostEntries, () => {});
    const u5 = subscribeDeliverables(id, setDeliverables, () => {});
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [id]);

  // Burn meter computes against stored cumulative; cross-checked locally
  // by summing entries so a stale snapshot doesn't lie about headroom.
  const meter = useMemo(() => {
    if (!iwo) return null;
    const localSum =
      timeEntries.reduce((a, e) => a + (e.costMinor || 0), 0) +
      costEntries.reduce((a, e) => a + (e.amountMinor || 0), 0);
    const cumulative = Math.max(iwo.cumulativeCostMinor || 0, localSum);
    return computeBurnMeter({ cumulativeMinor: cumulative, budgetMinor: iwo.budgetMinor });
  }, [iwo, timeEntries, costEntries]);

  if (!id) {
    return <div style={{ padding: 24 }}>Missing IWO id.</div>;
  }
  if (!iwo) {
    return <div style={{ padding: 24 }}>Loading work order…</div>;
  }

  const handleStart = async () => {
    setBusy(true);
    setErr(null);
    try {
      await startWorkOrderFn({ iwoId: iwo.id });
    } catch (e) {
      setErr(`Start failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePostTime = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!user) { setErr('Not signed in.'); return; }
    const minutes = Number.parseInt(teMinutes, 10);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      setErr('Minutes must be a positive integer.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await postTimeEntryFn({
        iwoId: iwo.id,
        userId: user.uid,
        minutes,
        entryDate: teDate,
        note: teNote || undefined,
      });
      setTeMinutes('');
      setTeNote('');
    } catch (e) {
      setErr(`Post time failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePostCost = async (ev: React.FormEvent) => {
    ev.preventDefault();
    // Amount enters as a major-unit decimal for friendliness; convert
    // to integer minor units before sending.
    const amountMajor = Number.parseFloat(ceAmount);
    if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
      setErr('Amount must be > 0.');
      return;
    }
    const amount = Math.round(amountMajor * 100);
    setBusy(true);
    setErr(null);
    try {
      await postCostEntryFn({
        iwoId: iwo.id,
        kind: ceKind,
        amount,
        isPassThrough: cePassThrough,
        description: ceDesc || undefined,
      });
      setCeAmount('');
      setCeDesc('');
    } catch (e) {
      setErr(`Post cost failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitDeliverable = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const assetIds = delAssetIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (assetIds.length === 0) {
      setErr('Provide at least one asset id (comma or whitespace separated).');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await submitDeliverableFn({
        iwoId: iwo.id,
        assetIds,
        description: delDesc || undefined,
      });
      setDelAssetIds('');
      setDelDesc('');
    } catch (e) {
      setErr(`Submit deliverable failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const canPostEntries = iwo.state === 'IN_PROGRESS' && meter?.status !== 'BLOCKED';
  const canSubmitDeliverable = iwo.state === 'IN_PROGRESS';
  const canStart = iwo.state === 'ACCEPTED';

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: '0 auto' }} data-testid="iwo-workspace-page">
      <button
        type="button"
        data-testid="iwo-back-to-inbox"
        onClick={() => navigate('/delivery/inbox')}
        style={{
          padding: '4px 8px', marginBottom: 16, border: '1px solid #cbd5e1',
          background: '#fff', borderRadius: 4, cursor: 'pointer', fontSize: 12,
        }}
      >
        ← Inbox
      </button>

      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }} data-testid="iwo-code">
          {iwo.code}
        </h1>
        <div style={{ marginTop: 4, fontSize: 13, color: '#475569', display: 'flex', gap: 16 }}>
          <span>State: <strong data-testid="iwo-state">{iwo.state}</strong></span>
          <span data-testid="iwo-budget">Budget: {formatMinor(iwo.budgetMinor, iwo.currency)}</span>
        </div>
      </header>

      {err && (
        <div role="alert" style={{
          padding: 12, marginBottom: 16, borderRadius: 6,
          background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca',
        }}>
          {err}
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Handoff packet</h2>
        {packet ? (
          <div style={{
            padding: 16, borderRadius: 6,
            background: '#f8fafc', border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 8 }}>
              Comms owner (Account Management): <strong>{packet.commsOwnerUserId}</strong>
              {' '}— the subsidiary does not contact the client directly.
            </div>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Brief</summary>
              <pre style={{
                whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                marginTop: 8, fontSize: 13, color: '#1f2937',
              }}>
                {packet.briefMd}
              </pre>
            </details>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 4 }}>
              Milestones
            </h3>
            <ul style={{ listStyle: 'disc', paddingLeft: 20, fontSize: 13, color: '#1f2937' }}>
              {packet.milestones.map((m) => (
                <li key={m.id}>
                  {m.name} — due {formatTimestamp(m.dueDate)}
                  {m.completedAt ? ' (complete)' : ''}
                </li>
              ))}
            </ul>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginTop: 12, marginBottom: 4 }}>
              Acceptance criteria
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, fontSize: 13, color: '#1f2937' }}>
              {packet.acceptanceCriteria.map((c) => (
                <li key={c.id} style={{ padding: '4px 0' }}>
                  <span style={{ color: c.signedByUserId ? '#15803d' : '#475569' }}>
                    {c.signedByUserId ? '✓' : '○'}
                  </span>
                  {' '}{c.description}
                  {c.required ? <em style={{ marginLeft: 6, color: '#7f1d1d' }}>required</em> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: '#64748b' }}>No handoff packet attached yet.</p>
        )}
      </section>

      {meter && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Burn</h2>
          <BurnMeterBar meter={meter} currency={iwo.currency} />
        </section>
      )}

      {/* Phase 6.UI.D.2 — ECD approval ladder. Opens once the IWO
          transitions IN_PROGRESS → DELIVERED. Until then the chain
          isn't initialised and we hide the panel. */}
      {iwo.approvalChain && (
        <section style={{ marginBottom: 24 }} data-testid="iwo-approval-ladder-section">
          <ApprovalLadderPanel iwoId={iwo.id} chain={iwo.approvalChain} />
        </section>
      )}

      {canStart && (
        <section style={{ marginBottom: 24 }}>
          <button
            type="button"
            data-testid="iwo-start"
            onClick={handleStart}
            disabled={busy}
            style={{
              padding: '8px 14px', borderRadius: 6, border: 'none',
              background: '#1d4ed8', color: '#fff', fontWeight: 600,
              cursor: busy ? 'wait' : 'pointer',
            }}
          >
            Start work (move to IN_PROGRESS)
          </button>
        </section>
      )}

      {iwo.state === 'IN_PROGRESS' && (
        <>
          <section style={{ marginBottom: 24 }} data-testid="iwo-post-time-section">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Post time</h2>
            <form onSubmit={handlePostTime} style={{ display: 'grid', gap: 8, maxWidth: 480 }} data-testid="iwo-post-time-form">
              <label style={{ fontSize: 12, color: '#475569' }}>
                Date
                <input
                  data-testid="te-date"
                  type="date"
                  value={teDate}
                  onChange={(e) => setTeDate(e.target.value)}
                  required
                  style={{ display: 'block', padding: 6, marginTop: 2, width: '100%' }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#475569' }}>
                Minutes
                <input
                  data-testid="te-minutes"
                  type="number"
                  min={1}
                  step={1}
                  value={teMinutes}
                  onChange={(e) => setTeMinutes(e.target.value)}
                  required
                  style={{ display: 'block', padding: 6, marginTop: 2, width: '100%' }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#475569' }}>
                Note (optional)
                <input
                  data-testid="te-note"
                  type="text"
                  value={teNote}
                  onChange={(e) => setTeNote(e.target.value)}
                  style={{ display: 'block', padding: 6, marginTop: 2, width: '100%' }}
                />
              </label>
              <button
                type="submit"
                data-testid="te-submit"
                disabled={!canPostEntries || busy}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none',
                  background: canPostEntries ? '#1d4ed8' : '#94a3b8',
                  color: '#fff', fontWeight: 600,
                  cursor: !canPostEntries || busy ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                }}
              >
                Post time
              </button>
            </form>
          </section>

          <section style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Post cost</h2>
            <form onSubmit={handlePostCost} style={{ display: 'grid', gap: 8, maxWidth: 480 }}>
              <label style={{ fontSize: 12, color: '#475569' }}>
                Kind
                <select
                  value={ceKind}
                  onChange={(e) => setCeKind(e.target.value as CostEntryKindForApi)}
                  style={{ display: 'block', padding: 6, marginTop: 2, width: '100%' }}
                >
                  <option value="VENDOR">Vendor</option>
                  <option value="MEDIA_SPEND">Media spend</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </label>
              <label style={{ fontSize: 12, color: '#475569' }}>
                Amount ({iwo.currency}, decimal)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={ceAmount}
                  onChange={(e) => setCeAmount(e.target.value)}
                  required
                  style={{ display: 'block', padding: 6, marginTop: 2, width: '100%' }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#475569' }}>
                Description (optional)
                <input
                  type="text"
                  value={ceDesc}
                  onChange={(e) => setCeDesc(e.target.value)}
                  style={{ display: 'block', padding: 6, marginTop: 2, width: '100%' }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#475569' }}>
                <input
                  type="checkbox"
                  checked={cePassThrough}
                  onChange={(e) => setCePassThrough(e.target.checked)}
                  style={{ marginRight: 6 }}
                />
                Pass-through (rebilled at cost to client)
              </label>
              <button
                type="submit"
                disabled={!canPostEntries || busy}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none',
                  background: canPostEntries ? '#1d4ed8' : '#94a3b8',
                  color: '#fff', fontWeight: 600,
                  cursor: !canPostEntries || busy ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                }}
              >
                Post cost
              </button>
            </form>
          </section>

          <section style={{ marginBottom: 24 }} data-testid="iwo-submit-deliverable-section">
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Submit deliverable</h2>
            <form onSubmit={handleSubmitDeliverable} style={{ display: 'grid', gap: 8, maxWidth: 480 }} data-testid="iwo-submit-deliverable-form">
              <label style={{ fontSize: 12, color: '#475569' }}>
                Asset ids (comma or whitespace separated; ≥1 required)
                <input
                  data-testid="del-asset-ids"
                  type="text"
                  value={delAssetIds}
                  onChange={(e) => setDelAssetIds(e.target.value)}
                  required
                  style={{ display: 'block', padding: 6, marginTop: 2, width: '100%' }}
                />
              </label>
              <label style={{ fontSize: 12, color: '#475569' }}>
                Description (optional)
                <input
                  data-testid="del-desc"
                  type="text"
                  value={delDesc}
                  onChange={(e) => setDelDesc(e.target.value)}
                  style={{ display: 'block', padding: 6, marginTop: 2, width: '100%' }}
                />
              </label>
              <button
                type="submit"
                data-testid="iwo-deliver"
                disabled={!canSubmitDeliverable || busy}
                style={{
                  padding: '8px 14px', borderRadius: 6, border: 'none',
                  background: canSubmitDeliverable ? '#15803d' : '#94a3b8',
                  color: '#fff', fontWeight: 600,
                  cursor: !canSubmitDeliverable || busy ? 'not-allowed' : 'pointer',
                  marginTop: 4,
                }}
              >
                Submit deliverable
              </button>
            </form>
          </section>
        </>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Recent entries
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
        }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Time ({timeEntries.length})
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
              {timeEntries.slice(0, 6).map((te) => (
                <li key={te.id} style={{ padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  {te.minutes} min · {formatMinor(te.costMinor, te.currency)}
                  {te.note ? <em style={{ marginLeft: 6, color: '#475569' }}>{te.note}</em> : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              Cost ({costEntries.length})
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12 }}>
              {costEntries.slice(0, 6).map((ce) => (
                <li key={ce.id} style={{ padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                  {ce.kind} · {formatMinor(ce.amountMinor, ce.currency)}
                  {ce.isPassThrough ? ' (pass-through)' : ''}
                  {ce.description ? <em style={{ marginLeft: 6, color: '#475569' }}>{ce.description}</em> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Deliverables ({deliverables.length})
        </h2>
        {deliverables.length === 0 ? (
          <p style={{ fontSize: 13, color: '#64748b' }}>None submitted yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 13 }}>
            {deliverables.map((d) => (
              <li key={d.id} style={{ padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                <strong>{d.name || d.id}</strong> · {d.state}
                {d.description ? <span style={{ marginLeft: 6, color: '#475569' }}>{d.description}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Spec §7.4 Layer 3 — the ONLY available action for a subsidiary
          user faced with a direct client request. No path to a quote,
          contract, or invoice exists from this page. */}
      <section style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Client got in touch directly?
        </h2>
        <p style={{ fontSize: 12, color: '#475569', marginTop: 0, marginBottom: 8 }}>
          The subsidiary does not answer the client on price, scope, or contract. Route the request to Account Management — they'll handle it.
        </p>
        {dawinUser && (
          <RouteToAMButton
            receivingSubsidiaryOrgId={iwo.subsidiaryOrgId}
            masterJobId={iwo.masterJobId}
            clientId={iwo.masterJobId}
            routedToUserId={packet?.commsOwnerUserId ?? ''}
            defaultNote={`Re: ${iwo.code} — `}
          />
        )}
      </section>
    </div>
  );
}
