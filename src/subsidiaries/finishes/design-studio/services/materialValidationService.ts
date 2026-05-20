/**
 * materialValidationService — P13/F15.
 *
 * The data-model audit (F15) flagged that `useMaterialResolver()` maps
 * 3D-model materials to Finish Library entries with no check that the
 * matched finish actually has a procurable backing. Result: BOMs and
 * print packages can reference finishes with no inventory link — or
 * worse, finishes whose linked inventory is out of stock — and the
 * user only finds out downstream when procurement can't source them.
 *
 * This service turns a set of `MaterialMapping`s into a list of
 * blocking `MaterialException`s that the print-package gate (P13b)
 * can surface.
 *
 * Kept pure (no Firestore imports) so the rules live in one place and
 * can be unit-tested without emulators. The hook layer fetches
 * FinishDocuments and stock aggregates, then hands them in as lookups.
 *
 * Exception reasons, in order of severity:
 *   1. `no_finish_match`       — the resolver couldn't match this material
 *                                 to any finish at all. Nothing to procure.
 *   2. `missing_inventory_link`— the finish exists but has no
 *                                 `inventoryItemId`. Procurement can't
 *                                 source it. This is the F15 driver.
 *   3. `discontinued`          — `finish.availability === 'discontinued'`.
 *                                 Even with an inventoryItemId, the finish
 *                                 is EOL and shouldn't ship.
 *   4. `zero_stock`            — finish has an inventoryItemId but the
 *                                 aggregate `totalAvailable` is zero.
 *                                 Production would block on procurement.
 *
 * `made_to_order` availability is NOT an exception — it's the explicit
 * contract that stock is produced on demand. We only flag `discontinued`.
 */

import type { FinishDocument } from '@/modules/inventory/types/finishLibrary';
import type { MaterialMapping } from './materialResolverService';

export type MaterialExceptionReason =
  | 'no_finish_match'
  | 'missing_inventory_link'
  | 'discontinued'
  | 'zero_stock';

/**
 * A single blocking problem with one of the material mappings.
 *
 * `threeDsMaterialName` is always set — that's the mapping's stable
 * identifier in the model. `finishId` / `finishName` are only populated
 * when a match did happen (so unmatched exceptions only carry the
 * material name).
 */
export interface MaterialException {
  threeDsMaterialName: string;
  reason: MaterialExceptionReason;
  finishId?: string;
  finishName?: string;
  finishCode?: string;
  /** Aggregate `totalAvailable` for the linked inventory item, when known. */
  availableStock?: number;
}

/** Compact aggregate shape the validator reads. Matches `getAggregatedStock` return. */
export interface StockAggregate {
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
}

/** Validator input — lookups the caller has resolved upstream. */
export interface ValidateMaterialMappingsInput {
  mappings: MaterialMapping[];
  /** Finish documents, keyed by `finish.id`. Used to read inventoryItemId + availability. */
  finishById: Map<string, FinishDocument> | Record<string, FinishDocument>;
  /** Stock aggregates, keyed by `inventoryItemId`. Undefined means "not yet loaded". */
  stockByInventoryItemId: Map<string, StockAggregate> | Record<string, StockAggregate>;
}

// ---------------------------------------------------------------------------
// Lookup helpers — accept either Map or plain object so callers aren't
// forced into one shape. The hook in P13b will use Map (lookup is hot in
// render paths); tests and fixtures are easier to author as plain objects.
// ---------------------------------------------------------------------------

function lookup<V>(
  source: Map<string, V> | Record<string, V>,
  key: string,
): V | undefined {
  if (source instanceof Map) return source.get(key);
  return source[key];
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Compute the blocking material exceptions for a set of resolved mappings.
 *
 * Rules:
 *   - At most ONE exception per mapping. Order of checks = order of
 *     severity (above). First match wins so the UI doesn't double-count
 *     (e.g. a discontinued finish with zero stock surfaces as
 *     `discontinued`, which is the actionable reason).
 *   - If stock data isn't loaded yet (undefined aggregate), we do NOT
 *     emit a zero_stock exception — a missing aggregate is a loading
 *     state, not a failure. The hook is responsible for withholding
 *     the "ok to print" signal until the lookups resolve.
 */
export function validateMaterialMappings(
  input: ValidateMaterialMappingsInput,
): MaterialException[] {
  const { mappings, finishById, stockByInventoryItemId } = input;
  const exceptions: MaterialException[] = [];

  for (const mapping of mappings) {
    // (1) Resolver produced no match — confidence 0, empty finishLibraryId.
    if (!mapping.finishLibraryId || mapping.confidence === 0) {
      exceptions.push({
        threeDsMaterialName: mapping.threeDsMaterialName,
        reason: 'no_finish_match',
      });
      continue;
    }

    const finish = lookup(finishById, mapping.finishLibraryId);
    if (!finish) {
      // Finish id in mapping but we couldn't find the doc — treat as
      // no_finish_match. This only happens if the finish was deleted
      // after the mapping was resolved; same user action needed (re-map).
      exceptions.push({
        threeDsMaterialName: mapping.threeDsMaterialName,
        reason: 'no_finish_match',
        finishId: mapping.finishLibraryId,
      });
      continue;
    }

    // (2) Finish exists but nothing to procure against.
    if (!finish.inventoryItemId) {
      exceptions.push({
        threeDsMaterialName: mapping.threeDsMaterialName,
        reason: 'missing_inventory_link',
        finishId: finish.id,
        finishName: finish.name,
        finishCode: finish.code,
      });
      continue;
    }

    // (3) Discontinued wins over zero_stock — it's the more actionable
    // reason ("pick a replacement finish") and fixing stock wouldn't
    // unblock the user.
    if (finish.availability === 'discontinued') {
      exceptions.push({
        threeDsMaterialName: mapping.threeDsMaterialName,
        reason: 'discontinued',
        finishId: finish.id,
        finishName: finish.name,
        finishCode: finish.code,
      });
      continue;
    }

    // (4) Stock check — only when we have a loaded aggregate AND the
    // finish isn't made-to-order. made_to_order explicitly opts out of
    // stock gating.
    if (finish.availability === 'made_to_order') continue;
    const stock = lookup(stockByInventoryItemId, finish.inventoryItemId);
    if (stock && stock.totalAvailable <= 0) {
      exceptions.push({
        threeDsMaterialName: mapping.threeDsMaterialName,
        reason: 'zero_stock',
        finishId: finish.id,
        finishName: finish.name,
        finishCode: finish.code,
        availableStock: stock.totalAvailable,
      });
    }
  }

  return exceptions;
}

/**
 * Convenience predicate for the print-package gate.
 *
 * Returns true when there are zero blocking exceptions — i.e. every
 * mapping has a matched, linked, available finish. Callers should
 * wait for the stock aggregates to be loaded before trusting this
 * value (see `useMaterialValidation` in P13b for the loading contract).
 */
export function isMaterialMappingPrintReady(exceptions: MaterialException[]): boolean {
  return exceptions.length === 0;
}

/**
 * Thrown when a caller attempts to generate a print package (or other
 * procurement-binding artifact) while blocking material exceptions are
 * present. Carries the exception list so the UI can render the same
 * "material exceptions" block the button-gate already uses.
 *
 * P13 hardening: the UI gate in `ExportConfigPanel` disables the submit
 * button, but `usePrintPackage.generate()` is a public hook API that
 * any component can call. Without a service-layer throw, a refactor or
 * a new caller could silently ship an invalid BOM. This error makes
 * the gate authoritative.
 */
export class MaterialValidationError extends Error {
  readonly exceptions: MaterialException[];
  constructor(exceptions: MaterialException[]) {
    super(
      `Cannot proceed: ${exceptions.length} material exception${exceptions.length === 1 ? '' : 's'} blocking print package.`,
    );
    this.name = 'MaterialValidationError';
    this.exceptions = exceptions;
  }
}

/**
 * Assert the mapping set is print-ready. Throws `MaterialValidationError`
 * with the full exception list if anything is blocking.
 *
 * Call from any code path that turns a mapping set into a procurement
 * artifact (print package, MO attachment, quote PDF, etc.) so the same
 * rule is enforced regardless of which UI invokes it.
 */
export function assertPrintReady(exceptions: MaterialException[]): void {
  if (exceptions.length > 0) {
    throw new MaterialValidationError(exceptions);
  }
}

/**
 * Human-readable one-line description of an exception. Safe to use in
 * toast / alert copy without additional formatting.
 */
export function describeMaterialException(ex: MaterialException): string {
  switch (ex.reason) {
    case 'no_finish_match':
      return `"${ex.threeDsMaterialName}" has no matching finish in the library.`;
    case 'missing_inventory_link':
      return `Finish "${ex.finishName ?? ex.finishId}" is not linked to an inventory item — procurement can't source it.`;
    case 'discontinued':
      return `Finish "${ex.finishName ?? ex.finishId}" is discontinued. Pick a replacement.`;
    case 'zero_stock':
      return `Finish "${ex.finishName ?? ex.finishId}" has zero available stock.`;
  }
}
