import { describe, it, expect } from 'vitest';
import { rankSearchResults, normalizeSearchText, matchesAllTokens } from '..';

const rows = [
  { name: 'Jane Okello', email: 'jane@zeustheagency.com', code: 'emp-jane' },
  { name: 'Okello Mart', email: 'mart@example.com', code: 'sup-01' },
  { name: 'Amos Byaruhanga', email: 'amos@zeustheagency.com', code: 'emp-amos' },
  { name: 'Zoë Nájera', email: null, code: undefined },
];
const opts = { primary: (r: (typeof rows)[number]) => r.name, fields: (r: (typeof rows)[number]) => [r.email, r.code] };

describe('normalizeSearchText', () => {
  it('folds accents, case and punctuation', () => {
    expect(normalizeSearchText(' Zoë  Nájera! ')).toBe('zoe najera');
    expect(normalizeSearchText('1/2')).toBe('1 2');
    expect(normalizeSearchText(null)).toBe('');
  });
});

describe('rankSearchResults', () => {
  it('ranks a prefix match above a contains match', () => {
    expect(rankSearchResults(rows, 'okello', opts).map((r) => r.name)).toEqual(['Okello Mart', 'Jane Okello']);
  });
  it('matches every token in any order across words', () => {
    expect(rankSearchResults(rows, 'okello jane', opts).map((r) => r.name)).toEqual(['Jane Okello']);
  });
  it('finds a row by a secondary field and survives null fields', () => {
    expect(rankSearchResults(rows, 'emp-amos', opts).map((r) => r.name)).toEqual(['Amos Byaruhanga']);
    expect(rankSearchResults(rows, 'najera', opts).map((r) => r.name)).toEqual(['Zoë Nájera']);
  });
  it('a blank query returns the rows in order, capped', () => {
    expect(rankSearchResults(rows, '  ', { ...opts, limit: 2 })).toHaveLength(2);
  });
  it('matchesAllTokens requires every token', () => {
    expect(matchesAllTokens('Jane Okello jane@zeustheagency.com', 'jane okello')).toBe(true);
    expect(matchesAllTokens('Jane Okello', 'jane amos')).toBe(false);
  });
});
