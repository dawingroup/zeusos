export interface CuttablePartLike {
  partType?: string;
  source?: string;
}

/**
 * Scene-origin component nodes are visual/hardware-only and must never enter
 * cutlist, palette harvest, sheet costing, or nesting flows.
 */
export function isSceneOriginComponentPart(part: CuttablePartLike): boolean {
  return part.partType === 'component' && part.source === 'design-studio';
}

/**
 * Cuttable/procurement-relevant part predicate for material + optimization pipelines.
 */
export function isCuttablePart(part: CuttablePartLike): boolean {
  return !isSceneOriginComponentPart(part);
}

export function filterCuttableParts<T extends CuttablePartLike>(parts: T[]): T[] {
  return parts.filter(isCuttablePart);
}
