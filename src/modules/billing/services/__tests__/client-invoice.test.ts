/**
 * Spec edge-case tests for generateClientInvoice — §11.6 + §11.7.
 *
 * Mocks fx-rate.service.ts to return canned conversion rates and the
 * firebase/firestore SDK to a minimal in-memory store. The actual
 * client-invoice.service.ts code under test is unmodified.
 *
 *   §11.6 — Currency mismatch across entities
 *     IWO + IC invoice in subsidiary currency; single conversion at
 *     client-invoice consolidation step; FX exposure at parent.
 *
 *   §11.7 — Duplicate client invoice
 *     UNIQUE (master_job_id, status) + idempotency keys; retries return
 *     the existing invoice.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────
// In-memory Firestore fake
// ─────────────────────────────────────────────────────────────────

interface FakeStore {
  docs: Map<string, Record<string, unknown>>;
  nextAutoId: number;
}

const store: FakeStore = { docs: new Map(), nextAutoId: 0 };

function resetStore() {
  store.docs.clear();
  store.nextAutoId = 0;
}

function pathOf(refOrSegments: unknown): string {
  if (typeof refOrSegments === 'string') return refOrSegments;
  if (refOrSegments && typeof refOrSegments === 'object' && '__path' in refOrSegments) {
    return (refOrSegments as { __path: string }).__path;
  }
  throw new Error('Cannot derive path from unknown ref');
}

vi.mock('firebase/firestore', () => {
  const collection = (_db: unknown, name: string) => ({
    __kind: 'collection',
    name,
    // doc(collectionRef) returns a doc with an auto id.
  });
  const doc = (...args: unknown[]) => {
    // doc(db, collectionName, docId) OR doc(collectionRef)
    if (args.length === 1 && args[0] && typeof args[0] === 'object' && (args[0] as Record<string, unknown>).__kind === 'collection') {
      const col = args[0] as { name: string };
      const id = `auto_${++store.nextAutoId}`;
      return { __kind: 'doc', __path: `${col.name}/${id}`, __id: id, id };
    }
    const [, name, id] = args as [unknown, string, string];
    return { __kind: 'doc', __path: `${name}/${id}`, __id: id, id };
  };
  const serverTimestamp = () => ({ __kind: 'serverTimestamp' });
  const collectionFn = (db: unknown, name: string) => collection(db, name);
  const runTransaction = async (_db: unknown, fn: (txn: unknown) => unknown) => {
    const txn = {
      get: async (ref: unknown) => {
        const path = pathOf(ref);
        const data = store.docs.get(path);
        return {
          id: (ref as { __id: string }).__id,
          exists: () => data !== undefined,
          data: () => data,
        };
      },
      set: (ref: unknown, value: Record<string, unknown>) => {
        store.docs.set(pathOf(ref), { ...value });
      },
    };
    return await fn(txn);
  };
  // Stubs for read paths we don't exercise but are imported.
  const getDoc = vi.fn();
  const getDocs = vi.fn();
  const query = vi.fn();
  const where = vi.fn();
  const addDoc = vi.fn();
  const updateDoc = vi.fn();
  const setDoc = vi.fn();
  return {
    collection: collectionFn,
    doc,
    runTransaction,
    serverTimestamp,
    getDoc,
    getDocs,
    query,
    where,
    addDoc,
    updateDoc,
    setDoc,
  };
});

vi.mock('@/shared/services/firebase', () => ({ db: { __kind: 'db' } }));

// Mock the FX rate service. Each test sets the table; line conversions
// look up `${from}->${to}` and use 1.0 if same currency.
const fxTable: Record<string, number> = {};
vi.mock('../fx-rate.service', async () => {
  const actual = await vi.importActual<typeof import('../fx-rate.service')>('../fx-rate.service');
  return {
    ...actual,
    getEffectiveRate: vi.fn(async (from: string, to: string, opts: { effectiveDate?: string } = {}) => {
      if (from === to) return { from, to, rate: 1, effectiveDate: opts.effectiveDate ?? '2026-05-22', source: 'manual' };
      const rate = fxTable[`${from}->${to}`];
      if (rate === undefined) throw new Error(`Test setup missing FX rate ${from}->${to}`);
      return { from, to, rate, effectiveDate: opts.effectiveDate ?? '2026-05-22', source: 'manual' };
    }),
  };
});

import {
  generateClientInvoice,
  type GenerateClientInvoiceInput,
} from '../client-invoice.service';

beforeEach(() => {
  resetStore();
  for (const k of Object.keys(fxTable)) delete fxTable[k];
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────
// §11.6 — multi-currency consolidation
// ─────────────────────────────────────────────────────────────────

describe('§11.6 — currency mismatch across entities', () => {
  it('consolidates UGX + KES lines into a USD client invoice using the consolidation-date FX', async () => {
    fxTable['UGX->USD'] = 1 / 3700; // 1 USD = 3700 UGX
    fxTable['KES->USD'] = 1 / 129;  // 1 USD = 129 KES (approx)

    const input: GenerateClientInvoiceInput = {
      masterJobId: 'mj-1',
      clientId: 'client-1',
      clientCurrency: 'USD',
      consolidationDate: '2026-05-22',
      createdBy: 'user-1',
      lines: [
        {
          id: 'l-ug',
          description: 'Strategy workshop (UG)',
          sourceAmountMinor: 37_000_000_00, // UGX 37M = USD 10,000 (= 1,000,000 minor)
          sourceCurrency: 'UGX',
          costMinor: 18_500_000_00,
          sourceSubsidiaryId: 'zeus-the-agency',
        },
        {
          id: 'l-ke',
          description: 'PR campaign (KE)',
          sourceAmountMinor: 645_000_00, // KES 645,000 ≈ USD 5,000 (= 500,000 minor)
          sourceCurrency: 'KES',
          costMinor: 322_500_00,
          sourceSubsidiaryId: 'zeus-digital',
        },
      ],
    };

    const invoice = await generateClientInvoice(input);

    expect(invoice.total.currency).toBe('USD');
    // UGX 37M × (1/3700) = USD 10,000.00 = 1,000,000 minor (USD has 2 decimals).
    // 37_000_000_00 × 1/3700 = 1_000_000 minor.
    expect(invoice.lines[0].amountMinor).toBe(1_000_000);
    // KES 645,000 × (1/129) ≈ 5,000.00 USD ≈ 500_000 minor.
    expect(invoice.lines[1].amountMinor).toBe(500_000);
    expect(invoice.total.amountMinor).toBe(1_500_000);
    // FX rates captured for audit.
    expect(invoice.fxConsolidation?.effectiveDate).toBe('2026-05-22');
    expect(invoice.fxConsolidation?.rates).toMatchObject({
      UGX: 1 / 3700,
      KES: 1 / 129,
    });
  });

  it('same-source-currency lines skip conversion (rate 1.0)', async () => {
    const input: GenerateClientInvoiceInput = {
      masterJobId: 'mj-1',
      clientId: 'client-1',
      clientCurrency: 'UGX',
      createdBy: 'user-1',
      lines: [
        {
          id: 'l-1',
          description: 'Strategy',
          sourceAmountMinor: 5_000_000_00,
          sourceCurrency: 'UGX',
          costMinor: 3_000_000_00,
          sourceSubsidiaryId: 'zeus-the-agency',
        },
      ],
    };
    const invoice = await generateClientInvoice(input);
    expect(invoice.lines[0].amountMinor).toBe(5_000_000_00);
    expect(invoice.total.amountMinor).toBe(5_000_000_00);
    expect(invoice.fxConsolidation?.rates).toMatchObject({ UGX: 1 });
  });
});

// ─────────────────────────────────────────────────────────────────
// §11.7 — duplicate invoice retry returns same ID
// ─────────────────────────────────────────────────────────────────

describe('§11.7 — duplicate client invoice', () => {
  function baseInput(): GenerateClientInvoiceInput {
    return {
      masterJobId: 'mj-DUP',
      clientId: 'client-1',
      clientCurrency: 'UGX',
      createdBy: 'user-1',
      idempotencyKey: 'key-A',
      lines: [
        {
          id: 'l-1',
          description: 'Strategy',
          sourceAmountMinor: 1_000_000,
          sourceCurrency: 'UGX',
          costMinor: 600_000,
          sourceSubsidiaryId: 'zeus-the-agency',
        },
      ],
    };
  }

  it('retry with same idempotencyKey returns the existing invoice id, not a new one', async () => {
    const first = await generateClientInvoice(baseInput());
    expect(first.id).toMatch(/auto_/);

    const guardDoc = store.docs.get('client_invoices/mj-DUP:active');
    expect(guardDoc).toBeDefined();
    expect(guardDoc).toMatchObject({ invoiceId: first.id, masterJobId: 'mj-DUP' });

    // Retry with the SAME idempotency key.
    const retry = await generateClientInvoice(baseInput());
    expect(retry.id).toBe(first.id);

    // The store now has the guard doc + exactly ONE invoice doc.
    const invoiceDocs = [...store.docs.keys()].filter(
      (k) => k.startsWith('client_invoices/') && !k.endsWith(':active'),
    );
    expect(invoiceDocs).toHaveLength(1);
  });

  it('second call WITHOUT an idempotency key against the same master_job throws', async () => {
    await generateClientInvoice(baseInput());

    const conflicting: GenerateClientInvoiceInput = {
      ...baseInput(),
      idempotencyKey: undefined,
    };
    await expect(generateClientInvoice(conflicting)).rejects.toThrow(
      /Active client invoice already exists/,
    );
  });
});
