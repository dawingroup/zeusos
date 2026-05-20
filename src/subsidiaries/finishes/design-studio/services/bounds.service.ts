/**
 * Bounds Service — Compute and cache bounding spheres at every hierarchy level
 *
 * RealityKit equivalent: `Entity.visualBounds(relativeTo:)`.
 * Pure computations + cache management. No camera mutations.
 */
import * as THREE from 'three';
import type { BoundingSphere, BoundsCache } from '../types/framing.types';

/**
 * Compute bounding sphere for a single Object3D (Mesh, Group, or GLTF scene).
 * Wraps Box3.setFromObject and converts to a sphere (rotation-invariant).
 * Handles invisible meshes by skipping them.
 */
export function computeBoundsForObject(object: THREE.Object3D | null | undefined): BoundingSphere {
  if (!object) return EMPTY_SPHERE;

  // Temporarily skip invisible geometry for the bounds calc
  const hiddenState: { obj: THREE.Object3D; wasVisible: boolean }[] = [];
  object.traverse(child => {
    if (!child.visible) hiddenState.push({ obj: child, wasVisible: false });
  });

  const box = new THREE.Box3();
  try {
    box.setFromObject(object, true); // true = ignore invisible (three.js r151+)
  } catch {
    // Fallback — some object types (e.g., empty groups) throw; return empty
    return EMPTY_SPHERE;
  }

  // Restore visibility state (we didn't actually mutate, but keep the guard)
  hiddenState.forEach(({ obj, wasVisible }) => { obj.visible = wasVisible; });

  if (box.isEmpty()) return EMPTY_SPHERE;

  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);

  return {
    center: { x: sphere.center.x, y: sphere.center.y, z: sphere.center.z },
    radius: sphere.radius,
  };
}

/**
 * Union two bounding spheres — returns a new sphere encompassing both.
 * Handles empty spheres gracefully.
 */
export function unionSpheres(a: BoundingSphere, b: BoundingSphere): BoundingSphere {
  if (a.radius === 0) return b;
  if (b.radius === 0) return a;

  const dx = b.center.x - a.center.x;
  const dy = b.center.y - a.center.y;
  const dz = b.center.z - a.center.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // If one sphere is fully inside the other
  if (dist + b.radius <= a.radius) return a;
  if (dist + a.radius <= b.radius) return b;

  // Otherwise compute the smallest enclosing sphere
  const newRadius = (dist + a.radius + b.radius) / 2;
  const t = (newRadius - a.radius) / dist;

  return {
    center: {
      x: a.center.x + dx * t,
      y: a.center.y + dy * t,
      z: a.center.z + dz * t,
    },
    radius: newRadius,
  };
}

/**
 * Find the Object3D with a matching userData.cabinetId in the scene.
 */
export function findCabinetObject(threeScene: THREE.Scene, cabinetId: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  threeScene.traverse(child => {
    if (found) return;
    if (child.userData?.cabinetId === cabinetId) {
      found = child;
    }
  });
  return found;
}

/**
 * Compute bounds for a single cabinet (by userData.cabinetId).
 */
export function computeCabinetBounds(
  threeScene: THREE.Scene,
  cabinetId: string,
): BoundingSphere {
  const obj = findCabinetObject(threeScene, cabinetId);
  return computeBoundsForObject(obj);
}

/**
 * Compute bounds for all visible cabinet objects in the scene (union).
 */
export function computeSceneBounds(threeScene: THREE.Scene): BoundingSphere {
  let result: BoundingSphere = EMPTY_SPHERE;
  threeScene.traverse(child => {
    if (child.userData?.cabinetId) {
      const cabBounds = computeBoundsForObject(child);
      result = unionSpheres(result, cabBounds);
    }
  });
  return result;
}

/**
 * Find assembly group within cabinet(s) and compute bounds.
 * Matches by userData.assemblyId.
 */
export function computeAssemblyBounds(
  threeScene: THREE.Scene,
  assemblyId: string,
): BoundingSphere {
  let found: THREE.Object3D | null = null;
  threeScene.traverse(child => {
    if (found) return;
    if (child.userData?.assemblyId === assemblyId) {
      found = child;
    }
  });
  return computeBoundsForObject(found);
}

/**
 * Find part mesh by userData.partId and compute bounds.
 */
export function computePartBounds(
  threeScene: THREE.Scene,
  partId: string,
): BoundingSphere {
  let found: THREE.Object3D | null = null;
  threeScene.traverse(child => {
    if (found) return;
    if (child.userData?.partId === partId) {
      found = child;
    }
  });
  return computeBoundsForObject(found);
}

/**
 * Get bounds for any subject, using cache. Dispatches to the right compute fn.
 */
export function getBoundsForSubject(
  subject: { type: 'scene' | 'cabinet' | 'assembly' | 'part' | 'custom_bounds'; id: string; bounds?: BoundingSphere },
  threeScene: THREE.Scene | null,
  cache: BoundsCache,
): BoundingSphere {
  // Custom bounds come pre-computed
  if (subject.type === 'custom_bounds' && subject.bounds) return subject.bounds;

  if (!threeScene) return subject.bounds ?? EMPTY_SPHERE;

  switch (subject.type) {
    case 'scene': {
      if (cache.sceneBounds) return cache.sceneBounds;
      const bounds = computeSceneBounds(threeScene);
      cache.sceneBounds = bounds;
      return bounds;
    }
    case 'cabinet': {
      const cached = cache.cabinetBounds[subject.id];
      if (cached) return cached;
      const bounds = computeCabinetBounds(threeScene, subject.id);
      cache.cabinetBounds[subject.id] = bounds;
      return bounds;
    }
    case 'assembly': {
      const cached = cache.assemblyBounds[subject.id];
      if (cached) return cached;
      const bounds = computeAssemblyBounds(threeScene, subject.id);
      cache.assemblyBounds[subject.id] = bounds;
      return bounds;
    }
    case 'part': {
      const cached = cache.partBounds[subject.id];
      if (cached) return cached;
      const bounds = computePartBounds(threeScene, subject.id);
      cache.partBounds[subject.id] = bounds;
      return bounds;
    }
    default:
      return subject.bounds ?? EMPTY_SPHERE;
  }
}

/**
 * Invalidate cache at a specific scope (or globally if no scope).
 * Bumps geometryVersion so anything watching can re-render.
 */
export function invalidateBoundsCache(
  cache: BoundsCache,
  scope?: 'scene' | 'cabinet' | 'assembly' | 'part' | 'all',
  id?: string,
): BoundsCache {
  const next: BoundsCache = {
    ...cache,
    geometryVersion: cache.geometryVersion + 1,
    computedAt: Date.now(),
  };

  if (!scope || scope === 'all') {
    next.sceneBounds = undefined;
    next.cabinetBounds = {};
    next.assemblyBounds = {};
    next.partBounds = {};
    return next;
  }

  if (scope === 'scene') {
    next.sceneBounds = undefined;
    return next;
  }

  if (scope === 'cabinet') {
    if (id) {
      const { [id]: _removed, ...rest } = next.cabinetBounds;
      next.cabinetBounds = rest;
    } else {
      next.cabinetBounds = {};
    }
    // Cabinet changes affect scene bounds
    next.sceneBounds = undefined;
    return next;
  }

  if (scope === 'assembly') {
    if (id) {
      const { [id]: _removed, ...rest } = next.assemblyBounds;
      next.assemblyBounds = rest;
    } else {
      next.assemblyBounds = {};
    }
    return next;
  }

  if (scope === 'part') {
    if (id) {
      const { [id]: _removed, ...rest } = next.partBounds;
      next.partBounds = rest;
    } else {
      next.partBounds = {};
    }
    return next;
  }

  return next;
}

/**
 * Create a fresh empty cache.
 */
export function createBoundsCache(): BoundsCache {
  return {
    sceneBounds: undefined,
    cabinetBounds: {},
    assemblyBounds: {},
    partBounds: {},
    computedAt: Date.now(),
    geometryVersion: 0,
  };
}

const EMPTY_SPHERE: BoundingSphere = {
  center: { x: 0, y: 0, z: 0 },
  radius: 0,
};
