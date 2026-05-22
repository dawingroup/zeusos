/**
 * Read-side Firestore helpers for the subsidiary delivery workspace.
 *
 * The IWO collection lives at the **root** (`/internal_work_orders/{id}`),
 * not nested under `/organizations/{id}/...`. Firestore rules
 * (firestore.rules §"Assignment & Handoff context") filter visibility
 * server-side: subsidiary principals only read IWOs whose
 * `subsidiaryOrgId` equals their `homeOrgId`. We still scope the *query*
 * to the user's subsidiary so the inbox can be paginated and indexed.
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';
import type {
  InternalWorkOrder,
  HandoffPacket,
} from '@/modules/assignment';
import type { TimeEntry, CostEntry, Deliverable } from '@/modules/delivery';

// ─────────────────────────────────────────────────────────────────
// IWO inbox
// ─────────────────────────────────────────────────────────────────

/**
 * Subscribe to the subsidiary's IWO inbox — every IWO whose
 * `subsidiaryOrgId` matches and whose state is `ISSUED`. Sorted by issuedAt
 * descending (most-recently-issued first).
 */
export function subscribeIWOInbox(
  subsidiaryOrgId: SubsidiaryId,
  cb: (iwos: InternalWorkOrder[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders'),
    where('subsidiaryOrgId', '==', subsidiaryOrgId),
    where('state', '==', 'ISSUED'),
    orderBy('issuedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) }),
        ),
      );
    },
    (err) => onError?.(err),
  );
}

/**
 * All in-flight IWOs for the subsidiary — ACCEPTED and IN_PROGRESS,
 * surfaced on the workspace home so a delivery lead can pick the one
 * they're currently posting time against without bouncing through the
 * inbox.
 */
export function subscribeIWOActive(
  subsidiaryOrgId: SubsidiaryId,
  cb: (iwos: InternalWorkOrder[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders'),
    where('subsidiaryOrgId', '==', subsidiaryOrgId),
    where('state', 'in', ['ACCEPTED', 'IN_PROGRESS', 'DELIVERED']),
  );
  return onSnapshot(
    q,
    (snap) => {
      cb(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) }),
        ),
      );
    },
    (err) => onError?.(err),
  );
}

// ─────────────────────────────────────────────────────────────────
// Single-IWO workspace
// ─────────────────────────────────────────────────────────────────

export function subscribeIWO(
  iwoId: string,
  cb: (iwo: InternalWorkOrder | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const ref = doc(db, 'internal_work_orders', iwoId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) cb(null);
      else cb({ id: snap.id, ...(snap.data() as Omit<InternalWorkOrder, 'id'>) });
    },
    (err) => onError?.(err),
  );
}

export async function getHandoffPacket(iwoId: string): Promise<HandoffPacket | null> {
  // Single-doc subcollection — doc id is the literal "packet".
  const ref = doc(db, 'internal_work_orders', iwoId, 'handoff_packet', 'packet');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as HandoffPacket;
}

export function subscribeHandoffPacket(
  iwoId: string,
  cb: (packet: HandoffPacket | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const ref = doc(db, 'internal_work_orders', iwoId, 'handoff_packet', 'packet');
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) cb(null);
      else cb(snap.data() as HandoffPacket);
    },
    (err) => onError?.(err),
  );
}

export function subscribeTimeEntries(
  iwoId: string,
  cb: (entries: TimeEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders', iwoId, 'time_entries'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TimeEntry, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export function subscribeCostEntries(
  iwoId: string,
  cb: (entries: CostEntry[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders', iwoId, 'cost_entries'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CostEntry, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export function subscribeDeliverables(
  iwoId: string,
  cb: (deliverables: Deliverable[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders', iwoId, 'deliverables'),
    orderBy('createdAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Deliverable, 'id'>) }))),
    (err) => onError?.(err),
  );
}

