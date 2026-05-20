/**
 * Orthographic and Isometric Projection Utilities
 *
 * Projects 3D silhouette edges to 2D for each standard view direction.
 * Deduplicates overlapping 2D edges (1mm precision).
 */

import * as THREE from 'three';
import type { ViewDirection, ProjectedEdge, ProjectedView, BoundingBox3D } from '../types/workshop-viewer.types';
import type { SilhouetteEdge, Vec3 } from './silhouetteExtractor';

interface Point2D {
  x: number;
  y: number;
}

const DEDUP_PRECISION = 1; // mm — round to this for dedup

const COS30 = Math.cos(Math.PI / 6); // 0.866
const SIN30 = Math.sin(Math.PI / 6); // 0.5

/**
 * Project a 3D vertex to 2D for the given view direction.
 */
function projectVertex(v: Vec3, direction: ViewDirection): Point2D {
  switch (direction) {
    case 'front':  return { x: v.x,  y: v.z };
    case 'back':   return { x: -v.x, y: v.z };
    case 'right':  return { x: v.y,  y: v.z };
    case 'left':   return { x: -v.y, y: v.z };
    case 'top':    return { x: v.x,  y: v.y };
    case 'bottom': return { x: v.x,  y: -v.y };
    case 'iso':
      return {
        x: (v.x - v.y) * COS30,
        y: -v.z + (v.x + v.y) * SIN30,
      };
    case 'iso_ne':
      return {
        x: (v.y - v.x) * COS30,  // Mirror X for NE view
        y: -v.z + (v.x + v.y) * SIN30,
      };
    default:
      return { x: v.x, y: v.z };
  }
}

/**
 * Get the depth value of a 3D point along the view direction.
 * Used for hidden line detection — lower depth = closer to camera.
 */
export function getDepthAlongView(v: Vec3, direction: ViewDirection): number {
  // Convention: LOWER depth = CLOSER to camera.
  // Depth increases in the direction the camera looks (away from viewer).
  switch (direction) {
    case 'front':  return v.y;   // Camera at -Y → closer = lower Y
    case 'back':   return -v.y;  // Camera at +Y → closer = higher Y
    case 'right':  return -v.x;  // Camera at +X → closer = higher X
    case 'left':   return v.x;   // Camera at -X → closer = lower X
    case 'top':    return -v.z;  // Camera at +Z → closer = higher Z
    case 'bottom': return v.z;   // Camera at -Z → closer = lower Z
    case 'iso': {
      // SW iso: camera at (-X,-Y,+Z) looking toward origin
      // depth = dot(point, viewDir) where viewDir = (1,1,-1)/sqrt3
      const INV_SQRT3 = 1 / Math.sqrt(3);
      return (v.x + v.y - v.z) * INV_SQRT3;
    }
    case 'iso_ne': {
      // NE iso: camera at (+X,+Y,+Z) looking toward origin
      // viewDir = (-1,-1,-1)/sqrt3, depth = -(x+y+z)
      const INV_SQRT3_NE = 1 / Math.sqrt(3);
      return -(v.x + v.y + v.z) * INV_SQRT3_NE;
    }
    default:       return v.y;
  }
}

function roundCoord(val: number): number {
  return Math.round(val / DEDUP_PRECISION) * DEDUP_PRECISION;
}

function edge2DKey(a: Point2D, b: Point2D): string {
  const ax = roundCoord(a.x), ay = roundCoord(a.y);
  const bx = roundCoord(b.x), by = roundCoord(b.y);
  // Normalize direction so (A→B) and (B→A) produce the same key
  if (ax < bx || (ax === bx && ay < by)) {
    return `${ax},${ay}-${bx},${by}`;
  }
  return `${bx},${by}-${ax},${ay}`;
}

/**
 * Project silhouette edges to a 2D view, deduplicating overlapping edges.
 */
export function projectEdgesToView(
  edges: SilhouetteEdge[],
  direction: ViewDirection | 'iso',
): ProjectedEdge[] {
  const seen = new Set<string>();
  const projected: ProjectedEdge[] = [];
  let edgeIdCounter = 0;

  for (const edge of edges) {
    const a2d = projectVertex(edge.a, direction);
    const b2d = projectVertex(edge.b, direction);

    // Skip zero-length edges after projection
    const dx = a2d.x - b2d.x;
    const dy = a2d.y - b2d.y;
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) continue;

    const key = edge2DKey(a2d, b2d);
    if (seen.has(key)) continue;
    seen.add(key);

    projected.push({
      id: `e${edgeIdCounter++}`,
      partName: edge.partName,
      a2d,
      b2d,
      a3d: edge.a,
      b3d: edge.b,
      visibility: 'visible', // Default; hiddenLineEngine will reclassify
    });
  }

  return projected;
}

/**
 * Create a complete ProjectedView from silhouette edges.
 */
export function createProjectedView(
  edges: SilhouetteEdge[],
  direction: ViewDirection | 'iso',
): ProjectedView {
  const projectedEdges = projectEdgesToView(edges, direction);

  // Compute bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const edge of projectedEdges) {
    minX = Math.min(minX, edge.a2d.x, edge.b2d.x);
    minY = Math.min(minY, edge.a2d.y, edge.b2d.y);
    maxX = Math.max(maxX, edge.a2d.x, edge.b2d.x);
    maxY = Math.max(maxY, edge.a2d.y, edge.b2d.y);
  }

  if (!isFinite(minX)) {
    minX = minY = maxX = maxY = 0;
  }

  return {
    direction,
    edges: projectedEdges,
    bounds: { minX, minY, maxX, maxY },
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Project a BoundingBox3D to 2D bounds for a given view direction.
 */
export function projectBbox(bbox: BoundingBox3D, direction: ViewDirection): {
  minX: number; minY: number; maxX: number; maxY: number;
  depthMin: number; depthMax: number;
} {
  const corners: Vec3[] = [
    { x: bbox.min.x, y: bbox.min.y, z: bbox.min.z },
    { x: bbox.max.x, y: bbox.min.y, z: bbox.min.z },
    { x: bbox.min.x, y: bbox.max.y, z: bbox.min.z },
    { x: bbox.max.x, y: bbox.max.y, z: bbox.min.z },
    { x: bbox.min.x, y: bbox.min.y, z: bbox.max.z },
    { x: bbox.max.x, y: bbox.min.y, z: bbox.max.z },
    { x: bbox.min.x, y: bbox.max.y, z: bbox.max.z },
    { x: bbox.max.x, y: bbox.max.y, z: bbox.max.z },
  ];

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let depthMin = Infinity, depthMax = -Infinity;

  for (const c of corners) {
    const p = projectVertex(c, direction);
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
    const d = getDepthAlongView(c, direction);
    depthMin = Math.min(depthMin, d);
    depthMax = Math.max(depthMax, d);
  }

  return { minX, minY, maxX, maxY, depthMin, depthMax };
}

// ─── BVH-accelerated projection wrapper ──────────────────────────────────────

import { generateProjectedEdges, type ProjectedEdgeSet } from '../services/hiddenLineEngine';

/**
 * Generate projected edges using BVH-accelerated library.
 * Returns null if the library fails (caller uses legacy path).
 */
export async function projectEdgesBVH(
  modelGroup: THREE.Object3D,
  view: string,
  renderer?: THREE.WebGLRenderer,
): Promise<ProjectedEdgeSet | null> {
  try {
    return await generateProjectedEdges(modelGroup, view, renderer);
  } catch (err) {
    console.warn(`[BVH] Edge projection failed for view "${view}", using legacy:`, err);
    return null;
  }
}
