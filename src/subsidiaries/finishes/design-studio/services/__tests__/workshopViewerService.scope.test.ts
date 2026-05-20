/**
 * Workshop Viewer Service — P4 session-scope regression tests
 *
 * Pins the P4 fix: workshop sessions must declare a scope (`'bound'` or
 * `'standalone'`) and the service must fail loud rather than silently
 * create an orphan session or attach a print package to a standalone
 * session. See `cuddly-rolling-mango.md` P4 in the audit plan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addDoc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import {
  deriveSessionScope,
  hasBoundContext,
  createSession,
  createStandaloneSession,
  getOrCreateSession,
  bindSessionToContext,
  attachPrintPackage,
} from '../workshopViewerService';
import type { ViewerSession } from '../../types/workshop-viewer.types';

// Stub Storage writes — the P4 guards run before any upload, but some
// paths still reach upload/getUrl on the happy path and we don't want to
// actually hit Firebase Storage.
vi.mock('@/core/services/firebase/storage', () => ({
  uploadFile: vi.fn(() => Promise.resolve()),
  getFileUrl: vi.fn(() => Promise.resolve('https://example.com/file')),
  deleteFile: vi.fn(() => Promise.resolve()),
}));

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>;
const getDocMock = getDoc as unknown as ReturnType<typeof vi.fn>;
const getDocsMock = getDocs as unknown as ReturnType<typeof vi.fn>;
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>;

function makeDocSnap(exists: boolean, data: Record<string, unknown> = {}, id = 'mock-id') {
  return {
    exists: () => exists,
    data: () => (exists ? data : undefined),
    id,
  };
}

describe('P4 — pure scope helpers', () => {
  describe('hasBoundContext', () => {
    it('returns false when neither link is present', () => {
      expect(hasBoundContext({})).toBe(false);
      expect(hasBoundContext({ linkedDesignItemId: undefined, linkedMoId: undefined })).toBe(false);
      expect(hasBoundContext({ linkedDesignItemId: '', linkedMoId: '' })).toBe(false);
      expect(hasBoundContext({ linkedDesignItemId: null, linkedMoId: null })).toBe(false);
    });

    it('returns true when linkedDesignItemId is set', () => {
      expect(hasBoundContext({ linkedDesignItemId: 'di-1' })).toBe(true);
    });

    it('returns true when linkedMoId is set', () => {
      expect(hasBoundContext({ linkedMoId: 'mo-1' })).toBe(true);
    });

    it('returns true when both are set', () => {
      expect(hasBoundContext({ linkedDesignItemId: 'di-1', linkedMoId: 'mo-1' })).toBe(true);
    });
  });

  describe('deriveSessionScope', () => {
    it('prefers an explicit scope field when set', () => {
      // Even with links present, an explicit scope takes precedence —
      // prevents legacy docs that happen to have links from ever being
      // misclassified if we've already written the field.
      expect(
        deriveSessionScope({
          scope: 'standalone',
          linkedDesignItemId: 'di-1',
        } as ViewerSession),
      ).toBe('standalone');
      expect(
        deriveSessionScope({
          scope: 'bound',
          linkedDesignItemId: undefined,
        } as unknown as ViewerSession),
      ).toBe('bound');
    });

    it('derives bound from linkedDesignItemId when scope is absent (legacy doc)', () => {
      expect(
        deriveSessionScope({
          linkedDesignItemId: 'di-1',
        } as ViewerSession),
      ).toBe('bound');
    });

    it('derives bound from linkedMoId when scope is absent (legacy doc)', () => {
      expect(
        deriveSessionScope({
          linkedMoId: 'mo-1',
        } as ViewerSession),
      ).toBe('bound');
    });

    it('derives standalone when neither scope nor links are set (legacy orphan)', () => {
      expect(deriveSessionScope({} as ViewerSession)).toBe('standalone');
    });
  });
});

describe('P4 — createSession / getOrCreateSession fail-loud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createSession throws when both DesignItem and MO are absent', async () => {
    await expect(
      createSession(
        {
          name: 'Orphan attempt',
          // File is a browser type; cast via unknown keeps the test from
          // depending on a real File implementation since we short-circuit
          // before any upload.
          modelFile: {} as unknown as File,
          projectInfo: {
            projectName: '',
            client: '',
            address: '',
            projectNo: '',
            drawnBy: '',
            checkedBy: '',
            revision: 'A',
            stage: '',
            date: '',
          },
          hiddenLineMode: 'faint',
        },
        'user-1',
      ),
    ).rejects.toThrow(/linkedDesignItemId/i);
    // Guard runs before addDoc is invoked.
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('getOrCreateSession throws when both DesignItem and MO are absent', async () => {
    await expect(
      getOrCreateSession(
        {
          modelFileUrl: 'https://example.com/file.glb',
          name: 'Orphan',
        },
        'user-1',
      ),
    ).rejects.toThrow(/linkedDesignItemId/i);
    expect(addDocMock).not.toHaveBeenCalled();
  });

  it('getOrCreateSession stamps scope=bound on create when a DesignItem is supplied', async () => {
    // Lookup returns empty → service falls through to addDoc.
    getDocsMock.mockResolvedValueOnce({ docs: [], empty: true, size: 0, forEach: vi.fn() });
    addDocMock.mockResolvedValueOnce({ id: 'new-session-id' });

    const id = await getOrCreateSession(
      {
        modelFileUrl: 'https://example.com/file.glb',
        linkedDesignItemId: 'di-abc',
      },
      'user-1',
    );

    expect(id).toBe('new-session-id');
    const written = addDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(written.scope).toBe('bound');
    expect(written.linkedDesignItemId).toBe('di-abc');
  });
});

describe('P4 — createStandaloneSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes scope=standalone with both links null', async () => {
    addDocMock.mockResolvedValueOnce({ id: 'standalone-id' });

    const id = await createStandaloneSession(
      { name: 'Scratch', modelFileUrl: 'https://example.com/s.glb' },
      'user-1',
    );

    expect(id).toBe('standalone-id');
    const written = addDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(written.scope).toBe('standalone');
    expect(written.linkedDesignItemId).toBeNull();
    expect(written.linkedMoId).toBeNull();
    expect(written.entryMode).toBe('upload');
  });
});

describe('P4 — attachPrintPackage scope gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the target session is standalone (scope field set)', async () => {
    getDocMock.mockResolvedValueOnce(
      makeDocSnap(true, {
        scope: 'standalone',
        linkedDesignItemId: null,
        linkedMoId: null,
      }),
    );
    await expect(
      attachPrintPackage('sess-standalone', new Blob(['x']), 'print.pdf', 'user-1'),
    ).rejects.toThrow(/standalone/i);
  });

  it('throws when the target session is a legacy orphan (no scope, no links)', async () => {
    // Legacy doc shape — scope field absent, both links missing.
    // deriveSessionScope() must classify this as standalone and the gate
    // must still fire so old orphan sessions can't silently receive attachments.
    getDocMock.mockResolvedValueOnce(makeDocSnap(true, { name: 'Legacy' }));
    await expect(
      attachPrintPackage('sess-legacy', new Blob(['x']), 'print.pdf', 'user-1'),
    ).rejects.toThrow(/standalone/i);
  });

  it('throws when the session is not found', async () => {
    getDocMock.mockResolvedValueOnce(makeDocSnap(false));
    await expect(
      attachPrintPackage('sess-missing', new Blob(['x']), 'print.pdf', 'user-1'),
    ).rejects.toThrow(/not found/i);
  });
});

describe('P4 — bindSessionToContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promotes a standalone session to bound when a DesignItem is supplied', async () => {
    await bindSessionToContext(
      'sess-1',
      { linkedDesignItemId: 'di-1' },
      'user-1',
    );
    const updates = updateDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updates.scope).toBe('bound');
    expect(updates.linkedDesignItemId).toBe('di-1');
    expect(updates.linkedMoId).toBeNull();
  });

  it('refuses to bind when neither link is supplied', async () => {
    await expect(
      bindSessionToContext('sess-1', {}, 'user-1'),
    ).rejects.toThrow(/linkedDesignItemId/i);
    expect(updateDocMock).not.toHaveBeenCalled();
  });
});
