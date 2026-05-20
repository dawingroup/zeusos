/**
 * RevisionRequest — client-initiated request for a new revision of a
 * design item.
 *
 * Phase 3b (F-D3): closes the feedback loop that was flowing off-system
 * through email/WhatsApp. Portal clients tap "Request Revision" on a
 * deliverable, the request lands in the designer's inbox, state
 * transitions are tracked, and the resulting new file version can be
 * linked back via `resolvedWithFileId`.
 */

import type { Timestamp } from 'firebase/firestore';

export type RevisionRequestStatus =
  | 'pending'       // fresh from the portal, not yet triaged
  | 'acknowledged'  // designer has seen it and is working on a response
  | 'resolved'      // designer has uploaded a new version that addresses it
  | 'declined';     // designer has determined no change is needed

export interface RevisionRequest {
  id: string;
  projectId: string;
  /** Optional — some requests cover the whole project, not a specific item. */
  itemId?: string;
  /** Denormalised from the DesignItem at create time for UI display. */
  itemName?: string;

  // Who asked
  /** Auth UID of whoever submitted (portal anon UID or staff UID). */
  requestedBy: string;
  /** Denormalised display name, if known (client name for portal requests). */
  requestedByName?: string;
  /** Client-supplied free-text feedback. */
  message: string;
  /** Optional: IDs of specific `projectFiles` the client is commenting on. */
  relatedFileIds?: string[];

  // State machine
  status: RevisionRequestStatus;
  /** Set when status → 'acknowledged'. */
  acknowledgedAt?: Timestamp;
  acknowledgedBy?: string;
  /** Set when status → 'resolved' or 'declined'. */
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolvedNote?: string;
  /**
   * If the designer uploads a new file version in response, the
   * resulting `projectFiles` doc ID is stored here so the RevisionTimeline
   * can stitch the request to the version chain.
   */
  resolvedWithFileId?: string;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type RevisionRequestDraft = Omit<
  RevisionRequest,
  'id' | 'status' | 'createdAt' | 'updatedAt'
>;
