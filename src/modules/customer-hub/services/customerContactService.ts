/**
 * customerContactService — P11-2 (F8 — Contact normalization).
 *
 * Firestore CRUD + subscribe for the top-level `customerContacts`
 * collection introduced in P11-1. Nothing else in the app calls this
 * yet — writers start wiring up in P11-3 (CustomerForm mirroring),
 * readers in P11-4 (CRM pickers). Kept intentionally narrow: the UI
 * layer hasn't moved, so there's no need for richer querying /
 * pagination primitives today.
 *
 * Invariants this service enforces:
 *   - `customerId` and timestamps are stamped by the service, never
 *     by callers. Callers pass `CustomerContactFormData`.
 *   - At most one contact per customer carries `isPrimary: true`.
 *     `setPrimaryCustomerContact` is the only approved way to toggle
 *     that flag — it unsets every sibling's flag atomically via a
 *     single `writeBatch` commit. `create` / `update` accept an
 *     `isPrimary` field for the initial stamp but do NOT sweep
 *     siblings; callers that need the sweep should follow up with
 *     `setPrimaryCustomerContact`. That split keeps simple writes
 *     simple and makes the batched path explicit at the call-site.
 */
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { ContactPerson } from '../types';
import {
  CUSTOMER_CONTACTS_COLLECTION,
  contactPersonToCustomerContactData,
  type CustomerContact,
  type CustomerContactFormData,
} from '../types/customerContact';

const contactsRef = collection(db, CUSTOMER_CONTACTS_COLLECTION);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Firestore rejects undefined field values. Strip them before writing
 * — same pattern as customerService. `Partial<CustomerContactFormData>`
 * means every field is optional, and explicit `undefined` just means
 * "don't touch this field", NOT "clear it".
 */
function stripUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

/**
 * Sort contacts for picker / list UX: primary first, then
 * case-insensitive by name. Kept local so callers don't need to
 * re-implement it when converting snapshots to view models.
 */
function sortContacts(contacts: CustomerContact[]): CustomerContact[] {
  return [...contacts].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * Live subscription to every contact for a given customer. Callback
 * fires with a freshly sorted array on every Firestore update.
 *
 * No `isActive` filter here — the caller decides whether to hide
 * soft-deleted rows. A CRM activity form listing historical
 * participants might want the full set; a picker for new outreach
 * should filter to `isActive !== false`.
 */
export function subscribeToCustomerContacts(
  customerId: string,
  callback: (contacts: CustomerContact[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const q = query(contactsRef, where('customerId', '==', customerId));
  return onSnapshot(
    q,
    (snapshot) => {
      const contacts = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CustomerContact, 'id'>),
      })) as CustomerContact[];
      callback(sortContacts(contacts));
    },
    (error) => {
      console.error('customerContacts subscription error:', error);
      onError?.(error);
    },
  );
}

/** One-shot read of a single contact by id. Returns null when missing. */
export async function getCustomerContact(
  contactId: string,
): Promise<CustomerContact | null> {
  const snap = await getDoc(doc(contactsRef, contactId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<CustomerContact, 'id'>) } as CustomerContact;
}

/** One-shot list of contacts for a customer, sorted the same way as the subscription. */
export async function listCustomerContacts(
  customerId: string,
): Promise<CustomerContact[]> {
  const q = query(contactsRef, where('customerId', '==', customerId));
  const snap = await getDocs(q);
  const contacts = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<CustomerContact, 'id'>),
  })) as CustomerContact[];
  return sortContacts(contacts);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Create a new contact under `customerId`. Returns the new doc id.
 * Stamps `createdAt` / `updatedAt` via `serverTimestamp()` — callers
 * must NOT pre-populate them.
 *
 * This does NOT unset siblings when `data.isPrimary === true`; pair
 * with `setPrimaryCustomerContact(newId, customerId)` when the caller
 * wants the atomic sweep.
 */
export async function createCustomerContact(
  customerId: string,
  data: CustomerContactFormData,
): Promise<string> {
  const clean = stripUndefined({ ...data, customerId });
  const docRef = await addDoc(contactsRef, {
    ...clean,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Patch an existing contact. Only the fields present in `data` are
 * written; timestamps are refreshed. `customerId` is not part of the
 * patch surface — moving a contact between customers is not a valid
 * operation (create a new one under the target customer instead).
 */
export async function updateCustomerContact(
  contactId: string,
  data: Partial<CustomerContactFormData>,
): Promise<void> {
  const clean = stripUndefined(data);
  await updateDoc(doc(contactsRef, contactId), {
    ...clean,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Remove a contact.
 *
 * Default is SOFT delete: sets `isActive: false` and stamps
 * `updatedAt`. Keeps the row addressable by existing CRM activity /
 * task references (P11-4 adds `contactPersonId` FK).
 *
 * Pass `{ hardDelete: true }` for destructive removal — use only
 * when callers are certain nothing still points at the contact.
 */
export async function deleteCustomerContact(
  contactId: string,
  options?: { hardDelete?: boolean },
): Promise<void> {
  const ref = doc(contactsRef, contactId);
  if (options?.hardDelete) {
    await deleteDoc(ref);
    return;
  }
  await updateDoc(ref, {
    isActive: false,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Upsert a customer contact by id. Used by the P11-3 mirror path so
 * the new collection record shares its id with the legacy embedded
 * `ContactPerson.id` — makes the P11-5 drop trivial and keeps
 * cross-references stable while both surfaces coexist.
 *
 * Uses `setDoc` with `merge: true` so repeated mirrors only touch
 * the fields that actually changed. `createdAt` is stamped on the
 * first write (merge leaves the existing value untouched on repeat
 * calls); `updatedAt` always refreshes.
 */
export async function setCustomerContact(
  contactId: string,
  customerId: string,
  data: CustomerContactFormData,
): Promise<void> {
  const clean = stripUndefined({ ...data, customerId });
  await setDoc(
    doc(contactsRef, contactId),
    {
      ...clean,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Mirror the legacy embedded `Customer.contacts: ContactPerson[]`
 * array into the normalized `customerContacts` collection (P11-3).
 *
 * The embedded array is the source of truth while P11 is in flight,
 * so this write is one-way: form submit → embedded array →
 * customerContacts. The collection rows track the embedded array on
 * every customer save.
 *
 * Reconciliation rules (single batched commit):
 *   - Every ContactPerson in `contacts` is `setDoc`'d by its own
 *     id (preserves the legacy id across collections). Fields are
 *     merged, so repeated mirrors are cheap.
 *   - Any collection row for this customer whose id is NOT in the
 *     incoming `contacts` list gets soft-deleted (`isActive: false`)
 *     — keeps CRM activity / task references addressable.
 *   - Rows already soft-deleted that reappear in the embedded array
 *     (user un-deletes in the form) are re-activated by the setDoc
 *     merge, which restamps `isActive` from the embedded data (or
 *     leaves it unset — the reader treats `undefined` as active).
 *
 * Caller supplies `contacts` from the customer doc's embedded array
 * AFTER the form write — we don't infer the "previous" set from the
 * caller; we read it from the collection. That keeps the helper
 * idempotent even if a previous mirror partially failed.
 */
export async function mirrorEmbeddedContactsToCollection(
  customerId: string,
  contacts: ContactPerson[],
): Promise<void> {
  const existing = await getDocs(
    query(contactsRef, where('customerId', '==', customerId)),
  );

  const incomingIds = new Set(contacts.map((c) => c.id));
  const batch = writeBatch(db);
  let writes = 0;

  // Upserts — one setDoc per embedded contact, merge semantics.
  for (const person of contacts) {
    const data = contactPersonToCustomerContactData(person);
    const clean = stripUndefined({ ...data, customerId });
    batch.set(
      doc(contactsRef, person.id),
      {
        ...clean,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    writes++;
  }

  // Soft-deletes — any collection row absent from the embedded array
  // and not already inactive gets flagged out. We skip rows that are
  // already `isActive: false` so `updatedAt` doesn't churn on every
  // mirror.
  for (const d of existing.docs) {
    if (incomingIds.has(d.id)) continue;
    const currentlyActive = (d.data() as { isActive?: boolean }).isActive !== false;
    if (!currentlyActive) continue;
    batch.update(doc(contactsRef, d.id), {
      isActive: false,
      updatedAt: serverTimestamp(),
    });
    writes++;
  }

  if (writes === 0) return;
  await batch.commit();
}

/**
 * Atomically promote `contactId` to the primary contact for its
 * customer. Reads every other contact for that customer, unsets their
 * `isPrimary`, sets the target's to true, and commits all writes in a
 * single batch.
 *
 * The batch write is what keeps the "at most one primary per
 * customer" invariant sound: without the batch a partial failure
 * would leave two primaries or zero.
 */
export async function setPrimaryCustomerContact(
  contactId: string,
  customerId: string,
): Promise<void> {
  const q = query(contactsRef, where('customerId', '==', customerId));
  const snap = await getDocs(q);
  const batch = writeBatch(db);

  for (const d of snap.docs) {
    const isTarget = d.id === contactId;
    // Only touch docs whose flag actually needs to change — avoids
    // noisy `updatedAt` churn on contacts that were already correct.
    const currentlyPrimary = (d.data() as { isPrimary?: boolean }).isPrimary === true;
    if (isTarget && !currentlyPrimary) {
      batch.update(doc(contactsRef, d.id), {
        isPrimary: true,
        updatedAt: serverTimestamp(),
      });
    } else if (!isTarget && currentlyPrimary) {
      batch.update(doc(contactsRef, d.id), {
        isPrimary: false,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
}
