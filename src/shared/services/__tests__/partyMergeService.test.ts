/**
 * Tests for the Party Merge Service.
 *
 * Covers:
 *   - validation (cross-kind, self-merge, missing source/target, already-merged)
 *   - dry-run (default) — plan built, no writes
 *   - apply — writes committed, audit recorded
 *   - party composite field is rewritten when present, NOT introduced
 *     on legacy rows
 *
 * Firestore SDK functions are mocked so the tests run standalone.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Firestore SDK mocks
// ---------------------------------------------------------------------------

const getDoc = vi.fn();
const getDocs = vi.fn();
const addDoc = vi.fn();
const batchUpdate = vi.fn();
const batchCommit = vi.fn().mockResolvedValue(undefined);
const writeBatch = vi.fn(() => ({ update: batchUpdate, commit: batchCommit }));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => ({ __kind: 'collection', name }),
  doc: (_db: unknown, name: string, id: string) => ({ __kind: 'doc', name, id }),
  getDoc: (...a: unknown[]) => getDoc(...a),
  getDocs: (...a: unknown[]) => getDocs(...a),
  addDoc: (...a: unknown[]) => addDoc(...a),
  writeBatch: () => writeBatch(),
  query: (..._a: unknown[]) => ({ __kind: 'query' }),
  where: (field: string, op: string, val: unknown) => ({ __kind: 'where', field, op, val }),
  serverTimestamp: () => ({ __kind: 'serverTimestamp' }),
}));

vi.mock('@/shared/services/firebase', () => ({ db: { __kind: 'db' } }));

import { mergeParty, previewMerge, PartyMergeError } from '../partyMergeService';
import type { PartyRef } from '@/shared/types/party';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function snap(exists: boolean, data: Record<string, unknown> = {}) {
  return { exists: () => exists, data: () => data };
}

function docsFor(rows: Array<{ id: string; data: Record<string, unknown> }>) {
  return { docs: rows.map((r) => ({ id: r.id, data: () => r.data })) };
}

const SOURCE: PartyRef = { partyId: 'src', partyKind: 'finishes_customer' };
const TARGET: PartyRef = { partyId: 'tgt', partyKind: 'finishes_customer' };

beforeEach(() => {
  vi.clearAllMocks();
  batchCommit.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('mergeParty — validation', () => {
  it('rejects cross-kind merges', async () => {
    await expect(
      mergeParty(SOURCE, { partyId: 'tgt', partyKind: 'advisory_client' }, { userId: 'u1' }),
    ).rejects.toThrow(PartyMergeError);
  });

  it('rejects self-merge', async () => {
    await expect(mergeParty(SOURCE, SOURCE, { userId: 'u1' })).rejects.toThrow(
      /into itself/,
    );
  });

  it('rejects when source does not exist', async () => {
    getDoc
      .mockResolvedValueOnce(snap(false))           // source missing
      .mockResolvedValueOnce(snap(true));           // target present
    await expect(mergeParty(SOURCE, TARGET, { userId: 'u1' })).rejects.toThrow(
      /Source .* does not exist/,
    );
  });

  it('rejects when target does not exist', async () => {
    getDoc
      .mockResolvedValueOnce(snap(true))
      .mockResolvedValueOnce(snap(false));
    await expect(mergeParty(SOURCE, TARGET, { userId: 'u1' })).rejects.toThrow(
      /Target .* does not exist/,
    );
  });

  it('rejects when source is already merged', async () => {
    getDoc
      .mockResolvedValueOnce(snap(true, { mergedInto: 'somewhere' }))
      .mockResolvedValueOnce(snap(true));
    await expect(mergeParty(SOURCE, TARGET, { userId: 'u1' })).rejects.toThrow(
      /already merged/,
    );
  });

  it('rejects when target is itself merged', async () => {
    getDoc
      .mockResolvedValueOnce(snap(true))
      .mockResolvedValueOnce(snap(true, { mergedInto: 'elsewhere' }));
    await expect(mergeParty(SOURCE, TARGET, { userId: 'u1' })).rejects.toThrow(
      /Target .* is itself merged/,
    );
  });
});

// ---------------------------------------------------------------------------
// Dry-run (default) — plan built, no writes
// ---------------------------------------------------------------------------

describe('mergeParty — dry-run (default)', () => {
  it('builds a plan without committing any writes', async () => {
    getDoc
      .mockResolvedValueOnce(snap(true))            // source
      .mockResolvedValueOnce(snap(true));           // target

    // Every collection scan — return some matches for a couple, empty for the rest.
    getDocs
      // crmDeals — one row, no `party` field (legacy)
      .mockResolvedValueOnce(docsFor([{ id: 'deal-1', data: { customerId: 'src' } }]))
      // crmActivities — one row WITH a `party` ref matching source
      .mockResolvedValueOnce(
        docsFor([{ id: 'act-1', data: { customerId: 'src', party: SOURCE } }]),
      )
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]));

    const res = await mergeParty(SOURCE, TARGET, { userId: 'u1' });

    expect(res.applied).toBe(false);
    expect(res.batchCount).toBe(0);
    expect(writeBatch).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();

    // Plan should cover the deal, the activity, and the source record itself.
    const byCol = res.plan.breakdown;
    expect(byCol.crmDeals).toBe(1);
    expect(byCol.crmActivities).toBe(1);
    expect(byCol.customers).toBe(1); // source record always last
    expect(res.plan.totalDocs).toBe(3);

    // Legacy row: only customerId rewritten.
    const deal = res.plan.items.find((i) => i.docId === 'deal-1')!;
    expect(deal.updates).toEqual({ customerId: 'tgt' });

    // P8-2 row: BOTH customerId and party rewritten.
    const act = res.plan.items.find((i) => i.docId === 'act-1')!;
    expect(act.updates).toEqual({
      customerId: 'tgt',
      party: { partyId: 'tgt', partyKind: 'finishes_customer' },
    });

    // Source record item carries placeholder sentinels pre-apply.
    const src = res.plan.items.find((i) => i.reason === 'source record')!;
    expect(src.collectionName).toBe('customers');
    expect(src.updates.mergedInto).toBe('tgt');
  });
});

// ---------------------------------------------------------------------------
// Apply — writes committed, audit recorded
// ---------------------------------------------------------------------------

describe('mergeParty — apply', () => {
  it('commits batches and writes an audit doc', async () => {
    getDoc.mockResolvedValueOnce(snap(true)).mockResolvedValueOnce(snap(true));

    // One row across all collections + source record = 2 writes total.
    getDocs
      .mockResolvedValueOnce(docsFor([{ id: 'deal-1', data: { customerId: 'src' } }]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]));

    addDoc.mockResolvedValueOnce({ id: 'audit-xyz' });

    const res = await mergeParty(SOURCE, TARGET, {
      userId: 'u1',
      apply: true,
      reason: 'Acme dedupe',
    });

    expect(res.applied).toBe(true);
    expect(res.auditId).toBe('audit-xyz');
    expect(res.batchCount).toBe(1);

    // Both items got an UPDATE in the batch.
    expect(batchUpdate).toHaveBeenCalledTimes(2);
    expect(batchCommit).toHaveBeenCalledTimes(1);

    // Source record write — mergedAt/mergedBy must be real sentinels, not placeholders.
    const sourceCall = batchUpdate.mock.calls.find(
      (c) => (c[0] as { name: string }).name === 'customers',
    )!;
    const sourceUpdates = sourceCall[1] as Record<string, unknown>;
    expect(sourceUpdates.mergedInto).toBe('tgt');
    expect(sourceUpdates.mergedBy).toBe('u1');
    expect(sourceUpdates.mergedAt).toEqual({ __kind: 'serverTimestamp' });

    // Rewritten pointer — stamps updatedAt/updatedBy.
    const dealCall = batchUpdate.mock.calls.find(
      (c) => (c[0] as { name: string }).name === 'crmDeals',
    )!;
    const dealUpdates = dealCall[1] as Record<string, unknown>;
    expect(dealUpdates.customerId).toBe('tgt');
    expect(dealUpdates.updatedBy).toBe('u1');

    // Audit doc captured the plan with the caller-supplied reason.
    const auditArgs = addDoc.mock.calls[0];
    const auditBody = auditArgs[1] as {
      reason: string;
      performedBy: string;
      totalDocs: number;
      items: Array<{ updates: Record<string, unknown> }>;
    };
    expect(auditBody.reason).toBe('Acme dedupe');
    expect(auditBody.performedBy).toBe('u1');
    expect(auditBody.totalDocs).toBe(2);
    // Placeholder sentinels stripped from audit payload.
    const auditSource = auditBody.items.find((i) => !('customerId' in i.updates))!;
    expect(auditSource.updates.mergedAt).toBeUndefined();
    expect(auditSource.updates.mergedBy).toBeUndefined();
    expect(auditSource.updates.mergedInto).toBe('tgt');
  });

  it('batches writes when the plan exceeds 450 ops', async () => {
    getDoc.mockResolvedValueOnce(snap(true)).mockResolvedValueOnce(snap(true));

    // 600 rows on crmDeals alone — should trigger 2 batches (450 + 151 inc. source).
    const big = Array.from({ length: 600 }, (_, i) => ({
      id: `deal-${i}`,
      data: { customerId: 'src' },
    }));
    getDocs
      .mockResolvedValueOnce(docsFor(big))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]));

    addDoc.mockResolvedValueOnce({ id: 'audit' });

    const res = await mergeParty(SOURCE, TARGET, { userId: 'u1', apply: true });

    expect(res.batchCount).toBe(2);
    expect(batchCommit).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// previewMerge
// ---------------------------------------------------------------------------

describe('previewMerge', () => {
  it('returns a plan without needing the source/target to exist', async () => {
    // previewMerge deliberately does NOT call getDoc on the source records —
    // it's intended as a cheap "what would happen" preview that can be
    // called from admin UIs before confirmation. The existence checks
    // run only in mergeParty.
    getDocs
      .mockResolvedValueOnce(docsFor([{ id: 'deal-1', data: { customerId: 'src' } }]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]))
      .mockResolvedValueOnce(docsFor([]));

    const plan = await previewMerge(SOURCE, TARGET);
    expect(plan.totalDocs).toBe(2);
    expect(plan.breakdown.crmDeals).toBe(1);
    expect(getDoc).not.toHaveBeenCalled();
  });
});
