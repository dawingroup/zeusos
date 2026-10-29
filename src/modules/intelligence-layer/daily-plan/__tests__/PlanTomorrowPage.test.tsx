/**
 * PlanTomorrowPage — Phase 6.E: the rail, the coverage gaps, and Mark
 * reviewed going through the callable.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import type { DailyPlan } from '../types';
import type { TeamPlanRow } from '../hooks/useTeamPlans';
import { nextWorkingDay } from '../format';

// The page opens on the next working day, computed from the real clock.
const DATE = nextWorkingDay();

const mockUseTeamPlans = vi.fn();
const mockUseUnassigned = vi.fn();
const mockMarkReviewed = vi.fn();
const mockSaveItems = vi.fn();
const mockSaveNotes = vi.fn();
const mockCreateEmpty = vi.fn();
const mockFetchPlan = vi.fn();
const mockFetchOpen = vi.fn();

vi.mock('../hooks/useTeamPlans', () => ({ useTeamPlans: (date: string) => mockUseTeamPlans(date) }));
vi.mock('../hooks/useUnassignedWork', () => ({ useUnassignedWork: () => mockUseUnassigned() }));
vi.mock('../services/taskEngineFunctions', () => ({
  taskActionFn: vi.fn(),
  createTaskFn: vi.fn(),
  dailyPlanActionFn: vi.fn(),
  taskEngineRunNowFn: vi.fn(),
}));
vi.mock('../services/dailyPlanService', () => ({
  fetchPlan: (...a: unknown[]) => mockFetchPlan(...a),
  markReviewed: (...a: unknown[]) => mockMarkReviewed(...a),
  savePlanItems: (...a: unknown[]) => mockSaveItems(...a),
  savePlanNotes: (...a: unknown[]) => mockSaveNotes(...a),
  createEmptyPlan: (...a: unknown[]) => mockCreateEmpty(...a),
}));
vi.mock('../services/tasksService', () => ({
  fetchAssigneeOpenTasks: (...a: unknown[]) => mockFetchOpen(...a),
}));

import PlanTomorrowPage from '../pages/PlanTomorrowPage';

const plan = (uid: string, over: Partial<DailyPlan> = {}): DailyPlan => ({
  id: `${DATE}_${uid}`,
  date: DATE,
  assigneeUid: uid,
  managerUid: 'm1',
  status: 'draft',
  reviewed: false,
  source: 'system',
  items: [
    { taskId: `${uid}-t1`, order: 0, title: `${uid} task one`, priority: 'P1', focusReason: 'carry_over' },
    { taskId: `${uid}-t2`, order: 1, title: `${uid} task two`, priority: 'P2', focusReason: 'auto_rank' },
  ],
  ...over,
});

const ROWS: TeamPlanRow[] = [
  { person: { id: 'emp-amina', uid: 'u-amina', name: 'Amina Otieno', jobTitle: 'Account Executive' }, plan: plan('u-amina') },
  { person: { id: 'emp-ben', uid: 'u-ben', name: 'Ben Kiprop', jobTitle: 'Designer' }, plan: plan('u-ben', { reviewed: true, reviewedByName: 'Grace' }) },
  { person: { id: 'emp-cathy', uid: 'u-cathy', name: 'Cathy Njeri', jobTitle: 'Strategist' }, plan: null },
];

beforeEach(() => {
  mockUseTeamPlans.mockReset();
  mockUseUnassigned.mockReset();
  mockMarkReviewed.mockReset();
  mockSaveItems.mockReset();
  mockSaveNotes.mockReset();
  mockCreateEmpty.mockReset();
  mockFetchPlan.mockReset();
  mockFetchOpen.mockReset();
  mockUseTeamPlans.mockReturnValue({ rows: ROWS, isFallback: false, isParentOrg: false, managerUid: 'm1', loading: false, error: null, total: 2, reviewed: 1, pending: 1, reload: vi.fn() });
  mockUseUnassigned.mockReturnValue({ summary: { total: 3, topSources: [{ sourceModule: 'iwo', count: 2 }], sampleTitles: [] }, loading: false, error: null, reload: vi.fn() });
  mockFetchPlan.mockResolvedValue(null);
  mockFetchOpen.mockResolvedValue([{ id: 'open-9', title: 'Brief the photographer', priority: 'P2', status: 'assigned', dueAt: null }]);
  mockMarkReviewed.mockResolvedValue({ ok: true, reviewTaskClosed: false });
  mockSaveItems.mockResolvedValue({ ok: true });
  mockSaveNotes.mockResolvedValue({ ok: true });
  mockCreateEmpty.mockResolvedValue({ created: true, plan: plan('u-cathy', { items: [], source: 'manager' }) });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <PlanTomorrowPage />
    </MemoryRouter>,
  );
}

describe('PlanTomorrowPage', () => {
  it('lists the team with each plan\'s state, opens on the first unreviewed person, and shows both coverage gaps', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('team-rail')).toBeTruthy());
    expect(screen.getByTestId('team-row-emp-amina').textContent).toContain('needs review');
    expect(screen.getByTestId('team-row-emp-ben').textContent).toContain('reviewed');
    expect(screen.getByTestId('team-row-emp-cathy').textContent).toContain('no plan drafted');
    expect(screen.getByTestId('review-progress').textContent).toBe('1 of 2 reviewed');
    await waitFor(() => expect(screen.getByTestId('plan-editor').textContent).toContain('Amina Otieno'));
    expect(screen.getByTestId('coverage-idle').textContent).toContain('Cathy Njeri');
    expect(screen.getByTestId('coverage-unassigned').textContent).toContain('3 open tasks have');
  });

  it('Mark reviewed saves the items (reordered) and the day goal through the callable', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('plan-editor')).toBeTruthy());
    fireEvent.change(screen.getByTestId('plan-day-goal'), { target: { value: 'Get the deck out' } });
    fireEvent.click(screen.getByLabelText('Move u-amina task two up'));
    fireEvent.click(screen.getByTestId('plan-mark-reviewed'));
    await waitFor(() => expect(mockMarkReviewed).toHaveBeenCalledWith(DATE, 'u-amina', { dayGoal: 'Get the deck out', managerNote: '' }));
    expect(mockSaveItems).toHaveBeenCalledWith(DATE, 'u-amina', expect.any(Array));
    const saved = mockSaveItems.mock.calls[0][2] as Array<{ taskId: string }>;
    expect(saved.map((i) => i.taskId)).toEqual(['u-amina-t2', 'u-amina-t1']);
  });

  it('the picker adds open work as a manager pick', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('add-task-picker')).toBeTruthy());
    const pick = await screen.findByTestId('pick-task-open-9');
    fireEvent.click(pick);
    fireEvent.click(screen.getByTestId('plan-save'));
    await waitFor(() => expect(mockSaveItems).toHaveBeenCalled());
    const saved = mockSaveItems.mock.calls[0][2] as Array<{ taskId: string; focusReason?: string }>;
    expect(saved[saved.length - 1]).toMatchObject({ taskId: 'open-9', focusReason: 'manager_pick' });
    expect(mockSaveNotes).toHaveBeenCalled();
  });

  it('"Accept remaining" reviews every unreviewed plan, as drafted', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('accept-remaining')).toBeTruthy());
    fireEvent.click(screen.getByTestId('accept-remaining'));
    await waitFor(() => expect(mockMarkReviewed).toHaveBeenCalledTimes(1));
    expect(mockMarkReviewed).toHaveBeenCalledWith(DATE, 'u-amina');
  });

  it('someone the draft skipped gets a plan started by hand', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('team-row-emp-cathy')).toBeTruthy());
    fireEvent.click(screen.getByTestId('team-row-emp-cathy'));
    const start = await screen.findByTestId('plan-start');
    fireEvent.click(start);
    await waitFor(() => expect(mockCreateEmpty).toHaveBeenCalledWith(DATE, 'u-cathy', 'Cathy Njeri'));
    await waitFor(() => expect(screen.getByTestId('plan-editor')).toBeTruthy());
  });

  it('says so when the list is every active staff member rather than a team', async () => {
    mockUseTeamPlans.mockReturnValue({ rows: ROWS, isFallback: true, isParentOrg: true, managerUid: 'm1', loading: false, error: null, total: 2, reviewed: 1, pending: 1, reload: vi.fn() });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('fallback-notice')).toBeTruthy());
  });
});
