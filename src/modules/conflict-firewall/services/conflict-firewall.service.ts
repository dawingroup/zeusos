/**
 * Conflict-firewall service layer — ADR-2026-05-25 §2.Q4.
 *
 * Typed wrappers for `addClientCompetitor` / `removeClientCompetitor`
 * plus a realtime Firestore subscription scoped to a single client's
 * competitor list. The `BreachRisksPage` subscribes to the
 * `ConflictExclusivityRisk` event stream on `domain_events`.
 */

import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fbLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { db } from '@/core/services/firebase/firestore';
import { app } from '@/core/services/firebase/config';
import type {
  AddClientCompetitorInput,
  ClientCompetitor,
  ClientCompetitorId,
  ClientCompetitorSource,
  RemoveClientCompetitorInput,
} from '@/modules/contracts/types/client-competitor.types';

const functions = getFunctions(app, 'europe-west1');

// ──────────────────────────────────────────────────────────────────
// Callables
// ──────────────────────────────────────────────────────────────────

export interface AddClientCompetitorResult {
  id: ClientCompetitorId;
  clientId: string;
  competitorClientId: string;
  created: boolean;
}
export const addClientCompetitorFn: HttpsCallable<AddClientCompetitorInput, AddClientCompetitorResult> =
  httpsCallable(functions, 'addClientCompetitor');

export interface RemoveClientCompetitorResult {
  id: ClientCompetitorId;
  removed: true;
}
export const removeClientCompetitorFn: HttpsCallable<RemoveClientCompetitorInput, RemoveClientCompetitorResult> =
  httpsCallable(functions, 'removeClientCompetitor');

// ──────────────────────────────────────────────────────────────────
// Subscriptions
// ──────────────────────────────────────────────────────────────────

export function subscribeClientCompetitors(
  clientId: string,
  cb: (rows: ClientCompetitor[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'client_competitors'),
    where('clientId', '==', clientId),
  );
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClientCompetitor, 'id'>) })),
      ),
    (err) => onError?.(err),
  );
}

// ──────────────────────────────────────────────────────────────────
// Breach-risk events (domain_events stream)
// ──────────────────────────────────────────────────────────────────

export interface ConflictExclusivityRiskEvent {
  id: string;
  aggregateId: string;
  occurredAt: string;
  payload: {
    requestedClientId: string;
    listedCompetitorIds: string[];
    walledBrandIds: string[];
    walledCompetitorByBrand: Record<string, string[]>;
    masterJobId: string;
  };
}

export function subscribeConflictRisks(
  cb: (events: ConflictExclusivityRiskEvent[]) => void,
  onError?: (e: Error) => void,
  cap: number = 100,
): Unsubscribe {
  const q = query(
    collection(db, 'domain_events'),
    where('eventType', '==', 'ConflictExclusivityRisk'),
    orderBy('occurredAt', 'desc'),
    fbLimit(cap),
  );
  return onSnapshot(
    q,
    (snap) =>
      cb(
        snap.docs.map(
          (d) => ({ id: d.id, ...(d.data() as Omit<ConflictExclusivityRiskEvent, 'id'>) }),
        ),
      ),
    (err) => onError?.(err),
  );
}

export type { ClientCompetitorSource };
