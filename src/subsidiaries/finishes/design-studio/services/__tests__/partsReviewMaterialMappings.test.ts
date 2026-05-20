import { describe, it, expect } from 'vitest';
import { loadPartsReviewMaterialMappings } from '../partsReviewMaterialMappings';
import { analyzePartsQuality, type AuditablePart } from '../partsQualityHelper';
import type { MaterialMappingLite, ModelPackage } from '../../types/modelPackage.types';

function mapping(
  over: Partial<MaterialMappingLite> & Pick<MaterialMappingLite, 'threeDSName'>,
): MaterialMappingLite {
  return {
    threeDSName: over.threeDSName,
    threeDSColor: over.threeDSColor,
    finishLibraryId: over.finishLibraryId ?? 'fin-1',
    finishLibraryName: over.finishLibraryName ?? 'Oak Melamine',
    finishCategory: over.finishCategory,
    confidence: over.confidence ?? 0.85,
    matchedOn: over.matchedOn ?? 'name',
  };
}

function pkgWithMappings(mappings: MaterialMappingLite[]): ModelPackage {
  return {
    materials: {
      source: 'exact',
      mappings,
      unresolved: [],
    },
  } as unknown as ModelPackage;
}

function auditablePart(over: Partial<AuditablePart> = {}): AuditablePart {
  return {
    id: over.id ?? 'p1',
    cabinetId: over.cabinetId ?? 'cab-1',
    assemblyId: over.assemblyId ?? 'a1',
    partCode: over.partCode ?? 'SIDE',
    partName: over.partName ?? 'Side Panel',
    partCategory: over.partCategory ?? 'panel',
    inventoryItemId: over.inventoryItemId ?? 'inv-1',
    inventoryItemName: over.inventoryItemName ?? 'Inv 1',
    quantity: over.quantity ?? 1,
    unit: over.unit ?? 'ea',
    unitCost: over.unitCost ?? 0,
    totalCost: over.totalCost ?? 0,
    currency: over.currency ?? 'UGX',
    materialDescription: over.materialDescription ?? 'MEL Oak',
    dimensions: over.dimensions ?? {
      length: 720,
      width: 560,
      thickness: 18,
      grainDirection: 'length',
    },
    ...over,
  };
}

describe('loadPartsReviewMaterialMappings', () => {
  it('deduplicates per 3DS material and keeps highest confidence', async () => {
    const getPackage = async (_sceneId: string, cabinetId: string): Promise<ModelPackage | null> => {
      if (cabinetId === 'cab-1') {
        return pkgWithMappings([
          mapping({ threeDSName: 'MEL Oak', finishLibraryId: 'oak-a', confidence: 0.4 }),
          mapping({ threeDSName: 'MEL White', finishLibraryId: 'white-a', confidence: 0.9 }),
        ]);
      }
      if (cabinetId === 'cab-2') {
        return pkgWithMappings([
          mapping({ threeDSName: ' mel oak ', finishLibraryId: 'oak-b', confidence: 0.92 }),
        ]);
      }
      return null;
    };

    const mappings = await loadPartsReviewMaterialMappings(
      'scene-1',
      [{ id: 'cab-1' }, { id: 'cab-2' }, { id: 'cab-3' }],
      getPackage,
    );

    expect(mappings).toHaveLength(2);
    const oak = mappings.find(m => m.threeDSName.trim().toLowerCase() === 'mel oak');
    expect(oak?.finishLibraryId).toBe('oak-b');
    expect(oak?.confidence).toBe(0.92);
  });

  it('enables confidence warnings when used in analyzePartsQuality', async () => {
    const getPackage = async (): Promise<ModelPackage | null> => (
      pkgWithMappings([
        mapping({
          threeDSName: 'MEL Oak',
          finishLibraryId: 'fin-oak',
          finishLibraryName: 'Oak Melamine',
          confidence: 0.45,
          matchedOn: 'color',
        }),
      ])
    );

    const mappings = await loadPartsReviewMaterialMappings(
      'scene-1',
      [{ id: 'cab-1' }],
      getPackage,
    );
    const report = analyzePartsQuality([auditablePart()], mappings);
    const low = report.issues.find(i => i.code === 'LOW_CONFIDENCE_MATERIAL');
    expect(low).toBeTruthy();
    expect(low?.severity).toBe('warning');
  });

  it('continues when one cabinet package load fails', async () => {
    const getPackage = async (_sceneId: string, cabinetId: string): Promise<ModelPackage | null> => {
      if (cabinetId === 'cab-bad') throw new Error('read failed');
      return pkgWithMappings([
        mapping({
          threeDSName: 'MEL Ash',
          finishLibraryId: 'fin-ash',
          finishLibraryName: 'Ash Melamine',
          confidence: 0.8,
          matchedOn: 'name',
        }),
      ]);
    };

    const mappings = await loadPartsReviewMaterialMappings(
      'scene-1',
      [{ id: 'cab-good' }, { id: 'cab-bad' }],
      getPackage,
    );

    expect(mappings).toHaveLength(1);
    expect(mappings[0]?.threeDSName).toBe('MEL Ash');
  });

  it('dedupes concurrent identical loads via shared in-flight promise', async () => {
    let calls = 0;
    const getPackage = async (): Promise<ModelPackage | null> => {
      calls += 1;
      await new Promise(resolve => setTimeout(resolve, 5));
      return pkgWithMappings([
        mapping({
          threeDSName: 'MEL Pine',
          finishLibraryId: 'fin-pine',
          finishLibraryName: 'Pine Melamine',
          confidence: 0.7,
          matchedOn: 'name',
        }),
      ]);
    };

    const [a, b] = await Promise.all([
      loadPartsReviewMaterialMappings('scene-1', [{ id: 'cab-1' }, { id: 'cab-2' }], getPackage),
      loadPartsReviewMaterialMappings('scene-1', [{ id: 'cab-1' }, { id: 'cab-2' }], getPackage),
    ]);

    expect(calls).toBe(2);
    expect(a).toEqual(b);
    expect(a[0]?.threeDSName).toBe('MEL Pine');
  });
});
