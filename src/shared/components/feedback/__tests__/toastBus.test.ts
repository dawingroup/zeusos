/**
 * toastBus — progress-toast contract.
 *
 * Long jobs drive ONE card through several phases rather than stacking a card
 * per step, so the bus has to support in-place rewrites — and must not lose
 * the final outcome if the user dismissed the progress card mid-run.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushToast,
  updateToast,
  upsertToast,
  dismissToast,
  subscribeToasts,
  type Toast,
} from '../toastBus';

let seen: Toast[] = [];
let unsubscribe: () => void;

beforeEach(() => {
  unsubscribe?.();
  unsubscribe = subscribeToasts((t) => { seen = t; });
  for (const t of [...seen]) dismissToast(t.id);
});

describe('pushToast dedupe', () => {
  it('collapses identical messages by default', () => {
    const a = pushToast('same', { tone: 'info' });
    const b = pushToast('same', { tone: 'info' });
    expect(b).toBe(a);
    expect(seen).toHaveLength(1);
  });

  it('gives a progress toast its own id when dedupe is off', () => {
    const a = pushToast('Issuing 3 IWOs…', { durationMs: 0, dedupe: false });
    const b = pushToast('Issuing 3 IWOs…', { durationMs: 0, dedupe: false });
    expect(b).not.toBe(a);
    expect(seen).toHaveLength(2);
  });
});

describe('updateToast', () => {
  it('rewrites a live toast in place rather than stacking a new card', () => {
    const id = pushToast('Issuing 3 IWOs…', { durationMs: 0, dedupe: false });
    expect(updateToast(id, { message: 'Posting the handoff packet…' })).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].message).toBe('Posting the handoff packet…');
    expect(seen[0].id).toBe(id);
  });

  it('can flip tone and start the auto-dismiss clock on completion', () => {
    const id = pushToast('working…', { tone: 'info', durationMs: 0, dedupe: false });
    updateToast(id, { message: 'done', tone: 'success', durationMs: 5000 });
    expect(seen[0]).toMatchObject({ message: 'done', tone: 'success', durationMs: 5000 });
  });

  it('reports failure instead of resurrecting a dismissed card', () => {
    const id = pushToast('working…', { durationMs: 0, dedupe: false });
    dismissToast(id);
    expect(updateToast(id, { message: 'done' })).toBe(false);
    expect(seen).toHaveLength(0);
  });
});

describe('upsertToast', () => {
  it('rewrites the live progress card when it is still on screen', () => {
    const id = pushToast('working…', { durationMs: 0, dedupe: false });
    const returned = upsertToast(id, '3 IWOs issued.', { tone: 'success', durationMs: 6000 });
    expect(returned).toBe(id);
    expect(seen).toHaveLength(1);
    expect(seen[0].message).toBe('3 IWOs issued.');
  });

  it('still tells the user a job FAILED after they dismissed the progress card', () => {
    const id = pushToast('working…', { durationMs: 0, dedupe: false });
    dismissToast(id);
    const returned = upsertToast(id, 'Issue failed: permission denied', { tone: 'error', durationMs: 12000 });
    expect(returned).not.toBe(id);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ message: 'Issue failed: permission denied', tone: 'error' });
  });
});
