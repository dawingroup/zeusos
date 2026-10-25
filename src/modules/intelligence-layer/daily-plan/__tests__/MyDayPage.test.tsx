/**
 * MyDayPage / FocusTodayCard — Phase 6.E render-level coverage: the plan
 * renders from one doc, the gap is labelled, Done and acknowledge go through
 * the callable, a load fault is not a quiet day.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import type { DailyPlan } from '../types';

const mockSubscribeToPlan = vi.fn();
const mockSubscribeTaskStates = vi.fn();
const mockAcknowledge = vi.fn();
const mockSetItemOutcome = vi.fn();
const mockFetchRecent = vi.fn();
const mockUseUser = vi.fn();

vi.mock('@/core/settings', () => ({ useCurrentDawinUser: () => mockUseUser() }));
// Stable references: a fresh `report` per render would re-run every effect
// that lists it as a dependency and loop the subscription forever.
const noop = () => {};
const RECOVERY = { epoch: 0, report: noop, resubscribe: noop };
vi.mock('@/shared/hooks/useResilientSubscription', () => ({
  useListenerRecovery: () => RECOVERY,
  useResilientSubscription: (subscribe: (h: { ok: () => void; fail: () => void }) => void) => {
    subscribe({ ok: noop, fail: noop });
    return { resubscribe: noop };
  },
}));
vi.mock('../services/taskEngineFunctions', () => ({
  taskActionFn: vi.fn(),
  createTaskFn: vi.fn(),
  dailyPlanActionFn: vi.fn(),
  taskEngineRunNowFn: vi.fn(),
}));
vi.mock('../services/dailyPlanService', () => ({
  subscribeToPlan: (date: string, uid: string, cb: (p: DailyPlan | null) => void, onErr?: (e: Error) => void) => mockSubscribeToPlan(date, uid, cb, onErr),
  acknowledgePlan: (...args: unknown[]) => mockAcknowledge(...args),
  setItemOutcome: (...args: unknown[]) => mockSetItemOutcome(...args),
  clearItemOutcome: vi.fn(),
  submitWrapUp: vi.fn(),
  fetchRecentPlans: (...args: unknown[]) => mockFetchRecent(...args),
}));
vi.mock('../services/tasksService', () => ({
  subscribeTaskStates: (ids: string[], cb: (m: Map<string, unknown>) => void) => mockSubscribeTaskStates(ids, cb),
}));

import MyDayPage from '../pages/MyDayPage';

const PLAN: DailyPlan = {
  id: '2026-10-27_u1',
  date: '2026-10-27',
  assigneeUid: 'u1',
  managerUid: 'm1',
  managerName: 'Grace Wanjiru',
  status: 'published',
  reviewed: false,
  source: 'system',
  dayGoal: '',
  items: [
    { taskId: 'a1', order: 0, title: 'Accept IWO-0042', priority: 'P1', focusReason: 'due_today', entityType: 'iwo', entityId: 'iwo-42', sourceModule: 'iwo', timeboxMinutes: 30 },
    { taskId: 'a2', order: 1, title: 'Draft the Q4 deck', priority: 'P2', focusReason: 'carry_over' },
    { taskId: 'a3', order: 2, title: 'Chase invoice', priority: 'P2', outcome: 'done' },
  ],
};

beforeEach(() => {
  mockSubscribeToPlan.mockReset();
  mockSubscribeTaskStates.mockReset();
  mockAcknowledge.mockReset();
  mockSetItemOutcome.mockReset();
  mockFetchRecent.mockReset();
  mockUseUser.mockReset();
  mockUseUser.mockReturnValue({ dawinUser: { uid: 'u1', email: 'amina@zeus.co.ke' } });
  mockFetchRecent.mockResolvedValue([]);
  mockSubscribeToPlan.mockImplementation((_d, _u, cb) => { cb(PLAN); return () => {}; });
  mockSubscribeTaskStates.mockImplementation((ids: string[], cb) => {
    cb(new Map(ids.map((id) => [id, { status: id === 'a3' ? 'completed' : 'assigned' }])));
    return () => {};
  });
  mockAcknowledge.mockResolvedValue({ ok: true });
  mockSetItemOutcome.mockResolvedValue({ ok: true });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <MyDayPage />
    </MemoryRouter>,
  );
}

describe('MyDayPage', () => {
  it('renders the plan from one doc: Now is the first open item, the gap is labelled, done is counted', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('focus-today')).toBeTruthy());
    expect(screen.getByTestId('focus-now').textContent).toContain('Accept IWO-0042');
    expect(screen.getByTestId('focus-now').textContent).toContain('Now · 1 of 3');
    expect(screen.getByTestId('plan-unreviewed').textContent).toContain('Grace Wanjiru');
    expect(screen.getByTestId('focus-progress').textContent).toBe('1/3 done');
    expect(screen.getByTestId('focus-row-a2').textContent).toContain('Carried from Mon');
    expect(mockSubscribeToPlan).toHaveBeenCalledWith(expect.any(String), 'u1', expect.any(Function), expect.any(Function));
  });

  it('"Got it" acknowledges through the callable; Done records the outcome', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('plan-acknowledge')).toBeTruthy());
    fireEvent.click(screen.getByTestId('plan-acknowledge'));
    await waitFor(() => expect(mockAcknowledge).toHaveBeenCalledWith('2026-10-27'));
    fireEvent.click(screen.getByTestId('focus-done'));
    await waitFor(() => expect(mockSetItemOutcome).toHaveBeenCalledWith('2026-10-27', 'a1', 'done', undefined));
  });

  it('Blocked asks why before it writes', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('focus-block')).toBeTruthy());
    fireEvent.click(screen.getByTestId('focus-block'));
    const reason = await screen.findByTestId('blocked-reason');
    fireEvent.click(screen.getByTestId('blocked-submit'));
    expect(mockSetItemOutcome).not.toHaveBeenCalled();
    expect(screen.getByTestId('blocked-submit').textContent).toContain('notify Grace');
    fireEvent.change(reason, { target: { value: 'Waiting on the brand guidelines' } });
    fireEvent.click(screen.getByTestId('blocked-submit'));
    await waitFor(() => expect(mockSetItemOutcome).toHaveBeenCalledWith('2026-10-27', 'a1', 'blocked', 'Waiting on the brand guidelines'));
  });

  it('a reviewed plan shows who reviewed it and the day goal', async () => {
    mockSubscribeToPlan.mockImplementation((_d, _u, cb) => { cb({ ...PLAN, reviewed: true, reviewedByName: 'Grace Wanjiru', dayGoal: 'Land the deck', acknowledgedAt: '2026-10-27T05:00:00Z' }); return () => {}; });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('plan-reviewed')).toBeTruthy());
    expect(screen.getByText('Land the deck')).toBeTruthy();
    expect(screen.getByTestId('plan-acknowledged')).toBeTruthy();
  });

  it('no plan is an honest empty state with a way to add your own task', async () => {
    mockSubscribeToPlan.mockImplementation((_d, _u, cb) => { cb(null); return () => {}; });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('focus-empty')).toBeTruthy());
    expect(screen.getAllByTestId('focus-add-own').length).toBeGreaterThan(0);
  });

  it('a plan that failed to load says so — it is a fault, not a quiet day', async () => {
    mockSubscribeToPlan.mockImplementation((_d, _u, cb, onErr) => {
      onErr?.(Object.assign(new Error('Missing or insufficient permissions'), { code: 'permission-denied' }));
      cb(null);
      return () => {};
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('plan-problem-load_failed')).toBeTruthy());
    expect(screen.getByTestId('plan-problem-load_failed').textContent).toContain('not allowed to read it');
  });
});
