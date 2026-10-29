/**
 * useListenerRecovery / useResilientSubscription — keep a live read alive
 * across a laptop sleep.
 *
 * A Firestore `onSnapshot` listener that receives an error is CLOSED for good;
 * the SDK never retries it. A hook that subscribes once per id therefore shows
 * its first error until the page is reloaded. The usual trigger is not a rules
 * problem: after a sleep the listener reconnects a moment before the ID token
 * refreshes, the rules see `request.auth == null`, and the answer is "Missing
 * or insufficient permissions".
 *
 * Recovery, owned here once instead of in every hook:
 *   - a read reports its health per snapshot (`report(channel, ok)`);
 *   - a failure schedules a capped retry (`resubscribeDelay`: 1 s, 4 s, 15 s,
 *     then stop — a REAL denial must not become a loop): force a token
 *     refresh, then bump `epoch`, which re-keys the consumer's effect so its
 *     cleanup drops the dead listener and its body attaches a new one;
 *   - every channel healthy resets the budget;
 *   - with a read down, the tab becoming visible or the network returning
 *     spends a fresh budget — the sleep case exactly;
 *   - `resetDeps` changing (a new IWO, a new user) spends a fresh budget,
 *     and unmount cancels a pending attempt.
 *
 * `useListenerRecovery` is the primitive for a hook with several reads that
 * share one budget. `useResilientSubscription` wraps it for the common
 * single-listener case.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type DependencyList } from 'react';
import { auth } from '@/firebase/config';
import { resubscribeDelay } from '@/shared/utils/listenerRecovery';

export interface ListenerRecovery {
  /** Put in the subscribing effect's deps; a bump is the resubscribe. */
  epoch: number;
  /** Report one read's health after each snapshot / read attempt. */
  report: (channel: string, ok: boolean) => void;
  /**
   * Resubscribe NOW, with a fresh token and a fresh budget — for a manual
   * Refresh button, which otherwise only re-reads once and leaves a dead
   * listener dead.
   */
  resubscribe: () => void;
}

export function useListenerRecovery(resetDeps: DependencyList): ListenerRecovery {
  // Health and the attempt count live in refs: they steer timers and event
  // handlers and must never cause a render of their own.
  const [epoch, setEpoch] = useState(0);
  const attemptsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failingRef = useRef(new Set<string>());

  // A fresh token first: the usual cause is a listener that reconnected
  // before the token refreshed. Offline, this throws — resubscribe anyway;
  // the read fails again and the next attempt is scheduled.
  const refreshAndBump = useCallback(() => {
    const refreshed = auth.currentUser
      ? auth.currentUser.getIdToken(true).catch(() => undefined)
      : Promise.resolve(undefined);
    void refreshed.then(() => setEpoch((e) => e + 1));
  }, []);

  const scheduleRecovery = useCallback(() => {
    if (timerRef.current) return; // one attempt in flight at a time
    const delay = resubscribeDelay(attemptsRef.current);
    if (delay === null) return; // budget spent — a wake / online signal resets it
    attemptsRef.current += 1;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      refreshAndBump();
    }, delay);
  }, [refreshAndBump]);

  const resubscribe = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    attemptsRef.current = 0;
    refreshAndBump();
  }, [refreshAndBump]);

  const report = useCallback(
    (channel: string, ok: boolean) => {
      if (ok) {
        failingRef.current.delete(channel);
        if (failingRef.current.size === 0) attemptsRef.current = 0;
      } else {
        failingRef.current.add(channel);
        scheduleRecovery();
      }
    },
    [scheduleRecovery],
  );

  // New inputs get a fresh budget; unmount cancels a pending attempt. The
  // failing set is NOT cleared: a channel whose effect does not depend on
  // every reset dep keeps its dead listener across the change, and clearing
  // its failure would leave nothing to retry it on the next wake.
  useEffect(() => {
    attemptsRef.current = 0;
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller's inputs ARE the key
  }, resetDeps);

  // The tab came back, or the network did: if a read is down, the reason it
  // failed has probably just gone away — spend a fresh budget on it.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSignal = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (failingRef.current.size === 0) return;
      attemptsRef.current = 0;
      scheduleRecovery();
    };
    document.addEventListener('visibilitychange', onSignal);
    window.addEventListener('online', onSignal);
    return () => {
      document.removeEventListener('visibilitychange', onSignal);
      window.removeEventListener('online', onSignal);
    };
  }, [scheduleRecovery]);

  return { epoch, report, resubscribe };
}

/** Handed to a `useResilientSubscription` body: call after each delivery. */
export interface SubscriptionHealth {
  ok: () => void;
  fail: () => void;
}

/**
 * `useEffect` for one live listener, with recovery. `subscribe` runs whenever
 * `deps` change or a recovery attempt fires; it returns the unsubscribe (or
 * nothing when there is nothing to subscribe to) and calls `health.fail()`
 * from the listener's error path, `health.ok()` from its data path.
 *
 *   useResilientSubscription((health) => {
 *     if (!id) return;
 *     return subscribeIWO(id, (d) => { setData(d); health.ok(); },
 *                             (e) => { setError(e.message); health.fail(); });
 *   }, [id]);
 */
export function useResilientSubscription(
  subscribe: (health: SubscriptionHealth) => (() => void) | void,
  deps: DependencyList,
): { resubscribe: () => void } {
  const { epoch, report, resubscribe } = useListenerRecovery(deps);
  const health = useMemo<SubscriptionHealth>(
    () => ({ ok: () => report('main', true), fail: () => report('main', false) }),
    [report],
  );
  useEffect(
    () => subscribe(health),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller's contract, as for useEffect
    [...deps, epoch, health],
  );
  return { resubscribe };
}
