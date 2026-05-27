/**
 * Conflict Firewall — Phase 6.C (closes Addendum v1.1 §6 / change C3).
 *
 * Three collections form the firewall:
 *
 *   categories/{categoryId}
 *     Master list of competitive categories (CARBONATED_BEVERAGE,
 *     COMMERCIAL_BANK, MOBILE_NETWORK_OPERATOR, …). Admin-curated.
 *
 *   client_categories/{compositeKey}        compositeKey = `${clientId}__${categoryId}`
 *     Edge: a client belongs to a category. `exclusive` defaults true —
 *     when false, the firewall is informational only (the client tolerates
 *     a sibling-brand also serving a competitor in that category, with
 *     contractual carve-outs). When true, routing must exclude any brand
 *     that already serves another exclusive client in the same category.
 *
 *   conflict_walls/{wallId}
 *     The snapped-into-place wall. Created when a master_job is opened
 *     (Phase 6.C.2 follow-up) or manually by an Account Director with
 *     a `reason`. Each wall row is the assertion: "Brand X is serving
 *     Client Y in Category Z — block any other Client in Category Z
 *     from being routed to Brand X."
 *
 * Together they implement v1.1 §6.2 enforcement: routing excludes
 * walled brands, RBAC blocks cross-wall grants (deferred to 6.C.2),
 * reporting roll-ups never join two walled accounts in the same
 * category (deferred to 6.F when watchers consume the events).
 */

import { Timestamp } from 'firebase/firestore';
import { SubsidiaryId } from '../../../core/settings/types';

// ============================================
// Category
// ============================================

/**
 * Stable category code. UPPER_SNAKE_CASE so it's diffable in git when
 * the seed list grows. Lookup by id is the canonical access pattern.
 *
 * Examples: 'CARBONATED_BEVERAGE', 'COMMERCIAL_BANK', 'MNO',
 *           'INSURANCE_GENERAL', 'FMCG_HOUSEHOLD', 'AUTOMOTIVE'.
 */
export type CategoryId = string;

export interface Category {
  /** UPPER_SNAKE_CASE code, e.g. 'CARBONATED_BEVERAGE'. */
  id: CategoryId;

  /** Human-readable name, e.g. 'Carbonated Beverage'. */
  name: string;

  /** Optional 1-line description shown in admin pickers. */
  description?: string;

  /**
   * Optional parent for hierarchical categories (e.g.
   * 'BEVERAGE_NON_ALCOHOLIC' parent of 'CARBONATED_BEVERAGE').
   * The firewall walks up the tree when checking — a wall on the
   * parent applies to all children.
   */
  parentCategoryId?: CategoryId;

  /** Admin can deactivate without deleting (preserves audit chains). */
  isActive: boolean;

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
}

// ============================================
// ClientCategory (edge)
// ============================================

/**
 * Composite key format: `${clientId}__${categoryId}` (double-underscore
 * delimiter to allow either side to contain underscores).
 */
export type ClientCategoryId = string;

export interface ClientCategory {
  id: ClientCategoryId;
  clientId: string;
  categoryId: CategoryId;

  /**
   * When true (default), routing must block any sibling brand
   * already serving an exclusive client in this category.
   * When false, the link is advisory only — the firewall logs
   * the conflict but doesn't block.
   */
  exclusive: boolean;

  /** Optional notes — contract carve-outs, exception clauses, etc. */
  notes?: string;

  // Audit
  addedBy: string;
  addedAt: Timestamp;
}

// ============================================
// ConflictWall (snapped-into-place enforcement record)
// ============================================

/**
 * Why a wall was created. Drives reporting + agent (ZA-004) interest.
 */
export type ConflictWallReason =
  | 'SERVING_ACCOUNT'       // auto-created when master_job opened (6.C.2)
  | 'EXCLUSIVE_RETAINER'    // contractual exclusivity clause
  | 'MANUAL_OVERRIDE'       // Account Director / Traffic added by hand
  | 'COMPETITOR_CLAUSE';    // wall against a named competitor

export interface ConflictWall {
  id: string;

  /** The client whose work pinned the wall. */
  clientId: string;

  /** Brand that's now exclusively serving the client in this category. */
  servingOrgId: SubsidiaryId;

  /** The category the wall protects. */
  categoryId: CategoryId;

  reason: ConflictWallReason;

  /**
   * What spawned this wall — back-ref into the aggregate that triggered
   * it (master_job ID for SERVING_ACCOUNT, SOW ID for EXCLUSIVE_RETAINER,
   * `manual` for MANUAL_OVERRIDE).
   */
  sourceAggregateType: 'master_job' | 'sow' | 'manual';
  sourceAggregateId: string;

  /**
   * Optional sunset — when set, the wall expires automatically (used
   * for fixed-term retainers).
   */
  effectiveUntil?: Timestamp;

  /** Free-text justification — REQUIRED for MANUAL_OVERRIDE. */
  notes?: string;

  // Audit
  createdBy: string;
  createdAt: Timestamp;
  // Walls are deleted (not soft-removed) — there's no `isDeleted`. Removal
  // is itself a `ConflictWallRemoved` event (deferred to 6.C.2).
}

// ============================================
// DTOs
// ============================================

export interface CreateCategoryInput {
  id: CategoryId;
  name: string;
  description?: string;
  parentCategoryId?: CategoryId;
}

export interface AssignClientCategoryInput {
  clientId: string;
  categoryId: CategoryId;
  exclusive?: boolean;     // defaults true
  notes?: string;
}

export interface CreateConflictWallInput {
  clientId: string;
  servingOrgId: SubsidiaryId;
  categoryId: CategoryId;
  reason: ConflictWallReason;
  sourceAggregateType: 'master_job' | 'sow' | 'manual';
  sourceAggregateId: string;
  effectiveUntil?: Timestamp;
  notes?: string;
}

// ============================================
// Type guards
// ============================================

export function isCategory(v: unknown): v is Category {
  return !!v && typeof v === 'object' &&
    typeof (v as Category).id === 'string' &&
    typeof (v as Category).name === 'string' &&
    typeof (v as Category).isActive === 'boolean';
}

export function isClientCategory(v: unknown): v is ClientCategory {
  return !!v && typeof v === 'object' &&
    typeof (v as ClientCategory).clientId === 'string' &&
    typeof (v as ClientCategory).categoryId === 'string' &&
    typeof (v as ClientCategory).exclusive === 'boolean';
}

export function isConflictWall(v: unknown): v is ConflictWall {
  return !!v && typeof v === 'object' &&
    typeof (v as ConflictWall).clientId === 'string' &&
    typeof (v as ConflictWall).servingOrgId === 'string' &&
    typeof (v as ConflictWall).categoryId === 'string';
}
