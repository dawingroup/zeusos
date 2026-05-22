/**
 * Unit tests — Asset Library collection service (Phase 4 P1).
 *
 * Covers:
 *   - addItemToCollection is idempotent (no duplicate IDs)
 *   - addItemToCollection appends to existing itemIds
 *   - removeItemFromCollection is idempotent when the item isn't present
 *   - removeItemFromCollection actually removes when the item is present
 *   - both helpers throw if the collection doesn't exist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssetCollection } from '../types/asset-collection.types';

vi.mock('@/shared/services/firebase', () => ({ db: {} }));

const mockAddDoc    = vi.fn();
const mockGetDoc    = vi.fn();
const mockGetDocs   = vi.fn();
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection:       vi.fn((_db, ...path: string[]) => ({ __kind: 'collection', __path: path.join('/') })),
  doc:              vi.fn((_db, ...path: string[]) => ({ __kind: 'doc',       __path: path.join('/'), id: path[path.length - 1] })),
  addDoc:           mockAddDoc,
  getDoc:           mockGetDoc,
  getDocs:          mockGetDocs,
  updateDoc:        mockUpdateDoc,
  deleteDoc:        mockDeleteDoc,
  query:            vi.fn((...args) => ({ __kind: 'query', args })),
  where:            vi.fn((...args) => ({ __kind: 'where', args })),
  orderBy:          vi.fn((...args) => ({ __kind: 'orderBy', args })),
  serverTimestamp:  vi.fn(() => '__SERVER_TS__'),
}));

// ─────────────────────────────────────────────────────────────────

function mockGetCollection(itemIds: string[]) {
  const data: Omit<AssetCollection, 'id'> = {
    name: 'Brand Pack',
    itemIds,
    subsidiaryOrgId: 'zeus-the-agency',
    createdBy: 'user-001',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
  mockGetDoc.mockResolvedValueOnce({
    exists: () => true,
    id: 'col-001',
    data: () => data,
  });
}

// ─────────────────────────────────────────────────────────────────

describe('addItemToCollection', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('appends the item when not present', async () => {
    mockGetCollection(['asset-001']);

    const { addItemToCollection } = await import('../services/asset-collection.service');
    await addItemToCollection('col-001', 'asset-002');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.itemIds).toEqual(['asset-001', 'asset-002']);
    expect(payload.updatedAt).toBe('__SERVER_TS__');
  });

  it('is idempotent — does not duplicate when already present', async () => {
    mockGetCollection(['asset-001', 'asset-002']);

    const { addItemToCollection } = await import('../services/asset-collection.service');
    await addItemToCollection('col-001', 'asset-002');

    // No write call because the item was already in the array.
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws when the collection does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const { addItemToCollection } = await import('../services/asset-collection.service');
    await expect(addItemToCollection('missing-id', 'asset-001')).rejects.toThrow(
      /not found/,
    );
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});

describe('removeItemFromCollection', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('removes the item when present', async () => {
    mockGetCollection(['asset-001', 'asset-002', 'asset-003']);

    const { removeItemFromCollection } = await import('../services/asset-collection.service');
    await removeItemFromCollection('col-001', 'asset-002');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.itemIds).toEqual(['asset-001', 'asset-003']);
  });

  it('is idempotent — no error when item is missing', async () => {
    mockGetCollection(['asset-001']);

    const { removeItemFromCollection } = await import('../services/asset-collection.service');
    await expect(
      removeItemFromCollection('col-001', 'asset-999'),
    ).resolves.toBeUndefined();

    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it('throws when the collection does not exist', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const { removeItemFromCollection } = await import('../services/asset-collection.service');
    await expect(
      removeItemFromCollection('missing-id', 'asset-001'),
    ).rejects.toThrow(/not found/);
  });
});
