/**
 * materialCost — P12 (F11 — Material vs InventoryItem cost reconciliation).
 *
 * The data-model audit (F11) flagged that `Material.pricing.unitCost`
 * and the linked `InventoryItem.pricing.costPerUnit` are two separate
 * truth sources for the same economic fact — the purchase cost of one
 * unit of a material. Today they drift silently: design-time estimates
 * use Material.pricing, procurement uses InventoryItem.cost.
 *
 * The P12 rollout makes InventoryItem the source of truth for cost
 * when a material has an `inventoryItemId`, but still lets operators
 * pin an explicit override on the Material (e.g. when a one-off supplier
 * quote differs from the canonical stock cost). Overrides are flagged
 * + audit-logged so reports can separate "derived from inventory" from
 * "manually pinned".
 *
 * P12 rollout (additive, mirrors P11):
 *   P12-1 (this file) — override metadata on MaterialPricing + pure
 *                       resolver helper. No consumers; no writers touch
 *                       overrides yet.
 *   P12-2             — service helper that hydrates a Material with
 *                       its linked InventoryItem.pricing and calls the
 *                       resolver. Single entry point for readers.
 *   P12-3             — writers: material edit form surfaces an
 *                       "override" toggle that stamps the metadata.
 *   P12-4             — readers migrate to the resolver. Cost divergence
 *                       surfaces as a badge on material list + detail.
 *   P12-5             — audit: backfill `isOverride` flag on existing
 *                       rows that have a pricing.unitCost AND an
 *                       inventoryItemId (best-effort: assume any such
 *                       row IS an override until proven otherwise).
 *
 * Kept pure (no Firestore imports, no subsidiary imports) so the
 * resolver can be called from BOM calculators, quote engines, and UI
 * list rows without dragging a service dependency.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Where a resolved unit cost came from. The value is authoritative for
 * that source — callers deciding which currency to convert, or whether
 * to refresh on a stale `updatedAt`, branch on this tag.
 */
export type MaterialCostSource =
  | 'inventory' //  Resolved from the linked InventoryItem.pricing.
  | 'material'  //  No inventory link; Material.pricing is the only truth.
  | 'override'; //  Material.pricing.isOverride === true; explicitly pinned
                //  even though an InventoryItem exists. Treat as
                //  authoritative for this material, but surface a badge.

/**
 * Resolved unit cost for a material. Returned by `resolveMaterialUnitCost`.
 * Shape kept narrow — anything beyond the cost + source (e.g. landed
 * cost breakdown, margin) should be resolved from the source record
 * directly by callers that need it.
 */
export interface ResolvedMaterialCost {
  unitCost: number;
  currency: string;
  source: MaterialCostSource;
  /** Convenience mirror of `source === 'override'`. */
  isOverride: boolean;
  /** Reason captured at override time, if any. */
  overrideReason?: string;
}

/**
 * Structural minimum a Material-like value needs to be resolvable. We
 * type this way (rather than importing `Material` from materials.ts)
 * so the helper stays cycle-free and is trivially testable with fixture
 * objects — also lets BOQ and estimate modules pass their own leaner
 * shapes.
 */
export interface MaterialCostLike {
  inventoryItemId?: string;
  pricing?: {
    unitCost?: number;
    currency?: string;
    /**
     * P12-1 override flag. Writers set this to true when an operator
     * explicitly pins a Material.pricing.unitCost that differs from
     * (or ignores) the linked InventoryItem. Absence = false.
     */
    isOverride?: boolean;
    /**
     * Free-text reason captured with the override. Shown in audit views
     * and tooltips. Not enforced — writers may omit.
     */
    overrideReason?: string;
  };
}

/**
 * Minimum inventory-pricing shape the resolver needs. Matches the
 * `InventoryItem.pricing` subset: the supplier's per-unit cost in
 * their transaction currency.
 *
 * Callers that have already converted to functional currency should
 * pass the converted value; the resolver does NOT do FX.
 */
export interface InventoryCostLike {
  costPerUnit: number;
  currency: string;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Resolve the canonical unit cost for a material.
 *
 * Precedence (first match wins):
 *   1. `material.pricing.isOverride === true` AND pricing has a complete
 *      unitCost+currency pair → `source: 'override'`. The inventory
 *      value (if supplied) is ignored. Writers should only set
 *      `isOverride` when they ALSO set unitCost/currency, but we
 *      defensively fall through when the pair is incomplete.
 *   2. `material.inventoryItemId` is set AND `inventoryCost` is supplied
 *      AND the supplied cost has both fields → `source: 'inventory'`.
 *      This is the P12 happy path: InventoryItem is the source of truth
 *      when the link exists.
 *   3. `material.pricing` has a complete unitCost+currency pair →
 *      `source: 'material'`. No inventory link, or caller didn't
 *      supply inventoryCost; Material.pricing is the only truth.
 *   4. Otherwise → null. The material has no resolvable cost. Callers
 *      should treat this as "unknown" — do NOT default to zero.
 *
 * Intentionally does NOT mutate either input and does NOT compare
 * Material.pricing.unitCost against the inventory cost to flag drift —
 * that's a separate concern (`detectMaterialCostDrift` in P12-2).
 *
 * Pure / synchronous — callers that only have `material.inventoryItemId`
 * should resolve the inventory cost themselves (service call) and pass
 * it in. Keeping the fetch out of here means the resolver can be used
 * inside tight list-render loops where the inventory map is already
 * hydrated in bulk.
 */
export function resolveMaterialUnitCost(
  material: MaterialCostLike,
  inventoryCost?: InventoryCostLike | null,
): ResolvedMaterialCost | null {
  const pricing = material.pricing;
  const hasMaterialPricing =
    !!pricing &&
    typeof pricing.unitCost === 'number' &&
    typeof pricing.currency === 'string' &&
    pricing.currency.length > 0;

  // 1. Explicit override wins over inventory link.
  if (pricing?.isOverride && hasMaterialPricing) {
    return {
      unitCost: pricing.unitCost as number,
      currency: pricing.currency as string,
      source: 'override',
      isOverride: true,
      overrideReason: pricing.overrideReason,
    };
  }

  // 2. Inventory is the source of truth when linked and supplied.
  if (
    material.inventoryItemId &&
    inventoryCost &&
    typeof inventoryCost.costPerUnit === 'number' &&
    typeof inventoryCost.currency === 'string' &&
    inventoryCost.currency.length > 0
  ) {
    return {
      unitCost: inventoryCost.costPerUnit,
      currency: inventoryCost.currency,
      source: 'inventory',
      isOverride: false,
    };
  }

  // 3. Fallback to Material.pricing when it's complete.
  if (hasMaterialPricing) {
    return {
      unitCost: pricing.unitCost as number,
      currency: pricing.currency as string,
      source: 'material',
      isOverride: false,
    };
  }

  // 4. Nothing resolvable.
  return null;
}

/**
 * True when the override metadata is internally inconsistent — e.g.
 * `isOverride: true` without a concrete unitCost/currency, or a stray
 * `overrideReason` with no `isOverride`. Used by the P12-3 writer to
 * refuse invalid saves, and by the P12-4 reader to surface a "check
 * pricing" badge on legacy rows that were mid-edit when the flag was
 * introduced.
 */
/**
 * The subset of `MaterialPricing` the stamp helper cares about. Typed
 * separately (rather than reaching into the full `MaterialPricing`)
 * so service writers can pass minimal payloads and so tests can use
 * plain objects without reconstructing the full pricing shape.
 *
 * `overrideAt` is typed as `unknown` because Firestore writers pass
 * the `serverTimestamp()` sentinel while readers / tests pass a real
 * `Timestamp`. Both are valid at write time; narrowing here would
 * force writers to cast, which is worse than the one `unknown`.
 */
export interface PricingOverrideFields {
  isOverride?: boolean;
  overrideReason?: string;
  overrideAt?: unknown;
  overrideBy?: string;
}

/**
 * Stamp override audit metadata on an incoming pricing payload.
 *
 * Behavior:
 *   - `isOverride` newly true (previous was false/absent)
 *       → stamp `overrideAt = now`, `overrideBy = userId`.
 *       This is the "first toggle" stamp — an operator acknowledging
 *       the inventory link should be ignored for this material.
 *   - `isOverride` still true (was already override)
 *       → PRESERVE the previous `overrideAt`/`overrideBy`. Re-stamping
 *       on every save would turn the field into "last-edit" not
 *       "first-toggled", which defeats the audit purpose. Callers
 *       editing a reason on an existing override don't reset the clock.
 *   - `isOverride` false/absent
 *       → strip the stamp fields + reason so the row stops advertising
 *       an override. Returns `isOverride: false` explicitly so the
 *       write is unambiguous (rather than relying on absence).
 *
 * Pure — takes `now` as a parameter so the Firestore `serverTimestamp()`
 * sentinel or a real `Timestamp` both work. Tests pass a plain value.
 *
 * Generic so the return type preserves any extra fields on the incoming
 * pricing object (unitCost, currency, unit, supplier, etc.). Callers
 * can feed the full `MaterialPricing` in and back out with audit fields
 * correctly set without reconstructing the rest of the object.
 */
export function stampMaterialCostOverride<P extends object>(
  incoming: P & PricingOverrideFields,
  previous: PricingOverrideFields | null | undefined,
  userId: string,
  now: unknown,
): P & PricingOverrideFields {
  if (!incoming.isOverride) {
    // Turning off (or never on) — clear stamp fields + reason.
    return {
      ...incoming,
      isOverride: false,
      overrideAt: undefined,
      overrideBy: undefined,
      overrideReason: undefined,
    };
  }
  const wasOverride = !!previous?.isOverride;
  if (wasOverride) {
    // Already an override — preserve the original stamps. If the
    // incoming payload carries explicit stamps (e.g. a backfill script
    // reapplying audited values) honour them; otherwise keep the prior.
    return {
      ...incoming,
      overrideAt: incoming.overrideAt ?? previous?.overrideAt,
      overrideBy: incoming.overrideBy ?? previous?.overrideBy,
    };
  }
  // Transition false → true. Stamp with the caller's `now` + userId.
  return {
    ...incoming,
    overrideAt: now,
    overrideBy: userId,
  };
}

export function isMaterialPricingOverrideInvalid(
  pricing: MaterialCostLike['pricing'],
): boolean {
  if (!pricing) return false;
  if (pricing.isOverride) {
    // Claimed to be an override but missing the concrete values that
    // justify overriding — treat as invalid.
    if (typeof pricing.unitCost !== 'number') return true;
    if (typeof pricing.currency !== 'string' || pricing.currency.length === 0) {
      return true;
    }
    return false;
  }
  // `overrideReason` without `isOverride` is a stale leftover from an
  // abandoned edit — flag it so writers can clean up or reapply.
  if (pricing.overrideReason) return true;
  return false;
}
