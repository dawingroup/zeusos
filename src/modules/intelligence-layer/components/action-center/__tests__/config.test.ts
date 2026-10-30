/**
 * Action queue — urgency derivation and ordering.
 */
import { describe, expect, it } from 'vitest';
import { approvalToAction, buildActionItems, taskToAction, urgencyOf } from '../config';
import { taskDrawerRoute } from '@/modules/intelligence-layer/utils/actionTarget';
import type { ApprovalItem } from '@/modules/approvals/types';
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

const approval = (over: Partial<ApprovalItem> = {}): ApprovalItem =>
  ({
    id: 'sow:s1',
    kind: 'sow_pending',
    title: 'SOW-1 awaiting approval',
    requiredAction: 'approve_sow',
    urgency: 'medium',
    status: 'PENDING',
    entity: { type: 'iwo', id: 'i1', ref: 'IWO-1' },
    ...over,
  }) as ApprovalItem;

describe('taskToAction', () => {
  it('opens the record, with the task one click away', () => {
    const a = taskToAction(task({ id: 't1', entityType: 'iwo', entityId: 'i1' }), NOW);
    expect(a.id).toBe('task:t1');
    expect(a.go).toContain('i1');
    expect(a.goLabel).toBe('Open IWO');
    expect(a.contextGo).toBe(taskDrawerRoute('t1'));
  });

  it('offers Mark done on plain work only', () => {
    expect(taskToAction(task({ id: 't1', kind: 'action' }), NOW).completeTaskId).toBe('t1');
    expect(taskToAction(task({ id: 't2', kind: 'approval' }), NOW).completeTaskId).toBeUndefined();
    expect(taskToAction(task({ id: 't3', kind: 'review' }), NOW).completeTaskId).toBeUndefined();
  });

  it('calls a blocked task a blocker, and an approval an approval', () => {
    expect(taskToAction(task({ status: 'blocked' }), NOW).type).toBe('blocker');
    expect(taskToAction(task({ kind: 'approval' }), NOW).type).toBe('approval');
    expect(taskToAction(task({ kind: 'action' }), NOW).type).toBe('directive');
  });
});

describe('approvalToAction', () => {
  it('only ever opens the record, and critical blocks', () => {
    const a = approvalToAction(approval({ urgency: 'critical' }));
    expect(a).toMatchObject({ id: 'approval:sow:s1', urgency: 'blocking', goLabel: 'Review', context: 'IWO-1' });
    expect(a?.completeTaskId).toBeUndefined();
    expect(approvalToAction(approval({ urgency: 'high' }))?.urgency).toBe('urgent');
    expect(approvalToAction(approval({ urgency: 'low' }))?.urgency).toBe('info');
  });
});

describe('buildActionItems', () => {
  const sources = (tasks: EmployeeTask[], approvals: ApprovalItem[] = []) => ({ tasks, approvals });

  it('drops closed and dismissed items and puts the worst first', () => {
    const items = buildActionItems(
      sources([
        task({ id: 'info', priority: 'P3' }),
        task({ id: 'done', status: 'completed' }),
        task({ id: 'gone', priority: 'P0' }),
        task({ id: 'block', priority: 'P0' }),
        task({ id: 'urgent', priority: 'P1' }),
      ]),
      new Set(['task:gone']),
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(['task:block', 'task:urgent', 'task:info']);
  });

  it('orders within a band by the soonest due date, undated last', () => {
    const items = buildActionItems(
      sources([
        task({ id: 'undated', priority: 'P1' }),
        task({ id: 'later', priority: 'P1', dueDate: new Date(NOW + 9e7) }),
        task({ id: 'sooner', priority: 'P1', dueDate: new Date(NOW + 9e6) }),
      ]),
      new Set(),
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(['task:sooner', 'task:later', 'task:undated']);
  });

  it('merges approvals into the same queue, by urgency', () => {
    const items = buildActionItems(
      sources([task({ id: 'p2', priority: 'P2' })], [approval({ urgency: 'critical' })]),
      new Set(),
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(['approval:sow:s1', 'task:p2']);
  });
});
