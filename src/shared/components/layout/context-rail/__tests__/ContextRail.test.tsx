/**
 * The context rail and its top-bar trigger. What must hold:
 *  - closed means unmounted: no segment body runs;
 *  - Esc and the navigate-away close apply to an OVERLAY rail only — a pushed
 *    rail is a column of the layout, not something in the way;
 *  - the trigger says the worst of it: blocking beats "need you" beats clear;
 *  - `]` toggles, except while typing.
 */
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

const { queue, navigate } = vi.hoisted(() => ({ queue: { current: null as unknown }, navigate: vi.fn() }));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/modules/intelligence-layer/components/my-tasks/RailTasks', () => ({
  RailTasks: () => <div>tasks body</div>,
}));
vi.mock('@/modules/messaging/components/rail-messages/RailMessages', () => ({
  RailMessages: () => <div>messages body</div>,
}));
vi.mock('@/modules/intelligence-layer/context/MyTasksContext', () => ({
  useMyTasks: () => ({ counts: { open: 4, overdue: 1 } }),
}));

vi.mock('@/modules/intelligence-layer/components/action-center', () => ({
  useActionQueue: () => queue.current,
  ActionCenterList: ({ onNavigate }: { onNavigate?: () => void }) => (
    <button type="button" onClick={onNavigate}>
      open an action
    </button>
  ),
}));
vi.mock('@/modules/intelligence-layer/components/assistant/AIAssistantPanel', () => ({
  AIAssistantPanel: ({ context }: { context?: Record<string, unknown> }) => (
    <div data-testid="ask">{JSON.stringify(context)}</div>
  ),
}));

import { ContextRail } from '../ContextRail';
import { RailTrigger } from '../RailTrigger';
import { useRailShortcut } from '../useRailChrome';
import { useRailStore, RAIL_DEFAULT } from '@/shared/stores/railStore';

const setQueue = (visible: number, blockingCount = 0, loading = false) => {
  queue.current = {
    loading,
    visible: Array.from({ length: visible }, (_, i) => ({ task: { id: `a${i}` }, urgency: 'info' })),
    blockingCount,
    clearAll: vi.fn(),
  };
  return queue.current as { clearAll: ReturnType<typeof vi.fn> };
};

const rail = () => useRailStore.getState();

beforeEach(() => {
  setQueue(0);
  act(() => useRailStore.setState({ ...RAIL_DEFAULT, askContext: null }));
});

describe('the rail', () => {
  it('renders nothing while closed', () => {
    const { container } = render(<ContextRail mode="push" unread={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('falls back to Actions when the remembered segment is not on the rail', () => {
    act(() => useRailStore.setState({ open: true, initialised: true, seg: 'nope' as never }));
    render(<ContextRail mode="push" unread={0} />);
    expect(screen.getByText('open an action')).toBeInTheDocument();
  });

  it('shows the count and a blocking count in the sub line', () => {
    setQueue(3, 1);
    act(() => rail().setSeg('actions'));
    render(<ContextRail mode="push" unread={0} />);
    expect(screen.getByText('3 need you · 1 blocking')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Actions — 3' })).toBeInTheDocument();
  });

  it('Clear all empties the queue', () => {
    const q = setQueue(2);
    act(() => rail().setSeg('actions'));
    render(<ContextRail mode="push" unread={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(q.clearAll).toHaveBeenCalledOnce();
  });

  it('merges a page\'s grounding over the shell\'s for the assistant', () => {
    act(() => {
      rail().setSeg('ask');
      rail().setAskContext({ currentTab: 'overview' });
    });
    render(<ContextRail mode="push" unread={0} assistantContext={{ currentModule: 'intelligence' }} />);
    expect(screen.getByTestId('ask')).toHaveTextContent('"currentModule":"intelligence"');
    expect(screen.getByTestId('ask')).toHaveTextContent('"currentTab":"overview"');
  });

  it('closes on Esc and after navigating only as an overlay', () => {
    act(() => rail().setSeg('actions'));
    const { rerender } = render(<ContextRail mode="push" unread={0} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByText('open an action'));
    expect(rail().open).toBe(true);

    rerender(<ContextRail mode="overlay" unread={0} />);
    fireEvent.click(screen.getByText('open an action'));
    expect(rail().open).toBe(false);

    act(() => rail().setOpen(true));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(rail().open).toBe(false);
  });
});

describe('the Ask segment', () => {
  it('keeps Esc in an overlay rail, so a half-written question survives', () => {
    act(() => rail().setSeg('ask'));
    render(<ContextRail mode="overlay" unread={0} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(rail().open).toBe(true);
  });
});

describe('the Tasks segment', () => {
  it('counts open work and offers the full views', () => {
    act(() => rail().setSeg('tasks'));
    render(<ContextRail mode="overlay" unread={0} />);
    expect(screen.getByRole('tab', { name: 'Tasks — 4' })).toBeInTheDocument();
    expect(screen.getByText('tasks body')).toBeInTheDocument();
    expect(screen.getByText('4 open · 1 overdue')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'My Day' }));
    expect(navigate).toHaveBeenCalledWith('/tasks/today');
    expect(rail().open).toBe(false);
  });
});

describe('the Messages segment', () => {
  it('counts unread and offers Comms', () => {
    act(() => rail().setSeg('messages'));
    render(<ContextRail mode="push" unread={3} />);
    expect(screen.getByRole('tab', { name: 'Messages — 3' })).toBeInTheDocument();
    expect(screen.getByText('messages body')).toBeInTheDocument();
    expect(screen.getByText('3 unread in Team Chat')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Open Comms/ }));
    expect(navigate).toHaveBeenCalledWith('/comms');
  });
});

describe('the trigger', () => {
  it('says the worst of it', () => {
    setQueue(0);
    const { rerender } = render(<RailTrigger unread={0} />);
    expect(screen.getByTestId('rail-trigger')).toHaveTextContent('All clear');
    setQueue(2);
    rerender(<RailTrigger unread={3} />);
    expect(screen.getByTestId('rail-trigger')).toHaveTextContent('5 need you');
    queue.current = { ...(queue.current as object), visible: [], blockingCount: 0, failed: true };
    rerender(<RailTrigger unread={0} />);
    expect(screen.getByTestId('rail-trigger')).toHaveTextContent('Check failed');
    setQueue(2, 1);
    rerender(<RailTrigger unread={3} />);
    expect(screen.getByTestId('rail-trigger')).toHaveTextContent('1 blocking');
    expect(screen.getByTestId('rail-trigger')).toHaveAttribute('data-blocking', 'true');
  });

  it('toggles the rail', () => {
    render(<RailTrigger unread={0} />);
    fireEvent.click(screen.getByTestId('rail-trigger'));
    expect(rail().open).toBe(true);
  });
});

describe('the ] shortcut', () => {
  it('toggles the rail, but not while typing', () => {
    renderHook(() => useRailShortcut());
    fireEvent.keyDown(window, { key: ']' });
    expect(rail().open).toBe(true);

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: ']' });
    expect(rail().open).toBe(true);
    input.remove();
  });
});
