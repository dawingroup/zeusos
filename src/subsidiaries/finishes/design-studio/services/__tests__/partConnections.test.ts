/**
 * Tests for findPartConnections — the structural-neighbour resolver
 * that drives the Part Detail panel's connections list.
 */
import { describe, it, expect } from 'vitest';
import { findPartConnections, sharesMeshBaseToken } from '../partConnections';
import type { ScenePart, SceneAssembly } from '../../types/assembly.types';

function part(over: Partial<ScenePart>): ScenePart {
  return {
    id: over.id ?? 'p',
    assemblyId: over.assemblyId ?? 'a1',
    cabinetId: 'c1',
    partCode: over.partCode ?? 'PART',
    partName: over.partName ?? 'Part',
    partCategory: 'panel',
    inventoryItemId: '',
    inventoryItemName: '',
    meshNodeId: over.meshNodeId,
    quantity: 1,
    unit: 'pcs',
    unitCost: 0,
    totalCost: 0,
    currency: 'UGX',
    materialDescription: '',
    boringSpec: over.boringSpec,
    ...over,
  };
}

function assembly(id: string, parts: ScenePart[], over: Partial<SceneAssembly> = {}): SceneAssembly {
  return {
    id,
    cabinetId: 'c1',
    assemblyType: 'carcass',
    assemblyCode: id,
    displayName: id,
    parts,
    meshNodeIds: [],
    boundingBox: {
      min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 },
    },
    jointSpec: [],
    assemblySequence: [],
    isComplete: true,
    totalPartCount: parts.length,
    totalArea: 0,
    totalCost: 0,
    sequence: 0,
    ...over,
  };
}

describe('findPartConnections — same-assembly siblings', () => {
  it('returns every part in the same assembly except the selected one', () => {
    const a = part({ id: 'a', assemblyId: 'carc', partName: 'Side L' });
    const b = part({ id: 'b', assemblyId: 'carc', partName: 'Side R' });
    const c = part({ id: 'c', assemblyId: 'carc', partName: 'Bottom' });
    const drw = part({ id: 'd', assemblyId: 'drw', partName: 'Drawer side' });
    const r = findPartConnections(a, {
      assemblies: [assembly('carc', [a, b, c]), assembly('drw', [drw])],
    });
    expect(r.sameAssembly.map(p => p.id).sort()).toEqual(['b', 'c']);
    expect(r.parentAssembly?.id).toBe('carc');
  });

  it('handles a cabinet with only the selected part', () => {
    const only = part({ id: 'only', assemblyId: 'carc' });
    const r = findPartConnections(only, {
      assemblies: [assembly('carc', [only])],
    });
    expect(r.sameAssembly).toEqual([]);
    expect(r.summary.total).toBe(0);
  });
});

describe('findPartConnections — joined via jointSpec', () => {
  it('picks up cross-assembly parts referenced by the parent assembly jointSpec', () => {
    const side = part({ id: 'side', assemblyId: 'carc', meshNodeId: 'mesh_side' });
    const front = part({ id: 'front', assemblyId: 'drw', meshNodeId: 'mesh_front' });
    // Parent assembly's jointSpec ties side → front via a cam-lock.
    const r = findPartConnections(side, {
      assemblies: [
        assembly('carc', [side], {
          jointSpec: [{ meshA: 'mesh_side', meshB: 'mesh_front', type: 'cam' } as never],
        }),
        assembly('drw', [front]),
      ],
    });
    expect(r.joined.map(p => p.id)).toContain('front');
  });
});

describe('findPartConnections — joined via boringSpec', () => {
  it('picks up parts whose mesh is drilled INTO by the selected part', () => {
    const drawerFront = part({
      id: 'df',
      assemblyId: 'drw',
      meshNodeId: 'mesh_drawer_front',
      boringSpec: { intoMeshId: 'mesh_box_side' } as unknown as ScenePart['boringSpec'],
    });
    const boxSide = part({
      id: 'bs',
      assemblyId: 'drw-box',
      meshNodeId: 'mesh_box_side',
    });
    const r = findPartConnections(drawerFront, {
      assemblies: [
        assembly('drw', [drawerFront]),
        assembly('drw-box', [boxSide]),
      ],
    });
    expect(r.joined.map(p => p.id)).toContain('bs');
  });
});

describe('findPartConnections — neighbouringByName', () => {
  it('matches parts whose mesh name shares a base token', () => {
    const side = part({ id: 'side', assemblyId: 'carc', meshNodeId: 'side_L' });
    const sideCover = part({ id: 'scov', assemblyId: 'covers', meshNodeId: 'side_L_cover' });
    const unrelated = part({ id: 'u', assemblyId: 'other', meshNodeId: 'shelf_top' });
    const r = findPartConnections(side, {
      assemblies: [
        assembly('carc', [side]),
        assembly('covers', [sideCover]),
        assembly('other', [unrelated]),
      ],
    });
    expect(r.neighbouringByName.map(p => p.id)).toContain('scov');
    expect(r.neighbouringByName.map(p => p.id)).not.toContain('u');
  });

  it('prefers joined over neighbouringByName (no double counting)', () => {
    const a = part({
      id: 'a', assemblyId: 'asm-a', meshNodeId: 'door_L',
      boringSpec: { intoMeshId: 'door_L_cover' } as unknown as ScenePart['boringSpec'],
    });
    const b = part({ id: 'b', assemblyId: 'asm-b', meshNodeId: 'door_L_cover' });
    const r = findPartConnections(a, {
      assemblies: [
        assembly('asm-a', [a]),
        assembly('asm-b', [b]),
      ],
    });
    expect(r.joined.map(p => p.id)).toContain('b');
    expect(r.neighbouringByName.map(p => p.id)).not.toContain('b');
  });
});

describe('findPartConnections — bbox-touching bucket', () => {
  it('includes parts whose mesh bbox meets the selected part face-to-face', () => {
    const side = part({ id: 'side', assemblyId: 'carc', meshNodeId: 'mesh_side' });
    const bottom = part({ id: 'bot', assemblyId: 'carc', meshNodeId: 'mesh_bottom' });
    // cover panel outside carcase but touching the side face
    const cover = part({ id: 'cov', assemblyId: 'covers', meshNodeId: 'mesh_cover' });
    const unrelated = part({ id: 'unrel', assemblyId: 'drawer', meshNodeId: 'mesh_drawer' });

    const bboxes = new Map([
      // Side panel: 0..18 × 0..720 × 0..560
      ['mesh_side', { min: { x: 0, y: 0, z: 0 }, max: { x: 18, y: 720, z: 560 } }],
      // Bottom panel: 0..600 × 0..18 × 0..560 — touches side at x=0..18 y=0
      ['mesh_bottom', { min: { x: 18, y: 0, z: 0 }, max: { x: 600, y: 18, z: 560 } }],
      // Cover panel: -20..-2 × 0..720 × 0..560 — touches side at x=0 (3mm gap)
      ['mesh_cover', { min: { x: -20, y: 0, z: 0 }, max: { x: -2, y: 720, z: 560 } }],
      // Unrelated: 2000..2100 — miles away
      ['mesh_drawer', { min: { x: 2000, y: 0, z: 0 }, max: { x: 2100, y: 100, z: 100 } }],
    ]);

    const r = findPartConnections(side, {
      assemblies: [
        assembly('carc', [side, bottom]),
        assembly('covers', [cover]),
        assembly('drawer', [unrelated]),
      ],
    }, { bboxByMesh: bboxes, touchToleranceMm: 5 });
    // Bottom is in sameAssembly (takes priority); cover should land in touching.
    expect(r.touching.map(p => p.id)).toContain('cov');
    expect(r.touching.map(p => p.id)).not.toContain('unrel');
    expect(r.touching.map(p => p.id)).not.toContain('bot'); // already in sameAssembly
  });

  it('is empty when no bbox map is provided (graceful fallback)', () => {
    const side = part({ id: 'side', assemblyId: 'carc', meshNodeId: 'mesh_side' });
    const r = findPartConnections(side, {
      assemblies: [assembly('carc', [side])],
    });
    expect(r.touching).toEqual([]);
    expect(r.summary.touching).toBe(0);
  });
});

describe('findPartConnections — hardware drill-through', () => {
  it('extracts inventoryItemId references from boringSpec.targets', () => {
    const side = part({
      id: 'side',
      assemblyId: 'carc',
      meshNodeId: 'mesh_side',
      boringSpec: {
        targets: [
          { inventoryItemId: 'inv-hinge-cup', label: '35mm hinge cup', quantity: 2 },
          { inventoryItemId: 'inv-dowel', quantity: 4 },
        ],
      } as unknown as ScenePart['boringSpec'],
    });
    const r = findPartConnections(side, {
      assemblies: [assembly('carc', [side])],
    });
    const ids = r.hardwareTargets.map(t => t.inventoryItemId);
    expect(ids).toContain('inv-hinge-cup');
    expect(ids).toContain('inv-dowel');
    const hinge = r.hardwareTargets.find(t => t.inventoryItemId === 'inv-hinge-cup');
    expect(hinge?.label).toBe('35mm hinge cup');
    expect(hinge?.quantity).toBe(2);
  });

  it('also picks up hardware under alternate keys (hardware[], holes[])', () => {
    const p = part({
      id: 'p',
      assemblyId: 'a',
      meshNodeId: 'm',
      boringSpec: {
        hardware: [{ hardwareId: 'inv-runner', description: 'Blum Movento runner' }],
        holes: [{ itemId: 'inv-screw', quantity: 8 }],
      } as unknown as ScenePart['boringSpec'],
    });
    const r = findPartConnections(p, {
      assemblies: [assembly('a', [p])],
    });
    const ids = r.hardwareTargets.map(t => t.inventoryItemId).filter(Boolean);
    expect(ids).toEqual(expect.arrayContaining(['inv-runner', 'inv-screw']));
  });

  it('skips mesh-only boring targets (those belong in joined)', () => {
    const drawerFront = part({
      id: 'df',
      assemblyId: 'drw',
      meshNodeId: 'mesh_df',
      boringSpec: {
        targets: [
          { meshId: 'mesh_box_side' }, // mesh-only → skipped
          { inventoryItemId: 'inv-hinge', label: 'Soft-close hinge' }, // hardware
        ],
      } as unknown as ScenePart['boringSpec'],
    });
    const r = findPartConnections(drawerFront, {
      assemblies: [assembly('drw', [drawerFront])],
    });
    expect(r.hardwareTargets).toHaveLength(1);
    expect(r.hardwareTargets[0].inventoryItemId).toBe('inv-hinge');
  });

  it('dedupes identical inventoryItemId entries and sums quantity', () => {
    const p = part({
      id: 'p',
      assemblyId: 'a',
      boringSpec: {
        targets: [
          { inventoryItemId: 'inv-dowel', quantity: 4 },
          { inventoryItemId: 'inv-dowel', quantity: 2 },
        ],
      } as unknown as ScenePart['boringSpec'],
    });
    const r = findPartConnections(p, { assemblies: [assembly('a', [p])] });
    expect(r.hardwareTargets).toHaveLength(1);
    expect(r.hardwareTargets[0].quantity).toBe(6);
  });

  it('returns empty when no boringSpec is set', () => {
    const p = part({ id: 'p', assemblyId: 'a' });
    const r = findPartConnections(p, { assemblies: [assembly('a', [p])] });
    expect(r.hardwareTargets).toEqual([]);
  });
});

describe('boxesAdjacent', () => {
  it('returns true for intersecting boxes', async () => {
    const { boxesAdjacent } = await import('../partConnections');
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 100, y: 100, z: 100 } };
    const b = { min: { x: 50, y: 50, z: 50 }, max: { x: 150, y: 150, z: 150 } };
    expect(boxesAdjacent(a, b)).toBe(true);
  });

  it('returns true for face-to-face touching boxes within tolerance', async () => {
    const { boxesAdjacent } = await import('../partConnections');
    // Boxes at x=0..10 and x=12..20 — 2mm gap, overlapping on y/z
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 100, z: 100 } };
    const b = { min: { x: 12, y: 0, z: 0 }, max: { x: 20, y: 100, z: 100 } };
    expect(boxesAdjacent(a, b, 5)).toBe(true);
  });

  it('returns false when gap exceeds tolerance', async () => {
    const { boxesAdjacent } = await import('../partConnections');
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 100, z: 100 } };
    const b = { min: { x: 30, y: 0, z: 0 }, max: { x: 40, y: 100, z: 100 } };
    expect(boxesAdjacent(a, b, 5)).toBe(false);
  });

  it('returns false for boxes only touching at an edge (2 axes non-overlapping)', async () => {
    const { boxesAdjacent } = await import('../partConnections');
    const a = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } };
    const b = { min: { x: 20, y: 20, z: 0 }, max: { x: 30, y: 30, z: 10 } };
    expect(boxesAdjacent(a, b, 5)).toBe(false);
  });
});

describe('sharesMeshBaseToken', () => {
  it('matches common variant suffix pairs', () => {
    expect(sharesMeshBaseToken('side_L', 'side_R')).toBe(true);
    expect(sharesMeshBaseToken('side_L', 'side_L_cover')).toBe(true);
    expect(sharesMeshBaseToken('drawer_front_01', 'drawer_front_02')).toBe(true);
  });

  it('rejects unrelated names', () => {
    expect(sharesMeshBaseToken('side_L', 'shelf_top')).toBe(false);
    expect(sharesMeshBaseToken('', 'anything')).toBe(false);
    expect(sharesMeshBaseToken('side_L', undefined)).toBe(false);
  });

  it('requires a stem of at least 3 chars to avoid false positives', () => {
    expect(sharesMeshBaseToken('a_L', 'a_R')).toBe(false);
  });
});
