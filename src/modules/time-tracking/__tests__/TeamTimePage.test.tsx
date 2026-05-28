/**
 * TeamTimePage tests — Phase 5.D team-time view.
 *
 * Render-level coverage of the cross-brand roll-up. The page resolves
 * its scope from the viewer's org context:
 *   • parent-org admin → ALL brands (`subscribeTeamTimeEntries`)
 *   • subsidiary lead  → THEIR brand (`subscribeTeamTimeEntriesByBrand`)
 *   • no org context   → empty state, no subscription
 *
 * The bulk of the rendering assertions (empty state, member buckets,
 * counts, week pager, totals, error alert) run under the default
 * parent-org scope. Two extra tests pin the brand + none branches.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import type { TimeEntry } from '@/modules/delivery';

const mockSubscribe = vi.fn();
const mockSubscribeByBrand = vi.fn();
const mockUseUser = vi.fn();

vi.mock('../services/time-tracking.service', async () => {
  const actual = await vi.importActual<typeof import('../services/time-tracking.service')>(
    '../services/time-tracking.service',
  );
  return {
    ...actual,
    subscribeTeamTimeEntries: (
      from: Date,
      to: Date,
      cb: (entries: TimeEntry[]) => void,
      onErr?: (e: Error) => void,
    ) => mockSubscribe(from, to, cb, onErr),
    subscribeTeamTimeEntriesByBrand: (
      orgId: string,
      from: Date,
      to: Date,
      cb: (entries: TimeEntry[]) => void,
      onErr?: (e: Error) => void,
    ) => mockSubscribeByBrand(orgId, from, to, cb, onErr),
  };
});

// Resolve uid → name deterministically in tests (avoids hitting Firestore).
vi.mock('../services/user-directory.service', () => ({
  resolveUserNames: (uids: string[]) =>
    Promise.resolve(Object.fromEntries(uids.map((u) => [u, `Name(${u})`]))),
}));

vi.mock('@/core/settings', () => ({
  useCurrentDawinUser: () => mockUseUser(),
}));

import TeamTimePage from '../pages/TeamTimePage';

// Org-context fixtures. The real `isParentOrgUser` / `resolveHomeSubsidiaryId`
// helpers run against these (only the user hook is mocked).
const PARENT_USER = {
  id: 'u_admin',
  email: 'admin@zeus',
  globalRole: 'admin',
  subsidiaryAccess: [{ subsidiaryId: 'zeus-group', hasAccess: true }],
};
const BRAND_LEAD_USER = {
  id: 'u_lead',
  email: 'lead@zeus',
  globalRole: 'manager',
  subsidiaryAccess: [{ subsidiaryId: 'zeus-digital', hasAccess: true }],
};

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
  mockSubscribeByBrand.mockReset();
  mockUseUser.mockReset();
  // Default: parent-org admin → cross-brand scope.
  mockUseUser.mockReturnValue({ dawinUser: PARENT_USER });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <TeamTimePage />
    </MemoryRouter>,
  );
}

describe('TeamTimePage', () => {
  it('empty week — renders empty-state copy + zeroed header', async () => {
    mockSubscribe.mockImplementation((_f, _t, cb) => {
      cb([]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('team-time-empty')).toBeTruthy();
    });
    expect(screen.getByTestId('team-time-people-count').textContent).toBe('0');
    expect(screen.getByTestId('team-time-week-total').textContent).toBe('0h 0m');
  });

  it('groups by person with per-member totals + IWO/entry counts', async () => {
    mockSubscribe.mockImplementation((_f, _t, cb) => {
      cb([
        entry({ id: '1', userId: 'u_a', iwoId: 'iwo_1', minutes: 30, costMinor: 30_000 }),
        entry({ id: '2', userId: 'u_a', iwoId: 'iwo_2', minutes: 90, costMinor: 90_000 }),
        entry({ id: '3', userId: 'u_b', iwoId: 'iwo_1', minutes: 240, costMinor: 240_000 }),
      ]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('team-time-member-u_a')).toBeTruthy();
    });
    expect(screen.getByTestId('team-time-member-u_b')).toBeTruthy();
    // u_a: 30 + 90 = 120 = 2h 0m
    expect(screen.getByTestId('team-time-member-u_a-total').textContent).toBe('2h 0m');
    // u_b: 240 = 4h 0m
    expect(screen.getByTestId('team-time-member-u_b-total').textContent).toBe('4h 0m');
    // Header rollups (hours + cost)
    expect(screen.getByTestId('team-time-people-count').textContent).toBe('2');
    expect(screen.getByTestId('team-time-week-total').textContent).toBe('6h 0m');
    expect(screen.getByTestId('team-time-week-cost').textContent).toBe('USD 3,600.00');
    // Per-member cost roll-up.
    expect(screen.getByTestId('team-time-member-u_a-cost').textContent).toBe('USD 1,200.00');
    expect(screen.getByTestId('team-time-member-u_b-cost').textContent).toBe('USD 2,400.00');
    // Member metadata line shows IWO + entry counts.
    expect(screen.getByTestId('team-time-member-u_a').textContent).toContain('2 IWOs');
    expect(screen.getByTestId('team-time-member-u_b').textContent).toContain('1 IWO');
  });

  it('resolves uid → display name once the directory lookup returns', async () => {
    mockSubscribe.mockImplementation((_f, _t, cb) => {
      cb([entry({ id: '1', userId: 'u_zed', minutes: 60 })]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('team-time-member-u_zed-name').textContent).toBe('Name(u_zed)');
    });
  });

  it('orders members by total minutes desc', async () => {
    mockSubscribe.mockImplementation((_f, _t, cb) => {
      cb([
        entry({ id: '1', userId: 'u_low', minutes: 30 }),
        entry({ id: '2', userId: 'u_high', minutes: 300 }),
      ]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('team-time-member-list')).toBeTruthy();
    });
    const list = screen.getByTestId('team-time-member-list');
    // Match only the row <li> (exact `team-time-member-{uid}`), excluding
    // the per-row -name / -total / -cost sub-elements.
    const order = Array.from(list.querySelectorAll('[data-testid^="team-time-member-"]'))
      .map(el => el.getAttribute('data-testid'))
      .filter((t): t is string => !!t && !/-(?:name|total|cost)$/.test(t));
    expect(order[0]).toBe('team-time-member-u_high');
    expect(order[1]).toBe('team-time-member-u_low');
  });

  it('week pager — next disabled on this week, prev re-subscribes', async () => {
    mockSubscribe.mockImplementation((_f, _t, cb) => {
      cb([]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('team-time-week-label')).toBeTruthy();
    });
    expect((screen.getByTestId('team-time-next-week') as HTMLButtonElement).disabled).toBe(true);
    const before = mockSubscribe.mock.calls.length;
    fireEvent.click(screen.getByTestId('team-time-prev-week'));
    await waitFor(() => {
      expect(mockSubscribe.mock.calls.length).toBeGreaterThan(before);
    });
    expect((screen.getByTestId('team-time-next-week') as HTMLButtonElement).disabled).toBe(false);
  });

  it('subscription error (incl. permission-denied) surfaces in the alert region', async () => {
    mockSubscribe.mockImplementation((_f, _t, _cb, onErr) => {
      onErr?.(new Error('Missing or insufficient permissions.'));
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('team-time-error')).toBeTruthy();
    });
    expect(screen.getByTestId('team-time-error').textContent).toMatch(/insufficient permissions/);
  });

  it('subsidiary lead → brand-scoped subscription on their home org', async () => {
    mockUseUser.mockReturnValue({ dawinUser: BRAND_LEAD_USER });
    mockSubscribeByBrand.mockImplementation((_orgId, _f, _t, cb) => {
      cb([entry({ id: '1', userId: 'u_a', minutes: 60 })]);
      return () => {};
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('team-time-member-u_a')).toBeTruthy();
    });
    // Brand path used; cross-brand path untouched.
    expect(mockSubscribeByBrand).toHaveBeenCalled();
    expect(mockSubscribeByBrand.mock.calls[0][0]).toBe('zeus-digital');
    expect(mockSubscribe).not.toHaveBeenCalled();
    // Scope note reflects the brand-only copy.
    expect(screen.getByTestId('team-time-scope-note').textContent).toMatch(/your brand/i);
  });

  it('no org context → empty state, no subscription on either path', () => {
    mockUseUser.mockReturnValue({ dawinUser: null });
    renderPage();
    expect(screen.getByTestId('team-time-empty')).toBeTruthy();
    expect(mockSubscribe).not.toHaveBeenCalled();
    expect(mockSubscribeByBrand).not.toHaveBeenCalled();
    expect(screen.getByTestId('team-time-scope-note').textContent).toMatch(/no team-time scope/i);
  });
});
