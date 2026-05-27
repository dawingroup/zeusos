/**
 * Brief + CES service layer — Phase 6.UI.D (PR 5).
 *
 * Typed callable wrappers for:
 *   - updateMasterJobBrief  (new in this PR — see
 *                            `functions/src/account-management/updateMasterJobBrief.js`)
 *   - postCesLineItem       (existing 6.D callable)
 *   - signOffCes            (existing 6.D callable)
 */

import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { app } from '@/core/services/firebase/config';
import type { Brief } from '@/modules/campaigns/types/campaign.types';
import type { CESLineItem } from '@/modules/contracts/types/ces.types';

const functions = getFunctions(app, 'europe-west1');

// ──────────────────────────────────────────────────────────────────
// updateMasterJobBrief
// ──────────────────────────────────────────────────────────────────

export interface UpdateMasterJobBriefInput {
  masterJobId: string;
  /** Whitelisted Brief subset — see ALLOWED_BRIEF_FIELDS server-side. */
  brief: Partial<Brief>;
}
export interface UpdateMasterJobBriefResult {
  masterJobId: string;
  updated: true;
}
export const updateMasterJobBriefFn: HttpsCallable<UpdateMasterJobBriefInput, UpdateMasterJobBriefResult> =
  httpsCallable(functions, 'updateMasterJobBrief');

// ──────────────────────────────────────────────────────────────────
// postCesLineItem
// ──────────────────────────────────────────────────────────────────

export interface PostCesLineItemInput {
  masterJobId: string;
  lineItem: Omit<CESLineItem, 'id' | 'addedBy' | 'addedAt'> & { id?: string };
  idempotencyKey?: string;
}
export interface PostCesLineItemResult {
  masterJobId: string;
  lineItemId: string;
  newTotalMinor: number;
  currency: CESLineItem['currency'];
}
export const postCesLineItemFn: HttpsCallable<PostCesLineItemInput, PostCesLineItemResult> =
  httpsCallable(functions, 'postCesLineItem');

// ──────────────────────────────────────────────────────────────────
// signOffCes
// ──────────────────────────────────────────────────────────────────

export interface SignOffCesInput {
  masterJobId: string;
  marginFloorPct?: number;
  idempotencyKey?: string;
}
export interface SignOffCesResult {
  masterJobId: string;
  signedOff: true;
  totalMinor?: number;
  currency?: CESLineItem['currency'];
  marginFloorPct?: number | null;
  alreadySignedOff?: boolean;
}
export const signOffCesFn: HttpsCallable<SignOffCesInput, SignOffCesResult> =
  httpsCallable(functions, 'signOffCes');
