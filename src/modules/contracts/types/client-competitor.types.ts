/**
 * Conflict Firewall — Phase 6.C v2 (closes ADR-0001 Q4 + v1.1 C3).
 *
 * SUPERSEDES the Category / ClientCategory / ConflictWall model from
 * the v1 conflict firewall. Per ADR-0001 §Q4, Zeus leadership chose
 * **named-competitor lists per client** over category exclusivity:
 * each client carries an explicit list of competitor clients they
 * do not want sharing a brand. Most flexible, most accurate, requires
 * upfront list maintenance at intake.
 *
 * One collection, one edge type:
 *
 *   client_competitors/{compositeKey}
 *       compositeKey = `${clientId}__${competitorClientId}`
 *
 * Semantics:
 *   - Each row says "client X considers client Y a competitor".
 *   - Asymmetric. Adding (pepsi → coke) does NOT auto-create
 *     (coke → pepsi). In practice the AM enters both at intake.
 *   - At routing time, `excludeConflicted` reads the requesting
 *     client's competitor list, then for each competitor checks
 *     which brand(s) are serving them (via open master_jobs /
 *     IWOs) and excludes those brands from the candidate pool.
 *
 * Phase 6.C v2 ships the EDGE collection + RBAC + new
 * excludeConflicted impl + tests. The full intake UI for managing
 * competitor lists lands in Phase 6.UI.D. The brand-anchor refinement
 * (use Client.commercialOwnerOrgId once it exists from the Q2 PR)
 * lands as a tightening pass post-Q2.
 */

import { Timestamp } from 'firebase/firestore';

/**
 * Composite key — `${clientId}__${competitorClientId}`.
 * Double-underscore delimiter so either id can contain underscores.
 */
export type ClientCompetitorId = string;

export interface ClientCompetitor {
  id: ClientCompetitorId;

  /** Client declaring the competitor relationship. */
  clientId: string;

  /** The other client they don't want sharing a brand. */
  competitorClientId: string;

  /**
   * Optional free-text justification — useful when the AM needs to
   * remember the reasoning years later (e.g. "Diageo NDA §4.2 names
   * Bell + Tusker as off-limits").
   */
  notes?: string;

  /**
   * Optional pin to the engagement context the competitor was
   * declared in. Lets reporting answer "which client added this
   * exclusion clause?" without re-reading every contract.
   */
  declaredAtMasterJobId?: string;

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
  notes?: string;
  declaredAtMasterJobId?: string;
}

export interface RemoveClientCompetitorInput {
  clientId: string;
  competitorClientId: string;
  /** Reason — recorded on the audit log when the row is deleted. */
  reason?: string;
}

// ============================================
// Pure helpers
// ============================================

export function buildClientCompetitorId(
  clientId: string,
  competitorClientId: string,
): ClientCompetitorId {
  return `${clientId}__${competitorClientId}`;
}

export function isClientCompetitor(v: unknown): v is ClientCompetitor {
  return !!v && typeof v === 'object' &&
    typeof (v as ClientCompetitor).clientId === 'string' &&
    typeof (v as ClientCompetitor).competitorClientId === 'string';
}
