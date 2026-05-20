/**
 * P17 slice 2 — `calculateFeatureLaborFromParts` rollup tests.
 *
 * Validates that the item-level aggregator correctly:
 *   - sums feature labor across parts,
 *   - scales per-part hours by quantity without re-multiplying setup,
 *   - surfaces unresolved feature ids,
 *   - no-ops cleanly when parts have no `featureIds`.
 *
 * Unlike the rest of estimateService (which touches Firestore),
 * `calculateFeatureLaborFromParts` is pure given the feature library —
 * so we test it directly without mocking firebase.
 */
import { describe, it, expect } from 'vitest';
import { calculateFeatureLaborFromParts } from '../estimateService';
import type { FeatureLibraryItem } from '../../types/featureLibrary';
import type { PartEntry } from '../../types';
import { DEFAULT_ESTIMATE_CONFIG } from '../../types/estimate';

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

const mkPart = (overrides: Partial<PartEntry> = {}): PartEntry =>
  ({
    id: 'p1',
    partNumber: 'P-1',
    name: 'Panel',
    partType: 'sheet',
    length: 600,
    width: 400,
    thickness: 18,
    quantity: 1,
    materialName: 'MDF',
    grainDirection: 'none',
    edgeBanding: { top: false, bottom: false, left: false, right: false },
    source: 'manual',
    ...overrides,
  } as PartEntry);

describe('calculateFeatureLaborFromParts', () => {
  it('returns zero totals when no part carries featureIds', () => {
    const parts = [mkPart(), mkPart({ id: 'p2' })];
    const r = calculateFeatureLaborFromParts(parts, [mkFeature('a')]);
    expect(r.hours).toBe(0);
    expect(r.cost).toBe(0);
    expect(r.unresolvedFeatureIds).toEqual([]);
    expect(r.perPart).toEqual([]);
  });

  it('rolls up feature hours × cost across multiple parts', () => {
    const lib = [mkFeature('joinery'), mkFeature('finish')];
    const parts = [
      mkPart({ id: 'p1', featureIds: ['joinery'], quantity: 1 }),
      mkPart({ id: 'p2', featureIds: ['finish'], quantity: 1 }),
    ];
    const rate = DEFAULT_ESTIMATE_CONFIG.laborRatePerHour;
    const r = calculateFeatureLaborFromParts(parts, lib, DEFAULT_ESTIMATE_CONFIG);
    // Each feature: typical 1h × medium 1.0 + 0 setup = 1h, journeyman 1.0.
    // Two parts × 1h = 2h total.
    expect(r.hours).toBe(2);
    expect(r.cost).toBe(Math.round(2 * rate));
    expect(r.perPart).toHaveLength(2);
  });

  it('scales per-part hours by quantity but keeps setup one-shot', () => {
    // 1h typical, 30 min setup (0.5h). Quantity 3.
    const lib = [
      mkFeature('j', {
        estimatedTime: { minimum: 1, typical: 1, maximum: 1, unit: 'hours' },
        costFactors: {
          laborIntensity: 'medium',
          wastePercent: 0,
          toolingRequired: false,
          skillLevel: 'journeyman',
          setupTime: 30,
        },
      }),
    ];
    const parts = [mkPart({ id: 'p1', featureIds: ['j'], quantity: 3 })];
    const r = calculateFeatureLaborFromParts(parts, lib, DEFAULT_ESTIMATE_CONFIG);
    // per-part = 1h × 1.0 = 1h. scaled = 1h × 3 + 0.5h setup = 3.5h
    expect(r.hours).toBe(3.5);
  });

  it('reports unresolved feature ids without throwing', () => {
    const lib = [mkFeature('a')];
    const parts = [mkPart({ featureIds: ['a', 'b-stale'] })];
    const r = calculateFeatureLaborFromParts(parts, lib, DEFAULT_ESTIMATE_CONFIG);
    expect(r.unresolvedFeatureIds).toEqual(['b-stale']);
    // Resolved feature still contributes
    expect(r.hours).toBeGreaterThan(0);
  });

  it('deduplicates unresolved ids across parts', () => {
    const lib: Array<ReturnType<typeof mkFeature>> = [];
    const parts = [
      mkPart({ id: 'p1', featureIds: ['missing'] }),
      mkPart({ id: 'p2', featureIds: ['missing'] }),
    ];
    const r = calculateFeatureLaborFromParts(parts, lib, DEFAULT_ESTIMATE_CONFIG);
    expect(r.unresolvedFeatureIds).toEqual(['missing']);
  });

  it('respects skill-level rate multiplier (master = 1.35×)', () => {
    const lib = [
      mkFeature('m', {
        costFactors: {
          laborIntensity: 'medium',
          wastePercent: 0,
          toolingRequired: false,
          skillLevel: 'master',
          setupTime: 0,
        },
      }),
    ];
    const parts = [mkPart({ featureIds: ['m'], quantity: 1 })];
    const baseRate = DEFAULT_ESTIMATE_CONFIG.laborRatePerHour;
    const r = calculateFeatureLaborFromParts(parts, lib, DEFAULT_ESTIMATE_CONFIG);
    expect(r.cost).toBe(Math.round(1 * baseRate * 1.35));
  });
});
