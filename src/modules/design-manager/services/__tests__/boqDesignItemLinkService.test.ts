/**
 * boqDesignItemLinkService — P9/F9 link/unlink contract tests.
 *
 * The bidirectional invariant (ControlBOQItem.linkedDesignItemId ↔
 * DesignItem.linkedBoqItemIds[]) is fragile: a half-applied link silently
 * corrupts reconciliation views. These tests pin the properties that
 * keep that invariant sound:
 *
 *   1. Both writes land in a single Firestore batch commit (atomicity).
 *   2. Pre-flight getDoc checks reject missing docs before any write.
 *   3. Silent reassignment is rejected — a BOQ item can't be re-linked
 *      to a different DesignItem without an explicit unlink.
 *   4. The projectId guard prevents one advisory project from mutating
 *      another project's BOQ row by guessing the itemId (mirrors the
 *      guard in `updateControlBOQItem`).
 *
 * Firestore is auto-mocked via the vitest alias at
 * src/firebase/__mocks__/firestore.ts, so we reach into
 * `writeBatch.mock.results` to inspect what the service queued on the
 * batch before commit.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDoc,
  writeBatch,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import {
  linkBoqToDesignItem,
  unlinkBoqFromDesignItem,
  getLinkedDesignItemId,
  getLinkedBoqItemIds,
  fetchLinkedBoqItem,
  fetchControlBoqItemById,
  BOQDesignItemLinkError,
  type BOQItemRef,
  type DesignItemRef,
} from '../boqDesignItemLinkService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BOQ_REF: BOQItemRef = {
  advisoryProjectId: 'adv-proj-1',
  boqItemId: 'boq-item-1',
};

const DESIGN_REF: DesignItemRef = {
  designProjectId: 'design-proj-1',
  designItemId: 'design-item-1',
};

const USER_ID = 'user-1';

/**
 * Pull the most recently created batch out of the writeBatch mock so we
 * can assert which document updates the service queued.
 */
function lastBatch() {
  const results = (writeBatch as unknown as { mock: { results: Array<{ value: unknown }> } }).mock
    .results;
  const last = results[results.length - 1].value as {
    set: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    commit: ReturnType<typeof vi.fn>;
  };
  return last;
}

/**
 * Stage a sequence of getDoc responses. Promise.all fires both reads in
 * parallel — the two queued responses pop off in call order (BOQ first,
 * DesignItem second).
 */
function stageGetDocs(
  options: {
    boqExists?: boolean;
    designExists?: boolean;
    boqData?: Record<string, unknown>;
  } = {},
) {
  const { boqExists = true, designExists = true, boqData = { projectId: BOQ_REF.advisoryProjectId } } =
    options;
  (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    exists: () => boqExists,
    data: () => boqData,
    id: BOQ_REF.boqItemId,
  });
  (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    exists: () => designExists,
    data: () => ({}),
    id: DESIGN_REF.designItemId,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  (writeBatch as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  }));
});

// ---------------------------------------------------------------------------
// linkBoqToDesignItem
// ---------------------------------------------------------------------------

describe('linkBoqToDesignItem', () => {
  it('queues both sides onto a single batch and commits once', async () => {
    stageGetDocs({
      boqData: { projectId: BOQ_REF.advisoryProjectId, linkedDesignItemId: undefined },
    });

    await linkBoqToDesignItem(BOQ_REF, DESIGN_REF, USER_ID);

    const batch = lastBatch();
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);

    // First update writes the forward link onto the BOQ item — and
    // P9c denormalises the DesignItem's parent projectId so readers
    // that only have the BOQ row can still resolve the Firestore path.
    const [, boqPayload] = batch.update.mock.calls[0];
    expect(boqPayload).toMatchObject({
      linkedDesignItemId: DESIGN_REF.designItemId,
      linkedDesignProjectId: DESIGN_REF.designProjectId,
      updatedBy: USER_ID,
    });
    expect(boqPayload.updatedAt).toEqual(serverTimestamp());

    // Second update appends the reverse link onto the DesignItem.
    const [, designPayload] = batch.update.mock.calls[1];
    expect(designPayload).toMatchObject({ updatedBy: USER_ID });
    expect(designPayload.linkedBoqItemIds).toEqual(arrayUnion(BOQ_REF.boqItemId));
    expect(designPayload.updatedAt).toEqual(serverTimestamp());
  });

  it('throws link/boq-not-found before writing when the BOQ item is missing', async () => {
    stageGetDocs({ boqExists: false });

    await expect(linkBoqToDesignItem(BOQ_REF, DESIGN_REF, USER_ID)).rejects.toMatchObject({
      name: 'BOQDesignItemLinkError',
      code: 'link/boq-not-found',
    });
    // Fail-loud path must not have created a batch at all.
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('throws link/design-item-not-found before writing when the DesignItem is missing', async () => {
    stageGetDocs({ designExists: false });

    await expect(linkBoqToDesignItem(BOQ_REF, DESIGN_REF, USER_ID)).rejects.toMatchObject({
      name: 'BOQDesignItemLinkError',
      code: 'link/design-item-not-found',
    });
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('throws link/boq-project-mismatch when the BOQ row belongs to a different advisory project', async () => {
    // Guessing-itemId attack: the caller thinks the item is in adv-proj-1
    // but the stored row's `projectId` field says it lives elsewhere.
    stageGetDocs({
      boqData: { projectId: 'some-other-project', linkedDesignItemId: undefined },
    });

    await expect(linkBoqToDesignItem(BOQ_REF, DESIGN_REF, USER_ID)).rejects.toMatchObject({
      code: 'link/boq-project-mismatch',
    });
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('rejects silent reassignment when the BOQ is already linked to a different DesignItem', async () => {
    stageGetDocs({
      boqData: {
        projectId: BOQ_REF.advisoryProjectId,
        linkedDesignItemId: 'different-design-item',
      },
    });

    await expect(linkBoqToDesignItem(BOQ_REF, DESIGN_REF, USER_ID)).rejects.toMatchObject({
      name: 'BOQDesignItemLinkError',
      code: 'link/boq-already-linked',
    });
    // The caller must unlink first — no writes should have been queued.
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('is idempotent when the same pair is re-linked (arrayUnion absorbs the duplicate)', async () => {
    stageGetDocs({
      boqData: {
        projectId: BOQ_REF.advisoryProjectId,
        linkedDesignItemId: DESIGN_REF.designItemId,
      },
    });

    await linkBoqToDesignItem(BOQ_REF, DESIGN_REF, USER_ID);

    const batch = lastBatch();
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
    // The reverse-side update still uses arrayUnion — a re-link on the
    // DesignItem side is a Firestore-level no-op.
    const [, designPayload] = batch.update.mock.calls[1];
    expect(designPayload.linkedBoqItemIds).toEqual(arrayUnion(BOQ_REF.boqItemId));
  });

  it('surfaces BOQDesignItemLinkError as a plain thrown error the caller can pattern-match on', async () => {
    stageGetDocs({ boqExists: false });

    try {
      await linkBoqToDesignItem(BOQ_REF, DESIGN_REF, USER_ID);
      throw new Error('expected to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BOQDesignItemLinkError);
      expect((err as BOQDesignItemLinkError).code).toBe('link/boq-not-found');
    }
  });
});

// ---------------------------------------------------------------------------
// unlinkBoqFromDesignItem
// ---------------------------------------------------------------------------

describe('unlinkBoqFromDesignItem', () => {
  it('clears the forward link and removes the reverse id in a single batch', async () => {
    stageGetDocs({
      boqData: {
        projectId: BOQ_REF.advisoryProjectId,
        linkedDesignItemId: DESIGN_REF.designItemId,
      },
    });

    await unlinkBoqFromDesignItem(BOQ_REF, DESIGN_REF, USER_ID);

    const batch = lastBatch();
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);

    // P9c invariant — both halves of the link metadata clear together.
    // A stale projectId after unlink would mislead cross-module readers.
    const [, boqPayload] = batch.update.mock.calls[0];
    expect(boqPayload).toMatchObject({
      linkedDesignItemId: null,
      linkedDesignProjectId: null,
      updatedBy: USER_ID,
    });

    const [, designPayload] = batch.update.mock.calls[1];
    expect(designPayload).toMatchObject({ updatedBy: USER_ID });
    expect(designPayload.linkedBoqItemIds).toEqual(arrayRemove(BOQ_REF.boqItemId));
  });

  it('is idempotent on an already-unlinked pair (arrayRemove absorbs the missing id)', async () => {
    // Forward field already null, reverse array already missing the id —
    // Firestore's arrayRemove is a no-op in that case. We still run the
    // batch so callers can retry safely.
    stageGetDocs({
      boqData: { projectId: BOQ_REF.advisoryProjectId, linkedDesignItemId: null },
    });

    await unlinkBoqFromDesignItem(BOQ_REF, DESIGN_REF, USER_ID);

    const batch = lastBatch();
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('throws unlink/boq-not-found before writing when the BOQ item is missing', async () => {
    stageGetDocs({ boqExists: false });

    await expect(unlinkBoqFromDesignItem(BOQ_REF, DESIGN_REF, USER_ID)).rejects.toMatchObject({
      code: 'unlink/boq-not-found',
    });
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('throws unlink/design-item-not-found before writing when the DesignItem is missing', async () => {
    stageGetDocs({ designExists: false });

    await expect(unlinkBoqFromDesignItem(BOQ_REF, DESIGN_REF, USER_ID)).rejects.toMatchObject({
      code: 'unlink/design-item-not-found',
    });
    expect(writeBatch).not.toHaveBeenCalled();
  });

  it('throws link/boq-project-mismatch when the BOQ row is not in the expected advisory project', async () => {
    // Unlink must preserve the same tenancy guard as link — otherwise the
    // caller could clear links in someone else's project.
    stageGetDocs({
      boqData: {
        projectId: 'some-other-project',
        linkedDesignItemId: DESIGN_REF.designItemId,
      },
    });
    await expect(unlinkBoqFromDesignItem(BOQ_REF, DESIGN_REF, USER_ID)).rejects.toMatchObject({
      code: 'link/boq-project-mismatch',
    });
    expect(writeBatch).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

describe('getLinkedDesignItemId', () => {
  it('returns the linkedDesignItemId when the BOQ exists and is linked', async () => {
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        projectId: BOQ_REF.advisoryProjectId,
        linkedDesignItemId: 'design-xyz',
      }),
      id: BOQ_REF.boqItemId,
    });
    expect(await getLinkedDesignItemId(BOQ_REF)).toBe('design-xyz');
  });

  it('returns null when the BOQ exists but is not linked', async () => {
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ projectId: BOQ_REF.advisoryProjectId }),
      id: BOQ_REF.boqItemId,
    });
    expect(await getLinkedDesignItemId(BOQ_REF)).toBeNull();
  });

  it('returns null when the BOQ document does not exist', async () => {
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
      id: BOQ_REF.boqItemId,
    });
    expect(await getLinkedDesignItemId(BOQ_REF)).toBeNull();
  });

  it('returns null when the BOQ belongs to a different advisory project (silent no-op on read)', async () => {
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ projectId: 'other-project', linkedDesignItemId: 'design-xyz' }),
      id: BOQ_REF.boqItemId,
    });
    expect(await getLinkedDesignItemId(BOQ_REF)).toBeNull();
  });
});

describe('getLinkedBoqItemIds', () => {
  it('returns the linkedBoqItemIds array when the DesignItem has links', async () => {
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ linkedBoqItemIds: ['boq-a', 'boq-b'] }),
      id: DESIGN_REF.designItemId,
    });
    expect(await getLinkedBoqItemIds(DESIGN_REF)).toEqual(['boq-a', 'boq-b']);
  });

  it('returns an empty array when the DesignItem exists but has no links', async () => {
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({}),
      id: DESIGN_REF.designItemId,
    });
    expect(await getLinkedBoqItemIds(DESIGN_REF)).toEqual([]);
  });

  it('returns an empty array when the DesignItem document does not exist', async () => {
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
      id: DESIGN_REF.designItemId,
    });
    expect(await getLinkedBoqItemIds(DESIGN_REF)).toEqual([]);
  });
});

describe('fetchLinkedBoqItem', () => {
  it('returns the ControlBOQItem when the row exists and belongs to the project', async () => {
    const row = {
      id: BOQ_REF.boqItemId,
      projectId: BOQ_REF.advisoryProjectId,
      description: 'Tile, white, 300x600',
      quantityContract: 120,
      rate: 35,
    };
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => true,
      data: () => row,
      id: BOQ_REF.boqItemId,
    });
    const result = await fetchLinkedBoqItem(BOQ_REF);
    expect(result).toMatchObject({
      id: BOQ_REF.boqItemId,
      projectId: BOQ_REF.advisoryProjectId,
      description: 'Tile, white, 300x600',
    });
  });

  it('returns null when the BOQ belongs to a different advisory project', async () => {
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ projectId: 'other-project', description: 'not ours' }),
      id: BOQ_REF.boqItemId,
    });
    expect(await fetchLinkedBoqItem(BOQ_REF)).toBeNull();
  });

  it('returns null when the BOQ document does not exist', async () => {
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
      id: BOQ_REF.boqItemId,
    });
    expect(await fetchLinkedBoqItem(BOQ_REF)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchControlBoqItemById — project-agnostic read
// ---------------------------------------------------------------------------

describe('fetchControlBoqItemById', () => {
  // Unlike fetchLinkedBoqItem, this helper does NOT apply a project guard —
  // it's used from the DesignItem side where the caller only has a bare
  // boqItemId from `DesignItem.linkedBoqItemIds` and can't supply a
  // BOQItemRef. Security rules enforce tenancy at the Firestore layer.
  it('returns the ControlBOQItem regardless of which advisory project it belongs to', async () => {
    const row = {
      projectId: 'any-other-project',
      itemCode: 'BOQ-001',
      description: 'Partition, glazed, 2100mm',
      amount: 4200,
    };
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => true,
      data: () => row,
      id: 'boq-xyz',
    });
    const result = await fetchControlBoqItemById('boq-xyz');
    expect(result).toMatchObject({
      id: 'boq-xyz',
      projectId: 'any-other-project',
      itemCode: 'BOQ-001',
      description: 'Partition, glazed, 2100mm',
    });
  });

  it('returns null when the BOQ document does not exist (orphaned link)', async () => {
    // DesignItem still has the id in `linkedBoqItemIds` but the BOQ row was
    // deleted — callers render "BOQ item unavailable" rather than crash.
    (getDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      exists: () => false,
      data: () => undefined,
      id: 'boq-missing',
    });
    expect(await fetchControlBoqItemById('boq-missing')).toBeNull();
  });
});
