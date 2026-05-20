/**
 * Unit tests for partsQualityHelper — name enhancement + issue flagging.
 */
import { describe, it, expect } from 'vitest';
import {
  enhancePartName,
  analyzePartsQuality,
  isGenericName,
  collectAuditableParts,
  type AuditablePart,
} from '../partsQualityHelper';
import type { ScenePart } from '../../types/assembly.types';

function part(over: Partial<ScenePart> = {}): ScenePart {
  return {
    id: over.id ?? 'p1',
    assemblyId: 'a1',
    cabinetId: over.cabinetId ?? 'c1',
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

const withCab = (p: ScenePart, cabinetId = 'c1'): AuditablePart => ({ ...p, cabinetId });

describe('isGenericName', () => {
  it.each([
    ['', true],
    ['  ', true],
    ['P1', true],
    ['node_37', true],
    ['mesh-12', true],
    ['Untitled', true],
    ['A', true],
    ['Side Panel', false],
    ['Left Drawer Box', false],
    ['Back Rail 18mm', false],
    ['Panel', true],
  ])('isGenericName(%p) → %p', (name, expected) => {
    expect(isGenericName(name)).toBe(expected);
  });
});

describe('enhancePartName', () => {
  it('returns a concise structural base name', () => {
    expect(enhancePartName(part())).toBe('Side Panel');
  });

  it('falls back through name → code → category when name is generic', () => {
    // Generic name but valid code → use the titlecased code.
    expect(enhancePartName(part({ partName: 'node_17', partCode: 'BACK' })))
      .toBe('Back');
    // Generic name AND generic code → category label.
    expect(enhancePartName(part({ partName: 'node_17', partCode: 'P1' })))
      .toBe('Panel');
  });

  it('strips existing dims suffix to avoid stacking on re-run', () => {
    const p = part({ partName: 'Side Panel — 720×560×18mm · Oak' });
    expect(enhancePartName(p)).toBe('Side Panel');
  });

  it('falls back to partCode (titlecased) when name is blank', () => {
    expect(enhancePartName(part({ partName: '', partCode: 'back_panel' })))
      .toBe('Back Panel');
  });

  it('keeps plain names when no suffix data exists', () => {
    const p = part({
      partName: 'Hinge',
      partCategory: 'hardware',
      dimensions: undefined,
      inventoryItemName: '',
      materialDescription: '',
    });
    expect(enhancePartName(p)).toBe('Hinge');
  });

  it('does not inject material labels into suggested names', () => {
    const p = part({ inventoryItemName: 'Oak 18mm' });
    expect(enhancePartName(p)).toBe('Side Panel');
  });

  it('suggests sequenced shelf names within the same assembly (batch naming)', () => {
    const a = withCab(
      part({ id: 's1', partName: 'node_1', partCode: 'A1', assemblyId: 'as1', role: 'shelf' }),
    );
    const b = withCab(
      part({ id: 's2', partName: 'node_2', partCode: 'A2', assemblyId: 'as1', role: 'shelf' }),
    );
    const { suggestions } = analyzePartsQuality([a, b]);
    expect(suggestions.find(s => s.partId === 's1')?.suggestedName).toMatch(/Fixed Shelf 1/);
    expect(suggestions.find(s => s.partId === 's2')?.suggestedName).toMatch(/Fixed Shelf 2/);
  });
});

describe('analyzePartsQuality — errors', () => {
  it('flags a panel with no dimensions', () => {
    const p = part({
      dimensions: undefined,
      // Avoid "18mm" in copy — text thickness parse would satisfy `effectivePartDims`.
      inventoryItemName: 'Oak board',
      materialDescription: 'Oak veneered MDF',
    });
    const { issues } = analyzePartsQuality([withCab(p)]);
    const codes = issues.map(i => i.code);
    expect(codes).toContain('MISSING_DIMENSIONS');
    expect(issues.find(i => i.code === 'MISSING_DIMENSIONS')?.severity).toBe('warning');
  });

  it('does not flag MISSING_DIMENSIONS when only OBB/AABB is present (matches sync merge)', () => {
    const p = part({
      dimensions: undefined,
      dimensionQuality: {
        source: 'obb',
        confidence: 0.9,
        obb: { length: 720, width: 560, thickness: 18 },
      },
    });
    const { issues } = analyzePartsQuality([withCab(p)]);
    expect(issues.find(i => i.code === 'MISSING_DIMENSIONS')).toBeUndefined();
  });

  it('flags MISSING_DIMENSIONS when only part-name text carries L×W×T', () => {
    const p = part({
      dimensions: undefined,
      partName: 'Back panel 720×560×18',
      inventoryItemName: 'board',
      materialDescription: 'MDF',
    });
    const { issues } = analyzePartsQuality([withCab(p)]);
    expect(issues.find(i => i.code === 'MISSING_DIMENSIONS')).toBeDefined();
  });

  it('flags an invalid quantity', () => {
    const { issues } = analyzePartsQuality([withCab(part({ quantity: 0 }))]);
    expect(issues.find(i => i.code === 'INVALID_QUANTITY')?.severity).toBe('error');
  });

  it('flags a missing part code', () => {
    const { issues } = analyzePartsQuality([withCab(part({ partCode: '' }))]);
    expect(issues.find(i => i.code === 'MISSING_PART_CODE')?.severity).toBe('error');
  });

  it('flags MISSING_THICKNESS for cut-spec parts with 0 thickness', () => {
    const p = part({
      partCategory: 'panel',
      dimensions: { length: 720, width: 560, thickness: 0, grainDirection: 'length' },
      inventoryItemName: 'Oak board',
      materialDescription: 'Oak veneered MDF',
      partName: 'Side Panel',
    });
    const { issues } = analyzePartsQuality([withCab(p)]);
    expect(issues.find(i => i.code === 'MISSING_THICKNESS')?.severity).toBe('error');
  });

  it('flags MISSING_EDGE_BANDING as warning when panel has no edging spec (does not block sync)', () => {
    const p = part({ partCategory: 'panel', edgeBanding: undefined });
    const { issues } = analyzePartsQuality([withCab(p)]);
    expect(issues.find(i => i.code === 'MISSING_EDGE_BANDING')?.severity).toBe('warning');
  });
});

describe('analyzePartsQuality — warnings', () => {
  it('flags thickness > length as suspicious', () => {
    const p = part({ dimensions: { length: 18, width: 560, thickness: 720, grainDirection: 'length' } });
    const { issues } = analyzePartsQuality([withCab(p)]);
    expect(issues.find(i => i.code === 'SUSPICIOUS_THICKNESS')).toBeTruthy();
  });

  it('flags oversize sheet length', () => {
    const p = part({ dimensions: { length: 4000, width: 560, thickness: 18, grainDirection: 'length' } });
    const { issues } = analyzePartsQuality([withCab(p)]);
    expect(issues.find(i => i.code === 'OVERSIZE_LENGTH')).toBeTruthy();
  });

  it('flags panels with no linked inventory item', () => {
    const p = part({ inventoryItemId: '' });
    const { issues } = analyzePartsQuality([withCab(p)]);
    expect(issues.find(i => i.code === 'NO_MATERIAL')).toBeTruthy();
  });

  it('flags edge banding length mismatching panel dims', () => {
    const p = part({
      edgeBanding: {
        top: { type: 'ABS 2mm', length: 900 },   // part.length is 720
        bottom: null, left: null, right: null, front: null,
      },
    });
    const { issues } = analyzePartsQuality([withCab(p)]);
    expect(issues.find(i => i.code === 'EDGEBAND_MISMATCH')).toBeTruthy();
  });

  it('does NOT flag edge banding within tolerance', () => {
    const p = part({
      edgeBanding: {
        top: { type: 'ABS 2mm', length: 722 },   // 2mm over, within ±5
        bottom: null, left: null, right: null, front: null,
      },
    });
    const { issues } = analyzePartsQuality([withCab(p)]);
    expect(issues.find(i => i.code === 'EDGEBAND_MISMATCH')).toBeUndefined();
  });

  it('flags duplicate part codes with conflicting specs in the same cabinet', () => {
    const a = part({ id: 'p1', partCode: 'SIDE', dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' } });
    const b = part({ id: 'p2', partCode: 'SIDE', dimensions: { length: 720, width: 560, thickness: 22, grainDirection: 'length' } });
    const { issues } = analyzePartsQuality([withCab(a), withCab(b)]);
    expect(issues.find(i => i.code === 'DUPLICATE_CODE_CONFLICT')).toBeTruthy();
  });

  it('does NOT flag duplicate part codes with matching specs', () => {
    const a = part({ id: 'p1', partCode: 'SIDE' });
    const b = part({ id: 'p2', partCode: 'SIDE' });
    const { issues } = analyzePartsQuality([withCab(a), withCab(b)]);
    expect(issues.find(i => i.code === 'DUPLICATE_CODE_CONFLICT')).toBeUndefined();
  });

  it('flags DIMENSION_UNCERTAIN when mesh-derived dimensions are low confidence', () => {
    const p = part({
      dimensionQuality: {
        source: 'obb',
        confidence: 0.72,
        uncertain: true,
        obb: { length: 800, width: 300, thickness: 18 },
        aabb: { length: 778, width: 778, thickness: 18 },
      },
    });
    const { issues } = analyzePartsQuality([withCab(p)]);
    const issue = issues.find(i => i.code === 'DIMENSION_UNCERTAIN');
    expect(issue).toBeTruthy();
    expect(issue?.severity).toBe('warning');
  });
});

describe('analyzePartsQuality — info', () => {
  it('flags generic names', () => {
    const { issues } = analyzePartsQuality([withCab(part({ partName: 'node_17' }))]);
    expect(issues.find(i => i.code === 'GENERIC_NAME')).toBeTruthy();
  });

  it('flags parts with no mesh link', () => {
    const { issues } = analyzePartsQuality([withCab(part({ meshNodeId: undefined }))]);
    expect(issues.find(i => i.code === 'NO_MESH_LINK')).toBeTruthy();
  });
});

describe('analyzePartsQuality — summary', () => {
  it('produces accurate counts', () => {
    const parts: AuditablePart[] = [
      withCab(part({ id: 'good', meshNodeId: 'm1' })),                // clean
      withCab(part({ id: 'bad',  partName: 'node_9', meshNodeId: 'm2' })),   // suggestion + info
      withCab(part({ id: 'ugly', partCode: '', quantity: 0, dimensions: undefined, meshNodeId: undefined, inventoryItemId: '' })), // errors
    ];
    const r = analyzePartsQuality(parts);
    expect(r.summary.partsChecked).toBe(3);
    expect(r.summary.errors).toBeGreaterThanOrEqual(2);
    expect(r.summary.suggestions).toBeGreaterThanOrEqual(1);
  });
});

describe('collectAuditableParts', () => {
  it('flattens scene cabinets → parts with cabinetId stamped on', () => {
    const cabinets = [
      {
        id: 'cA',
        assemblies: [{ parts: [part({ id: 'p1' }), part({ id: 'p2' })] }],
      },
      {
        id: 'cB',
        assemblies: [{ parts: [part({ id: 'p3' })] }, { parts: [] }],
      },
    ];
    const flat = collectAuditableParts(cabinets);
    expect(flat).toHaveLength(3);
    expect(flat.find(p => p.id === 'p1')?.cabinetId).toBe('cA');
    expect(flat.find(p => p.id === 'p3')?.cabinetId).toBe('cB');
  });

  it('handles cabinets with no assemblies', () => {
    expect(collectAuditableParts([{ id: 'c1' }])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// P2.3 — material confidence checks
// ---------------------------------------------------------------------------

describe('analyzePartsQuality — material confidence', () => {
  it('flags LOW_CONFIDENCE_MATERIAL (error) when confidence < 0.4', () => {
    const p = withCab(part({ materialDescription: 'MEL Oak' }));
    const mappings = [{ threeDSName: 'MEL Oak', finishLibraryId: 'f1', finishLibraryName: 'Oak Melamine', confidence: 0.3, matchedOn: 'color' as const }];
    const r = analyzePartsQuality([p], mappings);
    const issue = r.issues.find(i => i.code === 'LOW_CONFIDENCE_MATERIAL');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
    expect(issue!.message).toContain('30%');
  });

  it('flags LOW_CONFIDENCE_MATERIAL (warning) when 0.4 ≤ confidence < 0.7', () => {
    const p = withCab(part({ materialDescription: 'MEL Oak' }));
    const mappings = [{ threeDSName: 'MEL Oak', finishLibraryId: 'f1', finishLibraryName: 'Oak Melamine', confidence: 0.55, matchedOn: 'fuzzy_name' as const }];
    const r = analyzePartsQuality([p], mappings);
    const issue = r.issues.find(i => i.code === 'LOW_CONFIDENCE_MATERIAL');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('does NOT flag when confidence ≥ 0.7', () => {
    const p = withCab(part({ materialDescription: 'MEL Oak' }));
    const mappings = [{ threeDSName: 'MEL Oak', finishLibraryId: 'f1', finishLibraryName: 'Oak Melamine', confidence: 0.85, matchedOn: 'name' as const }];
    const r = analyzePartsQuality([p], mappings);
    expect(r.issues.find(i => i.code === 'LOW_CONFIDENCE_MATERIAL')).toBeUndefined();
  });

  it('flags UNRESOLVED_MATERIAL when mappings exist but part material is not in them', () => {
    const p = withCab(part({ materialDescription: 'Mystery Veneer' }));
    const mappings = [{ threeDSName: 'MEL Oak', finishLibraryId: 'f1', finishLibraryName: 'Oak Melamine', confidence: 0.9, matchedOn: 'name' as const }];
    const r = analyzePartsQuality([p], mappings);
    const issue = r.issues.find(i => i.code === 'UNRESOLVED_MATERIAL');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
  });

  it('skips material confidence checks when no mappings provided', () => {
    const p = withCab(part({ materialDescription: 'MEL Oak' }));
    const r = analyzePartsQuality([p]);
    expect(r.issues.find(i => i.code === 'LOW_CONFIDENCE_MATERIAL')).toBeUndefined();
    expect(r.issues.find(i => i.code === 'UNRESOLVED_MATERIAL')).toBeUndefined();
  });
});
