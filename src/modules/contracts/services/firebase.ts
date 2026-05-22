/**
 * Typed wrappers around the Contracts (Phase 3.D) Cloud Functions.
 * Lives in europe-west1 — same region as the rest of the commercial-core
 * CFs. All mutations route through these wrappers; the strict
 * `firestore.rules` for msas/sows/change_orders is `write: if false`,
 * which means direct UI writes would fail. The CFns use Admin SDK
 * (bypassing rules) AND `assertParentOrgPrincipal` (spec §7.4 layer 2)
 * to reject subsidiary principals.
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import type { HttpsCallable } from 'firebase/functions';
import { app } from '@/core/services/firebase/config';
import type { ClientContact, ClientStatus } from '../types/client.types';

const functions = getFunctions(app, 'europe-west1');

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  // Idempotent — duplicate calls during HMR are safe.
  try { connectFunctionsEmulator(functions, 'localhost', 5001); } catch { /* noop */ }
}

// ─────────────────────────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────────────────────────

export interface UpsertClientRequest {
  /** Omit on create; pass to edit. */
  id?: string;
  name: string;
  code?: string;
  billingCurrency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  sector?: string;
  status?: ClientStatus;
  contacts?: ClientContact[];
  relationshipManagerUserId?: string;
  notes?: string;
}

export const upsertClientFn: HttpsCallable<UpsertClientRequest, { id: string; status: ClientStatus }> =
  httpsCallable(functions, 'upsertClient');

// ─────────────────────────────────────────────────────────────────
// MSA
// ─────────────────────────────────────────────────────────────────

export interface UpsertMsaRequest {
  id?: string;
  clientId: string;
  title: string;
  code?: string;
  agreementDocRef?: string;
  effectiveFrom: string;     // ISO date
  effectiveTo?: string;
  hasNda?: boolean;
  signedByClientName?: string;
  signedByClientAt?: string;
  signedByParentUserId?: string;
  signedByParentAt?: string;
}

export const upsertMsaFn: HttpsCallable<UpsertMsaRequest, { id: string; status: 'DRAFT' | 'ACTIVE' }> =
  httpsCallable(functions, 'upsertMsa');

export const activateMsaFn: HttpsCallable<{ msaId: string }, { id: string; status: 'ACTIVE' }> =
  httpsCallable(functions, 'activateMsa');

// ─────────────────────────────────────────────────────────────────
// SOW
// ─────────────────────────────────────────────────────────────────

export interface UpsertSowRequest {
  id?: string;
  msaId: string;
  title: string;
  code?: string;
  type: 'RETAINER' | 'PROJECT';
  scopeDocRef?: string;
  ceilingMinor: number;
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  startDate?: string;
  endDate?: string;
  briefTier?: string;
}

export const upsertSowFn: HttpsCallable<UpsertSowRequest, { id: string; status: string }> =
  httpsCallable(functions, 'upsertSow');

export const submitSowForApprovalFn: HttpsCallable<{ sowId: string }, { id: string; status: 'PENDING_APPROVAL' }> =
  httpsCallable(functions, 'submitSowForApproval');

export const approveSowFn: HttpsCallable<{ sowId: string }, { id: string; status: 'ACTIVE' }> =
  httpsCallable(functions, 'approveSow');

export const cancelSowFn: HttpsCallable<{ sowId: string; reason: string }, { id: string; status: 'CANCELLED' }> =
  httpsCallable(functions, 'cancelSow');

// ─────────────────────────────────────────────────────────────────
// Change Order
// ─────────────────────────────────────────────────────────────────

export interface UpsertChangeOrderRequest {
  id?: string;
  sowId: string;
  code?: string;
  deltaMinor: number;   // may be negative (de-scope)
  reason: string;
}

export const upsertChangeOrderFn: HttpsCallable<UpsertChangeOrderRequest, { id: string; status: string }> =
  httpsCallable(functions, 'upsertChangeOrder');

export const approveChangeOrderFn: HttpsCallable<
  { changeOrderId: string },
  { id: string; status: 'APPROVED'; appliedCeilingMinorAfter: number }
> = httpsCallable(functions, 'approveChangeOrder');

export const rejectChangeOrderFn: HttpsCallable<
  { changeOrderId: string; reason: string },
  { id: string; status: 'REJECTED' }
> = httpsCallable(functions, 'rejectChangeOrder');
