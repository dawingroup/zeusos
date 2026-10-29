/**
 * Phase 6.E — Daily Plan entries: My Day and Team Plans reach every org kind
 * without disturbing the subsidiary head (which stream F's Approvals entry
 * joins at position three) or the per-brand middle.
 */
import { describe, expect, it } from 'vitest';

import { resolveNav } from '../manifest';

const ids = (kind: Parameters<typeof resolveNav>[0], sub: Parameters<typeof resolveNav>[1]) =>
  resolveNav(kind, sub).map((i) => i.moduleId);

describe('manifest — Daily Plan (Phase 6.E)', () => {
  it('parent org gets My Day + Team Plans, routed to /tasks', () => {
    const items = resolveNav('PARENT', 'zeus-group');
    const myDay = items.find((i) => i.moduleId === 'my-day');
    const team = items.find((i) => i.moduleId === 'team-plans');
    expect(myDay?.routePath).toBe('/tasks/today');
    expect(team?.routePath).toBe('/tasks/review');
  });

  it.each(['zeus-the-agency', 'zeus-digital', 'labyrinth', 'odd-gorilla', 'house-of-zeus'] as const)(
    '%s gets both, after the head and the per-brand middle',
    (sub) => {
      const list = ids('SUBSIDIARY', sub);
      expect(list.slice(0, 5)).toEqual(['delivery-inbox', 'ecd-review', 'approvals', 'my-time', 'team-time']);
      expect(list).toContain('my-day');
      expect(list).toContain('team-plans');
      expect(list.indexOf('my-day')).toBeGreaterThan(list.indexOf('comms'));
      expect(list.indexOf('team-plans')).toBeLessThan(list.indexOf('compliance'));
    },
  );
});
