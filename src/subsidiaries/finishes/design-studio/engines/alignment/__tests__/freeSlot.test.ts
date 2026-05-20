/**
 * Unit tests for the free-slot placement helper.
 */
import { describe, it, expect } from 'vitest';
import { findFreeSlot, type FreeSlotCabinet } from '../freeSlot';

const c = (x: number, z: number, width = 600, depth = 560): FreeSlotCabinet =>
  ({ x, z, width, depth });

describe('findFreeSlot', () => {
  it('places the first cabinet at the origin when the scene is empty', () => {
    const slot = findFreeSlot([], { width: 600, depth: 560 });
    expect(slot).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('honours explicit origin override', () => {
    const slot = findFreeSlot([], { width: 600, depth: 560 }, { originX: 200, originZ: -100 });
    expect(slot).toEqual({ x: 200, y: 0, z: -100 });
  });

  it('places the second cabinet to the right of the first, with spacing', () => {
    const slot = findFreeSlot(
      [c(0, 0)],
      { width: 600, depth: 560 },
      { spacingMm: 20 },
    );
    // Right edge of first = 300; spacing = 20; halfW of new = 300. New centre = 620.
    expect(slot.x).toBe(620);
    expect(slot.z).toBe(0);
    expect(slot.y).toBe(0);
  });

  it('does not overlap with multiple existing cabinets', () => {
    const existing = [c(0, 0), c(620, 0), c(1240, 0)];
    const slot = findFreeSlot(existing, { width: 600, depth: 560 }, { spacingMm: 20 });
    // New centre should land past the right-most cabinet (1240 + 300 + 20 + 300 = 1860).
    expect(slot.x).toBe(1860);
    expect(slot.z).toBe(0);
  });

  it('wraps to a new row along +Z when the row exceeds rowWidthMm', () => {
    // 7 cabinets × 620mm stride = 3720 + 300 half for leading + gaps ≈ 4100mm.
    // rowWidth = 4000 forces a wrap on the 7th.
    const existing = Array.from({ length: 6 }, (_, i) => c(i * 620, 0));
    const slot = findFreeSlot(
      existing,
      { width: 600, depth: 560 },
      { spacingMm: 20, rowWidthMm: 4000 },
    );
    // Should have wrapped — new cabinet on a new Z row.
    expect(slot.z).toBeGreaterThan(0);
  });

  it('returns a position that does not overlap any existing cabinet', () => {
    const existing = [c(0, 0), c(620, 0), c(0, 580), c(620, 580)];
    const slot = findFreeSlot(existing, { width: 600, depth: 560 }, { spacingMm: 20 });
    // Sanity: manually verify no overlap with any existing
    for (const e of existing) {
      const halfX = 300 + 10 + e.width / 2 + 10;
      const halfZ = 280 + 10 + e.depth / 2 + 10;
      const dx = Math.abs(slot.x - e.x);
      const dz = Math.abs(slot.z - e.z);
      const overlaps = dx < halfX && dz < halfZ;
      expect(overlaps).toBe(false);
    }
  });

  it('handles variable-sized cabinets', () => {
    const existing = [c(0, 0, 1200, 600)];
    const slot = findFreeSlot(existing, { width: 400, depth: 400 }, { spacingMm: 20 });
    // First cabinet's right edge = 600; spacing = 20; new halfW = 200. Centre = 820.
    expect(slot.x).toBe(820);
    expect(slot.y).toBe(0);
  });
});
