import { describe, expect, it } from 'vitest';
import { selectCurrentTask } from '../currentTask';

const t = (id: string, status: 'pending' | 'in_progress', startedAt?: string) => ({
  id,
  status,
  startedAt: startedAt ? new Date(startedAt) : undefined,
});

describe('selectCurrentTask', () => {
  const open = [t('a', 'in_progress', '2026-10-30T08:00:00Z'), t('b', 'in_progress', '2026-10-30T09:00:00Z'), t('c', 'pending')];

  it('honours a pick that is still open', () => {
    expect(selectCurrentTask(open, 'a')?.id).toBe('a');
  });

  it('ignores a stale pick and falls back to the most recently started', () => {
    expect(selectCurrentTask(open, 'gone')?.id).toBe('b');
    expect(selectCurrentTask(open, null)?.id).toBe('b');
  });

  it('is nothing when no work is in progress', () => {
    expect(selectCurrentTask([t('c', 'pending')], null)).toBeNull();
  });
});
