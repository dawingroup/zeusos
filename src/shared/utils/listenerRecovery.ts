/**
 * listenerRecovery — when to try again after a Firestore read dies.
 *
 * A Firestore `onSnapshot` listener that receives an error is CLOSED: the SDK
 * never retries it. The common way to get one is not a rules problem at all —
 * the laptop sleeps (`net::ERR_NETWORK_IO_SUSPENDED` on the Listen channel),
 * the listener reconnects on wake a moment before the ID token has refreshed,
 * the rules see `request.auth == null`, and the answer is "Missing or
 * insufficient permissions". A page whose hook subscribes once then shows
 * that message until someone reloads it.
 *
 * The policy is deliberately small and capped: a real denial must not turn
 * into a retry loop. A few spaced attempts, then stop and wait for a signal
 * that circumstances changed (the tab became visible, the network came back),
 * which resets the budget.
 */

/** Delay before attempt N (0-based). Three tries: 1 s, 4 s, 15 s. */
export const RESUBSCRIBE_DELAYS_MS: readonly number[] = [1000, 4000, 15000];

/**
 * Milliseconds to wait before the next recovery attempt, or `null` when the
 * budget is spent and only a wake / online signal should try again.
 */
export function resubscribeDelay(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 0) return RESUBSCRIBE_DELAYS_MS[0];
  return attempt < RESUBSCRIBE_DELAYS_MS.length ? RESUBSCRIBE_DELAYS_MS[attempt] : null;
}
