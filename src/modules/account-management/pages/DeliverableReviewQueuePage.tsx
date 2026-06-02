/**
 * /account-mgmt/reviews — DELIVERED IWOs awaiting AM acceptance.
 *
 * Per IWO row:
 *   - Acceptance criteria checkboxes (signed/unsigned state from packet)
 *   - "Accept internal" → calls `acceptInternal` (gated by 3.B CF on all
 *     required criteria being signed)
 *   - "Request revision" with notes → calls `requestRevision` with the
 *     unsigned criterion ids
 *
 * Signing a criterion goes through the dedicated `signAcceptanceCriterion`
 * CF (firestore.rules blocks direct packet writes).
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  listDeliveredIwosForAccountManager,
  getHandoffPacket,
} from '@/modules/assignment/services/firestore';
import {
  acceptInternalFn,
  requestRevisionFn,
  signAcceptanceCriterionFn,
} from '@/modules/assignment/services/firebase';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import type { HandoffPacket } from '@/modules/assignment/types/handoff-packet.types';
import { useAuth } from '@/shared/hooks';
import { PageHero } from '@/shared/components/refresh';
import { formatMinor } from '../utils/money';

// Brand accents (UI Refresh v3 — light accents). Drives the per-card
// brand-edge marker on each review row.
const BRAND_ACCENT: Record<string, string> = {
  'zeus-group': '#0a1f4a',
  'zeus-the-agency': '#f5d900',
  'zeus-digital': '#00c5e5',
  labyrinth: '#c8f0d6',
  'odd-gorilla': '#ffb0b8',
  'house-of-zeus': '#c8ff3c',
};

interface ReviewRow {
  iwo: InternalWorkOrder;
  packet: HandoffPacket | null;
}

export default function DeliverableReviewQueuePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIwo, setBusyIwo] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const iwos = await listDeliveredIwosForAccountManager(user?.uid);
    const enriched: ReviewRow[] = [];
    for (const iwo of iwos) {
      const packet = await getHandoffPacket(iwo.id).catch(() => null);
      enriched.push({ iwo, packet });
    }
    setRows(enriched);
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleToggleSign = async (iwoId: string, criterionId: string, currentlySigned: boolean) => {
    setBusyIwo(iwoId);
    try {
      await signAcceptanceCriterionFn({ iwoId, criterionId, sign: !currentlySigned });
      await refresh();
    } catch (err) {
      alert(`Sign toggle failed: ${(err as Error).message}`);
    } finally {
      setBusyIwo(null);
    }
  };

  const handleAcceptInternal = async (iwoId: string) => {
    setBusyIwo(iwoId);
    try {
      await acceptInternalFn({ iwoId });
      await refresh();
    } catch (err) {
      alert(`acceptInternal failed: ${(err as Error).message}`);
    } finally {
      setBusyIwo(null);
    }
  };

  const handleRequestRevision = async (iwoId: string, unsignedCriterionIds: string[]) => {
    const notes = prompt('Revision notes (briefly describe what the delivery team needs to address):');
    if (!notes) return;
    if (unsignedCriterionIds.length === 0) {
      alert('No unsigned required criteria — nothing to send back. Sign criteria first to use this flow.');
      return;
    }
    setBusyIwo(iwoId);
    try {
      await requestRevisionFn({ iwoId, criteriaFailures: unsignedCriterionIds });
      await refresh();
    } catch (err) {
      alert(`requestRevision failed: ${(err as Error).message}`);
    } finally {
      setBusyIwo(null);
    }
  };

  const awaiting = rows.filter(({ packet }) => {
    const criteria = packet?.acceptanceCriteria || [];
    return criteria.some((c) => c.required && !c.signedByUserId) || criteria.length === 0;
  }).length;
  const ready = rows.length - awaiting;

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <PageHero
        eyebrow="Account Management"
        title="Review Queue"
        body="DELIVERED Internal Work Orders awaiting AM sign-off before they go to the client. Tick the acceptance criteria as you verify them; when all required criteria are signed, “Accept internal” unlocks. Anything failing → “Request revision” bounces it back to delivery."
      />

      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          {[
            { label: 'Awaiting sign-off', value: awaiting, tone: 'var(--rag-amber)' },
            { label: 'Ready to accept', value: ready, tone: 'var(--rag-green)' },
            { label: 'In queue', value: rows.length, tone: 'var(--fg-primary)' },
          ].map((s) => (
            <div key={s.label} className="card card-pad" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="display tabular" style={{ fontSize: 26, color: s.tone }}>{s.value}</span>
              <span className="eyebrow" style={{ fontSize: 10.5 }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {loading && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading review queue…</p>}

      {!loading && rows.length === 0 && (
        <div className="card card-pad" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}>
          No deliverables awaiting review. As subsidiaries submit deliverables, IWOs will appear here.
        </div>
      )}

      {!loading && rows.map(({ iwo, packet }) => {
        const criteria = packet?.acceptanceCriteria || [];
        const unsignedRequired = criteria.filter(c => c.required && !c.signedByUserId);
        const canAccept = unsignedRequired.length === 0 && criteria.length > 0;
        const accent = BRAND_ACCENT[iwo.subsidiaryOrgId] ?? '#0a1f4a';
        return (
          <article key={iwo.id} className="card card-pad brand-edge" style={{ ['--brand-accent' as string]: accent }}>
            <header className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link to={`/master-jobs/${iwo.masterJobId}`} className="mono hover:underline" style={{ fontSize: 12, color: 'var(--rag-blue)' }}>{iwo.code}</Link>
                <div className="text-sm font-medium">{iwo.subsidiaryOrgId}</div>
                <div className="text-xs text-muted-foreground">
                  Budget {formatMinor(iwo.budgetMinor, iwo.currency)} ·
                  Cumulative {formatMinor(iwo.cumulativeCostMinor || 0, iwo.currency)}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleRequestRevision(iwo.id, unsignedRequired.map(c => c.id))}
                  disabled={busyIwo === iwo.id || unsignedRequired.length === 0}
                  className="btn btn-reject"
                  title={unsignedRequired.length === 0 ? 'Sign criteria first to use this' : ''}
                >
                  Request revision
                </button>
                <button
                  onClick={() => handleAcceptInternal(iwo.id)}
                  disabled={busyIwo === iwo.id || !canAccept}
                  className="btn btn-accept"
                  title={!canAccept ? 'All required criteria must be signed' : ''}
                >
                  Accept internal
                </button>
              </div>
            </header>

            {packet && (
              <details className="mt-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Brief</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded border bg-[var(--bg-sunken)] p-3 font-mono text-xs">{packet.briefMd}</pre>
              </details>
            )}

            <h3 className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Acceptance criteria</h3>
            {criteria.length === 0 && (
              <p className="text-xs text-[var(--rag-red)]">⚠ Handoff packet missing criteria — cannot accept.</p>
            )}
            <ul className="mt-1 space-y-1 text-sm">
              {criteria.map(c => {
                const signed = !!c.signedByUserId;
                return (
                  <li key={c.id} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={signed}
                      onChange={() => handleToggleSign(iwo.id, c.id, signed)}
                      disabled={busyIwo === iwo.id}
                      className="mt-1"
                    />
                    <span className={signed ? 'line-through text-muted-foreground' : ''}>
                      {c.description}
                      {c.required && <span className="ml-1 text-xs text-[var(--rag-red)]">required</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
