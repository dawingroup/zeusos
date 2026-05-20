/**
 * Tests for getDesignItemTotalCost + computeCostDivergence (P9c-2).
 *
 * Rather than hand-craft full DesignItem mocks (the type has ~30 fields
 * most of which are irrelevant to costing), we cast minimal fixtures to
 * DesignItem. The helper only reads sourcingType + the four pricing
 * unions, so the narrow fixture is faithful to the production path.
 */

import { describe, it, expect } from 'vitest';
import {
  getDesignItemTotalCost,
  computeCostDivergence,
} from '../designItemCost';
import type { DesignItem } from '../../types';

function mk(partial: Partial<DesignItem>): DesignItem {
  return partial as DesignItem;
}

describe('getDesignItemTotalCost', () => {
  it('returns null for missing item', () => {
    expect(getDesignItemTotalCost(null)).toBeNull();
    expect(getDesignItemTotalCost(undefined)).toBeNull();
  });

  it('resolves MANUFACTURED to manufacturing.totalCost with UGX default', () => {
    const item = mk({
      sourcingType: 'MANUFACTURED',
      manufacturing: { totalCost: 1_500_000 } as DesignItem['manufacturing'],
    });
    expect(getDesignItemTotalCost(item)).toEqual({
      total: 1_500_000,
      currency: 'UGX',
      source: 'manufacturing',
    });
  });

  it('prefers manufacturingRollup over manufacturing when rollup has cost', () => {
    const item = mk({
      sourcingType: 'CUSTOM_FURNITURE_MILLWORK',
      manufacturing: { totalCost: 100 } as DesignItem['manufacturing'],
      manufacturingRollup: {
        totalCost: 2_000_000,
        currency: 'UGX',
      } as DesignItem['manufacturingRollup'],
    });
    expect(getDesignItemTotalCost(item)).toEqual({
      total: 2_000_000,
      currency: 'UGX',
      source: 'manufacturing_rollup',
    });
  });

  it('falls through from empty rollup to manual manufacturing', () => {
    // Rollup present but zero (no cabinets contributed) — helper should
    // ignore it and use the operator-curated manufacturing breakdown.
    const item = mk({
      sourcingType: 'CUSTOM_FURNITURE_MILLWORK',
      manufacturing: { totalCost: 750_000 } as DesignItem['manufacturing'],
      manufacturingRollup: {
        totalCost: 0,
        currency: 'UGX',
      } as DesignItem['manufacturingRollup'],
    });
    expect(getDesignItemTotalCost(item)?.source).toBe('manufacturing');
    expect(getDesignItemTotalCost(item)?.total).toBe(750_000);
  });

  it('resolves PROCURED to totalLandedCost in targetCurrency', () => {
    const item = mk({
      sourcingType: 'PROCURED',
      procurement: {
        totalLandedCost: 3_700_000,
        targetCurrency: 'UGX',
      } as DesignItem['procurement'],
    });
    expect(getDesignItemTotalCost(item)).toEqual({
      total: 3_700_000,
      currency: 'UGX',
      source: 'procurement',
    });
  });

  it('resolves ARCHITECTURAL (via legacy mapping) to architectural pricing', () => {
    // ARCHITECTURAL is legacy for DESIGN_DOCUMENT — helper should map it
    // through normalizeSourcingType before switching.
    const item = mk({
      sourcingType: 'ARCHITECTURAL',
      architectural: {
        totalCost: 500,
        currency: 'USD',
      } as DesignItem['architectural'],
    });
    expect(getDesignItemTotalCost(item)).toEqual({
      total: 500,
      currency: 'USD',
      source: 'architectural',
    });
  });

  it('resolves CONSTRUCTION to construction.totalCost', () => {
    const item = mk({
      sourcingType: 'CONSTRUCTION',
      construction: {
        totalCost: 12_000_000,
        currency: 'UGX',
      } as DesignItem['construction'],
    });
    expect(getDesignItemTotalCost(item)).toEqual({
      total: 12_000_000,
      currency: 'UGX',
      source: 'construction',
    });
  });

  it('returns null when sourcing is set but pricing block is missing', () => {
    // Unpriced items must return null, not { total: 0 }. Reconciliation
    // UI distinguishes "not priced" from "priced at zero".
    expect(getDesignItemTotalCost(mk({ sourcingType: 'PROCURED' }))).toBeNull();
    expect(getDesignItemTotalCost(mk({ sourcingType: 'MANUFACTURED' }))).toBeNull();
  });

  it('returns null when pricing block is present but totalCost is 0', () => {
    const item = mk({
      sourcingType: 'CONSTRUCTION',
      construction: { totalCost: 0, currency: 'UGX' } as DesignItem['construction'],
    });
    expect(getDesignItemTotalCost(item)).toBeNull();
  });
});

describe('computeCostDivergence', () => {
  const designCost = { total: 1_000_000, currency: 'UGX', source: 'manufacturing' as const };

  it('returns no-data when designCost is null', () => {
    expect(computeCostDivergence(null, [{ amount: 100, currency: 'UGX' }])).toEqual({
      mismatch: 'no-data',
    });
  });

  it('returns no-data when boq list is empty', () => {
    expect(computeCostDivergence(designCost, [])).toEqual({ mismatch: 'no-data' });
  });

  it('returns currency mismatch when boq rows use different currencies', () => {
    expect(
      computeCostDivergence(designCost, [
        { amount: 500, currency: 'UGX' },
        { amount: 200, currency: 'USD' },
      ]),
    ).toEqual({ mismatch: 'currency' });
  });

  it('returns currency mismatch when boq currency != design currency', () => {
    expect(
      computeCostDivergence(designCost, [{ amount: 500, currency: 'USD' }]),
    ).toEqual({ mismatch: 'currency' });
  });

  it('computes positive delta when design > boq', () => {
    const result = computeCostDivergence(designCost, [
      { amount: 400_000, currency: 'UGX' },
      { amount: 300_000, currency: 'UGX' },
    ]);
    expect(result).toEqual({
      designCost: 1_000_000,
      boqTotal: 700_000,
      delta: 300_000,
      // (1_000_000 - 700_000) / 700_000 * 100
      percent: expect.closeTo(42.857, 2),
      currency: 'UGX',
    });
  });

  it('computes negative delta when design < boq', () => {
    const result = computeCostDivergence(designCost, [
      { amount: 1_500_000, currency: 'UGX' },
    ]);
    expect(result).toMatchObject({
      delta: -500_000,
      currency: 'UGX',
    });
  });

  it('returns null percent when boqTotal is 0', () => {
    // Percent divergence is undefined when the denominator is zero;
    // the UI should render the raw delta instead of a percent.
    const result = computeCostDivergence(designCost, [
      { amount: 0, currency: 'UGX' },
    ]);
    expect(result).toMatchObject({
      boqTotal: 0,
      delta: 1_000_000,
      percent: null,
    });
  });
});
