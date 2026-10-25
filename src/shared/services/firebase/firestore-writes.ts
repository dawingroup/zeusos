/**
 * Timeout-guarded Firestore write primitives.
 *
 * The Firestore Web SDK resolves a write promise (`addDoc` / `setDoc` /
 * `updateDoc` / `deleteDoc` / `WriteBatch.commit` / `runTransaction`) only once
 * the backend ACKNOWLEDGES the write. On proxied / high-latency connections the
 * ACK can be very slow or never arrive. The local `persistentLocalCache` is
 * updated optimistically (so the record "is already there"), but the `await`
 * in a form's save handler never returns and the spinner hangs forever.
 *
 * These wrappers race every network-bound write against a deadline
 * (`withTimeout`) so a hang becomes a catchable `TimeoutError` the UI can
 * surface. They have IDENTICAL signatures to the SDK functions they replace, so
 * call sites swap purely at the import level. Reads and types are NOT wrapped.
 *
 * NOTE: a timed-out write is NOT cancelled — it may still be queued locally and
 * sync when connectivity returns.
 *
 * `runTransaction` additionally names the documents a failed transaction
 * touched — Firestore's own transaction errors identify none.
 */

import {
  addDoc as _addDoc,
  setDoc as _setDoc,
  updateDoc as _updateDoc,
  deleteDoc as _deleteDoc,
  writeBatch as _writeBatch,
  runTransaction as _runTransaction,
  type Firestore,
  type WriteBatch,
} from 'firebase/firestore';
import { withTimeout, DEFAULT_WRITE_TIMEOUT_MS } from '@/shared/utils/withTimeout';

/**
 * Bulk operations (batch commits, transactions) legitimately move more data and
 * may retry internally, so they get a more generous deadline than a single-doc
 * write. Still finite — a genuinely stuck connection fails loudly.
 */
export const BULK_WRITE_TIMEOUT_MS = 60_000;

export const addDoc: typeof _addDoc = ((...args: Parameters<typeof _addDoc>) =>
  withTimeout(_addDoc(...args), 'Save', DEFAULT_WRITE_TIMEOUT_MS)) as typeof _addDoc;

export const setDoc: typeof _setDoc = ((...args: Parameters<typeof _setDoc>) =>
  withTimeout(_setDoc(...args), 'Save', DEFAULT_WRITE_TIMEOUT_MS)) as typeof _setDoc;

export const updateDoc: typeof _updateDoc = ((...args: Parameters<typeof _updateDoc>) =>
  withTimeout(_updateDoc(...args), 'Save', DEFAULT_WRITE_TIMEOUT_MS)) as typeof _updateDoc;

export const deleteDoc: typeof _deleteDoc = ((...args: Parameters<typeof _deleteDoc>) =>
  withTimeout(_deleteDoc(...args), 'Delete', DEFAULT_WRITE_TIMEOUT_MS)) as typeof _deleteDoc;

/**
 * `writeBatch` returns a real {@link WriteBatch}, wrapped in a Proxy whose only
 * change is to race `commit()` against {@link BULK_WRITE_TIMEOUT_MS}. The
 * `set`/`update`/`delete` builder calls are purely local so they pass through
 * untouched, and the Proxy preserves chaining.
 */
export const writeBatch: typeof _writeBatch = ((firestore: Firestore): WriteBatch => {
  const batch = _writeBatch(firestore);
  return new Proxy(batch, {
    get(target, prop, receiver) {
      if (prop === 'commit') {
        return () => withTimeout(target.commit(), 'Save', BULK_WRITE_TIMEOUT_MS);
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          return result === target ? receiver : result;
        };
      }
      return value;
    },
  });
}) as typeof _writeBatch;

/**
 * Document paths this transaction touched, appended to a failure message as
 * ` [transaction docs: a/b, c/d]`. Firestore's transaction failures name no
 * document — a lost commit race surfaces as two `updateTime` values and
 * nothing else — so the wrapper records the paths as they are used.
 */
const TX_PATHS_MARKER = ' [transaction docs: ';

function refPath(candidate: unknown): string | null {
  const path = (candidate as { path?: unknown } | null | undefined)?.path;
  return typeof path === 'string' && path.length > 0 ? path : null;
}

function recordingTransaction<T extends object>(transaction: T, touched: Set<string>): T {
  return new Proxy(transaction, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const path = refPath(args[0]);
        if (path) touched.add(path);
        const result = (value as (...a: unknown[]) => unknown).apply(target, args);
        return result === target ? receiver : result;
      };
    },
  });
}

/** Append the touched paths to a failure, preserving the error's type and `code`. */
function annotateWithPaths(error: unknown, touched: Set<string>): unknown {
  if (touched.size === 0) return error;
  if (!(error instanceof Error)) return error;
  if (error.message.includes(TX_PATHS_MARKER)) return error;
  // Mutate rather than re-wrap: callers branch on `error.code` and a fresh Error would drop it.
  error.message = `${error.message}${TX_PATHS_MARKER}${[...touched].join(', ')}]`;
  return error;
}

/**
 * `runTransaction` races the whole transaction (which may retry internally)
 * against {@link BULK_WRITE_TIMEOUT_MS}, and names the documents involved when
 * it fails. Paths accumulate across the SDK's internal retries, deduped.
 */
export const runTransaction: typeof _runTransaction = ((
  firestore: Parameters<typeof _runTransaction>[0],
  updateFunction: (transaction: never) => Promise<unknown>,
  options?: Parameters<typeof _runTransaction>[2],
) => {
  const touched = new Set<string>();
  const instrumented = (transaction: object) =>
    updateFunction(recordingTransaction(transaction, touched) as never);

  return withTimeout(
    _runTransaction(firestore, instrumented as never, options),
    'Save',
    BULK_WRITE_TIMEOUT_MS,
  ).catch((error: unknown) => {
    const annotated = annotateWithPaths(error, touched);
    // Log BEFORE rethrowing: callers catch this to raise a toast, which means
    // the rejection is handled and no global handler ever sees it.
    console.error('[firestore] runTransaction failed', {
      transactionDocs: [...touched],
      code: (error as { code?: string } | null)?.code,
    }, annotated);
    throw annotated;
  });
}) as unknown as typeof _runTransaction;
