/**
 * Material tier invariant enforcement — P19/F20.
 *
 * The material library is a three-tier hierarchy (global → customer →
 * project). The audit (F20) flagged that `parentMaterialId` was declared
 * optional on every tier with no enforcement, so nothing stopped:
 *
 *   1. A `tier: 'global'` doc from carrying a `parentMaterialId` (globals
 *      are the roots — a parent makes no sense and confuses resolvers).
 *   2. A `tier: 'project'` doc from being created with no parent, which
 *      silently turns a supposed override into a standalone material
 *      that can't ever collapse back into the parent when the override
 *      is deleted.
 *
 * This module is the invariant, expressed as pure functions so it can be
 * shared between the write path (`materialService.create*`), admin tools,
 * and backfill scripts. It returns a typed error class rather than
 * throwing strings so callers can differentiate "expected validation
 * rejection" from "Firestore write failure".
 *
 * Semantic summary — the rule we enforce:
 *
 *   global:   parentMaterialId MUST be undefined (no parent possible).
 *   customer: parentMaterialId OPTIONAL — may override a global, or be
 *             a standalone customer-specific material with no global
 *             equivalent. Legitimate business use case; don't block.
 *   project:  parentMaterialId REQUIRED — project materials are always
 *             overrides of a higher-tier (global or customer) row.
 *             Standalone project materials are a data-modelling mistake:
 *             they should have been a customer or global material.
 *
 * The customer tier's "allow either" stance is deliberate — F20 says
 * "require parentMaterialId when tier !== 'global'" but that would
 * break the legitimate pattern of a customer bringing their own unique
 * material. Callers who DO want to enforce the stricter rule (e.g. a
 * bulk-import flow that only accepts overrides) can pass
 * `{ requireParentForCustomer: true }` to get the tight check.
 */
import type { MaterialTier } from '../types/materials';

export type MaterialTierViolation =
  | 'global_has_parent'
  | 'project_missing_parent'
  | 'customer_missing_parent' // only surfaced when caller opts in
  | 'self_parent';

export class MaterialTierInvariantError extends Error {
  readonly code: MaterialTierViolation;
  readonly tier: MaterialTier;
  readonly parentMaterialId?: string;
  readonly materialId?: string;

  constructor(
    code: MaterialTierViolation,
    tier: MaterialTier,
    parentMaterialId?: string,
    materialId?: string,
  ) {
    super(
      `Material tier invariant violated (${code}): tier=${tier}` +
        (parentMaterialId ? `, parentMaterialId=${parentMaterialId}` : '') +
        (materialId ? `, materialId=${materialId}` : ''),
    );
    this.name = 'MaterialTierInvariantError';
    this.code = code;
    this.tier = tier;
    this.parentMaterialId = parentMaterialId;
    this.materialId = materialId;
  }
}

export interface ValidateMaterialTierOptions {
  /**
   * If true, customer-tier materials MUST also reference a parent.
   * Defaults to false — customer-tier is allowed to be standalone.
   * Turn this on in flows that ingest override sets (bulk copy from
   * another customer, e.g.) where a missing parent is always a bug.
   */
  requireParentForCustomer?: boolean;
}

/**
 * Pure validator — returns the first violation detected, or `null` if
 * the tier/parent pair is consistent with the invariant. Prefer
 * `assertMaterialTierInvariant` at write sites (it throws on
 * violation); use this direct form in UI validators that want to
 * surface the error inline without a try/catch.
 */
export function validateMaterialTier(
  tier: MaterialTier,
  parentMaterialId: string | undefined,
  materialId: string | undefined = undefined,
  options: ValidateMaterialTierOptions = {},
): MaterialTierViolation | null {
  // Self-parent check always runs — even on a global tier (which
  // shouldn't have a parent at all, but if someone passes one AND it
  // equals the material's own id, that's worth calling out explicitly).
  if (
    parentMaterialId &&
    materialId &&
    parentMaterialId === materialId
  ) {
    return 'self_parent';
  }

  if (tier === 'global') {
    if (parentMaterialId) return 'global_has_parent';
    return null;
  }

  if (tier === 'project') {
    if (!parentMaterialId) return 'project_missing_parent';
    return null;
  }

  // tier === 'customer'
  if (options.requireParentForCustomer && !parentMaterialId) {
    return 'customer_missing_parent';
  }
  return null;
}

/**
 * Assert form — throws `MaterialTierInvariantError` on violation. Use
 * at the top of create/update service functions so bad writes fail
 * loud instead of silently polluting Firestore.
 */
export function assertMaterialTierInvariant(
  tier: MaterialTier,
  parentMaterialId: string | undefined,
  materialId?: string,
  options: ValidateMaterialTierOptions = {},
): void {
  const violation = validateMaterialTier(tier, parentMaterialId, materialId, options);
  if (violation) {
    throw new MaterialTierInvariantError(violation, tier, parentMaterialId, materialId);
  }
}
