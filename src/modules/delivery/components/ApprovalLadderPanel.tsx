/**
 * ApprovalLadderPanel — Phase 6.UI.D.2.
 *
 * Embedded panel on the IWO workspace that:
 *   - Renders the live `ApprovalChainTimeline` (rungs with status).
 *   - Surfaces "Advance" / "Reject with notes" actions for the current
 *     rung. Advance calls `advanceApprovalRungFn`; reject opens an
 *     inline notes textarea before calling `rejectApprovalRungFn`.
 *
 * Per-rung RBAC (only ECDs can advance the ECD rung, etc.) ships in
 * Phase 6.D.2 follow-up. For 6.D + this PR, the callable enforces a
 * parent-org gate only.
 */

import { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type {
  ApprovalChain,
  ApprovalRung,
} from '@/modules/assignment/types/approval-chain.types';
import { isApprovalComplete } from '@/modules/assignment/types/approval-chain.types';
import {
  advanceApprovalRungFn,
  rejectApprovalRungFn,
} from '../services/approval-ladder.service';
import { ApprovalChainTimeline } from './ApprovalChainTimeline';

interface Props {
  iwoId: string;
  chain: ApprovalChain;
}

const RUNG_LABEL: Record<ApprovalRung, string> = {
  DESIGNER: 'Designer',
  AD: 'AD',
  STUDIO_MGR: 'Studio Mgr',
  ACD: 'ACD',
  CD: 'CD',
  ECD: 'ECD',
};

export function ApprovalLadderPanel({ iwoId, chain }: Props) {
  const [busy, setBusy] = useState<'advance' | 'reject' | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const complete = isApprovalComplete(chain);
  const terminalRung = chain.ladder[chain.ladder.length - 1];

  const advance = async () => {
    setBusy('advance');
    setErr(null);
    try {
      await advanceApprovalRungFn({ iwoId });
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!rejectNotes.trim()) {
      setErr('Notes are required for a rejection.');
      return;
    }
    setBusy('reject');
    setErr(null);
    try {
      await rejectApprovalRungFn({ iwoId, notes: rejectNotes.trim() });
      setRejectNotes('');
      setShowReject(false);
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section
      data-testid="approval-ladder-panel"
      className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4 space-y-3"
    >
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-[var(--fg-primary)]">
          Internal Approval
        </h2>
        <span className="text-[11.5px] text-[var(--fg-tertiary)]">
          {chain.tierAtOpen ?? '—'} · {chain.ladder.length} rungs
        </span>
      </header>

      <ApprovalChainTimeline chain={chain} />

      {complete ? (
        <p
          data-testid="approval-complete-banner"
          className="text-[12.5px] text-[var(--rag-green-deep)] bg-[var(--rag-green-soft)] border border-[var(--rag-green)] rounded p-2"
        >
          Internal approval granted at <strong>{RUNG_LABEL[terminalRung]}</strong>. The IWO is cleared
          for client delivery.
        </p>
      ) : (
        <div className="space-y-2">
          <p className="text-[12.5px] text-[var(--fg-secondary)]">
            Awaiting action at <strong>{RUNG_LABEL[chain.currentRung]}</strong>.
          </p>

          {showReject ? (
            <div data-testid="reject-editor" className="space-y-2">
              <textarea
                data-testid="reject-notes-input"
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="What needs to change? Reasoning will appear in the chain history."
                rows={3}
                className="w-full p-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  data-testid="confirm-reject-btn"
                  disabled={busy === 'reject' || !rejectNotes.trim()}
                  onClick={reject}
                >
                  {busy === 'reject' ? 'Returning…' : 'Return with notes'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="cancel-reject-btn"
                  onClick={() => { setShowReject(false); setRejectNotes(''); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                data-testid="advance-rung-btn"
                disabled={busy === 'advance'}
                onClick={advance}
              >
                <ArrowRight className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                {busy === 'advance' ? 'Advancing…' : 'Advance'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                data-testid="open-reject-btn"
                onClick={() => setShowReject(true)}
              >
                <X className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Reject with notes
              </Button>
            </div>
          )}
        </div>
      )}

      {err && (
        <p role="alert" data-testid="approval-ladder-error" className="text-[12px] text-[var(--rag-red)]">
          {err}
        </p>
      )}
    </section>
  );
}
