/**
 * MSA — Master Service Agreement between Zeus Group (parent) and a Client.
 * Provides the umbrella legal/commercial terms under which one or more
 * SOWs sit. SOWs cannot be created without an ACTIVE MSA.
 *
 * Spec §3.1 / §4.2.
 *
 * Lives at `organizations/{orgId}/msas/{msaId}`.
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';

export type MSAStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

export interface MSA {
  id: string;
  clientId: string;
  /** Always the parent org (`'zeus-group'`). */
  parentOrgId: SubsidiaryId;
  /** Short human-friendly code: e.g. `MSA-DIAGEO-2026-001`. */
  code: string;
  title: string;
  /** Storage reference to the signed PDF in Firebase Storage. */
  agreementDocRef?: string;
  effectiveFrom: Timestamp | string;
  /** Optional — null for evergreen agreements. */
  effectiveTo?: Timestamp | string;
  status: MSAStatus;
  /** Field-flag for compliance / NDA work. */
  hasNda?: boolean;
  signedByClientName?: string;
  signedByClientAt?: Timestamp | string;
  signedByParentUserId?: string;
  signedByParentAt?: Timestamp | string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
