import { describe, it, expect } from 'vitest';
import { normalizeBoringSpec } from '../normalizeBoringSpec';

describe('normalizeBoringSpec', () => {
  it('returns undefined for null/undefined/empty', () => {
    expect(normalizeBoringSpec(null)).toBeUndefined();
    expect(normalizeBoringSpec(undefined)).toBeUndefined();
    expect(normalizeBoringSpec({})).toBeUndefined();
    expect(normalizeBoringSpec('')).toBeUndefined();
  });

  it('normalises legacy { targets: [...] } shape', () => {
    const result = normalizeBoringSpec({
      targets: [
        { inventoryItemId: 'inv-hinge', label: 'Hinge cup', quantity: 2 },
        { hardwareId: 'inv-dowel', qty: 4 },
      ],
    });
    expect(result).toBeDefined();
    expect(result!.targets).toHaveLength(2);
    expect(result!.targets![0].inventoryItemId).toBe('inv-hinge');
    expect(result!.targets![0].label).toBe('Hinge cup');
    expect(result!.targets![0].quantity).toBe(2);
    expect(result!.targets![1].inventoryItemId).toBe('inv-dowel');
  });

  it('normalises legacy { hardware: [...] } shape', () => {
    const result = normalizeBoringSpec({
      hardware: [
        { inventoryItemId: 'inv-runner', description: 'Drawer runner', quantity: 1 },
      ],
    });
    expect(result).toBeDefined();
    expect(result!.targets).toHaveLength(1);
    expect(result!.targets![0].inventoryItemId).toBe('inv-runner');
  });

  it('normalises legacy { holes: [{ hardwareId, diameter, depth }] }', () => {
    const result = normalizeBoringSpec({
      holes: [
        { hardwareId: 'inv-cam', diameter: 15, depth: 12, x: 37, y: 64 },
      ],
    });
    expect(result).toBeDefined();
    expect(result!.holes).toHaveLength(1);
    expect(result!.holes[0].diameter).toBe(15);
    expect(result!.holes[0].depth).toBe(12);
    expect(result!.holes[0].x).toBe(37);
    expect(result!.holes[0].y).toBe(64);
    expect(result!.holes[0].face).toBe('top');
    expect(result!.targets).toHaveLength(1);
    expect(result!.targets![0].inventoryItemId).toBe('inv-cam');
  });

  it('normalises legacy { diameter, depth, pattern: "single" }', () => {
    const result = normalizeBoringSpec({
      diameter: 5,
      depth: 10,
      offsetFromEdge: 37,
      pattern: 'single',
    });
    expect(result).toBeDefined();
    expect(result!.holes).toHaveLength(1);
    expect(result!.holes[0].diameter).toBe(5);
    expect(result!.holes[0].depth).toBe(10);
    expect(result!.holes[0].y).toBe(37);
  });

  it('generates 32mm system holes', () => {
    const result = normalizeBoringSpec({
      diameter: 5,
      depth: 13,
      offsetFromEdge: 37,
      pattern: 'line_32mm',
    });
    expect(result).toBeDefined();
    expect(result!.holes.length).toBeGreaterThan(1);
    // First hole at 37mm, subsequent at 69, 101, ...
    expect(result!.holes[0].y).toBe(37);
    expect(result!.holes[1].y).toBe(69);
    expect(result!.holes[2].y).toBe(101);
    expect(result!.holes.every(h => h.diameter === 5)).toBe(true);
  });

  it('passes through already-canonical data', () => {
    const canonical = {
      holes: [{ face: 'left', x: 0, y: 37, diameter: 5, depth: 13 }],
      targets: [{ inventoryItemId: 'inv-shelf-pin', label: 'Shelf pin', quantity: 4 }],
    };
    const result = normalizeBoringSpec(canonical);
    expect(result).toBeDefined();
    expect(result!.holes).toHaveLength(1);
    expect(result!.holes[0].face).toBe('left');
    expect(result!.targets).toHaveLength(1);
  });
});
