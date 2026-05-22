/**
 * Unit tests — Journal Entry service (Phase 4.1 procurement viewer).
 *
 * Covers:
 *   - isBalanced helper (sum(debits) === sum(credits))
 *   - listJournalEntries orgId guard
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/shared/services/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc:        vi.fn(),
  getDoc:     vi.fn(),
  getDocs:    vi.fn(),
  query:      vi.fn(),
  where:      vi.fn(),
  orderBy:    vi.fn(),
  limit:      vi.fn(),
}));

import { isBalanced, listJournalEntries } from '../services/journal-entry.service';
import type { JournalEntry } from '../types/journal-entry.types';

function makeJE(
  debits: Array<{ accountCode: string; amount: number }>,
  credits: Array<{ accountCode: string; amount: number }>,
): JournalEntry {
  return {
    id: 'je_test_001',
    kind: 'TALENT_FREELANCER',
    sourceDocId: 'po_talent_inv001',
    sourceDocKind: 'PurchaseOrderRaised',
    currency: 'UGX',
    debits: debits.map((d) => ({
      accountCode: d.accountCode,
      accountName: 'Test',
      amountMinor: d.amount,
      description: 'Test line',
    })),
    credits: credits.map((c) => ({
      accountCode: c.accountCode,
      accountName: 'Test',
      amountMinor: c.amount,
      description: 'Test line',
    })),
    postedAt: '2026-05-23T00:00:00Z',
    orgId: 'org-default',
    createdAt: '2026-05-23T00:00:00Z',
    updatedAt: '2026-05-23T00:00:00Z',
  };
}

describe('isBalanced', () => {
  it('returns true when single debit equals single credit', () => {
    const je = makeJE(
      [{ accountCode: '5010', amount: 1000_00 }],
      [{ accountCode: '2050', amount: 1000_00 }],
    );
    expect(isBalanced(je)).toBe(true);
  });

  it('returns false when debit and credit differ', () => {
    const je = makeJE(
      [{ accountCode: '5010', amount: 1000_00 }],
      [{ accountCode: '2050', amount: 999_00 }],
    );
    expect(isBalanced(je)).toBe(false);
  });

  it('balances multi-line debits against multi-line credits', () => {
    const je = makeJE(
      [
        { accountCode: '5010', amount: 600_00 },
        { accountCode: '5020', amount: 400_00 },
      ],
      [{ accountCode: '2050', amount: 1000_00 }],
    );
    expect(isBalanced(je)).toBe(true);
  });

  it('returns false on zero-line entries (degenerate but possible)', () => {
    const je = makeJE(
      [{ accountCode: '5010', amount: 100_00 }],
      [],
    );
    expect(isBalanced(je)).toBe(false);
  });

  it('handles large UGX values without precision loss', () => {
    // 1 billion UGX in minor units
    const big = 1_000_000_000_00;
    const je = makeJE(
      [{ accountCode: '5010', amount: big }],
      [{ accountCode: '2050', amount: big }],
    );
    expect(isBalanced(je)).toBe(true);
  });
});

describe('listJournalEntries orgId guard', () => {
  it('throws when orgId is missing (spec §7.4 commercial gravity)', async () => {
    await expect(listJournalEntries({ orgId: '' })).rejects.toThrow(
      /orgId filter is required/,
    );
  });
});
