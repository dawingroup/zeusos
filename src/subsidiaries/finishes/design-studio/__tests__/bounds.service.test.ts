/**
 * Bounds Service Tests
 *
 * Tests the cache management and union logic. Three.js scene-graph
 * bounds computation is tested via a mock scene.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  unionSpheres,
  createBoundsCache,
  invalidateBoundsCache,
  getBoundsForSubject,
} from '../services/bounds.service';
import type { BoundingSphere } from '../types/framing.types';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');
  return actual;
});

describe('bounds.service', () => {
  describe('unionSpheres', () => {
    it('returns the non-empty sphere when one is empty', () => {
      const empty: BoundingSphere = { center: { x: 0, y: 0, z: 0 }, radius: 0 };
      const sphere: BoundingSphere = { center: { x: 10, y: 20, z: 30 }, radius: 5 };
      expect(unionSpheres(empty, sphere)).toEqual(sphere);
      expect(unionSpheres(sphere, empty)).toEqual(sphere);
    });

    it('returns the larger sphere when one fully contains the other', () => {
      const big: BoundingSphere = { center: { x: 0, y: 0, z: 0 }, radius: 100 };
      const small: BoundingSphere = { center: { x: 10, y: 0, z: 0 }, radius: 5 };
      const result = unionSpheres(big, small);
      expect(result.radius).toBe(100);
    });

    it('computes enclosing sphere for two disjoint spheres', () => {
      const a: BoundingSphere = { center: { x: 0, y: 0, z: 0 }, radius: 10 };
      const b: BoundingSphere = { center: { x: 100, y: 0, z: 0 }, radius: 10 };
      const result = unionSpheres(a, b);

      // Enclosing sphere should have diameter = distance(100) + a.radius + b.radius = 120
      expect(result.radius).toBeCloseTo(60, 0);
      expect(result.center.x).toBeCloseTo(50, 0);
    });
  });

  describe('createBoundsCache', () => {
    it('initializes empty cache with geometryVersion 0', () => {
      const cache = createBoundsCache();
      expect(cache.geometryVersion).toBe(0);
      expect(cache.sceneBounds).toBeUndefined();
      expect(Object.keys(cache.cabinetBounds).length).toBe(0);
      expect(Object.keys(cache.assemblyBounds).length).toBe(0);
      expect(Object.keys(cache.partBounds).length).toBe(0);
    });
  });

  describe('invalidateBoundsCache', () => {
    it('bumps geometryVersion on any invalidation', () => {
      const cache = createBoundsCache();
      const invalidated = invalidateBoundsCache(cache, 'scene');
      expect(invalidated.geometryVersion).toBe(1);
    });

    it('invalidating scene keeps other caches', () => {
      let cache = createBoundsCache();
      cache.cabinetBounds['cab-1'] = { center: { x: 0, y: 0, z: 0 }, radius: 500 };
      cache.sceneBounds = { center: { x: 0, y: 0, z: 0 }, radius: 1000 };
      cache = invalidateBoundsCache(cache, 'scene');
      expect(cache.sceneBounds).toBeUndefined();
      expect(cache.cabinetBounds['cab-1']).toBeDefined();
    });

    it('invalidating one cabinet also invalidates scene bounds', () => {
      let cache = createBoundsCache();
      cache.sceneBounds = { center: { x: 0, y: 0, z: 0 }, radius: 1000 };
      cache.cabinetBounds['cab-1'] = { center: { x: 0, y: 0, z: 0 }, radius: 500 };
      cache.cabinetBounds['cab-2'] = { center: { x: 0, y: 0, z: 0 }, radius: 600 };
      cache = invalidateBoundsCache(cache, 'cabinet', 'cab-1');
      expect(cache.cabinetBounds['cab-1']).toBeUndefined();
      expect(cache.cabinetBounds['cab-2']).toBeDefined();
      expect(cache.sceneBounds).toBeUndefined();
    });

    it('invalidating "all" clears everything', () => {
      let cache = createBoundsCache();
      cache.sceneBounds = { center: { x: 0, y: 0, z: 0 }, radius: 1000 };
      cache.cabinetBounds['c'] = { center: { x: 0, y: 0, z: 0 }, radius: 1 };
      cache.assemblyBounds['a'] = { center: { x: 0, y: 0, z: 0 }, radius: 1 };
      cache.partBounds['p'] = { center: { x: 0, y: 0, z: 0 }, radius: 1 };
      cache = invalidateBoundsCache(cache, 'all');
      expect(cache.sceneBounds).toBeUndefined();
      expect(Object.keys(cache.cabinetBounds).length).toBe(0);
      expect(Object.keys(cache.assemblyBounds).length).toBe(0);
      expect(Object.keys(cache.partBounds).length).toBe(0);
    });
  });

  describe('getBoundsForSubject', () => {
    it('returns custom bounds directly when subject.type is custom_bounds', () => {
      const customBounds: BoundingSphere = { center: { x: 100, y: 200, z: 300 }, radius: 50 };
      const cache = createBoundsCache();
      const result = getBoundsForSubject(
        { type: 'custom_bounds', id: 'custom', bounds: customBounds },
        null,
        cache,
      );
      expect(result).toEqual(customBounds);
    });

    it('returns empty sphere when threeScene is null and no bounds on subject', () => {
      const cache = createBoundsCache();
      const result = getBoundsForSubject(
        { type: 'cabinet', id: 'c1' },
        null,
        cache,
      );
      expect(result.radius).toBe(0);
    });
  });
});
