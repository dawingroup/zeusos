/**
 * Ranking — combines Fuse.js distance with custom boosts to produce a
 * single comparable score per hit. Pure functions only; no side effects,
 * no I/O. Easy to unit-test in isolation.
 */

import type { IndexedRecord, SearchHit } from './types';
import type { RecentItem } from '@/integration/types';

export interface RankingContext {
  /** Recently-opened records, used for the recency boost. */
  recentItems: ReadonlyArray<RecentItem>;
  /** Optional active module — small boost when a hit's module matches. */
  activeModule?: string;
  /** The raw query text — used for exact-match and prefix detection. */
  query: string;
}

/** Recency boost decays linearly to zero over RECENCY_MAX_BOOST hours. */
const RECENCY_MAX_BOOST = 30;
const TYPE_PRIORITY_BOOST = 5;
const EXACT_MATCH_BOOST = 50;
const PREFIX_MATCH_BOOST = 20;
const NUMERIC_ID_BOOST = 40;

const NUMERIC_PATTERN = /^\d{2,}$/;
/** Matches identifiers like "SO-1042", "MO 17", "PO12". */
const ID_PATTERN = /^[A-Za-z]{2,4}[-\s]?\d+$/;

const ID_FIELDS = ['orderNumber', 'sku', 'code', 'dealNumber', 'moNumber', 'poNumber', 'projectCode', 'employeeId'] as const;

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function exactOrPrefixBoost(record: IndexedRecord, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const candidates: string[] = [
    record.title,
    record.subtitle ?? '',
    ...ID_FIELDS.map((f) => asString(record.data[f])),
  ];

  let boost = 0;
  for (const candidate of candidates) {
    if (!candidate) continue;
    const c = candidate.toLowerCase();
    if (c === q) {
      boost = Math.max(boost, EXACT_MATCH_BOOST);
    } else if (c.startsWith(q)) {
      boost = Math.max(boost, PREFIX_MATCH_BOOST);
    }
  }
  return boost;
}

function numericIdBoost(record: IndexedRecord, query: string): number {
  const q = query.trim();
  if (!q) return 0;

  // Trigger only when the query LOOKS like an identifier, so casual word
  // searches don't all get a free +40.
  const looksLikeId = NUMERIC_PATTERN.test(q) || ID_PATTERN.test(q);
  if (!looksLikeId) return 0;

  const normalized = q.replace(/[\s-]/g, '').toLowerCase();
  for (const field of ID_FIELDS) {
    const v = asString(record.data[field]).replace(/[\s-]/g, '').toLowerCase();
    if (v && v.includes(normalized)) return NUMERIC_ID_BOOST;
  }

  // Also check title — many entities use the ID as the display title (e.g. SO-1042).
  const titleNorm = record.title.replace(/[\s-]/g, '').toLowerCase();
  if (titleNorm && titleNorm.includes(normalized)) return NUMERIC_ID_BOOST;

  return 0;
}

function recencyBoost(record: IndexedRecord, recentItems: ReadonlyArray<RecentItem>, now = Date.now()): number {
  const match = recentItems.find((r) => r.type === record.type && r.id === record.id);
  if (!match) return 0;
  const ts = match.timestamp instanceof Date ? match.timestamp.getTime() : new Date(match.timestamp).getTime();
  if (!Number.isFinite(ts)) return 0;
  const hoursSince = (now - ts) / (1000 * 60 * 60);
  return Math.max(0, RECENCY_MAX_BOOST - hoursSince);
}

function typePriorityBoost(record: IndexedRecord, activeModule?: string): number {
  if (!activeModule) return 0;
  return record.module === activeModule ? TYPE_PRIORITY_BOOST : 0;
}

/**
 * Combine Fuse's raw distance score with custom boosts.
 *
 * Fuse score is a distance: 0 = perfect match, 1 = no match.
 * We invert and scale to 0..100, then add boosts.
 */
export function combineScore(
  fuseScore: number | undefined,
  record: IndexedRecord,
  ctx: RankingContext,
  now = Date.now(),
): number {
  const distance = typeof fuseScore === 'number' ? fuseScore : 0.5;
  const baseScore = (1 - Math.min(1, Math.max(0, distance))) * 100;

  return (
    baseScore +
    exactOrPrefixBoost(record, ctx.query) +
    numericIdBoost(record, ctx.query) +
    recencyBoost(record, ctx.recentItems, now) +
    typePriorityBoost(record, ctx.activeModule)
  );
}

/**
 * Sort hits descending by score. Tie-break by updatedAt, then createdAt,
 * then doc id (stable, deterministic).
 */
export function sortHits(hits: SearchHit[]): SearchHit[] {
  return [...hits].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const au = a.record.updatedAt ?? a.record.createdAt ?? 0;
    const bu = b.record.updatedAt ?? b.record.createdAt ?? 0;
    if (bu !== au) return bu - au;
    return a.record.id.localeCompare(b.record.id);
  });
}

// ---- Internal exports for unit testing only ----
export const __internal = {
  exactOrPrefixBoost,
  numericIdBoost,
  recencyBoost,
  typePriorityBoost,
  RECENCY_MAX_BOOST,
  EXACT_MATCH_BOOST,
  PREFIX_MATCH_BOOST,
  NUMERIC_ID_BOOST,
  TYPE_PRIORITY_BOOST,
};
