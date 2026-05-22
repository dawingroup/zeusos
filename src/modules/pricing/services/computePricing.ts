/**
 * Pure pricing compute — spec §8.1 (authoritative pseudocode).
 *
 *   function priceQuote(sowId, lines):
 *     for line in lines:
 *       rc   = activeRateCard(line.subsidiaryOrgId, asOf=today)
 *       cost = rc.lookup(line.roleCode, line.unit).cost_minor * line.qty
 *       markup = markupPolicy(line.subsidiaryOrgId, sow.client)
 *       line.cost_minor   = cost
 *       line.markup_pct   = markup
 *       line.client_minor = round(cost * (1 + markup/100))
 *     total_cost   = sum(l.cost_minor)
 *     total_client = sum(l.client_minor)
 *     margin_pct   = (total_client - total_cost) / total_client * 100
 *     assert margin_pct >= quote.margin_floor_pct      # else require override
 *     return Quote(client_total_minor = total_client) # cost NOT exposed
 *
 * This module is the canonical implementation: the Cloud Function shells
 * out to it via its CommonJS twin in `functions/src/pricing/lib/computePricing.js`
 * (kept byte-for-byte identical so unit tests on either side prove the
 * same behaviour). Keep both in sync.
 *
 * The compute is *pure* — it takes a rate-card lookup function and a
 * markup-policy lookup function as injected dependencies, so unit tests
 * don't need Firestore.
 */

import type { SubsidiaryId } from '@/core/settings/types';
import type {
  PricedQuote,
  QuoteLineInput,
} from '../types/quote.types';
import type { RateCardUnit } from '../types/rate-card.types';
import { MARGIN_FLOOR_DEFAULT_PCT } from '../constants/floors';

/** Result of a (subsidiary × roleCode × unit) lookup against an active
 *  rate-card line. The pricing engine reads `costMinor` here; the
 *  rate-card identity is captured so the produced QuoteLine can pin it
 *  per §11.8. */
export interface RateLookupResult {
  rateCardId: string;
  rateCardLineId: string;
  costMinor: number;
  currency: 'UGX' | 'KES' | 'USD';
}

export type RateLookup = (args: {
  subsidiaryOrgId: SubsidiaryId;
  roleCode: string;
  unit: RateCardUnit;
}) => RateLookupResult;

export type MarkupLookup = (args: {
  subsidiaryOrgId: SubsidiaryId;
  clientId: string;
}) => number;

export class PricingError extends Error {
  constructor(public readonly code: string, message: string, public readonly detail?: unknown) {
    super(`[${code}] ${message}`);
    this.name = 'PricingError';
  }
}

export interface PriceQuoteArgs {
  sowId: string;
  clientId: string;
  lines: QuoteLineInput[];
  marginFloorPct?: number;
  lookupRate: RateLookup;
  lookupMarkup: MarkupLookup;
}

export function computePricedQuote(args: PriceQuoteArgs): PricedQuote {
  const {
    sowId,
    clientId,
    lines,
    marginFloorPct = MARGIN_FLOOR_DEFAULT_PCT,
    lookupRate,
    lookupMarkup,
  } = args;

  if (!lines.length) {
    throw new PricingError('EMPTY_QUOTE', 'A quote must have at least one line.');
  }

  let totalCostMinor = 0;
  let totalClientMinor = 0;
  let currency: 'UGX' | 'KES' | 'USD' | null = null;

  const priced = lines.map((line, idx) => {
    if (line.qty <= 0) {
      throw new PricingError('INVALID_QTY', `Line ${idx + 1}: qty must be > 0 (got ${line.qty}).`);
    }
    const rate = lookupRate({
      subsidiaryOrgId: line.subsidiaryOrgId,
      roleCode: line.roleCode,
      unit: line.unit,
    });
    if (currency === null) {
      currency = rate.currency;
    } else if (currency !== rate.currency) {
      // Multi-currency engagements are 3.F scope. Reject mixed currency here
      // so we never persist a quote whose lines disagree.
      throw new PricingError(
        'MIXED_CURRENCY',
        `Line ${idx + 1}: currency ${rate.currency} mixes with quote currency ${currency}. ` +
          `Multi-currency quotes are deferred to Phase 3.F.`,
      );
    }
    const costMinor = rate.costMinor * line.qty;
    const markupPct = lookupMarkup({
      subsidiaryOrgId: line.subsidiaryOrgId,
      clientId,
    });
    const clientMinor = Math.round(costMinor * (1 + markupPct / 100));
    totalCostMinor += costMinor;
    totalClientMinor += clientMinor;
    return {
      subsidiaryOrgId: line.subsidiaryOrgId,
      rateCardId: rate.rateCardId,
      rateCardLineId: rate.rateCardLineId,
      roleCode: line.roleCode,
      unit: line.unit,
      qty: line.qty,
      description: line.description ?? defaultLineDescription(line.roleCode, line.unit, line.qty),
      costMinor,
      markupPct,
      clientMinor,
    };
  });

  const marginPct = totalClientMinor > 0
    ? ((totalClientMinor - totalCostMinor) / totalClientMinor) * 100
    : 0;
  const meetsFloor = marginPct >= marginFloorPct;

  return {
    sowId,
    currency: currency ?? 'UGX',
    lines: priced,
    totalCostMinor,
    totalClientMinor,
    marginPct,
    marginFloorPct,
    meetsFloor,
  };
}

function defaultLineDescription(roleCode: string, unit: RateCardUnit, qty: number): string {
  const friendly = roleCode
    .toLowerCase()
    .split('_')
    .map(part => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
  const unitWord = unit === 'PASS_THROUGH' ? 'pass-through' : unit.toLowerCase() + (qty === 1 ? '' : 's');
  return `${friendly} — ${qty} ${unitWord}`;
}
