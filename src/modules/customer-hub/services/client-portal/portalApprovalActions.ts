/**
 * Portal approval actions — thin wrappers around the staff-side
 * change-order and design-signoff services, with the portal user's
 * identity baked in.
 *
 * The wrappers exist so:
 *   1. The audit trail (`approvalEvents` subcollection, `clientApprovalEvidence`,
 *      etc.) always tags the action as coming from the new editorial
 *      client portal rather than the old token-based portal.
 *   2. The portal UI has a single, stable surface to call — staff
 *      service signatures can evolve without breaking the page.
 *
 * Security note: portal users sign in with real Firebase Auth (Google /
 * magic-link), so they're `isStaffAuth()` from Firestore's perspective.
 * The existing change-order / signoff service writes are permitted
 * under that permission set. A future round will narrow `isStaffAuth()`
 * writes to "real staff only" via a `/users/{uid}` lookup, at which
 * point we'll need a dedicated `isPortalAuthenticatedClient()` helper
 * for these operations.
 */

import type { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import {
  approveChangeOrder,
  rejectChangeOrder,
} from '@/modules/sales-orders/services/changeOrderService';
import {
  recordDesignApproval,
  recordDesignRejection,
} from '@/modules/sales-orders/services/designSignOffService';
import type { ClientApprovalRecord } from '@/modules/sales-orders/types';

function actorId(user: User): string {
  // The CO approval event records `actorId` verbatim, so we tag the
  // portal session distinctly from staff actions.
  return `portal:${user.uid}`;
}

function evidence(user: User): string {
  return user.email ? `portal:${user.email}` : `portal:${user.uid}`;
}

function userName(user: User): string {
  return user.displayName || user.email || 'Portal client';
}

// ── Change Orders ──────────────────────────────────────────

export async function approveChangeOrderFromPortal(
  coId: string,
  user: User,
  options?: { notes?: string },
): Promise<void> {
  await approveChangeOrder(coId, 'client', actorId(user), evidence(user), {
    channel: 'portal',
    userName: userName(user),
    notes: options?.notes,
    evidenceType: 'token',
    rawMetadata: {
      portalUserId: user.uid,
      portalUserEmail: user.email ?? '',
      source: 'editorial-portal',
    },
  });
}

export async function rejectChangeOrderFromPortal(
  coId: string,
  user: User,
  reason: string,
): Promise<void> {
  if (!reason || reason.trim().length === 0) {
    throw new Error('A rejection reason is required.');
  }
  await rejectChangeOrder(coId, actorId(user), reason.trim(), {
    approvalType: 'client',
    channel: 'portal',
    userName: userName(user),
    evidence: evidence(user),
    evidenceType: 'token',
    rawMetadata: {
      portalUserId: user.uid,
      portalUserEmail: user.email ?? '',
      source: 'editorial-portal',
    },
  });
}

// ── Design Sign-Offs ───────────────────────────────────────

export async function approveSignOffFromPortal(
  signOffId: string,
  user: User,
  options?: { notes?: string },
): Promise<void> {
  const approval: ClientApprovalRecord = {
    approvalMethod: 'portal_acceptance',
    approvedByName: userName(user),
    approvedByEmail: user.email ?? undefined,
    signatureRef: evidence(user),
    notes: options?.notes,
    timestamp: Timestamp.now(),
  };
  await recordDesignApproval(signOffId, approval);
}

export async function rejectSignOffFromPortal(
  signOffId: string,
  _user: User,
  reason: string,
): Promise<void> {
  if (!reason || reason.trim().length === 0) {
    throw new Error('A rejection reason is required.');
  }
  await recordDesignRejection(signOffId, [reason.trim()], reason.trim());
}
