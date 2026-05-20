/**
 * materialResolverService — project-palette bias (P21.7).
 *
 * Covers the behaviour change: when a `preferredFinishIds` set is passed
 * (derived from `DesignProject.materialPalette`), candidates in the set
 * get a small confidence bonus so the designer's curated choices outrank
 * equally-good matches from the broader Finish Library. Without the set,
 * existing cascade behaviour is unchanged.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveFromThreeDSNames,
  paletteEntriesToFinishIds,
  resolveMaterialByPalette,
} from '../materialResolverService';
import type { FinishDocument } from '@/modules/inventory/types/finishLibrary';

function finish(over: Partial<FinishDocument>): FinishDocument {
  return {
    id: over.id || 'f',
    name: over.name || 'Finish',
    code: over.code || 'F-000',
    category: over.category || 'custom',
    subtype: over.subtype || '',
    hexColor: over.hexColor || '#ffffff',
    isActive: true,
    tags: [],
    ...over,
  } as FinishDocument;
}

describe('paletteEntriesToFinishIds', () => {
  it('matches palette entries by code (normalised)', () => {
    const finishes = [
      finish({ id: 'a', name: 'Oak Natural', code: 'VEN-OAK-01' }),
      finish({ id: 'b', name: 'Walnut Dark', code: 'VEN-WAL-02' }),
    ];
    const ids = paletteEntriesToFinishIds(
      [{ name: 'whatever', code: 'ven_oak_01' }],
      finishes,
    );
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(false);
  });

  it('falls back to name match when code is missing', () => {
    const finishes = [finish({ id: 'a', name: 'Oak Natural', code: 'VEN-OAK-01' })];
    const ids = paletteEntriesToFinishIds([{ name: 'Oak Natural' }], finishes);
    expect(ids.has('a')).toBe(true);
  });

  it('returns empty set for empty palette or empty finishes', () => {
    expect(paletteEntriesToFinishIds([], [finish({ id: 'a' })]).size).toBe(0);
    expect(paletteEntriesToFinishIds([{ code: 'X' }], []).size).toBe(0);
  });
});

describe('resolveFromThreeDSNames — palette bias', () => {
  it('tags palette-matched mappings with viaProjectPalette=true', () => {
    const finishes = [finish({ id: 'a', name: 'Oak Natural', code: 'VEN-OAK-01' })];
    const materials = { 'VEN-OAK-01': { diffuse: [0.8, 0.6, 0.4] as [number, number, number] } };
    const mappings = resolveFromThreeDSNames(materials, finishes, {
      preferredFinishIds: new Set(['a']),
    });
    expect(mappings[0].finishLibraryId).toBe('a');
    expect(mappings[0].viaProjectPalette).toBe(true);
  });

  it('prefers palette finishes over equally-named non-palette finishes on name ties', () => {
    // Two finishes with the same normalised name. Without the palette, the
    // first one wins by iteration order. With palette bias, the preferred
    // one should win regardless of position.
    const finishes = [
      finish({ id: 'library', name: 'Oak Natural', code: 'LIB-001' }),
      finish({ id: 'palette', name: 'Oak Natural', code: 'PAL-001' }),
    ];
    const materials = { 'Oak Natural': { diffuse: [0.5, 0.5, 0.5] as [number, number, number] } };

    const withoutBias = resolveFromThreeDSNames(materials, finishes);
    expect(withoutBias[0].finishLibraryId).toBe('library');
    expect(withoutBias[0].viaProjectPalette).toBe(false);

    const withBias = resolveFromThreeDSNames(materials, finishes, {
      preferredFinishIds: new Set(['palette']),
    });
    expect(withBias[0].finishLibraryId).toBe('palette');
    expect(withBias[0].viaProjectPalette).toBe(true);
  });

  it('does not promote a below-threshold palette match above the auto-match threshold on its own', () => {
    // A finish with a totally unrelated name — palette bonus (+0.1) must
    // not be enough to drag it across the auto-match threshold.
    const finishes = [finish({ id: 'p', name: 'Teak Honey', code: 'T-001' })];
    const materials = { 'Granite Slab': { diffuse: [0.2, 0.2, 0.2] as [number, number, number] } };
    const mappings = resolveFromThreeDSNames(materials, finishes, {
      preferredFinishIds: new Set(['p']),
    });
    // Unmatched (no fuzzy/color hit) — fall-through path sets id=''
    expect(mappings[0].finishLibraryId).toBe('');
    expect(mappings[0].viaProjectPalette).toBe(false);
  });

  it('leaves exact code matches untouched (already 1.0)', () => {
    const finishes = [finish({ id: 'a', name: 'Oak', code: 'VEN-OAK-01' })];
    const materials = { 'VEN-OAK-01': { diffuse: [0.5, 0.5, 0.5] as [number, number, number] } };
    const mappings = resolveFromThreeDSNames(materials, finishes, {
      preferredFinishIds: new Set(['a']),
    });
    expect(mappings[0].confidence).toBe(1.0);
    expect(mappings[0].viaProjectPalette).toBe(true);
  });
});

// P21.12 — palette ↔ Finish Library binding on the per-part resolver.
describe('resolveMaterialByPalette — finish linkage', () => {
  it('returns finishId, finishCode and inventoryItemId when palette entry has all three', () => {
    const palette = [{
      id: 'pe1',
      designName: '18mm White Melamine',
      inventoryItemId: 'inv-1',
      finishId: 'f-1',
      finishCode: 'MEL-WHT-18',
      finishName: 'White Melamine 18mm',
    }];
    const r = resolveMaterialByPalette('18mm White Melamine', palette);
    expect(r).not.toBeNull();
    expect(r!.materialId).toBe('f-1');
    expect(r!.finishCode).toBe('MEL-WHT-18');
    expect(r!.inventoryItemId).toBe('inv-1');
    expect(r!.source).toBe('palette-exact');
    expect(r!.confidence).toBe(1.0);
  });

  it('pulls inventoryItemId from the finish when palette entry has finishId only', () => {
    const palette = [{
      id: 'pe1',
      designName: 'Oak Veneer',
      finishId: 'f-2',
    }];
    const finishes = [finish({ id: 'f-2', name: 'Oak Natural', code: 'VEN-OAK-01', inventoryItemId: 'inv-9' })];
    const r = resolveMaterialByPalette('Oak Veneer', palette, finishes);
    expect(r).not.toBeNull();
    expect(r!.inventoryItemId).toBe('inv-9');
    expect(r!.finishCode).toBe('VEN-OAK-01');
    expect(r!.finishName).toBe('Oak Natural');
    expect(r!.materialId).toBe('f-2');
  });

  it('returns finishId but no inventoryItemId when finishes lookup is absent', () => {
    const palette = [{
      id: 'pe1',
      designName: 'Oak Veneer',
      finishId: 'f-2',
    }];
    const r = resolveMaterialByPalette('Oak Veneer', palette);
    expect(r).not.toBeNull();
    expect(r!.materialId).toBe('f-2');
    expect(r!.inventoryItemId).toBeUndefined();
  });

  it('falls back to palette-fuzzy (0.9) when only normalized name matches', () => {
    const palette = [{
      id: 'pe1',
      designName: 'White Melamine 18mm',
      normalizedName: 'white melamine 18mm',
      inventoryItemId: 'inv-1',
      finishId: 'f-1',
    }];
    const r = resolveMaterialByPalette('MEL-White-Melamine-18mm', palette);
    expect(r).not.toBeNull();
    expect(r!.source).toBe('palette-fuzzy');
    expect(r!.confidence).toBe(0.9);
  });

  it('skips palette entries that are unmapped (no inventoryItemId, materialId, or finishId)', () => {
    const palette = [{ id: 'pe1', designName: 'Oak Veneer' }];
    const r = resolveMaterialByPalette('Oak Veneer', palette);
    expect(r).toBeNull();
  });

  it('treats finishId alone as a valid binding (new in P21.12)', () => {
    const palette = [{ id: 'pe1', designName: 'Oak Veneer', finishId: 'f-x' }];
    const r = resolveMaterialByPalette('Oak Veneer', palette);
    expect(r).not.toBeNull();
    expect(r!.materialId).toBe('f-x');
  });
});
