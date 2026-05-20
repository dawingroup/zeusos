/**
 * Constraint Engine Tests
 *
 * Tests constraint evaluation (expr-eval), BOM computation,
 * and DKB validation functions.
 */
import { describe, it, expect } from 'vitest';
import { evaluateConstraint } from '../services/constraintEngine.service';
import type { Constraint } from '../types/productDefinition.types';

describe('constraintEngine', () => {
  describe('evaluateConstraint', () => {
    const makeConstraint = (
      condition: string,
      action: 'reject' | 'warn' | 'info' = 'reject',
    ): Constraint => ({
      id: 'test-constraint',
      condition,
      action,
      reason: `Test constraint: ${condition}`,
      affectedParameters: [],
      isActive: true,
    });

    it('returns null when constraint does not fire', () => {
      const constraint = makeConstraint('width > 1000');
      const result = evaluateConstraint(constraint, { width: 500 });
      expect(result).toBeNull();
    });

    it('returns violation when constraint fires', () => {
      const constraint = makeConstraint('width > 1000');
      const result = evaluateConstraint(constraint, { width: 1200 });
      expect(result).not.toBeNull();
      expect(result?.action).toBe('reject');
      expect(result?.constraintId).toBe('test-constraint');
    });

    it('handles string comparisons', () => {
      const constraint = makeConstraint('legStyle == "hairpin"', 'warn');
      const result = evaluateConstraint(constraint, { legStyle: 'hairpin' });
      expect(result).not.toBeNull();
      expect(result?.action).toBe('warn');
    });

    it('handles compound conditions with &&', () => {
      const constraint = makeConstraint('width > 1000 and height < 500');
      // Only fires when both conditions are true
      expect(evaluateConstraint(constraint, { width: 1200, height: 400 })).not.toBeNull();
      expect(evaluateConstraint(constraint, { width: 1200, height: 600 })).toBeNull();
      expect(evaluateConstraint(constraint, { width: 800, height: 400 })).toBeNull();
    });

    it('returns info-level violation on expression error', () => {
      const constraint = makeConstraint('invalid..syntax');
      const result = evaluateConstraint(constraint, {});
      expect(result).not.toBeNull();
      expect(result?.action).toBe('info');
      expect(result?.reason).toContain('Constraint evaluation error');
    });

    it('ignores non-scalar parameter values', () => {
      const constraint = makeConstraint('width > 500');
      // Objects and arrays are filtered out; width is number
      const result = evaluateConstraint(constraint, {
        width: 600,
        nested: { a: 1 },
        arr: [1, 2, 3],
      });
      expect(result).not.toBeNull();
    });
  });
});
