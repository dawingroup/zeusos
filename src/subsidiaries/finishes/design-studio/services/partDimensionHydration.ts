/**
 * Second-pass dimension stamping for grouped model parts: when the AI returns
 * mesh names that do not line up with `buildGeometrySummaries` keys, or
 * a mesh is skipped in summaries (degenerate tris), `makePartStub` can leave
 * `dimensions` empty. This pass walks the parsed GLB and applies the same
 * OBB / AABB logic as the primary grouping path.
 */
import type { MeshObject, ParsedModel } from '../types/workshop-viewer.types';
import type { ScenePart } from '../types/assembly.types';
import { computeBoundingBox, estimateMeshDimensions } from './geometryEngine';
import type { GeomBox } from './partGeometryClassifier';

function normMeshKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Find a mesh in the parsed model for a part's `meshNodeId` / stored name
 * (exact `dawinMeshId`, exact `name`, or normalised `name` match).
 */
export function findMeshObjectForPartMeshId(
  model: ParsedModel,
  meshNodeId: string,
): MeshObject | undefined {
  const objs = model.objects ?? [];
  for (const o of objs) {
    if (o.dawinMeshId && o.dawinMeshId === meshNodeId) return o;
  }
  for (const o of objs) {
    if (o.name === meshNodeId) return o;
  }
  const n = normMeshKey(meshNodeId);
  for (const o of objs) {
    if (normMeshKey(o.name ?? '') === n) return o;
  }
  return undefined;
}

function bbox3dToGeom(b: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } }): GeomBox {
  return { min: { x: b.min.x, y: b.min.y, z: b.min.z }, max: { x: b.max.x, y: b.max.y, z: b.max.z } };
}

/** True when stored dimensions are missing or effectively zero. */
export function partNeedsDimensionHydration(part: ScenePart): boolean {
  const d = part.dimensions;
  if (!d) return true;
  const l = d.length ?? 0;
  const w = d.width ?? 0;
  const t = d.thickness ?? 0;
  if (l <= 0 && w <= 0 && t <= 0) return true;
  if (l <= 1 && w <= 1 && t <= 1) return true;
  return false;
}

/**
 * Fill `dimensions` + `dimensionQuality` from a mesh's vertices, mirroring
 * `makePartStub` in `aiAssemblyGrouper.service`.
 */
function stampDimensionsFromMeshObject(part: ScenePart, obj: MeshObject): ScenePart {
  const out: ScenePart = { ...part };
  const vertices = obj.vertices;
  if (!vertices || vertices.length < 9) return part;

  const dimsEstimate = estimateMeshDimensions(vertices, obj.faces);
  if (dimsEstimate) {
    out.dimensions = {
      length: Math.round(dimsEstimate.length),
      width: Math.round(dimsEstimate.width),
      thickness: Math.round(dimsEstimate.thickness),
      grainDirection: 'length',
    };
    out.dimensionQuality = {
      source: dimsEstimate.method,
      confidence: dimsEstimate.confidence,
      uncertain: dimsEstimate.uncertain,
      aabb: dimsEstimate.aabb,
      obb: dimsEstimate.obb,
    };
    return out;
  }

  const bbox3 = computeBoundingBox(vertices);
  const bbox = bbox3dToGeom(bbox3);
  const dx = Math.abs(bbox.max.x - bbox.min.x);
  const dy = Math.abs(bbox.max.y - bbox.min.y);
  const dz = Math.abs(bbox.max.z - bbox.min.z);
  const sorted = [dx, dy, dz].sort((a, b) => a - b) as [number, number, number];
  const [thickness, width, length] = sorted;
  if (length > 0) {
    out.dimensions = {
      length: Math.round(length),
      width: Math.round(width),
      thickness: Math.round(thickness),
      grainDirection: length === dx || length === dy ? 'length' : 'none',
    };
    out.dimensionQuality = {
      source: 'aabb',
      confidence: 0.6,
      uncertain: false,
      aabb: { length, width, thickness },
    };
  }
  return out;
}

/**
 * For every part that still lacks useful dimensions, resolve its mesh in
 * `parsedModel` and stamp L/W/T from geometry.
 */
export function hydrateMissingPartDimensions(parts: ScenePart[], parsedModel: ParsedModel): ScenePart[] {
  return parts.map(p => {
    if (!partNeedsDimensionHydration(p)) return p;
    if (!p.meshNodeId) return p;
    const obj = findMeshObjectForPartMeshId(parsedModel, p.meshNodeId);
    if (!obj) return p;
    return stampDimensionsFromMeshObject(p, obj);
  });
}
