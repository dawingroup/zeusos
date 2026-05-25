/**
 * EcdReviewPage — Phase 6.UI.D.2.
 *
 * Aggregates every IWO with an open `approvalChain` across the user's
 * brand. Four tabs partition the queue:
 *
 *   Pending      — `currentRung` matches the user's rung; awaits action
 *   In Progress  — chain open at a different rung (visibility only)
 *   Returned     — last history entry is `REJECT` (the rejection-loop
 *                  signal — this row is back at the originator)
 *   History      — `approvalChain.complete === true`
 *
 * Phase 6.D scope gates the action on parent-org only (the callable
 * enforces this). Per-rung RBAC ("only ECDs see the ECD-rung Pending
 * tab") lands in 6.D.2-RBAC as a follow-up.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Hourglass, Undo2, History as HistoryIcon } from 'lucide-react';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import type { ApprovalRung } from '@/modules/assignment/types/approval-chain.types';
import {
  subscribeAllDeliveredIwos,
  subscribeCompletedApprovals,
} from '../services/approval-ladder.service';
import { ApprovalChainTimeline } from '../components/ApprovalChainTimeline';
import { cn } from '@/shared/lib/utils';

type Tab = 'pending' | 'progress' | 'returned' | 'history';

const TAB_DEFS: { id: Tab; label: string; icon: typeof Inbox; testId: string }[] = [
  { id: 'pending',  label: 'Pending (my rung)', icon: Inbox,       testId: 'ecd-tab-pending' },
  { id: 'progress', label: 'In Progress',       icon: Hourglass,   testId: 'ecd-tab-progress' },
  { id: 'returned', label: 'Returned',          icon: Undo2,       testId: 'ecd-tab-returned' },
  { id: 'history',  label: 'History',           icon: HistoryIcon, testId: 'ecd-tab-history' },
];

function partition(iwos: InternalWorkOrder[], myRung: ApprovalRung | 'ALL') {
  const pending: InternalWorkOrder[] = [];
  const progress: InternalWorkOrder[] = [];
  const returned: InternalWorkOrder[] = [];
  for (const iwo of iwos) {
    const chain = iwo.approvalChain;
    if (!chain) continue;
    const last = chain.history[chain.history.length - 1];
    if (last?.action === 'REJECT') {
      returned.push(iwo);
      continue;
    }
    if (myRung === 'ALL' || chain.currentRung === myRung) {
      pending.push(iwo);
    } else {
      progress.push(iwo);
    }
  }
  return { pending, progress, returned };
}

export default function EcdReviewPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [delivered, setDelivered] = useState<InternalWorkOrder[]>([]);
  const [completed, setCompleted] = useState<InternalWorkOrder[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // Per-rung scope. The Phase 6.D.2-RBAC follow-up will derive this
  // from the current user's role profile. For PR 4, default to 'ALL'
  // so parent-org admins see every Pending row.
  const myRung: ApprovalRung | 'ALL' = 'ALL';

  useEffect(() => {
    const u1 = subscribeAllDeliveredIwos(setDelivered, (e) =>
      setErr(`Approval-ladder subscription failed: ${e.message}`),
    );
    const u2 = subscribeCompletedApprovals(setCompleted);
    return () => { u1(); u2(); };
  }, []);

  const { pending, progress, returned } = useMemo(
    () => partition(delivered, myRung),
    [delivered, myRung],
  );

  const visible: InternalWorkOrder[] = useMemo(() => {
    switch (tab) {
      case 'pending':  return pending;
      case 'progress': return progress;
      case 'returned': return returned;
      case 'history':  return completed;
    }
  }, [tab, pending, progress, returned, completed]);

  const tabCount = (t: Tab): number => {
    switch (t) {
      case 'pending':  return pending.length;
      case 'progress': return progress.length;
      case 'returned': return returned.length;
      case 'history':  return completed.length;
    }
  };

  return (
    <div className="p-6" data-testid="ecd-review-page">
      <header className="mb-4">
        <h1 className="text-[20px] font-semibold text-[var(--fg-primary)] mb-1">
          ECD Review
        </h1>
        <p className="text-[13px] text-[var(--fg-tertiary)]">
          Approval-ladder rungs awaiting action across in-flight IWOs.
        </p>
      </header>

      {err && (
        <div
          role="alert"
          data-testid="ecd-review-error"
          className="mb-4 p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] text-[13px]"
        >
          {err}
        </div>
      )}

      <nav className="border-b border-[var(--border-default)] mb-4" aria-label="ECD Review tabs">
        <ul className="flex gap-1 -mb-px">
          {TAB_DEFS.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === tab;
            return (
              <li key={t.id}>
                <button
                  data-testid={t.testId}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 transition-colors',
                    isActive
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-transparent text-[var(--fg-secondary)] hover:text-[var(--fg-primary)]',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {t.label}
                  <span
                    className={cn(
                      'inline-block text-[10.5px] px-1.5 py-0.5 rounded',
                      isActive ? 'bg-[var(--accent-soft)]' : 'bg-[var(--bg-sunken)]',
                    )}
                  >
                    {tabCount(t.id)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {visible.length === 0 ? (
        <p
          data-testid="ecd-review-empty"
          className="text-[13px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          {tab === 'pending'
            ? 'Nothing awaits your action right now.'
            : tab === 'progress'
              ? 'No IWOs are climbing the ladder elsewhere.'
              : tab === 'returned'
                ? 'No IWOs have been rejected.'
                : 'No approvals have been completed yet.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((iwo) => (
            <li
              key={iwo.id}
              data-testid={`ecd-row-${iwo.id}`}
              className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
            >
              <header className="flex items-baseline justify-between gap-3 mb-2">
                <Link
                  to={`/delivery/iwo/${iwo.id}`}
                  className="text-[13.5px] font-semibold text-[var(--fg-primary)] hover:underline"
                >
                  {iwo.code || iwo.id}
                </Link>
                <span className="text-[11px] font-mono text-[var(--fg-tertiary)]">
                  {iwo.subsidiaryOrgId}
                </span>
              </header>
              {iwo.approvalChain && (
                <ApprovalChainTimeline chain={iwo.approvalChain} compact />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
