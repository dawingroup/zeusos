/**
 * Tests for classifyPartByGeometry — the "second opinion" classifier
 * that sharpens generic 'panel' into cover_panel / toe_kick / upright
 * etc. when name signals are cryptic.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyPartByGeometry,
  GEOMETRY_OVERRIDE_THRESHOLD,
} from '../partGeometryClassifier';

function box(w: number, h: number, d: number, offset = { x: 0, y: 0, z: 0 }) {
  return {
    min: { x: offset.x, y: offset.y, z: offset.z },
    max: { x: offset.x + w, y: offset.y + h, z: offset.z + d },
  };
}

// A typical kitchen base carcase: 600×720×560mm.
const CARCASE = box(600, 720, 560);

describe('classifyPartByGeometry — sheet detection', () => {
  it('thin sheet OUTSIDE carcase envelope → cover_panel (high confidence)', () => {
    // 18mm thick panel bolted to left side of carcase at x = -50
    // (entirely to the left — max.x = -32 is clear of CARCASE.min.x=0
    // with tolerance to spare).
    const cover = box(18, 720, 560, { x: -50, y: 0, z: 0 });
    const r = classifyPartByGeometry(cover, CARCASE, 'kitchen');
    expect(r.category).toBe('cover_panel');
    expect(r.confidence).toBeGreaterThan(GEOMETRY_OVERRIDE_THRESHOLD);
  });

  it('thin wide sheet at floor level → toe_kick', () => {
    const toe = box(600, 100, 18, { x: 0, y: 0, z: 0 });  // low + long + thin
    const r = classifyPartByGeometry(toe, CARCASE, 'kitchen');
    expect(r.category).toBe('toe_kick');
    expect(r.confidence).toBeGreaterThan(GEOMETRY_OVERRIDE_THRESHOLD);
  });

  it('thin wide sheet near top of carcase → fascia', () => {
    // Thin at y=700 (top 3% of 720mm carcase).
    const fascia = box(600, 100, 18, { x: 0, y: 700, z: 0 });
    const r = classifyPartByGeometry(fascia, CARCASE, 'kitchen');
    expect(r.category).toBe('fascia');
  });

  it('thin sheet mid-height inside carcase → panel (the generic default)', () => {
    // Shelf-like: thin, wide, mid-height.
    const shelf = box(580, 18, 540, { x: 10, y: 360, z: 10 });
    const r = classifyPartByGeometry(shelf, CARCASE, 'kitchen');
    expect(r.category).toBe('panel');
    // Low confidence — the resolver will keep the name-based reading.
    expect(r.confidence).toBeLessThan(GEOMETRY_OVERRIDE_THRESHOLD);
  });
});

describe('classifyPartByGeometry — sticks (retail uprights)', () => {
  it('tall thin stick in retail domain → upright', () => {
    // Gondola upright: 40×1800×40.
    const upright = box(40, 1800, 40);
    const r = classifyPartByGeometry(upright, undefined, 'retail');
    expect(r.category).toBe('upright');
    expect(r.confidence).toBeGreaterThan(GEOMETRY_OVERRIDE_THRESHOLD);
  });

  it('tall thin stick in pharmacy domain → upright', () => {
    const upright = box(40, 2100, 40);
    const r = classifyPartByGeometry(upright, undefined, 'pharmacy');
    expect(r.category).toBe('upright');
  });

  it('tall thin stick in kitchen domain → stretcher (not upright)', () => {
    // Same geometry, different domain — upright is a retail/pharmacy
    // concept; kitchens call this a stretcher.
    const stick = box(40, 720, 40);
    const r = classifyPartByGeometry(stick, undefined, 'kitchen');
    expect(r.category).toBe('stretcher');
  });
});

describe('classifyPartByGeometry — fallback', () => {
  it('chunky solid → panel fallback with low confidence', () => {
    const chunk = box(200, 200, 200);
    const r = classifyPartByGeometry(chunk, undefined, 'kitchen');
    expect(r.category).toBe('panel');
    expect(r.confidence).toBeLessThan(GEOMETRY_OVERRIDE_THRESHOLD);
  });

  it('zero-size box → panel (defensive)', () => {
    const zero = box(0, 0, 0);
    const r = classifyPartByGeometry(zero);
    expect(r.category).toBe('panel');
  });
});

describe('ASSEMBLY_COLOURS palette', () => {
  it('every AssemblyType has a brand-compatible hex colour', async () => {
    const { ASSEMBLY_COLOURS, ASSEMBLY_COLOUR_FALLBACK } =
      await import('../../constants/workshop-viewer.constants');
    const { ASSEMBLY_TYPES } = await import('../../constants/assembly.constants');
    for (const type of ASSEMBLY_TYPES) {
      const hex = ASSEMBLY_COLOURS[type] ?? ASSEMBLY_COLOUR_FALLBACK;
      // Valid 6-digit hex.
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('assemblyCountsAcross', () => {
  it('sums assembly types across every cabinet group', async () => {
    const { assemblyCountsAcross } = await import('../sceneScheduleSheets');
    const counts = assemblyCountsAcross([
      [{ assemblyType: 'carcass' }, { assemblyType: 'carcass' }, { assemblyType: 'door_assembly' }],
      [{ assemblyType: 'carcass' }, { assemblyType: 'drawer_box' }],
    ]);
    const m = Object.fromEntries(counts.map(c => [c.type, c.count]));
    expect(m.carcass).toBe(3);
    expect(m.door_assembly).toBe(1);
    expect(m.drawer_box).toBe(1);
    // Sorted descending by count.
    expect(counts[0].type).toBe('carcass');
  });
});
