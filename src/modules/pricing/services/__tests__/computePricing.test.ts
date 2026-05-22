/**
 * Unit tests for the pricing engine — spec §8.1.
 *
 * These exercise the *pure* compute: a stub rate-lookup and markup-lookup
 * are injected, so no Firestore. Behaviour verified:
 *   - Single-subsidiary correctness
 *   - Multi-subsidiary correctness (the only-client-facing-number invariant
 *     holds even when subsidiaries have different markups)
 *   - Margin-floor satisfied vs unsatisfied
 *   - Mixed-currency rejection (3.F scope)
 *   - Empty quote rejection
 *   - Invalid qty rejection
 *   - Default description derivation
 */

import { describe, expect, it } from 'vitest';
import { computePricedQuote, PricingError } from '../computePricing';
import type { MarkupLookup, RateLookup } from '../computePricing';

const stubRate: RateLookup = ({ subsidiaryOrgId, roleCode, unit }) => {
  // Cost table keyed by (subsidiary, role, unit) in minor units (UGX cents).
  const table: Record<string, number> = {
    'zeus-the-agency:ACCOUNT_DIRECTOR:HOUR': 10_000_00, // 10,000 UGX/hr
    'zeus-the-agency:STRATEGIST:HOUR':       12_000_00,
    'zeus-digital:DIGITAL_PRODUCER:HOUR':     8_000_00,
    'zeus-digital:DIGITAL_PRODUCER:DAY':     64_000_00,
    'labyrinth:SR_DESIGNER:HOUR':             9_500_00,
  };
  const key = `${subsidiaryOrgId}:${roleCode}:${unit}`;
  if (!(key in table)) {
    throw new Error(`No stub rate for ${key}`);
  }
  return {
    rateCardId: `rc_${subsidiaryOrgId}_v1`,
    rateCardLineId: `rcl_${key}`,
    costMinor: table[key],
    currency: 'UGX',
  };
};

const stubMarkup35: MarkupLookup = () => 35;

describe('computePricedQuote — single subsidiary', () => {
  it('computes cost, client_minor, and total margin per spec §8.1', () => {
    const result = computePricedQuote({
      sowId: 'sow_abc',
      clientId: 'client_test',
      lines: [
        { subsidiaryOrgId: 'zeus-the-agency', roleCode: 'ACCOUNT_DIRECTOR', unit: 'HOUR', qty: 10 },
      ],
      lookupRate: stubRate,
      lookupMarkup: stubMarkup35,
    });

    // cost = 10_000_00 * 10 = 100,000,000 (cents) = 1,000,000 UGX
    expect(result.totalCostMinor).toBe(100_000_00);
    // client = round(100_000_00 * 1.35) = 135,000,000 (cents)
    expect(result.totalClientMinor).toBe(135_000_00);
    // margin = (135 - 100)/135 = 25.925…%
    expect(result.marginPct).toBeCloseTo(25.926, 2);
    expect(result.meetsFloor).toBe(true);
    expect(result.currency).toBe('UGX');
    expect(result.lines[0].rateCardLineId).toBe('rcl_zeus-the-agency:ACCOUNT_DIRECTOR:HOUR');
  });

  it('rejects empty line list', () => {
    expect(() =>
      computePricedQuote({
        sowId: 'sow_x', clientId: 'c', lines: [], lookupRate: stubRate, lookupMarkup: stubMarkup35,
      }),
    ).toThrow(PricingError);
  });

  it('rejects non-positive qty', () => {
    expect(() =>
      computePricedQuote({
        sowId: 'sow_x', clientId: 'c',
        lines: [{ subsidiaryOrgId: 'zeus-the-agency', roleCode: 'ACCOUNT_DIRECTOR', unit: 'HOUR', qty: 0 }],
        lookupRate: stubRate, lookupMarkup: stubMarkup35,
      }),
    ).toThrow(/INVALID_QTY/);
  });

  it('derives a client-friendly default description when none provided', () => {
    const result = computePricedQuote({
      sowId: 's', clientId: 'c',
      lines: [{ subsidiaryOrgId: 'zeus-the-agency', roleCode: 'ACCOUNT_DIRECTOR', unit: 'HOUR', qty: 4 }],
      lookupRate: stubRate, lookupMarkup: stubMarkup35,
    });
    expect(result.lines[0].description).toBe('Account Director — 4 hours');
  });

  it('honours an explicit description override (used for client-friendly relabel)', () => {
    const result = computePricedQuote({
      sowId: 's', clientId: 'c',
      lines: [{
        subsidiaryOrgId: 'zeus-the-agency', roleCode: 'ACCOUNT_DIRECTOR', unit: 'HOUR', qty: 4,
        description: 'Senior strategic counsel',
      }],
      lookupRate: stubRate, lookupMarkup: stubMarkup35,
    });
    expect(result.lines[0].description).toBe('Senior strategic counsel');
    // Critical: description override does NOT leak roleCode into the client view.
    expect(result.lines[0].description).not.toContain('ACCOUNT_DIRECTOR');
  });
});

describe('computePricedQuote — multi subsidiary', () => {
  it('applies per-subsidiary markup independently and sums correctly', () => {
    const markupBySubsidiary: MarkupLookup = ({ subsidiaryOrgId }) => {
      if (subsidiaryOrgId === 'zeus-the-agency') return 35;
      if (subsidiaryOrgId === 'zeus-digital')    return 40;
      if (subsidiaryOrgId === 'labyrinth')       return 45;
      throw new Error(`No markup stub for ${subsidiaryOrgId}`);
    };

    const result = computePricedQuote({
      sowId: 'sow_multi',
      clientId: 'client_test',
      lines: [
        { subsidiaryOrgId: 'zeus-the-agency', roleCode: 'STRATEGIST',       unit: 'HOUR', qty: 8 },
        { subsidiaryOrgId: 'zeus-digital',    roleCode: 'DIGITAL_PRODUCER', unit: 'DAY',  qty: 3 },
        { subsidiaryOrgId: 'labyrinth',       roleCode: 'SR_DESIGNER',      unit: 'HOUR', qty: 16 },
      ],
      lookupRate: stubRate,
      lookupMarkup: markupBySubsidiary,
    });

    // ZTA: 12,000_00 * 8 = 96,000_00 cost; client = round(96,000_00 * 1.35) = 129,600_00
    // ZD:   64,000_00 * 3 = 192,000_00 cost; client = round(192,000_00 * 1.40) = 268,800_00
    // LAB:   9,500_00 * 16 = 152,000_00 cost; client = round(152,000_00 * 1.45) = 220,400_00
    expect(result.totalCostMinor).toBe(96_000_00 + 192_000_00 + 152_000_00);
    expect(result.totalClientMinor).toBe(129_600_00 + 268_800_00 + 220_400_00);
    // 3 lines, 3 distinct rate-card pins:
    const pinned = new Set(result.lines.map(l => l.rateCardId));
    expect(pinned.size).toBe(3);
    expect(result.meetsFloor).toBe(true);
  });
});

describe('computePricedQuote — margin floor', () => {
  it('flags meetsFloor=false when margin is below the floor', () => {
    const lowMarkup: MarkupLookup = () => 10; // 10% → margin ≈ 9.09%
    const result = computePricedQuote({
      sowId: 's', clientId: 'c',
      lines: [{ subsidiaryOrgId: 'zeus-the-agency', roleCode: 'STRATEGIST', unit: 'HOUR', qty: 4 }],
      lookupRate: stubRate, lookupMarkup: lowMarkup,
    });
    expect(result.meetsFloor).toBe(false);
    expect(result.marginPct).toBeLessThan(result.marginFloorPct);
  });

  it('respects a per-quote marginFloorPct override (e.g. 30% for a strategic client)', () => {
    const result = computePricedQuote({
      sowId: 's', clientId: 'c',
      lines: [{ subsidiaryOrgId: 'zeus-the-agency', roleCode: 'STRATEGIST', unit: 'HOUR', qty: 4 }],
      lookupRate: stubRate, lookupMarkup: stubMarkup35,
      marginFloorPct: 30,
    });
    // 35% markup → 25.93% margin → below 30% floor
    expect(result.meetsFloor).toBe(false);
    expect(result.marginFloorPct).toBe(30);
  });
});

describe('computePricedQuote — currency invariant', () => {
  it('rejects mixed currencies (deferred to Phase 3.F)', () => {
    const mixedRate: RateLookup = ({ subsidiaryOrgId, roleCode, unit }) => {
      const base = stubRate({ subsidiaryOrgId, roleCode, unit });
      if (subsidiaryOrgId === 'zeus-digital') {
        return { ...base, currency: 'USD' };
      }
      return base;
    };
    expect(() =>
      computePricedQuote({
        sowId: 's', clientId: 'c',
        lines: [
          { subsidiaryOrgId: 'zeus-the-agency', roleCode: 'STRATEGIST',       unit: 'HOUR', qty: 1 },
          { subsidiaryOrgId: 'zeus-digital',    roleCode: 'DIGITAL_PRODUCER', unit: 'HOUR', qty: 1 },
        ],
        lookupRate: mixedRate, lookupMarkup: stubMarkup35,
      }),
    ).toThrow(/MIXED_CURRENCY/);
  });
});
