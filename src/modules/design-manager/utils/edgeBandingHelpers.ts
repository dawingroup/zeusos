/**
 * edgeBandingHelpers — utilities for reading and constructing
 * PartEdgeBanding in the rich per-edge format introduced in P1.1.
 *
 * All helpers handle both legacy (boolean-only) and rich (per-edge
 * object) shapes so callers don't need to branch on data vintage.
 */

import type { PartEdgeBanding, PartEdgeBandingEdge } from '../types';

export type EdgeSide = 'top' | 'bottom' | 'left' | 'right' | 'front';

// ---------------------------------------------------------------------------
// Readers — query a specific edge
// ---------------------------------------------------------------------------

/** Is edge banding applied on this side? Handles both legacy booleans
 *  and the rich `edges` map. */
export function isEdgeApplied(eb: PartEdgeBanding, side: EdgeSide): boolean {
  switch (side) {
    case 'top': return eb.top;
    case 'bottom': return eb.bottom;
    case 'left': return eb.left;
    case 'right': return eb.right;
    case 'front': return !!eb.front;
  }
}

/** Material name for a specific edge — per-edge override wins, then
 *  falls back to the shared `material` field. Returns undefined when
 *  no material is known. */
export function getEdgeMaterial(
  eb: PartEdgeBanding,
  side: EdgeSide,
): string | undefined {
  return eb.edges?.[side]?.material ?? eb.material;
}

/** Tape thickness for a specific edge (mm). Per-edge wins over shared. */
export function getEdgeThickness(
  eb: PartEdgeBanding,
  side: EdgeSide,
): number | undefined {
  return eb.edges?.[side]?.thickness ?? eb.thickness;
}

/** Pre-computed edge length (mm). Only available when the rich edges
 *  map has been populated. */
export function getEdgeLength(
  eb: PartEdgeBanding,
  side: EdgeSide,
): number | undefined {
  return eb.edges?.[side]?.length;
}

// ---------------------------------------------------------------------------
// Aggregation — total linear meters across all edges of a part
// ---------------------------------------------------------------------------

/** Sum of all applied edge lengths in mm. When per-edge lengths are not
 *  available, falls back to computing from part dimensions. */
export function totalEdgeLengthMm(
  eb: PartEdgeBanding,
  partLength: number,
  partWidth: number,
): number {
  const sides: EdgeSide[] = ['top', 'bottom', 'left', 'right', 'front'];
  let total = 0;
  for (const side of sides) {
    if (!isEdgeApplied(eb, side)) continue;
    const rich = eb.edges?.[side]?.length;
    if (rich != null) {
      total += rich;
    } else {
      // Fallback: top/bottom run along the length, left/right along the width.
      total += (side === 'top' || side === 'bottom') ? partLength
             : (side === 'left' || side === 'right') ? partWidth
             : 0; // front has no implicit dimension
    }
  }
  return total;
}

/** Total linear meters (convenience wrapper). */
export function totalEdgeLengthLm(
  eb: PartEdgeBanding,
  partLength: number,
  partWidth: number,
): number {
  return totalEdgeLengthMm(eb, partLength, partWidth) / 1000;
}

// ---------------------------------------------------------------------------
// Builders — construct rich PartEdgeBanding from ScenePart data
// ---------------------------------------------------------------------------

interface SceneEdge {
  type: string;
  length: number;
}

/** Build a PartEdgeBanding from ScenePart's rich edge shape. Populates
 *  both the legacy booleans AND the rich `edges` map so all consumers
 *  work correctly. */
export function fromSceneEdgeBanding(
  band: {
    top?: SceneEdge | null;
    bottom?: SceneEdge | null;
    left?: SceneEdge | null;
    right?: SceneEdge | null;
    front?: SceneEdge | null;
  } | undefined,
): PartEdgeBanding {
  const b = band ?? {};

  const toRich = (edge: SceneEdge | null | undefined): PartEdgeBandingEdge | undefined => {
    if (!edge) return undefined;
    return {
      material: edge.type || undefined,
      length: edge.length || undefined,
    };
  };

  // Find first material for the legacy shared field.
  const firstMaterial = (b.top?.type || b.bottom?.type || b.left?.type
    || b.right?.type || b.front?.type) || undefined;

  const edges: PartEdgeBanding['edges'] = {};
  if (b.top) edges.top = toRich(b.top);
  if (b.bottom) edges.bottom = toRich(b.bottom);
  if (b.left) edges.left = toRich(b.left);
  if (b.right) edges.right = toRich(b.right);
  if (b.front) edges.front = toRich(b.front);

  return {
    top: !!b.top,
    bottom: !!b.bottom,
    left: !!b.left,
    right: !!b.right,
    front: !!b.front,
    material: firstMaterial,
    edges: Object.keys(edges).length > 0 ? edges : undefined,
  };
}

/** Build a PartEdgeBanding from CSV booleans + optional per-row material. */
export function fromCsvEdgeBanding(
  csv: {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
    material?: string;
    /** Per-edge materials if the CSV carries them (PolyBoard advanced export). */
    topMaterial?: string;
    bottomMaterial?: string;
    leftMaterial?: string;
    rightMaterial?: string;
  },
  partLength?: number,
  partWidth?: number,
): PartEdgeBanding {
  const edges: PartEdgeBanding['edges'] = {};
  if (csv.top) {
    edges.top = {
      material: csv.topMaterial ?? csv.material,
      length: partLength,
    };
  }
  if (csv.bottom) {
    edges.bottom = {
      material: csv.bottomMaterial ?? csv.material,
      length: partLength,
    };
  }
  if (csv.left) {
    edges.left = {
      material: csv.leftMaterial ?? csv.material,
      length: partWidth,
    };
  }
  if (csv.right) {
    edges.right = {
      material: csv.rightMaterial ?? csv.material,
      length: partWidth,
    };
  }

  return {
    top: csv.top,
    bottom: csv.bottom,
    left: csv.left,
    right: csv.right,
    material: csv.material,
    edges: Object.keys(edges).length > 0 ? edges : undefined,
  };
}
