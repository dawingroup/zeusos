/**
 * ActionCenter — urgency derivation tests (UI Refresh v3).
 */
import { describe, expect, it } from 'vitest';
import { urgencyOf } from '../ActionCenter';
import type { EmployeeTask } from '@/modules/intelligence-layer/hooks/useEmployeeTaskInbox';

const NOW = 1_700_000_000_000;

function task(overrides: Partial<EmployeeTask>): EmployeeTask {
  return {
    id: 't1',
    businessEventId: 'e1',
    templateId: 'tpl1',
    title: 'Do the thing',
    description: '',
    priority: 'P2',
    status: 'pending',
    checklistItems: [],
    checklistProgress: 0,
    sourceModule: 'delivery',
    subsidiary: 'zeus-the-agency',
    createdAt: new Date(NOW),
    createdBy: 'sys',
    urgencyScore: 1,
    ...overrides,
  } as EmployeeTask;
}

describe('ActionCenter urgencyOf', () => {
  it('P0 is blocking', () => {
    expect(urgencyOf(task({ priority: 'P0' }), NOW)).toBe('blocking');
  });

  it('blocked status is blocking regardless of priority', () => {
    expect(urgencyOf(task({ priority: 'P3', status: 'blocked' }), NOW)).toBe('blocking');
  });

  it('an overdue task is blocking', () => {
    expect(urgencyOf(task({ priority: 'P2', dueDate: new Date(NOW - 60_000) }), NOW)).toBe('blocking');
  });

  it('P1 is urgent', () => {
    expect(urgencyOf(task({ priority: 'P1' }), NOW)).toBe('urgent');
  });

  it('due within 24h is urgent', () => {
    expect(urgencyOf(task({ priority: 'P2', dueDate: new Date(NOW + 60 * 60 * 1000) }), NOW)).toBe('urgent');
  });

  it('a low-priority task with a far due date is for-info', () => {
    expect(urgencyOf(task({ priority: 'P3', dueDate: new Date(NOW + 7 * 24 * 60 * 60 * 1000) }), NOW)).toBe('info');
  });

  it('no due date + low priority is for-info', () => {
    expect(urgencyOf(task({ priority: 'P2' }), NOW)).toBe('info');
  });
});
