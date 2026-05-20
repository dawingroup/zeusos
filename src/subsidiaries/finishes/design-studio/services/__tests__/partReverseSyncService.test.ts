/**
 * Unit tests for partReverseSyncService — pure diff + find logic.
 * Firestore write paths are not tested here (would need emulator).
 */
import { describe, it, expect } from 'vitest';
import {
  computeReverseSyncDiff,
  findScenePart,
} from '../partReverseSyncService';
import type { ScenePart, SceneAssembly } from '../../types/assembly.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function scenePart(over: Partial<ScenePart> = {}): ScenePart {
  return {
    id: over.id ?? 'sp1',
    assemblyId: 'a1',
    cabinetId: 'c1',
    partCode: 'SIDE',
    partName: 'Side Panel',
    partCategory: 'panel',
    inventoryItemId: 'inv-oak',
    inventoryItemName: 'Oak 18mm',
    materialDescription: 'Oak veneered MDF',
    meshNodeId: over.meshNodeId ?? 'mesh-1',
    dimensions: over.dimensions ?? { length: 720, width: 560, thickness: 18, grainDirection: 'length' },
    quantity: 1,
    unit: 'ea',
    unitCost: 0,
    totalCost: 0,
    currency: 'UGX',
    ...over,
  };
}

// ---------------------------------------------------------------------------
// computeReverseSyncDiff
// ---------------------------------------------------------------------------

describe('computeReverseSyncDiff', () => {
  it('returns null when nothing changed', () => {
    const part = scenePart();
    const diff = computeReverseSyncDiff(part, {
      materialDescription: 'Oak veneered MDF',
      finishLibraryId: undefined,
    });
    expect(diff).toBeNull();
  });

  it('detects a material description change', () => {
    const part = scenePart();
    const diff = computeReverseSyncDiff(part, {
      materialDescription: 'Walnut Veneer',
    });
    expect(diff).toEqual({ materialDescription: 'Walnut Veneer' });
  });

  it('detects a finishLibraryId change', () => {
    const part = scenePart({ finishLibraryId: 'old-id' });
    const diff = computeReverseSyncDiff(part, {
      finishLibraryId: 'new-id',
    });
    expect(diff).toEqual({ finishLibraryId: 'new-id' });
  });

  it('detects multiple top-level field changes', () => {
    const part = scenePart();
    const diff = computeReverseSyncDiff(part, {
      materialDescription: 'Birch Ply',
      inventoryItemId: 'inv-birch',
      inventoryItemName: 'Birch Plywood 18mm',
    });
    expect(diff).toEqual({
      materialDescription: 'Birch Ply',
      inventoryItemId: 'inv-birch',
      inventoryItemName: 'Birch Plywood 18mm',
    });
  });

  it('merges only changed dimension sub-fields', () => {
    const part = scenePart({
      dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' },
    });
    const diff = computeReverseSyncDiff(part, {
      dimensions: { thickness: 25 },
    });
    expect(diff).toEqual({
      dimensions: { length: 720, width: 560, thickness: 25, grainDirection: 'length' },
    });
  });

  it('sets dimensions when part had none', () => {
    const part = scenePart({ dimensions: undefined });
    const diff = computeReverseSyncDiff(part, {
      dimensions: { length: 600, width: 400, thickness: 18 },
    });
    expect(diff).toEqual({
      dimensions: { length: 600, width: 400, thickness: 18 },
    });
  });

  it('detects edgeBanding change', () => {
    const part = scenePart({
      edgeBanding: {
        top: { type: 'ABS 1mm', length: 560 },
        bottom: null,
        left: null,
        right: null,
        front: null,
      },
    });
    const newEB = {
      top: { type: 'ABS 2mm', length: 560 },
      bottom: null,
      left: null,
      right: null,
      front: null,
    };
    const diff = computeReverseSyncDiff(part, { edgeBanding: newEB });
    expect(diff).toEqual({ edgeBanding: newEB });
  });

  it('skips edgeBanding when identical', () => {
    const eb = {
      top: { type: 'ABS 1mm', length: 560 },
      bottom: null,
      left: null,
      right: null,
      front: null,
    };
    const part = scenePart({ edgeBanding: eb });
    const diff = computeReverseSyncDiff(part, { edgeBanding: eb });
    expect(diff).toBeNull();
  });

  it('detects notes change', () => {
    const part = scenePart({ notes: 'old note' });
    const diff = computeReverseSyncDiff(part, { notes: 'updated note' });
    expect(diff).toEqual({ notes: 'updated note' });
  });
});

// ---------------------------------------------------------------------------
// findScenePart
// ---------------------------------------------------------------------------

function asm(id: string, parts: ScenePart[]): SceneAssembly {
  return {
    id,
    cabinetId: 'c1',
    assemblyType: 'carcass',
    assemblyCode: id,
    displayName: id,
    parts,
    meshNodeIds: parts.map(p => p.meshNodeId).filter(Boolean) as string[],
    boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 }, center: { x: 0.5, y: 0.5, z: 0.5 }, size: { x: 1, y: 1, z: 1 } },
    jointSpec: [],
    assemblySequence: [],
    isComplete: true,
    totalPartCount: parts.length,
    totalArea: 0,
    totalCost: 0,
    sequence: 0,
  };
}

describe('findScenePart', () => {
  const assemblies: SceneAssembly[] = [
    asm('asm1', [
      scenePart({ id: 'p1', meshNodeId: 'mesh-A' }),
      scenePart({ id: 'p2', meshNodeId: 'mesh-B' }),
    ]),
    asm('asm2', [
      scenePart({ id: 'p3', meshNodeId: 'mesh-C' }),
    ]),
  ];

  it('finds by meshNodeId', () => {
    const found = findScenePart(assemblies, 'mesh-B');
    expect(found).not.toBeNull();
    expect(found!.assemblyIndex).toBe(0);
    expect(found!.partIndex).toBe(1);
    expect(found!.part.id).toBe('p2');
  });

  it('finds by partId as fallback', () => {
    const found = findScenePart(assemblies, undefined, 'p3');
    expect(found).not.toBeNull();
    expect(found!.assemblyIndex).toBe(1);
    expect(found!.partIndex).toBe(0);
  });

  it('prefers meshNodeId over partId', () => {
    const found = findScenePart(assemblies, 'mesh-A', 'p3');
    expect(found!.part.id).toBe('p1'); // mesh-A is p1
  });

  it('returns null when not found', () => {
    expect(findScenePart(assemblies, 'mesh-Z')).toBeNull();
    expect(findScenePart(assemblies, undefined, 'pX')).toBeNull();
  });

  it('returns null for empty assemblies', () => {
    expect(findScenePart([], 'mesh-A')).toBeNull();
  });
});
