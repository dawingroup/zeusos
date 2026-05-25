/**
 * Conflict-firewall service layer — Phase 6.UI.C.
 *
 * Read paths use Firestore subscriptions; write paths go through
 * the Phase 6.UI.C admin callables (`addCategory`,
 * `addClientCategory`, `removeClientCategory`, `addConflictWall`,
 * `removeConflictWall`). All callables are idempotent and
 * parent-org-gated server-side.
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
  limit as fbLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { db } from '@/core/services/firebase/firestore';
import { app } from '@/core/services/firebase/config';
import type {
  Category,
  CategoryId,
  ClientCategory,
  ConflictWall,
  ConflictWallReason,
} from '@/modules/contracts/types/conflict-firewall.types';

const functions = getFunctions(app, 'europe-west1');

// ──────────────────────────────────────────────────────────────────
// Callables
// ──────────────────────────────────────────────────────────────────

export interface AddCategoryInput {
  id: CategoryId;
  name: string;
  description?: string;
  parentCategoryId?: CategoryId;
  isActive?: boolean;
}
export interface AddCategoryResult {
  id: CategoryId;
  created: boolean;
}
export const addCategoryFn: HttpsCallable<AddCategoryInput, AddCategoryResult> =
  httpsCallable(functions, 'addCategory');

export interface AddClientCategoryInput {
  clientId: string;
  categoryId: CategoryId;
  exclusive?: boolean;
  notes?: string;
}
export interface AddClientCategoryResult {
  id: string;
  clientId: string;
  categoryId: CategoryId;
  exclusive: boolean;
  created: boolean;
}
export const addClientCategoryFn: HttpsCallable<AddClientCategoryInput, AddClientCategoryResult> =
  httpsCallable(functions, 'addClientCategory');

export interface RemoveClientCategoryInput {
  clientId: string;
  categoryId: CategoryId;
}
export interface RemoveClientCategoryResult {
  id: string;
  removed: true;
}
export const removeClientCategoryFn: HttpsCallable<RemoveClientCategoryInput, RemoveClientCategoryResult> =
  httpsCallable(functions, 'removeClientCategory');

export interface AddConflictWallInput {
  clientId: string;
  servingOrgId: string;
  categoryId: CategoryId;
  reason?: ConflictWallReason;
  sourceAggregateType?: 'master_job' | 'sow' | 'manual';
  sourceAggregateId?: string;
  notes?: string;
}
export interface AddConflictWallResult {
  id: string;
  created: boolean;
}
export const addConflictWallFn: HttpsCallable<AddConflictWallInput, AddConflictWallResult> =
  httpsCallable(functions, 'addConflictWall');

export interface RemoveConflictWallInput {
  wallId: string;
}
export interface RemoveConflictWallResult {
  id: string;
  removed: true;
}
export const removeConflictWallFn: HttpsCallable<RemoveConflictWallInput, RemoveConflictWallResult> =
  httpsCallable(functions, 'removeConflictWall');

// ──────────────────────────────────────────────────────────────────
// Subscriptions
// ──────────────────────────────────────────────────────────────────

export function subscribeCategories(
  cb: (rows: Category[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'categories'),
    (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
        .sort((a, b) => a.id.localeCompare(b.id));
      cb(rows);
    },
    (err) => onError?.(err),
  );
}

export function subscribeClientCategories(
  cb: (rows: ClientCategory[]) => void,
  onError?: (e: Error) => void,
  opts?: { clientId?: string },
): Unsubscribe {
  const base = collection(db, 'client_categories');
  const q = opts?.clientId
    ? query(base, where('clientId', '==', opts.clientId))
    : query(base);
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClientCategory, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export function subscribeConflictWalls(
  cb: (rows: ConflictWall[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'conflict_walls'),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ConflictWall, 'id'>) }))),
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
    categoryId: CategoryId;
    requestedClientId: string | null;
    walledClientIds: string[];
    excludedBrandIds: string[];
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

// ──────────────────────────────────────────────────────────────────
// Convenience reads
// ──────────────────────────────────────────────────────────────────

export async function getCategory(categoryId: CategoryId): Promise<Category | null> {
  const snap = await getDoc(doc(db, 'categories', categoryId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Category, 'id'>) };
}
