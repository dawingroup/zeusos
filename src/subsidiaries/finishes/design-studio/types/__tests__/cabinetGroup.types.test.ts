/**
 * Unit tests for the Cabinet Alignment System's pure types.
 *
 * Repo/service CAS behaviour is exercised manually against the Firebase
 * emulator (out of scope for this test file). These tests cover the
 * type-level and error-shape contracts that other code assumes.
 */
import { describe, it, expect } from 'vitest';
import { StaleRevisionError } from '../cabinetGroup.types';

describe('StaleRevisionError', () => {
  it('carries expected / actual / path and formats a readable message', () => {
    const err = new StaleRevisionError(3, 7, 'designScenes/s1/cabinets/c1');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('StaleRevisionError');
    expect(err.expected).toBe(3);
    expect(err.actual).toBe(7);
    expect(err.path).toBe('designScenes/s1/cabinets/c1');
    expect(err.message).toContain('expected 3');
    expect(err.message).toContain('found 7');
    expect(err.message).toContain('designScenes/s1/cabinets/c1');
  });

  it('is distinguishable by name so callers can branch on err.name === "StaleRevisionError"', () => {
    const err: Error = new StaleRevisionError(1, 2, 'x');
    // Realistic reconciliation pattern:
    expect(err.name === 'StaleRevisionError').toBe(true);
    expect((err as StaleRevisionError).expected).toBe(1);
  });
});
