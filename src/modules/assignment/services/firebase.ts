/**
 * Typed wrappers around the Phase 3.B IWO state-machine callables.
 * The 3.D AM UI uses these for `issueWorkOrder`, `acceptInternal`,
 * `requestRevision`, and `cancelWorkOrder`. The remaining transitions
 * (accept/reject/start/deliver/post) belong to the delivery flow in 3.E.
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import type { HttpsCallable } from 'firebase/functions';
import { app } from '@/core/services/firebase/config';
import type { SubsidiaryId } from '@/core/settings/types';
import type { HandoffMilestone, HandoffAcceptanceCriterion } from '../types/handoff-packet.types';

const functions = getFunctions(app, 'europe-west1');

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  try { connectFunctionsEmulator(functions, 'localhost', 5001); } catch { /* noop */ }
}

// ─────────────────────────────────────────────────────────────────
// issueWorkOrder
// ─────────────────────────────────────────────────────────────────

export interface IssueWorkOrderHandoffPacket {
  briefMd: string;
  milestones: Array<Pick<HandoffMilestone, 'id' | 'name' | 'dueDate'>>;
  acceptanceCriteria: Array<Pick<HandoffAcceptanceCriterion, 'id' | 'description' | 'required'>>;
  clientContextMd?: string;
  commsOwnerUserId: string;
}

export interface IssueWorkOrderRequest {
  masterJobId: string;
  iwoInput: {
    subsidiaryOrgId: SubsidiaryId;
    budgetMinor: number;
    transferPriceMinor: number;
    currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
    handoffPacket: IssueWorkOrderHandoffPacket;
    idempotencyKey?: string;
    code?: string;
  };
}

export interface IssueWorkOrderResponse {
  id: string;
  status: 'ISSUED';
  masterJobId: string;
  budgetHoldId: string;
  allocatedAfterMinor: number;
}

export const issueWorkOrderFn: HttpsCallable<IssueWorkOrderRequest, IssueWorkOrderResponse> =
  httpsCallable(functions, 'issueWorkOrder');

// ─────────────────────────────────────────────────────────────────
// acceptInternal / requestRevision / cancel / close
// ─────────────────────────────────────────────────────────────────

export const acceptInternalFn: HttpsCallable<
  { iwoId: string; idempotencyKey?: string },
  { id: string; status: 'ACCEPTED_INTERNALLY' }
> = httpsCallable(functions, 'acceptInternal');

export const requestRevisionFn: HttpsCallable<
  { iwoId: string; criteriaFailures: string[]; idempotencyKey?: string },
  { id: string; status: 'IN_PROGRESS'; failures: string[] }
> = httpsCallable(functions, 'requestRevision');

/** AM ticks an acceptance criterion as signed (gates `acceptInternal`). */
export const signAcceptanceCriterionFn: HttpsCallable<
  { iwoId: string; criterionId: string; sign?: boolean },
  { iwoId: string; criterionId: string; signed: boolean; signedByUserId: string | null }
> = httpsCallable(functions, 'signAcceptanceCriterion');

export const cancelWorkOrderFn: HttpsCallable<
  { iwoId: string; reason: string },
  { id: string; status: 'CANCELLED' }
> = httpsCallable(functions, 'cancelWorkOrder');

export const closeWorkOrderFn: HttpsCallable<
  { iwoId: string },
  { id: string; status: 'CLOSED' }
> = httpsCallable(functions, 'closeWorkOrder');
