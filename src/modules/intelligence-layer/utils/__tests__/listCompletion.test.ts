import { describe, expect, it } from 'vitest';
import { canCompleteFromList, canStartFromList } from '../listCompletion';

describe('canCompleteFromList', () => {
  it('closes plain open work', () => {
    expect(canCompleteFromList({ status: 'pending', kind: 'action' })).toBe(true);
    expect(canCompleteFromList({ status: 'in_progress' })).toBe(true);
    expect(canCompleteFromList({ status: 'blocked', kind: 'action' })).toBe(true);
  });

  it.each(['approval', 'review', 'followup', 'notify'])('never closes a %s task', (kind) => {
    expect(canCompleteFromList({ status: 'in_progress', kind })).toBe(false);
  });

  it('never closes a task waiting on its reviewer', () => {
    expect(canCompleteFromList({ status: 'in_progress', rawStatus: 'pending_review' })).toBe(false);
  });

  it('never closes over an open required check, the way taskAction refuses', () => {
    const open = { id: '1', title: 'a', isRequired: true, completed: false };
    expect(canCompleteFromList({ status: 'pending', checklistItems: [open] })).toBe(false);
    expect(canCompleteFromList({ status: 'pending', checklistItems: [{ ...open, completed: true }] })).toBe(true);
    expect(canCompleteFromList({ status: 'pending', checklistItems: [{ ...open, isRequired: false }] })).toBe(true);
  });

  it('never closes a closed task', () => {
    expect(canCompleteFromList({ status: 'completed' })).toBe(false);
    expect(canCompleteFromList({ status: 'cancelled' })).toBe(false);
  });
});

describe('canStartFromList', () => {
  it('starts pending work, not an approval, a notice, or work already going', () => {
    expect(canStartFromList({ status: 'pending', kind: 'action' })).toBe(true);
    expect(canStartFromList({ status: 'pending', kind: 'approval' })).toBe(false);
    expect(canStartFromList({ status: 'pending', kind: 'notify' })).toBe(false);
    expect(canStartFromList({ status: 'in_progress' })).toBe(false);
  });
});
