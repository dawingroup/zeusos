/**
 * Unit Tests: Budget Tier Pricing
 *
 * Tests for budget tier multipliers in estimate calculations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BUDGET_TIER_MULTIPLIERS } from '@/modules/design-manager/types/strategy';
import type { BudgetTier } from '@/modules/design-manager/types/strategy';
import type { DesignItem } from '@/modules/design-manager/types';

describe('Budget Tier Multipliers - Constants', () => {
  it('should define all budget tiers', () => {
    expect(BUDGET_TIER_MULTIPLIERS.economy).toBeDefined();
    expect(BUDGET_TIER_MULTIPLIERS.standard).toBeDefined();
    expect(BUDGET_TIER_MULTIPLIERS.premium).toBeDefined();
    expect(BUDGET_TIER_MULTIPLIERS.luxury).toBeDefined();
  });

  it('should have correct multiplier values', () => {
    expect(BUDGET_TIER_MULTIPLIERS.economy).toBe(0.7);
    expect(BUDGET_TIER_MULTIPLIERS.standard).toBe(1.0);
    expect(BUDGET_TIER_MULTIPLIERS.premium).toBe(1.5);
    expect(BUDGET_TIER_MULTIPLIERS.luxury).toBe(2.5);
  });

  it('should have standard as baseline (1.0x)', () => {
    expect(BUDGET_TIER_MULTIPLIERS.standard).toBe(1.0);
  });

  it('should have economy less than standard', () => {
    expect(BUDGET_TIER_MULTIPLIERS.economy).toBeLessThan(BUDGET_TIER_MULTIPLIERS.standard);
  });

  it('should have premium and luxury greater than standard', () => {
    expect(BUDGET_TIER_MULTIPLIERS.premium).toBeGreaterThan(BUDGET_TIER_MULTIPLIERS.standard);
    expect(BUDGET_TIER_MULTIPLIERS.luxury).toBeGreaterThan(BUDGET_TIER_MULTIPLIERS.standard);
  });
});

describe('Budget Tier Pricing - Cost Calculations', () => {
  it('should apply economy tier (0.7x) to base cost', () => {
    const baseCost = 100000;
    const multiplier = BUDGET_TIER_MULTIPLIERS.economy;
    const adjustedCost = baseCost * multiplier;

    expect(adjustedCost).toBe(70000);
  });

  it('should apply premium tier (1.5x) to base cost', () => {
    const baseCost = 100000;
    const multiplier = BUDGET_TIER_MULTIPLIERS.premium;
    const adjustedCost = baseCost * multiplier;

    expect(adjustedCost).toBe(150000);
  });

  it('should apply luxury tier (2.5x) to base cost', () => {
    const baseCost = 100000;
    const multiplier = BUDGET_TIER_MULTIPLIERS.luxury;
    const adjustedCost = baseCost * multiplier;

    expect(adjustedCost).toBe(250000);
  });

  it('should not change cost for standard tier', () => {
    const baseCost = 100000;
    const multiplier = BUDGET_TIER_MULTIPLIERS.standard;
    const adjustedCost = baseCost * multiplier;

    expect(adjustedCost).toBe(baseCost);
  });
});

describe('Budget Tier Pricing - Design Item Integration', () => {
  let mockItem: Partial<DesignItem>;

  beforeEach(() => {
    mockItem = {
      id: 'test-item-1',
      name: 'Test Wardrobe',
      sourcingType: 'MANUFACTURED',
      strategyContext: {
        strategyId: 'strategy-1',
        budgetTier: 'standard',
        spaceMultiplier: 1,
        scopingConfidence: 0.85,
      },
      procurement: {
        landedCostPerUnit: 50000,
        quantity: 32,
        totalLandedCost: 1600000,
      } as any,
    };
  });

  it('should use budget tier from strategyContext', () => {
    mockItem.strategyContext!.budgetTier = 'premium';

    const baseCost = mockItem.procurement!.landedCostPerUnit!;
    const tier = mockItem.strategyContext!.budgetTier!;
    const adjustedCost = baseCost * BUDGET_TIER_MULTIPLIERS[tier];

    expect(adjustedCost).toBe(75000); // 50000 * 1.5
  });

  it('should fallback to standard tier if not specified', () => {
    delete mockItem.strategyContext!.budgetTier;

    const baseCost = mockItem.procurement!.landedCostPerUnit!;
    const tier: BudgetTier = mockItem.strategyContext?.budgetTier || 'standard';
    const adjustedCost = baseCost * BUDGET_TIER_MULTIPLIERS[tier];

    expect(adjustedCost).toBe(50000); // No change
  });

  it('should apply tier to total cost correctly', () => {
    mockItem.strategyContext!.budgetTier = 'luxury';

    const baseTotalCost = mockItem.procurement!.totalLandedCost!;
    const tier = mockItem.strategyContext!.budgetTier!;
    const adjustedTotalCost = baseTotalCost * BUDGET_TIER_MULTIPLIERS[tier];

    expect(adjustedTotalCost).toBe(4000000); // 1600000 * 2.5
  });
});

describe('Budget Tier Pricing - Multiple Items', () => {
  it('should handle mixed tiers across items', () => {
    const items = [
      { baseCost: 100000, tier: 'economy' as BudgetTier },
      { baseCost: 100000, tier: 'standard' as BudgetTier },
      { baseCost: 100000, tier: 'premium' as BudgetTier },
      { baseCost: 100000, tier: 'luxury' as BudgetTier },
    ];

    const total = items.reduce((sum, item) => {
      return sum + (item.baseCost * BUDGET_TIER_MULTIPLIERS[item.tier]);
    }, 0);

    // 70000 + 100000 + 150000 + 250000 = 570000
    expect(total).toBe(570000);
  });

  it('should calculate average tier multiplier', () => {
    const tiers: BudgetTier[] = ['economy', 'standard', 'premium'];
    const avgMultiplier = tiers.reduce((sum, tier) => sum + BUDGET_TIER_MULTIPLIERS[tier], 0) / tiers.length;

    // (0.7 + 1.0 + 1.5) / 3 = 1.0666...
    expect(avgMultiplier).toBeCloseTo(1.0667, 4);
  });
});

describe('Budget Tier Pricing - Budget Tracking', () => {
  it('should calculate variance for item over budget', () => {
    const allocatedBudget = 100000;
    const actualCost = 150000; // Premium tier adjustment
    const variance = actualCost - allocatedBudget;

    expect(variance).toBe(50000);
    expect(variance).toBeGreaterThan(0); // Over budget
  });

  it('should calculate variance for item under budget', () => {
    const allocatedBudget = 100000;
    const actualCost = 70000; // Economy tier adjustment
    const variance = actualCost - allocatedBudget;

    expect(variance).toBe(-30000);
    expect(variance).toBeLessThan(0); // Under budget
  });

  it('should calculate variance percentage', () => {
    const allocatedBudget = 100000;
    const actualCost = 150000;
    const variance = actualCost - allocatedBudget;
    const variancePercent = (variance / allocatedBudget) * 100;

    expect(variancePercent).toBe(50); // 50% over budget
  });

  it('should identify items over budget', () => {
    const items = [
      { allocated: 100000, actual: 70000 }, // Under
      { allocated: 100000, actual: 150000 }, // Over
      { allocated: 100000, actual: 250000 }, // Way over
      { allocated: 100000, actual: 100000 }, // Exact
    ];

    const itemsOverBudget = items.filter(item => item.actual > item.allocated);

    expect(itemsOverBudget.length).toBe(2);
  });
});

describe('Budget Tier Pricing - Edge Cases', () => {
  it('should handle zero base cost', () => {
    const baseCost = 0;
    const multiplier = BUDGET_TIER_MULTIPLIERS.luxury;
    const adjustedCost = baseCost * multiplier;

    expect(adjustedCost).toBe(0);
  });

  it('should handle very large costs', () => {
    const baseCost = 1000000000; // 1 billion
    const multiplier = BUDGET_TIER_MULTIPLIERS.luxury;
    const adjustedCost = baseCost * multiplier;

    expect(adjustedCost).toBe(2500000000); // 2.5 billion
  });

  it('should preserve precision for decimal costs', () => {
    const baseCost = 123.45;
    const multiplier = BUDGET_TIER_MULTIPLIERS.premium;
    const adjustedCost = baseCost * multiplier;

    expect(adjustedCost).toBeCloseTo(185.175, 2);
  });

  it('should handle negative variance correctly', () => {
    const allocated = 100000;
    const actual = 70000;
    const variance = actual - allocated;
    const variancePercent = (variance / allocated) * 100;

    expect(variance).toBe(-30000);
    expect(variancePercent).toBe(-30); // 30% under budget
  });
});

describe('Budget Tier Pricing - Rounding', () => {
  it('should round to nearest integer for display', () => {
    const baseCost = 100000;
    const multiplier = BUDGET_TIER_MULTIPLIERS.economy; // 0.7
    const adjustedCost = Math.round(baseCost * multiplier);

    expect(adjustedCost).toBe(70000);
  });

  it('should handle rounding for premium tier', () => {
    const baseCost = 123456;
    const multiplier = BUDGET_TIER_MULTIPLIERS.premium; // 1.5
    const adjustedCost = Math.round(baseCost * multiplier);

    expect(adjustedCost).toBe(185184);
  });
});
