/**
 * workshopViewerFileService — persist Workshop Viewer uploads to
 * unified `projectFiles`.
 *
 * The hot paths are the skip-early decisions: non-CAD filename,
 * missing context, and the "already there" dedupe check. The actual
 * upload call is delegated to `uploadManagedFile`, which is covered by
 * File Manager's own tests — we just verify we invoke it with the
 * right shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/fileManager', async (orig) => {
  const actual = await (orig() as Promise<unknown>) as Record<string, unknown>;
  return {
    ...actual,
    uploadManagedFile: vi.fn(),
    getProjectFiles: vi.fn(),
  };
});

import {
  uploadManagedFile,
  getProjectFiles,
} from '@/shared/services/fileManager';
import { persistWorkshopUploadToProjectFiles } from '../workshopViewerFileService';

const uploadMock = uploadManagedFile as unknown as ReturnType<typeof vi.fn>;
const listMock = getProjectFiles as unknown as ReturnType<typeof vi.fn>;

function makeFile(name: string, bytes = 10): File {
  return new File([new Uint8Array(bytes)], name, { type: 'application/octet-stream' });
}

beforeEach(() => {
  uploadMock.mockReset();
  listMock.mockReset();
  uploadMock.mockReturnValue({ promise: Promise.resolve({ id: 'new-file' }), abort: () => {} });
  listMock.mockResolvedValue([]);
});

describe('persistWorkshopUploadToProjectFiles', () => {
  it('skips non-CAD filenames without hitting the network', async () => {
    const result = await persistWorkshopUploadToProjectFiles(
      makeFile('notes.pdf'),
      { projectId: 'p', itemId: 'i', userId: 'u' },
    );
    expect(result.skipped).toBe(true);
    expect(result.file).toBeNull();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('skips when projectId is missing (standalone session)', async () => {
    const result = await persistWorkshopUploadToProjectFiles(
      makeFile('kitchen.3ds'),
      { projectId: '', itemId: 'i', userId: 'u' },
    );
    expect(result.skipped).toBe(true);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('skips when itemId is missing', async () => {
    const result = await persistWorkshopUploadToProjectFiles(
      makeFile('kitchen.3ds'),
      { projectId: 'p', itemId: '', userId: 'u' },
    );
    expect(result.skipped).toBe(true);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('dedupes when an item already has a latest cad-model with the same filename', async () => {
    const existing = { id: 'existing', fileName: 'kitchen.3ds', category: 'cad-model' };
    listMock.mockResolvedValueOnce([existing]);
    const result = await persistWorkshopUploadToProjectFiles(
      makeFile('kitchen.3ds'),
      { projectId: 'p', itemId: 'i', userId: 'u' },
    );
    expect(result.skipped).toBe(true);
    expect(result.file).toBe(existing);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('uploads when no dedupe hit, stamping cad-model category + design-manager module', async () => {
    uploadMock.mockReturnValueOnce({
      promise: Promise.resolve({ id: 'saved-id', fileName: 'kitchen.3ds' }),
      abort: () => {},
    });
    const result = await persistWorkshopUploadToProjectFiles(
      makeFile('kitchen.3ds'),
      { projectId: 'proj', itemId: 'item', itemName: 'Kitchen', userId: 'user-1' },
    );
    expect(result.skipped).toBe(false);
    expect(result.file).toEqual({ id: 'saved-id', fileName: 'kitchen.3ds' });
    expect(uploadMock).toHaveBeenCalledOnce();
    const [, ctx] = uploadMock.mock.calls[0];
    expect(ctx).toMatchObject({
      projectId: 'proj',
      itemId: 'item',
      itemName: 'Kitchen',
      module: 'design-manager',
      category: 'cad-model',
      uploadedBy: 'user-1',
    });
    expect(ctx.tags).toContain('workshop-viewer-upload');
  });

  it('uploads (no dedupe check) when skipIfNameExists=false', async () => {
    uploadMock.mockReturnValueOnce({
      promise: Promise.resolve({ id: 'saved' }),
      abort: () => {},
    });
    const result = await persistWorkshopUploadToProjectFiles(
      makeFile('kitchen.3ds'),
      { projectId: 'p', itemId: 'i', userId: 'u', skipIfNameExists: false },
    );
    expect(result.skipped).toBe(false);
    expect(listMock).not.toHaveBeenCalled();
    expect(uploadMock).toHaveBeenCalledOnce();
  });
});
