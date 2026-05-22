/**
 * Unit tests — Asset Library item service (Phase 4 P1).
 *
 * Covers:
 *   - createAsset writes through addDoc with timestamps
 *   - listAssets returns mapped rows
 *   - archiveAsset flips status to ARCHIVED
 *   - recordAssetUsage adds to the subcollection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────
// Mocks — mirror src/modules/media/__tests__/media-plan.test.ts setup
// ─────────────────────────────────────────────────────────────────

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

describe('createAsset', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('writes addDoc with timestamps and returns the rehydrated row', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'asset-001' });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'asset-001',
      data: () => ({
        name: 'Coca-Cola Master Logo',
        category: 'LOGO',
        subsidiaryOrgId: 'zeus-the-agency',
        tags: ['logo', 'master'],
        currentVersionId: 'v1',
        storageRef: 'uploads/pending/coke-master.svg',
        fileType: 'IMAGE',
        fileSizeBytes: 12_345,
        status: 'ACTIVE',
        uploadedBy: 'user-001',
      }),
    });

    const { createAsset } = await import('../services/asset-item.service');
    const result = await createAsset({
      name: 'Coca-Cola Master Logo',
      category: 'LOGO',
      subsidiaryOrgId: 'zeus-the-agency',
      tags: ['logo', 'master'],
      currentVersionId: 'v1',
      storageRef: 'uploads/pending/coke-master.svg',
      fileType: 'IMAGE',
      fileSizeBytes: 12_345,
      status: 'ACTIVE',
      uploadedBy: 'user-001',
    });

    expect(result.id).toBe('asset-001');
    expect(mockAddDoc).toHaveBeenCalledOnce();
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.createdAt).toBe('__SERVER_TS__');
    expect(payload.updatedAt).toBe('__SERVER_TS__');
    expect(payload.name).toBe('Coca-Cola Master Logo');
  });
});

describe('listAssets', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns mapped rows with id and data', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        {
          id: 'asset-001',
          data: () => ({
            name: 'Logo A',
            category: 'LOGO',
            subsidiaryOrgId: 'zeus-digital',
            tags: ['logo'],
            currentVersionId: 'v1',
            storageRef: 'r/1',
            fileType: 'IMAGE',
            fileSizeBytes: 100,
            status: 'ACTIVE',
            uploadedBy: 'u1',
          }),
        },
        {
          id: 'asset-002',
          data: () => ({
            name: 'Logo B',
            category: 'LOGO',
            subsidiaryOrgId: 'zeus-digital',
            tags: ['logo'],
            currentVersionId: 'v1',
            storageRef: 'r/2',
            fileType: 'IMAGE',
            fileSizeBytes: 100,
            status: 'ACTIVE',
            uploadedBy: 'u1',
          }),
        },
      ],
    });

    const { listAssets } = await import('../services/asset-item.service');
    const rows = await listAssets({ category: 'LOGO' });

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('asset-001');
    expect(rows[1].id).toBe('asset-002');
  });
});

describe('archiveAsset', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('updates status to ARCHIVED with a fresh updatedAt', async () => {
    const { archiveAsset } = await import('../services/asset-item.service');
    await archiveAsset('asset-001');

    expect(mockUpdateDoc).toHaveBeenCalledOnce();
    const [, payload] = mockUpdateDoc.mock.calls[0];
    expect(payload.status).toBe('ARCHIVED');
    expect(payload.updatedAt).toBe('__SERVER_TS__');
  });
});

describe('recordAssetUsage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('writes the usage row into the subcollection', async () => {
    mockAddDoc.mockResolvedValueOnce({ id: 'usage-001' });
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      id: 'usage-001',
      data: () => ({
        subjectType: 'CAMPAIGN',
        subjectId: 'camp-001',
        addedBy: 'user-001',
        addedAt: '2026-05-22T00:00:00Z',
      }),
    });

    const { recordAssetUsage } = await import('../services/asset-item.service');
    const usage = await recordAssetUsage('asset-001', {
      subjectType: 'CAMPAIGN',
      subjectId: 'camp-001',
      addedBy: 'user-001',
    });

    expect(usage.id).toBe('usage-001');
    expect(mockAddDoc).toHaveBeenCalledOnce();
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.subjectId).toBe('camp-001');
    expect(payload.addedAt).toBe('__SERVER_TS__');
  });
});
