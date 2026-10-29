/**
 * The inbox reads `generated_tasks` (Phase 6.E): the engine's seven statuses
 * fold onto the five the inbox renders, ISO timestamps become Dates, and the
 * legacy fields are still read.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/services/firebase/firestore', () => ({ db: {} }));
vi.mock('@/integration/store', () => ({ useAuth: () => ({ user: null, userId: null }) }));
vi.mock('../../daily-plan/services/tasksService', () => ({
  startTask: vi.fn(), completeTask: vi.fn(), blockTask: vi.fn(), tickChecklist: vi.fn(),
}));

import { toInboxTask } from '../useEmployeeTaskInbox';

describe('toInboxTask', () => {
  it('maps the engine shape', () => {
    const t = toInboxTask('t1', {
      title: 'Accept IWO-0042',
      priority: 'P1',
      status: 'assigned',
      kind: 'action',
      assignedToUserId: 'u1',
      dueAt: '2026-10-27T13:00:00.000Z',
      createdAt: '2026-10-26T08:00:00.000Z',
      sourceEventId: 'evt_1',
      sourceRuleId: 'accept_iwo',
      brandId: 'zeus-digital',
      masterJobId: 'mj-1',
      aiChecklist: [{ id: 'ai-0', title: 'Read the brief', isRequired: true, completed: false }],
    });
    expect(t.status).toBe('pending');
    expect(t.rawStatus).toBe('assigned');
    expect(t.assignedTo).toBe('u1');
    expect(t.dueDate?.toISOString()).toBe('2026-10-27T13:00:00.000Z');
    expect(t.businessEventId).toBe('evt_1');
    expect(t.templateId).toBe('accept_iwo');
    expect(t.subsidiary).toBe('zeus-digital');
    expect(t.projectId).toBe('mj-1');
    expect(t.checklistItems).toHaveLength(1);
    expect(t.checklistItems[0].isRequired).toBe(true);
  });

  it('folds statuses and reads legacy fields', () => {
    expect(toInboxTask('a', { status: 'pending_assignment' }).status).toBe('pending');
    expect(toInboxTask('b', { status: 'pending' }).status).toBe('pending');
    expect(toInboxTask('c', { status: 'pending_review' }).status).toBe('in_progress');
    expect(toInboxTask('d', { status: 'blocked', blockedReason: 'No assets' }).blockedReason).toBe('No assets');
    expect(toInboxTask('e', { status: 'cancelled' }).status).toBe('cancelled');
    const legacy = toInboxTask('f', { status: 'in_progress', assignedTo: 'emp-1', dueDate: { toMillis: () => Date.parse('2026-10-28T10:00:00Z') }, priority: 'bogus' });
    expect(legacy.assignedTo).toBe('emp-1');
    expect(legacy.dueDate?.toISOString()).toBe('2026-10-28T10:00:00.000Z');
    expect(legacy.priority).toBe('P2');
  });
});
