/**
 * Unit tests for the group engine's pure math.
 */
import { describe, it, expect } from 'vitest';
import {
  groupCentroid,
  applyDelta,
  rotateAroundPivot,
  convexHullXZ,
  groupBoundingHull,
  type GroupMember,
} from '../groupEngine';

const m = (id: string, x: number, y: number, z: number, rot = 0): GroupMember => ({
  id, rotation: rot, position: { x, y, z },
});

describe('groupCentroid', () => {
  it('returns origin for an empty group', () => {
    expect(groupCentroid([])).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('averages positions componentwise', () => {
    const members = [m('a', 0, 0, 0), m('b', 100, 0, 200), m('c', -100, 0, -200)];
    expect(groupCentroid(members)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('applyDelta', () => {
  it('translates every member by the same delta', () => {
    const members = [m('a', 0, 0, 0), m('b', 100, 0, 200)];
    const out = applyDelta(members, { x: 10, y: 0, z: 20 });
    expect(out[0].position).toEqual({ x: 10, y: 0, z: 20 });
    expect(out[1].position).toEqual({ x: 110, y: 0, z: 220 });
  });

  it('preserves rotations', () => {
    const members = [m('a', 0, 0, 0, 45), m('b', 100, 0, 0, -30)];
    const out = applyDelta(members, { x: 5, y: 0, z: 5 });
    expect(out[0].rotation).toBe(45);
    expect(out[1].rotation).toBe(-30);
  });
});

describe('rotateAroundPivot', () => {
  it('rotates a point 90° around origin', () => {
    const members = [m('a', 100, 0, 0, 0)];
    const out = rotateAroundPivot(members, { x: 0, y: 0, z: 0 }, 90);
    expect(out[0].position.x).toBeCloseTo(0);
    expect(out[0].position.z).toBeCloseTo(-100);
  });

  it('bumps each member rotation by the group angle', () => {
    const members = [m('a', 100, 0, 0, 10), m('b', -100, 0, 0, 20)];
    const out = rotateAroundPivot(members, { x: 0, y: 0, z: 0 }, 45);
    expect(out[0].rotation).toBe(55);
    expect(out[1].rotation).toBe(65);
  });

  it('preserves inter-member distances', () => {
    const members = [m('a', 100, 0, 100), m('b', 200, 0, 100)];
    const origDist = 100;
    const out = rotateAroundPivot(members, { x: 0, y: 0, z: 0 }, 137);
    const dx = out[0].position.x - out[1].position.x;
    const dz = out[0].position.z - out[1].position.z;
    const rotatedDist = Math.hypot(dx, dz);
    expect(rotatedDist).toBeCloseTo(origDist, 6);
  });
});

describe('convexHullXZ', () => {
  it('handles empty / singleton / pair inputs', () => {
    expect(convexHullXZ([])).toEqual([]);
    expect(convexHullXZ([{ x: 1, z: 2 }])).toEqual([{ x: 1, z: 2 }]);
    const pair = convexHullXZ([{ x: 0, z: 0 }, { x: 10, z: 0 }]);
    expect(pair).toHaveLength(2);
  });

  it('returns all 4 corners for a rectangle', () => {
    const square = [
      { x: 0, z: 0 }, { x: 100, z: 0 },
      { x: 100, z: 100 }, { x: 0, z: 100 },
      // Interior point — must not end up in the hull.
      { x: 50, z: 50 },
    ];
    const hull = convexHullXZ(square);
    expect(hull).toHaveLength(4);
    expect(hull).toEqual(expect.arrayContaining([
      { x: 0, z: 0 }, { x: 100, z: 0 }, { x: 100, z: 100 }, { x: 0, z: 100 },
    ]));
    expect(hull).not.toContainEqual({ x: 50, z: 50 });
  });
});

describe('groupBoundingHull', () => {
  it('wraps two axis-aligned cabinets with a single rectangle', () => {
    const hull = groupBoundingHull([
      { x: 0,    z: 0, width: 600, depth: 560 },
      { x: 600,  z: 0, width: 600, depth: 560 },
    ]);
    // Combined bbox is [-300, -280] to [900, 280] — 4 corners.
    expect(hull).toHaveLength(4);
  });

  it('accounts for per-cabinet rotation', () => {
    const hull = groupBoundingHull([
      { x: 0, z: 0, width: 200, depth: 200, rotationDeg: 45 },
    ]);
    // Rotating a 200×200 square by 45° yields a diamond — still 4 corners
    // but with extents ±(200/√2·2)/2 ≈ ±141 on both axes.
    expect(hull).toHaveLength(4);
    const maxX = Math.max(...hull.map(p => Math.abs(p.x)));
    expect(maxX).toBeCloseTo(Math.SQRT2 * 100, 1);
  });
});
