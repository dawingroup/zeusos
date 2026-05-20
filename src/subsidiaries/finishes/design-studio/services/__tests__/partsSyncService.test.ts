/**
 * partsSyncService — P6 integration + pure reducer tests
 *
 *   - `computeFinalParts` is a pure reducer for replace vs. merge
 *   - `syncPartsToDesignItem` threads `baseVersion` through to the
 *     versioning service and surfaces the new version in its return
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDoc, addDoc, updateDoc } from 'firebase/firestore';
import {
  computeFinalParts,
  convertCutListToPartEntries,
  syncPartsToDesignItem,
  PartsConcurrencyError,
  type PartEntry,
} from '../partsSyncService';
import type { CutListEntry } from '../../types/workshop-viewer.types';

const getDocMock = getDoc as unknown as ReturnType<typeof vi.fn>;
const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>;
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>;

function makeDocSnap(exists: boolean, data: Record<string, unknown> = {}) {
  return {
    exists: () => exists,
    data: () => (exists ? data : undefined),
    id: 'mock-id',
  };
}

function part(over: Partial<PartEntry>): PartEntry {
  return {
    partNumber: 'P001',
    name: 'Left Side',
    partType: 'sheet',
    length: 720,
    width: 560,
    thickness: 18,
    quantity: 1,
    materialName: 'MDF 18mm',
    source: 'manual',
    ...over,
  };
}

function cutListRow(over: Partial<CutListEntry> = {}): CutListEntry {
  return {
    cabinet: 'Base-1',
    partName: 'Left Side',
    material: 'MDF 18mm',
    thickness: 18,
    qty: 1,
    length: 720,
    width: 560,
    edgeBanding: { L1: true, L2: false, W1: true, W2: false },
    originalRow: 2,
    ...over,
  };
}

describe('convertCutListToPartEntries — P15 source-format gating', () => {
  it('applies the PolyBoard L1/L2/W1/W2 mapping for polyboard-panel CSVs', () => {
    const [p] = convertCutListToPartEntries([cutListRow()], 'cuts.csv', {
      sourceFormat: 'polyboard-panel',
    });
    expect(p.source).toBe('polyboard');
    expect(p.partNumber).toBe('PB-1');
    expect(p.edgeBanding).toEqual({ left: true, right: false, top: true, bottom: false });
  });

  it('drops edge-banding and tags csv-import for generic CSVs', () => {
    const warnings: string[] = [];
    const [p] = convertCutListToPartEntries([cutListRow()], 'anon.csv', {
      sourceFormat: 'generic',
      warnings,
    });
    expect(p.source).toBe('csv-import');
    expect(p.partNumber).toBe('P-1');
    expect(p.edgeBanding).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Edge-banding dropped/);
  });

  it('drops edge-banding for unknown format too', () => {
    const [p] = convertCutListToPartEntries([cutListRow()], undefined, {
      sourceFormat: 'unknown',
    });
    expect(p.edgeBanding).toBeUndefined();
    expect(p.source).toBe('csv-import');
  });

  it('only emits one warning per conversion batch', () => {
    const warnings: string[] = [];
    convertCutListToPartEntries(
      [cutListRow(), cutListRow({ partName: 'Right Side' }), cutListRow({ partName: 'Top' })],
      undefined,
      { sourceFormat: 'generic', warnings },
    );
    expect(warnings).toHaveLength(1);
  });

  it('still honours the PolyBoard mapping when forcePolyBoardEdgeMapping=true on a generic CSV', () => {
    const [p] = convertCutListToPartEntries([cutListRow()], undefined, {
      sourceFormat: 'generic',
      forcePolyBoardEdgeMapping: true,
    });
    expect(p.source).toBe('polyboard');
    expect(p.edgeBanding).toEqual({ left: true, right: false, top: true, bottom: false });
  });

  it('defaults to PolyBoard behaviour when no options are supplied (backward compat)', () => {
    const [p] = convertCutListToPartEntries([cutListRow()]);
    expect(p.source).toBe('polyboard');
    expect(p.edgeBanding).toEqual({ left: true, right: false, top: true, bottom: false });
  });

  it('treats thin panel stock (e.g. 3mm back) as sheet, not component', () => {
    const [p] = convertCutListToPartEntries([cutListRow({ thickness: 3, partName: 'Back' })]);
    expect(p.partType).toBe('sheet');
  });
});

describe('computeFinalParts — replace mode', () => {
  it('returns incoming verbatim, ignoring existing', () => {
    const existing = [part({ name: 'Keep me' })];
    const incoming = [part({ name: 'Take me' })];
    expect(computeFinalParts(existing, incoming, 'replace')).toEqual(incoming);
  });
});

describe('computeFinalParts — merge mode', () => {
  it('adds new entries that have no match', () => {
    const existing = [part({ name: 'Side', materialName: 'MDF' })];
    const incoming = [part({ name: 'Back', materialName: 'MDF' })];
    const out = computeFinalParts(existing, incoming, 'merge');
    expect(out.map(p => p.name).sort()).toEqual(['Back', 'Side']);
  });

  it('keeps existing entries that are not in the incoming set', () => {
    const existing = [
      part({ name: 'Side', materialName: 'MDF' }),
      part({ name: 'Back', materialName: 'MDF' }),
    ];
    const incoming = [part({ name: 'Top', materialName: 'MDF' })];
    const out = computeFinalParts(existing, incoming, 'merge');
    expect(out.map(p => p.name).sort()).toEqual(['Back', 'Side', 'Top']);
  });

  it('overwrites existing entries when dimensions differ by >1mm (matched)', () => {
    const existing = [part({ name: 'Side', materialName: 'MDF', length: 700 })];
    const incoming = [part({ name: 'Side', materialName: 'MDF', length: 720 })];
    const out = computeFinalParts(existing, incoming, 'merge');
    expect(out).toHaveLength(1);
    expect(out[0].length).toBe(720);
  });

  it('keeps existing entry unchanged when incoming dims match within 1mm', () => {
    const existing = [part({ name: 'Side', materialName: 'MDF', length: 720 })];
    const incoming = [part({ name: 'Side', materialName: 'MDF', length: 720.4 })];
    const out = computeFinalParts(existing, incoming, 'merge');
    expect(out).toHaveLength(1);
    // The diffParts.unchanged branch doesn't promote incoming — existing wins.
    expect(out[0].length).toBe(720);
  });

  it('is case-insensitive on name but exact on materialName', () => {
    const existing = [part({ name: 'side', materialName: 'MDF', length: 700 })];
    const incoming = [part({ name: 'SIDE', materialName: 'MDF', length: 720 })];
    const out = computeFinalParts(existing, incoming, 'merge');
    expect(out).toHaveLength(1); // name collision → modified, not added
    expect(out[0].length).toBe(720);
  });
});

describe('syncPartsToDesignItem — P6 version threading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes baseVersion through and returns the bumped version', async () => {
    // First getDoc = merge-mode existing parts lookup; returns empty parts.
    // Second getDoc = writePartsWithVersion's version read.
    getDocMock
      .mockResolvedValueOnce(makeDocSnap(true, { parts: [] }))
      .mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 4 }));
    addDocMock.mockResolvedValueOnce({ id: 'hist-1' });

    const result = await syncPartsToDesignItem(
      'proj-1',
      'item-1',
      [part({ name: 'Back' })],
      'merge',
      'user-1',
      4,
    );

    expect(result.version).toBe(5);
    expect(result.synced).toBe(1);
    // The item doc was written to with the bumped version.
    const updates = updateDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updates.partsVersion).toBe(5);
  });

  it('surfaces PartsConcurrencyError when baseVersion is stale', async () => {
    // Merge-mode read succeeds, version read shows drift.
    getDocMock
      .mockResolvedValueOnce(makeDocSnap(true, { parts: [] }))
      .mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 10 }));

    await expect(
      syncPartsToDesignItem(
        'proj-1',
        'item-1',
        [part({ name: 'Back' })],
        'merge',
        'user-1',
        2,
      ),
    ).rejects.toBeInstanceOf(PartsConcurrencyError);

    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('replace mode skips the existing-parts read', async () => {
    // Only the version read should fire for replace mode.
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 0 }));
    addDocMock.mockResolvedValueOnce({ id: 'hist-2' });

    await syncPartsToDesignItem(
      'proj-1',
      'item-1',
      [part({ name: 'Only' })],
      'replace',
      'user-1',
    );

    // Exactly one getDoc call: the version read done by writePartsWithVersion.
    expect(getDocMock).toHaveBeenCalledTimes(1);
  });
});
