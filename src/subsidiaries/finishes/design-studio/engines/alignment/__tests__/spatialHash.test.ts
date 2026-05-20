/**
 * Unit tests for the alignment spatial hash.
 *
 * Covers insert/update/remove, bucket transitions when a bbox crosses
 * cell boundaries, radius queries returning the correct union, and the
 * buildSpatialHash convenience builder.
 */
import { describe, it, expect } from 'vitest';
import { SpatialHash, buildSpatialHash } from '../spatialHash';

const bbox = (minX: number, minZ: number, maxX: number, maxZ: number) =>
  ({ minX, minZ, maxX, maxZ });

describe('SpatialHash', () => {
  it('inserts items and reports correct size', () => {
    const h = new SpatialHash<string>(1000);
    h.upsert('a', 'a', bbox(0, 0, 100, 100));
    h.upsert('b', 'b', bbox(500, 500, 600, 600));
    expect(h.size()).toBe(2);
  });

  it('queryRadius returns every item in overlapping cells', () => {
    const h = new SpatialHash<string>(1000);
    h.upsert('a', 'a', bbox(0, 0, 100, 100));
    h.upsert('b', 'b', bbox(1500, 1500, 1600, 1600));
    // Query radius 200 around origin — cell 0,0 only.
    const res = h.queryRadius({ x: 0, z: 0 }, 200);
    expect(res.map(r => r.id)).toEqual(['a']);
    // Query big enough to cover both cells.
    const resBig = h.queryRadius({ x: 0, z: 0 }, 2000);
    expect(new Set(resBig.map(r => r.id))).toEqual(new Set(['a', 'b']));
  });

  it('queryRadius returns items whose bbox spans multiple cells only once', () => {
    const h = new SpatialHash<string>(1000);
    // Bbox straddles cells (0,0), (1,0), (0,1), (1,1).
    h.upsert('big', 'big', bbox(900, 900, 1100, 1100));
    const res = h.queryRadius({ x: 1000, z: 1000 }, 500);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('big');
  });

  it('upsert moves an item between cells when its bbox changes', () => {
    const h = new SpatialHash<string>(1000);
    h.upsert('a', 'a', bbox(0, 0, 100, 100));
    let res = h.queryRadius({ x: 50, z: 50 }, 10);
    expect(res.map(r => r.id)).toEqual(['a']);
    // Move to a distant cell.
    h.upsert('a', 'a', bbox(5000, 5000, 5100, 5100));
    res = h.queryRadius({ x: 50, z: 50 }, 10);
    expect(res).toEqual([]);
    res = h.queryRadius({ x: 5050, z: 5050 }, 10);
    expect(res.map(r => r.id)).toEqual(['a']);
  });

  it('remove drops an item from every cell it was in', () => {
    const h = new SpatialHash<string>(1000);
    h.upsert('a', 'a', bbox(900, 900, 1100, 1100));
    h.remove('a');
    expect(h.size()).toBe(0);
    expect(h.queryRadius({ x: 1000, z: 1000 }, 200)).toEqual([]);
  });

  it('rejects a non-positive cell size', () => {
    expect(() => new SpatialHash(0)).toThrow(/cellSize must be > 0/);
    expect(() => new SpatialHash(-10)).toThrow(/cellSize must be > 0/);
  });
});

describe('buildSpatialHash', () => {
  it('places every input item and returns the populated hash', () => {
    const items = [
      { id: 'a', x: 100, z: 100, width: 600, depth: 560 },
      { id: 'b', x: 3000, z: 100, width: 400, depth: 560 },
      { id: 'c', x: 100, z: 3000, width: 600, depth: 560 },
    ];
    const h = buildSpatialHash(items, 1000);
    expect(h.size()).toBe(3);
    // Tight query around 'a' should only return 'a'.
    const resA = h.queryRadius({ x: 100, z: 100 }, 200);
    expect(resA.map(r => r.id)).toEqual(['a']);
    // Wide query returns all three.
    const resAll = h.queryRadius({ x: 1500, z: 1500 }, 5000);
    expect(new Set(resAll.map(r => r.id))).toEqual(new Set(['a', 'b', 'c']));
  });
});
