/**
 * Tests for detectSubCabinets — the bbox-clustering detector that
 * finds logically-separate cabinets inside one imported SceneCabinet.
 */
import { describe, it, expect } from 'vitest';
import { detectSubCabinets } from '../splitCabinetDetection';

type Box = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };

function box(x0: number, z0: number, w = 100, h = 720, d = 560): Box {
  return {
    min: { x: x0, y: 0, z: z0 },
    max: { x: x0 + w, y: h, z: z0 + d },
  };
}

function bboxes(entries: Array<[string, Box]>) {
  return new Map<string, Box>(entries);
}

describe('detectSubCabinets — trivially connected cabinet', () => {
  it('single cluster when every mesh touches another', () => {
    const meshes = ['side_L', 'side_R', 'bottom', 'back'];
    const boxes = bboxes([
      ['side_L', box(0,   0)],   // 0..100
      ['side_R', box(100, 0)],   // 100..200 — touches side_L at x=100
      ['bottom', box(0,   0, 200, 18, 560)],
      ['back',   box(0,   540, 200, 720, 18)],
    ]);
    const r = detectSubCabinets(meshes, boxes, { gapToleranceMm: 5, minMeshesPerCluster: 2 });
    expect(r.clusters).toHaveLength(1);
    expect(r.clusters[0].meshNames.sort()).toEqual(['back', 'bottom', 'side_L', 'side_R']);
    expect(r.orphans).toEqual([]);
  });
});

describe('detectSubCabinets — two cabinets with a gap', () => {
  it('splits into two clusters when x-gap exceeds tolerance', () => {
    const meshes = ['A_side_L', 'A_side_R', 'A_bot', 'B_side_L', 'B_side_R', 'B_bot'];
    // Cabinet A: x 0..200
    // Cabinet B: x 500..700 (300mm gap from A)
    const boxes = bboxes([
      ['A_side_L', box(0,   0)],
      ['A_side_R', box(100, 0)],
      ['A_bot',    box(0,   0, 200, 18, 560)],
      ['B_side_L', box(500, 0)],
      ['B_side_R', box(600, 0)],
      ['B_bot',    box(500, 0, 200, 18, 560)],
    ]);
    const r = detectSubCabinets(meshes, boxes, { gapToleranceMm: 50 });
    expect(r.clusters).toHaveLength(2);
    // Clusters sorted by size desc — both volumes equal here, just check total.
    const meshA = new Set(r.clusters[0].meshNames.concat(r.clusters[1].meshNames));
    expect(meshA.size).toBe(6);
  });

  it('treats small gaps within tolerance as one cabinet', () => {
    const meshes = ['A_side', 'B_side'];
    // 30mm gap between the two — default 50mm tolerance swallows it.
    const boxes = bboxes([
      ['A_side', box(0, 0)],
      ['B_side', box(130, 0)],
    ]);
    const r = detectSubCabinets(meshes, boxes);
    expect(r.clusters).toHaveLength(1);
  });
});

describe('detectSubCabinets — orphan handling', () => {
  it('discards single-mesh "clusters" below minMeshesPerCluster', () => {
    const meshes = ['main_L', 'main_R', 'stray'];
    const boxes = bboxes([
      ['main_L', box(0,    0)],
      ['main_R', box(100,  0)],
      ['stray',  box(2000, 0, 10, 10, 10)],  // floating single mesh
    ]);
    const r = detectSubCabinets(meshes, boxes);
    expect(r.clusters).toHaveLength(1);
    expect(r.clusters[0].meshNames.sort()).toEqual(['main_L', 'main_R']);
    expect(r.orphans).toContain('stray');
  });

  it('collects meshes missing from the bbox map as orphans', () => {
    const meshes = ['known', 'mystery'];
    const boxes = bboxes([['known', box(0, 0)]]);
    const r = detectSubCabinets(meshes, boxes);
    expect(r.orphans).toContain('mystery');
  });
});

describe('detectSubCabinets — clusters sorted by volume desc', () => {
  it('largest cluster first so index 0 = "main" cabinet', () => {
    const meshes = ['small_1', 'small_2', 'big_1', 'big_2'];
    const boxes = bboxes([
      // Small cluster: 100 × 100 × 100
      ['small_1', box(0, 0, 50, 100, 50)],
      ['small_2', box(50, 0, 50, 100, 50)],
      // Big cluster: 600 × 720 × 560
      ['big_1', box(1000, 0, 300, 720, 560)],
      ['big_2', box(1300, 0, 300, 720, 560)],
    ]);
    const r = detectSubCabinets(meshes, boxes);
    expect(r.clusters).toHaveLength(2);
    // Big one first.
    const vol0 = r.clusters[0].size.width * r.clusters[0].size.depth * r.clusters[0].size.height;
    const vol1 = r.clusters[1].size.width * r.clusters[1].size.depth * r.clusters[1].size.height;
    expect(vol0).toBeGreaterThan(vol1);
    expect(r.clusters[0].meshNames.sort()).toEqual(['big_1', 'big_2']);
  });
});

describe('detectSubCabinets — gapToleranceMm override', () => {
  it('tighter tolerance splits things a wider one would merge', () => {
    const meshes = ['A', 'B'];
    const boxes = bboxes([
      ['A', box(0,   0)],
      ['B', box(130, 0)],  // 30mm gap
    ]);
    const loose = detectSubCabinets(meshes, boxes, { gapToleranceMm: 50 });
    const tight = detectSubCabinets(meshes, boxes, { gapToleranceMm: 10, minMeshesPerCluster: 1 });
    expect(loose.clusters).toHaveLength(1);
    expect(tight.clusters).toHaveLength(2);
  });
});
