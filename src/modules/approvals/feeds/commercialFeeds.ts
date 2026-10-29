/**
 * Commercial feeds for the approvals inbox — SOWs, change orders, quotes.
 *
 * Each is one status-equality query on a top-level commercial collection
 * (`sows`, `change_orders`, `quotes`). Their read rules are
 * `canActOnClient(resource.data.clientId)`: a parent-org principal passes
 * for every doc, which is the only caller these feeds are opened for (see
 * `useApprovalsInbox`). A brand-direct seller would need a `clientId in
 * [...]` clause to be authorised, which is why the inbox does not open
 * these for brand scopes today.
 */

import { collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type { ChangeOrderInput, QuoteInput, SowInput } from '../approvalsProjection';

function subscribeByStatus<T extends { id: string }>(
  collectionName: string,
  status: string,
  callback: (rows: T[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(collection(db, collectionName), where('status', '==', status));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<T, 'id'>) }) as T)),
    (err) => onError?.(err),
  );
}

/** SOWs submitted for approval. */
export function subscribePendingSows(
  callback: (rows: SowInput[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return subscribeByStatus<SowInput>('sows', 'PENDING_APPROVAL', callback, onError);
}

/** Change orders awaiting approve / reject (ZeusOS COs are decided from DRAFT). */
export function subscribeDraftChangeOrders(
  callback: (rows: ChangeOrderInput[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return subscribeByStatus<ChangeOrderInput>('change_orders', 'DRAFT', callback, onError);
}

/** Quotes issued to the client and not yet accepted or voided. */
export function subscribeIssuedQuotes(
  callback: (rows: QuoteInput[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return subscribeByStatus<QuoteInput>('quotes', 'ISSUED', callback, onError);
}
