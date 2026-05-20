import { describe, it, expect } from 'vitest';
import {
  isEdgeApplied,
  getEdgeMaterial,
  getEdgeThickness,
  getEdgeLength,
  totalEdgeLengthMm,
  totalEdgeLengthLm,
  fromSceneEdgeBanding,
  fromCsvEdgeBanding,
} from '../edgeBandingHelpers';
import type { PartEdgeBanding } from '../../types';

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

describe('isEdgeApplied', () => {
  const eb: PartEdgeBanding = { top: true, bottom: false, left: true, right: false };
  it('returns true for applied edges', () => {
    expect(isEdgeApplied(eb, 'top')).toBe(true);
    expect(isEdgeApplied(eb, 'left')).toBe(true);
  });
  it('returns false for unapplied edges', () => {
    expect(isEdgeApplied(eb, 'bottom')).toBe(false);
    expect(isEdgeApplied(eb, 'right')).toBe(false);
  });
  it('returns false for undefined front', () => {
    expect(isEdgeApplied(eb, 'front')).toBe(false);
  });
});

describe('getEdgeMaterial', () => {
  it('returns per-edge material when available', () => {
    const eb: PartEdgeBanding = {
      top: true, bottom: false, left: false, right: false,
      material: 'shared-mat',
      edges: { top: { material: 'ABS 0.45mm Oak' } },
    };
    expect(getEdgeMaterial(eb, 'top')).toBe('ABS 0.45mm Oak');
  });
  it('falls back to shared material', () => {
    const eb: PartEdgeBanding = {
      top: true, bottom: false, left: true, right: false,
      material: 'shared-mat',
    };
    expect(getEdgeMaterial(eb, 'top')).toBe('shared-mat');
    expect(getEdgeMaterial(eb, 'left')).toBe('shared-mat');
  });
  it('returns undefined when no material set', () => {
    const eb: PartEdgeBanding = { top: true, bottom: false, left: false, right: false };
    expect(getEdgeMaterial(eb, 'top')).toBeUndefined();
  });
});

describe('getEdgeThickness', () => {
  it('returns per-edge thickness', () => {
    const eb: PartEdgeBanding = {
      top: true, bottom: false, left: false, right: false,
      thickness: 1.0,
      edges: { top: { thickness: 2.0 } },
    };
    expect(getEdgeThickness(eb, 'top')).toBe(2.0);
  });
  it('falls back to shared thickness', () => {
    const eb: PartEdgeBanding = {
      top: true, bottom: false, left: false, right: false,
      thickness: 1.0,
    };
    expect(getEdgeThickness(eb, 'top')).toBe(1.0);
  });
});

describe('getEdgeLength', () => {
  it('returns pre-computed edge length', () => {
    const eb: PartEdgeBanding = {
      top: true, bottom: false, left: false, right: false,
      edges: { top: { length: 600 } },
    };
    expect(getEdgeLength(eb, 'top')).toBe(600);
  });
  it('returns undefined when not set', () => {
    const eb: PartEdgeBanding = { top: true, bottom: false, left: false, right: false };
    expect(getEdgeLength(eb, 'top')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

describe('totalEdgeLengthMm', () => {
  it('sums pre-computed lengths when available', () => {
    const eb: PartEdgeBanding = {
      top: true, bottom: true, left: false, right: false,
      edges: { top: { length: 600 }, bottom: { length: 600 } },
    };
    expect(totalEdgeLengthMm(eb, 600, 400)).toBe(1200);
  });

  it('falls back to part dimensions', () => {
    const eb: PartEdgeBanding = { top: true, bottom: false, left: true, right: true };
    // top = 600 (length), left + right = 400 + 400
    expect(totalEdgeLengthMm(eb, 600, 400)).toBe(1400);
  });
});

describe('totalEdgeLengthLm', () => {
  it('returns meters', () => {
    const eb: PartEdgeBanding = { top: true, bottom: false, left: false, right: false };
    expect(totalEdgeLengthLm(eb, 1000, 500)).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

describe('fromSceneEdgeBanding', () => {
  it('converts ScenePart edge shape to PartEdgeBanding', () => {
    const result = fromSceneEdgeBanding({
      top: { type: 'ABS 0.45', length: 600 },
      bottom: null,
      left: { type: 'PVC 2mm', length: 400 },
      right: null,
      front: null,
    });
    expect(result.top).toBe(true);
    expect(result.bottom).toBe(false);
    expect(result.left).toBe(true);
    expect(result.material).toBe('ABS 0.45');
    expect(result.edges?.top?.material).toBe('ABS 0.45');
    expect(result.edges?.top?.length).toBe(600);
    expect(result.edges?.left?.material).toBe('PVC 2mm');
    expect(result.edges?.left?.length).toBe(400);
  });

  it('handles undefined input', () => {
    const result = fromSceneEdgeBanding(undefined);
    expect(result.top).toBe(false);
    expect(result.bottom).toBe(false);
    expect(result.edges).toBeUndefined();
  });
});

describe('fromCsvEdgeBanding', () => {
  it('builds from CSV booleans + shared material', () => {
    const result = fromCsvEdgeBanding(
      { top: true, bottom: true, left: false, right: false, material: 'ABS 0.45' },
      600, 400,
    );
    expect(result.top).toBe(true);
    expect(result.bottom).toBe(true);
    expect(result.material).toBe('ABS 0.45');
    expect(result.edges?.top?.material).toBe('ABS 0.45');
    expect(result.edges?.top?.length).toBe(600);
    expect(result.edges?.bottom?.length).toBe(600);
  });

  it('supports per-edge material overrides from CSV', () => {
    const result = fromCsvEdgeBanding({
      top: true, bottom: false, left: true, right: false,
      material: 'shared',
      topMaterial: 'ABS Oak',
      leftMaterial: 'PVC White',
    }, 600, 400);
    expect(result.edges?.top?.material).toBe('ABS Oak');
    expect(result.edges?.left?.material).toBe('PVC White');
  });
});
