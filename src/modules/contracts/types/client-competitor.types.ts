/**
 * Client Competitor — Phase 6.UI.C rewrite per
 * [ADR-2026-05-25 §2.Q4](../../../../docs/ADR-2026-05-25-commercial-model.md).
 *
 * Replaces the retired Phase 6.C category-based conflict_walls model.
 * Each client carries an explicit, contract-derived list of competitors
 * the consortium has agreed not to serve simultaneously. Routing
 * excludes any brand currently serving a listed competitor.
 *
 * Collection: `client_competitors/{compositeKey}`
 *
 *   compositeKey: `${clientId}__${competitorClientId}` — double-underscore
 *   delimiter so either side can contain underscores. Asymmetric by
 *   design: A→B doesn't imply B→A. The AM signing the Pepsi MSA adds
 *   Coca-Cola to Pepsi's competitor list; doesn't automatically add
 *   Pepsi to Coca-Cola's (Coca-Cola's MSA, if/when it exists, would
 *   write its own row).
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Composite-key format: `${clientId}__${competitorClientId}`.
 */
export type ClientCompetitorId = string;

/**
 * Why this row exists — drives reporting + future contract-audit
 * tooling. `MSA` / `SOW` rows are auto-created when a contract is
 * signed with a competitor-clause; `MANUAL` is human-added.
 */
export type ClientCompetitorSource = 'MSA' | 'SOW' | 'MANUAL';

export interface ClientCompetitor {
  /** `${clientId}__${competitorClientId}`. */
  id: ClientCompetitorId;

  /** The client this row "belongs" to — the one whose contract forbids
   *  the agency from serving the competitor. */
  clientId: string;

  /** The competitor named in the client's exclusivity clause. Foreign
   *  key into `clients/{competitorClientId}`; the row is informational
   *  if the competitor isn't itself a Zeus client (firewall still
   *  consults `internal_work_orders` keyed by clientId so an external
   *  competitor with no IWOs is a no-op). */
  competitorClientId: string;

  /** Why this row exists. `MANUAL` is the default for AM-added rows. */
  source: ClientCompetitorSource;

  /** Back-reference for traceability. `MSA` source → MSA id, `SOW`
   *  source → SOW id, `MANUAL` → `'manual'`. */
  sourceAggregateId: string;

  /** Free-text — typically the literal contract clause language so
   *  reviewers can audit "why does Pepsi block us from Coca-Cola?". */
  notes?: string;

  /** Optional sunset. When set, the firewall ignores this row past
   *  the date; useful for fixed-term retainer exclusivities. */
  effectiveUntil?: Timestamp | string;

  // Audit
  addedBy: string;
  addedAt: Timestamp | string;
}

// ============================================
// DTOs
// ============================================

export interface AddClientCompetitorInput {
  clientId: string;
  competitorClientId: string;
  source?: ClientCompetitorSource;     // defaults 'MANUAL'
  sourceAggregateId?: string;          // defaults 'manual'
  notes?: string;
  effectiveUntil?: Timestamp | string;
}

export interface RemoveClientCompetitorInput {
  clientId: string;
  competitorClientId: string;
}

// ============================================
// Type guards
// ============================================

export function isClientCompetitor(v: unknown): v is ClientCompetitor {
  return !!v && typeof v === 'object' &&
    typeof (v as ClientCompetitor).clientId === 'string' &&
    typeof (v as ClientCompetitor).competitorClientId === 'string' &&
    typeof (v as ClientCompetitor).source === 'string';
}

/**
 * Build the composite id used as the Firestore doc id and in lookups.
 * Same as the server-side helper in `functions/src/conflict-firewall/admin.js`.
 */
export function clientCompetitorDocId(clientId: string, competitorClientId: string): ClientCompetitorId {
  return `${clientId}__${competitorClientId}`;
}
