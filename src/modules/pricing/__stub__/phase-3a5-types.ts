/**
 * PHASE 3.A.5 PLACEHOLDER — DO NOT EXTEND.
 *
 * This file is a *minimum* stub of the domain types Phase 3.A.5 (Domain
 * re-model) will introduce. The Phase 3.C work (Pricing engine + Quote
 * builder) was unblocked by carving out just the shapes it needs and
 * concentrating them here so the eventual 3.A.5 PR has one obvious file to
 * replace.
 *
 * When 3.A.5 lands:
 *   1. Move these shapes into `src/modules/contracts/types/` (SOW,
 *      ChangeOrder), `src/modules/pricing/types/` (RateCard, Quote — already
 *      present), and `src/modules/assignment/types/` (MasterJob).
 *   2. Re-point every importer of this file to the canonical module path.
 *   3. Delete this directory.
 *
 * Tracked in plan §14.13.0 dependency graph — 3.A.5 is the prerequisite for
 * every downstream phase (3.B / 3.C / 3.E).
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';

// ─────────────────────────────────────────────────────────────────
// SOW (Statement of Work) — abbreviated per spec §6.2
// ─────────────────────────────────────────────────────────────────

export type SOWStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

/** Minimum SOW shape that `priceQuote` needs to read. The 3.A.5 spec at
 *  §4.2 will expand this — msa_id, client_id, scope_md, ceiling_minor,
 *  effective_from / effective_to, named-approver fields. */
export interface SOWStub {
  id: string;
  /** Foreign key to the client (added in 3.A.5). For now the QuoteBuilder
   *  treats this as opaque — it's only used to resolve a markup policy. */
  clientId: string;
  status: SOWStatus;
  /** Spec §8.2: SOW ceiling is the immovable cap on total allocation.
   *  `priceQuote` does NOT consult it; it's checked in `issueWorkOrder`
   *  (Phase 3.B). Listed here only so MarginBadge tests can exercise the
   *  ceiling-near-breach UI surface in 3.D. */
  ceilingMinor: number;
  currency: 'UGX' | 'KES' | 'USD';
}

// ─────────────────────────────────────────────────────────────────
// MasterJob — header reference only (3.A.5 / 3.D will own the rest)
// ─────────────────────────────────────────────────────────────────

/** Pointer type. The MasterJob is opened by the 3.D consumer of
 *  `QuoteAccepted`; this module only stamps the id onto the Quote. */
export interface MasterJobRef {
  id: string;
  code: string;
}

// ─────────────────────────────────────────────────────────────────
// Markup policy (3.A.5 §8.1 — governed)
// ─────────────────────────────────────────────────────────────────

/** Per-subsidiary, per-client governed markup. Plan §14.15 question 1
 *  ("who edits governedMarkupPolicy") is still open — until that lands,
 *  the stub policy is a flat table baked into `markupPolicy.stub.ts`. */
export interface MarkupPolicyEntry {
  subsidiaryId: SubsidiaryId;
  /** `'*'` matches any client. Per-client overrides are written before the
   *  wildcard so the first match wins. */
  clientId: string | '*';
  markupPct: number;
}

// ─────────────────────────────────────────────────────────────────
// Domain event helpers (3.A.5 §4.5 — append-only outbox)
// ─────────────────────────────────────────────────────────────────

/** Outbox event the lifecycle CFns emit. 3.A.5 will introduce the canonical
 *  `domain_events/{eventId}` collection + dispatcher; this stub captures
 *  what the pricing CFns write today so the 3.D consumer of
 *  `QuoteAccepted` has a stable contract. */
export interface DomainEventStub {
  type: 'QuoteIssued' | 'QuoteAccepted' | 'QuoteVoided' | 'RateCardActivated' | 'RateCardRetired';
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: Timestamp | string;
  emittedBy: string;
}
