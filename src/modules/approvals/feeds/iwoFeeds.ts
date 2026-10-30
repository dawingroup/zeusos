/**
 * IWO feed for the approvals inbox.
 *
 * One query on `internal_work_orders`: state == 'DELIVERED', optionally
 * narrowed to one brand. The brand clause matters for more than scope: the
 * `internal_work_orders` read rule lets a subsidiary principal read only
 * docs where `subsidiaryOrgId == callerHomeOrgId()`, and a list query is
 * authorised only when its filters prove that for every result — so the
 * brand variant MUST carry `where('subsidiaryOrgId', '==', brandId)` or
 * the whole listener is denied. Two equality filters ride the single-field
 * indexes; no composite index is needed.
 */

import { collection, onSnapshot, query, where, type QueryConstraint, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type { IwoInput } from '../approvalsProjection';

export type DeliveredIwoRow = IwoInput;

export function subscribeDeliveredIwos(
  opts: { brandId?: string },
  callback: (rows: DeliveredIwoRow[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const constraints: QueryConstraint[] = [where('state', '==', 'DELIVERED')];
  if (opts.brandId) constraints.push(where('subsidiaryOrgId', '==', opts.brandId));
  const q = query(collection(db, 'internal_work_orders'), ...constraints);
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DeliveredIwoRow, 'id'>) }))),
    (err) => onError?.(err),
  );
}
