import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/services/firebase/firestore', () => ({ db: {} }));

import { toPanelTask } from '../adminTaskRow';

describe('toPanelTask', () => {
  it('reads the engine vocabulary the way the inbox does', () => {
    const row = toPanelTask('t1', {
      title: 'Review the IWO',
      status: 'assigned',
      assignedToUserId: 'u1',
      dueAt: '2026-11-02T09:00:00.000Z',
      createdAt: '2026-10-30T03:30:32.670Z',
      priority: 'P1',
    });
    expect(row.status).toBe('pending');
    expect(row.assignedTo).toBe('u1');
    expect(row.dueDate?.toDate().toISOString()).toBe('2026-11-02T09:00:00.000Z');
    expect(row.createdAt.toDate().toISOString()).toBe('2026-10-30T03:30:32.670Z');
  });

  it('shows the AI checklist when the task has no steps of its own', () => {
    const row = toPanelTask('t2', {
      title: 'x',
      aiChecklist: [{ id: 'ai-0', title: 'Audit', isRequired: true, completed: false }],
    });
    expect(row.checklistItems).toEqual([expect.objectContaining({ id: 'ai-0', isRequired: true, isCompleted: false })]);
  });

  it('leaves an unassigned agent draft unassigned', () => {
    expect(toPanelTask('t3', { title: 'x', status: 'pending', assignedToUserId: null }).assignedTo).toBeUndefined();
  });
});
