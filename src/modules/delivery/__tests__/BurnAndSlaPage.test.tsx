/**
 * BurnAndSlaPage tests — Phase 6.UI.D.2 (Burn & SLA roll-up).
 *
 * The page itself is mostly Firestore + presentation glue; the
 * interesting behaviour is the sort + filter + SLA-format logic.
 * Those helpers are exported via `__testing` so the unit tests
 * exercise them without a render pass. A small render smoke test
 * verifies the page mounts and renders rows from a stubbed
 * subscription.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import type { InternalWorkOrder } from '@/modules/assignment';

// Mock subscribeIWOActive BEFORE importing the page so the import
// graph picks up the stub.
const mockSubscribe = vi.fn();
vi.mock('../services/firestore', () => ({
  subscribeIWOActive: (
    _sub: string,
    cb: (iwos: InternalWorkOrder[]) => void,
    onErr: (e: Error) => void,
  ) => mockSubscribe(_sub, cb, onErr),
}));

vi.mock('@/core/settings', () => ({
  useCurrentDawinUser: () => ({
    dawinUser: {
      id: 'u1',
      email: 'tester@zeus.test',
      subsidiaryAccess: [{ subsidiaryOrgId: 'zeus-the-agency', role: 'lead' }],
    },
  }),
}));

vi.mock('../components/deliveryAccess', () => ({
  resolveHomeSubsidiaryId: () => 'zeus-the-agency',
}));

vi.mock('@/core/navigation/manifest', () => ({
  isConflictIsolated: () => false,
}));

import BurnAndSlaPage, { __testing } from '../pages/BurnAndSlaPage';

function iwo(overrides: Partial<InternalWorkOrder> = {}): InternalWorkOrder {
  return {
    id: 'iwo_1',
    code: 'IWO-001',
    masterJobId: 'mj_1',
    state: 'IN_PROGRESS',
    sourceOrgId: 'zeus-group',
    subsidiaryOrgId: 'zeus-the-agency',
    budgetMinor: 1_000_000,
    cumulativeCostMinor: 500_000,
    currency: 'USD',
    issuedByUserId: 'u_am',
    issuedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  } as InternalWorkOrder;
}

describe('BurnAndSlaPage helpers', () => {
  describe('buildRow', () => {
    it('produces a 50% burn meter for a half-spent budget', () => {
      const row = __testing.buildRow(iwo(), Date.now());
      expect(row.meter.percentage).toBe(50);
      expect(row.meter.status).toBe('OK');
      expect(row.slaHoursLeft).toBe(null);
    });

    it('flags BLOCKED on a 100% spent budget', () => {
      const row = __testing.buildRow(
        iwo({ cumulativeCostMinor: 1_000_000 }),
        Date.now(),
      );
      expect(row.meter.percentage).toBe(100);
      expect(row.meter.status).toBe('BLOCKED');
    });

    it('flags WARN at 90% spent', () => {
      const row = __testing.buildRow(
        iwo({ cumulativeCostMinor: 900_000 }),
        Date.now(),
      );
      expect(row.meter.status).toBe('WARN');
    });

    it('computes positive hours-left when slaDueAt is in the future', () => {
      const future = new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString();
      const row = __testing.buildRow(iwo({ slaDueAt: future }), Date.now());
      expect(row.slaHoursLeft).not.toBeNull();
      expect(row.slaHoursLeft!).toBeGreaterThan(4);
      expect(row.slaHoursLeft!).toBeLessThan(5.1);
    });

    it('produces negative hours-left when slaDueAt has passed', () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const row = __testing.buildRow(iwo({ slaDueAt: past }), Date.now());
      expect(row.slaHoursLeft).not.toBeNull();
      expect(row.slaHoursLeft!).toBeLessThan(0);
    });
  });

  describe('sortRows', () => {
    it('puts BLOCKED rows before WARN before OK', () => {
      const now = Date.now();
      const rows = [
        __testing.buildRow(iwo({ id: 'a', cumulativeCostMinor: 100_000 }), now), // OK
        __testing.buildRow(iwo({ id: 'b', cumulativeCostMinor: 1_000_000 }), now), // BLOCKED
        __testing.buildRow(iwo({ id: 'c', cumulativeCostMinor: 900_000 }), now), // WARN
      ];
      rows.sort(__testing.sortRows);
      expect(rows.map(r => r.iwo.id)).toEqual(['b', 'c', 'a']);
    });

    it('within the same status bucket, sorts by burn percentage descending', () => {
      const now = Date.now();
      const rows = [
        __testing.buildRow(iwo({ id: 'low', cumulativeCostMinor: 200_000 }), now),
        __testing.buildRow(iwo({ id: 'high', cumulativeCostMinor: 800_000 }), now),
        __testing.buildRow(iwo({ id: 'mid', cumulativeCostMinor: 500_000 }), now),
      ];
      rows.sort(__testing.sortRows);
      expect(rows.map(r => r.iwo.id)).toEqual(['high', 'mid', 'low']);
    });

    it('on a burn tie, sorts by tighter SLA first', () => {
      const now = Date.now();
      const oneHourLeft = new Date(now + 60 * 60 * 1000).toISOString();
      const sixHoursLeft = new Date(now + 6 * 60 * 60 * 1000).toISOString();
      const rows = [
        __testing.buildRow(iwo({ id: 'late', slaDueAt: sixHoursLeft }), now),
        __testing.buildRow(iwo({ id: 'soon', slaDueAt: oneHourLeft }), now),
      ];
      rows.sort(__testing.sortRows);
      expect(rows.map(r => r.iwo.id)).toEqual(['soon', 'late']);
    });
  });

  describe('applyFilter', () => {
    const now = Date.now();
    const okRow = __testing.buildRow(iwo({ id: 'ok', cumulativeCostMinor: 100_000 }), now);
    const warnRow = __testing.buildRow(iwo({ id: 'warn', cumulativeCostMinor: 900_000 }), now);
    const blockedRow = __testing.buildRow(iwo({ id: 'blocked', cumulativeCostMinor: 1_000_000 }), now);
    const rows = [blockedRow, warnRow, okRow];

    it('all → returns everything', () => {
      expect(__testing.applyFilter(rows, 'all')).toHaveLength(3);
    });

    it('overheating → returns only WARN + BLOCKED', () => {
      const filtered = __testing.applyFilter(rows, 'overheating');
      expect(filtered.map(r => r.iwo.id).sort()).toEqual(['blocked', 'warn']);
    });

    it('on-track → returns only OK', () => {
      const filtered = __testing.applyFilter(rows, 'on-track');
      expect(filtered.map(r => r.iwo.id)).toEqual(['ok']);
    });
  });

  describe('formatSla', () => {
    it('null → em-dash', () => {
      expect(__testing.formatSla(null)).toBe('—');
    });
    it('negative → marked overdue', () => {
      expect(__testing.formatSla(-3.5)).toBe('4h overdue');
    });
    it('under 1h → less than 1h', () => {
      expect(__testing.formatSla(0.5)).toBe('< 1h left');
    });
    it('under 24h → hours left', () => {
      expect(__testing.formatSla(8)).toBe('8h left');
    });
    it('over 24h → days left', () => {
      expect(__testing.formatSla(36)).toBe('1d left');
    });
  });
});

describe('BurnAndSlaPage render', () => {
  it('shows an empty state when there are no active IWOs', async () => {
    mockSubscribe.mockImplementation((_sub, cb) => {
      cb([]);
      return () => {};
    });
    render(
      <MemoryRouter>
        <BurnAndSlaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('burn-sla-empty')).toBeTruthy();
    });
    expect(screen.getByTestId('burn-sla-empty').textContent).toMatch(/No active work orders/);
  });

  it('renders one row per active IWO and updates the count chips', async () => {
    mockSubscribe.mockImplementation((_sub, cb) => {
      cb([
        iwo({ id: 'iwo_a', code: 'IWO-A', cumulativeCostMinor: 100_000 }),
        iwo({ id: 'iwo_b', code: 'IWO-B', cumulativeCostMinor: 1_000_000 }),
      ]);
      return () => {};
    });
    render(
      <MemoryRouter>
        <BurnAndSlaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('burn-sla-list')).toBeTruthy();
    });
    expect(screen.getByTestId('burn-sla-row-iwo_a')).toBeTruthy();
    expect(screen.getByTestId('burn-sla-row-iwo_b')).toBeTruthy();
    expect(screen.getByTestId('burn-sla-count-all').textContent).toMatch(/\(2\)/);
    expect(screen.getByTestId('burn-sla-count-overheating').textContent).toMatch(/\(1\)/);
    expect(screen.getByTestId('burn-sla-count-on-track').textContent).toMatch(/\(1\)/);
  });

  it('filter chip "overheating" hides on-track rows', async () => {
    mockSubscribe.mockImplementation((_sub, cb) => {
      cb([
        iwo({ id: 'iwo_a', code: 'IWO-A', cumulativeCostMinor: 100_000 }),
        iwo({ id: 'iwo_b', code: 'IWO-B', cumulativeCostMinor: 1_000_000 }),
      ]);
      return () => {};
    });
    render(
      <MemoryRouter>
        <BurnAndSlaPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('burn-sla-row-iwo_a')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('burn-sla-filter-overheating'));
    expect(screen.queryByTestId('burn-sla-row-iwo_a')).toBeNull();
    expect(screen.getByTestId('burn-sla-row-iwo_b')).toBeTruthy();
  });
});
