/**
 * ChangeOrder — the **only** way to amend an SOW's scope or raise its
 * `ceilingMinor`. Spec §4.2 / §11.4. Mid-flight scope changes flow:
 *
 *   ChangeOrder (DRAFT → APPROVED) ⇒ SOW.ceilingMinor adjusts by deltaMinor
 *   ⇒ Pricing engine produces revised/added Quote
 *   ⇒ New / enlarged IWOs issued. In-progress IWOs never silently enlarged.
 *
 * Lives at `organizations/{orgId}/change_orders/{coId}`.
 */

import type { Timestamp } from 'firebase/firestore';

export type ChangeOrderStatus = 'DRAFT' | 'APPROVED' | 'REJECTED';

export interface ChangeOrder {
  id: string;
  sowId: string;
  /** Short human-friendly code: e.g. `CO-DIAGEO-SMIRNOFF-2026-Q2-001`. */
  code: string;
  /** Signed minor-unit delta applied to `sow.ceilingMinor` on approval.
   *  May be negative (de-scope). */
  deltaMinor: number;
  /** Currency must match the parent SOW. Denormalised for validation. */
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  reason: string;
  status: ChangeOrderStatus;
  approvedByUserId?: string;
  approvedAt?: Timestamp | string;
  rejectedByUserId?: string;
  rejectedAt?: Timestamp | string;
  rejectionReason?: string;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
