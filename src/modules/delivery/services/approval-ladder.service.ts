/**
 * Approval-ladder service layer — Phase 6.UI.D.2.
 *
 * Read side: subscribes to IWOs filtered by `approvalChain.currentRung`
 * for the ECD Review aggregator. Write side: typed callables for the
 * Phase 6.D advance / reject CFns.
 */

import {
  collection,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { db } from '@/core/services/firebase/firestore';
import { app } from '@/core/services/firebase/config';
import type { InternalWorkOrder } from '@/modules/assignment/types/iwo.types';
import type { ApprovalRung } from '@/modules/assignment/types/approval-chain.types';

const functions = getFunctions(app, 'europe-west1');

export interface AdvanceApprovalRungInput {
  iwoId: string;
  actorRoleProfileId?: string;
  idempotencyKey?: string;
}
export interface AdvanceApprovalRungResult {
  id: string;
  rung: ApprovalRung;
  terminal: boolean;
}
export const advanceApprovalRungFn: HttpsCallable<AdvanceApprovalRungInput, AdvanceApprovalRungResult> =
  httpsCallable(functions, 'advanceApprovalRung');

export interface RejectApprovalRungInput {
  iwoId: string;
  notes: string;
  actorRoleProfileId?: string;
  idempotencyKey?: string;
}
export interface RejectApprovalRungResult {
  id: string;
  rung: ApprovalRung;
  reset: true;
}
export const rejectApprovalRungFn: HttpsCallable<RejectApprovalRungInput, RejectApprovalRungResult> =
  httpsCallable(functions, 'rejectApprovalRung');

/**
 * Subscribe to every IWO whose `approvalChain.currentRung` matches the
 * given rung — drives the ECD Review aggregator. Per-rung RBAC for who
 * can actually action a row is enforced by the callable (Phase 6.D
 * gates parent-org only today; the per-rung RBAC follow-up is 6.D.2).
 */
export function subscribeIwosAtRung(
  rung: ApprovalRung,
  cb: (iwos: InternalWorkOrder[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders'),
    where('approvalChain.currentRung', '==', rung),
    where('approvalChain.complete', '==', false),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) }))),
    (err) => onError?.(err),
  );
}

/**
 * Subscribe to IWOs whose approval ladder is complete (GRANTED at terminal
 * rung) but still in `DELIVERED` or later states — used by the History tab.
 */
export function subscribeCompletedApprovals(
  cb: (iwos: InternalWorkOrder[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders'),
    where('approvalChain.complete', '==', true),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) }))),
    (err) => onError?.(err),
  );
}

/**
 * Subscribe to every DELIVERED IWO regardless of rung — used by the
 * Pending / In Progress / Returned partitioning in ECD Review.
 */
export function subscribeAllDeliveredIwos(
  cb: (iwos: InternalWorkOrder[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'internal_work_orders'),
    where('state', '==', 'DELIVERED'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InternalWorkOrder, 'id'>) }))),
    (err) => onError?.(err),
  );
}
