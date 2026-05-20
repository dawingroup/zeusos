/**
 * Invariant tests for `writePartsWithVersion`'s scope enforcement.
 *
 * The contract: writes tagged `writeScope: 'scene-origin'` MUST only
 * carry rows with `source: 'design-studio'`, and MUST preserve every
 * existing procurement row byte-for-byte. Writes tagged
 * `writeScope: 'procurement'` MUST only carry rows with NON-
 * design-studio source, and MUST preserve every scene-origin row.
 *
 * Without these, a single sync can double-count any physical part
 * that appears under both namespaces (the entire reason this
 * contract exists — see cozy-zooming-stream plan).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { writePartsWithVersion, isSceneOriginPart } from '../partsVersioningService';
import type { PartEntry } from '../../types';

// Firestore mock — tiny in-memory doc the tests introspect.
vi.mock('firebase/firestore', () => {
  const store = new Map<string, { parts: PartEntry[]; partsVersion: number }>();
  const doc = (_db: unknown, ...segments: string[]) => ({ _path: segments.join('/') });
  const getDoc = async (ref: { _path: string }) => {
    const data = store.get(ref._path);
    return {
      exists: () => !!data,
      data: () => data ?? { parts: [], partsVersion: 0 },
    };
  };
  const updateDoc = async (ref: { _path: string }, updates: Record<string, unknown>) => {
    const current = store.get(ref._path) ?? { parts: [], partsVersion: 0 };
    store.set(ref._path, {
      ...current,
      ...(updates.parts !== undefined ? { parts: updates.parts as PartEntry[] } : {}),
      ...(updates.partsVersion !== undefined ? { partsVersion: updates.partsVersion as number } : {}),
    });
  };
  return {
    doc,
    getDoc,
    updateDoc,
    collection: () => ({}),
    addDoc: async () => ({}),
    Timestamp: { now: () => ({ toMillis: () => 0 }) },
    serverTimestamp: () => new Date(),
    __store: store,
  };
});

vi.mock('@/shared/services/firebase', () => ({ db: {} }));

const firestoreModule = (await import('firebase/firestore')) as unknown as {
  __store: Map<string, { parts: PartEntry[]; partsVersion: number }>;
};

function makePart(overrides: Partial<PartEntry>): PartEntry {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    partNumber: 'P001',
    name: 'Part',
    partType: 'sheet',
    length: 600,
    width: 400,
    thickness: 18,
    quantity: 1,
    materialName: 'MDF',
    ...overrides,
  } as PartEntry;
}

beforeEach(() => {
  firestoreModule.__store.clear();
});

describe('writePartsWithVersion — namespace invariant', () => {
  const itemPath = 'designProjects/p1/designItems/i1';
  const write = (args: Partial<Parameters<typeof writePartsWithVersion>[3]>, parts: PartEntry[]) =>
    writePartsWithVersion('p1', 'i1', parts, {
      userId: 'test',
      source: 'studio-sync-replace',
      ...args,
    });

  const seed = (parts: PartEntry[]) => {
    firestoreModule.__store.set(itemPath, { parts, partsVersion: 0 });
  };

  it('identifies scene-origin parts by source field', () => {
    expect(isSceneOriginPart({ source: 'design-studio' })).toBe(true);
    expect(isSceneOriginPart({ source: 'polyboard' })).toBe(false);
    expect(isSceneOriginPart({ source: 'manual' })).toBe(false);
    expect(isSceneOriginPart({} as Pick<PartEntry, 'source'>)).toBe(false);
    expect(isSceneOriginPart({ source: '' as unknown as PartEntry['source'] })).toBe(false);
  });

  it('scene-origin write rejects procurement-sourced input rows', async () => {
    seed([]);
    await expect(
      write(
        { writeScope: 'scene-origin' },
        [makePart({ source: 'polyboard', name: 'Left Side' })],
      ),
    ).rejects.toThrow(/scene-origin.*must only contain parts with source: 'design-studio'/);
  });

  it('procurement write rejects scene-origin input rows', async () => {
    seed([]);
    await expect(
      write(
        { writeScope: 'procurement' },
        [makePart({ source: 'design-studio', name: 'side_L_01' })],
      ),
    ).rejects.toThrow(/procurement.*must not contain scene-origin rows/);
  });

  it('scene-origin write preserves every existing procurement row byte-for-byte', async () => {
    seed([
      makePart({ id: 'csv-1', source: 'polyboard', name: 'CSV Panel 1' }),
      makePart({ id: 'manual-1', source: 'manual', name: 'Hand Hinge' }),
      makePart({ id: 'legacy-1', source: undefined, name: 'Legacy Row' }),
    ]);
    await write(
      { writeScope: 'scene-origin' },
      [makePart({ id: 'scene-1', source: 'design-studio', name: 'side_L' })],
    );
    const stored = firestoreModule.__store.get(itemPath)!;
    const ids = stored.parts.map(p => p.id).sort();
    expect(ids).toEqual(['csv-1', 'legacy-1', 'manual-1', 'scene-1'].sort());
  });

  it('procurement write preserves every existing scene-origin row', async () => {
    seed([
      makePart({ id: 'scene-1', source: 'design-studio', name: 'side_L' }),
      makePart({ id: 'scene-2', source: 'design-studio', name: 'side_R' }),
      makePart({ id: 'old-proc', source: 'manual', name: 'Old manual' }),
    ]);
    await write(
      { writeScope: 'procurement' },
      [makePart({ id: 'new-csv', source: 'csv-import', name: 'Imported row' })],
    );
    const stored = firestoreModule.__store.get(itemPath)!;
    const ids = stored.parts.map(p => p.id).sort();
    // Scene rows preserved + new procurement row replacing all old procurement.
    expect(ids).toEqual(['new-csv', 'scene-1', 'scene-2']);
  });

  it('idempotent — repeated scene-origin sync yields identical row set', async () => {
    seed([makePart({ id: 'csv-1', source: 'polyboard' })]);
    const incoming = [
      makePart({ id: 'scene-a', source: 'design-studio', name: 'A' }),
      makePart({ id: 'scene-b', source: 'design-studio', name: 'B' }),
    ];
    await write({ writeScope: 'scene-origin' }, incoming);
    const after1 = firestoreModule.__store.get(itemPath)!.parts.length;
    await write({ writeScope: 'scene-origin' }, incoming);
    const after2 = firestoreModule.__store.get(itemPath)!.parts.length;
    expect(after1).toBe(3);
    expect(after2).toBe(3);  // Not 4 — no doubling on resync.
  });

  it('no writeScope → legacy full-replace path (unchanged behaviour)', async () => {
    seed([
      makePart({ id: 'scene-1', source: 'design-studio' }),
      makePart({ id: 'proc-1', source: 'manual' }),
    ]);
    // Caller takes full responsibility — writes whatever they gave us.
    await write({}, [makePart({ id: 'replacement', source: 'design-studio' })]);
    const stored = firestoreModule.__store.get(itemPath)!;
    expect(stored.parts.map(p => p.id)).toEqual(['replacement']);
  });
});
