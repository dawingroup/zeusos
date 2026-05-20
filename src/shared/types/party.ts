/**
 * Party — shared cross-subsidiary abstraction (P8/F1).
 *
 * The data-model audit (F1) flagged that the advisory subsidiary uses
 * `Client` + `clientId` while finishes uses `Customer` + `customerId`,
 * with no shared FK. Cross-module entities (SalesOrder, CRMActivity,
 * and the advisory→finishes bridge in `cross-module-service.ts`) have
 * to pick one vocabulary and lose information when the party actually
 * lives in the other subsidiary.
 *
 * This file introduces an ADDITIVE abstraction rather than a renaming.
 * A `PartyRef` is a `{ partyId, partyKind }` pair that unambiguously
 * identifies which collection the party lives in:
 *
 *   partyKind: 'advisory_client'    →  advisory `clients/{partyId}`
 *   partyKind: 'finishes_customer'  →  `customers/{partyId}`
 *
 * Roll-out plan (tracked in the audit plan as P8):
 *   P8-1 (this file)    — add types + conversion helpers, no consumers
 *   P8-2               — add optional `party: PartyRef` to cross-module
 *                        entities (SalesOrder, CRMActivity, CRMDeal).
 *                        Writers populate both the legacy field AND the
 *                        new one so readers can migrate independently.
 *   P8-3               — migrate readers to prefer `party` over the
 *                        legacy fields.
 *   P8-4               — drop legacy `customerId`/`clientId` once every
 *                        caller is on `party`.
 *
 * Kept pure (no Firestore imports, no subsidiary imports) so it's safe
 * to import from anywhere and trivial to test.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Which subsidiary's collection the party id resolves to.
 *
 * Deliberately NOT an enum of "customer types" — kind is about storage
 * location (advisory vs. finishes), not about whether the party is an
 * individual vs. organization. Those classifications live on the source
 * record (`Client.type`, `Customer.type`) and aren't duplicated here.
 */
export type PartyKind = 'advisory_client' | 'finishes_customer';

/**
 * Minimal cross-module FK. Store this on any entity that needs to
 * point at a party regardless of which subsidiary owns it. Readers
 * branch on `partyKind` to fetch from the right collection.
 *
 * Named `partyId`/`partyKind` rather than `id`/`kind` so the object
 * composes cleanly onto host documents without collisions (e.g.
 * SalesOrder already has its own `id`).
 */
export interface PartyRef {
  partyId: string;
  partyKind: PartyKind;
}

/**
 * Denormalized display-layer data for a party, suitable for lists,
 * badges, and cross-module surfaces that don't want to hit both
 * collections to show a name. Hosts should refresh this on link and
 * on an occasional reconciliation pass; it is not kept live in sync.
 *
 * Kept narrow — any UI that needs more (addresses, KYC, contacts)
 * should resolve the full source record via a service call. This
 * summary is the "name on a row" contract only.
 */
export interface PartySummary extends PartyRef {
  /** Display name (Client.displayName or Customer.name). */
  name: string;
  /** Optional primary email if the source record has one. */
  email?: string;
  /** Optional primary phone. */
  phone?: string;
}

/**
 * Human-readable labels for the party kind. Use on badges and filters.
 */
export const PARTY_KIND_LABELS: Record<PartyKind, string> = {
  advisory_client: 'Advisory Client',
  finishes_customer: 'Finishes Customer',
};

/**
 * Short labels — prefer these on dense table cells.
 */
export const PARTY_KIND_SHORT_LABELS: Record<PartyKind, string> = {
  advisory_client: 'Advisory',
  finishes_customer: 'Finishes',
};

// ---------------------------------------------------------------------------
// Constructors + equality
// ---------------------------------------------------------------------------

/**
 * Build a `PartyRef` from a raw id + kind. Trivial, but the function
 * form lets call sites be explicit about which subsidiary they mean
 * and leaves a single spot to add validation later (e.g. id format
 * checks per kind).
 */
export function partyRef(kind: PartyKind, id: string): PartyRef {
  return { partyId: id, partyKind: kind };
}

/**
 * Equality on PartyRef. Two refs are equal iff both id and kind match.
 * IMPORTANT: matching ids across kinds are NOT equal — a Client with
 * id `'abc'` and a Customer with id `'abc'` are distinct parties.
 */
export function partyRefEquals(a: PartyRef | null | undefined, b: PartyRef | null | undefined): boolean {
  if (!a || !b) return a === b;
  return a.partyId === b.partyId && a.partyKind === b.partyKind;
}

/**
 * Stable string key for Sets/Maps. Format: `${kind}:${id}`. The colon
 * is safe because neither kind value nor Firestore ids can contain it.
 */
export function partyRefKey(ref: PartyRef): string {
  return `${ref.partyKind}:${ref.partyId}`;
}

/**
 * Parse a key produced by `partyRefKey` back into a PartyRef. Returns
 * null if the key is malformed OR the kind segment isn't a known kind.
 * Useful for deserializing from URL state / Firestore doc ids that
 * embed the ref.
 */
export function parsePartyRefKey(key: string): PartyRef | null {
  const sep = key.indexOf(':');
  if (sep <= 0 || sep === key.length - 1) return null;
  const kind = key.slice(0, sep);
  const id = key.slice(sep + 1);
  if (!isPartyKind(kind)) return null;
  return { partyId: id, partyKind: kind };
}

/**
 * Runtime type guard. Handy when reading denormalized refs back from
 * Firestore where the type system can't prove the value is narrow.
 */
export function isPartyKind(value: unknown): value is PartyKind {
  return value === 'advisory_client' || value === 'finishes_customer';
}

/**
 * Structural check: does `value` carry the shape of a PartyRef?
 * Used when reading JSON back from Firestore or URL state.
 */
export function isPartyRef(value: unknown): value is PartyRef {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.partyId === 'string' && isPartyKind(v.partyKind);
}

// ---------------------------------------------------------------------------
// Structural converters — intentionally typed against minimal shapes
// ---------------------------------------------------------------------------

/**
 * Minimal shape a Customer-like value needs to be convertible. We type
 * structurally (rather than importing `Customer` from customer-hub) so
 * this module stays cycle-free and can be imported from any layer.
 *
 * All fields optional to tolerate partial DTOs; `name` must be derivable
 * for the summary case.
 */
export interface CustomerLike {
  id?: string;
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
}

/**
 * Minimal shape a Client-like value needs to be convertible. Same
 * structural-typing rationale as `CustomerLike`.
 */
export interface ClientLike {
  id?: string;
  displayName?: string;
  legalName?: string;
  email?: string;
  phone?: string;
}

/** Build a ref pointing at an advisory Client. Returns null if id missing. */
export function clientToPartyRef(client: ClientLike): PartyRef | null {
  if (!client.id) return null;
  return { partyId: client.id, partyKind: 'advisory_client' };
}

/** Build a ref pointing at a finishes Customer. Returns null if id missing. */
export function customerToPartyRef(customer: CustomerLike): PartyRef | null {
  if (!customer.id) return null;
  return { partyId: customer.id, partyKind: 'finishes_customer' };
}

/**
 * Build a display-summary for an advisory Client. Prefer `displayName`
 * then `legalName`, then fall back to the id so the UI has SOMETHING
 * to render even on a half-constructed record.
 */
export function clientToPartySummary(client: ClientLike): PartySummary | null {
  const ref = clientToPartyRef(client);
  if (!ref) return null;
  return {
    ...ref,
    name: client.displayName || client.legalName || ref.partyId,
    email: client.email,
    phone: client.phone,
  };
}

/**
 * Build a display-summary for a finishes Customer. Prefer `name`
 * (Customer's primary display field) then `displayName` (not typically
 * set, but tolerated), then id.
 */
export function customerToPartySummary(customer: CustomerLike): PartySummary | null {
  const ref = customerToPartyRef(customer);
  if (!ref) return null;
  return {
    ...ref,
    name: customer.name || customer.displayName || ref.partyId,
    email: customer.email,
    phone: customer.phone,
  };
}

// ---------------------------------------------------------------------------
// Reader migration helper (P8-3) — read with party-preference, fall back
// ---------------------------------------------------------------------------

/**
 * Minimal shape a cross-module entity needs to be "resolvable" to a
 * PartyRef under the P8 rollout. The fields match what CRMDeal,
 * CRMActivity, and SalesOrder carry:
 *
 *   - Post-P8-2 rows: `party` is populated. Use it verbatim.
 *   - Pre-P8-2 rows:  `party` is undefined. Fall back to
 *                     `{ partyKind: 'finishes_customer', partyId: customerId }`
 *                     since every CRMDeal / CRMActivity / SalesOrder that
 *                     predates P8-2 originates from the finishes module.
 *
 * The fallback is deliberate: P8-2 writers default `partyKind` to
 * `'finishes_customer'`, and there is no writer that ever stamped an
 * advisory kind on a legacy row. So interpreting a legacy `customerId`
 * as `finishes_customer` is lossless today and makes readers safe to
 * migrate without waiting for a backfill.
 */
export interface PartyBearingEntity {
  party?: PartyRef;
  customerId?: string;
}

/**
 * Resolve a cross-module entity to its party ref. Returns null when
 * neither `party` nor `customerId` is set (a structurally invalid row —
 * readers should ignore it).
 *
 * Single call site for the legacy-row fallback, so when P8-4 finally
 * drops the legacy fields this is the ONE place that needs updating.
 */
export function resolveParty(entity: PartyBearingEntity): PartyRef | null {
  if (entity.party && isPartyRef(entity.party)) return entity.party;
  if (entity.customerId) {
    return { partyId: entity.customerId, partyKind: 'finishes_customer' };
  }
  return null;
}
