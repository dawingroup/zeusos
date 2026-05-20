/**
 * Revision Request Service (Phase 3b).
 *
 * Exposes CRUD + subscription helpers for the `revisionRequests`
 * Firestore collection. Mirrors the clientQuotes service style: thin
 * helpers on top of Firestore, no hidden side-effects. Callers handle
 * user-facing messaging (e.g. toasts, confirmations).
 */

import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  RevisionRequest,
  RevisionRequestDraft,
  RevisionRequestStatus,
} from '../types/revisionRequest';

const COLLECTION = 'revisionRequests';

// ─── Create ───────────────────────────────────────────────────────────

/**
 * Client-facing entry point — create a pending revision request.
 * Always starts in `status: 'pending'`.
 */
export async function createRevisionRequest(draft: RevisionRequestDraft): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...draft,
    status: 'pending' as RevisionRequestStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Transitions ──────────────────────────────────────────────────────

async function transition(
  requestId: string,
  nextStatus: RevisionRequestStatus,
  byUserId: string,
  opts: { note?: string; resolvedWithFileId?: string } = {},
): Promise<void> {
  const updates: Record<string, unknown> = {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  };
  if (nextStatus === 'acknowledged') {
    updates.acknowledgedBy = byUserId;
    updates.acknowledgedAt = serverTimestamp();
  }
  if (nextStatus === 'resolved' || nextStatus === 'declined') {
    updates.resolvedBy = byUserId;
    updates.resolvedAt = serverTimestamp();
    if (opts.note) updates.resolvedNote = opts.note;
    if (opts.resolvedWithFileId) updates.resolvedWithFileId = opts.resolvedWithFileId;
  }
  await updateDoc(doc(db, COLLECTION, requestId), updates);
}

export const acknowledgeRevisionRequest = (requestId: string, userId: string) =>
  transition(requestId, 'acknowledged', userId);

export const resolveRevisionRequest = (
  requestId: string,
  userId: string,
  opts: { note?: string; resolvedWithFileId?: string } = {},
) => transition(requestId, 'resolved', userId, opts);

export const declineRevisionRequest = (
  requestId: string,
  userId: string,
  note?: string,
) => transition(requestId, 'declined', userId, { note });

// ─── Queries ──────────────────────────────────────────────────────────

function docToRequest(d: { id: string; data: () => Record<string, unknown> }): RevisionRequest {
  return { id: d.id, ...d.data() } as RevisionRequest;
}

/** One-shot fetch: all requests for a project, newest first. */
export async function getRevisionRequestsForProject(
  projectId: string,
): Promise<RevisionRequest[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map(docToRequest);
}

/** One-shot fetch: all requests for a specific design item, newest first. */
export async function getRevisionRequestsForItem(
  projectId: string,
  itemId: string,
): Promise<RevisionRequest[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTION),
      where('projectId', '==', projectId),
      where('itemId', '==', itemId),
      orderBy('createdAt', 'desc'),
    ),
  );
  return snap.docs.map(docToRequest);
}

/**
 * Real-time subscription for the designer inbox. Returns an
 * unsubscribe function. Filter options narrow the stream.
 */
export function subscribeToRevisionRequests(
  projectId: string,
  filters: { itemId?: string; status?: RevisionRequestStatus[] } | undefined,
  callback: (requests: RevisionRequest[]) => void,
): () => void {
  // Keep Firestore constraints minimal (projectId + createdAt order) so
  // this uses the same index as the inbox — item/status filtering is
  // client-side to avoid composite-index sprawl during Phase 3b rollout.
  const q = query(
    collection(db, COLLECTION),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      let rows = snap.docs.map(docToRequest);
      if (filters?.itemId) rows = rows.filter((r) => r.itemId === filters.itemId);
      if (filters?.status && filters.status.length > 0) {
        const allowed = new Set(filters.status);
        rows = rows.filter((r) => allowed.has(r.status));
      }
      callback(rows);
    },
    (err) => {
      console.error('[revisionRequestService] subscribe error:', err);
      callback([]);
    },
  );
}

/** Utility — count open (pending+acknowledged) requests for an inbox badge. */
export function countOpenRequests(requests: RevisionRequest[]): number {
  return requests.filter((r) => r.status === 'pending' || r.status === 'acknowledged').length;
}

// Re-export the type for convenience
export type { RevisionRequest, RevisionRequestStatus, RevisionRequestDraft };

// Silence the linter on the unused import when this file compiles in
// isolation (Timestamp is used structurally in RevisionRequest).
export type _EnsureTimestamp = Timestamp;
