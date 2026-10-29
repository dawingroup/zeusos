/**
 * useResilientSubscription — the shared recovery every live read leans on.
 *
 * A Firestore listener that errors is closed for good; a hook that subscribes
 * once per id shows its first error until a reload. These pin the contract the
 * migrated hooks rely on: a failure resubscribes on a capped backoff with a
 * fresh token, the cap holds (a real denial never loops), a wake signal spends
 * a fresh budget, new deps start clean, and unmount cancels everything.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const doubles = vi.hoisted(() => ({ getIdToken: vi.fn() }));
vi.mock('@/firebase/config', () => ({
  auth: { currentUser: { getIdToken: (force?: boolean) => doubles.getIdToken(force) } },
  db: {},
}));

import { useEffect } from 'react';
import { useListenerRecovery, useResilientSubscription, type SubscriptionHealth } from '../useResilientSubscription';

/** Each subscribe call: the id it was for, its health handle, its unsubscribe. */
let subs: Array<{ id: string; health: SubscriptionHealth; unsub: ReturnType<typeof vi.fn> }>;

function useThing(id: string | null) {
  useResilientSubscription(
    (health) => {
      if (!id) return;
      const unsub = vi.fn();
      subs.push({ id, health, unsub });
      return unsub;
    },
    [id],
  );
}

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const fail = (i: number) => act(async () => { subs[i].health.fail(); });
const ok = (i: number) => act(async () => { subs[i].health.ok(); });

beforeEach(() => {
  vi.useFakeTimers();
  subs = [];
  doubles.getIdToken.mockReset().mockResolvedValue('fresh-token');
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useResilientSubscription', () => {
  it('drops the dead listener and attaches a new one after a failure, with a fresh token', async () => {
    renderHook(() => useThing('a'));
    expect(subs).toHaveLength(1);

    await fail(0);
    await advance(999);
    expect(subs).toHaveLength(1);
    await advance(1);

    expect(doubles.getIdToken).toHaveBeenCalledWith(true);
    expect(subs[0].unsub).toHaveBeenCalledTimes(1);
    expect(subs).toHaveLength(2);
    expect(subs[1].id).toBe('a');
  });

  it('caps the attempts, then a wake signal spends a fresh budget', async () => {
    renderHook(() => useThing('a'));
    await fail(0); await advance(1000);
    await fail(1); await advance(4000);
    await fail(2); await advance(15000);
    await fail(3);
    expect(subs).toHaveLength(4);

    await advance(600_000);
    expect(subs).toHaveLength(4); // a real denial does not loop

    await act(async () => { window.dispatchEvent(new Event('online')); });
    await advance(1000);
    expect(subs).toHaveLength(5);
  });

  it('a healthy delivery resets the budget', async () => {
    renderHook(() => useThing('a'));
    await fail(0); await advance(1000);
    await fail(1); await advance(4000);
    await ok(2); // recovered — the next failure starts again at 1 s
    await fail(2); await advance(1000);
    expect(subs).toHaveLength(4);
  });

  it('ignores wake signals while healthy, and does not subscribe without an id', async () => {
    const { rerender } = renderHook(({ id }) => useThing(id), { initialProps: { id: null as string | null } });
    expect(subs).toHaveLength(0);
    rerender({ id: 'a' });
    await ok(0);
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await advance(30_000);
    expect(subs).toHaveLength(1);
    expect(doubles.getIdToken).not.toHaveBeenCalled();
  });

  it('new deps start a clean slate and cancel the pending attempt', async () => {
    const { rerender } = renderHook(({ id }) => useThing(id), { initialProps: { id: 'a' } });
    await fail(0);
    rerender({ id: 'b' });
    expect(subs.map((s) => s.id)).toEqual(['a', 'b']);
    await advance(60_000);
    expect(subs).toHaveLength(2); // the attempt scheduled for 'a' never fired
  });

  it('does nothing after unmount', async () => {
    const { unmount } = renderHook(() => useThing('a'));
    await fail(0);
    unmount();
    await advance(60_000);
    expect(subs).toHaveLength(1);
    expect(doubles.getIdToken).not.toHaveBeenCalled();
  });

  it('a reset-dep change keeps a failure whose effect did not re-run, so the next wake still retries it', async () => {
    const aSubs: Array<{ report: (ok: boolean) => void }> = [];
    function useTwo(a: string, b: string) {
      const { epoch, report } = useListenerRecovery([a, b]);
      useEffect(() => {
        aSubs.push({ report: (ok) => report('a', ok) });
      }, [a, epoch, report]);
    }
    const { rerender } = renderHook(({ b }) => useTwo('a', b), { initialProps: { b: 'x' } });
    await act(async () => { aSubs[0].report(false); });
    rerender({ b: 'y' }); // cancels the pending attempt; "a" does not resubscribe
    await advance(60_000);
    expect(aSubs).toHaveLength(1);

    await act(async () => { window.dispatchEvent(new Event('online')); });
    await advance(1000);
    expect(aSubs).toHaveLength(2);
  });

  it('resubscribe() re-attaches at once with a fresh token and a fresh budget, even after the cap', async () => {
    let resubscribe = () => undefined as void;
    renderHook(() => {
      ({ resubscribe } = useResilientSubscription((health) => {
        const unsub = vi.fn();
        subs.push({ id: 'a', health, unsub });
        return unsub;
      }, ['a']));
    });
    await fail(0); await advance(1000);
    await fail(1); await advance(4000);
    await fail(2); await advance(15000);
    await fail(3);
    expect(subs).toHaveLength(4);
    await act(async () => { resubscribe(); });
    expect(doubles.getIdToken).toHaveBeenLastCalledWith(true);
    expect(subs).toHaveLength(5);
    await fail(4); await advance(1000);
    expect(subs).toHaveLength(6); // budget was fresh: the next failure retried at 1 s
  });
});
