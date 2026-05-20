/**
 * Geometry Engine
 * Bounding box computation, part grouping by clean name, structural role classification.
 */

import type {
  ParsedModel,
  MeshObject,
  BoundingBox3D,
  PartGroup,
  PartRole,
  ViewDirection,
} from '../types/workshop-viewer.types';
import { PART_ROLE_PATTERNS } from '../constants/workshop-viewer.constants';

export interface MeshDimensionEstimate {
  length: number;
  width: number;
  thickness: number;
  method: 'obb' | 'aabb';
  confidence: number;
  uncertain: boolean;
  aabb: { length: number; width: number; thickness: number };
  obb?: { length: number; width: number; thickness: number };
}

/**
 * Compute axis-aligned bounding box from a vertex array.
 */
export function computeBoundingBox(vertices: Float32Array): BoundingBox3D {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (z < minZ) minZ = z;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (z > maxZ) maxZ = z;
  }

  if (!isFinite(minX)) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }

  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

/**
 * Merge multiple bounding boxes into one encompassing bbox.
 */
export function mergeBoundingBoxes(boxes: BoundingBox3D[]): BoundingBox3D {
  if (boxes.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const b of boxes) {
    if (b.min.x < minX) minX = b.min.x;
    if (b.min.y < minY) minY = b.min.y;
    if (b.min.z < minZ) minZ = b.min.z;
    if (b.max.x > maxX) maxX = b.max.x;
    if (b.max.y > maxY) maxY = b.max.y;
    if (b.max.z > maxZ) maxZ = b.max.z;
  }

  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

/**
 * Compute dimensions (width, depth, height) from a bounding box.
 */
export function bboxDimensions(bbox: BoundingBox3D): { w: number; d: number; h: number } {
  return {
    w: Math.abs(bbox.max.x - bbox.min.x),
    d: Math.abs(bbox.max.y - bbox.min.y),
    h: Math.abs(bbox.max.z - bbox.min.z),
  };
}

function dot(a: [number, number, number], b: [number, number, number]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(v: [number, number, number]): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function normalize(v: [number, number, number]): [number, number, number] {
  const n = norm(v);
  if (n < 1e-9) return [0, 0, 0];
  return [v[0] / n, v[1] / n, v[2] / n];
}

function sortedLwt(a: number, b: number, c: number): { length: number; width: number; thickness: number } {
  const sorted = [a, b, c].sort((x, y) => x - y);
  return { thickness: sorted[0], width: sorted[1], length: sorted[2] };
}

function jacobiEigenDecomposition3(
  input: [[number, number, number], [number, number, number], [number, number, number]],
): { values: [number, number, number]; vectors: [[number, number, number], [number, number, number], [number, number, number]] } {
  const a = input.map(r => [...r]) as [[number, number, number], [number, number, number], [number, number, number]];
  const v: [[number, number, number], [number, number, number], [number, number, number]] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  for (let iter = 0; iter < 24; iter++) {
    let p = 0;
    let q = 1;
    let max = Math.abs(a[0][1]);
    if (Math.abs(a[0][2]) > max) {
      max = Math.abs(a[0][2]);
      p = 0; q = 2;
    }
    if (Math.abs(a[1][2]) > max) {
      max = Math.abs(a[1][2]);
      p = 1; q = 2;
    }
    if (max < 1e-10) break;

    const app = a[p][p];
    const aqq = a[q][q];
    const apq = a[p][q];
    const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    for (let k = 0; k < 3; k++) {
      const akp = a[k][p];
      const akq = a[k][q];
      a[k][p] = c * akp - s * akq;
      a[k][q] = s * akp + c * akq;
    }
    for (let k = 0; k < 3; k++) {
      const apk = a[p][k];
      const aqk = a[q][k];
      a[p][k] = c * apk - s * aqk;
      a[q][k] = s * apk + c * aqk;
    }
    for (let k = 0; k < 3; k++) {
      const vkp = v[k][p];
      const vkq = v[k][q];
      v[k][p] = c * vkp - s * vkq;
      v[k][q] = s * vkp + c * vkq;
    }
  }

  const values: [number, number, number] = [a[0][0], a[1][1], a[2][2]];
  const vectors: [[number, number, number], [number, number, number], [number, number, number]] = [
    normalize([v[0][0], v[1][0], v[2][0]]),
    normalize([v[0][1], v[1][1], v[2][1]]),
    normalize([v[0][2], v[1][2], v[2][2]]),
  ];
  return { values, vectors };
}

function estimatePanelThicknessAxis(
  vertices: Float32Array,
  faces: Uint16Array | Uint32Array | undefined,
  axes: [[number, number, number], [number, number, number], [number, number, number]],
): number | null {
  if (!faces || faces.length < 3) return null;

  const areaPos = [0, 0, 0];
  const areaNeg = [0, 0, 0];

  for (let i = 0; i + 2 < faces.length; i += 3) {
    const i0 = faces[i] * 3;
    const i1 = faces[i + 1] * 3;
    const i2 = faces[i + 2] * 3;
    const p0: [number, number, number] = [vertices[i0], vertices[i0 + 1], vertices[i0 + 2]];
    const p1: [number, number, number] = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]];
    const p2: [number, number, number] = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]];
    const e1: [number, number, number] = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2: [number, number, number] = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const n = cross(e1, e2);
    const area = 0.5 * norm(n);
    if (area <= 1e-9) continue;
    const unit = normalize(n);
    for (let axis = 0; axis < 3; axis++) {
      const align = dot(unit, axes[axis]);
      if (align > 0.85) areaPos[axis] += area;
      else if (align < -0.85) areaNeg[axis] += area;
    }
  }

  let bestAxis = -1;
  let bestPairArea = 0;
  for (let axis = 0; axis < 3; axis++) {
    const pairArea = Math.min(areaPos[axis], areaNeg[axis]);
    if (pairArea > bestPairArea) {
      bestPairArea = pairArea;
      bestAxis = axis;
    }
  }
  return bestAxis >= 0 && bestPairArea > 0 ? bestAxis : null;
}

export function estimateMeshDimensions(
  vertices: Float32Array,
  faces?: Uint16Array | Uint32Array,
): MeshDimensionEstimate {
  const aabb = bboxDimensions(computeBoundingBox(vertices));
  const aabbSorted = sortedLwt(aabb.w, aabb.d, aabb.h);
  if (vertices.length < 9) {
    return {
      ...aabbSorted,
      method: 'aabb',
      confidence: 1,
      uncertain: false,
      aabb: aabbSorted,
    };
  }

  let meanX = 0;
  let meanY = 0;
  let meanZ = 0;
  const n = vertices.length / 3;
  for (let i = 0; i < vertices.length; i += 3) {
    meanX += vertices[i];
    meanY += vertices[i + 1];
    meanZ += vertices[i + 2];
  }
  meanX /= n;
  meanY /= n;
  meanZ /= n;

  let cxx = 0; let cxy = 0; let cxz = 0;
  let cyy = 0; let cyz = 0; let czz = 0;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i] - meanX;
    const y = vertices[i + 1] - meanY;
    const z = vertices[i + 2] - meanZ;
    cxx += x * x; cxy += x * y; cxz += x * z;
    cyy += y * y; cyz += y * z; czz += z * z;
  }
  const inv = 1 / Math.max(1, n - 1);
  const cov: [[number, number, number], [number, number, number], [number, number, number]] = [
    [cxx * inv, cxy * inv, cxz * inv],
    [cxy * inv, cyy * inv, cyz * inv],
    [cxz * inv, cyz * inv, czz * inv],
  ];

  const { vectors } = jacobiEigenDecomposition3(cov);
  const extents = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < vertices.length; i += 3) {
      const p: [number, number, number] = [vertices[i] - meanX, vertices[i + 1] - meanY, vertices[i + 2] - meanZ];
      const s = dot(p, vectors[axis]);
      if (s < min) min = s;
      if (s > max) max = s;
    }
    extents[axis] = Math.max(0, max - min);
  }

  if (extents.some(v => !isFinite(v)) || extents.every(v => v < 1e-9)) {
    return {
      ...aabbSorted,
      method: 'aabb',
      confidence: 1,
      uncertain: false,
      aabb: aabbSorted,
    };
  }

  const maybeThicknessAxis = estimatePanelThicknessAxis(vertices, faces, vectors);
  let obbSorted = sortedLwt(extents[0], extents[1], extents[2]);
  if (maybeThicknessAxis !== null) {
    const thickness = extents[maybeThicknessAxis];
    const others = extents.filter((_, idx) => idx !== maybeThicknessAxis).sort((x, y) => y - x);
    obbSorted = {
      length: others[0] ?? obbSorted.length,
      width: others[1] ?? obbSorted.width,
      thickness,
    };
  }

  const rel = (x: number, y: number) => Math.abs(x - y) / Math.max(1, Math.abs(y));
  const deviation = Math.max(
    rel(obbSorted.length, aabbSorted.length),
    rel(obbSorted.width, aabbSorted.width),
    rel(obbSorted.thickness, aabbSorted.thickness),
  );
  const uncertain = deviation > 0.1;
  const confidence = Math.max(0, Math.min(1, 1 - deviation));

  return {
    ...obbSorted,
    method: 'obb',
    confidence,
    uncertain,
    aabb: aabbSorted,
    obb: obbSorted,
  };
}

/**
 * Compute the overall bounding box of the entire model.
 */
export function computeModelBounds(model: ParsedModel): BoundingBox3D {
  return mergeBoundingBoxes(model.objects.map(obj => computeBoundingBox(obj.vertices)));
}

/**
 * Strip PolyBoard trailing numbers and brackets from mesh names.
 * "Bottom 1" → "Bottom"
 * "Vertical Division [2] 16" → "Vertical Division"
 * "Door 1 (Double) [1]" → "Door 1 (Double)"
 * "Left Side Drawer 1 [1]" → "Left Side Drawer"
 */
export function cleanPartName(name: string): string {
  return name
    .replace(/\s*\[\d+\]\s*\d*\s*$/, '') // Remove trailing [N] and optional number
    .replace(/\s+\d+\s*$/, '')            // Remove trailing number
    .trim();
}

/**
 * Group mesh objects by their cleaned name.
 */
export function groupPartsByName(objects: MeshObject[]): PartGroup[] {
  const groups = new Map<string, MeshObject[]>();

  for (const obj of objects) {
    const clean = cleanPartName(obj.name);
    if (!groups.has(clean)) groups.set(clean, []);
    groups.get(clean)!.push(obj);
  }

  const result: PartGroup[] = [];
  for (const [cleanName, groupObjs] of groups) {
    const boxes = groupObjs.map(o => computeBoundingBox(o.vertices));
    const bbox = mergeBoundingBoxes(boxes);

    result.push({
      cleanName,
      objects: groupObjs,
      bbox,
      dims: bboxDimensions(bbox),
      meshCount: groupObjs.length,
    });
  }

  return result;
}

/**
 * Classify a part name into a structural role.
 */
export function classifyPartRole(partName: string): PartRole {
  const cleaned = cleanPartName(partName);
  for (const { pattern, role } of PART_ROLE_PATTERNS) {
    if (pattern.test(cleaned)) return role;
  }
  return 'other';
}

/**
 * Get the center point of a bounding box.
 */
export function bboxCenter(bbox: BoundingBox3D): { x: number; y: number; z: number } {
  return {
    x: (bbox.min.x + bbox.max.x) / 2,
    y: (bbox.min.y + bbox.max.y) / 2,
    z: (bbox.min.z + bbox.max.z) / 2,
  };
}

/**
 * Check if two bounding boxes overlap in 3D space (with tolerance).
 */
export function bboxOverlaps(a: BoundingBox3D, b: BoundingBox3D, tolerance: number = 5): boolean {
  return (
    a.min.x - tolerance <= b.max.x && a.max.x + tolerance >= b.min.x &&
    a.min.y - tolerance <= b.max.y && a.max.y + tolerance >= b.min.y &&
    a.min.z - tolerance <= b.max.z && a.max.z + tolerance >= b.min.z
  );
}

/**
 * Check if bounding box A is spatially near bounding box B (proximity check for assembly grouping).
 * "Near" means the gap between them is less than maxGap mm on all axes.
 */
export function bboxNear(a: BoundingBox3D, b: BoundingBox3D, maxGap: number = 50): boolean {
  const gapX = Math.max(0, a.min.x - b.max.x, b.min.x - a.max.x);
  const gapY = Math.max(0, a.min.y - b.max.y, b.min.y - a.max.y);
  const gapZ = Math.max(0, a.min.z - b.max.z, b.min.z - a.max.z);
  return gapX < maxGap && gapY < maxGap && gapZ < maxGap;
}

/**
 * Select the orthographic view direction that shows the largest projected area
 * of a bounding box. Useful for automatically choosing the best detail view.
 */
export function selectBestView(bbox: BoundingBox3D): ViewDirection {
  const w = bbox.max.x - bbox.min.x;  // X extent
  const d = bbox.max.y - bbox.min.y;  // Y extent (depth)
  const h = bbox.max.z - bbox.min.z;  // Z extent (height)

  const areas: { dir: ViewDirection; area: number }[] = [
    { dir: 'front', area: w * h },    // XZ plane
    { dir: 'right', area: d * h },    // YZ plane
    { dir: 'top', area: w * d },      // XY plane
  ];
  areas.sort((a, b) => b.area - a.area);
  return areas[0].dir;
}
