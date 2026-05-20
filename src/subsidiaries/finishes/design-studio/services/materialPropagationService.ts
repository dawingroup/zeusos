/**
 * materialPropagationService — batch-propagate resolved material
 * mappings from the ModelPackage (or palette) onto ScenePart fields.
 *
 * This closes the gap where material resolution was ephemeral (React
 * hook) and never stamped onto the actual parts. After running this
 * service, every ScenePart whose mesh material name matches a mapping
 * carries:
 *   - `finishLibraryId`
 *   - `inventoryItemId` (from Finish Library doc)
 *   - `inventoryItemName`
 *   - `materialDescription` (human-readable name)
 *
 * Callers: processModel pipeline, manual "Apply Palette" button,
 * bulk import.
 */

import type { ScenePart } from '../types/assembly.types';
import type { MaterialMappingLite } from '../types/modelPackage.types';
import type { MaterialMapping } from './materialResolverService';

/** Result of propagating materials to parts. */
export interface PropagationResult {
  /** Total parts processed. */
  totalParts: number;
  /** Parts that received a material mapping. */
  mappedParts: number;
  /** Parts that couldn't be mapped. */
  unmappedParts: number;
  /** Map of partId → finishLibraryId for persisting updates. */
  updates: Map<string, PartMaterialUpdate>;
}

export interface PartMaterialUpdate {
  finishLibraryId: string;
  inventoryItemId?: string;
  inventoryItemName?: string;
  materialDescription: string;
}

/**
 * Build a lookup from 3DS material name → mapping, normalised for
 * case-insensitive matching. Works with both the full MaterialMapping
 * and the lightweight ModelPackage version.
 */
function buildMaterialIndex(
  mappings: ReadonlyArray<MaterialMapping | MaterialMappingLite>,
): Map<string, MaterialMapping | MaterialMappingLite> {
  const index = new Map<string, MaterialMapping | MaterialMappingLite>();
  for (const m of mappings) {
    const key = 'threeDsMaterialName' in m
      ? m.threeDsMaterialName.toLowerCase()
      : m.threeDSName.toLowerCase();
    const id = 'finishLibraryId' in m ? m.finishLibraryId : '';
    if (id) index.set(key, m);
  }
  return index;
}

/** Extract the display name from either mapping shape. */
function displayName(m: MaterialMapping | MaterialMappingLite): string {
  return 'finishName' in m ? m.finishName : m.finishLibraryName;
}

/** Extract the finish library ID from either mapping shape. */
function finishId(m: MaterialMapping | MaterialMappingLite): string {
  return m.finishLibraryId;
}

/**
 * Propagate resolved material mappings onto SceneParts.
 *
 * Does NOT mutate the input parts — returns a map of updates that the
 * caller can apply (either via Firestore batch update or in-memory merge).
 *
 * @param parts       All SceneParts to consider.
 * @param mappings    Resolved material mappings from ModelPackage or
 *                    live resolver.
 * @param finishDocs  Optional Finish Library docs — when provided, the
 *                    update includes `inventoryItemId` from the finish
 *                    doc so procurement can resolve stock immediately.
 */
export function propagateMaterials(
  parts: ReadonlyArray<ScenePart>,
  mappings: ReadonlyArray<MaterialMapping | MaterialMappingLite>,
  finishDocs?: ReadonlyArray<{ id: string; inventoryItemId?: string; name?: string }>,
): PropagationResult {
  const index = buildMaterialIndex(mappings);
  const updates = new Map<string, PartMaterialUpdate>();

  // Build an optional finishId → inventoryItemId lookup.
  const finishToInventory = new Map<string, { inventoryItemId?: string; name?: string }>();
  if (finishDocs) {
    for (const f of finishDocs) {
      finishToInventory.set(f.id, { inventoryItemId: f.inventoryItemId, name: f.name });
    }
  }

  let mapped = 0;
  let unmapped = 0;

  for (const part of parts) {
    const meshMaterial = (part.materialDescription || '').toLowerCase();
    const match = index.get(meshMaterial);
    if (!match) {
      unmapped++;
      continue;
    }

    const fId = finishId(match);
    const fDoc = finishToInventory.get(fId);

    updates.set(part.id, {
      finishLibraryId: fId,
      inventoryItemId: fDoc?.inventoryItemId,
      inventoryItemName: fDoc?.name,
      materialDescription: displayName(match),
    });
    mapped++;
  }

  return {
    totalParts: parts.length,
    mappedParts: mapped,
    unmappedParts: unmapped,
    updates,
  };
}

/**
 * Apply material updates to parts in-memory (non-mutating).
 * Returns a new array with updated parts.
 */
export function applyMaterialUpdates(
  parts: ReadonlyArray<ScenePart>,
  updates: Map<string, PartMaterialUpdate>,
): ScenePart[] {
  return parts.map(p => {
    const update = updates.get(p.id);
    if (!update) return p;
    return {
      ...p,
      finishLibraryId: update.finishLibraryId,
      inventoryItemId: update.inventoryItemId ?? p.inventoryItemId,
      inventoryItemName: update.inventoryItemName ?? p.inventoryItemName,
      materialDescription: update.materialDescription,
    };
  });
}
