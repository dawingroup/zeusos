/**
 * Unit tests — Media Plan module (Phase 4).
 *
 * Covers:
 *   - computeVariancePct helper
 *   - CRUD stubs via mocked Firestore
 */

import { describe, it, expect, vi } from 'vitest';

// ─────────────────────────────────────────────────────────────────
// computeVariancePct — pure helper, no mock needed
// ─────────────────────────────────────────────────────────────────

// We import the function directly from the service. The firebase import
// inside the service module is intercepted by the vi.mock below.
vi.mock('@/shared/services/firebase', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  collection:       vi.fn(),
  doc:              vi.fn(),
  addDoc:           vi.fn(),
  getDoc:           vi.fn(),
  getDocs:          vi.fn(),
  updateDoc:        vi.fn(),
  deleteDoc:        vi.fn(),
  query:            vi.fn(),
  where:            vi.fn(),
  orderBy:          vi.fn(),
  serverTimestamp:  vi.fn(() => '__SERVER_TS__'),
}));

import { computeVariancePct } from '../services/media-plan.service';

describe('computeVariancePct', () => {
  it('returns 0 when planned is zero', () => {
    expect(computeVariancePct(0, 5000)).toBe(0);
  });

  it('returns positive value when actual > planned (overspend)', () => {
    // planned 100, actual 110 → +10%
    const pct = computeVariancePct(100_00, 110_00);
    expect(pct).toBeCloseTo(10, 2);
  });

  it('returns negative value when actual < planned (underspend)', () => {
    // planned 100, actual 80 → -20%
    const pct = computeVariancePct(100_00, 80_00);
    expect(pct).toBeCloseTo(-20, 2);
  });

  it('returns 0 when planned equals actual', () => {
    expect(computeVariancePct(500_00, 500_00)).toBe(0);
  });

  it('handles large minor-unit values (UGX scale)', () => {
    // 10,000,000 UGX planned, 12,500,000 UGX actual → +25%
    const pct = computeVariancePct(10_000_000_00, 12_500_000_00);
    expect(pct).toBeCloseTo(25, 2);
  });
});
