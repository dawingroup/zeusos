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

  /**
   * Which org commercially owns this client — per ADR-0001 Q2,
   * "brands also sell direct" means a client can be either:
   *
   *   - `'zeus-group'`  — Zeus Group's Account-Management team owns
   *                       the relationship (the historical default).
   *   - one of the 5    — a brand sold this client direct; the brand's
   *     sibling brand     commercial lead owns the MSA / SOW / Quote /
   *     ids               ClientInvoice lifecycle. Other brands can
   *                       still receive routed IWOs through the cost-
   *                       plus inter-co path (Q3) — but only the owner
   *                       brand can sign commercial documents.
   *
   * Anchor for the conflict firewall: `excludeConflicted` excludes a
   * candidate brand if it commercially owns a client that the
   * requesting client lists as a competitor (via `client_competitors`).
   * Falls back to the open-IWO walk when this field is unset (legacy
   * pre-Q2 clients).
   *
   * Optional during rollout. Migration in `functions/src/migrations/`
   * backfills all existing clients to `'zeus-group'`. New clients
   * created via account-management intake MUST set this.
   */
  commercialOwnerOrgId?: SubsidiaryId;

  notes?: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
