/**
 * hardwareScheduleEnricher — marry a scene's raw HardwareScheduleEntry
 * (mesh-derived count + name) to the Materials library (inventoryItems
 * collection) so the PDF schedule carries the full spec a procurement
 * user expects: SKU, supplier, cost, description.
 *
 * Sorted + filtered to the hardware present in the scene (via the
 * upstream `extractHardwareSchedule` pass) so the resulting rows are
 * exactly what the PDF needs — nothing from the Materials library
 * outside the scene's footprint.
 */
import type { HardwareScheduleEntry } from '../types/mdp.types';
import type { InventoryResolver, ResolvedInventoryItem } from './scheduleLibraryResolvers';

/** One enriched row ready for the PDF hardware-schedule renderer. */
export interface EnrichedHardwareEntry {
  // Pass-throughs from HardwareScheduleEntry.
  hardwareName: string;
  inventoryItemId: string;
  quantity: number;
  perUnit: string;
  boringRequired: boolean;
  notes?: string;

  // From the Materials library — all optional so unresolved rows
  // render cleanly with em-dashes instead of hard errors.
  sku?: string;
  resolvedName?: string;
  description?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  supplier?: string;
  unitCost?: number;
  currency?: string;
  unit?: string;

  /** True when the Materials-library lookup succeeded. UI can flag
   *  unresolved rows so the user fixes missing inventoryItemId links. */
  resolved: boolean;
}

/**
 * Enrich every hardware row in-order. Unresolved rows keep the raw
 * hardwareName and carry `resolved: false` so the PDF can optionally
 * style them differently (italic / "needs linking" note).
 *
 * Sort order: resolved rows first, then by category → subcategory →
 * name, so related hardware clusters together in the schedule.
 * Unresolved rows fall to the bottom so they're easy to spot and fix.
 */
export function enrichHardwareSchedule(
  entries: ReadonlyArray<HardwareScheduleEntry>,
  resolve: InventoryResolver = () => undefined,
): EnrichedHardwareEntry[] {
  const out: EnrichedHardwareEntry[] = entries.map(e => {
    const inv: ResolvedInventoryItem | undefined = e.inventoryItemId
      ? resolve(e.inventoryItemId)
      : undefined;
    return {
      hardwareName: e.hardwareName,
      inventoryItemId: e.inventoryItemId,
      quantity: e.quantity,
      perUnit: e.perUnit,
      boringRequired: e.boringRequired,
      notes: e.notes,
      sku: inv?.sku,
      resolvedName: inv?.name,
      description: inv?.description,
      category: inv?.category,
      subcategory: inv?.subcategory,
      brand: inv?.brand,
      supplier: inv?.supplier,
      unitCost: inv?.unitCost,
      currency: inv?.currency,
      unit: inv?.unit,
      resolved: !!inv,
    };
  });

  // Sort: resolved → unresolved, then grouped by category, then name.
  out.sort((a, b) => {
    if (a.resolved !== b.resolved) return a.resolved ? -1 : 1;
    const cat = (a.category ?? '').localeCompare(b.category ?? '');
    if (cat !== 0) return cat;
    const sub = (a.subcategory ?? '').localeCompare(b.subcategory ?? '');
    if (sub !== 0) return sub;
    const nameA = a.resolvedName ?? a.hardwareName;
    const nameB = b.resolvedName ?? b.hardwareName;
    return nameA.localeCompare(nameB);
  });

  return out;
}

/** Unique inventoryItemIds across every entry — the ids we need to
 *  fetch from the Materials library to build the resolver. */
export function hardwareInventoryIds(
  entries: ReadonlyArray<HardwareScheduleEntry>,
): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    if (e.inventoryItemId) set.add(e.inventoryItemId);
  }
  return Array.from(set);
}
