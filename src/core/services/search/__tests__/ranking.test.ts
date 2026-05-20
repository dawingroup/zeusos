import { describe, it, expect } from 'vitest';
import { combineScore, sortHits, __internal } from '../ranking';
import type { IndexedRecord, SearchHit } from '../types';
import type { RecentItem } from '@/integration/types';

function rec(overrides: Partial<IndexedRecord> = {}): IndexedRecord {
  return {
    id: 'id1',
    type: 'customer',
    module: 'crm',
    subsidiaryId: 'dawin-finishes',
    path: '/customers/id1',
    icon: 'Users',
    cardKind: 'customer',
    title: 'Acme Co',
    subtitle: 'ACME-001',
    data: { code: 'ACME-001', email: 'hi@acme.com', phone: '+256700123456' },
    ...overrides,
  };
}

describe('combineScore', () => {
  it('inverts Fuse distance into a 0..100 base score', () => {
    const ctx = { recentItems: [], query: 'acme' };
    const perfect = combineScore(0, rec(), ctx);
    const noMatch = combineScore(1, rec({ title: 'Zeta Inc' }), ctx);
    expect(perfect).toBeGreaterThan(noMatch);
  });

  it('boosts exact-match titles by EXACT_MATCH_BOOST', () => {
    const ctx = { recentItems: [], query: 'acme co' };
    const score = combineScore(0.2, rec({ title: 'Acme Co' }), ctx);
    expect(score).toBeGreaterThanOrEqual(80 + __internal.EXACT_MATCH_BOOST - 1);
  });

  it('boosts prefix matches by PREFIX_MATCH_BOOST', () => {
    const ctx = { recentItems: [], query: 'acme' };
    const score = combineScore(0.3, rec({ title: 'Acme Manufacturing' }), ctx);
    expect(score).toBeGreaterThan(70 + __internal.PREFIX_MATCH_BOOST - 1);
  });

  it('boosts numeric-id matches when query looks like an identifier', () => {
    const r = rec({ type: 'sales_order', title: 'SO-1042', data: { orderNumber: 'SO-1042', customerName: 'Acme' } });
    const ctx = { recentItems: [], query: 'SO-1042' };
    const score = combineScore(0.5, r, ctx);
    expect(score).toBeGreaterThan(__internal.NUMERIC_ID_BOOST);
  });

  it('does NOT add numeric-id boost for plain word queries', () => {
    const r = rec({ data: { code: 'ACME-1', email: 'hi@acme.com' } });
    const ctx = { recentItems: [], query: 'acme' };
    const withBoost = combineScore(0.3, r, ctx);
    const ctx2 = { recentItems: [], query: 'ACME-1' };
    const withId = combineScore(0.3, r, ctx2);
    expect(withId).toBeGreaterThan(withBoost);
  });

  it('boosts records the user opened recently and decays over 30h', () => {
    const now = new Date('2026-04-22T12:00:00Z').getTime();
    const recent: RecentItem[] = [
      { type: 'customer', id: 'id1', title: 'Acme Co', module: 'crm' as any, path: '/customers/id1', timestamp: new Date(now - 60 * 60 * 1000) }, // 1h ago
      { type: 'customer', id: 'id2', title: 'Old Co',  module: 'crm' as any, path: '/customers/id2', timestamp: new Date(now - 50 * 60 * 60 * 1000) }, // 50h ago
    ];
    const fresh = combineScore(0.5, rec({ id: 'id1' }), { recentItems: recent, query: 'acme' }, now);
    const stale = combineScore(0.5, rec({ id: 'id2', title: 'Old Co' }), { recentItems: recent, query: 'acme' }, now);
    expect(fresh).toBeGreaterThan(stale);
  });

  it('adds typePriorityBoost when the active module matches', () => {
    const ctx = { recentItems: [], query: 'acme', activeModule: 'crm' };
    const matching = combineScore(0.5, rec({ module: 'crm' }), ctx);
    const offModule = combineScore(0.5, rec({ module: 'inventory' }), ctx);
    expect(matching - offModule).toBe(__internal.TYPE_PRIORITY_BOOST);
  });
});

describe('sortHits', () => {
  it('sorts hits by score descending then by updatedAt desc', () => {
    const hits: SearchHit[] = [
      { record: rec({ id: 'a', updatedAt: 100 }), score: 50 },
      { record: rec({ id: 'b', updatedAt: 200 }), score: 80 },
      { record: rec({ id: 'c', updatedAt: 200 }), score: 80 },
    ];
    const sorted = sortHits(hits);
    expect(sorted.map((h) => h.record.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties by id when updatedAt is missing', () => {
    const hits: SearchHit[] = [
      { record: rec({ id: 'b' }), score: 50 },
      { record: rec({ id: 'a' }), score: 50 },
    ];
    expect(sortHits(hits).map((h) => h.record.id)).toEqual(['a', 'b']);
  });
});
