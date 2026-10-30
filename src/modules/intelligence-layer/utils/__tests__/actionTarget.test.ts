import { describe, expect, it } from 'vitest';
import { entityShortLabel, resolveTaskTarget, taskDrawerRoute } from '../actionTarget';

describe('resolveTaskTarget', () => {
  it('opens the record when the item is the work', () => {
    const target = resolveTaskTarget({ id: 't1', entityType: 'iwo', entityId: 'i1' });
    expect(target.contextFirst).toBe(false);
    expect(target.go).toContain('i1');
    expect(target.goLabel).toBe('Open IWO');
    expect(target.contextGo).toBe(taskDrawerRoute('t1'));
  });

  it('opens the task first when it carries steps to follow', () => {
    const target = resolveTaskTarget({ id: 't1', entityType: 'iwo', entityId: 'i1', checklistItems: [{}] });
    expect(target).toEqual({ go: taskDrawerRoute('t1'), goLabel: 'Read context', contextFirst: true });
  });

  it('opens the task when the entity is not routable — never a bare list', () => {
    expect(resolveTaskTarget({ id: 't1', entityType: 'nonsense', entityId: 'x' }).go).toBe(taskDrawerRoute('t1'));
    expect(resolveTaskTarget({ id: 't1' }).go).toBe(taskDrawerRoute('t1'));
  });
});

describe('entityShortLabel', () => {
  it('reads the loose entity vocabulary', () => {
    expect(entityShortLabel('internal_work_order')).toBe('IWO');
    expect(entityShortLabel('masterJob')).toBe('job');
    expect(entityShortLabel('something_else')).toBe('something else');
    expect(entityShortLabel(undefined)).toBe('record');
  });
});
