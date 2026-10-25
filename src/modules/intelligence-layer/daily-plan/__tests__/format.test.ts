/**
 * Pure helpers behind the daily-plan surfaces — Phase 6.E.
 */
import { describe, expect, it } from 'vitest';

import {
  computeFocusReliability,
  groupFocusItems,
  isWrapUpDue,
  itemState,
  nairobiDateKey,
  nextWorkingDay,
  previousWorkingDay,
  priorityChip,
  reasonChip,
  sortTasksByDue,
  toTaskRecord,
  wrapUpOutcomes,
  clockOf,
  fmtMins,
} from '../format';
import type { DailyPlan } from '../types';

const eat = (local: string) => Date.parse(`${local}:00+03:00`);

describe('Nairobi clock', () => {
  it('nairobiDateKey is Nairobi-local, so late-evening UTC is already tomorrow', () => {
    expect(nairobiDateKey(Date.parse('2026-10-26T22:30:00Z'))).toBe('2026-10-27');
    expect(nairobiDateKey(Date.parse('2026-10-26T14:00:00Z'))).toBe('2026-10-26');
    expect(nairobiDateKey(Date.parse('2026-10-26T14:00:00Z'), 1)).toBe('2026-10-27');
  });

  it('working days skip the weekend both ways', () => {
    expect(nextWorkingDay(Date.parse('2026-10-30T14:00:00Z'))).toBe('2026-11-02'); // Fri → Mon
    expect(nextWorkingDay(Date.parse('2026-10-26T14:00:00Z'))).toBe('2026-10-27');
    expect(previousWorkingDay('2026-11-02')).toBe('2026-10-30'); // Mon → Fri
  });

  it('clockOf and fmtMins read the way the card prints them', () => {
    expect(clockOf('2026-10-27T04:52:00.000Z')).toBe('07:52');
    expect(clockOf(undefined)).toBeNull();
    expect(fmtMins(45)).toBe('45m');
    expect(fmtMins(90)).toBe('1h 30m');
    expect(fmtMins(120)).toBe('2h');
  });
});

describe('plan items', () => {
  const items = [
    { taskId: 'a', order: 2, title: 'A', priority: 'P2' },
    { taskId: 'b', order: 0, title: 'B', priority: 'P1', outcome: 'done' as const },
    { taskId: 'c', order: 1, title: 'C', priority: 'P2', isClosed: true },
    { taskId: 'd', order: 3, title: 'D', priority: 'P3', outcome: 'blocked' as const, outcomeNote: 'No assets' },
    { taskId: 'e', order: 4, title: 'E', priority: 'P3' },
  ];

  it('itemState: a closed task reads done; an outcome stands; else open', () => {
    expect(itemState(items[0])).toBe('open');
    expect(itemState(items[1])).toBe('done');
    expect(itemState(items[2])).toBe('done');
    expect(itemState(items[3])).toBe('blocked');
  });

  it('groupFocusItems: Now is the first open item in plan order', () => {
    const g = groupFocusItems(items);
    expect(g.now?.taskId).toBe('a');
    expect(g.upNext.map((i) => i.taskId)).toEqual(['e']);
    expect(g.parked.map((i) => i.taskId)).toEqual(['d']);
    expect(g.done.map((i) => i.taskId)).toEqual(['b', 'c']);
  });

  it('wrapUpOutcomes: given outcomes stand, closed tasks are done, open items are carried', () => {
    expect(wrapUpOutcomes(items)).toEqual({
      a: { outcome: 'carried' },
      b: { outcome: 'done' },
      c: { outcome: 'done' },
      d: { outcome: 'blocked', note: 'No assets' },
      e: { outcome: 'carried' },
    });
  });

  it('chips read every priority vocabulary and say why an item is there', () => {
    expect(priorityChip('urgent').label).toBe('Critical');
    expect(priorityChip('P1').label).toBe('High');
    expect(priorityChip(undefined).label).toBe('Medium');
    expect(reasonChip('carry_over', '2026-11-02').label).toBe('Carried from Fri');
    expect(reasonChip('due_today', '2026-10-27').label).toBe('Due today');
    expect(reasonChip(undefined, '2026-10-27').label).toBe('Ranked');
  });
});

describe('wrap-up reminder', () => {
  const plan = { date: '2026-10-27', status: 'published' as const, items: [{ taskId: 'a', order: 0, title: 'A', priority: 'P2' }] };
  it('is due between 16:30 and 20:00 on the plan day, until the person wraps up', () => {
    expect(isWrapUpDue(plan, eat('2026-10-27T16:29'))).toBe(false);
    expect(isWrapUpDue(plan, eat('2026-10-27T16:30'))).toBe(true);
    expect(isWrapUpDue(plan, eat('2026-10-27T19:59'))).toBe(true);
    expect(isWrapUpDue(plan, eat('2026-10-27T20:00'))).toBe(false);
    expect(isWrapUpDue({ ...plan, wrapUp: { at: 'x', carriedTaskIds: [] } }, eat('2026-10-27T17:00'))).toBe(false);
    expect(isWrapUpDue({ ...plan, date: '2026-10-26' }, eat('2026-10-27T17:00'))).toBe(false);
    expect(isWrapUpDue({ ...plan, status: 'closed' }, eat('2026-10-27T17:00'))).toBe(false);
  });
});

describe('reliability', () => {
  const plan = (date: string, outcomes: string[], over: Partial<DailyPlan> = {}): DailyPlan => ({
    id: `${date}_u`, date, assigneeUid: 'u', status: 'closed', reviewed: true, source: 'system',
    items: outcomes.map((o, i) => ({ taskId: `${date}-${i}`, order: i, title: 't', priority: 'P2', outcome: o as DailyPlan['items'][number]['outcome'] })),
    ...over,
  });
  it('counts closed working days only, oldest first in the trail', () => {
    const r = computeFocusReliability([
      plan('2026-10-27', ['done', 'carried'], { status: 'published' }), // today, in progress — excluded
      plan('2026-10-26', ['done', 'done', 'blocked'], { acknowledgedAt: 'x' }),
      plan('2026-10-25', ['carried'], { nonWorkingDay: true }), // weekend — excluded
      plan('2026-10-23', ['done', 'carried']),
    ]);
    expect(r.days).toBe(2);
    expect(r.planned).toBe(5);
    expect(r.done).toBe(3);
    expect(r.carried).toBe(1);
    expect(r.blocked).toBe(1);
    expect(r.acknowledged).toBe(1);
    expect(r.completionRate).toBe(60);
    expect(r.trail).toEqual([1, 2]);
  });
});

describe('tasks', () => {
  it('toTaskRecord reads the engine shape and the legacy one', () => {
    const t = toTaskRecord('t1', { title: 'Accept IWO', priority: 'P1', status: 'assigned', assignedToUserId: 'u1', dueAt: '2026-10-27T13:00:00.000Z', kind: 'action' });
    expect(t.status).toBe('assigned');
    expect(t.dueAt).toBe('2026-10-27T13:00:00.000Z');
    expect(t.assignedToUserId).toBe('u1');
    const legacy = toTaskRecord('t2', { title: 'Old', priority: 'high', status: 'pending', assignedTo: 'u2', dueDate: { toMillis: () => Date.parse('2026-10-28T10:00:00Z') } });
    expect(legacy.status).toBe('assigned');
    expect(legacy.priority).toBe('P1');
    expect(legacy.assignedToUserId).toBe('u2');
    expect(legacy.dueAt).toBe('2026-10-28T10:00:00.000Z');
  });

  it('sortTasksByDue: soonest first, undated last', () => {
    const sorted = sortTasksByDue([
      { id: 'late', title: 'late', dueAt: '2026-10-29T00:00:00Z' },
      { id: 'none', title: 'none', dueAt: null },
      { id: 'soon', title: 'soon', dueAt: '2026-10-27T00:00:00Z' },
    ]);
    expect(sorted.map((t) => t.id)).toEqual(['soon', 'late', 'none']);
  });
});
