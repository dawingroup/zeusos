/**
 * Unit tests — Supplier directory service (Phase 4).
 *
 * Covers:
 *   - createSupplier required-field validation
 *   - Status transition guards (blacklist requires reason; deactivate
 *     blocked while BLACKLISTED)
 *   - update on missing supplier raises a useful error
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/firebase', () => ({ db: {} }));

// In-memory fake docs keyed by id
const store = new Map<string, Record<string, unknown>>();

vi.mock('firebase/firestore', () => {
  const makeRef = (path: string, id?: string) => ({
    __path: path,
    __id: id ?? `auto-${Math.random().toString(36).slice(2, 8)}`,
  });

  return {
    collection: vi.fn((_db: unknown, path: string) => ({ __path: path })),
    // doc(db, path, id) — 3-arg form used for direct id lookups
    // doc(colRef)       — 1-arg form used to mint a new auto-id
    doc: vi.fn((...args: unknown[]) => {
      if (args.length >= 3) {
        // doc(db, path, id)
        return makeRef(args[1] as string, args[2] as string);
      }
      // doc(colRef)
      const parent = args[0] as { __path: string };
      return makeRef(parent.__path);
    }),
    addDoc: vi.fn(async (col: { __path: string }, data: Record<string, unknown>) => {
      const ref = makeRef(col.__path);
      store.set(ref.__id, { ...data });
      return ref;
    }),
    getDoc: vi.fn(async (ref: { __id: string }) => {
      const data = store.get(ref.__id);
      return {
        exists: () => data !== undefined,
        id: ref.__id,
        data: () => (data ? { ...data } : undefined),
      };
    }),
    getDocs: vi.fn(async () => ({
      docs: Array.from(store.entries()).map(([id, data]) => ({
        id,
        data: () => ({ ...data }),
      })),
    })),
    updateDoc: vi.fn(async (ref: { __id: string }, patch: Record<string, unknown>) => {
      const existing = store.get(ref.__id);
      if (!existing) throw new Error('not found');
      store.set(ref.__id, { ...existing, ...patch });
    }),
    query: vi.fn((col: unknown) => col),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => '__SERVER_TS__'),
  };
});

import {
  createSupplier,
  getSupplier,
  blacklistSupplier,
  deactivateSupplier,
  activateSupplier,
  updateSupplier,
} from '../services/supplier.service';

beforeEach(() => {
  store.clear();
});

describe('createSupplier', () => {
  it('creates a supplier with status=ACTIVE by default', async () => {
    const created = await createSupplier({
      name: 'Next Media Services Ltd',
      kind: 'MEDIA_HOUSE',
      currency: 'UGX',
      paymentTerms: 'NET_30',
      createdBy: 'user-1',
    });
    expect(created.status).toBe('ACTIVE');
    expect(created.name).toBe('Next Media Services Ltd');
  });

  it('trims whitespace from the name', async () => {
    const created = await createSupplier({
      name: '   Sanyu FM   ',
      kind: 'MEDIA_HOUSE',
      currency: 'UGX',
      paymentTerms: 'NET_30',
      createdBy: 'user-1',
    });
    expect(created.name).toBe('Sanyu FM');
  });

  it('rejects missing name', async () => {
    await expect(
      createSupplier({
        name: '   ',
        kind: 'MEDIA_HOUSE',
        currency: 'UGX',
        paymentTerms: 'NET_30',
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(/name is required/);
  });

  it('rejects missing kind', async () => {
    await expect(
      // @ts-expect-error — intentionally missing kind
      createSupplier({
        name: 'X',
        currency: 'UGX',
        paymentTerms: 'NET_30',
        createdBy: 'user-1',
      }),
    ).rejects.toThrow(/kind is required/);
  });
});

describe('status transitions', () => {
  it('blacklistSupplier requires a non-empty reason', async () => {
    const s = await createSupplier({
      name: 'Bad Vendor',
      kind: 'VENDOR_OTHER',
      currency: 'UGX',
      paymentTerms: 'ON_RECEIPT',
      createdBy: 'user-1',
    });
    await expect(blacklistSupplier(s.id, 'user-1', '')).rejects.toThrow(/reason is required/);
    await expect(blacklistSupplier(s.id, 'user-1', '   ')).rejects.toThrow(/reason is required/);
  });

  it('blacklistSupplier sets BLACKLISTED + blacklistReason', async () => {
    const s = await createSupplier({
      name: 'Bad Vendor',
      kind: 'VENDOR_OTHER',
      currency: 'UGX',
      paymentTerms: 'ON_RECEIPT',
      createdBy: 'user-1',
    });
    await blacklistSupplier(s.id, 'user-1', 'Repeated late delivery');
    const after = await getSupplier(s.id);
    expect(after?.status).toBe('BLACKLISTED');
    expect(after?.blacklistReason).toBe('Repeated late delivery');
    expect(after?.blacklistedBy).toBe('user-1');
  });

  it('deactivateSupplier is blocked when status is BLACKLISTED', async () => {
    const s = await createSupplier({
      name: 'Bad Vendor',
      kind: 'VENDOR_OTHER',
      currency: 'UGX',
      paymentTerms: 'ON_RECEIPT',
      createdBy: 'user-1',
    });
    await blacklistSupplier(s.id, 'user-1', 'Compliance');
    await expect(deactivateSupplier(s.id)).rejects.toThrow(/BLACKLISTED.*cannot be deactivated/);
  });

  it('activateSupplier clears blacklist metadata when lifting a blacklist', async () => {
    const s = await createSupplier({
      name: 'Vendor X',
      kind: 'MEDIA_HOUSE',
      currency: 'UGX',
      paymentTerms: 'NET_30',
      createdBy: 'user-1',
    });
    await blacklistSupplier(s.id, 'user-1', 'Compliance');
    await activateSupplier(s.id);
    const after = await getSupplier(s.id);
    expect(after?.status).toBe('ACTIVE');
    expect(after?.blacklistedAt).toBeNull();
    expect(after?.blacklistReason).toBeNull();
  });

  it('updateSupplier raises a useful error for unknown id', async () => {
    await expect(updateSupplier('does-not-exist', { name: 'X' })).rejects.toThrow(/not found/);
  });
});
