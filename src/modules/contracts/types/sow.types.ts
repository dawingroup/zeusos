/**
 * SOW — Statement of Work. Scoped under one MSA; carries the approved
 * scope and the hard **budget ceiling** that no master job may exceed.
 *
 * Spec §3.1 / §4.2 / §8.2 — "No master job opens without an ACTIVE SOW, and
 * no internal work order issues without an ACCEPTED quote tied to that
 * SOW." Raising the ceiling requires an approved ChangeOrder.
 *
 * Lives at `organizations/{orgId}/sows/{sowId}`.
 */

import type { Timestamp } from 'firebase/firestore';
import type { BriefTier } from '@/modules/campaigns/constants/tiers';

export type SOWType = 'RETAINER' | 'PROJECT';

export type SOWStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

export interface SOW {
  id: string;
  msaId: string;
  /** Denormalised from MSA for fast list rendering. */
  clientId: string;
  /** Short human-friendly code: e.g. `SOW-DIAGEO-SMIRNOFF-2026-Q2`. */
  code: string;
  title: string;
  type: SOWType;
  /** Storage reference to the scope doc / brief PDF. */
  scopeDocRef?: string;
  /** Hard cap on cumulative IWO budget allocation. Raised only via approved
   *  ChangeOrder. Stored as minor units (UGX cents = 1, USD cents = 0.01). */
  ceilingMinor: number;
  currency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  status: SOWStatus;
  /** When `status === 'ACTIVE'`, recorded approver + timestamp. */
  approvedByUserId?: string;
  approvedAt?: Timestamp | string;
  /** SOW window — used by HandoffPacket milestone validation (each milestone
   *  due-date must fall inside this window). */
  startDate?: Timestamp | string;
  endDate?: Timestamp | string;
  /** Brief tier classification (Zeus Tier System). Applies to the AM revert
   *  + client feedback SLAs on this SOW's intake brief. */
  briefTier?: BriefTier;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
