/**
 * IWOInboxPage — the subsidiary delivery workspace inbox.
 *
 * Shows every IWO issued to the current user's home subsidiary that is in
 * state `ISSUED`. Each row exposes Accept / Reject buttons that invoke the
 * Phase 3.B Cloud Functions. Rejecting prompts for a reason (required by
 * the Cloud Function — empty strings throw 400).
 *
 * Spec §6.1.1: only the delivery lead of the receiving subsidiary can
 * accept or reject. Firestore rules + the callable both check this; the
 * UI surfaces the resulting error as a banner.
 *
 * UI refresh (batch 3b): PageHero + brand-edge .card rows + btn-accept/
 * btn-reject. All data wiring and data-testids preserved.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentDawinUser } from '@/core/settings';
import type { InternalWorkOrder } from '@/modules/assignment';
import type { SubsidiaryId } from '@/core/settings/types';
import { subscribeIWOInbox, subscribeIWOActive } from '../services/firestore';
import { acceptWorkOrderFn, rejectWorkOrderFn } from '../services/firebase';
import { resolveHomeSubsidiaryId } from '../components/deliveryAccess';
import { isConflictIsolated } from '@/core/navigation/manifest';
import { PageHero, SectionH, Pill } from '@/shared/components/refresh';

function formatMinor(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTimestamp(ts: InternalWorkOrder['issuedAt']): string {
  if (!ts) return '—';
  if (typeof ts === 'string') return new Date(ts).toLocaleString();
  const maybe = ts as unknown as { toDate?: () => Date; seconds?: number };
  if (typeof maybe.toDate === 'function') return maybe.toDate().toLocaleString();
  if (typeof maybe.seconds === 'number') return new Date(maybe.seconds * 1000).toLocaleString();
  return '—';
}

export default function IWOInboxPage() {
  const { dawinUser } = useCurrentDawinUser();
  const homeSub = useMemo<SubsidiaryId | null>(
    () => (dawinUser ? (resolveHomeSubsidiaryId(dawinUser) as SubsidiaryId | null) : null),
    [dawinUser],
  );

  const [inbox, setInbox] = useState<InternalWorkOrder[]>([]);
  const [active, setActive] = useState<InternalWorkOrder[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!homeSub) return;
    const u1 = subscribeIWOInbox(homeSub, setInbox, (e) => setErr(`Inbox load failed: ${e.message}`));
    const u2 = subscribeIWOActive(homeSub, setActive, () => { /* swallow — active list is a convenience */ });
    return () => { u1(); u2(); };
  }, [homeSub]);

  const handleAccept = async (iwo: InternalWorkOrder) => {
    setBusyId(iwo.id);
    setErr(null);
    try {
      await acceptWorkOrderFn({ iwoId: iwo.id });
    } catch (e) {
      setErr(`Accept failed for ${iwo.code}: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (iwo: InternalWorkOrder) => {
    // eslint-disable-next-line no-alert -- prompt is the simplest reason-capture; will move to a dialog when toast/dialog system is unified
    const reason = window.prompt(`Reject ${iwo.code}?\nReason (required):`);
    if (!reason || !reason.trim()) return;
    setBusyId(iwo.id);
    setErr(null);
    try {
      await rejectWorkOrderFn({ iwoId: iwo.id, reason: reason.trim() });
    } catch (e) {
      setErr(`Reject failed for ${iwo.code}: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  if (!dawinUser) {
    return <div style={{ padding: 'var(--pad-page)', color: 'var(--fg-tertiary)' }}>Loading user…</div>;
  }
  if (!homeSub) {
    return (
      <div style={{ padding: 'var(--pad-page)' }}>
        <PageHero eyebrow="Delivery" title="IWO inbox" body="You don't appear to have access to any operating subsidiary. Speak to your administrator." />
      </div>
    );
  }

  const showIsolationBanner = isConflictIsolated(homeSub);

  return (
    <div style={{ padding: 'var(--pad-page)' }} data-testid="iwo-inbox-page">
      <PageHero
        eyebrow={`${homeSub} · Delivery`}
        title="IWO inbox"
        body="Internal work orders issued to your brand. Accept to lock the budget hold; reject (with reason) to release it."
      />

      {showIsolationBanner && (
        <div
          role="note"
          data-testid="iwo-inbox-isolation-banner"
          style={{
            padding: '10px 14px',
            marginBottom: 16,
            borderRadius: 'var(--radius)',
            background: 'var(--rag-amber-soft)',
            color: 'var(--rag-amber)',
            border: '1px solid var(--rag-amber)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Conflict-isolated workspace — your clients are not visible to other brands.
        </div>
      )}

      {err && (
        <div
          role="alert"
          data-testid="iwo-inbox-error"
          style={{
            padding: 12,
            marginBottom: 16,
            borderRadius: 'var(--radius)',
            background: 'var(--rag-red-soft)',
            color: 'var(--rag-red)',
            border: '1px solid var(--rag-red)',
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      <section data-testid="iwo-inbox-awaiting">
        <SectionH
          title={
            <>
              Awaiting acceptance (<span data-testid="iwo-inbox-awaiting-count">{inbox.length}</span>)
            </>
          }
          titleSize={15}
        />
        {inbox.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }} data-testid="iwo-inbox-empty">
            No new work orders issued to you.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inbox.map((iwo) => {
              const busy = busyId === iwo.id;
              return (
                <div key={iwo.id} className="card card-pad brand-edge" data-testid={`iwo-row-${iwo.id}`}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <Link to={`/delivery/iwo/${iwo.id}`} className="mono hover:underline" style={{ fontWeight: 600 }} data-testid={`iwo-row-${iwo.id}-code`}>
                        {iwo.code}
                      </Link>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-tertiary)', marginTop: 2 }}>
                        <span data-testid={`iwo-row-${iwo.id}-budget`}>{formatMinor(iwo.budgetMinor, iwo.currency)}</span>
                        {' · issued '}{formatTimestamp(iwo.issuedAt)}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                      <button
                        type="button"
                        data-testid={`iwo-row-${iwo.id}-accept`}
                        onClick={() => handleAccept(iwo)}
                        disabled={busy}
                        className="btn btn-accept"
                      >
                        {busy ? '…' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        data-testid={`iwo-row-${iwo.id}-reject`}
                        onClick={() => handleReject(iwo)}
                        disabled={busy}
                        className="btn btn-reject"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <SectionH title={`In-flight (${active.length})`} titleSize={15} />
      {active.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Nothing in flight.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {active.map((iwo) => (
            <div key={iwo.id} className="card card-pad brand-edge">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Link to={`/delivery/iwo/${iwo.id}`} className="mono hover:underline" style={{ fontWeight: 600 }}>
                  {iwo.code}
                </Link>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--fg-tertiary)' }} className="tabular">
                    {formatMinor(iwo.cumulativeCostMinor, iwo.currency)} of {formatMinor(iwo.budgetMinor, iwo.currency)}
                  </span>
                  <Pill tone="blue">{iwo.state}</Pill>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
