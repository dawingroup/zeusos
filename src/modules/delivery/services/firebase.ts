/**
 * Typed wrappers around the Phase 3.B IWO state-machine callables that the
 * subsidiary delivery workspace invokes.
 *
 * All callables live in `europe-west1`. Signatures mirror the Cloud
 * Function `data` validation in `functions/src/assignment/*.js`. If a
 * callable hasn't been deployed yet (e.g. when working against a stale
 * emulator), the call will throw a `not-found` HttpsError — the UI
 * surfaces this as "Action unavailable — Phase 3.B precondition".
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import type { HttpsCallable } from 'firebase/functions';
import { app } from '@/core/services/firebase/config';
import type { IWOState } from '@/modules/assignment';

const functions = getFunctions(app, 'europe-west1');

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

// ─────────────────────────────────────────────────────────────────
// IWO state transitions (Phase 3.B)
// ─────────────────────────────────────────────────────────────────

export interface AcceptWorkOrderRequest {
  iwoId: string;
  idempotencyKey?: string;
}
export interface AcceptWorkOrderResponse {
  id: string;
  status: IWOState; // ACCEPTED
}
export const acceptWorkOrderFn: HttpsCallable<AcceptWorkOrderRequest, AcceptWorkOrderResponse> =
  httpsCallable(functions, 'acceptWorkOrder');

export interface RejectWorkOrderRequest {
  iwoId: string;
  reason: string;
  idempotencyKey?: string;
}
export interface RejectWorkOrderResponse {
  id: string;
  status: IWOState; // REJECTED
}
export const rejectWorkOrderFn: HttpsCallable<RejectWorkOrderRequest, RejectWorkOrderResponse> =
  httpsCallable(functions, 'rejectWorkOrder');

export interface StartWorkOrderRequest {
  iwoId: string;
  idempotencyKey?: string;
}
export interface StartWorkOrderResponse {
  id: string;
  status: IWOState; // IN_PROGRESS
}
export const startWorkOrderFn: HttpsCallable<StartWorkOrderRequest, StartWorkOrderResponse> =
  httpsCallable(functions, 'startWorkOrder');

// ─────────────────────────────────────────────────────────────────
// Burn — time + cost entries (Phase 3.B)
// ─────────────────────────────────────────────────────────────────

export interface PostTimeEntryRequest {
  iwoId: string;
  userId: string;
  minutes: number;
  /** ISO date string (yyyy-mm-dd). Cloud Function rejects missing/empty. */
  entryDate: string;
  note?: string;
  idempotencyKey?: string;
}
export interface PostTimeEntryResponse {
  iwoId: string;
  timeEntryId: string;
  cumulativeCostMinor: number;
  thresholdCrossed?: 80 | 100;
}
export const postTimeEntryFn: HttpsCallable<PostTimeEntryRequest, PostTimeEntryResponse> =
  httpsCallable(functions, 'postTimeEntry');

export type CostEntryKindForApi = 'VENDOR' | 'MEDIA_SPEND' | 'EXPENSE';

export interface PostCostEntryRequest {
  iwoId: string;
  kind: CostEntryKindForApi;
  /** Minor units, integer > 0. */
  amount: number;
  isPassThrough: boolean;
  description?: string;
  idempotencyKey?: string;
}
export interface PostCostEntryResponse {
  iwoId: string;
  costEntryId: string;
  cumulativeCostMinor: number;
  thresholdCrossed?: 80 | 100;
}
export const postCostEntryFn: HttpsCallable<PostCostEntryRequest, PostCostEntryResponse> =
  httpsCallable(functions, 'postCostEntry');

// ─────────────────────────────────────────────────────────────────
// Delivery
// ─────────────────────────────────────────────────────────────────

export interface SubmitDeliverableRequest {
  iwoId: string;
  /** Foreign keys into the asset library / Storage. ≥1 required. */
  assetIds: string[];
  description?: string;
  idempotencyKey?: string;
}
export interface SubmitDeliverableResponse {
  id: string;            // iwoId
  status: IWOState;      // DELIVERED
  deliverableId: string;
}
export const submitDeliverableFn: HttpsCallable<SubmitDeliverableRequest, SubmitDeliverableResponse> =
  httpsCallable(functions, 'submitDeliverable');

// ─────────────────────────────────────────────────────────────────
// Direct-client-request routing (spec §7.4 — Layer 3 of the boundary)
// ─────────────────────────────────────────────────────────────────

export interface RouteDirectClientRequestRequest {
  receivingSubsidiaryOrgId: string;
  routedToUserId: string;
  masterJobId?: string;
  clientId: string;
  note: string;
  idempotencyKey?: string;
}

export interface RouteDirectClientRequestResponse {
  intakeId: string;
}

/**
 * PRECONDITION — not yet shipped. A follow-up Cloud Function will write
 * a master-job intake item and emit `DirectClientRequestRouted` to the
 * outbox in one transaction. Until then the button surfaces the call as
 * a 503 with a clear message to the user. Wire the function name now so
 * we can swap to live behavior with a single deploy.
 */
export const routeDirectClientRequestFn: HttpsCallable<
  RouteDirectClientRequestRequest,
  RouteDirectClientRequestResponse
> = httpsCallable(functions, 'routeDirectClientRequest');
