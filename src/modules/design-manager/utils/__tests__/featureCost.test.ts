/**
 * P17/F19 — feature-library cost contribution tests.
 *
 * Pins the intensity × skill × setup arithmetic and the quantity
 * scaling rule (per-part hours multiply; setup doesn't).
 */
import { describe, it, expect } from 'vitest';
import {
  calculatePartFeatureCost,
  scaleFeatureCostByQuantity,
} from '../featureCost';
import type { FeatureLibraryItem } from '../../types/featureLibrary';

const mkFeature = (
  id: string,
  overrides: Partial<FeatureLibraryItem> = {},
): Pick<FeatureLibraryItem, 'id' | 'code' | 'name' | 'estimatedTime' | 'costFactors'> => ({
  id,
  code: `F-${id}`,
  name: `Feature ${id}`,
  estimatedTime: { minimum: 0.5, typical: 1, maximum: 2, unit: 'hours' },
  costFactors: {
    laborIntensity: 'medium',
    wastePercent: 0,
    toolingRequired: false,
    skillLevel: 'journeyman',
    setupTime: 0,
  },
  ...overrides,
});

describe('calculatePartFeatureCost', () => {
  it('returns an empty breakdown for no features', () => {
    const r = calculatePartFeatureCost(undefined, [], {
      laborRatePerHour: 50_000,
      currency: 'UGX',
    });
    expect(r.contributions).toEqual([]);
    expect(r.totalHours).toBe(0);
    expect(r.totalLaborCost).toBe(0);
    expect(r.unresolvedFeatureIds).toEqual([]);
  });

  it('computes baseline (journeyman + medium intensity + 0 setup)', () => {
    const lib = [mkFeature('a')];
    const r = calculatePartFeatureCost(['a'], lib, {
      laborRatePerHour: 50_000,
      currency: 'UGX',
    });
    // typical 1h × medium 1.0 + 0 setup = 1h; rate × journeyman 1.0 = 50k
    expect(r.totalHours).toBe(1);
    expect(r.totalLaborCost).toBe(50_000);
    expect(r.contributions[0].featureCode).toBe('F-a');
  });

  it('scales hours by labor intensity and rate by skill level', () => {
    const lib = [
      mkFeature('a', {
        costFactors: {
          laborIntensity: 'high',
          wastePercent: 0,
          toolingRequired: false,
          skillLevel: 'master',
          setupTime: 0,
        },
      }),
    ];
    const r = calculatePartFeatureCost(['a'], lib, {
      laborRatePerHour: 100_000,
      currency: 'UGX',
    });
    // 1h × high 1.25 = 1.25h; rate × master 1.35 = 135_000
    expect(r.totalHours).toBeCloseTo(1.25, 5);
    expect(r.contributions[0].effectiveRate).toBe(135_000);
    expect(r.totalLaborCost).toBeCloseTo(1.25 * 135_000, 3);
  });

  it('adds setup time (minutes) once, converted to hours', () => {
    const lib = [
      mkFeature('a', {
        costFactors: {
          laborIntensity: 'medium',
          wastePercent: 0,
          toolingRequired: false,
          skillLevel: 'journeyman',
          setupTime: 30, // 30 min = 0.5h
        },
      }),
    ];
    const r = calculatePartFeatureCost(['a'], lib, {
      laborRatePerHour: 40_000,
      currency: 'UGX',
    });
    expect(r.totalHours).toBeCloseTo(1.5, 5); // 1h work + 0.5h setup
    expect(r.totalLaborCost).toBeCloseTo(1.5 * 40_000, 3);
  });

  it('flags unresolved feature ids instead of silently dropping', () => {
    const lib = [mkFeature('a')];
    const r = calculatePartFeatureCost(['a', 'zzz-deleted'], lib, {
      laborRatePerHour: 50_000,
      currency: 'UGX',
    });
    expect(r.contributions).toHaveLength(1);
    expect(r.unresolvedFeatureIds).toEqual(['zzz-deleted']);
  });
});

describe('scaleFeatureCostByQuantity', () => {
  it('returns the original breakdown for qty ≤ 1', () => {
    const lib = [mkFeature('a')];
    const base = calculatePartFeatureCost(['a'], lib, {
      laborRatePerHour: 50_000,
      currency: 'UGX',
    });
    expect(scaleFeatureCostByQuantity(base, 1, lib)).toBe(base);
  });

  it('multiplies per-part hours by quantity but keeps setup one-shot', () => {
    const lib = [
      mkFeature('a', {
        costFactors: {
          laborIntensity: 'medium',
          wastePercent: 0,
          toolingRequired: false,
          skillLevel: 'journeyman',
          setupTime: 60, // 1h setup
        },
      }),
    ];
    const base = calculatePartFeatureCost(['a'], lib, {
      laborRatePerHour: 40_000,
      currency: 'UGX',
    });
    // base: 1h work + 1h setup = 2h total
    expect(base.totalHours).toBe(2);

    const scaled = scaleFeatureCostByQuantity(base, 5, lib);
    // per-part 1h × 5 + 1h setup = 6h; rate 40k → 240k
    expect(scaled.totalHours).toBe(6);
    expect(scaled.totalLaborCost).toBe(240_000);
  });
});
