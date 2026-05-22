/**
 * GL adapter pure-function tests.
 *
 * Covers `buildICJournalEntries` — the part of the GL adapter that has
 * no Firestore I/O. The Firestore-backed `firestoreAuditGLAdapter` is
 * exercised end-to-end by the lifecycle test that lands with Phase 3.B.
 */

import { describe, expect, it } from 'vitest';
import { buildICJournalEntries } from '../gl-adapter.service';

describe('buildICJournalEntries', () => {
  it('produces two balanced legs (subsidiary + parent)', () => {
    const [sub, parent] = buildICJournalEntries({
      invoiceId: 'inv-1',
      fromOrgId: 'zeus-the-agency',
      toOrgId: 'zeus-group',
      amountMinor: 1_000_000,
      currency: 'UGX',
      memo: 'IC settlement — IWO test',
    });

    expect(sub.entityOrgId).toBe('zeus-the-agency');
    expect(parent.entityOrgId).toBe('zeus-group');

    for (const entry of [sub, parent]) {
      const debits = entry.lines.reduce((s, l) => s + (l.debitMinor ?? 0), 0);
      const credits = entry.lines.reduce((s, l) => s + (l.creditMinor ?? 0), 0);
      expect(debits).toBe(credits);
      expect(debits).toBe(1_000_000);
    }
  });

  it('uses distinct idempotency keys per leg', () => {
    const [sub, parent] = buildICJournalEntries({
      invoiceId: 'inv-9',
      fromOrgId: 'labyrinth',
      toOrgId: 'zeus-group',
      amountMinor: 500_000,
      currency: 'UGX',
      memo: 'IC test',
    });
    expect(sub.idempotencyKey).not.toBe(parent.idempotencyKey);
    expect(sub.idempotencyKey).toContain('inv-9');
    expect(parent.idempotencyKey).toContain('inv-9');
  });

  it('subsidiary leg debits AR + credits Revenue', () => {
    const [sub] = buildICJournalEntries({
      invoiceId: 'inv-2',
      fromOrgId: 'zeus-the-agency',
      toOrgId: 'zeus-group',
      amountMinor: 1_000_000,
      currency: 'UGX',
      memo: '',
    });
    expect(sub.lines).toHaveLength(2);
    expect(sub.lines[0].accountCode).toBe('1200');
    expect(sub.lines[0].debitMinor).toBe(1_000_000);
    expect(sub.lines[1].accountCode).toBe('4000');
    expect(sub.lines[1].creditMinor).toBe(1_000_000);
  });

  it('parent leg debits Cost + credits AP', () => {
    const [, parent] = buildICJournalEntries({
      invoiceId: 'inv-3',
      fromOrgId: 'zeus-the-agency',
      toOrgId: 'zeus-group',
      amountMinor: 1_000_000,
      currency: 'UGX',
      memo: '',
    });
    expect(parent.lines[0].accountCode).toBe('5000');
    expect(parent.lines[0].debitMinor).toBe(1_000_000);
    expect(parent.lines[1].accountCode).toBe('2000');
    expect(parent.lines[1].creditMinor).toBe(1_000_000);
  });
});
