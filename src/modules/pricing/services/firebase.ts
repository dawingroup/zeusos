/**
 * Typed wrappers around the pricing Cloud Functions. The CFns live in
 * `europe-west1` (separate from the historic `us-central1` ones in
 * `src/core/services/firebase/functions.ts`) because Phase 0 settled on
 * europe-west1 for the Firestore region.
 */

import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import type { HttpsCallable } from 'firebase/functions';
import { app } from '@/core/services/firebase/config';
import type { SubsidiaryId } from '@/core/settings/types';
import type { PricedQuote, QuoteLineInput, RateCardUnit } from '../types';

const functions = getFunctions(app, 'europe-west1');

if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectFunctionsEmulator(functions, 'localhost', 5001);
}

// ─────────────────────────────────────────────────────────────────
// Pricing
// ─────────────────────────────────────────────────────────────────

export interface PriceQuoteRequest {
  sowId: string;
  /** Required while 3.A.5 hasn't introduced the SOW collection — the CFn
   *  falls back to this when `sows/{sowId}` doesn't exist. */
  clientId?: string;
  lines: QuoteLineInput[];
  marginFloorPct?: number;
  overrideFloor?: boolean;
  overrideReason?: string;
}

export const priceQuoteFn: HttpsCallable<PriceQuoteRequest, PricedQuote & { pinnedRateCardIdsBySubsidiary: Record<string, string> }> =
  httpsCallable(functions, 'priceQuote');

// ─────────────────────────────────────────────────────────────────
// Quote lifecycle
// ─────────────────────────────────────────────────────────────────

export const issueQuoteFn: HttpsCallable<{ quoteId: string; overrideFloor?: boolean; overrideReason?: string }, { quoteId: string; status: 'ISSUED'; marginPct: number }> =
  httpsCallable(functions, 'issueQuote');

export const acceptQuoteFn: HttpsCallable<{ quoteId: string; acceptedBy?: string; acceptedByClientName?: string }, { quoteId: string; status: 'ACCEPTED' }> =
  httpsCallable(functions, 'acceptQuote');

export const voidQuoteFn: HttpsCallable<{ quoteId: string; reason: string }, { quoteId: string; status: 'VOID' }> =
  httpsCallable(functions, 'voidQuote');

// ─────────────────────────────────────────────────────────────────
// Rate card admin
// ─────────────────────────────────────────────────────────────────

export interface CreateRateCardLineInput {
  roleCode: string;
  unit: RateCardUnit;
  costMinor: number;
  currency: 'UGX' | 'KES' | 'USD';
  description?: string;
}

export const createRateCardVersionFn: HttpsCallable<{ orgId: SubsidiaryId; lines: CreateRateCardLineInput[] }, { rateCardId: string; version: number; lineCount: number }> =
  httpsCallable(functions, 'createRateCardVersion');

export const activateRateCardFn: HttpsCallable<{ rateCardId: string; effectiveFrom: string }, { rateCardId: string; status: 'ACTIVE'; retiredPriorId: string | null }> =
  httpsCallable(functions, 'activateRateCard');

export const retireRateCardFn: HttpsCallable<{ rateCardId: string }, { rateCardId: string; status: 'RETIRED' }> =
  httpsCallable(functions, 'retireRateCard');
