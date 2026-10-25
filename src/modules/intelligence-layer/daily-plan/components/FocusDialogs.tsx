/**
 * The focus card's two dialogs: "What's blocking this?" and the end-of-day
 * wrap-up. Both write through the `dailyPlanAction` callable — the plan doc
 * is the only record. `BlockedDialog` is also what the inbox opens on Mark
 * Blocked, so a block always carries a reason.
 */

import { useEffect, useState } from 'react';
import { Check, ChevronRight, X } from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/core/components/ui/dialog';
import { Textarea } from '@/core/components/ui/textarea';
import { firstNameOf, itemState, nextWorkdayLong, weekdayOf, type HomePlanItem } from '../format';

export function BlockedDialog({
  open,
  title,
  managerName,
  hasManager,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** The task being blocked. */
  title?: string | null;
  managerName?: string | null;
  /** Only promise a notification when a manager will hear. */
  hasManager: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setNote('');
      setError(null);
    }
  }, [open]);

  const who = firstNameOf(managerName) || 'your manager';
  const submit = async () => {
    const reason = note.trim();
    if (reason.length < 3) {
      setError('Say what is blocking this — it is what reaches the person who can unblock it.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit(reason);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>What’s blocking this?</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Waiting on the client’s brand guidelines"
          rows={3}
          autoFocus
          aria-label="What is blocking this item"
          data-testid="blocked-reason"
        />
        {error && (
          <p role="alert" className="text-[12px]" style={{ color: 'var(--rag-red)' }}>{error}</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving} data-testid="blocked-submit">
            {hasManager ? `Mark blocked · notify ${who}` : 'Mark blocked'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WrapUpModal({
  open,
  date,
  items,
  managerName,
  hasManager,
  onClose,
  onSubmit,
}: {
  open: boolean;
  date: string;
  items: HomePlanItem[];
  managerName?: string | null;
  hasManager: boolean;
  onClose: () => void;
  /** The 2-line "what moved today" + anything blocking. */
  onSubmit: (summary: string, blockers: string) => Promise<void>;
}) {
  const [summary, setSummary] = useState('');
  const [blockers, setBlockers] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setSummary('');
      setBlockers(
        items
          .filter((i) => itemState(i) === 'blocked' && i.outcomeNote)
          .map((i) => `${i.title}: ${i.outcomeNote}`)
          .join('\n'),
      );
      setError(null);
    }
  }, [open, items]);

  const states = items.map(itemState);
  const done = states.filter((s) => s === 'done').length;
  const blocked = states.filter((s) => s === 'blocked').length;
  const carry = states.filter((s) => s === 'open' || s === 'carried').length;
  const next = nextWorkdayLong(date);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(summary.trim(), blockers.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not save — try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Wrap up {weekdayOf(date)}</DialogTitle>
          <DialogDescription>
            {hasManager ? `Sent to ${managerName || 'your manager'} · shapes tomorrow’s plan` : 'Shapes tomorrow’s plan'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2 text-[12px]" data-testid="wrapup-summary-chips">
          <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--rag-green-soft)', color: 'var(--rag-green)' }}>{done} done</span>
          <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--rag-amber-soft)', color: 'var(--rag-amber)' }}>{carry} carry to {next}</span>
          {blocked > 0 && (
            <span className="rounded-full px-2 py-0.5" style={{ background: 'var(--rag-red-soft)', color: 'var(--rag-red)' }}>{blocked} blocked</span>
          )}
        </div>
        <div className="space-y-1">
          {items.map((item, i) => {
            const s = states[i];
            const tone = s === 'done' ? 'var(--rag-green)' : s === 'blocked' ? 'var(--rag-red)' : 'var(--rag-amber)';
            const Icon = s === 'done' ? Check : s === 'blocked' ? X : ChevronRight;
            const label = s === 'done' ? 'Done' : s === 'blocked' ? 'Blocked' : s === 'dropped' ? 'Dropped' : 'Carry';
            return (
              <div key={item.taskId} className="flex items-center gap-2 text-[12.5px]">
                <Icon className="h-3 w-3 shrink-0" style={{ color: tone }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--fg-primary)' }}>{item.title}</span>
                <span className="text-[11.5px]" style={{ color: 'var(--fg-tertiary)' }}>{label}</span>
              </div>
            );
          })}
        </div>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium" style={{ color: 'var(--fg-secondary)' }}>
          What moved today — two lines
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What landed, what you learned, what you need tomorrow"
            rows={3}
            data-testid="wrapup-summary"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12.5px] font-medium" style={{ color: 'var(--fg-secondary)' }}>
          Anything blocking you?
          <Textarea
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            placeholder="Who or what you are waiting on"
            rows={2}
            data-testid="wrapup-blockers"
          />
        </label>
        {error && (
          <p role="alert" className="text-[12px]" style={{ color: 'var(--rag-red)' }}>{error}</p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Later</Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving} data-testid="wrapup-submit">
            {saving ? 'Saving…' : 'Submit wrap-up'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
