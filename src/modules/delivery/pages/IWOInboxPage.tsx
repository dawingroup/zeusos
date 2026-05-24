/* eslint-disable design-system/no-inline-style-literals -- TODO(U.4): early Phase 3.E scaffolding, uses inline px + hex throughout. Real Tailwind/token refactor scheduled for U.4. */
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
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentDawinUser } from '@/core/settings';
import type { InternalWorkOrder } from '@/modules/assignment';
import type { SubsidiaryId } from '@/core/settings/types';
import { subscribeIWOInbox, subscribeIWOActive } from '../services/firestore';
import { acceptWorkOrderFn, rejectWorkOrderFn } from '../services/firebase';
import { resolveHomeSubsidiaryId } from '../components/deliveryAccess';

function formatMinor(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatTimestamp(ts: InternalWorkOrder['issuedAt']): string {
  if (!ts) return '—';
  if (typeof ts === 'string') return new Date(ts).toLocaleString();
  // Firestore Timestamp duck-typed
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
    const u1 = subscribeIWOInbox(
      homeSub,
      setInbox,
      (e) => setErr(`Inbox load failed: ${e.message}`),
    );
    const u2 = subscribeIWOActive(
      homeSub,
      setActive,
      () => { /* swallow — active list is a convenience */ },
    );
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
    return <div style={{ padding: 24 }}>Loading user…</div>;
  }
  if (!homeSub) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Delivery Inbox</h1>
        <p style={{ color: '#475569' }}>
          You don't appear to have access to any operating subsidiary. Speak to your administrator.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }} data-testid="iwo-inbox-page">
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Delivery Inbox</h1>
        <p style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>
          Internal work orders issued to <strong>{homeSub}</strong>. Accept to lock the budget hold; reject (with reason) to release it.
        </p>
      </header>

      {err && (
        <div role="alert" data-testid="iwo-inbox-error" style={{
          padding: 12, marginBottom: 16, borderRadius: 6,
          background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca',
        }}>
          {err}
        </div>
      )}

      <section style={{ marginBottom: 32 }} data-testid="iwo-inbox-awaiting">
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          Awaiting acceptance (<span data-testid="iwo-inbox-awaiting-count">{inbox.length}</span>)
        </h2>
        {inbox.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13 }} data-testid="iwo-inbox-empty">No new work orders issued to you.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px' }}>Code</th>
                <th style={{ padding: '8px 12px' }}>Budget</th>
                <th style={{ padding: '8px 12px' }}>Issued</th>
                <th style={{ padding: '8px 12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inbox.map((iwo) => {
                const busy = busyId === iwo.id;
                return (
                  <tr key={iwo.id} data-testid={`iwo-row-${iwo.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }} data-testid={`iwo-row-${iwo.id}-code`}>{iwo.code}</td>
                    <td style={{ padding: '10px 12px' }} data-testid={`iwo-row-${iwo.id}-budget`}>{formatMinor(iwo.budgetMinor, iwo.currency)}</td>
                    <td style={{ padding: '10px 12px' }}>{formatTimestamp(iwo.issuedAt)}</td>
                    <td style={{ padding: '10px 12px', display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        data-testid={`iwo-row-${iwo.id}-accept`}
                        onClick={() => handleAccept(iwo)}
                        disabled={busy}
                        style={{
                          padding: '6px 12px', borderRadius: 4, border: 'none',
                          background: '#15803d', color: '#fff', fontWeight: 600,
                          cursor: busy ? 'wait' : 'pointer',
                        }}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        data-testid={`iwo-row-${iwo.id}-reject`}
                        onClick={() => handleReject(iwo)}
                        disabled={busy}
                        style={{
                          padding: '6px 12px', borderRadius: 4,
                          background: '#fff', color: '#7f1d1d',
                          border: '1px solid #fecaca', fontWeight: 600,
                          cursor: busy ? 'wait' : 'pointer',
                        }}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
          In-flight ({active.length})
        </h2>
        {active.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: 13 }}>Nothing in flight.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {active.map((iwo) => (
              <li key={iwo.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <Link
                  to={`/delivery/iwo/${iwo.id}`}
                  style={{ color: '#1d4ed8', textDecoration: 'none', fontWeight: 600 }}
                >
                  {iwo.code}
                </Link>
                <span style={{ marginLeft: 12, color: '#475569' }}>
                  {iwo.state} · {formatMinor(iwo.cumulativeCostMinor, iwo.currency)} of {formatMinor(iwo.budgetMinor, iwo.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
