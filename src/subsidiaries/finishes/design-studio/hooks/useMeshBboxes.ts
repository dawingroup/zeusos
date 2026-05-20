/**
 * useMeshBboxes — memoize a { meshName → bbox } map from a parsedModel.
 *
 * The Part Detail panel uses this for the "touching" connections
 * bucket: which parts' meshes are spatially adjacent to the selected
 * one. Computing bboxes from vertex arrays is O(vertices) per mesh
 * but each mesh is small; memoizing against the parsedModel reference
 * means we recompute only when the user loads a different cabinet.
 */
import { useMemo } from 'react';
import type { ParsedModel } from '../types/workshop-viewer.types';
import { computeBoundingBox } from '../services/geometryEngine';
import type { GeomBox } from '../services/partGeometryClassifier';

/**
 * Build a lookup of mesh identifier → axis-aligned bbox (mm in model space).
 * Keys both `mesh.name` and `dawinMeshId` when present so raycast + part
 * panels can resolve either label the GLB carries.
 */
export function buildMeshBboxMap(
  parsedModel: ParsedModel | null | undefined,
): Map<string, GeomBox> {
  const map = new Map<string, GeomBox>();
  for (const obj of parsedModel?.objects ?? []) {
    if (!obj.vertices || obj.vertices.length === 0) continue;
    const bb = computeBoundingBox(obj.vertices);
    const box: GeomBox = {
      min: { x: bb.min.x, y: bb.min.y, z: bb.min.z },
      max: { x: bb.max.x, y: bb.max.y, z: bb.max.z },
    };
    if (obj.name) map.set(obj.name, box);
    if (obj.dawinMeshId) map.set(obj.dawinMeshId, box);
  }
  return map;
}

const normKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_');

/** Resolve a bbox for a stored `meshNodeId` / GLB mesh name. */
export function lookupMeshBbox(
  map: ReadonlyMap<string, GeomBox> | Map<string, GeomBox> | undefined,
  meshNodeId: string,
): GeomBox | undefined {
  if (!map) return undefined;
  if (map.has(meshNodeId)) return map.get(meshNodeId);
  const n = normKey(meshNodeId);
  for (const [k, v] of map) {
    if (normKey(k) === n) return v;
  }
  return undefined;
}

export function useMeshBboxes(
  parsedModel: ParsedModel | null | undefined,
): Map<string, GeomBox> | undefined {
  return useMemo(() => {
    if (!parsedModel) return undefined;
    return buildMeshBboxMap(parsedModel);
  }, [parsedModel]);
}
