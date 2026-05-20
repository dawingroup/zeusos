import { describe, expect, it } from 'vitest';
import {
  remapEdgeBandingForPlacement,
  remapEdgeOperationsForPlacement,
  type PlanarEdgeSide,
  rotateEdgeBandingQuarterTurns,
  rotatePlanarEdgeSideQuarterTurns,
} from '../edgeBandingOrientation';

describe('remapEdgeBandingForPlacement', () => {
  it('remaps edge sides for quarter-turn placement orientation', () => {
    const edgeBanding = {
      top: true,
      bottom: false,
      left: false,
      right: false,
    };

    expect(remapEdgeBandingForPlacement(edgeBanding, false)).toEqual({
      top: false,
      right: true,
      bottom: false,
      left: false,
    });
  });

  it('keeps edge sides unchanged when placement is source-aligned', () => {
    const edgeBanding = {
      top: true,
      bottom: false,
      left: false,
      right: false,
    };

    expect(remapEdgeBandingForPlacement(edgeBanding, true)).toEqual({
      top: true,
      right: false,
      bottom: false,
      left: false,
    });
  });

  it('returns undefined when source edge banding is missing', () => {
    expect(remapEdgeBandingForPlacement(undefined, true)).toBeUndefined();
  });

  it('supports composed quarter-turn rotations for display transforms', () => {
    const edgeBanding = {
      top: true,
      bottom: false,
      left: false,
      right: false,
    };

    expect(rotateEdgeBandingQuarterTurns(edgeBanding, 2)).toEqual({
      top: false,
      right: false,
      bottom: true,
      left: false,
    });
  });

  it('rotates individual edge side labels consistently', () => {
    expect(rotatePlanarEdgeSideQuarterTurns('top', 1)).toBe('right');
    expect(rotatePlanarEdgeSideQuarterTurns('right', 2)).toBe('left');
  });

  it('rotates per-side operations with placement orientation', () => {
    type Op =
      | { type: 'grooving'; depthMm: number }
      | { type: 'mitering'; angleDeg: number }
      | { type: 'routing'; depthMm: number };
    const operationsBySide: Partial<Record<PlanarEdgeSide, Op[]>> & { front?: Op[] } = {
      top: [{ type: 'grooving' as const, depthMm: 8 }],
      left: [{ type: 'mitering' as const, angleDeg: 45 }],
      front: [{ type: 'routing' as const, depthMm: 2 }],
    };

    expect(remapEdgeOperationsForPlacement(operationsBySide, false)).toEqual({
      right: [{ type: 'grooving', depthMm: 8 }],
      top: [{ type: 'mitering', angleDeg: 45 }],
      front: [{ type: 'routing', depthMm: 2 }],
    });
  });
});
