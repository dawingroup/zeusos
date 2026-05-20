/**
 * ControlBOQItem ↔ DesignItem link service — P9/F9.
 *
 * The data-model audit (F9) flagged that advisory BOQ line items and
 * finishes DesignItem records describe overlapping work but have no
 * shared identifier — so cost/quantity drift between the two systems
 * is invisible. P9 adds an optional bidirectional link:
 *
 *   - `DesignItem.linkedBoqItemIds: string[]`        (one-to-many reverse)
 *   - `ControlBOQItem.linkedDesignItemId: string`    (single-valued forward)
 *
 * Firestore paths used here — these are the in-production schema, not
 * the aspirational `BOQDocument/BOQItem` types in
 * `advisory/core/project/types/boq.types.ts`:
 *
 *   ControlBOQItem → root collection `control_boq`, doc id = itemId,
 *                    `projectId` field guards cross-project writes.
 *   DesignItem     → `designProjects/{projectId}/designItems/{itemId}`.
 *
 * Expectations:
 *
 *   1. No automatic sync. The two cost systems remain independent.
 *      The link only enables reconciliation views.
 *
 *   2. Link and unlink are atomic across both documents. Partial writes
 *      corrupt the bidirectional invariant, so we use a Firestore
 *      `writeBatch` and fail loud if either side is missing before we
 *      commit.
 *
 *   3. Linking is idempotent — re-linking the same pair is a no-op.
 *      Unlinking an already-unlinked pair is a no-op.
 *
 *   4. A ControlBOQItem can only point at ONE DesignItem at a time.
 *      Linking a BOQ item that's already linked to a different
 *      DesignItem rejects — the caller must explicitly unlink first.
 *      This prevents silent reassignment.
 *
 *   5. The ControlBOQItem's `projectId` field must match the advisory
 *      projectId in the ref, mirroring `updateControlBOQItem`'s guard.
 *      This stops a bug where one advisory project could mutate another
 *      project's BOQ row by guessing the itemId.
 */

import {
  doc,
  getDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { DesignItem } from '../types';
import type { ControlBOQItem } from '@/subsidiaries/advisory/delivery/core/types/boq';

// ---------------------------------------------------------------------------
// Context shapes
// ---------------------------------------------------------------------------

/**
 * Locator for a ControlBOQ line item. `projectId` is the advisory
 * project and is enforced against the BOQ row's stored `projectId`
 * field to prevent cross-project writes.
 */
export interface BOQItemRef {
  advisoryProjectId: string;
  boqItemId: string;
}

/** Locator for a finishes DesignItem within its design project. */
export interface DesignItemRef {
  designProjectId: string;
  designItemId: string;
}

// ---------------------------------------------------------------------------
// Typed errors — callers can pattern-match on `code`
// ---------------------------------------------------------------------------

export class BOQDesignItemLinkError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'BOQDesignItemLinkError';
  }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * ControlBOQItem lives at the root `control_boq` collection keyed by
 * itemId — NOT nested under the advisory project. Caller-supplied
 * `advisoryProjectId` is validated against the stored row's `projectId`
 * field before any write (see `assertBoqBelongsToProject`).
 */
function boqItemDocRef(ref: BOQItemRef) {
  return doc(db, 'control_boq', ref.boqItemId);
}

function designItemDocRef(ref: DesignItemRef) {
  return doc(
    db,
    'designProjects',
    ref.designProjectId,
    'designItems',
    ref.designItemId,
  );
}

/**
 * Mirror of the guard used by `updateControlBOQItem` — every write
 * must confirm the BOQ row's stored projectId matches the caller's
 * context. Without this an attacker (or a bugged caller) could mutate
 * rows in another advisory project by guessing the itemId.
 */
function assertBoqBelongsToProject(
  data: Partial<ControlBOQItem> | undefined,
  ref: BOQItemRef,
): void {
  if (!data || data.projectId !== ref.advisoryProjectId) {
    throw new BOQDesignItemLinkError(
      'link/boq-project-mismatch',
      `BOQ item ${ref.boqItemId} does not belong to advisory project ${ref.advisoryProjectId}.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Link a ControlBOQ line item to a DesignItem bidirectionally.
 *
 * Fails loud if either side is missing, if the BOQ row belongs to a
 * different advisory project, or if the BOQ row is already linked to
 * a different DesignItem (call `unlinkBoqFromDesignItem` first).
 * Idempotent when called on an already-linked matching pair.
 */
export async function linkBoqToDesignItem(
  boqRef: BOQItemRef,
  designItemRef: DesignItemRef,
  userId: string,
): Promise<void> {
  const boqDoc = boqItemDocRef(boqRef);
  const designDoc = designItemDocRef(designItemRef);

  const [boqSnap, designSnap] = await Promise.all([getDoc(boqDoc), getDoc(designDoc)]);

  if (!boqSnap.exists()) {
    throw new BOQDesignItemLinkError(
      'link/boq-not-found',
      `BOQ item ${boqRef.boqItemId} not found at ${boqDoc.path}.`,
    );
  }
  if (!designSnap.exists()) {
    throw new BOQDesignItemLinkError(
      'link/design-item-not-found',
      `DesignItem ${designItemRef.designItemId} not found at ${designDoc.path}.`,
    );
  }

  const boqData = boqSnap.data() as Partial<ControlBOQItem>;
  assertBoqBelongsToProject(boqData, boqRef);

  const existing = boqData.linkedDesignItemId;
  if (existing && existing !== designItemRef.designItemId) {
    // Silent reassignment is the bug we're explicitly rejecting (F9's
    // driver). Caller has to unlink first so the previous DesignItem's
    // `linkedBoqItemIds` is cleaned up.
    throw new BOQDesignItemLinkError(
      'link/boq-already-linked',
      `BOQ item ${boqRef.boqItemId} is already linked to DesignItem ${existing}. ` +
        `Unlink it first before linking to ${designItemRef.designItemId}.`,
    );
  }

  // Both writes go in a single batch — no half-linked state.
  const batch = writeBatch(db);
  batch.update(boqDoc, {
    linkedDesignItemId: designItemRef.designItemId,
    // P9c — denormalise the DesignItem's parent project so readers
    // that only have the BOQ row can still resolve the Firestore
    // path (unlink, cross-module cost reads). Invariant: this field
    // is set iff `linkedDesignItemId` is set.
    linkedDesignProjectId: designItemRef.designProjectId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  batch.update(designDoc, {
    // arrayUnion is idempotent — re-linking the same pair is a no-op.
    linkedBoqItemIds: arrayUnion(boqRef.boqItemId),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  await batch.commit();
}

/**
 * Sever the bidirectional link between a ControlBOQ item and a DesignItem.
 *
 * Idempotent — unlinking an already-unlinked pair succeeds as a no-op.
 * Still requires both documents to exist and the BOQ row to belong to
 * the expected advisory project, so the caller gets a clear error
 * instead of writing to a ghost path.
 */
export async function unlinkBoqFromDesignItem(
  boqRef: BOQItemRef,
  designItemRef: DesignItemRef,
  userId: string,
): Promise<void> {
  const boqDoc = boqItemDocRef(boqRef);
  const designDoc = designItemDocRef(designItemRef);

  const [boqSnap, designSnap] = await Promise.all([getDoc(boqDoc), getDoc(designDoc)]);
  if (!boqSnap.exists()) {
    throw new BOQDesignItemLinkError(
      'unlink/boq-not-found',
      `BOQ item ${boqRef.boqItemId} not found at ${boqDoc.path}.`,
    );
  }
  if (!designSnap.exists()) {
    throw new BOQDesignItemLinkError(
      'unlink/design-item-not-found',
      `DesignItem ${designItemRef.designItemId} not found at ${designDoc.path}.`,
    );
  }

  assertBoqBelongsToProject(boqSnap.data() as Partial<ControlBOQItem>, boqRef);

  const batch = writeBatch(db);
  batch.update(boqDoc, {
    // Explicit clear — deleteField() would force callers to import another
    // firestore sentinel. `null` works fine since the type is optional.
    linkedDesignItemId: null,
    // P9c — paired clear keeps the invariant "both set or both null".
    // A stale projectId after unlink would mislead cross-module readers.
    linkedDesignProjectId: null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  batch.update(designDoc, {
    linkedBoqItemIds: arrayRemove(boqRef.boqItemId),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  await batch.commit();
}

/**
 * Read the current `linkedDesignItemId` off a BOQ item — used by
 * reconciliation views to know which DesignItem to compare against.
 * Returns null when the BOQ row doesn't exist OR belongs to a
 * different advisory project (silent no-op rather than throw — callers
 * treat "no link" and "wrong project" the same on read).
 */
export async function getLinkedDesignItemId(boqRef: BOQItemRef): Promise<string | null> {
  const snap = await getDoc(boqItemDocRef(boqRef));
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<ControlBOQItem>;
  if (data.projectId !== boqRef.advisoryProjectId) return null;
  return data.linkedDesignItemId ?? null;
}

/**
 * Read the current `linkedBoqItemIds` off a DesignItem — used by
 * reconciliation views to enumerate linked BOQ lines.
 */
export async function getLinkedBoqItemIds(ref: DesignItemRef): Promise<string[]> {
  const snap = await getDoc(designItemDocRef(ref));
  if (!snap.exists()) return [];
  const data = snap.data() as Partial<DesignItem>;
  return data.linkedBoqItemIds ?? [];
}

/**
 * Fetch a full ControlBOQItem for cross-module display (e.g., the
 * "Linked BOQ Items" panel on DesignItemDetail needs the row's
 * description, quantity, and rate to render a reconciliation line).
 *
 * Returns null when the row is missing OR belongs to a different
 * advisory project — consumers of this method are presentation-only,
 * so "not visible to this project" is indistinguishable from "gone".
 */
export async function fetchLinkedBoqItem(
  boqRef: BOQItemRef,
): Promise<ControlBOQItem | null> {
  const snap = await getDoc(boqItemDocRef(boqRef));
  if (!snap.exists()) return null;
  const data = snap.data() as ControlBOQItem;
  if (data.projectId !== boqRef.advisoryProjectId) return null;
  return { ...data, id: snap.id };
}

/**
 * Project-agnostic read for the DesignItem-side display. `DesignItem`
 * stores linked ids as a bare `string[]` — at render time we don't
 * know which advisory project each link lives in, so we can't supply
 * a BOQItemRef. This helper looks up the row by id alone; Firestore
 * security rules enforce tenancy if the reader shouldn't see it.
 *
 * Returns null when the row is missing (deleted after link) so the
 * UI can render "BOQ item unavailable" instead of crashing.
 */
export async function fetchControlBoqItemById(
  boqItemId: string,
): Promise<ControlBOQItem | null> {
  const snap = await getDoc(doc(db, 'control_boq', boqItemId));
  if (!snap.exists()) return null;
  return { ...(snap.data() as ControlBOQItem), id: snap.id };
}
