/**
 * Approvals — the unified, cross-source inbox (port stream F).
 *
 * A thin presenter over `useApprovalsInbox`: all aggregation, filtering and
 * sorting live in the tested projection core, so this component only maps
 * the already-normalized `ApprovalItem[]` to rows and wires each row's
 * Approve / Reject to the callable that already owns that decision
 * (`approvalActions.ts`). It lists everything waiting on a person — ECD
 * ladder rungs, IWOs awaiting internal acceptance, SOWs pending approval,
 * draft change orders, quotes out with the client, and supplier invoices —
 * most urgent first.
 *
 * Dual-scope like TeamTimePage: a parent-org principal sees every queue; a
 * brand's staff see their brand's IWO rows; the rules enforce the same.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useCurrentDawinUser } from '@/core/settings';
import { PageHero } from '@/shared/components/refresh';
import { pushToast } from '@/shared/components/feedback/toastBus';
import { PersonName } from '@/shared/people';
import { describeCallableError } from '@/shared/utils/callableError';
import { formatMinor } from '@/shared/utils/money';

import { actionsFor } from '../approvalActions';
import { approvalRowHref } from '../approvalRowHref';
import { humanizeAction } from '../approvalsProjection';
import { useApprovalsInbox, type ApprovalsFeedName } from '../hooks/useApprovalsInbox';
import { resolveApprovalsScope } from '../scope';
import type { ApprovalItem, ApprovalKind, ApprovalUrgency } from '../types';

const URGENCY_ORDER: ApprovalUrgency[] = ['critical', 'high', 'medium', 'low'];

const URGENCY_STYLE: Record<ApprovalUrgency, { bg: string; fg: string }> = {
  critical: { bg: '#fee2e2', fg: '#991b1b' },
  high: { bg: '#ffedd5', fg: '#9a3412' },
  medium: { bg: '#fef3c7', fg: '#92400e' },
  low: { bg: '#f1f5f9', fg: '#334155' },
};

export const KIND_LABELS: Record<ApprovalKind, string> = {
  ecd_rung: 'ECD ladder',
  iwo_internal_acceptance: 'Internal acceptance',
  sow_approval: 'SOW',
  change_order: 'Change order',
  quote_awaiting_client: 'Quote (client)',
  talent_invoice: 'Talent invoice',
  media_supplier_invoice: 'Media invoice',
};

const FEED_LABELS: Record<ApprovalsFeedName, string> = {
  iwos: 'IWOs',
  sows: 'SOWs',
  changeOrders: 'change orders',
  quotes: 'quotes',
  talentInvoices: 'talent invoices',
  mediaSupplierInvoices: 'media invoices',
};

function UrgencyBadge({ urgency }: { urgency: ApprovalUrgency }) {
  const s = URGENCY_STYLE[urgency];
  return (
    <span
      data-testid="approval-urgency"
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'capitalize',
        background: s.bg,
        color: s.fg,
      }}
    >
      {urgency}
    </span>
  );
}

const btn = (variant: 'primary' | 'danger' | 'ghost', disabled?: boolean): React.CSSProperties => ({
  padding: '6px 10px',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.55 : 1,
  border: variant === 'ghost' ? '1px solid #e2e8f0' : '1px solid transparent',
  background: variant === 'primary' ? '#0f172a' : variant === 'danger' ? '#fff1f2' : '#fff',
  color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#9f1239' : '#0f172a',
});

export default function ApprovalsInboxPage() {
  const { dawinUser } = useCurrentDawinUser();
  const scope = useMemo(() => resolveApprovalsScope(dawinUser), [dawinUser]);
  const { items, loading, error, degraded, resubscribe } = useApprovalsInbox(scope);
  const actorUserId = dawinUser?.uid ?? '';

  const [kindFilter, setKindFilter] = useState<ApprovalKind | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; note: string } | null>(null);

  const counts = useMemo(() => {
    const byUrgency: Record<ApprovalUrgency, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of items) byUrgency[i.urgency] += 1;
    return byUrgency;
  }, [items]);

  const kindsPresent = useMemo(
    () => (Object.keys(KIND_LABELS) as ApprovalKind[]).filter((k) => items.some((i) => i.kind === k)),
    [items],
  );
  const visible = useMemo(
    () => (kindFilter === 'all' ? items : items.filter((i) => i.kind === kindFilter)),
    [items, kindFilter],
  );

  async function runApprove(item: ApprovalItem) {
    const action = actionsFor(item).approve;
    if (!action) return;
    setBusyId(item.id);
    try {
      await action.run(item, { actorUserId });
      pushToast(`${action.label}: ${item.entity.ref ?? item.title}`, { tone: 'success' });
    } catch (err) {
      pushToast(describeCallableError(err, `${action.label.toLowerCase()} ${item.entity.ref ?? 'this'}`), { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function runReject(item: ApprovalItem, note: string) {
    const action = actionsFor(item).reject;
    if (!action) return;
    if (!note.trim()) {
      pushToast('A note is required to send this back.', { tone: 'error' });
      return;
    }
    setBusyId(item.id);
    try {
      await action.run(item, note.trim(), { actorUserId });
      pushToast(`${action.label}: ${item.entity.ref ?? item.title}`, { tone: 'success' });
      setRejecting(null);
    } catch (err) {
      pushToast(describeCallableError(err, `${action.label.toLowerCase()} ${item.entity.ref ?? 'this'}`), { tone: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: '0 0 32px' }} data-testid="approvals-inbox">
      <PageHero
        eyebrow="Operations · Approvals"
        title="Approvals"
        body={
          <span data-testid="approvals-scope-note">
            {scope.kind === 'parent'
              ? 'Everything awaiting a decision across the group — ECD rungs, internal acceptance, SOWs, change orders, quotes out with clients, supplier invoices — most urgent first.'
              : scope.kind === 'brand'
                ? 'Your brand’s delivered work awaiting approval — ECD ladder rungs and internal acceptance — most urgent first.'
                : 'No approvals scope for your account.'}
          </span>
        }
        actions={
          <button type="button" onClick={resubscribe} style={btn('ghost')} data-testid="approvals-refresh">
            Refresh
          </button>
        }
      />

      {scope.kind !== 'none' && (
        <section
          data-testid="approvals-summary"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, margin: '16px 0' }}
        >
          {URGENCY_ORDER.map((u) => (
            <div key={u} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', background: '#fff' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#64748b' }}>{u}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: '#0f172a' }} data-testid={`approvals-count-${u}`}>
                {counts[u]}
              </div>
            </div>
          ))}
        </section>
      )}

      {kindsPresent.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }} data-testid="approvals-kind-filter">
          {(['all', ...kindsPresent] as Array<ApprovalKind | 'all'>).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKindFilter(k)}
              style={{
                ...btn('ghost'),
                background: kindFilter === k ? '#0f172a' : '#fff',
                color: kindFilter === k ? '#fff' : '#0f172a',
              }}
            >
              {k === 'all' ? `All (${items.length})` : `${KIND_LABELS[k]} (${items.filter((i) => i.kind === k).length})`}
            </button>
          ))}
        </div>
      )}

      {degraded.length > 0 && (
        <p data-testid="approvals-degraded" style={{ color: '#92400e', background: '#fef3c7', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
          Some queues are not visible to your account and are shown as empty: {degraded.map((d) => FEED_LABELS[d]).join(', ')}.
        </p>
      )}
      {error && (
        <p data-testid="approvals-error" style={{ color: '#991b1b', background: '#fee2e2', padding: '8px 12px', borderRadius: 8, fontSize: 12 }}>
          Couldn’t load part of the approvals queue: {error.message}
        </p>
      )}

      {scope.kind === 'none' ? null : loading && items.length === 0 ? (
        <p data-testid="approvals-loading" style={{ color: '#64748b', fontSize: 13 }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p data-testid="approvals-empty" style={{ color: '#64748b', fontSize: 13 }}>
          Nothing is waiting on a decision right now.
        </p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }} data-testid="approvals-table">
            <thead>
              <tr style={{ textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: '#64748b', background: '#f8fafc' }}>
                <th style={{ padding: '8px 12px' }}>Urgency</th>
                <th style={{ padding: '8px 12px' }}>Item</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th>
                <th style={{ padding: '8px 12px' }}>Raised by</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Waiting</th>
                <th style={{ padding: '8px 12px' }}>Decision</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const href = approvalRowHref(item);
                const actions = actionsFor(item);
                const busy = busyId === item.id;
                const isRejecting = rejecting?.id === item.id;
                const overdue = item.dueAtMs !== undefined && item.dueAtMs < Date.now();
                const selfRaised = !!item.requesterUserId && item.requesterUserId === actorUserId;
                return (
                  <tr key={item.id} data-testid={`approval-row-${item.id}`} style={{ borderTop: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <UrgencyBadge urgency={item.urgency} />
                    </td>
                    <td style={{ padding: '10px 12px', minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>
                        {href ? <Link to={href} style={{ color: 'inherit' }}>{item.title}</Link> : item.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {KIND_LABELS[item.kind]} · {humanizeAction(item.requiredAction)}
                        {item.brandId ? ` · ${item.brandId}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {item.amountMinor != null ? formatMinor(item.amountMinor, item.currency) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {item.requesterUserId ? <PersonName id={item.requesterUserId} /> : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {item.daysPending != null ? `${item.daysPending}d` : '—'}
                      {overdue && (
                        <div style={{ fontSize: 11, color: '#991b1b', fontWeight: 600 }} data-testid="approval-sla-passed">
                          SLA passed
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {selfRaised && (actions.approve || actions.reject) ? (
                        <span style={{ fontSize: 12, color: '#64748b' }} data-testid="approval-self-raised">
                          You raised this — someone else decides.
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {actions.approve && (
                            <button
                              type="button"
                              style={btn('primary', busy)}
                              disabled={busy}
                              onClick={() => void runApprove(item)}
                              data-testid={`approve-${item.id}`}
                            >
                              {busy ? 'Working…' : actions.approve.label}
                            </button>
                          )}
                          {actions.reject && !isRejecting && (
                            <button
                              type="button"
                              style={btn('danger', busy)}
                              disabled={busy}
                              onClick={() => setRejecting({ id: item.id, note: '' })}
                              data-testid={`reject-${item.id}`}
                            >
                              {actions.reject.label}
                            </button>
                          )}
                          {href && (
                            <Link to={href} style={{ ...btn('ghost'), textDecoration: 'none', display: 'inline-block' }}>
                              Open
                            </Link>
                          )}
                        </div>
                      )}
                      {isRejecting && actions.reject && (
                        <div style={{ marginTop: 8, display: 'grid', gap: 6, maxWidth: 360 }} data-testid={`reject-note-${item.id}`}>
                          <label style={{ fontSize: 12, color: '#334155' }}>{actions.reject.notePrompt}</label>
                          <textarea
                            value={rejecting.note}
                            onChange={(e) => setRejecting({ id: item.id, note: e.target.value })}
                            rows={2}
                            style={{ fontSize: 12, padding: 6, border: '1px solid #e2e8f0', borderRadius: 6 }}
                            aria-label="Rejection note"
                          />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              style={btn('danger', busy)}
                              disabled={busy}
                              onClick={() => void runReject(item, rejecting.note)}
                              data-testid={`reject-confirm-${item.id}`}
                            >
                              {busy ? 'Working…' : `Confirm — ${actions.reject.label}`}
                            </button>
                            <button type="button" style={btn('ghost')} onClick={() => setRejecting(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
