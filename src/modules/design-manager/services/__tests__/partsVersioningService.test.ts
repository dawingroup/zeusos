/**
 * Parts Versioning Service — P6 tests
 *
 * Pins the optimistic-concurrency contract on `designItems.parts`:
 *   - every write bumps `partsVersion`
 *   - `baseVersion` mismatch throws `PartsConcurrencyError`
 *   - history is appended to `parts_history/` on success
 *   - legacy docs (no `partsVersion` field) are treated as version 0
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDoc, getDoc, updateDoc } from 'firebase/firestore';
import {
  writePartsWithVersion,
  readPartsVersion,
  PartsConcurrencyError,
} from '../partsVersioningService';
import type { PartEntry } from '../../types';

const getDocMock = getDoc as unknown as ReturnType<typeof vi.fn>;
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>;
const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>;

function makeDocSnap(exists: boolean, data: Record<string, unknown> = {}, id = 'mock-id') {
  return {
    exists: () => exists,
    data: () => (exists ? data : undefined),
    id,
  };
}

const SAMPLE_PART: PartEntry = {
  id: 'p1',
  partNumber: 'P001',
  name: 'Left Side',
  length: 720,
  width: 560,
  thickness: 18,
  quantity: 1,
  materialName: 'MDF 18mm',
  grainDirection: 'length',
  edgeBanding: { top: false, bottom: false, left: false, right: false },
  hasCNCOperations: false,
  source: 'manual',
  // Real PartEntry has Timestamp; we stub with undefined since the mock
  // Timestamp.now() returns a minimal shim and nothing here reads these.
  createdAt: undefined as unknown as PartEntry['createdAt'],
  updatedAt: undefined as unknown as PartEntry['updatedAt'],
};

describe('P6 — readPartsVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 for a legacy doc with no partsVersion field', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { name: 'Legacy item' }));
    const version = await readPartsVersion('proj-1', 'item-1');
    expect(version).toBe(0);
  });

  it('returns the stored partsVersion when present', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 7 }));
    const version = await readPartsVersion('proj-1', 'item-1');
    expect(version).toBe(7);
  });

  it('throws when the item doc does not exist', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(false));
    await expect(readPartsVersion('proj-x', 'item-x')).rejects.toThrow(/not found/);
  });
});

describe('P6 — writePartsWithVersion conflict detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with PartsConcurrencyError when baseVersion is stale', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 5 }));
    await expect(
      writePartsWithVersion('proj-1', 'item-1', [SAMPLE_PART], {
        baseVersion: 3,
        userId: 'u1',
        source: 'studio-sync-merge',
      }),
    ).rejects.toBeInstanceOf(PartsConcurrencyError);

    // No write happens on conflict — neither the item update nor a
    // history entry should be written.
    expect(updateDocMock).not.toHaveBeenCalled();
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('PartsConcurrencyError exposes baseVersion and currentVersion for UI', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 9 }));
    try {
      await writePartsWithVersion('proj-1', 'item-1', [], {
        baseVersion: 4,
        userId: 'u1',
        source: 'studio-sync-replace',
      });
      throw new Error('expected PartsConcurrencyError');
    } catch (err) {
      expect(err).toBeInstanceOf(PartsConcurrencyError);
      const e = err as PartsConcurrencyError;
      expect(e.baseVersion).toBe(4);
      expect(e.currentVersion).toBe(9);
      expect(e.itemId).toBe('item-1');
    }
  });

  it('accepts baseVersion=0 against a legacy doc (no stored partsVersion)', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { name: 'Legacy' }));
    // Swallow the history write
    addDocMock.mockResolvedValueOnce({ id: 'hist-1' });

    const result = await writePartsWithVersion('proj-1', 'item-1', [SAMPLE_PART], {
      baseVersion: 0,
      userId: 'u1',
      source: 'studio-sync-replace',
    });

    expect(result.version).toBe(1);
    expect(result.writtenCount).toBe(1);
  });

  it('accepts writes without baseVersion (opt-out of conflict detection)', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 3 }));
    addDocMock.mockResolvedValueOnce({ id: 'hist-2' });

    const result = await writePartsWithVersion('proj-1', 'item-1', [SAMPLE_PART], {
      userId: 'u1',
      source: 'design-manager-add',
    });

    expect(result.version).toBe(4);
  });
});

describe('P6 — writePartsWithVersion happy path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bumps partsVersion and stamps partsLastSyncedAt on the item doc', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 2 }));
    addDocMock.mockResolvedValueOnce({ id: 'hist-3' });

    await writePartsWithVersion('proj-1', 'item-1', [SAMPLE_PART], {
      userId: 'u1',
      source: 'studio-sync-merge',
      baseVersion: 2,
    });

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const updates = updateDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updates.partsVersion).toBe(3);
    expect(updates.partsLastSyncedAt).toBeDefined();
    expect(updates.parts).toEqual([SAMPLE_PART]);
    expect(updates.updatedBy).toBe('u1');
  });

  it('appends a history entry with the new version and source tag', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 1 }));
    addDocMock.mockResolvedValueOnce({ id: 'hist-4' });

    await writePartsWithVersion('proj-1', 'item-1', [SAMPLE_PART, SAMPLE_PART], {
      userId: 'u1',
      source: 'studio-sync-merge',
    });

    expect(addDocMock).toHaveBeenCalledTimes(1);
    const historyEntry = addDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(historyEntry.partsVersion).toBe(2);
    expect(historyEntry.partCount).toBe(2);
    expect(historyEntry.source).toBe('studio-sync-merge');
    expect(historyEntry.writtenBy).toBe('u1');
    expect(Array.isArray(historyEntry.parts)).toBe(true);
  });

  it('honours writeHistory=false (no history append)', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 1 }));

    await writePartsWithVersion('proj-1', 'item-1', [SAMPLE_PART], {
      userId: 'u1',
      source: 'design-manager-bulk-update',
      writeHistory: false,
    });

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('merges additionalUpdates into the item write', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { partsVersion: 1 }));
    addDocMock.mockResolvedValueOnce({ id: 'hist-5' });

    await writePartsWithVersion('proj-1', 'item-1', [SAMPLE_PART], {
      userId: 'u1',
      source: 'studio-sync-replace',
      additionalUpdates: {
        'ragStatus.parts': 'green',
        'ragStatus.partsNote': 'from AI recognition',
      },
    });

    const updates = updateDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updates['ragStatus.parts']).toBe('green');
    expect(updates['ragStatus.partsNote']).toBe('from AI recognition');
    // Version bump still wins over additionalUpdates.
    expect(updates.partsVersion).toBe(2);
  });

  it('throws when the item doc does not exist', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(false));
    await expect(
      writePartsWithVersion('proj-x', 'item-x', [SAMPLE_PART], {
        userId: 'u1',
        source: 'studio-sync-replace',
      }),
    ).rejects.toThrow(/not found/);
  });
});
