/**
 * withTimeout — a safety net for awaits that can hang indefinitely.
 *
 * The Firestore Web SDK resolves a write promise (`addDoc`/`updateDoc`/
 * `setDoc`) only once the backend ACKNOWLEDGES the write. While the connection
 * is degraded that promise stays pending: the local cache is updated
 * optimistically, but the `await` in a form's save handler never returns, so
 * the spinner hangs forever and the user has no idea the write didn't reach
 * the server. Likewise an `onSnapshot`-wrapped-in-a-Promise read with no error
 * handler never resolves if the listener errors.
 *
 * Wrapping these awaits with a timeout converts an infinite hang into a loud,
 * catchable failure: the save handler's `catch` runs, the `finally` clears the
 * spinner, and the user sees an actionable error instead of a frozen form.
 *
 * NOTE: this does NOT cancel the underlying Firestore write. A timed-out write
 * may still be queued locally and sync later when connectivity returns. For
 * idempotent updates that's harmless; for creates a manual retry could produce
 * a duplicate, so prefer surfacing the error and letting the user verify.
 */

/** Error thrown when the wrapped promise does not settle within the deadline. */
export class TimeoutError extends Error {
  readonly isTimeout = true;
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms / 1000}s — check your connection and try again.`);
    this.name = 'TimeoutError';
  }
}

/** Default deadline for a Firestore write/read in a user-facing save flow. */
export const DEFAULT_WRITE_TIMEOUT_MS = 20_000;

/**
 * Race `promise` against a timeout. Resolves with the promise's value if it
 * settles first; rejects with a {@link TimeoutError} if the deadline passes.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms: number = DEFAULT_WRITE_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}
