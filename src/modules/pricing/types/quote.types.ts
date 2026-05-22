/**
 * Quote — the client-facing priced scope produced by the pricing engine
 * (`priceQuote`, Phase 3.C). The **only** number reaching the client is
 * `clientTotalMinor`; the underlying per-subsidiary `costMinor` is
 * INTERNAL and field-guarded in firestore.rules.
 *
 * Spec §3.1 / §4.3 / §6.2 / §8.1.
 *
 * Quote state machine: DRAFT → ISSUED → ACCEPTED. ACCEPTED quotes unlock
 * MasterJob creation. VOID is a terminal off-ramp.
 *
 * Lives at:
 *   organizations/{orgId}/quotes/{quoteId}
 *     ├── quote_lines/{lineId}   ← subcollection
 *
 * INVARIANT (spec §8.1): every `Quote.clientTotalMinor` must satisfy
 *   (clientTotal - cost) / clientTotal >= margin_floor_pct
 * (default 25%). Enforced by the pricing engine; subsidiaries cannot
 * issue, accept, or void quotes.
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';
import type { RateCardUnit } from './rate-card.types';

export type QuoteStatus = 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'VOID';

export interface Quote {
  id: string;
  sowId: string;
  /** Denormalised client id for fast list rendering. */
  clientId: string;
  /** Short human-friendly code: e.g. `Q-DIAGEO-SMIRNOFF-2026-Q2-001`. */
  code: string;
  status: QuoteStatus;
  /** The ONLY client-facing number. Minor units, ISO currency. */
  clientTotalMinor: number;
  /** Sum of `costMinor` across lines — INTERNAL; field-guarded in rules so
   *  subsidiary principals cannot project it. */
  totalCostMinor: number;
  /** Multi-currency expansion deferred to Phase 3.F. */
  currency: 'UGX' | 'KES' | 'USD';
  /** Minimum gross margin (% of clientTotal) this quote must carry. Default
   *  25%. Stored per-quote because policy may evolve; pricing engine
   *  copies it from `governedMarkupPolicy` at issue time. */
  marginFloorPct: number;
  /** Margin at issue: (clientTotal − totalCost) / clientTotal × 100.
   *  Captured so the dashboard can render historic margin even after rates
   *  change. */
  marginPctAtIssue?: number;
  /** Spec §11.8 — pinned rate-card versions by subsidiary so in-flight
   *  pricing references the version effective at quote creation, even if
   *  the subsidiary publishes a newer card mid-engagement. */
  pinnedRateCardIdsBySubsidiary?: Partial<Record<SubsidiaryId, string>>;
  /** When this quote was issued to the client. */
  issuedAt?: Timestamp | string;
  issuedByUserId?: string;
  /** Set if the issuer asserted `MARGIN_FLOOR_OVERRIDE` to issue below
   *  floor. The reason is also persisted to the audit log. */
  marginFloorOverride?: {
    by: string;
    reason: string;
    at: Timestamp | string;
  };
  acceptedAt?: Timestamp | string;
  acceptedBy?: string;
  acceptedByClientName?: string;
  voidedAt?: Timestamp | string;
  voidedReason?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}

export interface QuoteLine {
  id: string;
  quoteId: string;
  subsidiaryOrgId: SubsidiaryId;
  /** Pinned reference to the rate-card line that supplied `costMinor`.
   *  Quotes immortalise the rate-card version at issue time so a
   *  mid-engagement card change cannot retroactively reprice work
   *  (spec §11.8). */
  rateCardLineId: string;
  rateCardId: string;
  /** Captured at pricing time so the QuoteBuilder can render the line
   *  back to the AM without re-resolving against the live card. INTERNAL —
   *  exposed only to PARENT-org principals. */
  roleCode: string;
  unit: RateCardUnit;
  /** Free-text line description — client-facing (shown on the quote PDF
   *  and the consolidated client invoice line). MUST NOT reveal
   *  subsidiary identity, cost basis, or markup. Defaulted from
   *  `roleCode` + unit unless the AM overrides it. */
  description: string;
  /** Quantity in `RateCardLine.unit` (hours, days, units, etc.). */
  qty: number;
  /** INTERNAL — subsidiary cost basis × qty in minor units. Never
   *  exposed to client views, APIs, or invoices. Field-guarded in
   *  firestore.rules. */
  costMinor: number;
  /** Governed markup applied by the pricing engine. */
  markupPct: number;
  /** Client-facing line total = round(costMinor × (1 + markupPct/100)).
   *  Sum across lines = `Quote.clientTotalMinor`. */
  clientMinor: number;
  currency: 'UGX' | 'KES' | 'USD';
}

/** Input shape `priceQuote(sowId, lines[])` accepts from the QuoteBuilder
 *  UI. Cost + client_minor are derived; the AM only chooses subsidiary +
 *  role + unit + qty (+ optional client-facing description override). */
export interface QuoteLineInput {
  subsidiaryOrgId: SubsidiaryId;
  roleCode: string;
  unit: RateCardUnit;
  qty: number;
  /** Optional override; defaults to a generic client-friendly label
   *  derived from `roleCode`+`unit` if the AM doesn't provide one. */
  description?: string;
}

/** Result of `priceQuote` *before* persistence. Re-used by the QuoteBuilder
 *  preview pane and by `issueQuote`'s margin re-check. */
export interface PricedQuote {
  sowId: string;
  currency: 'UGX' | 'KES' | 'USD';
  lines: Array<{
    subsidiaryOrgId: SubsidiaryId;
    rateCardId: string;
    rateCardLineId: string;
    roleCode: string;
    unit: RateCardUnit;
    qty: number;
    description: string;
    costMinor: number;
    markupPct: number;
    clientMinor: number;
  }>;
  totalCostMinor: number;
  totalClientMinor: number;
  marginPct: number;
  marginFloorPct: number;
  /** True iff `marginPct >= marginFloorPct`. When false, `issueQuote`
   *  rejects with `MARGIN_BELOW_FLOOR` unless the caller passed an
   *  explicit `overrideFloor` payload. */
  meetsFloor: boolean;
}
