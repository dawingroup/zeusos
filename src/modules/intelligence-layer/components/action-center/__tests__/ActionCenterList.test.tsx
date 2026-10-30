/**
 * The Actions segment. What must hold:
 *  - a card and its primary button open the record, and tell the rail;
 *  - Mark done is offered only where the item may close in one click;
 *  - the card's inner buttons do not also open the card;
 *  - a failed Mark done says so;
 *  - an empty queue offers back what was dismissed.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

const h = vi.hoisted(() => ({ navigate: vi.fn(), queue: { current: {} as Record<string, unknown> }, toast: vi.fn() }));

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }));
vi.mock('../useActionQueue', () => ({ useActionQueue: () => h.queue.current }));
vi.mock('@/shared/components/feedback', () => ({ pushToast: h.toast }));
vi.mock('@/modules/intelligence-layer/daily-plan/components/ActionCenterFocusStrip', () => ({
  ActionCenterFocusStrip: () => null,
}));

import { ActionCenterList } from '../ActionCenterList';
import type { ActionItem } from '../config';

const item = (over: Partial<ActionItem> = {}): ActionItem => ({
  id: 'task:t1',
  type: 'directive',
  urgency: 'urgent',
  title: 'Chase the quote',
  context: 'pricing',
  age: '2h',
  go: '/record/t1',
  goLabel: 'Open quote',
  dueMs: Infinity,
  ...over,
});

const setQueue = (over: Record<string, unknown> = {}) => {
  h.queue.current = {
    visible: [],
    loading: false,
    leavingId: null,
    dismissedCount: 0,
    dismiss: vi.fn(),
    resolve: vi.fn().mockResolvedValue(undefined),
    restoreAll: vi.fn(),
    ...over,
  };
  return h.queue.current as Record<string, ReturnType<typeof vi.fn>>;
};

beforeEach(() => {
  vi.clearAllMocks();
  setQueue();
});

describe('ActionCenterList', () => {
  it('opens the record from the card and tells the rail', () => {
    setQueue({ visible: [item()] });
    const onNavigate = vi.fn();
    render(<ActionCenterList onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Chase the quote — open' }));
    expect(h.navigate).toHaveBeenCalledWith('/record/t1');
    expect(onNavigate).toHaveBeenCalled();
  });

  it('offers Mark done only where the item may close', () => {
    setQueue({ visible: [item({ id: 'task:a' }), item({ id: 'task:b', completeTaskId: 'b' })] });
    render(<ActionCenterList />);
    expect(screen.queryByTestId('action-resolve-task:a')).toBeNull();
    expect(screen.getByTestId('action-resolve-task:b')).toBeInTheDocument();
  });

  it('inner buttons do not also open the card', async () => {
    const it0 = item({ completeTaskId: 't1' });
    const q = setQueue({ visible: [it0] });
    render(<ActionCenterList />);
    fireEvent.click(screen.getByTestId('action-resolve-task:t1'));
    await waitFor(() => expect(q.resolve).toHaveBeenCalledWith(it0));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss: Chase the quote' }));
    expect(q.dismiss).toHaveBeenCalledWith('task:t1');
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it('opens the task itself from Read context', () => {
    setQueue({ visible: [item({ contextGo: '/task/t1' })] });
    render(<ActionCenterList />);
    fireEvent.click(screen.getByRole('button', { name: 'Read context' }));
    expect(h.navigate).toHaveBeenCalledWith('/task/t1');
  });

  it('a failed Mark done says so', async () => {
    setQueue({ visible: [item({ completeTaskId: 't1' })], resolve: vi.fn().mockRejectedValue(new Error('nope')) });
    render(<ActionCenterList />);
    fireEvent.click(screen.getByTestId('action-resolve-task:t1'));
    await waitFor(() => expect(h.toast).toHaveBeenCalledWith(expect.any(String), { tone: 'error' }));
  });

  it('never says caught up when a feed failed', () => {
    setQueue({ failed: true });
    render(<ActionCenterList />);
    expect(screen.getByRole('alert')).toHaveTextContent("didn't load");
    expect(screen.queryByText("You're all caught up.")).toBeNull();
  });

  it('an empty queue offers back what was dismissed', () => {
    const q = setQueue({ dismissedCount: 2 });
    render(<ActionCenterList />);
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Restore 2 dismissed/ }));
    expect(q.restoreAll).toHaveBeenCalled();
  });
});
