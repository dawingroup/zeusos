/**
 * fkResolvers — post-migration contract tests.
 *
 * Before P16 phase 2 landed these tests pinned the canonical/legacy
 * preference order. After the 2026-04-18 backfill the legacy fields
 * (`crmDealId`, `linkedDealId`) were dropped from the SalesOrder and
 * DesignProject types, so the resolvers are now a null-safe pass-
 * through and the stamp helpers just emit `{ dealId }`. These tests
 * pin that simplified contract.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveDealId,
  stampSalesOrderDealId,
  stampDesignProjectDealId,
} from '../fkResolvers';

describe('resolveDealId', () => {
  it('returns the canonical dealId', () => {
    expect(resolveDealId({ dealId: 'new' })).toBe('new');
  });

  it('returns undefined when no FK is set', () => {
    expect(resolveDealId({})).toBeUndefined();
  });

  it('returns undefined for null/undefined input', () => {
    expect(resolveDealId(null)).toBeUndefined();
    expect(resolveDealId(undefined)).toBeUndefined();
  });
});

describe('stampSalesOrderDealId', () => {
  it('returns a { dealId } patch when a value is supplied', () => {
    expect(stampSalesOrderDealId('deal-1')).toEqual({ dealId: 'deal-1' });
  });

  it('returns an empty patch when undefined is supplied', () => {
    // Firestore rejects undefined fields; the helper must omit them
    // entirely rather than writing `undefined`.
    expect(stampSalesOrderDealId(undefined)).toEqual({});
  });
});

describe('stampDesignProjectDealId', () => {
  it('returns a { dealId } patch when a value is supplied', () => {
    expect(stampDesignProjectDealId('deal-2')).toEqual({ dealId: 'deal-2' });
  });

  it('returns an empty patch when undefined is supplied', () => {
    expect(stampDesignProjectDealId(undefined)).toEqual({});
  });
});
