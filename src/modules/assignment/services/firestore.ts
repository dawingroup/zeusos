/**
 * Read-side Firestore helpers for the Assignment context. Writes go via
 * the Phase 3.B Cloud Functions (`issueWorkOrder`, `acceptInternal`, etc.).
 * Subsidiary principals see only IWOs targeting their own org (firestore.rules
 * §4196). Parent-org principals see everything.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { MasterJob } from '../types/master-job.types';
import type { InternalWorkOrder } from '../types/iwo.types';
import type { HandoffPacket } from '../types/handoff-packet.types';

// ─────────────────────────────────────────────────────────────────
// Master jobs
// ─────────────────────────────────────────────────────────────────

export async function listMasterJobs(opts?: {
  clientId?: string;
  status?: MasterJob['status'];
}): Promise<MasterJob[]> {
  const clauses = [];
  if (opts?.clientId) clauses.push(where('clientId', '==', opts.clientId));
  if (opts?.status) clauses.push(where('status', '==', opts.status));
  const q = clauses.length
    ? query(collection(db, 'master_jobs'), ...clauses)
    : query(collection(db, 'master_jobs'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MasterJob, 'id'>) }));
}

export function subscribeMasterJob(
  masterJobId: string,
  cb: (mj: MasterJob | null) => void,
): Unsubscribe {
  return onSnapshot(doc(db, 'master_jobs', masterJobId), snap => {
    cb(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<MasterJob, 'id'>) }) : null);
  });
}

export async function getMasterJob(masterJobId: string): Promise<MasterJob | null> {
  const snap = await getDoc(doc(db, 'master_jobs', masterJobId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<MasterJob, 'id'>) };
}

// ─────────────────────────────────────────────────────────────────
// IWOs
// ─────────────────────────────────────────────────────────────────

export async function listIwosForMasterJob(masterJobId: string): Promise<InternalWorkOrder[]> {
  const q = query(
    collection(db, 'internal_work_orders'),
    where('masterJobId', '==', masterJobId),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) }));
}

export function subscribeIwosForMasterJob(
  masterJobId: string,
  cb: (iwos: InternalWorkOrder[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders'),
    where('masterJobId', '==', masterJobId),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) })));
  });
}

export async function listDeliveredIwosForAccountManager(
  amUserId?: string,
): Promise<InternalWorkOrder[]> {
  // Wide read for now — the parent-org rule lets every AM see every IWO;
  // we filter by `state === 'DELIVERED'` and (optionally) by master_job
  // ownership. Once `master_job.accountManagerUserId` is universally
  // populated this becomes a 2-step server-side join.
  const q = query(
    collection(db, 'internal_work_orders'),
    where('state', '==', 'DELIVERED'),
  );
  const snap = await getDocs(q);
  const rows = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) }));
  if (!amUserId) return rows;
  // Filter by AM ownership where the join is cheap (master_job lookups).
  // This is a small list in practice; if it grows, denormalise the AM
  // userId onto each IWO at issue time.
  const owned: InternalWorkOrder[] = [];
  for (const iwo of rows) {
    const mj = await getMasterJob(iwo.masterJobId);
    if (mj && (!mj.accountManagerUserId || mj.accountManagerUserId === amUserId)) {
      owned.push(iwo);
    }
  }
  return owned;
}

export async function getHandoffPacket(iwoId: string): Promise<HandoffPacket | null> {
  // One-doc subcollection at /handoff_packet/packet (spec §4.4).
  const snap = await getDoc(doc(db, 'internal_work_orders', iwoId, 'handoff_packet', 'packet'));
  if (!snap.exists()) return null;
  return snap.data() as HandoffPacket;
}

// ─────────────────────────────────────────────────────────────────
// Direct-client-request intake (spec §11.3)
// ─────────────────────────────────────────────────────────────────

export interface DirectClientRequestEvent {
  id: string;
  /** Event ULID. */
  eventId: string;
  subsidiaryOrgId: string;
  clientId?: string;
  iwoId?: string;
  masterJobId?: string;
  requestText: string;
  emittedAt: unknown;
  processed: boolean;
}

export async function listOpenIntakeRequests(): Promise<DirectClientRequestEvent[]> {
  // Reads `domain_events` filtered to DirectClientRequestRouted.
  const q = query(
    collection(db, 'domain_events'),
    where('eventType', '==', 'DirectClientRequestRouted'),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => {
      const data = d.data();
      const payload = (data.payload || {}) as Record<string, unknown>;
      return {
        id: d.id,
        eventId: d.id,
        subsidiaryOrgId: String(payload.subsidiaryOrgId || ''),
        clientId: payload.clientId as string | undefined,
        iwoId: payload.iwoId as string | undefined,
        masterJobId: payload.masterJobId as string | undefined,
        requestText: String(payload.requestText || payload.text || ''),
        emittedAt: data.emittedAt,
        processed: !!data.processed,
      };
    })
    // Only show events not yet acted on by AM.
    .filter(e => !e.processed || !(e as any).resolvedByAccountMgmt);
}
