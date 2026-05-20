/**
 * P19/F20 — material tier invariant tests.
 *
 * Pins the hierarchy rule: global forbids parent, project requires it,
 * customer is permissive by default but opt-in strict. Self-parent is
 * caught regardless of tier.
 */
import { describe, it, expect } from 'vitest';
import {
  validateMaterialTier,
  assertMaterialTierInvariant,
  MaterialTierInvariantError,
} from '../materialTierInvariants';

describe('validateMaterialTier', () => {
  it('accepts a global with no parent', () => {
    expect(validateMaterialTier('global', undefined)).toBeNull();
  });

  it('rejects a global with a parent', () => {
    expect(validateMaterialTier('global', 'parent-1')).toBe('global_has_parent');
  });

  it('rejects a project without a parent', () => {
    expect(validateMaterialTier('project', undefined)).toBe('project_missing_parent');
  });

  it('accepts a project with a parent', () => {
    expect(validateMaterialTier('project', 'global-1')).toBeNull();
  });

  it('accepts a customer without a parent by default', () => {
    expect(validateMaterialTier('customer', undefined)).toBeNull();
  });

  it('accepts a customer with a parent', () => {
    expect(validateMaterialTier('customer', 'global-1')).toBeNull();
  });

  it('rejects a customer without a parent when requireParentForCustomer is opt-in', () => {
    expect(
      validateMaterialTier('customer', undefined, undefined, {
        requireParentForCustomer: true,
      }),
    ).toBe('customer_missing_parent');
  });

  it('catches self-parent regardless of tier', () => {
    expect(validateMaterialTier('project', 'm-1', 'm-1')).toBe('self_parent');
    // Self-parent is reported even if tier is global (where the parent
    // shouldn't be present at all) — more specific violation wins.
    expect(validateMaterialTier('global', 'm-1', 'm-1')).toBe('self_parent');
  });
});

describe('assertMaterialTierInvariant', () => {
  it('throws MaterialTierInvariantError carrying the violation code', () => {
    try {
      assertMaterialTierInvariant('project', undefined, 'new-mat');
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(MaterialTierInvariantError);
      expect((err as MaterialTierInvariantError).code).toBe('project_missing_parent');
      expect((err as MaterialTierInvariantError).tier).toBe('project');
      expect((err as MaterialTierInvariantError).materialId).toBe('new-mat');
    }
  });

  it('does not throw on valid inputs', () => {
    expect(() => assertMaterialTierInvariant('global', undefined)).not.toThrow();
    expect(() => assertMaterialTierInvariant('project', 'parent-id')).not.toThrow();
    expect(() => assertMaterialTierInvariant('customer', undefined)).not.toThrow();
    expect(() => assertMaterialTierInvariant('customer', 'global-id')).not.toThrow();
  });

  it('forwards opts.requireParentForCustomer', () => {
    expect(() =>
      assertMaterialTierInvariant('customer', undefined, undefined, {
        requireParentForCustomer: true,
      }),
    ).toThrow(/customer_missing_parent/);
  });
});
