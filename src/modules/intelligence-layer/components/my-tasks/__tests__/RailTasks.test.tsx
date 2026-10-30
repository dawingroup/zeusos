/**
 * My Tasks in the context rail. What must hold:
 *  - today's plan comes first, and a plan task is not listed twice;
 *  - a plan item closed or handed on stays visible, muted;
 *  - picking a task opens it where the work happens (`resolveTaskTarget`);
 *  - "Now working on" goes straight back to the current task;
 *  - Start is never offered on an approval, and an approval has no Done box;
 *  - a failed call says so and leaves the row as it was.
 */
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

const { navigate, ctx } = vi.hoisted(() => ({ navigate: vi.fn(), ctx: { current: null as unknown } }));

vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('../../../context/MyTasksContext', () => ({ useMyTasks: () => ctx.current }));
vi.mock('@/shared/people', () => ({ PersonName: ({ id }: { id: string }) => <span>{`name-of-${id}`}</span> }));
vi.mock('@/shared/services/firebase/firestore', () => ({ db: {} }));

import { RailTasks, MAX_OTHER_ROWS } from '../RailTasks';
import { resolveTaskTarget, taskDrawerRoute } from '../../../utils/actionTarget';
import type { EmployeeTask } from '../../../hooks/useEmployeeTaskInbox';
import type { MyTasksData } from '../../../context/MyTasksContext';

const task = (over: Partial<EmployeeTask> & { id: string }): EmployeeTask =>
  ({
    title: `Task ${over.id}`,
    description: '',
    priority: 'P2',
    status: 'pending',
    kind: 'action',
    checklistItems: [],
    checklistProgress: 0,
    sourceModule: '',
    subsidiary: '',
    createdAt: new Date('2026-10-30T06:00:00Z'),
    createdBy: 'system',
    businessEventId: '',
    templateId: '',
    urgencyScore: 50,
    ...over,
  }) as EmployeeTask;

const planItem = (taskId: string, title: string, over: Record<string, unknown> = {}) => ({
  taskId,
  title,
  order: 0,
  isClosed: false,
  currentAssignedToUserId: null,
  ...over,
});

function setCtx(over: Partial<MyTasksData> = {}) {
  const tasks = over.tasks ?? [];
  ctx.current = {
    loading: false,
    failed: false,
    tasks,
    openTasks: tasks,
    today: null,
    counts: { open: tasks.length, overdue: 0, dueToday: 0, inProgress: 0, blocked: 0 },
    current: null,
    pickCurrent: vi.fn(),
    startTask: vi.fn().mockResolvedValue(undefined),
    completeTask: vi.fn().mockResolvedValue(undefined),
    blockTask: vi.fn().mockResolvedValue(undefined),
    ...over,
  } satisfies MyTasksData;
  return ctx.current as MyTasksData;
}

const plan = (items: unknown[], doneCount = 0) =>
  ({ items, doneCount, total: items.length, pct: 0 }) as unknown as MyTasksData['today'];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the Tasks segment', () => {
  it("lists today's plan first and does not repeat a plan task below", () => {
    setCtx({
      tasks: [task({ id: 'o1', title: 'Chase the quote' }), task({ id: 'p1', title: 'Sign the IWO' })],
      today: plan([planItem('p1', 'Sign the IWO')]),
    });
    render(<RailTasks />);
    const today = screen.getByRole('region', { name: "Today's plan" });
    const rest = screen.getByRole('region', { name: 'Everything else' });
    expect(within(today).getByText('Sign the IWO')).toBeInTheDocument();
    expect(within(rest).queryByText('Sign the IWO')).toBeNull();
    expect(within(rest).getByText('Chase the quote')).toBeInTheDocument();
    expect(screen.getByText('0 of 1 done')).toBeInTheDocument();
  });

  it('keeps a closed plan item and one handed on visible, muted', () => {
    setCtx({
      today: plan([
        planItem('p1', 'Closed one', { isClosed: true }),
        planItem('p2', 'Handed on', { currentAssignedToUserId: 'u9' }),
      ], 1),
    });
    render(<RailTasks />);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('name-of-u9')).toBeInTheDocument();
  });

  it('opens a row where the work happens, and says it navigated', () => {
    const t = task({ id: 'o1', entityType: 'iwo', entityId: 'i1' });
    setCtx({ tasks: [t] });
    const onNavigate = vi.fn();
    render(<RailTasks onNavigate={onNavigate} />);
    fireEvent.click(screen.getByTitle(`Open: ${t.title}`));
    expect(navigate).toHaveBeenCalledWith(resolveTaskTarget(t).go);
    expect(onNavigate).toHaveBeenCalled();
  });

  it('opening in-progress work makes it current; opening pending work does not', () => {
    const going = task({ id: 'g', status: 'in_progress' });
    const pending = task({ id: 'p' });
    const c = setCtx({ tasks: [going, pending] });
    render(<RailTasks />);
    fireEvent.click(screen.getByTitle(`Open: ${pending.title}`));
    expect(c.pickCurrent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTitle(`Open: ${going.title}`));
    expect(c.pickCurrent).toHaveBeenCalledWith('g');
  });

  it('"Now working on" goes straight back to the current task', () => {
    const t = task({ id: 'g', status: 'in_progress', title: 'On it' });
    setCtx({ tasks: [t], current: t });
    render(<RailTasks />);
    fireEvent.click(screen.getByRole('button', { name: /Go to task/ }));
    expect(navigate).toHaveBeenCalledWith(taskDrawerRoute('g'));
  });

  it('Start marks it in progress and opens it', async () => {
    const t = task({ id: 'p' });
    const c = setCtx({ tasks: [t] });
    render(<RailTasks />);
    fireEvent.click(screen.getByRole('button', { name: `Start ${t.title}` }));
    await waitFor(() => expect(c.startTask).toHaveBeenCalledWith('p'));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('an approval has no Start and no Done box', () => {
    const t = task({ id: 'a', kind: 'approval', title: 'Decide the memo' });
    setCtx({ tasks: [t] });
    render(<RailTasks />);
    expect(screen.queryByRole('button', { name: `Start ${t.title}` })).toBeNull();
    expect(screen.queryByRole('button', { name: `Mark done: ${t.title}` })).toBeNull();
    expect(screen.getByTitle(`Open: ${t.title}`)).toBeInTheDocument();
  });

  it('Done closes the task and shows it done', async () => {
    const t = task({ id: 'p' });
    const c = setCtx({ tasks: [t] });
    render(<RailTasks />);
    fireEvent.click(screen.getByRole('button', { name: `Mark done: ${t.title}` }));
    await waitFor(() => expect(c.completeTask).toHaveBeenCalledWith('p'));
    expect(await screen.findByRole('button', { name: `Done: ${t.title}` })).toBeDisabled();
  });

  it('a failed Done says so and leaves the box', async () => {
    const t = task({ id: 'p' });
    setCtx({ tasks: [t], completeTask: vi.fn().mockRejectedValue(new Error('nope')) });
    render(<RailTasks />);
    fireEvent.click(screen.getByRole('button', { name: `Mark done: ${t.title}` }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Mark done: ${t.title}` })).toBeEnabled();
  });

  it('says a failed feed apart from an empty one', () => {
    setCtx({ failed: true });
    const { rerender } = render(<RailTasks />);
    expect(screen.getByRole('alert')).toHaveTextContent("didn't load");
    expect(screen.queryByText('Nothing on your plate')).toBeNull();
    setCtx();
    rerender(<RailTasks />);
    expect(screen.getByText('Nothing on your plate')).toBeInTheDocument();
  });

  it('caps "everything else" and points at the inbox', () => {
    setCtx({ tasks: Array.from({ length: MAX_OTHER_ROWS + 3 }, (_, i) => task({ id: `t${i}` })) });
    render(<RailTasks />);
    expect(screen.getByText('+3 more in the inbox')).toBeInTheDocument();
  });
});
