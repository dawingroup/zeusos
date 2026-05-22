/**
 * HandoffPacket — the brief + criteria + context attached to an IWO. An
 * IWO **cannot transition to ISSUED** without a complete packet. The
 * comms owner is always an Account-Management user (parent-org), so the
 * subsidiary cannot become the client's point of contact.
 *
 * Spec §4.4 / §7.3.
 *
 * Lives at:
 *   organizations/{orgId}/internal_work_orders/{iwoId}/handoff_packet/packet
 *
 * (One-doc subcollection — the doc id is the literal `packet`. Phase 3.B
 * Cloud Function validates this packet before allowing `DRAFT → ISSUED`.)
 */

import type { Timestamp } from 'firebase/firestore';

export interface HandoffMilestone {
  id: string;
  name: string;
  /** Must fall inside the parent SOW's startDate / endDate window. */
  dueDate: Timestamp | string;
  completedAt?: Timestamp | string;
}

export interface HandoffAcceptanceCriterion {
  id: string;
  description: string;
  /** Required criteria gate the IWO `accept_internal` transition. Only
   *  when **every** required criterion is signed by an AM user can the
   *  IWO advance to ACCEPTED_INTERNALLY. */
  required: boolean;
  signedByUserId?: string;
  signedAt?: Timestamp | string;
}

export interface HandoffPacket {
  iwoId: string;
  /** The approved brief, in Markdown. */
  briefMd: string;
  milestones: HandoffMilestone[];
  acceptanceCriteria: HandoffAcceptanceCriterion[];
  /** Scrubbed client context — must contain NO price, contract, or
   *  invoice terms. Spec §7.3 validation: client_context_md is "Scrubbed
   *  of price/contract terms." */
  clientContextMd?: string;
  /** Always an Account-Management user (parent-org). Subsidiary users
   *  cannot be designated as comms owner. */
  commsOwnerUserId: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
