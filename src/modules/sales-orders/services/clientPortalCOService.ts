/**
 * clientPortalCOService — single entry point for client-side CO
 * interactions (portal page, WhatsApp deep-link, email button).
 *
 * Every channel routes through the same two functions:
 *
 *   - `loadChangeOrderForPortal(token, coId)` — validates the portal
 *     token, fetches the CO, and returns a shape with per-state flags
 *     (`canApprove`, `alreadyResponded`, `notReadyForClient`, `expired`,
 *     `withdrawn`) so the UI can render the right screen without
 *     duplicating status logic.
 *
 *   - `processClientCOResponse(token, coId, action, options)` —
 *     delegates to the internal `approveChangeOrder` /
 *     `rejectChangeOrder` mutations with consistent client-side
 *     metadata (synthetic actorId, evidence type, channel attribution).
 *
 * Channel attribution comes from the caller (portal page parses the
 * `?src=` query param, WhatsApp webhook calls with `channel: 'whatsapp'`,
 * etc.) and flows through to the approval event log as raw metadata.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type {
  ChangeOrder,
  ChangeOrderApprovalChannel,
} from '../types';
import {
  CHANGE_ORDERS_COLLECTION,
  CLIENT_PORTAL_TOKENS_COLLECTION,
  CO_TERMINAL_STATUSES,
} from '../constants';
import {
  approveChangeOrder,
  rejectChangeOrder,
} from './changeOrderService';

// ============================================================================
// PORTAL LOAD
// ============================================================================

export type ClientCOScreenState =
  | 'ready_for_response'       // status = pending_client, not expired
  | 'already_approved'         // status = approved
  | 'already_rejected'         // status = rejected
  | 'withdrawn'                // status = withdrawn
  | 'not_ready_for_client'     // status = draft or pending_internal
  | 'invalid_token'
  | 'expired_token'
  | 'not_found';

export interface ClientPortalCOLoadResult {
  screenState: ClientCOScreenState;
  changeOrder: ChangeOrder | null;
  tokenExpiresAt?: Timestamp | null;
  errorMessage?: string;
  recoveryHint?: string;  // human-readable "what to do next"
}

export async function loadChangeOrderForPortal(
  token: string | undefined,
  coId: string | undefined,
): Promise<ClientPortalCOLoadResult> {
  if (!token || !coId) {
    return emptyResult('invalid_token', 'Missing token or change order id.');
  }

  // ── Validate portal token ───────────────────────────────────────────────
  const tokenQ = query(
    collection(db, CLIENT_PORTAL_TOKENS_COLLECTION),
    where('token', '==', token),
    where('type', '==', 'change_order'),
  );
  const tokenSnap = await getDocs(tokenQ);
  if (tokenSnap.empty) {
    return emptyResult(
      'invalid_token',
      'This link isn\'t valid. Your project manager can resend a fresh link.',
    );
  }

  const tokenData = tokenSnap.docs[0].data() as { expiresAt?: Timestamp };
  const tokenExpiresAt = tokenData.expiresAt ?? null;
  if (tokenExpiresAt && tokenExpiresAt.toMillis() < Date.now()) {
    return {
      screenState: 'expired_token',
      changeOrder: null,
      tokenExpiresAt,
      errorMessage: 'This link has expired.',
      recoveryHint: 'Please ask your project manager to resend it.',
    };
  }

  // ── Load CO ────────────────────────────────────────────────────────────
  const coSnap = await getDoc(doc(db, CHANGE_ORDERS_COLLECTION, coId));
  if (!coSnap.exists()) {
    return emptyResult('not_found', 'Change order not found.');
  }

  const co = { id: coSnap.id, ...coSnap.data() } as ChangeOrder;

  return {
    screenState: resolveScreenState(co),
    changeOrder: co,
    tokenExpiresAt,
  };
}

function resolveScreenState(co: ChangeOrder): ClientCOScreenState {
  switch (co.status) {
    case 'approved':
      return 'already_approved';
    case 'rejected':
      return 'already_rejected';
    case 'withdrawn':
      return 'withdrawn';
    case 'pending_client':
      return 'ready_for_response';
    case 'draft':
    case 'pending_internal':
    default:
      return 'not_ready_for_client';
  }
}

function emptyResult(
  state: ClientCOScreenState,
  errorMessage: string,
  recoveryHint?: string,
): ClientPortalCOLoadResult {
  return {
    screenState: state,
    changeOrder: null,
    errorMessage,
    recoveryHint,
  };
}

// ============================================================================
// RESPONSE (channel-agnostic)
// ============================================================================

export interface ClientCOResponseInput {
  action: 'approve' | 'reject';
  clientName: string;            // signatory name entered in portal form
  notes?: string;                // rejection reason or approval notes
  signature?: string;            // optional signature data-url or ref
  channel: ChangeOrderApprovalChannel;  // 'portal' | 'whatsapp' | 'email' | 'in_person'
  channelMetadata?: Record<string, string | number | boolean>;
}

/**
 * Apply a client decision to a CO via the main state-machine helpers.
 * Re-validates the token so webhook / WhatsApp callers can't bypass
 * the portal's front-end checks. Throws if token is invalid/expired or
 * the CO is no longer awaiting a client decision.
 */
export async function processClientCOResponse(
  token: string,
  coId: string,
  input: ClientCOResponseInput,
): Promise<void> {
  // Revalidate — we don't trust the caller's prior check
  const loaded = await loadChangeOrderForPortal(token, coId);
  if (loaded.screenState !== 'ready_for_response' || !loaded.changeOrder) {
    throw new Error(
      loaded.errorMessage ??
        friendlyStateError(loaded.screenState, loaded.changeOrder?.status),
    );
  }

  const co = loaded.changeOrder;
  if (CO_TERMINAL_STATUSES.includes(co.status)) {
    throw new Error(
      'This change order has already been finalized — no further action is needed.',
    );
  }

  const actorId = `portal-client:${input.clientName.slice(0, 80) || 'anonymous'}`;
  const evidenceRef = input.signature ?? `portal-token:${token.slice(-12)}`;

  if (input.action === 'approve') {
    await approveChangeOrder(coId, 'client', actorId, evidenceRef, {
      channel: input.channel,
      userName: input.clientName,
      notes: input.notes,
      evidenceType: input.signature ? 'signature' : 'token',
      rawMetadata: {
        token: token.slice(-12),
        ...input.channelMetadata,
      },
    });
  } else {
    await rejectChangeOrder(coId, actorId, input.notes ?? 'Declined by client', {
      approvalType: 'client',
      channel: input.channel,
      userName: input.clientName,
      evidence: evidenceRef,
      evidenceType: input.signature ? 'signature' : 'token',
      rawMetadata: {
        token: token.slice(-12),
        ...input.channelMetadata,
      },
    });
  }
}

function friendlyStateError(
  state: ClientCOScreenState,
  coStatus?: ChangeOrder['status'],
): string {
  switch (state) {
    case 'already_approved':
      return 'This change order has already been approved.';
    case 'already_rejected':
      return 'This change order has already been declined.';
    case 'withdrawn':
      return 'This change order was withdrawn by the project team.';
    case 'not_ready_for_client':
      return coStatus === 'pending_internal'
        ? 'This change order is still with our team for internal review.'
        : 'This change order is still being prepared.';
    case 'expired_token':
      return 'Your approval link has expired.';
    case 'invalid_token':
      return 'This link is not valid.';
    case 'not_found':
      return 'Change order not found.';
    default:
      return 'Unable to process your response.';
  }
}
