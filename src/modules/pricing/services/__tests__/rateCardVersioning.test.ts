/**
 * Unit tests for rate-card versioning — the pure-logic counterpart to
 * `activateRateCard` / `retireRateCard`. Verifies:
 *   - nextVersion bumps correctly
 *   - activating v2 produces an ActivationPlan that retires v1 with
 *     effectiveTo = v2.effectiveFrom − 1 day
 *   - non-DRAFT cards can't be activated
 *   - non-ACTIVE cards can't be retired
 */

import { describe, expect, it } from 'vitest';
import {
  autoRetireEffectiveTo,
  assertCanActivate,
  assertCanRetire,
  nextVersion,
  planActivation,
  RateCardError,
} from '../rateCardVersioning';

describe('nextVersion', () => {
  it('returns 1 for first version', () => {
    expect(nextVersion([])).toBe(1);
  });
  it('bumps highest existing version', () => {
    expect(nextVersion([{ version: 1 }, { version: 3 }, { version: 2 }])).toBe(4);
  });
});

describe('autoRetireEffectiveTo', () => {
  it('returns one day before the new effectiveFrom (UTC)', () => {
    const from = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15
    const retireAt = autoRetireEffectiveTo(from);
    expect(retireAt.toISOString().slice(0, 10)).toBe('2026-06-14');
  });

  it('handles month-boundary correctly', () => {
    const from = new Date(Date.UTC(2026, 6, 1)); // 2026-07-01
    expect(autoRetireEffectiveTo(from).toISOString().slice(0, 10)).toBe('2026-06-30');
  });
});

describe('assertCanActivate / assertCanRetire', () => {
  it('rejects activating a non-DRAFT card', () => {
    expect(() => assertCanActivate({ status: 'ACTIVE' })).toThrow(RateCardError);
    expect(() => assertCanActivate({ status: 'RETIRED' })).toThrow(/NOT_DRAFT/);
  });
  it('rejects retiring a non-ACTIVE card', () => {
    expect(() => assertCanRetire({ status: 'DRAFT' })).toThrow(/NOT_ACTIVE/);
    expect(() => assertCanRetire({ status: 'RETIRED' })).toThrow(/NOT_ACTIVE/);
  });
});

describe('planActivation', () => {
  const FROM = new Date(Date.UTC(2026, 5, 15));

  it('with no current active: returns only the activate plan', () => {
    const plan = planActivation({
      candidate: { id: 'rc_v1', status: 'DRAFT' },
      effectiveFrom: FROM,
    });
    expect(plan.toActivate).toMatchObject({ id: 'rc_v1', nextStatus: 'ACTIVE' });
    expect(plan.toRetire).toBeUndefined();
  });

  it('with current active: retires prior at effectiveFrom − 1', () => {
    const plan = planActivation({
      candidate: { id: 'rc_v2', status: 'DRAFT' },
      currentActive: { id: 'rc_v1', status: 'ACTIVE' },
      effectiveFrom: FROM,
    });
    expect(plan.toActivate.id).toBe('rc_v2');
    expect(plan.toRetire?.id).toBe('rc_v1');
    expect(plan.toRetire?.nextStatus).toBe('RETIRED');
    expect(plan.toRetire?.effectiveTo.toISOString().slice(0, 10)).toBe('2026-06-14');
  });

  it('rejects when candidate is not DRAFT', () => {
    expect(() =>
      planActivation({
        candidate: { id: 'rc_v2', status: 'ACTIVE' },
        effectiveFrom: FROM,
      }),
    ).toThrow(RateCardError);
  });
});
