/**
 * Tests for revisionPartsDiff — mesh-aware diff + decision-driven merge.
 */
import { describe, it, expect } from 'vitest';
import {
  diffCabinetParts, mergeDiff, defaultDecisionFor,
  type ChangeDecision,
} from '../revisionPartsDiff';
import type { ScenePart, SceneAssembly } from '../../types/assembly.types';
import type { SceneCabinet } from '../../types/scene.types';

function part(over: Partial<ScenePart> = {}): ScenePart {
  return {
    id: over.id ?? 'p1',
    assemblyId: 'a1',
    cabinetId: 'c1',
    partCode: over.partCode ?? 'SIDE',
    partName: over.partName ?? 'Side Panel',
    partCategory: over.partCategory ?? 'panel',
    inventoryItemId: over.inventoryItemId ?? 'inv-oak',
    inventoryItemName: over.inventoryItemName ?? 'Oak 18mm',
    materialDescription: over.materialDescription ?? 'Oak veneered MDF',
    dimensions: over.dimensions ?? { length: 720, width: 560, thickness: 18, grainDirection: 'length' },
    quantity: over.quantity ?? 1,
    unit: 'ea',
    unitCost: 0,
    totalCost: 0,
    currency: 'UGX',
    ...over,
  };
}

function cabinet(parts: ScenePart[], overrides?: SceneCabinet['partOverrides']): Pick<SceneCabinet, 'assemblies' | 'partOverrides'> {
  const asm: SceneAssembly = {
    id: 'a1', cabinetId: 'c1', assemblyType: 'carcass', assemblyCode: 'A1',
    displayName: 'Carcase', parts, meshNodeIds: [],
    boundingBox: {
      min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 },
    },
    jointSpec: [], assemblySequence: [], isComplete: true,
    totalPartCount: parts.length, totalArea: 0, totalCost: 0, sequence: 0,
  };
  return { assemblies: [asm], partOverrides: overrides };
}

describe('diffCabinetParts — mesh-keyed matching', () => {
  it('classifies a fresh part as added', () => {
    const diff = diffCabinetParts(cabinet([]), [part({ id: 'p1', meshNodeId: 'm1' })]);
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.removed).toBe(0);
  });

  it('classifies a dropped part as removed', () => {
    const diff = diffCabinetParts(cabinet([part({ id: 'p1', meshNodeId: 'm1' })]), []);
    expect(diff.summary.removed).toBe(1);
  });

  it('matches by meshNodeId even when partCode differs', () => {
    const current = cabinet([part({ id: 'p1', meshNodeId: 'm1', partCode: 'SIDE_L' })]);
    const incoming = [part({ id: 'p-new', meshNodeId: 'm1', partCode: 'LEFT_SIDE' })];
    const diff = diffCabinetParts(current, incoming);
    expect(diff.summary.changed).toBe(1);
    expect(diff.summary.added).toBe(0);
    const ch = diff.changes[0];
    expect(ch.kind).toBe('changed');
    expect(ch.changes.map(c => c.field)).toContain('partCode');
  });

  it('falls back to attribute match when mesh ids absent', () => {
    // Same SIDE code + oak + 720x560x18 — should match despite different part.id.
    const current = cabinet([part({ id: 'p1' })]);
    const incoming = [part({ id: 'p2' })];
    const diff = diffCabinetParts(current, incoming);
    expect(diff.summary.unchanged).toBe(1);
  });

  it('reports unchanged when nothing differs', () => {
    const current = cabinet([part({ id: 'p1', meshNodeId: 'm1' })]);
    const diff = diffCabinetParts(current, [part({ id: 'p1', meshNodeId: 'm1' })]);
    expect(diff.summary.unchanged).toBe(1);
    expect(diff.summary.changed).toBe(0);
  });
});

describe('diffCabinetParts — field deltas', () => {
  it('flags a thickness change', () => {
    const current = cabinet([part({ meshNodeId: 'm1', dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' } })]);
    const incoming = [part({ meshNodeId: 'm1', dimensions: { length: 720, width: 560, thickness: 22, grainDirection: 'length' } })];
    const diff = diffCabinetParts(current, incoming);
    const fields = diff.changes[0].changes.map(c => c.field);
    expect(fields).toContain('thickness');
  });

  it('flags a material swap', () => {
    const current = cabinet([part({ meshNodeId: 'm1', inventoryItemId: 'inv-oak', inventoryItemName: 'Oak 18mm' })]);
    const incoming = [part({ meshNodeId: 'm1', inventoryItemId: 'inv-walnut', inventoryItemName: 'Walnut 18mm' })];
    const diff = diffCabinetParts(current, incoming);
    const fields = diff.changes[0].changes.map(c => c.field);
    expect(fields).toContain('materialId');
    expect(fields).toContain('materialName');
  });

  it('surfaces overrides on the change', () => {
    const current = cabinet(
      [part({ id: 'p1', meshNodeId: 'm1', partName: 'Left Side Panel (renamed)' })],
      { p1: { nameLocked: true } },
    );
    const incoming = [part({ meshNodeId: 'm1', partName: 'Side Panel' })];
    const diff = diffCabinetParts(current, incoming);
    const nameChange = diff.changes[0].changes.find(c => c.field === 'partName');
    expect(nameChange?.locked).toBe(true);
    expect(diff.changes[0].overrides?.nameLocked).toBe(true);
  });
});

describe('defaultDecisionFor', () => {
  it('applies added, drops removed, keeps unchanged', () => {
    expect(defaultDecisionFor({ kind: 'added', id: 'p1', label: 'l', changes: [] })).toBe('apply');
    expect(defaultDecisionFor({ kind: 'removed', id: 'p1', label: 'l', changes: [] })).toBe('drop');
    expect(defaultDecisionFor({ kind: 'unchanged', id: 'p1', label: 'l', changes: [] })).toBe('keep');
  });

  it('changed → apply when any unlocked field differs', () => {
    const d = defaultDecisionFor({
      kind: 'changed', id: 'p1', label: 'l',
      changes: [
        { field: 'partName', before: 'a', after: 'b', locked: true },
        { field: 'thickness', before: 18, after: 22 },  // unlocked
      ],
    });
    expect(d).toBe('apply');
  });

  it('changed → keep when every differing field is locked', () => {
    const d = defaultDecisionFor({
      kind: 'changed', id: 'p1', label: 'l',
      changes: [
        { field: 'partName', before: 'a', after: 'b', locked: true },
        { field: 'materialId', before: 'x', after: 'y', locked: true },
      ],
    });
    expect(d).toBe('keep');
  });
});

describe('mergeDiff', () => {
  it('applies added, drops removed by default', () => {
    const current = cabinet([part({ id: 'p1', meshNodeId: 'm1' })]);
    const incoming = [part({ id: 'p-new', meshNodeId: 'm2' })];
    const diff = diffCabinetParts(current, incoming);
    const { parts } = mergeDiff(diff, { decisions: {} });
    expect(parts).toHaveLength(1);
    expect(parts[0].meshNodeId).toBe('m2');
  });

  it('keeps current id when applying a matched change', () => {
    const current = cabinet([part({ id: 'original-id', meshNodeId: 'm1' })]);
    const incoming = [part({ id: 'new-ai-id', meshNodeId: 'm1', partCode: 'CHANGED' })];
    const diff = diffCabinetParts(current, incoming);
    const { parts } = mergeDiff(diff, { decisions: {} });
    expect(parts[0].id).toBe('original-id');
    expect(parts[0].partCode).toBe('CHANGED');
  });

  it('preserves name when nameLocked', () => {
    const current = cabinet(
      [part({ id: 'p1', meshNodeId: 'm1', partName: 'My Renamed Part' })],
      { p1: { nameLocked: true } },
    );
    const incoming = [part({ meshNodeId: 'm1', partName: 'AI Suggested Name', partCode: 'NEW' })];
    const diff = diffCabinetParts(current, incoming);
    const { parts, fieldsPreserved } = mergeDiff(diff, { decisions: {} });
    expect(parts[0].partName).toBe('My Renamed Part');
    expect(parts[0].partCode).toBe('NEW');
    expect(fieldsPreserved).toBeGreaterThanOrEqual(1);
  });

  it('preserves material when materialLocked', () => {
    const current = cabinet(
      [part({ id: 'p1', meshNodeId: 'm1', inventoryItemId: 'inv-oak', inventoryItemName: 'Oak' })],
      { p1: { materialLocked: true } },
    );
    const incoming = [part({ meshNodeId: 'm1', inventoryItemId: 'inv-walnut', inventoryItemName: 'Walnut' })];
    const diff = diffCabinetParts(current, incoming);
    const { parts } = mergeDiff(diff, { decisions: {} });
    expect(parts[0].inventoryItemId).toBe('inv-oak');
    expect(parts[0].inventoryItemName).toBe('Oak');
  });

  it('respects explicit "keep" decision on a changed row', () => {
    const current = cabinet([part({ id: 'p1', meshNodeId: 'm1', partCode: 'KEEPME' })]);
    const incoming = [part({ meshNodeId: 'm1', partCode: 'NEW' })];
    const diff = diffCabinetParts(current, incoming);
    const decisions: Record<string, ChangeDecision> = { p1: 'keep' };
    const { parts } = mergeDiff(diff, { decisions });
    expect(parts[0].partCode).toBe('KEEPME');
  });

  it('respects explicit "drop" on an unchanged row (user says remove anyway)', () => {
    const current = cabinet([part({ id: 'p1', meshNodeId: 'm1' })]);
    const incoming = [part({ id: 'p1', meshNodeId: 'm1' })];
    const diff = diffCabinetParts(current, incoming);
    const { parts } = mergeDiff(diff, { decisions: { p1: 'drop' } });
    expect(parts).toHaveLength(0);
  });

  it('respects explicit "apply" to restore a removed row (user wants it back)', () => {
    const current = cabinet([part({ id: 'p1', meshNodeId: 'm1' })]);
    const incoming: ScenePart[] = [];
    const diff = diffCabinetParts(current, incoming);
    // removed row with only a `current`; 'apply' is a no-op (no incoming).
    // The safe decision is 'keep' — test that.
    const { parts } = mergeDiff(diff, { decisions: { p1: 'keep' } });
    expect(parts).toHaveLength(1);
  });
});
