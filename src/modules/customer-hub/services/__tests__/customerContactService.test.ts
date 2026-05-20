/**
 * customerContactService — P11-2 service-level invariants.
 *
 * The type-level round-trip is covered by
 * `src/modules/customer-hub/types/__tests__/customerContact.test.ts`.
 * This file pins the RUNTIME guarantees the writers + readers depend
 * on:
 *
 *   1. `createCustomerContact` stamps `customerId` + timestamps and
 *      never forwards `undefined` values (Firestore rejects those).
 *   2. `updateCustomerContact` refreshes `updatedAt` without touching
 *      `createdAt`, even on no-op-looking patches.
 *   3. `deleteCustomerContact` soft-deletes by default (updateDoc
 *      with `isActive: false`); `hardDelete: true` uses deleteDoc.
 *   4. `setPrimaryCustomerContact` commits a single batched write
 *      that promotes the target and unsets every sibling currently
 *      marked primary, leaving already-correct rows alone.
 *   5. `listCustomerContacts` sorts primary-first, then name.
 *
 * Firestore is auto-mocked via `src/firebase/__mocks__/firestore.ts`;
 * we assert on the mock call arguments rather than emulator state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

// NOTE: `firebase/firestore` is already aliased to
// `src/firebase/__mocks__/firestore.ts` by `vitest.config.ts`, so
// every imported primitive here is a `vi.fn()` we can stage.

import {
  createCustomerContact,
  updateCustomerContact,
  deleteCustomerContact,
  setPrimaryCustomerContact,
  listCustomerContacts,
  setCustomerContact,
  mirrorEmbeddedContactsToCollection,
} from '../customerContactService';
import type { CustomerContactFormData } from '../../types/customerContact';
import type { ContactPerson } from '../../types';

// ---------------------------------------------------------------------------
// Mock handles
// ---------------------------------------------------------------------------

const addDocMock = addDoc as unknown as ReturnType<typeof vi.fn>;
const setDocMock = setDoc as unknown as ReturnType<typeof vi.fn>;
const updateDocMock = updateDoc as unknown as ReturnType<typeof vi.fn>;
const deleteDocMock = deleteDoc as unknown as ReturnType<typeof vi.fn>;
const getDocsMock = getDocs as unknown as ReturnType<typeof vi.fn>;
const writeBatchMock = writeBatch as unknown as ReturnType<typeof vi.fn>;
const serverTimestampMock = serverTimestamp as unknown as ReturnType<typeof vi.fn>;

/**
 * Build a `QuerySnapshot`-shaped value for the getDocs mock. Only
 * populates `docs[*].id` + `docs[*].data()` — that's all the service
 * reads off each result.
 */
function makeDocsSnap(
  rows: Array<{ id: string; data: Record<string, unknown> }>,
): { docs: Array<{ id: string; data: () => Record<string, unknown> }> } {
  return {
    docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // serverTimestamp() returns a sentinel; the fake needs a stable
  // value so assertions can compare against it.
  serverTimestampMock.mockReturnValue({ _serverTimestamp: true });
});

// ---------------------------------------------------------------------------
// createCustomerContact
// ---------------------------------------------------------------------------

describe('createCustomerContact', () => {
  const formData: CustomerContactFormData = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    role: 'procurement',
    isPrimary: false,
  };

  it('stamps customerId + createdAt/updatedAt on the written doc', async () => {
    addDocMock.mockResolvedValueOnce({ id: 'cc-1' });

    const id = await createCustomerContact('cust-1', formData);

    expect(id).toBe('cc-1');
    expect(addDocMock).toHaveBeenCalledTimes(1);
    const payload = addDocMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.customerId).toBe('cust-1');
    expect(payload.name).toBe('Jane Doe');
    expect(payload.createdAt).toEqual({ _serverTimestamp: true });
    expect(payload.updatedAt).toEqual({ _serverTimestamp: true });
  });

  it('strips undefined fields so Firestore does not reject the write', async () => {
    addDocMock.mockResolvedValueOnce({ id: 'cc-2' });

    // `notes: undefined` is the mine here — Firestore throws
    // "undefined is not a supported Firestore value" if passed through.
    const data: CustomerContactFormData = {
      name: 'Sparse',
      isPrimary: false,
      notes: undefined,
      email: undefined,
      phone: undefined,
    };
    await createCustomerContact('cust-2', data);

    const payload = addDocMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('notes');
    expect(payload).not.toHaveProperty('email');
    expect(payload).not.toHaveProperty('phone');
  });
});

// ---------------------------------------------------------------------------
// updateCustomerContact
// ---------------------------------------------------------------------------

describe('updateCustomerContact', () => {
  it('refreshes updatedAt and never re-writes createdAt', async () => {
    await updateCustomerContact('cc-1', { name: 'Renamed' });

    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const payload = updateDocMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.updatedAt).toEqual({ _serverTimestamp: true });
    expect(payload).not.toHaveProperty('createdAt');
    expect(payload.name).toBe('Renamed');
  });

  it('strips undefined patch values', async () => {
    await updateCustomerContact('cc-1', {
      name: 'Renamed',
      email: undefined,
    });
    const payload = updateDocMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('email');
  });
});

// ---------------------------------------------------------------------------
// deleteCustomerContact
// ---------------------------------------------------------------------------

describe('deleteCustomerContact', () => {
  it('soft-deletes by default (isActive=false via updateDoc)', async () => {
    await deleteCustomerContact('cc-1');

    expect(deleteDocMock).not.toHaveBeenCalled();
    expect(updateDocMock).toHaveBeenCalledTimes(1);
    const payload = updateDocMock.mock.calls[0][1] as Record<string, unknown>;
    expect(payload.isActive).toBe(false);
    expect(payload.updatedAt).toEqual({ _serverTimestamp: true });
  });

  it('hard-deletes when hardDelete: true', async () => {
    await deleteCustomerContact('cc-1', { hardDelete: true });

    expect(deleteDocMock).toHaveBeenCalledTimes(1);
    expect(updateDocMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// setPrimaryCustomerContact — the whole point is the atomic batch.
// ---------------------------------------------------------------------------

describe('setPrimaryCustomerContact', () => {
  /**
   * Stage a fresh batch object on the writeBatch mock so each test
   * gets a clean `update` spy to assert against.
   */
  function stageBatch() {
    const batch = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    writeBatchMock.mockReturnValueOnce(batch);
    return batch;
  }

  it('promotes the target and unsets every currently-primary sibling', async () => {
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'cc-target', data: { customerId: 'cust-1', isPrimary: false } },
        { id: 'cc-old-primary', data: { customerId: 'cust-1', isPrimary: true } },
        { id: 'cc-other', data: { customerId: 'cust-1', isPrimary: false } },
      ]),
    );
    const batch = stageBatch();

    await setPrimaryCustomerContact('cc-target', 'cust-1');

    // Exactly two updates: promote target, demote old primary. The
    // third (already-not-primary) sibling must NOT be touched.
    expect(batch.update).toHaveBeenCalledTimes(2);
    const payloads = batch.update.mock.calls.map(
      (c: unknown[]) => c[1] as Record<string, unknown>,
    );
    expect(payloads.some((p: Record<string, unknown>) => p.isPrimary === true)).toBe(true);
    expect(payloads.some((p: Record<string, unknown>) => p.isPrimary === false)).toBe(true);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('is a no-op batch when the target is already primary and alone', async () => {
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'cc-target', data: { customerId: 'cust-1', isPrimary: true } },
        { id: 'cc-other', data: { customerId: 'cust-1', isPrimary: false } },
      ]),
    );
    const batch = stageBatch();

    await setPrimaryCustomerContact('cc-target', 'cust-1');

    // Nothing to change — the target is already primary and no
    // sibling is marked primary. The batch commits empty, which is
    // cheap and keeps the call-site idempotent.
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// listCustomerContacts — sort contract
// ---------------------------------------------------------------------------

describe('listCustomerContacts', () => {
  it('returns primary contacts first, then sorts the rest by name (case-insensitive)', async () => {
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'cc-bob', data: { customerId: 'cust-1', name: 'bob', isPrimary: false } },
        { id: 'cc-alice', data: { customerId: 'cust-1', name: 'Alice', isPrimary: false } },
        { id: 'cc-prim', data: { customerId: 'cust-1', name: 'zack', isPrimary: true } },
      ]),
    );

    const result = await listCustomerContacts('cust-1');

    expect(result.map((r) => r.id)).toEqual(['cc-prim', 'cc-alice', 'cc-bob']);
  });
});

// ---------------------------------------------------------------------------
// setCustomerContact (id-preserving upsert used by the P11-3 mirror path)
// ---------------------------------------------------------------------------

describe('setCustomerContact', () => {
  it('merges fields under the supplied id and stamps timestamps', async () => {
    await setCustomerContact('cc-keep', 'cust-1', {
      name: 'Jane',
      isPrimary: true,
    });

    expect(setDocMock).toHaveBeenCalledTimes(1);
    const [, payload, options] = setDocMock.mock.calls[0];
    const data = payload as Record<string, unknown>;
    expect(data.customerId).toBe('cust-1');
    expect(data.name).toBe('Jane');
    expect(data.isPrimary).toBe(true);
    expect(data.createdAt).toEqual({ _serverTimestamp: true });
    expect(data.updatedAt).toEqual({ _serverTimestamp: true });
    // Merge semantics: on repeat mirrors, only changed fields land.
    expect(options).toEqual({ merge: true });
  });

  it('strips undefined fields (Firestore rejects them even with merge)', async () => {
    await setCustomerContact('cc-keep', 'cust-1', {
      name: 'Jane',
      isPrimary: true,
      email: undefined,
      notes: undefined,
    });
    const data = setDocMock.mock.calls[0][1] as Record<string, unknown>;
    expect(data).not.toHaveProperty('email');
    expect(data).not.toHaveProperty('notes');
  });
});

// ---------------------------------------------------------------------------
// mirrorEmbeddedContactsToCollection — the P11-3 reconciliation.
// ---------------------------------------------------------------------------

describe('mirrorEmbeddedContactsToCollection', () => {
  /** Same batch-staging helper the setPrimary suite uses. */
  function stageBatch() {
    const batch = {
      set: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    };
    writeBatchMock.mockReturnValueOnce(batch);
    return batch;
  }

  it('upserts every embedded contact under its own id and soft-deletes rows no longer present', async () => {
    // Collection currently has cc-a (present) and cc-gone (removed
    // in the form). Incoming embedded array replaces cc-a and adds
    // cc-new. Expected: two setDoc upserts + one soft-delete update.
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'cc-a', data: { customerId: 'cust-1', isActive: true } },
        { id: 'cc-gone', data: { customerId: 'cust-1', isActive: true } },
      ]),
    );
    const batch = stageBatch();

    const contacts: ContactPerson[] = [
      { id: 'cc-a', name: 'Aaron', isPrimary: true },
      { id: 'cc-new', name: 'Newcomer', isPrimary: false },
    ];
    await mirrorEmbeddedContactsToCollection('cust-1', contacts);

    // Two upserts
    expect(batch.set).toHaveBeenCalledTimes(2);
    const setPayloads = batch.set.mock.calls.map(
      (c: unknown[]) => c[1] as Record<string, unknown>,
    );
    expect(setPayloads.every((p: Record<string, unknown>) => p.customerId === 'cust-1')).toBe(true);
    // Each set call carries `{ merge: true }`.
    expect(
      batch.set.mock.calls.every((c: unknown[]) =>
        (c[2] as Record<string, unknown>).merge === true,
      ),
    ).toBe(true);

    // One soft-delete of cc-gone
    expect(batch.update).toHaveBeenCalledTimes(1);
    const deletePayload = batch.update.mock.calls[0][1] as Record<string, unknown>;
    expect(deletePayload.isActive).toBe(false);

    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('skips rows already soft-deleted to avoid updatedAt churn', async () => {
    // cc-gone is already inactive — the mirror should leave it alone.
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'cc-a', data: { customerId: 'cust-1', isActive: true } },
        { id: 'cc-gone', data: { customerId: 'cust-1', isActive: false } },
      ]),
    );
    const batch = stageBatch();

    await mirrorEmbeddedContactsToCollection('cust-1', [
      { id: 'cc-a', name: 'Aaron', isPrimary: true },
    ]);

    expect(batch.update).not.toHaveBeenCalled();
    // Only the one upsert for cc-a should run.
    expect(batch.set).toHaveBeenCalledTimes(1);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('never commits an empty batch (empty incoming + no existing rows)', async () => {
    // No embedded contacts, no collection rows — the mirror should
    // short-circuit before committing an empty batch (Firestore
    // accepts empty commits but it's noise on the write path).
    getDocsMock.mockResolvedValueOnce(makeDocsSnap([]));
    const batch = stageBatch();

    await mirrorEmbeddedContactsToCollection('cust-1', []);

    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('soft-deletes every row when the embedded array is cleared', async () => {
    // "User removed every contact from the form" — the collection
    // must reflect that by soft-deleting each previously-active row.
    getDocsMock.mockResolvedValueOnce(
      makeDocsSnap([
        { id: 'cc-a', data: { customerId: 'cust-1', isActive: true } },
        { id: 'cc-b', data: { customerId: 'cust-1', isActive: true } },
      ]),
    );
    const batch = stageBatch();

    await mirrorEmbeddedContactsToCollection('cust-1', []);

    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
