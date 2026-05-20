export interface EdgeBandingSides {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export type PlanarEdgeSide = 'top' | 'right' | 'bottom' | 'left';
/**
 * PDF portrait layout rotates sheet coordinates by +90deg for display.
 * Side mapping must follow the same transform to keep edge indicators aligned.
 */
export const PORTRAIT_LAYOUT_EDGE_ROTATION_QUARTER_TURNS = 1;

export function normalizeQuarterTurns(quarterTurnsClockwise: number | undefined): number {
  return ((quarterTurnsClockwise ?? 0) % 4 + 4) % 4;
}

export function getPlacementQuarterTurns(placement: {
  rotated?: boolean;
  rotationQuarterTurns?: number;
}): number {
  if (typeof placement.rotationQuarterTurns === 'number') {
    return normalizeQuarterTurns(placement.rotationQuarterTurns);
  }
  // Legacy fallback for persisted records without explicit quarter-turn metadata.
  // Current persisted optimizer semantics are inverse to the raw rotated flag.
  return placement.rotated ? 0 : 1;
}

export function rotatePlanarEdgeSideQuarterTurns(
  side: PlanarEdgeSide,
  quarterTurnsClockwise: number
): PlanarEdgeSide {
  const order: PlanarEdgeSide[] = ['top', 'right', 'bottom', 'left'];
  const turns = ((quarterTurnsClockwise % 4) + 4) % 4;
  const currentIndex = order.indexOf(side);
  return order[(currentIndex + turns) % 4];
}

/**
 * Rotate edge sides by N quarter-turns clockwise.
 * Useful when composing placement-rotation with render-layout rotation.
 */
export function rotateEdgeBandingQuarterTurns(
  edgeBanding: EdgeBandingSides | undefined,
  quarterTurnsClockwise: number
): EdgeBandingSides | undefined {
  if (!edgeBanding) return undefined;

  const turns = normalizeQuarterTurns(quarterTurnsClockwise);
  if (turns === 0) {
    return {
      top: edgeBanding.top,
      bottom: edgeBanding.bottom,
      left: edgeBanding.left,
      right: edgeBanding.right,
    };
  }

  let current: EdgeBandingSides = {
    top: edgeBanding.top,
    bottom: edgeBanding.bottom,
    left: edgeBanding.left,
    right: edgeBanding.right,
  };

  for (let i = 0; i < turns; i++) {
    current = {
      top: current.left,
      right: current.top,
      bottom: current.right,
      left: current.bottom,
    };
  }

  return current;
}

/**
 * Remap edge-band sides from source-part orientation to placed orientation.
 *
 * NOTE:
 * In our persisted placement payload, `rotated=false` corresponds to the
 * quarter-turn orientation (source L/W are swapped in placement dimensions),
 * while `rotated=true` corresponds to source-aligned orientation.
 */
export function remapEdgeBandingForPlacement(
  edgeBanding: EdgeBandingSides | undefined,
  rotated: boolean
): EdgeBandingSides | undefined {
  return rotateEdgeBandingQuarterTurns(edgeBanding, getPlacementQuarterTurns({ rotated }));
}

export function remapEdgeBandingForPlacementState(
  edgeBanding: EdgeBandingSides | undefined,
  placement: { rotated?: boolean; rotationQuarterTurns?: number }
): EdgeBandingSides | undefined {
  return rotateEdgeBandingQuarterTurns(edgeBanding, getPlacementQuarterTurns(placement));
}

export function rotateEdgeOperationsBySideQuarterTurns<T>(
  operationsBySide: (Partial<Record<PlanarEdgeSide, T[]>> & { front?: T[] }) | undefined,
  quarterTurnsClockwise: number
): (Partial<Record<PlanarEdgeSide, T[]>> & { front?: T[] }) | undefined {
  if (!operationsBySide) return undefined;
  const turns = normalizeQuarterTurns(quarterTurnsClockwise);
  if (turns === 0) {
    return {
      ...(operationsBySide.top ? { top: [...operationsBySide.top] } : {}),
      ...(operationsBySide.right ? { right: [...operationsBySide.right] } : {}),
      ...(operationsBySide.bottom ? { bottom: [...operationsBySide.bottom] } : {}),
      ...(operationsBySide.left ? { left: [...operationsBySide.left] } : {}),
      ...(operationsBySide.front ? { front: [...operationsBySide.front] } : {}),
    };
  }

  const rotated: Partial<Record<PlanarEdgeSide, T[]>> & { front?: T[] } = {};
  const sides: PlanarEdgeSide[] = ['top', 'right', 'bottom', 'left'];
  for (const side of sides) {
    const ops = operationsBySide[side];
    if (!ops || ops.length === 0) continue;
    const targetSide = rotatePlanarEdgeSideQuarterTurns(side, turns);
    rotated[targetSide] = [...ops];
  }
  if (operationsBySide.front && operationsBySide.front.length > 0) {
    rotated.front = [...operationsBySide.front];
  }
  return rotated;
}

export function remapEdgeOperationsForPlacement<T>(
  operationsBySide: (Partial<Record<PlanarEdgeSide, T[]>> & { front?: T[] }) | undefined,
  rotated: boolean
): (Partial<Record<PlanarEdgeSide, T[]>> & { front?: T[] }) | undefined {
  return rotateEdgeOperationsBySideQuarterTurns(operationsBySide, getPlacementQuarterTurns({ rotated }));
}

export function remapEdgeOperationsForPlacementState<T>(
  operationsBySide: (Partial<Record<PlanarEdgeSide, T[]>> & { front?: T[] }) | undefined,
  placement: { rotated?: boolean; rotationQuarterTurns?: number }
): (Partial<Record<PlanarEdgeSide, T[]>> & { front?: T[] }) | undefined {
  return rotateEdgeOperationsBySideQuarterTurns(operationsBySide, getPlacementQuarterTurns(placement));
}
