/**
 * Memos (DawinOS stream G port): the register reaches every org kind without
 * disturbing the subsidiary head's first four or the per-brand middle.
 */
import { describe, expect, it } from 'vitest';
import { resolveNav } from '../manifest';

const ids = (kind: Parameters<typeof resolveNav>[0], sub: Parameters<typeof resolveNav>[1]) => resolveNav(kind, sub).map((i) => i.moduleId);

describe('manifest — Memos', () => {
  it('parent org gets Memos, routed to /memos', () => {
    const item = resolveNav('PARENT', 'zeus-group').find((i) => i.moduleId === 'memos');
    expect(item?.routePath).toBe('/memos');
  });

  it.each(['zeus-the-agency', 'zeus-digital', 'labyrinth', 'odd-gorilla', 'house-of-zeus'] as const)('%s gets Memos after the head and the per-brand middle', (sub) => {
    const list = ids('SUBSIDIARY', sub);
    expect(list.slice(0, 5)).toEqual(['delivery-inbox', 'ecd-review', 'approvals', 'my-time', 'team-time']);
    expect(list).toContain('memos');
    expect(list.indexOf('memos')).toBeGreaterThan(list.indexOf('team-plans'));
  });
});
