/**
 * Unit tests for the ScenePart → PartEntry converter + merger.
 */
import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  buildCsvLookup,
  sceneCabinetToDesignManagerParts,
  mergeCabinetPartsForItem,
} from '../scenePartsToDesignManager';
import type { SceneCabinet, ScenePartsCsvOverlay } from '../../types/scene.types';
import type { ScenePart, SceneAssembly } from '../../types/assembly.types';

const NOW = Timestamp.fromMillis(1_700_000_000_000);

function scenePart(over: Partial<ScenePart>): ScenePart {
  return {
    id: over.id ?? 'p1',
    assemblyId: 'a1',
    cabinetId: 'c1',
    partCode: over.partCode ?? 'SIDE',
    partName: over.partName ?? 'Side Panel',
    partCategory: over.partCategory ?? 'panel',
    inventoryItemId: over.inventoryItemId ?? 'inv-oak',
    inventoryItemName: 'Oak 18mm',
    materialDescription: 'Oak veneered MDF, 18mm',
    dimensions: over.dimensions ?? { length: 720, width: 560, thickness: 18, grainDirection: 'length' },
    quantity: over.quantity ?? 1,
    unit: 'ea',
    unitCost: 0,
    totalCost: 0,
    currency: 'UGX',
    ...over,
  };
}

function cabinet(parts: ScenePart[], over: Partial<SceneCabinet> = {}): SceneCabinet {
  const assembly: SceneAssembly = {
    id: 'a1',
    cabinetId: over.id ?? 'c1',
    assemblyType: 'carcass',
    assemblyCode: 'A1',
    displayName: 'Carcase',
    parts,
    meshNodeIds: [],
    boundingBox: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      center: { x: 0, y: 0, z: 0 },
      size: { x: 0, y: 0, z: 0 },
    },
    jointSpec: [],
    assemblySequence: [],
    isComplete: true,
    totalPartCount: parts.length,
    totalArea: 0,
    totalCost: 0,
    sequence: 0,
  };
  return {
    id: over.id ?? 'c1',
    sceneId: 's1',
    pddId: 'p',
    cabinetCode: 'KB-A',
    displayName: 'Cabinet A',
    configuration: {},
    finishSelections: {},
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchorPoint: 'bottom_back_left',
    glbUrl: '',
    thumbnailUrl: '',
    assemblies: [assembly],
    computedBOM: [],
    estimatedPrice: { total: 0, currency: 'UGX' } as SceneCabinet['estimatedPrice'],
    isLocked: false,
    sequence: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

describe('sceneCabinetToDesignManagerParts', () => {
  it('returns an empty list when the cabinet has no assemblies', () => {
    const cab = cabinet([], { assemblies: [] });
    expect(sceneCabinetToDesignManagerParts(cab, NOW)).toEqual([]);
  });

  it('dedupes the same ScenePart when it appears in more than one assembly', () => {
    const p = scenePart({ id: 'shared-1' });
    const t = cabinet([p]);
    const a1 = t.assemblies![0];
    const a2: SceneAssembly = {
      ...a1,
      id: 'a2',
      assemblyCode: 'A2',
      displayName: 'Other asm',
      parts: [p],
      sequence: 1,
    };
    const cab: SceneCabinet = { ...t, assemblies: [a1, a2] };
    const entries = sceneCabinetToDesignManagerParts(cab, NOW);
    expect(entries).toHaveLength(1);
    expect(entries[0].id).toBe('shared-1');
  });

  it('uses CSV material when the mesh stamped material text equals the part name', () => {
    const overlay: ScenePartsCsvOverlay = {
      fileName: 'cutlist.csv',
      sourceType: 'generic',
      rows: [
        {
          name: 'Side Panel',
          length: 720,
          width: 560,
          thickness: 18,
          quantity: 1,
          materialName: 'White MFC 18mm',
          grainDirection: 'length',
          edgeBanding: { top: false, bottom: false, left: false, right: false },
          partType: 'sheet',
        },
      ],
      uploadedBy: 'u1',
      uploadedAt: NOW,
    };
    const cab = cabinet([
      scenePart({
        partName: 'Side Panel',
        materialDescription: 'Side Panel',
        inventoryItemName: 'Side Panel',
        dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' },
      }),
    ]);
    const [entry] = sceneCabinetToDesignManagerParts(cab, NOW, buildCsvLookup(overlay));
    expect(entry.materialName).toBe('White MFC 18mm');
  });

  it('uses CSV materialCode when the material name cell is empty', () => {
    const overlay: ScenePartsCsvOverlay = {
      fileName: 'cutlist.csv',
      sourceType: 'polyboard',
      rows: [
        {
          name: 'Back',
          length: 800,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialName: '',
          materialCode: 'MEL-WHI-18',
          grainDirection: 'none',
          edgeBanding: { top: false, bottom: false, left: false, right: false },
          partType: 'sheet',
        },
      ],
      uploadedBy: 'u1',
      uploadedAt: NOW,
    };
    const cab = cabinet([
      scenePart({
        partName: 'Back',
        partCode: 'BACK',
        materialDescription: 'Back',
        inventoryItemName: 'Back',
        dimensions: { length: 800, width: 500, thickness: 18, grainDirection: 'none' },
      }),
    ]);
    const [entry] = sceneCabinetToDesignManagerParts(cab, NOW, buildCsvLookup(overlay));
    expect(entry.materialName).toBe('MEL-WHI-18');
  });

  it('maps core ScenePart fields to PartEntry', () => {
    const cab = cabinet([scenePart({ id: 'p1' })]);
    const [entry] = sceneCabinetToDesignManagerParts(cab, NOW);
    expect(entry.id).toBe('p1');
    expect(entry.partNumber).toBe('KB-A-A1-SP01');
    expect(entry.name).toBe('Side Panel');
    expect(entry.partType).toBe('sheet');
    expect(entry.length).toBe(720);
    expect(entry.width).toBe(560);
    expect(entry.thickness).toBe(18);
    expect(entry.materialName).toBe('Oak veneered MDF, 18mm');
    expect(entry.inventoryItemId).toBe('inv-oak');
    expect(entry.quantity).toBe(1);
    expect(entry.grainDirection).toBe('length');
    expect(entry.hasCNCOperations).toBe(false);
    expect(entry.source).toBe('design-studio');
    expect(entry.createdAt).toBe(NOW);
  });

  it('uses scene partName as the DM name field', () => {
    const cab = cabinet([
      scenePart({
        id: 'nm-1',
        partName: 'Left Side Structural Panel',
        partCode: 'SIDE_L',
      }),
    ]);
    const [entry] = sceneCabinetToDesignManagerParts(cab, NOW);
    expect(entry.name).toBe('Left Side Structural Panel');
  });

  it('falls back to canonical partNumber when partCode is invalid label text', () => {
    const cab = cabinet([
      scenePart({
        partCode: 'Left Side Panel',
        partName: 'Left Side Panel',
        role: undefined,
      }),
    ]);
    const [entry] = sceneCabinetToDesignManagerParts(cab, NOW);
    expect(entry.partNumber).not.toBe('Left Side Panel');
    // Batch naming: cabinet + assembly + role code (left side = SPL01).
    expect(entry.partNumber).toBe('KB-A-A1-SPL01');
    expect(entry.name).toBe('Left Side Panel');
  });

  it('prefers CSV row with matching material when names and dims are identical', () => {
    const overlay: ScenePartsCsvOverlay = {
      fileName: 'material-tie.csv',
      sourceType: 'generic',
      rows: [
        {
          name: 'Side Panel',
          length: 720,
          width: 560,
          thickness: 18,
          quantity: 1,
          materialName: 'Walnut Veneer',
          grainDirection: 'length',
          edgeBanding: { top: true, bottom: false, left: true, right: false },
          partType: 'sheet',
        },
        {
          name: 'Side Panel',
          length: 720,
          width: 560,
          thickness: 18,
          quantity: 1,
          materialName: 'White MFC',
          grainDirection: 'length',
          edgeBanding: { top: false, bottom: true, left: false, right: true },
          partType: 'sheet',
        },
      ],
      uploadedBy: 'u1',
      uploadedAt: NOW,
    };
    const cab = cabinet([
      scenePart({
        id: 'mat-1',
        partName: 'Side Panel',
        materialDescription: 'Walnut board 18mm',
        inventoryItemName: 'Walnut board',
        dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' },
      }),
    ]);
    const [entry] = sceneCabinetToDesignManagerParts(cab, NOW, buildCsvLookup(overlay));
    expect(entry.materialName).toBe('Walnut Veneer');
    expect(entry.edgeBanding.top).toBe(true);
    expect(entry.edgeBanding.left).toBe(true);
    expect(entry.edgeBanding.bottom).toBe(false);
    expect(entry.edgeBanding.right).toBe(false);
  });

  it('keeps drawer partNumbers unique per PolyBoard column when codes are unusable', () => {
    const cab = cabinet([
      scenePart({
        id: 'd1',
        partCode: 'Drawer_1_invalid_code_too_long__________',
        partName: 'Drawer_1 Face',
        role: 'drawer',
      }),
      scenePart({
        id: 'd2',
        partCode: 'Drawer_2_invalid_code_too_long__________',
        partName: 'Drawer_2 Face',
        role: 'drawer',
      }),
    ]);
    const [a, b] = sceneCabinetToDesignManagerParts(cab, NOW);
    expect(a.partNumber).toBe('KB-A-A1-D1-DF01');
    expect(b.partNumber).toBe('KB-A-A1-D2-DF01');
    expect(a.name).toBe('Drawer_1 Face');
    expect(b.name).toBe('Drawer_2 Face');
  });

  it('falls back to dimensionQuality and parsed thickness when dimensions are sparse', () => {
    const cab = cabinet([
      scenePart({
        dimensions: { length: 600, width: 300, thickness: 0, grainDirection: 'none' },
        dimensionQuality: {
          source: 'obb',
          confidence: 0.9,
          obb: { length: 602, width: 298, thickness: 18 },
          aabb: { length: 600, width: 300, thickness: 0 },
        },
        materialDescription: 'Walnut veneer 18mm',
      }),
    ]);
    const [entry] = sceneCabinetToDesignManagerParts(cab, NOW);
    expect(entry.length).toBe(600);
    expect(entry.width).toBe(300);
    expect(entry.thickness).toBe(18);
  });

  it('maps part categories to PartEntry.partType', () => {
    const cases: Array<{ cat: ScenePart['partCategory']; expected: string }> = [
      { cat: 'panel', expected: 'sheet' },
      { cat: 'edge_band', expected: 'bar' },
      { cat: 'hardware', expected: 'component' },
      { cat: 'fastener', expected: 'component' },
    ];
    for (const { cat, expected } of cases) {
      const cab = cabinet([scenePart({ partCategory: cat })]);
      expect(sceneCabinetToDesignManagerParts(cab, NOW)[0].partType).toBe(expected);
    }
  });

  it('treats panel with no resolvable dimensions as sheet, not component', () => {
    const cab = cabinet([
      scenePart({
        partCategory: 'panel',
        dimensions: { length: 0, width: 0, thickness: 0, grainDirection: 'none' },
        dimensionQuality: undefined,
        materialDescription: '',
        inventoryItemName: '',
        partName: 'Plain',
        partCode: 'X',
      }),
    ]);
    expect(sceneCabinetToDesignManagerParts(cab, NOW)[0].partType).toBe('sheet');
  });

  it('infers richer part types from material/name hints', () => {
    const fabricCab = cabinet([
      scenePart({
        partCategory: 'panel',
        materialDescription: 'upholstery fabric',
        partName: 'Seat Upholstery',
      }),
    ]);
    const slabCab = cabinet([
      scenePart({
        partCategory: 'panel',
        materialDescription: 'quartz stone',
        partName: 'Countertop',
      }),
    ]);
    const timberCab = cabinet([
      scenePart({
        partCategory: 'panel',
        materialDescription: 'solid hardwood',
        partName: 'Stile',
      }),
    ]);
    expect(sceneCabinetToDesignManagerParts(fabricCab, NOW)[0].partType).toBe('fabric');
    expect(sceneCabinetToDesignManagerParts(slabCab, NOW)[0].partType).toBe('slab');
    expect(sceneCabinetToDesignManagerParts(timberCab, NOW)[0].partType).toBe('timber');
  });

  it('converts edge banding from per-edge objects to booleans', () => {
    const cab = cabinet([scenePart({
      edgeBanding: {
        top: { type: 'ABS 2mm', length: 720 },
        bottom: null,
        left: { type: 'ABS 2mm', length: 560 },
        right: null,
        front: null,
      },
    })]);
    const entry = sceneCabinetToDesignManagerParts(cab, NOW)[0];
    expect(entry.edgeBanding.top).toBe(true);
    expect(entry.edgeBanding.bottom).toBe(false);
    expect(entry.edgeBanding.left).toBe(true);
    expect(entry.edgeBanding.right).toBe(false);
    expect(entry.edgeBanding.material).toBe('ABS 2mm');
  });

  it('sets hasCNCOperations when boringSpec present', () => {
    const cab = cabinet([scenePart({ boringSpec: { holes: [{ x: 0, y: 0, diameter: 5, depth: 15 }] } as unknown as ScenePart['boringSpec'] })]);
    expect(sceneCabinetToDesignManagerParts(cab, NOW)[0].hasCNCOperations).toBe(true);
  });
});

describe('mergeCabinetPartsForItem', () => {
  it('returns [] for no cabinets', () => {
    expect(mergeCabinetPartsForItem([], NOW)).toEqual([]);
  });

  it('passes a single cabinet\'s parts through unchanged', () => {
    const cab = cabinet([scenePart({ id: 'p1' }), scenePart({ id: 'p2', partCode: 'BACK' })]);
    const merged = mergeCabinetPartsForItem([cab], NOW);
    expect(merged).toHaveLength(2);
    expect(merged.map(p => p.partNumber)).toEqual(['KB-A-A1-SP01', 'KB-A-A1-BK01']);
  });

  it('sums quantities for attribute-identical parts across cabinets (no mesh id)', () => {
    // No meshNodeId on either → falls back to the attribute dedup key,
    // which keys on partNumber + material + dimensions. Identical parts
    // in two cabinets merge with summed quantities.
    const a = cabinet(
      [scenePart({ id: 'p1', quantity: 2 })],
      { id: 'c1' },
    );
    const b = cabinet(
      [scenePart({ id: 'p9', quantity: 2 })],
      { id: 'c2' },
    );
    const merged = mergeCabinetPartsForItem([a, b], NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(4);
    expect(merged[0].partNumber).toBe('KB-A-A1-SP01');
  });

  it('keys dedup on meshNodeId when present', () => {
    // Same mesh across cabinets (e.g. re-sync of the same cabinet)
    // should merge; different meshes stay separate even with identical
    // attributes.
    const sameMesh = [
      scenePart({ id: 'p1', meshNodeId: 'mesh-1', quantity: 1 }),
    ];
    const a = cabinet(sameMesh, { id: 'c1' });
    const b = cabinet(
      [scenePart({ id: 'p2', meshNodeId: 'mesh-1', quantity: 1 })],
      { id: 'c2' },
    );
    const merged = mergeCabinetPartsForItem([a, b], NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(2);
    expect(merged[0].meshNodeId).toBe('mesh-1');
  });

  it('merges a mesh-only twin when the CSV row was already consumed by a sibling mesh (same cut)', () => {
    const overlay: ScenePartsCsvOverlay = {
      fileName: 'twin.csv',
      sourceType: 'generic',
      rows: [
        {
          name: 'Back Panel',
          length: 800,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialName: 'MFC White',
          grainDirection: 'none',
          edgeBanding: { top: true, bottom: true, left: true, right: true },
          partType: 'sheet',
        },
      ],
      uploadedBy: 'u1',
      uploadedAt: NOW,
    };
    const lookup = buildCsvLookup(overlay);
    const p1 = scenePart({
      id: 'b1',
      partName: 'Back Panel',
      partCode: 'B1',
      dimensions: { length: 800, width: 500, thickness: 18, grainDirection: 'none' },
    });
    const p2 = scenePart({
      id: 'b2',
      partName: 'Back Panel',
      partCode: 'B2',
      meshNodeId: 'mesh-b2',
      dimensions: { length: 800, width: 500, thickness: 18, grainDirection: 'none' },
    });
    const cab = cabinet([p1, p2], { id: 'c1' });
    const merged = mergeCabinetPartsForItem([cab], NOW, lookup);
    // Second mesh cannot take the same CSV row (already consumed) →
    // would be two line items without the mesh/CSV twin consolidation.
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(2);
  });

  // `scenePartToPartEntry` can still infer thickness from a material name (e.g. default
  // "Oak 18mm" on the stub) when L×W are zero. `hasMeaningfulPanelDims` must not treat
  // thickness alone as a full panel spec — otherwise `dimsCompatibleForMerge` demands
  // `nearSameDims` vs the CSV row and the ghost mesh never fuses.
  it('merges CSV + mesh twin when the duplicate row has no bbox dimensions (0×0×0)', () => {
    const overlay: ScenePartsCsvOverlay = {
      fileName: 'nodim-twin.csv',
      sourceType: 'generic',
      rows: [
        {
          name: 'Back Panel',
          length: 800,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialName: 'MFC White',
          grainDirection: 'none',
          edgeBanding: { top: true, bottom: true, left: true, right: true },
          partType: 'sheet',
        },
      ],
      uploadedBy: 'u1',
      uploadedAt: NOW,
    };
    const lookup = buildCsvLookup(overlay);
    const p1 = scenePart({
      id: 'b1',
      partName: 'Back Panel',
      partCode: 'B1',
      dimensions: { length: 800, width: 500, thickness: 18, grainDirection: 'none' },
    });
    const p2 = scenePart({
      id: 'b2',
      partName: 'Back Panel',
      partCode: 'B2',
      meshNodeId: 'mesh-b2z',
      dimensions: { length: 0, width: 0, thickness: 0, grainDirection: 'none' as const },
    });
    const cab = cabinet([p1, p2], { id: 'c1' });
    const merged = mergeCabinetPartsForItem([cab], NOW, lookup);
    expect(merged).toHaveLength(1);
    expect(merged[0].length).toBe(800);
    expect(merged[0].quantity).toBe(2);
  });

  it('merges identical product parts across instances (different mesh + cabinet code)', () => {
    // Same layout, different scene instances: part numbers only differ by
    // cabinet prefix (NS1 vs NS2); mesh ids are unique per instance — one
    // line-item row with summed quantity (not N duplicate rows).
    const a = cabinet(
      [scenePart({ id: 'a-p1', partName: 'Left Side', meshNodeId: 'm-a' })],
      { id: 'c1', cabinetCode: 'NS1' },
    );
    const b = cabinet(
      [scenePart({ id: 'b-p1', partName: 'Left Side', meshNodeId: 'm-b' })],
      { id: 'c2', cabinetCode: 'NS2' },
    );
    const merged = mergeCabinetPartsForItem([a, b], NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].quantity).toBe(2);
  });

  it('merges by identical PartEntry.id (scene part) even when keys split mesh vs attr', () => {
    // Same `ScenePart.id` must not produce two rows; richness picks CSV fields.
    const overlay: ScenePartsCsvOverlay = {
      fileName: 'cutlist.csv',
      sourceType: 'generic',
      rows: [
        {
          name: 'Back',
          length: 800,
          width: 500,
          thickness: 18,
          quantity: 1,
          materialName: 'MFC White',
          grainDirection: 'none',
          edgeBanding: { top: true, bottom: true, left: true, right: true },
          partType: 'sheet',
        },
      ],
      uploadedBy: 'u1',
      uploadedAt: NOW,
    };
    const lookup = buildCsvLookup(overlay);
    const a = cabinet(
      [
        scenePart({
          id: 'twin',
          partName: 'Back',
          meshNodeId: 'm-z',
          materialDescription: 'Back',
          inventoryItemName: 'Back',
          partCode: 'BACK',
          dimensions: { length: 800, width: 500, thickness: 18, grainDirection: 'none' },
        }),
      ],
      { id: 'c1' },
    );
    const b = cabinet(
      [
        scenePart({
          id: 'twin',
          partName: 'Back',
          materialDescription: 'Back',
          inventoryItemName: 'Back',
          partCode: 'BACK',
          dimensions: { length: 800, width: 500, thickness: 18, grainDirection: 'none' },
        }),
      ],
      { id: 'c2' },
    );
    const merged = mergeCabinetPartsForItem([a, b], NOW, lookup);
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('twin');
    expect(merged[0].materialName).toBe('MFC White');
  });

  it('collapses CSV-rich + mesh-ghost when one row has mesh and the other hits attr key', () => {
    // Same part number and dims, but the map merge leaves mesh:* vs attr:*
    // when the ghost row dropped meshNodeId. The post-pass should keep
    // material, edges, and mesh id from the rich row.
    const overlay: ScenePartsCsvOverlay = {
      fileName: 'cutlist.csv',
      sourceType: 'generic',
      rows: [
        {
          name: 'Side Panel',
          length: 720,
          width: 560,
          thickness: 18,
          quantity: 1,
          materialName: 'White MFC 18mm',
          grainDirection: 'length',
          edgeBanding: { top: true, bottom: true, left: true, right: true },
          partType: 'sheet',
        },
      ],
      uploadedBy: 'u1',
      uploadedAt: NOW,
    };
    const lookup = buildCsvLookup(overlay);
    const a = cabinet(
      [
        scenePart({
          id: 'p1',
          partName: 'Side Panel',
          meshNodeId: 'mesh-ghost-1',
          materialDescription: 'Side Panel',
          inventoryItemName: 'Side Panel',
          dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' },
        }),
      ],
      { id: 'c1' },
    );
    const b = cabinet(
      [
        scenePart({
          id: 'p9',
          partName: 'Side Panel',
          materialDescription: 'Side Panel',
          inventoryItemName: 'Side Panel',
          dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' },
        }),
      ],
      { id: 'c2' },
    );
    const merged = mergeCabinetPartsForItem([a, b], NOW, lookup);
    expect(merged).toHaveLength(1);
    expect(merged[0].materialName).toBe('White MFC 18mm');
    expect(merged[0].meshNodeId).toBe('mesh-ghost-1');
    expect(merged[0].edgeBanding?.top).toBe(true);
  });

  it('keeps distinct parts when any dedup-key field differs', () => {
    const a = cabinet([scenePart({ partCode: 'SIDE', dimensions: { length: 720, width: 560, thickness: 18, grainDirection: 'length' } })]);
    const b = cabinet([scenePart({ partCode: 'SIDE', dimensions: { length: 720, width: 560, thickness: 22, grainDirection: 'length' } })]);
    expect(mergeCabinetPartsForItem([a, b], NOW)).toHaveLength(2);
  });

  it('treats missing inventoryItemId as a distinct dedup bucket', () => {
    // Different `ScenePart.id` — only then can two rows share default dims
    // without `consolidate` collapsing them.
    const a = cabinet([scenePart({ id: 'inv-1', inventoryItemId: 'inv-oak' })]);
    const b = cabinet([scenePart({ id: 'inv-2', inventoryItemId: '' })]);
    expect(mergeCabinetPartsForItem([a, b], NOW)).toHaveLength(2);
  });

  // ---- requiredQuantity multiplication ----
  it('multiplies part quantity by cabinet.requiredQuantity', () => {
    const cab = cabinet(
      [scenePart({ id: 'p1', quantity: 2 })],
      { id: 'c1', requiredQuantity: 4 },
    );
    const merged = mergeCabinetPartsForItem([cab], NOW);
    expect(merged).toHaveLength(1);
    // Per-cabinet quantity (2) × requiredQuantity (4) = 8.
    expect(merged[0].quantity).toBe(8);
  });

  it('defaults requiredQuantity to 1 when absent', () => {
    const cab = cabinet([scenePart({ id: 'p1', quantity: 3 })]);
    const merged = mergeCabinetPartsForItem([cab], NOW);
    expect(merged[0].quantity).toBe(3);
  });

  it('sums multiplied contributions across cabinets', () => {
    // Same identity key (attr fallback — matching SIDE partCode + material + dims).
    const a = cabinet(
      [scenePart({ id: 'p1', quantity: 1 })],
      { id: 'c1', requiredQuantity: 3 },
    );
    const b = cabinet(
      [scenePart({ id: 'p2', quantity: 1 })],
      { id: 'c2', requiredQuantity: 2 },
    );
    const merged = mergeCabinetPartsForItem([a, b], NOW);
    expect(merged).toHaveLength(1);
    // A: 1 × 3 = 3. B: 1 × 2 = 2. Merged = 5.
    expect(merged[0].quantity).toBe(5);
  });

  it('treats requiredQuantity < 1 as 1 (defensive)', () => {
    const cab = cabinet(
      [scenePart({ id: 'p1', quantity: 2 })],
      { id: 'c1', requiredQuantity: 0 }, // bad data
    );
    const merged = mergeCabinetPartsForItem([cab], NOW);
    expect(merged[0].quantity).toBe(2); // 2 × 1, not 0.
  });
});
