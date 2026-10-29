/**
 * Where a submitted memo is on its route, and the panel the Through party
 * whose turn it is uses to clear it or send it back.
 */
import { useState, type ReactElement } from 'react';
import { Check, Circle, CornerUpLeft, Dot } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Textarea } from '@/core/components/ui/textarea';
import { Label } from '@/core/components/ui/label';
import { Banner } from '@/shared/components/data-display';
import { describeCallableError } from '@/shared/utils/callableError';
import type { Memo, MemoActor } from '../types/memo';
import { clearMemo } from '../services/memoActions';
import { currentClearanceUid, memoRouteSteps, type MemoRouteStepState } from '../utils/memoRoute';

const STEP_ICON: Record<MemoRouteStepState, ReactElement> = {
  done: <Check className="h-3 w-3" style={{ color: 'var(--rag-green)' }} />,
  current: <Dot className="h-4 w-4" style={{ color: 'var(--rag-blue)' }} />,
  waiting: <Circle className="h-2.5 w-2.5" style={{ color: 'var(--fg-tertiary)' }} />,
  returned: <CornerUpLeft className="h-3 w-3" style={{ color: 'var(--rag-red)' }} />,
};
const ACTION_TEXT = { clear: 'clears', decide: 'decides', receive: 'receives' } as const;

export function MemoRouteSteps({ memo }: { memo: Memo }) {
  const steps = memoRouteSteps(memo);
  if (!steps.length) return null;
  return (
    <ol className="space-y-1" aria-label="Route">
      {steps.map((s, i) => (
        <li key={`${s.uid}-${i}`} className="flex items-center gap-1.5" data-route-step={s.state}>
          <span className="inline-flex w-4 justify-center">{STEP_ICON[s.state]}</span>
          <span style={{ color: s.state === 'current' ? 'var(--fg-primary)' : 'var(--fg-secondary)', fontWeight: s.state === 'current' ? 600 : 400 }}>{s.name}</span>
          <span style={{ color: 'var(--fg-tertiary)' }}>{ACTION_TEXT[s.action]}</span>
        </li>
      ))}
    </ol>
  );
}

interface ClearanceProps {
  memo: Memo;
  actor: MemoActor;
  /** After a clearance lands; `stage` tells the page whether to file the PDF. */
  onCleared: (stage: string) => void | Promise<void>;
}

/** Shown only to the Through party whose turn it is. */
export function MemoClearancePanel({ memo, actor, onCleared }: ClearanceProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentClearanceUid(memo) !== actor.uid) return null;
  const a = memo.approval!;
  const index = a.clearanceIndex ?? 0;
  const nextUid = a.clearanceUids?.[index + 1];
  const next = nextUid
    ? `It then goes to ${a.route?.clearance.find((p) => p.uid === nextUid)?.name ?? 'the next person'}.`
    : a.required === false
      ? 'You are the last to clear it; once cleared it can be issued.'
      : `It then goes to ${a.route?.deciders.map((p) => p.name).join(' or ') || 'a decider'} for decision.`;

  const act = async (outcome: 'cleared' | 'returned') => {
    setBusy(true);
    setError(null);
    try {
      const res = await clearMemo(memo.id, outcome, note);
      setNote('');
      await onCleared(String(res.stage ?? ''));
    } catch (e) {
      setError(describeCallableError(e, outcome === 'cleared' ? 'clear the memo' : 'send the memo back'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border p-4" style={{ borderColor: 'var(--accent-primary, var(--rag-blue))' }} data-testid="memo-clearance-panel">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--fg-primary)' }}>This memo goes through you</h2>
      <p className="mt-0.5 text-xs" style={{ color: 'var(--fg-tertiary)' }}>Clear it to pass it on, or send it back to {memo.createdByName} with a reason. {next}</p>
      {error && <Banner tone="danger" title="Could not record your clearance" message={error} className="mt-3" />}
      <div className="mt-3">
        <Label htmlFor="memo-clearance-note">Note (required to send it back)</Label>
        <Textarea id="memo-clearance-note" className="mt-1 min-h-[4rem]" value={note} placeholder="e.g. Attach the three quotes before this goes to the MD." onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={() => act('cleared')} disabled={busy}>{busy ? 'Saving…' : 'Clear'}</Button>
        <Button type="button" variant="outline" onClick={() => act('returned')} disabled={busy || !note.trim()}>Send back to author</Button>
      </div>
    </div>
  );
}
