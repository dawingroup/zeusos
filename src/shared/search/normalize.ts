/**
 * Text normalisation for interactive search — the ONE place a query and a
 * haystack are made comparable.
 *
 * Normalising BOTH sides the same way — fold accents, lower-case, collapse
 * every run of punctuation/whitespace to one space — and then requiring each
 * query token to appear somewhere means "okello jane" finds "Jane Okello",
 * "1/2" finds "1-2", and a stray trailing space still matches.
 *
 * Deterministic on purpose: no fuzzy distance, so what matches is explainable
 * and a near-miss never silently ranks above the thing the user typed.
 */

export type SearchFieldValue = string | number | null | undefined | ReadonlyArray<string | number | null | undefined>;

/** Lower-case, accent-folded, punctuation collapsed to single spaces, trimmed. */
export function normalizeSearchText(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The query's normalised tokens; `[]` for a blank query. */
export function tokenizeQuery(query: string): string[] {
  const q = normalizeSearchText(query);
  return q ? q.split(' ') : [];
}

/**
 * One lower-cased haystack from any mix of strings, numbers and arrays.
 * Falsy/null values are dropped; arrays (aliases, tags) are flattened.
 */
export function buildHaystack(fields: ReadonlyArray<SearchFieldValue>): string {
  const parts: string[] = [];
  for (const f of fields) {
    if (f == null) continue;
    if (Array.isArray(f)) {
      for (const v of f) if (v != null && v !== '') parts.push(String(v));
    } else if (f !== '') {
      parts.push(String(f));
    }
  }
  return parts.join(' ').toLowerCase();
}

/**
 * True when every token of `query` appears in `haystack` (both normalised).
 * A blank query matches everything.
 */
export function matchesAllTokens(haystack: string, query: string): boolean {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;
  const hay = ` ${normalizeSearchText(haystack)} `;
  for (const token of tokens) {
    if (!hay.includes(token)) return false;
  }
  return true;
}
