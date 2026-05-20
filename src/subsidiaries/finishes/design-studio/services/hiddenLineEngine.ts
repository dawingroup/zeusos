// src/modules/workshop-viewer/services/hiddenLineEngine.ts
// BVH-accelerated edge projection using three-edge-projection by gkjohnson (MIT)
// The legacy classifyEdgeVisibility() is kept as a fallback export.

import * as THREE from 'three';
// @ts-ignore — no bundled types for this package; import directly to avoid SilhouetteGenerator's clipper2-js dep
import { ProjectionGenerator } from '@antoninrousset/three-edge-projection/src/ProjectionGenerator.js';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import type { ViewDirection, ProjectedEdge } from '../types/workshop-viewer.types';
import { projectBbox, getDepthAlongView } from '../utils/projectionUtils';

// ─── Patch THREE prototypes for BVH-accelerated raycasting ───────────────────
// @ts-ignore — three-mesh-bvh augments prototype
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
// @ts-ignore
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
// @ts-ignore
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// ─── Types ───────────────────────────────────────────────────────────────────

export type HiddenLineMode = 'faint' | 'hidden';

export interface ProjectedEdgeSet {
  visibleGeometry: THREE.BufferGeometry;
  hiddenGeometry: THREE.BufferGeometry;
}

// ─── View direction vectors (PolyBoard Z-up coordinate system) ───────────────
// three-edge-projection projects along -Y axis, so we rotate the scene to
// align the desired view direction with -Y before projecting.

export const VIEW_DIRECTIONS: Record<string, THREE.Vector3> = {
  front:   new THREE.Vector3(0, -1, 0),
  back:    new THREE.Vector3(0, 1, 0),
  right:   new THREE.Vector3(1, 0, 0),
  left:    new THREE.Vector3(-1, 0, 0),
  top:     new THREE.Vector3(0, 0, -1),
  bottom:  new THREE.Vector3(0, 0, 1),
  iso_sw:  new THREE.Vector3(-1, -1, -1).normalize(),
  iso_ne:  new THREE.Vector3(1, 1, -1).normalize(),
  iso:     new THREE.Vector3(-1, -1, -1).normalize(), // alias for iso_sw
};

// ─── Align scene for projection ──────────────────────────────────────────────

function createAlignedScene(
  sourceScene: THREE.Object3D,
  viewDirection: THREE.Vector3,
): THREE.Group {
  // three-edge-projection projects along -Y, so we rotate to map viewDir -> -Y
  const targetDir = new THREE.Vector3(0, -1, 0);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    viewDirection.clone().normalize(),
    targetDir,
  );

  const wrapper = new THREE.Group();
  wrapper.quaternion.copy(quaternion);

  // Clone meshes into wrapper in world space (don't mutate the original scene)
  sourceScene.updateMatrixWorld(true);
  sourceScene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const cloned = new THREE.Mesh(
      mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),
      mesh.material,
    );
    cloned.position.set(0, 0, 0);
    cloned.rotation.set(0, 0, 0);
    cloned.scale.set(1, 1, 1);
    wrapper.add(cloned);
  });

  wrapper.updateMatrixWorld(true);
  return wrapper;
}

// ─── Merge group geometry for ProjectionGenerator ────────────────────────────

function mergeGroupGeometry(group: THREE.Group): THREE.BufferGeometry {
  const geometries: THREE.BufferGeometry[] = [];

  group.updateMatrixWorld(true);
  group.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const cloned = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    geometries.push(cloned);
  });

  if (geometries.length === 0) return new THREE.BufferGeometry();
  if (geometries.length === 1) return geometries[0];

  // Merge all geometries manually
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geometries) {
    totalVerts += g.getAttribute('position').count;
    totalIndices += g.index ? g.index.count : g.getAttribute('position').count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);
  let vOff = 0;
  let iOff = 0;
  let vBase = 0;

  for (const g of geometries) {
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      positions[(vOff + i) * 3 + 0] = pos.getX(i);
      positions[(vOff + i) * 3 + 1] = pos.getY(i);
      positions[(vOff + i) * 3 + 2] = pos.getZ(i);
    }
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        indices[iOff + i] = g.index.array[i] + vBase;
      }
      iOff += g.index.count;
    } else {
      for (let i = 0; i < pos.count; i++) {
        indices[iOff + i] = vBase + i;
      }
      iOff += pos.count;
    }
    vBase += pos.count;
    vOff += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();
  return merged;
}

// ─── Main API: Generate projected edges for a view ───────────────────────────

export async function generateProjectedEdges(
  modelGroup: THREE.Object3D,
  view: string,
  _renderer?: THREE.WebGLRenderer,
  onProgress?: (message: string) => void,
): Promise<ProjectedEdgeSet> {
  const viewDir = VIEW_DIRECTIONS[view];
  if (!viewDir) {
    throw new Error(`Unknown view direction: "${view}". Valid: ${Object.keys(VIEW_DIRECTIONS).join(', ')}`);
  }

  const aligned = createAlignedScene(modelGroup, viewDir);
  const mergedGeom = mergeGroupGeometry(aligned);

  const generator = new ProjectionGenerator();
  generator.angleThreshold = 15;
  generator.includeIntersectionEdges = true;
  generator.sortEdges = true;

  const visibleGeometry = await generator.generateAsync(mergedGeom, {
    onProgress: onProgress ? (_p: number) => onProgress(`${Math.round(_p * 100)}%`) : undefined,
  }) as THREE.BufferGeometry;

  return {
    visibleGeometry,
    hiddenGeometry: new THREE.BufferGeometry(), // library returns only visible trimmed edges
  };
}

// ─── Convenience ─────────────────────────────────────────────────────────────

export function isIsometricView(view: string): boolean {
  return view === 'iso_sw' || view === 'iso_ne' || view === 'iso';
}

// ─── Raycaster-based occlusion (accurate, uses three-mesh-bvh) ───────────────

const RC_SAMPLE_COUNT = 5;
const RC_OCCLUSION_THRESHOLD = 0.7; // 70% of samples occluded → hidden
const RC_DEPTH_TOLERANCE = 2; // mm — occluder must be this much closer

/**
 * Classify projected edges as visible or hidden using actual mesh raycasting.
 * Much more accurate than bbox-based: tests against real triangle geometry.
 */
export function classifyWithRaycaster(
  edges: ProjectedEdge[],
  modelGroup: THREE.Object3D,
  direction: ViewDirection,
): ProjectedEdge[] {
  if (edges.length === 0) return edges;

  const viewDir = VIEW_DIRECTIONS[direction];
  if (!viewDir) return edges;
  const rayDir = viewDir.clone().normalize();

  // Collect meshes and build BVH acceleration structure on each
  const meshes: THREE.Mesh[] = [];
  modelGroup.traverse(c => {
    if ((c as THREE.Mesh).isMesh) {
      const m = c as THREE.Mesh;
      // @ts-ignore — patched by three-mesh-bvh
      if (!m.geometry.boundsTree) m.geometry.computeBoundsTree();
      meshes.push(m);
    }
  });

  if (meshes.length === 0) return edges;

  // Pre-group meshes by name for fast self-exclusion
  const meshesByName = new Map<string, THREE.Mesh[]>();
  for (const m of meshes) {
    const arr = meshesByName.get(m.name) ?? [];
    arr.push(m);
    meshesByName.set(m.name, arr);
  }

  const raycaster = new THREE.Raycaster();
  // @ts-ignore — three-mesh-bvh adds this property
  raycaster.firstHitOnly = true;

  const threshold = Math.ceil(RC_SAMPLE_COUNT * RC_OCCLUSION_THRESHOLD);

  return edges.map(edge => {
    let occluded = 0;

    // Build list of meshes to test against (all except this edge's own part)
    const otherMeshes = meshes.filter(m => m.name !== edge.partName);
    if (otherMeshes.length === 0) {
      return { ...edge, visibility: 'visible' as const };
    }

    for (let i = 0; i < RC_SAMPLE_COUNT; i++) {
      const t = 0.1 + (0.8 * i) / (RC_SAMPLE_COUNT - 1);
      const pt = new THREE.Vector3(
        edge.a3d.x + (edge.b3d.x - edge.a3d.x) * t,
        edge.a3d.y + (edge.b3d.y - edge.a3d.y) * t,
        edge.a3d.z + (edge.b3d.z - edge.a3d.z) * t,
      );

      const sampleDepth = getDepthAlongView(pt, direction);

      // Cast ray from far behind the sample toward the scene
      const origin = pt.clone().addScaledVector(rayDir, -10000);
      raycaster.set(origin, rayDir);

      const hits = raycaster.intersectObjects(otherMeshes, false);

      for (const hit of hits) {
        const hitDepth = getDepthAlongView(
          { x: hit.point.x, y: hit.point.y, z: hit.point.z },
          direction,
        );
        if (hitDepth < sampleDepth - RC_DEPTH_TOLERANCE) {
          occluded++;
          break;
        }
      }
    }

    return {
      ...edge,
      visibility: occluded >= threshold ? ('hidden' as const) : ('visible' as const),
    };
  });
}

// ─── LEGACY: Bbox-based occlusion (kept as fallback) ─────────────────────────

const SAMPLE_COUNT = 5;
// ISO views: bbox-based classifier can't distinguish same-face edges from truly occluded edges
// (e.g. top panel has shallower depth than front-face arches even though it doesn't block them).
// Use very high threshold for ISO so only deeply-occluded edges (e.g. back panel) get hidden.
const OCCLUSION_THRESHOLD_ORTHO = 0.7;
const OCCLUSION_THRESHOLD_ISO = 0.95; // needs almost all samples occluded — preserves arch/crease edges
const DEPTH_TOLERANCE_ORTHO = 2;
const DEPTH_TOLERANCE_ISO = 8;
const ORTHO_SAME_DEPTH = 5;
const ISO_BBOX_SHRINK = 0.05; // was 0.30 — too aggressive, caused missed hidden edges

interface PartBbox {
  partName: string;
  bbox: import('../types/workshop-viewer.types').BoundingBox3D;
}

interface ProjectedPartBbox {
  partName: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  depthMin: number;
  depthMax: number;
}

function isIsoView(dir: ViewDirection): boolean {
  return dir === 'iso' || dir === 'iso_ne';
}

/**
 * Classify projected edges as visible or hidden based on bbox occlusion.
 */
export function classifyEdgeVisibility(
  edges: ProjectedEdge[],
  partBboxes: PartBbox[],
  direction: ViewDirection,
): ProjectedEdge[] {
  if (edges.length === 0) return edges;

  const useIso = isIsoView(direction);

  const projectedBboxes: ProjectedPartBbox[] = partBboxes.map(pb => {
    const proj = projectBbox(pb.bbox, direction);

    if (useIso) {
      const w = proj.maxX - proj.minX;
      const h = proj.maxY - proj.minY;
      const shrinkX = w * ISO_BBOX_SHRINK;
      const shrinkY = h * ISO_BBOX_SHRINK;
      return {
        partName: pb.partName,
        minX: proj.minX + shrinkX,
        maxX: proj.maxX - shrinkX,
        minY: proj.minY + shrinkY,
        maxY: proj.maxY - shrinkY,
        depthMin: proj.depthMin,
        depthMax: proj.depthMax,
      };
    }

    return { partName: pb.partName, ...proj };
  });

  return edges.map(edge => {
    const occludedCount = countOccludedSamples(edge, projectedBboxes, direction);
    const threshold = useIso ? OCCLUSION_THRESHOLD_ISO : OCCLUSION_THRESHOLD_ORTHO;
    const isHidden = occludedCount >= Math.ceil(SAMPLE_COUNT * threshold);

    return {
      ...edge,
      visibility: isHidden ? 'hidden' as const : 'visible' as const,
    };
  });
}

function countOccludedSamples(
  edge: ProjectedEdge,
  projectedBboxes: ProjectedPartBbox[],
  direction: ViewDirection,
): number {
  let occluded = 0;

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = 0.1 + (0.8 * i) / (SAMPLE_COUNT - 1);

    const sx = edge.a2d.x + (edge.b2d.x - edge.a2d.x) * t;
    const sy = edge.a2d.y + (edge.b2d.y - edge.a2d.y) * t;

    const s3d = {
      x: edge.a3d.x + (edge.b3d.x - edge.a3d.x) * t,
      y: edge.a3d.y + (edge.b3d.y - edge.a3d.y) * t,
      z: edge.a3d.z + (edge.b3d.z - edge.a3d.z) * t,
    };
    const sampleDepth = getDepthAlongView(s3d, direction);

    const isOccluded = isIsoView(direction)
      ? isSampleOccludedIso(sx, sy, sampleDepth, edge.partName, projectedBboxes)
      : isSampleOccludedOrtho(sx, sy, sampleDepth, edge.partName, projectedBboxes);

    if (isOccluded) occluded++;
  }

  return occluded;
}

function isSampleOccludedOrtho(
  sx: number, sy: number,
  sampleDepth: number,
  edgePartName: string,
  projectedBboxes: ProjectedPartBbox[],
): boolean {
  for (const pb of projectedBboxes) {
    if (pb.partName === edgePartName) continue;
    if (sx < pb.minX || sx > pb.maxX || sy < pb.minY || sy > pb.maxY) continue;
    if (sampleDepth >= pb.depthMin - ORTHO_SAME_DEPTH &&
        sampleDepth <= pb.depthMax + ORTHO_SAME_DEPTH) {
      continue;
    }
    if (pb.depthMin < sampleDepth - DEPTH_TOLERANCE_ORTHO) {
      return true;
    }
  }
  return false;
}

function isSampleOccludedIso(
  sx: number, sy: number,
  sampleDepth: number,
  edgePartName: string,
  projectedBboxes: ProjectedPartBbox[],
): boolean {
  for (const pb of projectedBboxes) {
    if (pb.partName === edgePartName) continue;
    if (sx < pb.minX || sx > pb.maxX || sy < pb.minY || sy > pb.maxY) continue;
    if (pb.depthMin < sampleDepth - DEPTH_TOLERANCE_ISO) {
      return true;
    }
  }
  return false;
}
