/**
 * Unit tests — Asset Library version service (Phase 4 P1).
 *
 * Covers:
 *   - addVersion writes the row AND mirrors currentVersionId onto the parent
 *   - listVersions returns versions ordered newest-first (Firestore order
 *     is mocked, but we assert the call shape)
 *   - rollbackToVersion updates the parent's currentVersionId / storageRef
 *   - rollbackToVersion throws when the target version doesn't exist
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/firebase', () => ({ db: {} }));

const mockAddDoc    = vi.fn();
const mockGetDoc    = vi.fn();
const mockGetDocs   = vi.fn();
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);

vi.mock('firebase/firestore', () => ({
  collection:       vi.fn((_db, ...path: string[]) => ({ __kind: 'collection', __path: path.join('/') })),
  doc:              vi.fn((_db, ...path: string[]) => ({ __kind: 'doc',       __path: path.join('/'), id: path[path.length - 1] })),
  addDoc:           mockAddDoc,
  getDoc:           mockGetDoc,
  getDocs:          mockGetDocs,
  updateDoc:        mockUpdateDoc,
  query:            vi.fn((...args) => ({ __kind: 'query', args })),
  orderBy:          vi.fn((...args) => ({ __kind: 'orderBy', args })),
  serverTimestamp:  vi.fn(() => '__SERVER_TS__'),
}));

// ─────────────────────────────────────────────────────────────────

describe('addVersion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('writes the version row AND mirrors currentVersionId/storageRef to parent', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'ver-002' });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'ver-002',
      data: () => ({
        versionLabel: 'v2',
        storageRef: 'uploads/v2/logo.svg',
        fileSizeBytes: 9876,
        uploadedBy: 'user-001',
        uploadedAt: '__SERVER_TS__',
        changeNotes: 'Refreshed for Q3',
      }),
    });

    const { addVersion } = await import('../services/asset-version.service');
    const result = await addVersion('asset-001', {
      versionLabel: 'v2',
      storageRef: 'uploads/v2/logo.svg',
      fileSizeBytes: 9876,
      uploadedBy: 'user-001',
      changeNotes: 'Refreshed for Q3',
    });

    expect(result.id).toBe('ver-002');
    expect(mockAddDoc).toHaveBeenCalledOnce();

    // Parent header was updated with the new version pointer.
    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, parentUpdate] = mockUpdateDoc.mock.calls[0];
    expect(parentUpdate.currentVersionId).toBe('ver-002');
    expect(parentUpdate.storageRef).toBe('uploads/v2/logo.svg');
    expect(parentUpdate.fileSizeBytes).toBe(9876);
    expect(parentUpdate.updatedAt).toBe('__SERVER_TS__');
  });
});

describe('listVersions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns mapped versions and asks Firestore to order by uploadedAt', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'ver-002',
          data: () => ({
            versionLabel: 'v2',
            storageRef: 'r/2',
            fileSizeBytes: 100,
            uploadedBy: 'u1',
            uploadedAt: '2026-05-22T00:00:00Z',
          }),
        },
        {
          id: 'ver-001',
          data: () => ({
            versionLabel: 'v1',
            storageRef: 'r/1',
            fileSizeBytes: 90,
            uploadedBy: 'u1',
            uploadedAt: '2026-04-01T00:00:00Z',
          }),
        },
      ],
    });

    const { listVersions } = await import('../services/asset-version.service');
    const rows = await listVersions('asset-001');

    expect(rows).toHaveLength(2);
    // First row is the newest because the mock preserved ordering.
    expect(rows[0].id).toBe('ver-002');
    expect(rows[1].id).toBe('ver-001');

    // Sanity-check that the service called orderBy('uploadedAt', 'desc').
    const { orderBy } = await import('firebase/firestore');
    expect(orderBy).toHaveBeenCalledWith('uploadedAt', 'desc');
  });
});

describe('rollbackToVersion', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates the parent currentVersionId and mirrored fields', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'ver-001',
      data: () => ({
        versionLabel: 'v1',
        storageRef: 'r/1',
        fileSizeBytes: 90,
        uploadedBy: 'u1',
        uploadedAt: '2026-04-01T00:00:00Z',
      }),
    });

    const { rollbackToVersion } = await import('../services/asset-version.service');
    await rollbackToVersion('asset-001', 'ver-001');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.currentVersionId).toBe('ver-001');
    expect(payload.storageRef).toBe('r/1');
    expect(payload.fileSizeBytes).toBe(90);
    expect(payload.updatedAt).toBe('__SERVER_TS__');
  });

  it('throws when the target version is not found', async () => {
    mockGetDoc.mockResolvedValueOnce({ exists: () => false });

    const { rollbackToVersion } = await import('../services/asset-version.service');
    await expect(rollbackToVersion('asset-001', 'missing')).rejects.toThrow(/not found/);
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });
});
