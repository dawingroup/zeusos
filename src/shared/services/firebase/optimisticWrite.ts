/**
 * Optimistic (offline-first) Firestore writes.
 *
 * A Firestore write has two legs: the outbound mutation (your data → server)
 * and the return ACK (server → client: "committed"). The SDK's
 * addDoc/setDoc/updateDoc promise only resolves on the ACK. On networks that
 * mangle Firestore's long-lived streaming channel, the outbound leg succeeds
 * (the record IS written) but the ACK never comes back — so a UI that awaits
 * the promise spins and then reports a "timeout" even though the save worked.
 *
 * `persistentLocalCache` (see firestore.ts) applies every write to the local
 * cache IMMEDIATELY and durably queues it to sync when the connection allows.
 * So a user-facing save can be treated as done the moment it's locally
 * applied: the new doc id is known client-side, the UI updates instantly, and
 * the write syncs in the background. Only a GENUINE rejection (a rules denial)
 * needs surfacing — transient channel failures don't reject, they stay pending.
 *
 * Contrast with firestore-writes.ts (the timeout-guarded wrappers): use THOSE
 * when the caller must know the server accepted the write before proceeding.
 */
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  type CollectionReference,
  type DocumentReference,
  type DocumentData,
  type Firestore,
  type WithFieldValue,
  type WriteBatch,
} from 'firebase/firestore';

/**
 * Where genuine background-sync failures go. Defaults to console; the app shell
 * registers a toast via {@link setOptimisticWriteReporter}. Only real
 * rejections reach here (rules/validation) — not transient channel stalls.
 */
let reporter: (err: unknown, label: string) => void = (err, label) =>
  console.error(`[optimistic-write] background sync failed: ${label}`, err);

export function setOptimisticWriteReporter(fn: (err: unknown, label: string) => void): void {
  reporter = fn;
}

/**
 * Fire a write in the background: it's already applied to the local cache, so we
 * don't await the server ack — only surface a genuine rejection.
 */
export function trackInBackground(synced: Promise<unknown>, label: string): void {
  void Promise.resolve(synced).catch((err) => reporter(err, label));
}

/**
 * Optimistic create. Generates the document id client-side, applies the write
 * locally, and returns the id IMMEDIATELY — the sync happens in the background.
 */
export function addDocOptimistic<T extends DocumentData>(
  coll: CollectionReference<T>,
  data: WithFieldValue<T>,
  label = 'Save',
): string {
  const ref = doc(coll) as DocumentReference<T>;
  trackInBackground(setDoc(ref, data), label);
  return ref.id;
}

/** Optimistic create/overwrite at a ref the caller already holds (full overwrite, no merge). */
export function setDocOptimistic(
  ref: DocumentReference<DocumentData>,
  data: DocumentData,
  label = 'Save',
): void {
  trackInBackground(setDoc(ref, data), label);
}

/** Optimistic update. Applies the write locally and returns immediately. */
export function updateDocOptimistic(
  ref: DocumentReference<DocumentData>,
  data: DocumentData,
  label = 'Save',
): void {
  trackInBackground(updateDoc(ref, data), label);
}

/** Optimistic delete. Removes the doc from the local cache and returns immediately. */
export function deleteDocOptimistic(
  ref: DocumentReference<DocumentData>,
  label = 'Delete',
): void {
  trackInBackground(deleteDoc(ref), label);
}

/**
 * Raw (un-timeout-wrapped) WriteBatch for optimistic bulk edits. Pair with
 * {@link commitBatchOptimistic} — a batch built from the timeout-guarded
 * `firestore-writes.ts` wrapper would race its commit against a deadline and
 * report a spurious TimeoutError even though the batch is still syncing.
 */
export function batchOptimistic(db: Firestore): WriteBatch {
  return writeBatch(db);
}

/**
 * Commit a batch optimistically: applied to the local cache atomically on
 * commit, returns immediately, syncs in the background in commit order.
 */
export function commitBatchOptimistic(batch: WriteBatch, label = 'Save'): void {
  trackInBackground(batch.commit(), label);
}
