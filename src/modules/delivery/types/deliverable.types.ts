/**
 * Deliverable — output submitted against an IWO with an acceptance state.
 *
 * Spec §3.1 / §4.4.
 *
 * Lives at:
 *   organizations/{orgId}/internal_work_orders/{iwoId}/deliverables/{delId}
 *
 * The IWO cannot transition `IN_PROGRESS → DELIVERED` unless at least one
 * Deliverable is attached (spec §6.1.1). Acceptance happens at the IWO
 * level via the HandoffPacket.acceptanceCriteria signoffs — Deliverable
 * here records the file / asset itself.
 *
 * For Creative-stream Deliverables, the 6-stage Internal Approval Chain
 * (Designer → Art Director → Studio Manager → ACD → CD → ECD) runs as a
 * pre-condition to attaching the file. That chain is stamped by Phase
 * 3.E (subsidiary workspace) on the Deliverable itself.
 */

import type { Timestamp } from 'firebase/firestore';

export type DeliverableAcceptanceState =
  | 'SUBMITTED'
  | 'ACCEPTED'
  | 'REVISION_REQUESTED'
  | 'REJECTED';

export type DeliverableKind =
  | 'CREATIVE_ASSET'      // KV, banner, video, etc.
  | 'DOCUMENT'            // PR strategy doc, media plan PDF, etc.
  | 'REPORT'              // campaign performance report
  | 'OTHER';

/**
 * 6-stage Creative Approval Chain slot — see plan §5.7. Required on
 * `DeliverableKind === 'CREATIVE_ASSET'` for creative-stream IWOs.
 * Phase 3.E enforces this; Phase 3.A.5 only carries the shape.
 */
export interface ApprovalSlot {
  /** 0 = Designer/Writer, 1 = AD/Copywriter, 2 = Studio Mgr/Head of Copy,
   *  3 = ACD, 4 = CD, 5 = ECD. */
  index: 0 | 1 | 2 | 3 | 4 | 5;
  approverUserId?: string;
  approvedAt?: Timestamp | string;
  comments?: string;
  /** Set when the slot bounced the asset back to an earlier slot. */
  requestedRevisionFromSlot?: number;
}

export interface Deliverable {
  id: string;
  iwoId: string;
  kind: DeliverableKind;
  name: string;
  description?: string;
  /** Storage reference (Firebase Storage path) — versioned by separate
   *  AssetVersion docs in the Asset Library (Phase 4). */
  fileRef?: string;
  state: DeliverableAcceptanceState;
  submittedByUserId: string;
  submittedAt: Timestamp | string;
  acceptedByUserId?: string;
  acceptedAt?: Timestamp | string;
  revisionRequestedByUserId?: string;
  revisionRequestedAt?: Timestamp | string;
  revisionNotes?: string;
  /** Creative 6-stage approval chain (only for CREATIVE_ASSET kind in
   *  creative-stream IWOs). Filled by Phase 3.E. */
  approvalChain?: ApprovalSlot[];
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
