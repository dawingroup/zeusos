/**
 * FX rate types — for the once-only conversion at client-invoice
 * consolidation (plan §14.11 row 11.6).
 *
 * Phase 3.F ships a Firestore-backed stub; Phase 5 wires a real feed.
 */

import type { CurrencyCode } from './money.types';

export interface FXRateSnapshot {
  /** ISO date the rates apply to. */
  date: string;        // YYYY-MM-DD
  /** Quote currency — rates are expressed as "1 base = N quote". */
  base: CurrencyCode;
  /** Conversion rates relative to `base`. */
  rates: Partial<Record<CurrencyCode, number>>;
  source: 'manual' | 'bank_of_uganda' | 'central_bank_of_kenya' | 'api';
  fetchedAt?: string;
}

export interface EffectiveFXRate {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  effectiveDate: string;
  source: FXRateSnapshot['source'];
}
