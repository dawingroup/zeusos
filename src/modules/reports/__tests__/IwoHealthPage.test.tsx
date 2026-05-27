/**
 * IwoHealthPage tests — Phase 6.UI Reports v1.
 *
 * Mirror of BurnAndSlaPage's test structure, scoped up to parent-org.
 * Covers:
 *   • buildBrandGroups — grouping by subsidiaryOrgId, per-brand stats,
 *     sort order (overheating-count desc, then total desc).
 *   • sortRows — BLOCKED → WARN → OK within a brand, then by burn %.
 *   • applyFilter — all / overheating / on-track.
 *   • render: empty state, portfolio summary tiles update with
 *     subscription data, filter chip hides on-track rows, subscription
 *     error surfaces as an alert.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import type { InternalWorkOrder } from '@/modules/assignment';

const mockSubscribe = vi.fn();
vi.mock('@/modules/traffic/services/traffic.service', () => ({
  subscribeActiveIwos: (
    cb: (iwos: InternalWorkOrder[]) => void,
    onErr: (e: Error) => void,
  ) => mockSubscribe(cb, onErr),
}));

import IwoHealthPage, { __testing } from '../pages/IwoHealthPage';

function iwo(over: Partial<InternalWorkOrder> = {}): InternalWorkOrder {
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
    ...over,
  } as InternalWorkOrder;
}

describe('IwoHealthPage helpers', () => {
  describe('buildRow', () => {
    it('produces a 50% burn meter for a half-spent budget', () => {
      const row = __testing.buildRow(iwo());
      expect(row.meter.percentage).toBe(50);
      expect(row.meter.status).toBe('OK');
    });

    it('flags BLOCKED at 100%', () => {
      const row = __testing.buildRow(iwo({ cumulativeCostMinor: 1_000_000 }));
      expect(row.meter.status).toBe('BLOCKED');
    });
  });

  describe('sortRows', () => {
    it('within a brand puts BLOCKED → WARN → OK', () => {
      const rows = [
        __testing.buildRow(iwo({ id: 'ok', cumulativeCostMinor: 100_000 })),
        __testing.buildRow(iwo({ id: 'blocked', cumulativeCostMinor: 1_000_000 })),
        __testing.buildRow(iwo({ id: 'warn', cumulativeCostMinor: 900_000 })),
      ];
      rows.sort(__testing.sortRows);
      expect(rows.map(r => r.iwo.id)).toEqual(['blocked', 'warn', 'ok']);
    });

    it('within the same status, sorts by burn % desc', () => {
      const rows = [
        __testing.buildRow(iwo({ id: 'low', cumulativeCostMinor: 200_000 })),
        __testing.buildRow(iwo({ id: 'high', cumulativeCostMinor: 800_000 })),
      ];
      rows.sort(__testing.sortRows);
      expect(rows[0].iwo.id).toBe('high');
    });
  });

  describe('applyFilter', () => {
    const rows = [
      __testing.buildRow(iwo({ id: 'ok', cumulativeCostMinor: 100_000 })),
      __testing.buildRow(iwo({ id: 'blocked', cumulativeCostMinor: 1_000_000 })),
    ];
    it('overheating returns only WARN+BLOCKED', () => {
      expect(__testing.applyFilter(rows, 'overheating').map(r => r.iwo.id)).toEqual(['blocked']);
    });
    it('on-track returns only OK', () => {
      expect(__testing.applyFilter(rows, 'on-track').map(r => r.iwo.id)).toEqual(['ok']);
    });
    it('all returns everything', () => {
      expect(__testing.applyFilter(rows, 'all')).toHaveLength(2);
    });
  });

  describe('buildBrandGroups', () => {
    it('emits a group per known brand even when empty', () => {
      const groups = __testing.buildBrandGroups([]);
      const brandIds = groups.map(g => g.brandId);
      expect(brandIds).toContain('zeus-the-agency');
      expect(brandIds).toContain('zeus-digital');
      expect(brandIds).toContain('labyrinth');
      expect(brandIds).toContain('odd-gorilla');
      expect(brandIds).toContain('house-of-zeus');
      // Empty brands carry zero counts.
      const zta = groups.find(g => g.brandId === 'zeus-the-agency')!;
      expect(zta.total).toBe(0);
      expect(zta.overheating).toBe(0);
      expect(zta.avgBurnPct).toBe(0);
    });

    it('places the brand with the most overheating IWOs first', () => {
      const groups = __testing.buildBrandGroups([
        iwo({ id: 'a', subsidiaryOrgId: 'zeus-the-agency', cumulativeCostMinor: 100_000 }),
        iwo({ id: 'b', subsidiaryOrgId: 'labyrinth', cumulativeCostMinor: 1_000_000 }),
        iwo({ id: 'c', subsidiaryOrgId: 'labyrinth', cumulativeCostMinor: 950_000 }),
      ]);
      // Labyrinth has 2 overheating (blocked + warn); ZTA has 0.
      expect(groups[0].brandId).toBe('labyrinth');
      expect(groups[0].overheating).toBe(2);
    });

    it('within a brand, rows sort BLOCKED → WARN → OK', () => {
      const groups = __testing.buildBrandGroups([
        iwo({ id: 'ok', subsidiaryOrgId: 'zeus-the-agency', cumulativeCostMinor: 100_000 }),
        iwo({ id: 'bl', subsidiaryOrgId: 'zeus-the-agency', cumulativeCostMinor: 1_000_000 }),
        iwo({ id: 'wn', subsidiaryOrgId: 'zeus-the-agency', cumulativeCostMinor: 900_000 }),
      ]);
      const zta = groups.find(g => g.brandId === 'zeus-the-agency')!;
      expect(zta.rows.map(r => r.iwo.id)).toEqual(['bl', 'wn', 'ok']);
    });

    it('drops IWOs whose subsidiaryOrgId is not a known delivery brand', () => {
      const groups = __testing.buildBrandGroups([
        iwo({ id: 'unknown', subsidiaryOrgId: 'unmapped-brand' as never }),
      ]);
      const total = groups.reduce((s, g) => s + g.total, 0);
      expect(total).toBe(0);
    });

    it('computes per-brand avgBurnPct', () => {
      const groups = __testing.buildBrandGroups([
        iwo({ id: 'a', subsidiaryOrgId: 'zeus-the-agency', cumulativeCostMinor: 250_000 }), // 25%
        iwo({ id: 'b', subsidiaryOrgId: 'zeus-the-agency', cumulativeCostMinor: 750_000 }), // 75%
      ]);
      const zta = groups.find(g => g.brandId === 'zeus-the-agency')!;
      expect(zta.avgBurnPct).toBe(50);
    });
  });
});

describe('IwoHealthPage render', () => {
  it('shows the empty state when the subscription returns no IWOs', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([]);
      return () => {};
    });
    render(
      <MemoryRouter>
        <IwoHealthPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('reports-empty')).toBeTruthy();
    });
    expect(screen.getByTestId('reports-portfolio-total').textContent).toBe('0');
    expect(screen.getByTestId('reports-portfolio-overheating').textContent).toBe('0');
  });

  it('portfolio summary tiles reflect the subscription contents', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([
        iwo({ id: 'a', subsidiaryOrgId: 'zeus-the-agency', cumulativeCostMinor: 100_000 }), // 10% OK
        iwo({ id: 'b', subsidiaryOrgId: 'labyrinth', cumulativeCostMinor: 1_000_000 }),     // 100% BLOCKED
      ]);
      return () => {};
    });
    render(
      <MemoryRouter>
        <IwoHealthPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('reports-portfolio-total').textContent).toBe('2');
    });
    expect(screen.getByTestId('reports-portfolio-overheating').textContent).toBe('1');
    // Avg burn = (10 + 100) / 2 = 55%
    expect(screen.getByTestId('reports-portfolio-avg-burn').textContent).toBe('55%');
  });

  it('renders one section per brand with active IWOs and skips empty brands under non-"all" filters', async () => {
    mockSubscribe.mockImplementation((cb) => {
      cb([
        iwo({ id: 'a', subsidiaryOrgId: 'zeus-the-agency', cumulativeCostMinor: 1_000_000 }),
      ]);
      return () => {};
    });
    render(
      <MemoryRouter>
        <IwoHealthPage />
      </MemoryRouter>,
    );
    // Under "all", every brand section renders (with empty-state copy where applicable).
    await waitFor(() => {
      expect(screen.getByTestId('reports-brand-zeus-the-agency')).toBeTruthy();
    });
    expect(screen.getByTestId('reports-brand-labyrinth')).toBeTruthy();
    expect(screen.getByTestId('reports-brand-labyrinth-empty')).toBeTruthy();

    // Switch to overheating — labyrinth section vanishes (no overheating rows).
    fireEvent.click(screen.getByTestId('reports-filter-overheating'));
    expect(screen.queryByTestId('reports-brand-labyrinth')).toBeNull();
    expect(screen.getByTestId('reports-brand-zeus-the-agency')).toBeTruthy();
    expect(screen.getByTestId('reports-row-a')).toBeTruthy();
  });

  it('surfaces subscription errors via the alert region', async () => {
    mockSubscribe.mockImplementation((_cb, onErr) => {
      onErr(new Error('permission-denied'));
      return () => {};
    });
    render(
      <MemoryRouter>
        <IwoHealthPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByTestId('reports-error')).toBeTruthy();
    });
    expect(screen.getByTestId('reports-error').textContent).toMatch(/permission-denied/);
  });
});
