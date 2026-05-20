/**
 * freeSlot — pure-TS helper that picks a non-overlapping XZ position
 * for a newly-added cabinet.
 *
 * Without this, every cabinet added via `AddCabinetDialog` lands at
 * `{0, 0, 0}` and stacks on top of whatever is already there. This
 * helper sweeps candidate positions along +X from the scene's current
 * right edge, spaced by `spacingMm`, wrapping to a new +Z row once the
 * running row width exceeds `rowWidthMm`. The first candidate that
 * doesn't AABB-overlap any existing cabinet wins.
 *
 * Pure — no React, no Three.js. Consumed by `useScene.addCabinet`
 * when the caller doesn't pass an explicit position.
 */

export interface FreeSlotCabinet {
  /** Base-centre on the XZ plane (matches scene storage). */
  x: number;
  z: number;
  /** Axis-aligned footprint in mm. */
  width: number;
  depth: number;
}

export interface FreeSlotOptions {
  /** Gap (mm) between the new cabinet and every neighbour. Default 20. */
  spacingMm?: number;
  /** Max running row width along +X before wrapping. Default 4000. */
  rowWidthMm?: number;
  /** Origin anchor — placement starts from this point on an empty scene.
   *  Defaults to `{x: 0, z: 0}` (scene origin). */
  originX?: number;
  originZ?: number;
}

/**
 * Two AABBs overlap on XZ when projections overlap on both axes.
 * `spacingMm` treats the pads as part of the bbox so the result has
 * the requested gap, not a coincident edge.
 */
function aabbOverlapXZ(
  a: FreeSlotCabinet,
  b: FreeSlotCabinet,
  spacingMm: number,
): boolean {
  const aHalfW = a.width / 2 + spacingMm / 2;
  const aHalfD = a.depth / 2 + spacingMm / 2;
  const bHalfW = b.width / 2 + spacingMm / 2;
  const bHalfD = b.depth / 2 + spacingMm / 2;
  const overlapX = Math.abs(a.x - b.x) < (aHalfW + bHalfW);
  const overlapZ = Math.abs(a.z - b.z) < (aHalfD + bHalfD);
  return overlapX && overlapZ;
}

/**
 * Return a free `{x, y, z}` slot for a cabinet of the given footprint.
 * Callers pass the *existing* cabinets (with their already-placed
 * `x/z` centres); we never move them. `y` is `0` — the alignment
 * system floor-locks new cabinets. Wall cabinets lift in a separate
 * flow.
 */
export function findFreeSlot(
  existing: FreeSlotCabinet[],
  newCabinet: { width: number; depth: number },
  opts: FreeSlotOptions = {},
): { x: number; y: number; z: number } {
  const spacing = opts.spacingMm ?? 20;
  const rowWidth = opts.rowWidthMm ?? 4_000;
  const originX = opts.originX ?? 0;
  const originZ = opts.originZ ?? 0;

  if (existing.length === 0) {
    return { x: originX, y: 0, z: originZ };
  }

  // Walk +X/+Z rows. Starting x = centre of the first slot = halfW + spacing.
  // Starting z = scene's existing min-z so the first free row aligns with
  // whatever's already there (avoids the awkward "cabinets placed centre-z
  // but the row forms below them" case).
  const halfW = newCabinet.width / 2;
  const halfD = newCabinet.depth / 2;

  // Row origin: align with the minimum-z edge of existing cabinets so new
  // rows stretch alongside rather than at an offset.
  const minZEdge = Math.min(...existing.map(c => c.z - c.depth / 2));
  let rowZCentre = minZEdge + halfD;
  // Running x cursor: start at the right-most existing cabinet + gap.
  const maxXEdge = Math.max(...existing.map(c => c.x + c.width / 2));
  let cursorX = maxXEdge + spacing + halfW;
  const rowStartX = originX + halfW;          // left edge of this row's usable band
  const rowMaxX = originX + rowWidth;         // right edge of this row's usable band

  /**
   * Wrap to a new row when the cursor overshoots the right edge. The new
   * row sits below (+Z) the tallest existing cabinet whose footprint
   * overlaps the current row's X-band, offset by one cabinet-depth +
   * spacing. Falls back to the scene's max-z edge when no overlap.
   */
  const maybeWrap = () => {
    if (cursorX + halfW <= rowMaxX) return;
    const maxZEdge = Math.max(...existing.map(c => c.z + c.depth / 2));
    rowZCentre = maxZEdge + spacing + halfD;
    cursorX = rowStartX;
  };
  // First candidate may already overshoot if existing cabinets fill the row.
  maybeWrap();

  // Safety cap so a pathological scene never loops forever.
  for (let iter = 0; iter < 500; iter++) {
    const candidate: FreeSlotCabinet = {
      x: cursorX,
      z: rowZCentre,
      width: newCabinet.width,
      depth: newCabinet.depth,
    };
    const collides = existing.some(e => aabbOverlapXZ(candidate, e, spacing));
    if (!collides) {
      return { x: candidate.x, y: 0, z: candidate.z };
    }
    cursorX += newCabinet.width + spacing;
    maybeWrap();
  }

  // Unreachable in practice — fall back to scene-origin if we somehow
  // exhausted 500 candidates.
  return { x: originX, y: 0, z: originZ };
}
