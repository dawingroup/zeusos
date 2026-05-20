/**
 * fkResolvers — shared FK reader/writer helpers for the canonical deal FK.
 *
 * P16/F13 history: SalesOrder used to carry `crmDealId` and DesignProject
 * used to carry `linkedDealId` — two names for the same thing. P16 introduced
 * a canonical `dealId` on both, writers dual-stamped during a transition
 * window, readers went through `resolveDealId()` with a fallback, and a
 * backfill (scripts/backfill-canonical-dealId.cjs) copied every legacy row
 * forward. The backfill ran 2026-04-18 — zero drift, zero legacy-only rows
 * left — and the `crmDealId` / `linkedDealId` fields were dropped from the
 * TS types.
 *
 * What's kept in this module after the migration:
 *
 *   - `resolveDealId()` survives as a null-safe pass-through. Call sites
 *     that already use it don't need to change, and it keeps a single
 *     readable idiom across modules (`resolveDealId(entity)` instead of
 *     `entity?.dealId`).
 *
 *   - `stampSalesOrderDealId()` / `stampDesignProjectDealId()` survive as
 *     tiny spreadable helpers. They no longer dual-stamp — both return
 *     `{ dealId }` — but keeping them means writers don't need to change
 *     shape and the types stay centralized here if we ever add another
 *     cross-subsidiary party stamp.
 */

interface DealIdBearing {
  dealId?: string;
}

/**
 * Read the canonical CRM deal FK off a SalesOrder- or DesignProject-shaped
 * object. Null-safe pass-through; returns `undefined` when the entity or
 * its `dealId` is missing.
 */
export function resolveDealId(entity: DealIdBearing | null | undefined): string | undefined {
  return entity?.dealId;
}

/**
 * Writer helper for a sales order: returns `{ dealId }` as a spreadable
 * patch, or `{}` when the input is undefined. Kept as a named helper so
 * the creation sites read consistently and so any future cross-stamp
 * (e.g. `partyId`) has a natural home.
 */
export function stampSalesOrderDealId(dealId: string | undefined): { dealId?: string } {
  if (dealId === undefined) return {};
  return { dealId };
}

/** Same as `stampSalesOrderDealId` for design projects. */
export function stampDesignProjectDealId(dealId: string | undefined): { dealId?: string } {
  if (dealId === undefined) return {};
  return { dealId };
}
