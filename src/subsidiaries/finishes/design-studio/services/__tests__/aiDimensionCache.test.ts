/**
 * Tests for the computeModelSignature helper — the cache key that
 * lets processWithAI skip redundant Claude calls between exports.
 *
 * Invariant: identical geometry + cut list = identical signature,
 * even across fresh objects. Any change a user would actually make
 * to a cabinet (rename mesh, scale geometry, add/remove parts,
 * change cut-list length) MUST flip the signature so the cache
 * falls through.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeModelSignature,
  clearAIDimensionCache,
  aiDimensionCacheSize,
} from '../aiPrintProcessor';
import type { ParsedModel, CutListEntry } from '../../types/workshop-viewer.types';

function makeModel(objects: Array<{ name: string; vertices: number[] }>): ParsedModel {
  return {
    objects: objects.map(o => ({
      name: o.name,
      vertices: new Float32Array(o.vertices),
      indices: new Uint32Array([]),
      material: '',
    })),
    materials: [],
    fileName: 'test.glb',
  } as unknown as ParsedModel;
}

function cabinet() {
  return makeModel([
    { name: 'side_L', vertices: [0, 0, 0, 18, 720, 560] },
    { name: 'side_R', vertices: [600, 0, 0, 618, 720, 560] },
    { name: 'bottom', vertices: [0, 0, 0, 600, 18, 560] },
  ]);
}

// The cache key only uses cutList.length — construct minimal stubs
// via `unknown` so we don't have to keep pace with CutListEntry's
// full field set.
const CUTS = [
  { id: 'a' },
  { id: 'b' },
] as unknown as CutListEntry[];

describe('computeModelSignature', () => {
  it('is stable across repeated calls on the same model', () => {
    const a = computeModelSignature(cabinet(), CUTS);
    const b = computeModelSignature(cabinet(), CUTS);
    expect(a).toBe(b);
  });

  it('is stable regardless of mesh object order', () => {
    const m1 = makeModel([
      { name: 'a', vertices: [0, 0, 0, 10, 10, 10] },
      { name: 'b', vertices: [20, 0, 0, 30, 10, 10] },
    ]);
    const m2 = makeModel([
      { name: 'b', vertices: [20, 0, 0, 30, 10, 10] },
      { name: 'a', vertices: [0, 0, 0, 10, 10, 10] },
    ]);
    expect(computeModelSignature(m1, CUTS))
      .toBe(computeModelSignature(m2, CUTS));
  });

  it('flips when a mesh is RENAMED', () => {
    const a = computeModelSignature(cabinet(), CUTS);
    const renamed = makeModel([
      { name: 'LEFT_SIDE', vertices: [0, 0, 0, 18, 720, 560] }, // was side_L
      { name: 'side_R', vertices: [600, 0, 0, 618, 720, 560] },
      { name: 'bottom', vertices: [0, 0, 0, 600, 18, 560] },
    ]);
    expect(computeModelSignature(renamed, CUTS)).not.toBe(a);
  });

  it('flips when a mesh is SCALED (bbox extremes change)', () => {
    const a = computeModelSignature(cabinet(), CUTS);
    const scaled = makeModel([
      { name: 'side_L', vertices: [0, 0, 0, 18, 720, 560] },
      { name: 'side_R', vertices: [700, 0, 0, 718, 720, 560] }, // moved +100mm
      { name: 'bottom', vertices: [0, 0, 0, 600, 18, 560] },
    ]);
    expect(computeModelSignature(scaled, CUTS)).not.toBe(a);
  });

  it('flips when a mesh is ADDED', () => {
    const a = computeModelSignature(cabinet(), CUTS);
    const withBack = makeModel([
      { name: 'side_L', vertices: [0, 0, 0, 18, 720, 560] },
      { name: 'side_R', vertices: [600, 0, 0, 618, 720, 560] },
      { name: 'bottom', vertices: [0, 0, 0, 600, 18, 560] },
      { name: 'back',   vertices: [0, 0, 550, 600, 720, 568] },
    ]);
    expect(computeModelSignature(withBack, CUTS)).not.toBe(a);
  });

  it('flips when the cut-list length changes', () => {
    const a = computeModelSignature(cabinet(), CUTS);
    const b = computeModelSignature(cabinet(), [...CUTS, CUTS[0]]);
    expect(a).not.toBe(b);
  });

  it('sub-mm float jitter does not flip the signature (1mm rounding)', () => {
    const m1 = makeModel([
      { name: 'a', vertices: [0, 0, 0, 10.3, 10.2, 10.4] },
    ]);
    const m2 = makeModel([
      { name: 'a', vertices: [0, 0, 0, 10.4, 10.2, 10.3] },
    ]);
    // Both round to max bbox [10, 10, 10] — same signature.
    expect(computeModelSignature(m1, CUTS))
      .toBe(computeModelSignature(m2, CUTS));
  });

  it('skips meshes with no vertices (they wouldn\'t render anyway)', () => {
    const withEmpty = makeModel([
      { name: 'side_L', vertices: [0, 0, 0, 18, 720, 560] },
      { name: 'zero',   vertices: [] },
    ]);
    const withoutEmpty = makeModel([
      { name: 'side_L', vertices: [0, 0, 0, 18, 720, 560] },
    ]);
    expect(computeModelSignature(withEmpty, CUTS))
      .toBe(computeModelSignature(withoutEmpty, CUTS));
  });
});

describe('AI cache plumbing', () => {
  beforeEach(() => { clearAIDimensionCache(); });

  it('clearAIDimensionCache empties the cache', () => {
    expect(aiDimensionCacheSize()).toBe(0);
    clearAIDimensionCache();
    expect(aiDimensionCacheSize()).toBe(0);
  });
});
