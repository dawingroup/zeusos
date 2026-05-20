/**
 * scene.service — P2 DesignItem FK runtime tests.
 *
 * The schema tests in `__tests__/scene.service.test.ts` pin the shape of
 * the input; this file pins the SERVICE-level invariants that can't be
 * proved from the schema alone:
 *
 *   1. `addCabinetToScene` throws when a project-backed scene is handed
 *      a cabinet without `designItemId` (guard mirrors the Firestore
 *      rule).
 *   2. `addCabinetToScene` accepts the same input for a standalone
 *      scene (legacy quick-review escape hatch).
 *   3. `addCabinetToScene` + `duplicateCabinet` arrayUnion the FK into
 *      `DesignScene.linkedDesignItemIds` so the scene-level filter
 *      cache stays honest.
 *   4. `removeCabinetFromScene` and `assignCabinetToDesignItem`
 *      RECOMPUTE the cache from the remaining cabinet set (not
 *      arrayRemove), so drifted caches self-heal.
 *   5. `assignCabinetToDesignItem` rejects empty FKs and refuses to
 *      reassign locked cabinets.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDoc, getDocs, addDoc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';

// The rollup trigger does a dynamic import of `./designItemCostAggregator`;
// stub it so the cabinet-write paths don't blow up just because the
// aggregator isn't available in the unit-test graph.
vi.mock('../designItemCostAggregator', () => ({
  recomputeDesignItemRollups: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/firebase/config', () => ({
  db: {},
}));

import {
  addCabinetToScene,
  duplicateCabinet,
  removeCabinetFromScene,
  assignCabinetToDesignItem,
} from '../../services/scene.service';

const getDocMock = getDoc as unknown as ReturnType<typeof vi.fn>;
const getDocsMock = getDocs as unknown as ReturnType<typeof vi.fn>;
const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>;
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>;
const deleteDocMock = deleteDoc as unknown as ReturnType<typeof vi.fn>;
const arrayUnionMock = arrayUnion as unknown as ReturnType<typeof vi.fn>;

type SnapLike = {
  exists: () => boolean;
  data: () => Record<string, unknown> | undefined;
  id?: string;
};

function makeSnap(data: Record<string, unknown> | null, id = 'mock-id'): SnapLike {
  return {
    exists: () => data !== null,
    data: () => (data === null ? undefined : data),
    id,
  };
}

function makeDocsSnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs: docs.map(d => ({
      id: d.id,
      data: () => d.data,
    })),
    forEach: (fn: (d: { id: string; data: () => Record<string, unknown> }) => void) => {
      for (const d of docs) fn({ id: d.id, data: () => d.data });
    },
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_CABINET_INPUT = {
  pddId: 'kitchen-base-600',
  cabinetCode: 'KB600-A',
  displayName: 'Kitchen Base 600',
  configuration: { width: 600 },
  finishSelections: { carcass: 'white-mdf' },
};

function projectScene() {
  return { projectId: 'proj-42', totalCabinetCount: 0 };
}

function standaloneScene() {
  return { projectId: 'standalone', totalCabinetCount: 0 };
}

// ---------------------------------------------------------------------------
// addCabinetToScene — guard
// ---------------------------------------------------------------------------

describe('addCabinetToScene — DesignItem FK guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when a project-backed scene is missing designItemId', async () => {
    getDocMock.mockResolvedValueOnce(makeSnap(projectScene()));
    await expect(
      addCabinetToScene('scene-1', { ...VALID_CABINET_INPUT }),
    ).rejects.toThrow(/designItemId is required/);
    // Nothing should have been written — not the cabinet, not the scene.
    expect(addDocMock).not.toHaveBeenCalled();
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('accepts standalone scene without designItemId', async () => {
    getDocMock.mockResolvedValueOnce(makeSnap(standaloneScene()));
    getDocsMock.mockResolvedValueOnce(makeDocsSnap([])); // no existing cabinets
    addDocMock.mockResolvedValueOnce({ id: 'new-cab' });

    const id = await addCabinetToScene('scene-legacy', { ...VALID_CABINET_INPUT });

    expect(id).toBe('new-cab');
    const written = addDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    // Cabinet should NOT have designItemId stamped on it for standalone.
    expect(written.designItemId).toBeUndefined();
  });

  it('throws a clear not-found error when the parent scene is missing', async () => {
    getDocMock.mockResolvedValueOnce(makeSnap(null));
    await expect(
      addCabinetToScene('ghost-scene', { ...VALID_CABINET_INPUT, designItemId: 'item-1' }),
    ).rejects.toThrow(/Scene ghost-scene not found/);
  });
});

// ---------------------------------------------------------------------------
// addCabinetToScene — cache maintenance
// ---------------------------------------------------------------------------

describe('addCabinetToScene — linkedDesignItemIds cache maintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('arrayUnions designItemId onto the scene cache on project-backed write', async () => {
    getDocMock.mockResolvedValueOnce(makeSnap(projectScene()));
    getDocsMock.mockResolvedValueOnce(makeDocsSnap([]));
    addDocMock.mockResolvedValueOnce({ id: 'cab-1' });

    await addCabinetToScene('scene-p', {
      ...VALID_CABINET_INPUT,
      designItemId: 'item-kitchen',
    });

    // arrayUnion is invoked with the new designItemId
    expect(arrayUnionMock).toHaveBeenCalledWith('item-kitchen');

    // Scene updateDoc payload includes the cache + the totalCabinetCount bump
    const sceneUpdate = updateDocMock.mock.calls.find(call => {
      const payload = call[1] as Record<string, unknown>;
      return 'totalCabinetCount' in payload;
    });
    expect(sceneUpdate).toBeDefined();
    const payload = sceneUpdate?.[1] as Record<string, unknown>;
    expect(payload.totalCabinetCount).toBe(1);
    expect(payload.linkedDesignItemIds).toBeDefined();
  });

  it('does NOT touch linkedDesignItemIds on a standalone write', async () => {
    getDocMock.mockResolvedValueOnce(makeSnap(standaloneScene()));
    getDocsMock.mockResolvedValueOnce(makeDocsSnap([]));
    addDocMock.mockResolvedValueOnce({ id: 'cab-2' });

    await addCabinetToScene('scene-s', { ...VALID_CABINET_INPUT });

    expect(arrayUnionMock).not.toHaveBeenCalled();
    // The scene update still fires (for totalCabinetCount), but no
    // linkedDesignItemIds field on it.
    const sceneUpdate = updateDocMock.mock.calls[0];
    const payload = sceneUpdate?.[1] as Record<string, unknown>;
    expect(payload.linkedDesignItemIds).toBeUndefined();
  });

  it('refuses a duplicate cabinetCode within the same scene', async () => {
    getDocMock.mockResolvedValueOnce(makeSnap(projectScene()));
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'existing-1', data: { cabinetCode: 'KB600-A', sequence: 0 } },
      ]),
    );

    await expect(
      addCabinetToScene('scene-p', {
        ...VALID_CABINET_INPUT,
        designItemId: 'item-1',
      }),
    ).rejects.toThrow(/Cabinet code "KB600-A" already exists/);
    expect(addDocMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// duplicateCabinet — FK propagation + guard
// ---------------------------------------------------------------------------

describe('duplicateCabinet — DesignItem FK propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inherits designItemId from source cabinet', async () => {
    // 1st getDoc: source cabinet
    getDocMock
      .mockResolvedValueOnce(
        makeSnap({
          cabinetCode: 'KB600-A',
          displayName: 'Kitchen Base 600',
          pddId: 'kitchen-base-600',
          configuration: { width: 600 },
          finishSelections: {},
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          anchorPoint: 'bottom_back_left',
          glbUrl: '',
          thumbnailUrl: '',
          assemblies: [],
          computedBOM: [],
          estimatedPrice: {},
          isLocked: false,
          designItemId: 'item-kitchen',
        }, 'source-cab'),
      )
      // 2nd getDoc: parent scene
      .mockResolvedValueOnce(makeSnap(projectScene()));
    // existing cabinets list
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'source-cab', data: { cabinetCode: 'KB600-A', sequence: 0 } },
      ]),
    );
    addDocMock.mockResolvedValueOnce({ id: 'dup-cab' });

    await duplicateCabinet('scene-p', 'source-cab');

    const written = addDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(written.designItemId).toBe('item-kitchen');
    // Cache gets the same id pushed (idempotent via arrayUnion).
    expect(arrayUnionMock).toHaveBeenCalledWith('item-kitchen');
  });

  it('throws if duplicating an orphan cabinet on a project-backed scene', async () => {
    getDocMock
      .mockResolvedValueOnce(
        makeSnap({
          cabinetCode: 'KB600-A',
          pddId: 'x',
          configuration: {},
          finishSelections: {},
          position: { x: 0, y: 0, z: 0 },
          rotation: 0,
          // NOTE: no designItemId — the orphan case
        }, 'legacy-orphan'),
      )
      .mockResolvedValueOnce(makeSnap(projectScene()));

    await expect(duplicateCabinet('scene-p', 'legacy-orphan')).rejects.toThrow(
      /source cabinet has no DesignItem linked/,
    );
    expect(addDocMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// removeCabinetFromScene — cache recompute
// ---------------------------------------------------------------------------

describe('removeCabinetFromScene — cache recompute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recomputes linkedDesignItemIds from the remaining cabinets', async () => {
    // Cabinet being removed
    getDocMock
      .mockResolvedValueOnce(
        makeSnap({
          cabinetCode: 'KB600-A',
          designItemId: 'item-kitchen',
          isLocked: false,
        }),
      )
      // Scene (for projectId capture before delete)
      .mockResolvedValueOnce(makeSnap(projectScene()));
    // Remaining cabinets AFTER delete (query inside removeCabinetFromScene)
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'cab-b', data: { cabinetCode: 'KB600-B', sequence: 0, designItemId: 'item-utility' } },
        { id: 'cab-c', data: { cabinetCode: 'KB600-C', sequence: 1, designItemId: 'item-utility' } },
      ]),
    );

    await removeCabinetFromScene('scene-p', 'cab-a');

    expect(deleteDocMock).toHaveBeenCalledTimes(1);
    // The scene update uses the recomputed (deduped) set — NOT arrayRemove.
    const sceneUpdate = updateDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(sceneUpdate.linkedDesignItemIds).toEqual(['item-utility']);
    expect(sceneUpdate.totalCabinetCount).toBe(2);
  });

  it('refuses to remove a cabinet linked to a Manufacturing Order', async () => {
    getDocMock.mockResolvedValueOnce(
      makeSnap({
        cabinetCode: 'KB600-A',
        designItemId: 'item-kitchen',
        isLocked: true,
        manufacturingOrderId: 'mo-7',
      }),
    );

    await expect(removeCabinetFromScene('scene-p', 'cab-a')).rejects.toThrow(
      /Manufacturing Order/,
    );
    expect(deleteDocMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// assignCabinetToDesignItem
// ---------------------------------------------------------------------------

describe('assignCabinetToDesignItem — reassign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an empty designItemId', async () => {
    await expect(
      assignCabinetToDesignItem('scene-p', 'cab-a', ''),
    ).rejects.toThrow(/designItemId is required/);
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('is a no-op when cabinet already points at the same DesignItem', async () => {
    getDocMock.mockResolvedValueOnce(
      makeSnap({ designItemId: 'item-kitchen', isLocked: false }),
    );

    await assignCabinetToDesignItem('scene-p', 'cab-a', 'item-kitchen');

    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('refuses to reassign a locked cabinet', async () => {
    getDocMock.mockResolvedValueOnce(
      makeSnap({ designItemId: 'item-kitchen', isLocked: true }),
    );

    await expect(
      assignCabinetToDesignItem('scene-p', 'cab-a', 'item-utility'),
    ).rejects.toThrow(/Unlock first/);
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  it('updates the cabinet and recomputes the scene cache on a real move', async () => {
    getDocMock
      // cabinet read
      .mockResolvedValueOnce(
        makeSnap({ designItemId: 'item-kitchen', isLocked: false }),
      )
      // scene read (for projectId)
      .mockResolvedValueOnce(makeSnap(projectScene()));
    // remaining cabinets after the FK flip
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'cab-a', data: { cabinetCode: 'KB600-A', sequence: 0, designItemId: 'item-utility' } },
        { id: 'cab-b', data: { cabinetCode: 'KB600-B', sequence: 1, designItemId: 'item-utility' } },
      ]),
    );

    await assignCabinetToDesignItem('scene-p', 'cab-a', 'item-utility');

    // Two updateDocs: the cabinet flip, then the scene cache recompute.
    expect(updateDocMock).toHaveBeenCalledTimes(2);
    const cabPayload = updateDocMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(cabPayload.designItemId).toBe('item-utility');

    const scenePayload = updateDocMock.mock.calls[1]?.[1] as Record<string, unknown>;
    expect(scenePayload.linkedDesignItemIds).toEqual(['item-utility']);
  });
});
