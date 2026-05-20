/**
 * scheduleLibraryResolvers — factories that turn a SCOPED set of ids
 * (only the finishes / inventory items a given PDF actually needs)
 * into synchronous resolvers the aggregators + enrichers call.
 *
 * Why scoped:
 *   - The Finish Library + Inventory collections can each hold hundreds
 *     of entries. A PDF export needs 3–20 of them. Fetching the
 *     entire library every time is wasteful AND means the schedule
 *     renderer would have to filter itself. Pre-scoping the resolver
 *     to only the ids in use ALSO guarantees the rendered schedule is
 *     "sorted to only return the finishes / hardware required for
 *     the PDF" — the stated requirement.
 *
 *   - Each resolver returns a Map-backed closure so call-sites stay
 *     synchronous (`resolver(id) → record | undefined`) and the
 *     aggregator code doesn't leak `Promise<T>` back to the renderer.
 *
 * Batch-fetch pattern:
 *   - `Promise.all(ids.map(getOne))` — Firestore's getDoc is already
 *     cached by the SDK for short-window repeats, and 20 parallel
 *     getDoc calls cost less than a single collection scan. A proper
 *     `whereIn(...)` would be nicer but `getDoc` doesn't support it
 *     for arbitrary document ids.
 */
import { getFinish } from '@/modules/inventory/services/finishLibraryService';
import { getInventoryItem } from '@/modules/inventory/services/inventoryService';
import type { ResolvedFinish, FinishResolver } from './finishScheduleAggregator';
import type { InventoryItem } from '@/modules/inventory/types/inventory';

// ---------------------------------------------------------------------------
// Finish Library
// ---------------------------------------------------------------------------

/**
 * Fetch every finishLibraryId in `ids` (deduped, blanks filtered) and
 * return a synchronous resolver the PDF renderer can call for each
 * schedule row. Unknown ids resolve to `undefined` — the renderer then
 * renders the raw id + a grey "no colour" swatch.
 */
export async function createFinishLibraryResolver(
  ids: Iterable<string>,
): Promise<FinishResolver> {
  const scope = Array.from(new Set(Array.from(ids).filter(Boolean)));
  if (scope.length === 0) {
    return () => undefined;
  }
  const entries = await Promise.all(scope.map(async id => {
    try {
      const doc = await getFinish(id);
      if (!doc) return [id, undefined] as const;
      const resolved: ResolvedFinish = {
        id: doc.id,
        name: doc.name,
        code: doc.code,
        colorHex: doc.hexColor,
        description: doc.notes || `${doc.category}${doc.subtype ? ` · ${doc.subtype}` : ''}`,
      };
      return [id, resolved] as const;
    } catch {
      // Failed read — leave unresolved.
      return [id, undefined] as const;
    }
  }));
  const map = new Map<string, ResolvedFinish | undefined>(entries);
  return (id: string) => map.get(id);
}

// ---------------------------------------------------------------------------
// Inventory / Materials
// ---------------------------------------------------------------------------

/** Shape the PDF uses — a projection of InventoryItem. */
export interface ResolvedInventoryItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  supplier?: string;
  unitCost?: number;
  currency?: string;
  unit?: string;
}

export type InventoryResolver = (id: string) => ResolvedInventoryItem | undefined;

function projectInventoryItem(doc: InventoryItem): ResolvedInventoryItem {
  // Prefer the first vendor source's name as the "supplier" label
  // when present; vendorSources[0].supplierName is the typical shape.
  const vendor = doc.vendorSources?.[0];
  const supplierName =
    (vendor as unknown as { supplierName?: string })?.supplierName
    ?? (vendor as unknown as { vendorName?: string })?.vendorName
    ?? undefined;

  return {
    id: doc.id,
    sku: doc.sku,
    name: doc.displayName || doc.name,
    description: doc.description,
    category: doc.category,
    subcategory: doc.subcategory,
    brand: doc.brand,
    supplier: supplierName,
    unitCost: doc.pricing?.costPerUnit,
    currency: doc.pricing?.currency,
    unit: doc.pricing?.unit ?? doc.stockUom ?? doc.purchaseUom,
  };
}

/**
 * Fetch every inventoryItemId in `ids` and return a synchronous
 * resolver. Pattern mirrors `createFinishLibraryResolver`.
 */
export async function createInventoryResolver(
  ids: Iterable<string>,
): Promise<InventoryResolver> {
  const scope = Array.from(new Set(Array.from(ids).filter(Boolean)));
  if (scope.length === 0) {
    return () => undefined;
  }
  const entries = await Promise.all(scope.map(async id => {
    try {
      const doc = await getInventoryItem(id);
      if (!doc) return [id, undefined] as const;
      return [id, projectInventoryItem(doc)] as const;
    } catch {
      return [id, undefined] as const;
    }
  }));
  const map = new Map<string, ResolvedInventoryItem | undefined>(entries);
  return (id: string) => map.get(id);
}
