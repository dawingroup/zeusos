/**
 * Fulfillment Service
 * Post-production pipeline: received → packing → ready_for_dispatch → dispatched → delivered → installed → complete
 *
 * P7 phase 3 — writes are timestamp-first:
 *
 *   Each transition writes the matching `fulfillment.{packedAt,dispatchedAt,
 *   deliveredAt,installedAt}` timestamp, and readers derive the status via
 *   `deriveFulfillmentStatus`. We NO LONGER stamp the flat `fulfillmentStatus`
 *   field for those transitions — the timestamp is the source of truth, and
 *   a flat mirror was drifting in F10.
 *
 *   The one exception is `markAsComplete`: 'complete' is terminal and has
 *   no matching timestamp, so the derivation explicitly falls through to
 *   the flat field. We keep that single flat write (and only that one).
 *
 *   This file also performs internal reads for `validateTransition`; those
 *   reads now go through `deriveFulfillmentStatus` so they stay in sync
 *   with whichever side wrote last (timestamp OR the legacy flat value
 *   that pre-phase-3 rows still carry).
 */

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { FulfillmentStatus, FulfillmentTracking, PackingChecklistItem } from '@/modules/design-manager/types';
import { deriveFulfillmentStatus } from '@/modules/design-manager/services/designItemStatusDerivation';

/**
 * Resolves a design item document reference.
 * Accepts either a full path (designProjects/{pid}/designItems/{iid}) or a bare item ID.
 * When a bare ID is provided, falls back to the legacy top-level 'designItems' collection.
 */
function resolveItemRef(designItemId: string) {
  if (designItemId.includes('/')) {
    // Full path — split into segments for doc()
    return doc(db, designItemId);
  }
  // Legacy: bare item ID in top-level collection
  return doc(db, 'designItems', designItemId);
}

/**
 * Resolve an existing design item doc across both storage layouts:
 * - nested: designProjects/{projectId}/designItems/{itemId}
 * - legacy: designItems/{itemId}
 * - direct full path (when designItemId already includes slashes)
 */
async function resolveExistingItemRef(
  designItemId: string,
  projectId?: string,
): Promise<ReturnType<typeof doc>> {
  const candidates = [
    ...(designItemId.includes('/') ? [doc(db, designItemId)] : []),
    ...(projectId && !designItemId.includes('/')
      ? [doc(db, 'designProjects', projectId, 'designItems', designItemId)]
      : []),
    resolveItemRef(designItemId),
  ];

  const seenPaths = new Set<string>();
  for (const candidateRef of candidates) {
    if (seenPaths.has(candidateRef.path)) continue;
    seenPaths.add(candidateRef.path);
    const snap = await getDoc(candidateRef);
    if (snap.exists()) return candidateRef;
  }

  throw new Error('Design item not found');
}

// ============================================
// Status Transition Map
// ============================================

const VALID_TRANSITIONS: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  not_released: ['in_production'],
  in_production: ['awaiting_receipt', 'received'],
  awaiting_receipt: ['received'],
  received: ['packing'],
  packing: ['ready_for_dispatch'],
  ready_for_dispatch: ['dispatched'],
  dispatched: ['delivered'],
  delivered: ['installed', 'complete'],
  installed: ['complete'],
  complete: [],
};

function validateTransition(current: FulfillmentStatus, target: FulfillmentStatus): void {
  const allowed = VALID_TRANSITIONS[current] ?? [];
  if (!allowed.includes(target)) {
    throw new Error(
      `Invalid fulfillment transition: "${current}" → "${target}". Allowed: ${allowed.join(', ') || 'none'}`,
    );
  }
}

// ============================================
// Packing
// ============================================

interface PackingDetails {
  packageCount?: number;
  packageNotes?: string;
  checklist?: Array<{ id: string; label: string }>;
}

/**
 * Mark a design item as received into fulfillment.
 * Used by the intake queue for manufacturing-complete items that have not
 * yet been physically received by the fulfillment team.
 */
export async function markAsReceived(
  designItemId: string,
  userId: string,
  projectId?: string,
  manufacturingOrderId?: string,
): Promise<void> {
  const itemRef = await resolveExistingItemRef(designItemId, projectId);
  const snap = await getDoc(itemRef);

  const item = snap.data();
  const currentStatus = deriveFulfillmentStatus(item as never);
  // Intake fallback: some legacy docs still derive as `not_released` because
  // they have no fulfillment timestamps/flat marker, even though they are
  // legitimately manufacturing-ready. Allow receive only when an MO context
  // is provided and that MO is already completed/closed-out.
  if (currentStatus === 'not_released') {
    if (!manufacturingOrderId) {
      throw new Error(
        'Item is not ready for receipt (missing manufacturing context).',
      );
    }

    const moSnap = await getDoc(doc(db, 'manufacturingOrders', manufacturingOrderId));
    const moStatus = moSnap.exists() ? (moSnap.data().status as string | undefined) : undefined;
    const ready = moStatus === 'completed' || moStatus === 'closed-out';
    if (!ready) {
      throw new Error(
        `Item cannot be received yet (manufacturing order status: ${moStatus || 'unknown'}).`,
      );
    }
  } else {
    validateTransition(currentStatus, 'received');
  }

  await updateDoc(itemRef, {
    'fulfillment.receivedAt': serverTimestamp(),
    'fulfillment.receivedBy': userId,
    'fulfillment.routedFrom': 'manufacturing',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mark a design item as packed and ready for dispatch
 */
export async function markAsPacked(
  designItemId: string,
  details: PackingDetails,
  userId: string,
  projectId?: string,
): Promise<void> {
  const itemRef = await resolveExistingItemRef(designItemId, projectId);
  const snap = await getDoc(itemRef);

  const item = snap.data();
  if (!item) throw new Error('Design item not found');
  // P7 phase 3 — derive current status from timestamps, not the flat
  // field. This keeps us correct for rows where moCloseoutService has
  // stamped `receivedAt` without writing the flat mirror.
  const currentStatus = deriveFulfillmentStatus(item as never);
  // Packing completion can be started from `received` (normal flow) or
  // from legacy docs that still carry the transient flat `packing` state.
  // We validate the pre-step into packing, then stamp `packedAt`, which
  // derives as `ready_for_dispatch`.
  if (currentStatus !== 'packing') {
    validateTransition(currentStatus, 'packing');
  }

  const fulfillment: Partial<FulfillmentTracking> = {
    ...(item.fulfillment as FulfillmentTracking ?? {}),
    packedAt: new Date() as unknown as import('@/shared/types').Timestamp,
    packedBy: userId,
    packageCount: details.packageCount ?? 1,
    packageNotes: details.packageNotes,
  };

  // Initialize packing checklist if provided
  if (details.checklist && details.checklist.length > 0) {
    fulfillment.packingChecklist = details.checklist.map(c => ({
      id: c.id,
      label: c.label,
      checked: true,
      checkedBy: userId,
      checkedAt: new Date() as unknown as import('@/shared/types').Timestamp,
    }));
  }

  // P7 phase 3 — `packedAt` above is the source of truth for
  // 'ready_for_dispatch'. No flat-field mirror; readers use derivation.
  await updateDoc(itemRef, {
    fulfillment,
    updatedAt: serverTimestamp(),
  });
}

const STAGE_ORDER: FulfillmentStatus[] = [
  'awaiting_receipt',
  'received',
  'packing',
  'ready_for_dispatch',
  'dispatched',
  'delivered',
  'installed',
  'complete',
];

/**
 * Move an item directly to a fulfillment stage (kanban drag/drop).
 * This is used by operations users to reclassify cards across columns.
 */
export async function moveToFulfillmentStage(
  designItemId: string,
  target: FulfillmentStatus,
  userId: string,
  projectId?: string,
): Promise<void> {
  if (!STAGE_ORDER.includes(target)) {
    throw new Error(`Unsupported fulfillment stage: ${target}`);
  }

  const itemRef = await resolveExistingItemRef(designItemId, projectId);
  const snap = await getDoc(itemRef);
  const item = snap.data();
  if (!item) throw new Error('Design item not found');

  const current = deriveFulfillmentStatus(item as never);
  if (current === target) return;

  const currentFulfillment = (item.fulfillment as FulfillmentTracking) ?? {};
  const fulfillment: Partial<FulfillmentTracking> = { ...currentFulfillment };
  const now = new Date() as unknown as import('@/shared/types').Timestamp;

  const targetIndex = STAGE_ORDER.indexOf(target);

  // Clear downstream timestamps when moving backwards.
  if (targetIndex < STAGE_ORDER.indexOf('complete')) {
    delete fulfillment.completedAt;
    delete fulfillment.completedBy;
  }
  if (targetIndex < STAGE_ORDER.indexOf('installed')) {
    delete fulfillment.installedAt;
    delete fulfillment.installedBy;
    delete fulfillment.installationNotes;
  }
  if (targetIndex < STAGE_ORDER.indexOf('delivered')) {
    delete fulfillment.deliveredAt;
    delete fulfillment.deliveryNotes;
  }
  if (targetIndex < STAGE_ORDER.indexOf('dispatched')) {
    delete fulfillment.dispatchedAt;
    delete fulfillment.dispatchedBy;
    delete fulfillment.deliveryMethod;
    delete fulfillment.trackingRef;
  }
  if (targetIndex < STAGE_ORDER.indexOf('ready_for_dispatch')) {
    delete fulfillment.packedAt;
    delete fulfillment.packedBy;
  }
  if (targetIndex < STAGE_ORDER.indexOf('packing')) {
    delete fulfillment.packingStartedAt;
  }
  if (targetIndex < STAGE_ORDER.indexOf('received')) {
    delete fulfillment.receivedAt;
    delete fulfillment.receivedBy;
    delete fulfillment.routedFrom;
  }

  // Ensure canonical marker(s) for target stage.
  if (targetIndex >= STAGE_ORDER.indexOf('received') && !fulfillment.receivedAt) {
    fulfillment.receivedAt = now;
    fulfillment.receivedBy = userId;
    fulfillment.routedFrom = 'manufacturing';
  }
  if (targetIndex >= STAGE_ORDER.indexOf('packing') && !fulfillment.packingStartedAt) {
    fulfillment.packingStartedAt = now;
  }
  if (targetIndex >= STAGE_ORDER.indexOf('ready_for_dispatch') && !fulfillment.packedAt) {
    fulfillment.packedAt = now;
    fulfillment.packedBy = userId;
  }
  if (targetIndex >= STAGE_ORDER.indexOf('dispatched') && !fulfillment.dispatchedAt) {
    fulfillment.dispatchedAt = now;
    fulfillment.dispatchedBy = userId;
    fulfillment.deliveryMethod = fulfillment.deliveryMethod ?? 'company_vehicle';
  }
  if (targetIndex >= STAGE_ORDER.indexOf('delivered') && !fulfillment.deliveredAt) {
    fulfillment.deliveredAt = now;
  }
  if (targetIndex >= STAGE_ORDER.indexOf('installed') && !fulfillment.installedAt) {
    fulfillment.installedAt = now;
    fulfillment.installedBy = userId;
  }
  if (targetIndex >= STAGE_ORDER.indexOf('complete') && !fulfillment.completedAt) {
    fulfillment.completedAt = now;
    fulfillment.completedBy = userId;
  }

  const patch: Record<string, unknown> = {
    fulfillment,
    updatedAt: serverTimestamp(),
  };

  // Flat fallback for pre-packing/readiness states.
  if (target === 'awaiting_receipt' || target === 'received' || target === 'packing') {
    patch.fulfillmentStatus = target;
  }

  await updateDoc(itemRef, patch);
}

// ============================================
// Dispatch
// ============================================

interface DispatchDetails {
  deliveryMethod: 'company_vehicle' | 'third_party' | 'client_pickup';
  trackingRef?: string;
}

/**
 * Mark a design item as dispatched
 */
export async function markAsDispatched(
  designItemId: string,
  details: DispatchDetails,
  userId: string,
  projectId?: string,
): Promise<void> {
  const itemRef = await resolveExistingItemRef(designItemId, projectId);
  const snap = await getDoc(itemRef);

  const item = snap.data();
  if (!item) throw new Error('Design item not found');
  const currentStatus = deriveFulfillmentStatus(item as never);
  validateTransition(currentStatus, 'dispatched');

  const fulfillment: Partial<FulfillmentTracking> = {
    ...(item.fulfillment as FulfillmentTracking ?? {}),
    dispatchedAt: new Date() as unknown as import('@/shared/types').Timestamp,
    dispatchedBy: userId,
    deliveryMethod: details.deliveryMethod,
    trackingRef: details.trackingRef,
  };

  // P7 phase 3 — `dispatchedAt` is the source of truth; no flat mirror.
  await updateDoc(itemRef, {
    fulfillment,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Delivery
// ============================================

/**
 * Mark a design item as delivered
 */
export async function markAsDelivered(
  designItemId: string,
  notes: string | undefined,
  _userId: string,
  projectId?: string,
): Promise<void> {
  const itemRef = await resolveExistingItemRef(designItemId, projectId);
  const snap = await getDoc(itemRef);

  const item = snap.data();
  if (!item) throw new Error('Design item not found');
  const currentStatus = deriveFulfillmentStatus(item as never);
  validateTransition(currentStatus, 'delivered');

  const fulfillment: Partial<FulfillmentTracking> = {
    ...(item.fulfillment as FulfillmentTracking ?? {}),
    deliveredAt: new Date() as unknown as import('@/shared/types').Timestamp,
    deliveryNotes: notes,
  };

  // P7 phase 3 — `deliveredAt` is the source of truth; no flat mirror.
  await updateDoc(itemRef, {
    fulfillment,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Installation
// ============================================

/**
 * Mark a design item as installed
 */
export async function markAsInstalled(
  designItemId: string,
  notes: string | undefined,
  userId: string,
  projectId?: string,
): Promise<void> {
  const itemRef = await resolveExistingItemRef(designItemId, projectId);
  const snap = await getDoc(itemRef);

  const item = snap.data();
  if (!item) throw new Error('Design item not found');
  const currentStatus = deriveFulfillmentStatus(item as never);
  validateTransition(currentStatus, 'installed');

  const fulfillment: Partial<FulfillmentTracking> = {
    ...(item.fulfillment as FulfillmentTracking ?? {}),
    installedAt: new Date() as unknown as import('@/shared/types').Timestamp,
    installedBy: userId,
    installationNotes: notes,
  };

  // P7 phase 3 — `installedAt` is the source of truth; no flat mirror.
  await updateDoc(itemRef, {
    fulfillment,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Mark a design item as complete (final status)
 */
export async function markAsComplete(
  designItemId: string,
  userId: string,
  projectId?: string,
): Promise<void> {
  const itemRef = await resolveExistingItemRef(designItemId, projectId);
  const snap = await getDoc(itemRef);

  const item = snap.data();
  const currentStatus = deriveFulfillmentStatus(item as never);
  validateTransition(currentStatus, 'complete');

  // P7 phase 3 — stamp `fulfillment.completedAt` instead of the flat
  // `fulfillmentStatus: 'complete'` mirror. The derivation now reads
  // the timestamp first, so the flat field is fully retired. Legacy
  // docs that stamped the flat field still derive correctly via the
  // backward-compat branch in `deriveFulfillmentStatus`.
  await updateDoc(itemRef, {
    'fulfillment.completedAt': serverTimestamp(),
    'fulfillment.completedBy': userId,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Packing Checklist
// ============================================

/**
 * Update a single item in the packing checklist
 */
export async function updatePackingChecklist(
  designItemId: string,
  checklistItemId: string,
  checked: boolean,
  userId: string,
  projectId?: string,
): Promise<void> {
  const itemRef = await resolveExistingItemRef(designItemId, projectId);
  const snap = await getDoc(itemRef);

  const item = snap.data();
  if (!item) throw new Error('Design item not found');
  const fulfillment = (item.fulfillment as FulfillmentTracking) ?? {};
  const checklist = fulfillment.packingChecklist ?? [];

  const updatedChecklist = checklist.map((c: PackingChecklistItem) =>
    c.id === checklistItemId
      ? {
        ...c,
        checked,
        checkedBy: checked ? userId : undefined,
        checkedAt: checked ? new Date() as unknown as import('@/shared/types').Timestamp : undefined,
      }
      : c,
  );

  await updateDoc(itemRef, {
    'fulfillment.packingChecklist': updatedChecklist,
    updatedAt: serverTimestamp(),
  });
}

// ============================================
// Project-Level Summary
// ============================================

export interface FulfillmentSummary {
  projectId: string;
  totalItems: number;
  byStatus: Partial<Record<FulfillmentStatus, number>>;
  completedCount: number;
  progressPercent: number;
}

/**
 * Get fulfillment summary for all design items in a project
 */
export async function getFulfillmentSummary(projectId: string): Promise<FulfillmentSummary> {
  // Legacy top-level 'designItems' collection — matches resolveItemRef() fallback.
  const snap = await getDocs(
    query(
      collection(db, 'designItems'),
      where('projectId', '==', projectId),
    ),
  );

  const byStatus: Partial<Record<FulfillmentStatus, number>> = {};
  let completedCount = 0;

  for (const docSnap of snap.docs) {
    // P7 phase 3 — derive from timestamps + flat-field fallback so
    // legacy rows (pre-phase-3) and new rows both classify correctly.
    const status = deriveFulfillmentStatus(docSnap.data() as never);
    byStatus[status] = (byStatus[status] ?? 0) + 1;
    if (status === 'complete' || status === 'installed') {
      completedCount++;
    }
  }

  return {
    projectId,
    totalItems: snap.size,
    byStatus,
    completedCount,
    progressPercent: snap.size > 0 ? Math.round((completedCount / snap.size) * 100) : 0,
  };
}

// ============================================
// Exports
// ============================================

export const fulfillmentService = {
  markAsReceived,
  markAsPacked,
  moveToFulfillmentStage,
  markAsDispatched,
  markAsDelivered,
  markAsInstalled,
  markAsComplete,
  updatePackingChecklist,
  getFulfillmentSummary,
};
