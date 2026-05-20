/**
 * CustomerContact — P11 (F8 — Contact normalization in finishes).
 *
 * Mirrors the advisory `Contact` pattern: a top-level Firestore collection
 * keyed by `customerId`, rather than the embedded `Customer.contacts:
 * ContactPerson[]` array. Readers / writers migrate incrementally; the
 * legacy embedded array stays in place during the rollout as the
 * back-compat surface.
 *
 * P11 rollout (same additive shape as P8):
 *   P11-1 (this file) — type + collection constant + converters.
 *   P11-2 — service (CRUD + subscribe by customerId).
 *   P11-3 — writers: CustomerForm + customerService.createCustomer
 *           mirror embedded ContactPerson[] into the new collection.
 *   P11-4 — readers migrate (CRM pickers, activity forms) to the new
 *           collection; `contactPersonId` added to CRMActivity / CRMTask.
 *   P11-5 — drop the embedded array once all surfaces are on the new
 *           collection (needs backfill + rules update).
 */
import type { Timestamp } from 'firebase/firestore';
import type { ContactPerson, ContactRole } from './index';

/**
 * Top-level Firestore collection name for normalized customer contacts.
 * Scoped to the finishes subsidiary today. (Advisory uses its own
 * `contacts` collection — intentionally separate since the role enum
 * differs; see P11 plan notes.)
 */
export const CUSTOMER_CONTACTS_COLLECTION = 'customerContacts';

/**
 * Canonical customer-contact record.
 *
 * Shape notes:
 * - `name` is a single string (matches legacy `ContactPerson.name`). We
 *   deliberately do NOT split into firstName/lastName yet — the legacy
 *   embedded rows only carry `name`, so a split would need a best-effort
 *   parser. Advisory's `Contact` splits because its own writers have
 *   always populated both; finishes hasn't.
 * - `isActive` defaults to true on create; explicit `false` soft-
 *   deletes without removing cross-module references (activities, tasks).
 * - `createdAt` / `updatedAt` are required metadata on the collection;
 *   when converting FROM a legacy embedded ContactPerson (which has no
 *   timestamps), the converter stamps `null` placeholders and leaves
 *   stamping to the writer.
 */
export interface CustomerContact {
  id: string;

  /** FK to parent `Customer`. */
  customerId: string;

  // Identity
  name: string;
  title?: string;
  department?: string;

  // Role within the customer organisation
  role?: ContactRole;

  // Contact channels
  email?: string;
  phone?: string;
  mobile?: string;

  /** Free-text notes visible to sales / ops users. */
  notes?: string;

  /**
   * Exactly one contact per customer should have `isPrimary = true`.
   * The writer layer (P11-2) enforces that invariant; the type itself
   * doesn't — consumers should fall back to the most recent contact
   * when none is marked primary (matches current ContactPerson UX).
   */
  isPrimary: boolean;

  /**
   * Soft-delete flag. Omitted (undefined) is treated as active — the
   * finishes `Customer.contacts` array has no such flag, so legacy
   * rows converted via `contactPersonToCustomerContact` leave it unset.
   */
  isActive?: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Form payload for creating a new customer contact. The writer stamps
 * id / customerId / timestamps; caller supplies the editable fields.
 */
export type CustomerContactFormData = Omit<
  CustomerContact,
  'id' | 'customerId' | 'createdAt' | 'updatedAt'
>;

/**
 * Lightweight reference surface for UI pickers and denormalized caches
 * (e.g. CRMActivity.contactPersonName). Mirrors advisory's `ContactRef`.
 */
export interface CustomerContactRef {
  id: string;
  customerId: string;
  name: string;
  email?: string;
  phone?: string;
  role?: ContactRole;
  isPrimary: boolean;
}

export function toCustomerContactRef(contact: CustomerContact): CustomerContactRef {
  return {
    id: contact.id,
    customerId: contact.customerId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone ?? contact.mobile,
    role: contact.role,
    isPrimary: contact.isPrimary,
  };
}

/**
 * Convert a legacy embedded `ContactPerson` into the new shape.
 *
 * Used during P11-3 when the writer layer starts mirroring embedded
 * entries into the new collection. Returns the form-data payload (no
 * id / timestamps) so the writer stays in control of stamping.
 *
 * Lossless for every field the legacy shape carries; adds no new
 * defaults except preserving `isPrimary` (required on both sides).
 */
export function contactPersonToCustomerContactData(
  person: ContactPerson,
): CustomerContactFormData {
  return {
    name: person.name,
    title: person.title,
    department: person.department,
    role: person.role,
    email: person.email,
    phone: person.phone,
    mobile: person.mobile,
    notes: person.notes,
    isPrimary: person.isPrimary,
  };
}

/**
 * Convert a `CustomerContact` BACK to the embedded `ContactPerson`
 * shape — used by the P11-4 reader migration when a consumer still
 * expects the legacy array (e.g. Customer profile cards not yet
 * migrated). Drops `customerId`, `isActive`, and timestamps since the
 * embedded shape has no slot for them.
 */
export function customerContactToContactPerson(
  contact: CustomerContact,
): ContactPerson {
  return {
    id: contact.id,
    name: contact.name,
    title: contact.title,
    department: contact.department,
    role: contact.role,
    email: contact.email,
    phone: contact.phone,
    mobile: contact.mobile,
    notes: contact.notes,
    isPrimary: contact.isPrimary,
  };
}

// ---------------------------------------------------------------------------
// Reader migration helpers (P11-5) — read with FK-preference, fall back
// ---------------------------------------------------------------------------

/**
 * Minimal shape an activity/task row exposes for contact resolution.
 * CRMActivity and SalesTask both carry `contactPersonId?` (P11-4 FK)
 * and `contactPersonName?` (legacy denormalized cache). New rows set
 * both; legacy rows may carry only the name, or neither.
 */
export interface ContactPersonBearingEntity {
  contactPersonId?: string;
  contactPersonName?: string;
}

/**
 * Tri-state resolution result:
 *   - `{ kind: 'id', ... }`  — modern row with the normalized FK. Use
 *                              the id for joins / collection lookups
 *                              via `getCustomerContact()`; the name is
 *                              a denormalized display cache (may be stale).
 *   - `{ kind: 'name', ... }` — legacy row pre-P11-4: no FK, only a
 *                              free-text name. Fall back to embedded-
 *                              array lookup via `findContactInEmbedded`,
 *                              or just render the text as-is.
 *   - `null`                  — neither signal present. Row has no
 *                              contact attribution; readers should
 *                              render "—" or similar.
 */
export type ResolvedContactPerson =
  | { kind: 'id'; contactPersonId: string; contactPersonName?: string }
  | { kind: 'name'; contactPersonName: string }
  | null;

/**
 * Pick the strongest contact signal on an activity/task row. Prefers
 * the FK (exact join) over the free-text name (best-effort fuzzy).
 *
 * Pure / synchronous — does NOT fetch. Callers that need the full
 * contact record must follow up with `getCustomerContact(id)` (for the
 * id branch) or `findContactInEmbedded(customer.contacts, resolved)`
 * (for the name branch, against the legacy embedded array).
 *
 * Single place to update when P11-6 drops the legacy `contactPersonName`
 * path — parallels how `resolveParty` centralizes the legacy
 * `customerId` fallback for P8-4.
 */
export function resolveContactPerson(
  entity: ContactPersonBearingEntity,
): ResolvedContactPerson {
  if (entity.contactPersonId) {
    return {
      kind: 'id',
      contactPersonId: entity.contactPersonId,
      contactPersonName: entity.contactPersonName,
    };
  }
  if (entity.contactPersonName) {
    return { kind: 'name', contactPersonName: entity.contactPersonName };
  }
  return null;
}

/**
 * Find a contact inside the legacy `Customer.contacts` embedded array
 * using the output of `resolveContactPerson`. Used by readers that
 * haven't moved to the normalized collection yet — they already have
 * the `Customer` doc in hand (loaded for the row's other fields) and
 * want to render title/email/role from the embedded entry.
 *
 * Matches by id first (strict), then by case-insensitive name
 * (best-effort — the embedded array has no FK, so name collisions
 * between two contacts resolve to the first match). Returns null when
 * `resolved` is null or no entry matches.
 *
 * Case-insensitive name match deliberately avoids trimming / accent-
 * folding — the embedded writer (CustomerForm) already trims on save,
 * and we don't want silent over-matching.
 */
export function findContactInEmbedded(
  contacts: ContactPerson[] | undefined,
  resolved: ResolvedContactPerson,
): ContactPerson | null {
  if (!resolved || !contacts || contacts.length === 0) return null;
  if (resolved.kind === 'id') {
    return contacts.find((c) => c.id === resolved.contactPersonId) ?? null;
  }
  const target = resolved.contactPersonName.toLowerCase();
  return contacts.find((c) => c.name.toLowerCase() === target) ?? null;
}
