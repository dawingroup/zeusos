/**
 * Client — the end customer that the parent (Zeus Group) holds a contract
 * with. Subsidiaries never link to a client directly; they only see
 * `clientContextMd` scrubbed of price/contract terms inside an IWO's
 * `HandoffPacket`.
 *
 * Spec §3.1 / §4.2 — `client.parent_org_id` is always the parent
 * (`'zeus-group'` in our model).
 *
 * Lives at `organizations/{orgId}/clients/{clientId}`.
 */

import type { Timestamp } from 'firebase/firestore';
import type { SubsidiaryId } from '@/core/settings/types';

export type ClientStatus = 'PROSPECT' | 'ACTIVE' | 'CHURNED' | 'BLOCKED';

export interface ClientContact {
  /** Optional Firebase Auth UID if the contact also has portal access. */
  userId?: string;
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
}

export interface Client {
  id: string;
  /** Always the parent org id (`'zeus-group'`). Foreign key to
   *  `organizations/{orgId}`. */
  parentOrgId: SubsidiaryId;
  name: string;
  /** Short code for human-friendly references in MSA / SOW numbering, e.g.
   *  `DIAGEO`, `KCB`. */
  code?: string;
  /** ISO 4217 — what the client is invoiced in. Subsidiary IWOs use their
   *  own base currency; a single FX conversion happens at consolidation. */
  billingCurrency: 'UGX' | 'USD' | 'KES' | 'EUR' | 'GBP';
  /** Industry / sector hint for reporting (e.g. `FMCG`, `Telecom`,
   *  `Finance`). */
  sector?: string;
  status: ClientStatus;
  contacts?: ClientContact[];
  /** Account-Management user owning the client relationship. */
  relationshipManagerUserId?: string;
  notes?: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
