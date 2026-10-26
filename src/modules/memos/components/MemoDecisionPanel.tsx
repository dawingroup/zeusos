/**
 * The decider's panel: APPROVE / DECLINE / MODIFY-with-conditions, signed by
 * typing their name. Shown only to the people the memo is addressed To, once
 * every Through party has cleared it (an admin may decide in their place).
 * The author never sees these buttons — the callable refuses a self-decision.
 */
import { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/core/components/ui/dialog';
import { Banner } from '@/shared/components/data-display';
import { describeCallableError } from '@/shared/utils/callableError';
import type { Memo, MemoActor, MemoDecisionOutcome } from '../types/memo';
import { decideMemo } from '../services/memoActions';
import { canDecideMemo, memoRouteStatusLine } from '../utils/memoRoute';
import { ROLE_LABELS } from '../utils/memoApproval';

interface Props {
  memo: Memo;
  actor: MemoActor;
  isAdmin: boolean;
  onDecided: (outcome: MemoDecisionOutcome) => void | Promise<void>;
}

const OUTCOME_COPY: Record<MemoDecisionOutcome, { title: string; description: string; confirm: string }> = {
  approved: { title: 'Approve this memo', description: 'Your typed name is recorded as the signature in the decision block of the issued memo.', confirm: 'Sign & approve' },
  modified: { title: 'Approve with conditions', description: 'The conditions are printed verbatim in the decision block, above your signature.', confirm: 'Sign & approve with conditions' },
  rejected: { title: 'Do not approve', description: 'The memo returns to its author with your reasons; nothing is issued.', confirm: 'Sign & decline' },
};

export function MemoDecisionPanel({ memo, actor, isAdmin, onDecided }: Props) {
  const [outcome, setOutcome] = useState<MemoDecisionOutcome | null>(null);
  const [conditions, setConditions] = useState('');
  const [notes, setNotes] = useState('');
  const [signedName, setSignedName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (memo.status !== 'submitted') return null;
  if (memo.createdBy === actor.uid) {
    return <Banner tone="info" title="On its route" message={`${memoRouteStatusLine(memo) || 'Awaiting a decision'}. You wrote this memo, so somebody else must clear and decide it.`} />;
  }
  if (!canDecideMemo(memo, actor.uid, isAdmin)) return null;

  const addressed = memo.approval?.deciderUids?.includes(actor.uid) ?? false;
  const names = memo.approval?.route?.deciders.map((p) => p.name).join(' or ');
  const tier = memo.approval?.effectiveRole;
  const roleLine = !addressed
    ? `You are deciding as an admin, in place of ${names || 'the addressee'}.`
    : tier
      ? `Addressed to you. Its amount, impact and type call for ${ROLE_LABELS[tier]} approval${memo.approval?.tierMet === false ? ' — your role is below that; the decision is recorded against the tier' : ''}.`
      : 'Addressed to you.';

  return (
    <div className="rounded-md border p-4" style={{ borderColor: 'var(--accent-primary, var(--rag-blue))' }} data-testid="memo-decision-panel">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--fg-primary)' }}>Your decision</h2>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--fg-tertiary)' }}>{roleLine}</p>
      {error && <Banner tone="danger" title="Could not record the decision" message={error} className="mt-3" />}

      <div className="mt-3">
        <Label htmlFor="memo-conditions">Conditions or amendments (required for “approve with conditions”)</Label>
        <Textarea id="memo-conditions" className="mt-1 min-h-[5rem]" value={conditions} placeholder="e.g. Approved for four weeks only; return with usage before extending." onChange={(e) => setConditions(e.target.value)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => setOutcome('approved')} disabled={busy}>Approve</Button>
        <Button type="button" variant="outline" onClick={() => setOutcome('modified')} disabled={busy || !conditions.trim()}>Approve with conditions</Button>
        <Button type="button" variant="destructive" onClick={() => setOutcome('rejected')} disabled={busy}>Do not approve</Button>
      </div>

      <Dialog open={outcome !== null} onOpenChange={(o) => { if (!o && !busy) setOutcome(null); }}>
        <DialogContent>
          {outcome && (
            <>
              <DialogHeader>
                <DialogTitle>{OUTCOME_COPY[outcome].title}</DialogTitle>
                <DialogDescription>{OUTCOME_COPY[outcome].description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="memo-sign-name">Type your name to sign</Label>
                  <Input id="memo-sign-name" value={signedName} placeholder={actor.name} onChange={(e) => setSignedName(e.target.value)} autoFocus />
                </div>
                <div>
                  <Label htmlFor="memo-decision-notes">Note to the author (optional)</Label>
                  <Textarea id="memo-decision-notes" className="min-h-[3.5rem]" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={busy} onClick={() => setOutcome(null)}>Cancel</Button>
                <Button
                  type="button"
                  disabled={busy || !signedName.trim()}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      await decideMemo(memo.id, { outcome, conditions: conditions.trim() || undefined, notes: notes.trim() || undefined, signedName: signedName.trim() });
                      setOutcome(null);
                      await onDecided(outcome);
                    } catch (e) {
                      setError(describeCallableError(e, 'record the decision'));
                      setOutcome(null);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy ? 'Signing…' : OUTCOME_COPY[outcome].confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
