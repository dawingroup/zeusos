/**
 * InternalWorkOrder (IWO) — work assigned to ONE subsidiary. A sub-job of
 * a MasterJob with a locked budget and a governed transfer price. The
 * **only** mechanism by which work crosses the parent ↔ subsidiary
 * boundary (spec §1.1 — Commercial Gravity).
 *
 * Spec §3.1 / §4.4 / §6.1 / §7.1.
 *
 * Lives at:
 *   organizations/{orgId}/internal_work_orders/{iwoId}
 *     ├── handoff_packet/packet      ← single subdoc
 *     ├── time_entries/{teId}        ← subcollection
 *     ├── cost_entries/{ceId}        ← subcollection
 *     └── deliverables/{delId}       ← subcollection
 *
 * State machine: see `src/modules/assignment/constants/iwo-states.ts`.
 *
 * RBAC (enforced in firestore.rules + Phase 3.B Cloud Functions):
 * - Only PARENT-org actors can create / issue IWOs.
 * - Only the delivery lead of `subsidiaryOrgId` can accept / reject.
 * - `cancel` is AM-only authority.
 * - `request_revision` is AM-only.
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';
import type { IWOState } from '../constants/iwo-states';

export interface InternalWorkOrder {
  id: string;
  masterJobId: string;
  /** Receiving subsidiary. Foreign key to `organizations/{orgId}`. */
  subsidiaryOrgId: SubsidiaryId;
  /** Short human-friendly ref: e.g. `IWO-ZTA-DIAGEO-2026-014-CREATIVE`. */
  code: string;
  state: IWOState;
  /** The IWO's budget cap. Hard ceiling on cumulative time + cost. */
  budgetMinor: number;
  /** Governed inter-company price — what the subsidiary charges the
   *  parent on close. Decoupled from client markup (spec §8.3). */
  transferPriceMinor: number;
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  /** Reference to the BudgetHold tracking allocation lifecycle.
   *  HELD → LOCKED → SETTLED, or RELEASED. */
  budgetHoldId?: string;
  /** Cumulative cost posted against this IWO (time + cost entries).
   *  Maintained transactionally with each post-cost transition. */
  cumulativeCostMinor: number;

  /** Roles tracked for the IWO lifecycle. */
  issuedByUserId?: string;
  issuedAt?: Timestamp | string;
  acceptedByUserId?: string;
  acceptedAt?: Timestamp | string;
  rejectedByUserId?: string;
  rejectedAt?: Timestamp | string;
  rejectionReason?: string;

  deliveredAt?: Timestamp | string;
  acceptedInternallyByUserId?: string;
  acceptedInternallyAt?: Timestamp | string;
  closedAt?: Timestamp | string;
  cancelledAt?: Timestamp | string;
  cancelReason?: string;

  /** Idempotency key from the originating mutation — UNIQUE per spec
   *  §4.4. Cloud Functions reject duplicate keys with the cached response. */
  idempotencyKey?: string;

  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
