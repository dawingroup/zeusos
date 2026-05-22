import { describe, it, expect } from 'vitest';
import { computeBurnMeter, sumEntries } from '../burnMeter';

describe('computeBurnMeter', () => {
  it('reports OK and headroom when well under the cap', () => {
    const m = computeBurnMeter({ cumulativeMinor: 100_00, budgetMinor: 1_000_00 });
    expect(m.percentage).toBe(10);
    expect(m.status).toBe('OK');
    expect(m.remainingMinor).toBe(900_00);
  });

  it('crosses to WARN at exactly 90 %', () => {
    const m = computeBurnMeter({ cumulativeMinor: 900_00, budgetMinor: 1_000_00 });
    expect(m.percentage).toBe(90);
    expect(m.status).toBe('WARN');
  });

  it('stays WARN between 90 % and 100 %', () => {
    const m = computeBurnMeter({ cumulativeMinor: 950_00, budgetMinor: 1_000_00 });
    expect(m.status).toBe('WARN');
    expect(m.remainingMinor).toBe(50_00);
  });

  it('reports BLOCKED at exactly 100 %', () => {
    const m = computeBurnMeter({ cumulativeMinor: 1_000_00, budgetMinor: 1_000_00 });
    expect(m.percentage).toBe(100);
    expect(m.status).toBe('BLOCKED');
    expect(m.remainingMinor).toBe(0);
  });

  it('clamps percentage at 100 and remaining at 0 when over budget', () => {
    // The server hard-blocks overage; this guards the UI math in case a
    // stale read shows an out-of-band cumulative.
    const m = computeBurnMeter({ cumulativeMinor: 1_200_00, budgetMinor: 1_000_00 });
    expect(m.percentage).toBe(100);
    expect(m.status).toBe('BLOCKED');
    expect(m.remainingMinor).toBe(0);
  });

  it('treats budget ≤ 0 as a degenerate BLOCKED state', () => {
    expect(computeBurnMeter({ cumulativeMinor: 0, budgetMinor: 0 }).status).toBe('BLOCKED');
    expect(computeBurnMeter({ cumulativeMinor: 0, budgetMinor: -1 }).status).toBe('BLOCKED');
  });

  it('clamps a negative cumulative to zero', () => {
    const m = computeBurnMeter({ cumulativeMinor: -50, budgetMinor: 1_000_00 });
    expect(m.cumulativeMinor).toBe(0);
    expect(m.percentage).toBe(0);
    expect(m.status).toBe('OK');
  });
});

describe('sumEntries', () => {
  it('sums mixed time + cost entries via the unified amountMinor field', () => {
    const total = sumEntries([
      { amountMinor: 120_00 }, // time entry — caller maps costMinor → amountMinor
      { amountMinor: 50_00 },  // cost entry
      { amountMinor: 30_00 },
    ]);
    expect(total).toBe(200_00);
  });

  it('ignores negative or NaN amounts', () => {
    expect(
      sumEntries([
        { amountMinor: 100 },
        { amountMinor: -20 },
        { amountMinor: Number.NaN },
      ]),
    ).toBe(100);
  });

  it('returns 0 for an empty list', () => {
    expect(sumEntries([])).toBe(0);
  });
});
