/**
 * Pricing & Rate-Card bounded context.
 *
 * Owns: cost rate cards, markup, quotes.
 * Must never: expose cost rates to the client.
 *
 * Per spec §1.3 / §8.1 — only the pricing engine, invoked by an
 * Account-Management actor, may compute a client-facing price. The schema
 * invariant on `cost_minor` is enforced in firestore.rules (subsidiary
 * users cannot read fields projecting `costMinor`) and in the Phase 3.C
 * pricing engine code path.
 *
 * PHASE 3.A.5 PLACEHOLDER: the `__stub__/` directory carries the minimum
 * SOW/MasterJob shapes this module needs. When 3.A.5 lands, drop the stub
 * directory and re-import from the canonical `contracts` / `assignment`
 * modules.
 */

export type {
  RateCard,
  RateCardLine,
  RateCardStatus,
  RateCardUnit,
  Quote,
  QuoteLine,
  QuoteLineInput,
  QuoteStatus,
  PricedQuote,
} from './types';

export {
  MARGIN_FLOOR_DEFAULT_PCT,
  MARGIN_AMBER_BAND_PP,
  bandForMargin,
  QUOTE_STATUSES,
  QUOTE_TRANSITIONS,
  QUOTE_STATUS_META,
  canTransitionQuote,
  RATE_CARD_STATUSES,
  RATE_CARD_TRANSITIONS,
  RATE_CARD_STATUS_META,
  canTransitionRateCard,
} from './constants';
export type { MarginBand } from './constants';

export { MarginBadge } from './components/MarginBadge';

export {
  computePricedQuote,
  PricingError,
} from './services/computePricing';
export type { RateLookup, MarkupLookup, RateLookupResult } from './services/computePricing';

export {
  nextVersion,
  planActivation,
  autoRetireEffectiveTo,
  RateCardError,
} from './services/rateCardVersioning';
