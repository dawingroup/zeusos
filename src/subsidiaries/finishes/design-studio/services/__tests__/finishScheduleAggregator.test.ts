/**
 * Tests for aggregateFinishSchedule — project-wide finish schedule
 * consolidation. Pins the multiplication + aggregation invariants.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { aggregateFinishSchedule } from '../finishScheduleAggregator';
import type { SceneCabinet } from '../../types/scene.types';
import type { ScenePart, SceneAssembly } from '../../types/assembly.types';

const NOW = Timestamp.fromMillis(1_700_000_000_000);

function part(over: Partial<ScenePart> = {}): ScenePart {
  return {
    id: over.id ?? 'p1',
    assemblyId: 'a1',
    cabinetId: 'c1',
    partCode: 'SIDE',
    partName: 'Side',
    partCategory: 'panel',
    inventoryItemId: '',
    inventoryItemName: '',
    materialDescription: '',
    quantity: 1,
    unit: 'ea',
    unitCost: 0, totalCost: 0, currency: 'UGX',
    ...over,
  };
}

function cabinet(over: Partial<SceneCabinet> & { finishSelections?: Record<string, string>; parts?: ScenePart[] } = {}): SceneCabinet {
  const asm: SceneAssembly = {
    id: 'a1', cabinetId: over.id ?? 'c1', assemblyType: 'carcass', assemblyCode: 'A1',
    displayName: 'Carcass', parts: over.parts ?? [], meshNodeIds: [],
    boundingBox: {
      min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 },
    },
    jointSpec: [], assemblySequence: [], isComplete: true,
    totalPartCount: 0, totalArea: 0, totalCost: 0, sequence: 0,
  };
  return {
    id: over.id ?? 'c1', sceneId: 's1', pddId: 'p',
    cabinetCode: over.cabinetCode ?? 'KB-A',
    displayName: over.displayName ?? 'Cabinet A',
    configuration: {},
    finishSelections: over.finishSelections ?? {},
    position: { x: 0, y: 0, z: 0 }, rotation: 0, anchorPoint: 'bottom_back_left',
    glbUrl: '', thumbnailUrl: '',
    assemblies: [asm],
    computedBOM: [],
    estimatedPrice: { total: 0, currency: 'UGX' } as SceneCabinet['estimatedPrice'],
    isLocked: false, sequence: 0,
    requiredQuantity: over.requiredQuantity,
    createdAt: NOW, updatedAt: NOW,
  };
}

describe('aggregateFinishSchedule — basics', () => {
  it('returns [] for no cabinets', () => {
    expect(aggregateFinishSchedule([])).toEqual([]);
  });

  it('aggregates one cabinet with one finishSelection into one row', () => {
    const rows = aggregateFinishSchedule([
      cabinet({ finishSelections: { carcass: 'fin-oak' } }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].finishLibraryId).toBe('fin-oak');
    expect(rows[0].cabinetCount).toBe(1);
    expect(rows[0].appliedTo).toEqual(['carcass']);
  });

  it('collapses same finish across cabinets + application roles', () => {
    const rows = aggregateFinishSchedule([
      cabinet({ id: 'c1', cabinetCode: 'KB-A', finishSelections: { carcass: 'fin-oak' } }),
      cabinet({ id: 'c2', cabinetCode: 'KB-B', finishSelections: { carcass: 'fin-oak', doors: 'fin-oak' } }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].cabinetCount).toBe(2);
    expect(rows[0].cabinetLabels.sort()).toEqual(['KB-A', 'KB-B']);
    expect(rows[0].appliedTo.sort()).toEqual(['carcass', 'doors']);
  });
});

describe('aggregateFinishSchedule — library resolution', () => {
  it('passes resolved name / code / colorHex through', () => {
    const rows = aggregateFinishSchedule(
      [cabinet({ finishSelections: { carcass: 'fin-oak' } })],
      id => id === 'fin-oak'
        ? { id, name: 'Oak 18mm veneered MDF', code: 'OAK-18-MDF', colorHex: '#8b5a2b', description: 'Natural oak' }
        : undefined,
    );
    expect(rows[0].name).toBe('Oak 18mm veneered MDF');
    expect(rows[0].code).toBe('OAK-18-MDF');
    expect(rows[0].colorHex).toBe('#8b5a2b');
  });

  it('falls back to the raw id when unresolved', () => {
    const rows = aggregateFinishSchedule([cabinet({ finishSelections: { carcass: 'missing-id' } })]);
    expect(rows[0].name).toBe('missing-id');
  });
});

describe('aggregateFinishSchedule — multiplication', () => {
  it('multiplies cabinet-level finishSelection partCount by requiredQuantity', () => {
    const rows = aggregateFinishSchedule([
      cabinet({ finishSelections: { carcass: 'fin-oak' }, requiredQuantity: 4 }),
    ]);
    // cabinet-level selection = 1 slot × 4 units = 4.
    expect(rows[0].partCount).toBe(4);
  });

  it('multiplies per-part finishLibraryId quantity by requiredQuantity', () => {
    const rows = aggregateFinishSchedule([
      cabinet({
        requiredQuantity: 3,
        parts: [
          part({ id: 'p1', quantity: 2, finishLibraryId: 'fin-oak' }),
        ],
      }),
    ]);
    // per-part 2 × requiredQuantity 3 = 6.
    expect(rows[0].partCount).toBe(6);
  });

  it('sums per-part + cabinet-level contributions', () => {
    const rows = aggregateFinishSchedule([
      cabinet({
        requiredQuantity: 2,
        finishSelections: { carcass: 'fin-oak' },
        parts: [
          part({ quantity: 2, finishLibraryId: 'fin-oak' }),
        ],
      }),
    ]);
    // cabinet-level = 1 × 2 = 2. parts = 2 × 2 = 4. Total = 6.
    expect(rows[0].partCount).toBe(6);
  });
});

describe('aggregateFinishSchedule — sorting', () => {
  it('resolved names sort before unresolved raw ids', () => {
    const rows = aggregateFinishSchedule(
      [
        cabinet({ id: 'c1', finishSelections: { carcass: 'fin-missing' } }),
        cabinet({ id: 'c2', finishSelections: { carcass: 'fin-zinc' } }),
        cabinet({ id: 'c3', finishSelections: { carcass: 'fin-ash' } }),
      ],
      id => id === 'fin-zinc' ? { id, name: 'Zinc grey' }
          : id === 'fin-ash'  ? { id, name: 'Ash white' }
          : undefined,
    );
    // Resolved rows first, alphabetical by name; unresolved at the end.
    expect(rows.map(r => r.name)).toEqual(['Ash white', 'Zinc grey', 'fin-missing']);
  });
});
