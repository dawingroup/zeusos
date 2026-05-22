/**
 * FX rate service — looks up the effective rate at a given date.
 *
 * Reads `fx_rates/{YYYY-MM-DD}`. Falls back to seeded rates from the
 * finance module (EXCHANGE_RATES_TO_UGX) if the date doc is missing —
 * this keeps the standalone slice working without seeded FX data.
 *
 * Phase 5 wires a real feed (Bank of Uganda / CBK / Open Exchange Rates).
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { EXCHANGE_RATES_TO_UGX } from '@/modules/finance/constants/currency.constants';
import type { CurrencyCode } from '../types/money.types';
import type { EffectiveFXRate, FXRateSnapshot } from '../types/fx-rate.types';
import { COLLECTIONS } from '../constants/collections';

export interface FXLookupOptions {
  /** YYYY-MM-DD; defaults to today. */
  effectiveDate?: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Resolve the rate to convert `from` → `to` using whatever snapshot was
 * in effect on `effectiveDate`. Same-currency lookup short-circuits to
 * 1.0 and never touches Firestore.
 */
export async function getEffectiveRate(
  from: CurrencyCode,
  to: CurrencyCode,
  options: FXLookupOptions = {},
): Promise<EffectiveFXRate> {
  const date = options.effectiveDate ?? today();

  if (from === to) {
    return {
      from,
      to,
      rate: 1,
      effectiveDate: date,
      source: 'manual',
    };
  }

  // Try the Firestore snapshot first.
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.FX_RATES, date));
    if (snap.exists()) {
      const data = snap.data() as FXRateSnapshot;
      const rate = resolveRateFromSnapshot(data, from, to);
      if (rate != null) {
        return {
          from,
          to,
          rate,
          effectiveDate: data.date,
          source: data.source,
        };
      }
    }
  } catch (err) {
    // Firestore unreachable (e.g. offline) — fall through to seeded rates.
    if (typeof console !== 'undefined') {
      console.warn('[fx-rate] Firestore lookup failed, falling back to seed', err);
    }
  }

  // Fallback: cross via UGX using the seeded rate table.
  const rate = crossViaUGX(from, to);
  return {
    from,
    to,
    rate,
    effectiveDate: date,
    source: 'manual',
  };
}

function resolveRateFromSnapshot(
  snapshot: FXRateSnapshot,
  from: CurrencyCode,
  to: CurrencyCode,
): number | null {
  // Snapshot is expressed as "1 base = N quote". Convert via base.
  const fromVsBase = from === snapshot.base ? 1 : snapshot.rates[from];
  const toVsBase   = to === snapshot.base ? 1 : snapshot.rates[to];
  if (fromVsBase == null || toVsBase == null) return null;
  // 1 from = (toVsBase / fromVsBase) to.
  return toVsBase / fromVsBase;
}

function crossViaUGX(from: CurrencyCode, to: CurrencyCode): number {
  const fromToUgx = EXCHANGE_RATES_TO_UGX[from] ?? 1;
  const toToUgx   = EXCHANGE_RATES_TO_UGX[to]   ?? 1;
  // 1 from = fromToUgx UGX = (fromToUgx / toToUgx) to.
  return fromToUgx / toToUgx;
}

/**
 * Apply a rate to a minor-unit amount. Rounds to the nearest integer
 * minor unit — money never carries a fractional minor.
 */
export function convertMinor(
  amountMinor: number,
  rate: number,
): number {
  return Math.round(amountMinor * rate);
}
