import { describe, expect, it } from 'vitest';
import { computeRollupTiles } from '../rollupTiles';
import type { MasterJobRollup } from '@/modules/assignment/hooks/useMasterJobRollup';

const baseRollup: MasterJobRollup = {
  id: 'mj_1',
  code: 'MJ-0001',
  status: 'OPEN',
  ceilingMinor: 1_000_000,
  allocatedMinor: 0,
  marginPct: 30,
  clientTotalMinor: 1_000_000,
  currency: 'UGX',
  workOrders: [],
};

const wo = (overrides: Partial<MasterJobRollup['workOrders'][number]>) => ({
  id: 'iwo_x',
  code: 'IWO-X',
  subsidiary: { id: 'labyrinth' as const, name: 'Labyrinth' },
  status: 'ISSUED' as const,
  budgetMinor: 100_000,
  cumulativeCostMinor: 0,
  transferPriceMinor: 100_000,
  burnPct: 0,
  currency: 'UGX',
  ...overrides,
});

describe('computeRollupTiles', () => {
  it('returns 0% allocation + green when no IWOs issued', () => {
    const tiles = computeRollupTiles(baseRollup);
    expect(tiles.allocPct).toBe(0);
    expect(tiles.allocTone).toBe('green');
    expect(tiles.stateBreakdown).toBe('');
  });

  it('rounds allocation percentage and stays green below 80%', () => {
    const tiles = computeRollupTiles({ ...baseRollup, allocatedMinor: 600_000 });
    expect(tiles.allocPct).toBe(60);
    expect(tiles.allocTone).toBe('green');
  });

  it('flips to amber at the 80% warning band', () => {
    const tiles = computeRollupTiles({ ...baseRollup, allocatedMinor: 800_000 });
    expect(tiles.allocPct).toBe(80);
    expect(tiles.allocTone).toBe('amber');
  });

  it('flips to red at the 100% ceiling', () => {
    const tiles = computeRollupTiles({ ...baseRollup, allocatedMinor: 1_000_000 });
    expect(tiles.allocPct).toBe(100);
    expect(tiles.allocTone).toBe('red');
  });

  it('reports >100% allocation when the ceiling is exceeded (ChangeOrder needed)', () => {
    // §11.4 — over-allocation should never happen at runtime (the CFn blocks
    // it) but the UI must still degrade safely if it surfaces.
    const tiles = computeRollupTiles({ ...baseRollup, allocatedMinor: 1_250_000 });
    expect(tiles.allocPct).toBe(125);
    expect(tiles.allocTone).toBe('red');
  });

  it('treats ceiling=0 as 0% (no division by zero)', () => {
    const tiles = computeRollupTiles({
      ...baseRollup,
      ceilingMinor: 0,
      allocatedMinor: 50_000,
    });
    expect(tiles.allocPct).toBe(0);
    expect(tiles.allocTone).toBe('green');
  });

  it('flags margin below the 25% green floor as amber', () => {
    const tiles = computeRollupTiles({ ...baseRollup, marginPct: 18.4 });
    expect(tiles.marginTone).toBe('amber');
  });

  it('keeps margin at 25% exactly in the green band', () => {
    const tiles = computeRollupTiles({ ...baseRollup, marginPct: 25 });
    expect(tiles.marginTone).toBe('green');
  });

  it('summarises IWO state counts in lowercase, dot-separated', () => {
    const tiles = computeRollupTiles({
      ...baseRollup,
      workOrders: [
        wo({ id: 'a', status: 'ISSUED' }),
        wo({ id: 'b', status: 'ISSUED' }),
        wo({ id: 'c', status: 'ACCEPTED' }),
        wo({ id: 'd', status: 'CLOSED' }),
      ],
    });
    expect(tiles.stateCounts).toEqual({ ISSUED: 2, ACCEPTED: 1, CLOSED: 1 });
    expect(tiles.stateBreakdown).toBe('issued: 2 · accepted: 1 · closed: 1');
  });
});
