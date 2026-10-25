/**
 * Rank rows against a query for a picker list.
 *
 * Filter: every query token must appear somewhere in the row's searchable
 * fields (see normalize.ts). Rank, best first:
 *   0  the primary text IS the query
 *   1  the primary text starts with the query
 *   2  the primary text contains the query
 *   3  every token starts a word of the primary text ("ok ja" → "Jane Okello")
 *   4  the tokens are found only across the other fields (code, email, alias…)
 * Rows in the same tier keep their incoming order. Null/undefined fields are
 * skipped — a record missing a field must never take the whole list down.
 */
import { buildHaystack, normalizeSearchText, tokenizeQuery, type SearchFieldValue } from './normalize';

export interface RankSearchOptions<T> {
  /** The text a row is known by — what the list prints first. Drives tiers 0–3. */
  primary: (row: T) => SearchFieldValue;
  /** Everything else worth matching on (code, email, phone, aliases…). Defaults to primary only. */
  fields?: (row: T) => ReadonlyArray<SearchFieldValue>;
  /** Cap on returned rows. Default 50. `Infinity` for no cap. */
  limit?: number;
}

export type SearchTier = 0 | 1 | 2 | 3 | 4;

/** The tier a row falls in for a query, or `null` when it does not match. */
export function searchTier(primary: string, haystack: string, tokens: readonly string[], normalizedQuery: string): SearchTier | null {
  if (tokens.length === 0) return 4;
  const hay = ` ${haystack} `;
  for (const t of tokens) if (!hay.includes(t)) return null;
  const p = primary;
  if (!p) return 4;
  if (p === normalizedQuery) return 0;
  if (p.startsWith(normalizedQuery)) return 1;
  if (p.includes(normalizedQuery)) return 2;
  const padded = ` ${p}`;
  if (tokens.every((t) => padded.includes(` ${t}`))) return 3;
  return 4;
}

export function rankSearchResults<T>(rows: ReadonlyArray<T>, query: string, options: RankSearchOptions<T>): T[] {
  const limit = options.limit ?? 50;
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return rows.slice(0, limit);
  const normalizedQuery = tokens.join(' ');
  const fields = options.fields ?? ((row: T) => [options.primary(row)]);

  const tiers: T[][] = [[], [], [], [], []];
  for (const row of rows) {
    const primary = normalizeSearchText(options.primary(row));
    const haystack = normalizeSearchText(buildHaystack([options.primary(row), ...fields(row)]));
    const tier = searchTier(primary, haystack, tokens, normalizedQuery);
    if (tier === null) continue;
    tiers[tier].push(row);
  }
  const out: T[] = [];
  for (const tier of tiers) {
    for (const row of tier) {
      if (out.length >= limit) return out;
      out.push(row);
    }
  }
  return out;
}
