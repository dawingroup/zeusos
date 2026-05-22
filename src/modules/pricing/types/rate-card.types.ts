/**
 * RateCard — per-subsidiary cost rates by role / unit. Versioned and
 * effective-dated so that quotes and IWOs pin the version active at quote
 * time (spec §11.8 — rate card changes mid-engagement). New rates only
 * apply to IWOs issued after the new card's effective date.
 *
 * Spec §3.1 / §4.3 / §8.1.
 *
 * Lives at:
 *   organizations/{orgId}/rate_cards/{rateCardId}
 *     ├── rate_card_lines/{lineId}    ← subcollection
 *
 * CRITICAL: `costMinor` on `RateCardLine` is INTERNAL. Spec schema
 * invariant (§4.5 box) — "No client-facing view, API serializer or invoice
 * line may project them." Subsidiary-org users **cannot read** lines
 * containing costMinor; this is enforced in firestore.rules with a
 * field-level guard. The pricing engine (Phase 3.C) is the only consumer
 * that resolves costMinor against governed markup to produce client_minor.
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';

export type RateCardStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED';

export type RateCardUnit = 'HOUR' | 'DAY' | 'UNIT' | 'PASS_THROUGH';

export interface RateCard {
  id: string;
  /** The subsidiary whose internal cost basis this card represents. */
  orgId: SubsidiaryId;
  /** Monotonic per-subsidiary version. `(orgId, version)` is unique. */
  version: number;
  /** Stamped by `activateRateCard(rateCardId, effectiveFrom)`. DRAFT cards
   *  may not yet have one. */
  effectiveFrom?: Timestamp | string;
  /** Set automatically when a successor version activates (one day before
   *  the successor's `effectiveFrom`), or by `retireRateCard`. */
  effectiveTo?: Timestamp | string;
  status: RateCardStatus;
  notes?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface RateCardLine {
  id: string;
  /** Foreign key to the parent rate card (also encoded in the doc path,
   *  duplicated here for collection-group queries). */
  rateCardId: string;
  unit: RateCardUnit;
  /** Role code keyed by the pricing lookup, e.g. `SR_DESIGNER`,
   *  `ART_DIRECTOR`, `MEDIA_BUYER`. Combined with `unit` to resolve cost.
   *  PASS_THROUGH lines may use a synthetic code like `PASS_THROUGH`. */
  roleCode: string;
  /** Free-text description shown only in admin UI — never client-facing. */
  description?: string;
  /** INTERNAL — subsidiary cost basis in minor units. Never exposed to
   *  client-facing views, APIs, or invoices. See file header. */
  costMinor: number;
  /** Multi-currency expansion is deferred to Phase 3.F; for 3.C every card
   *  is single-currency and matches the subsidiary's base. */
  currency: 'UGX' | 'KES' | 'USD';
}
