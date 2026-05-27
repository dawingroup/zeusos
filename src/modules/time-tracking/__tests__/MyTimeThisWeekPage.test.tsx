/**
 * MyTimeThisWeekPage tests — Phase 5.D.
 *
 * Render-level coverage: signed-out state, empty state, populated
 * buckets + entries, week-pager interactions, and the
 * subscription-error alert.
 *
 * Date math + grouping helpers have their own unit tests in
 * `time-tracking.service.test.ts`; the page tests just verify the
 * page wires them up correctly.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import type { TimeEntry } from '@/modules/delivery';

const mockSubscribe = vi.fn();
const mockUseUser = vi.fn();

vi.mock('../services/time-tracking.service', async () => {
  const actual = await vi.importActual<typeof import('../services/time-tracking.service')>(
    '../services/time-tracking.service',
  );
  return {
    ...actual,
    // Stub only the subscription — leave the pure helpers (weekRange,
    // groupByIwo, formatMinutes, …) backing the page logic.
    subscribeMyTimeEntries: (
      uid: string,
      from: Date,
      to: Date,
      cb: (entries: TimeEntry[]) => void,
      onErr?: (e: Error) => void,
    ) => mockSubscribe(uid, from, to, cb, onErr),
  };
});

vi.mock('@/core/settings', () => ({
  useCurrentDawinUser: () => mockUseUser(),
}));

import MyTimeThisWeekPage from '../pages/MyTimeThisWeekPage';

function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'te_1',
    iwoId: 'iwo_a',
    userId: 'u_1',
    minutes: 60,
    costMinor: 10_000,
    currency: 'USD',
    entryDate: '2026-05-27T09:00:00Z',
    createdAt: '2026-05-27T09:00:00Z',
    ...over,
  } as TimeEntry;
}

beforeEach(() => {
  mockSubscribe.mockReset();
  mockUseUser.mockReset();
  mockUseUser.mockReturnValue({ dawinUser: { id: 'u_1', email: 'test@zeus' } });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <MyTimeThisWeekPage />
    </MemoryRouter>,
  );
}

describe('MyTimeThisWeekPage', () => {
  it('signed-out — shows a sign-in nudge and skips the subscription', () => {
    mockUseUser.mockReturnValue({ dawinUser: null });
    renderPage();
    expect(screen.getByText(/Sign in to see your time entries/)).toBeTruthy();
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('empty week — renders the empty-state copy', async () => {
    mockSubscribe.mockImplementation((_uid, _from, _to, cb) => {
      cb([]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('my-time-empty')).toBeTruthy();
    });
    expect(screen.getByTestId('my-time-week-total').textContent).toBe('0h 0m');
  });

  it('grouped buckets — one section per IWO with per-IWO totals + entry rows', async () => {
    mockSubscribe.mockImplementation((_uid, _from, _to, cb) => {
      cb([
        entry({ id: '1', iwoId: 'iwo_a', minutes: 30 }),
        entry({ id: '2', iwoId: 'iwo_b', minutes: 120 }),
        entry({ id: '3', iwoId: 'iwo_a', minutes: 45 }),
      ]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('my-time-bucket-iwo_a')).toBeTruthy();
    });
    expect(screen.getByTestId('my-time-bucket-iwo_b')).toBeTruthy();
    expect(screen.getByTestId('my-time-bucket-iwo_a-total').textContent).toBe('1h 15m');
    expect(screen.getByTestId('my-time-bucket-iwo_b-total').textContent).toBe('2h 0m');
    expect(screen.getByTestId('my-time-entry-1')).toBeTruthy();
    expect(screen.getByTestId('my-time-entry-2')).toBeTruthy();
    expect(screen.getByTestId('my-time-entry-3')).toBeTruthy();
    // Page-level weekly total = 30 + 120 + 45 = 195 = 3h 15m
    expect(screen.getByTestId('my-time-week-total').textContent).toBe('3h 15m');
  });

  it('week pager — prev moves to last week, next is disabled on this week', async () => {
    mockSubscribe.mockImplementation((_uid, _from, _to, cb) => {
      cb([]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('my-time-week-label')).toBeTruthy();
    });
    // On the current week, "Next" is disabled (no future weeks).
    expect((screen.getByTestId('my-time-next-week') as HTMLButtonElement).disabled).toBe(true);

    // Clicking "Prev" should fire a new subscription for the previous week.
    const firstCallCount = mockSubscribe.mock.calls.length;
    fireEvent.click(screen.getByTestId('my-time-prev-week'));
    await waitFor(() => {
      expect(mockSubscribe.mock.calls.length).toBeGreaterThan(firstCallCount);
    });
    // After moving back a week, "Next" becomes enabled.
    expect((screen.getByTestId('my-time-next-week') as HTMLButtonElement).disabled).toBe(false);
  });

  it('subscription error → surfaces as an alert region', async () => {
    mockSubscribe.mockImplementation((_uid, _from, _to, _cb, onErr) => {
      onErr?.(new Error('rules denied'));
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('my-time-error')).toBeTruthy();
    });
    expect(screen.getByTestId('my-time-error').textContent).toMatch(/rules denied/);
  });

  it('passes the authenticated uid to the subscription', async () => {
    mockSubscribe.mockImplementation((_uid, _from, _to, cb) => {
      cb([]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalled();
    });
    const [uid] = mockSubscribe.mock.calls[0];
    expect(uid).toBe('u_1');
  });
});
