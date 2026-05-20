/**
 * Feature-library cost contribution helpers — P17/F19.
 *
 * The FeatureLibrary models reusable manufacturing operations ("soft-
 * close hinge prep", "mitre-finger joint", "UV-lacquer clearcoat") with
 * an estimated labor-time envelope + cost-factor multipliers. Features
 * are NOT priced in absolute currency — the library stores hours and
 * multipliers, and the concrete cost only exists in the context of a
 * specific part + the shop's current labor rate.
 *
 * This module is the pure translator. Given a set of linked features
 * and the shop labor rate, it returns the hours, cost, and a per-feature
 * breakdown for the rollup. Keeping it pure (no Firestore, no services)
 * lets it be reused from the estimate service, UI preview panels, and
 * tests without plumbing.
 *
 * Semantics — deliberately conservative:
 *
 *   1. We use `estimatedTime.typical` as the baseline. `minimum` and
 *      `maximum` exist on the library model but aren't appropriate for
 *      a "what will this cost" estimate — that's the job of an explicit
 *      risk range, not the rollup.
 *
 *   2. `laborIntensity` scales hours (low 0.75, medium 1.0, high 1.25,
 *      very-high 1.5). Intensity is the library's way of saying "this
 *      feature takes longer than its nominal typical time when the part
 *      is non-trivial" — we treat it as a flat multiplier on typical.
 *
 *   3. `skillLevel` scales the labor rate (apprentice 0.7, journeyman
 *      1.0, master 1.35). Master features pay the lead rate; apprentice
 *      features pay a discounted rate. If the caller doesn't want this
 *      effect, pass a fixed rate and it collapses out.
 *
 *   4. `setupTime` (minutes) is added ONCE per feature, not per part
 *      quantity — setup is a fixed cost of introducing the feature to
 *      the job, not a per-part cost. Callers that want setup amortised
 *      across parts should divide by the batch size at the call site.
 *
 *   5. `wastePercent` and `toolingRequired` are NOT rolled into this
 *      cost — they live on the material / tooling budgets respectively
 *      and will be consumed by separate calc paths. This function
 *      returns labor cost only.
 *
 * Consumers: `estimateService.calculateManufacturingCost` (future
 * slice 2), the design-studio print-package cost summary, and UI
 * previews in the PartEntry edit drawer.
 */
import type { FeatureLibraryItem, LaborIntensity, SkillLevel } from '../types/featureLibrary';

/** Multiplier on typical hours by labor intensity. */
const INTENSITY_MULTIPLIER: Record<LaborIntensity, number> = {
  low: 0.75,
  medium: 1.0,
  high: 1.25,
  'very-high': 1.5,
};

/** Multiplier on labor rate by skill level. */
const SKILL_RATE_MULTIPLIER: Record<SkillLevel, number> = {
  apprentice: 0.7,
  journeyman: 1.0,
  master: 1.35,
};

export interface FeatureCostContribution {
  featureId: string;
  featureCode: string;
  featureName: string;
  /** Hours (typical × intensity) + setup converted to hours. */
  hours: number;
  /** Effective labor rate after skill multiplier. */
  effectiveRate: number;
  /** `hours * effectiveRate`. */
  laborCost: number;
  /** Currency echo — same string the caller passed in. */
  currency: string;
}

export interface FeatureCostBreakdown {
  contributions: FeatureCostContribution[];
  totalHours: number;
  totalLaborCost: number;
  currency: string;
  /** Features that were requested but couldn't be resolved in the
   * supplied library (e.g. stale featureId after a deletion). The
   * caller typically wants to flag these in the UI rather than silently
   * drop them. */
  unresolvedFeatureIds: string[];
}

export interface CalculateFeatureCostOptions {
  /** Labor rate in the returned currency, per hour, at journeyman
   * level. Skill multipliers are applied on top. */
  laborRatePerHour: number;
  currency: string;
}

/**
 * Compute the feature-cost contribution for a single part given its
 * linked feature ids and the library. Returns the per-feature
 * breakdown + totals. Empty / missing inputs yield zeros.
 */
export function calculatePartFeatureCost(
  featureIds: string[] | undefined,
  library: Pick<FeatureLibraryItem, 'id' | 'code' | 'name' | 'estimatedTime' | 'costFactors'>[],
  options: CalculateFeatureCostOptions,
): FeatureCostBreakdown {
  const empty: FeatureCostBreakdown = {
    contributions: [],
    totalHours: 0,
    totalLaborCost: 0,
    currency: options.currency,
    unresolvedFeatureIds: [],
  };
  if (!featureIds || featureIds.length === 0) return empty;

  const byId = new Map(library.map((f) => [f.id, f]));
  const contributions: FeatureCostContribution[] = [];
  const unresolved: string[] = [];

  for (const id of featureIds) {
    const feature = byId.get(id);
    if (!feature) {
      unresolved.push(id);
      continue;
    }
    const typical = feature.estimatedTime?.typical ?? 0;
    const intensityMult = INTENSITY_MULTIPLIER[feature.costFactors.laborIntensity] ?? 1.0;
    const setupHours = (feature.costFactors.setupTime ?? 0) / 60;
    const hours = typical * intensityMult + setupHours;

    const skillMult = SKILL_RATE_MULTIPLIER[feature.costFactors.skillLevel] ?? 1.0;
    const effectiveRate = options.laborRatePerHour * skillMult;
    const laborCost = hours * effectiveRate;

    contributions.push({
      featureId: feature.id,
      featureCode: feature.code,
      featureName: feature.name,
      hours,
      effectiveRate,
      laborCost,
      currency: options.currency,
    });
  }

  const totalHours = contributions.reduce((sum, c) => sum + c.hours, 0);
  const totalLaborCost = contributions.reduce((sum, c) => sum + c.laborCost, 0);
  return {
    contributions,
    totalHours,
    totalLaborCost,
    currency: options.currency,
    unresolvedFeatureIds: unresolved,
  };
}

/**
 * Convenience helper: sum a part's feature cost across its full quantity.
 * `setupTime` intentionally does NOT multiply — it's a one-shot cost
 * regardless of how many parts carry the feature. Per-feature hours
 * other than setup DO multiply by qty.
 */
export function scaleFeatureCostByQuantity(
  breakdown: FeatureCostBreakdown,
  quantity: number,
  library: Pick<FeatureLibraryItem, 'id' | 'costFactors'>[],
): FeatureCostBreakdown {
  if (quantity <= 1) return breakdown;
  const libById = new Map(library.map((f) => [f.id, f]));

  const scaledContribs = breakdown.contributions.map((c) => {
    const setupHours = (libById.get(c.featureId)?.costFactors.setupTime ?? 0) / 60;
    const perPartHours = c.hours - setupHours;
    const scaledHours = perPartHours * quantity + setupHours;
    const scaledCost = scaledHours * c.effectiveRate;
    return { ...c, hours: scaledHours, laborCost: scaledCost };
  });

  return {
    ...breakdown,
    contributions: scaledContribs,
    totalHours: scaledContribs.reduce((s, c) => s + c.hours, 0),
    totalLaborCost: scaledContribs.reduce((s, c) => s + c.laborCost, 0),
  };
}
