/**
 * splitCabinetDetection — find meshes inside a single SceneCabinet
 * that should really be separate cabinets.
 *
 * Scenario: bulk import imports a whole kitchen run as one GLB, and
 * AI detection sometimes groups everything into a single
 * SceneCabinet. Downstream (cut lists, DM parts sync, production
 * orders) treat that as ONE cabinet even though the shop floor sees
 * four. This module identifies the clusters and feeds the UI that
 * lets the user split them.
 *
 * Algorithm: connected-components on bboxes with a configurable gap
 * tolerance (default 50 mm). Two meshes are in the same component
 * when their bboxes touch or are within `gapToleranceMm` on every
 * axis — same test `boxesAdjacent` uses. The clustering walks the
 * bbox graph via union-find.
 *
 * Filters out trivial clusters (single hardware item floating in
 * space) below `minMeshesPerCluster` so a loose screw mesh doesn't
 * get promoted to "another cabinet".
 *
 * Pure — takes mesh names + bbox map, returns clusters. No Firestore.
 */
import type { GeomBox } from './partGeometryClassifier';
import { boxesAdjacent } from './partConnections';

export interface SubCabinetCluster {
  /** Stable 0-indexed label (1-based label used in the UI). */
  index: number;
  /** Mesh names in this cluster. */
  meshNames: string[];
  /** Union bbox of every mesh in the cluster — drives the suggested
   *  position of the new SceneCabinet + the thumbnail framing. */
  bbox: GeomBox;
  /** Centroid of `bbox` — used as the new cabinet's position. */
  centroid: { x: number; y: number; z: number };
  /** Size in mm for display (W × D × H). */
  size: { width: number; depth: number; height: number };
}

export interface DetectionOptions {
  /** Max bbox gap between two meshes before they're considered a
   *  separate cluster. Default 50 mm — wider than a typical joint,
   *  tight enough that two cabinets 60+ mm apart separate cleanly. */
  gapToleranceMm?: number;
  /** Clusters with fewer meshes than this are discarded (treated as
   *  stray hardware / debris). Default 2 — a single-mesh "cabinet"
   *  is rarely what the user wants. */
  minMeshesPerCluster?: number;
}

export interface DetectionResult {
  clusters: SubCabinetCluster[];
  /** Meshes not claimed by any cluster that cleared
   *  minMeshesPerCluster — the UI warns the user so these aren't
   *  silently lost when a split commits. */
  orphans: string[];
  /** Gap threshold actually used (echo of the opts for the UI). */
  gapToleranceMm: number;
}

const DEFAULT_GAP_TOLERANCE_MM = 50;
const DEFAULT_MIN_MESHES = 2;

export function detectSubCabinets(
  meshNames: ReadonlyArray<string>,
  bboxByMesh: ReadonlyMap<string, GeomBox>,
  opts: DetectionOptions = {},
): DetectionResult {
  const tol = opts.gapToleranceMm ?? DEFAULT_GAP_TOLERANCE_MM;
  const minSize = opts.minMeshesPerCluster ?? DEFAULT_MIN_MESHES;

  // Collect meshes that actually have a bbox. Missing-bbox meshes
  // can't be clustered; they land in orphans.
  const valid: Array<{ name: string; box: GeomBox }> = [];
  const missingBbox: string[] = [];
  for (const name of meshNames) {
    const b = bboxByMesh.get(name);
    if (b) valid.push({ name, box: b });
    else missingBbox.push(name);
  }

  // Union-find on the valid set.
  const parent: number[] = valid.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]; // path compression
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const ra = find(a); const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      if (boxesAdjacent(valid[i].box, valid[j].box, tol)) {
        union(i, j);
      }
    }
  }

  // Group indices by root.
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < valid.length; i++) {
    const r = find(i);
    const list = byRoot.get(r) ?? [];
    list.push(i);
    byRoot.set(r, list);
  }

  // Materialise + filter + sort by size desc so the biggest cluster
  // (usually the "main" cabinet) is index 0.
  const rawClusters = Array.from(byRoot.values()).map(idxs => {
    const names = idxs.map(i => valid[i].name);
    const boxes = idxs.map(i => valid[i].box);
    const union = mergeBoxes(boxes);
    return {
      meshNames: names.sort(),
      bbox: union,
      size: bboxSize(union),
      centroid: bboxCentroid(union),
    };
  });

  const orphansFromSmallClusters = rawClusters
    .filter(c => c.meshNames.length < minSize)
    .flatMap(c => c.meshNames);

  const kept = rawClusters
    .filter(c => c.meshNames.length >= minSize)
    .sort((a, b) => {
      const volA = a.size.width * a.size.depth * a.size.height;
      const volB = b.size.width * b.size.depth * b.size.height;
      return volB - volA;
    })
    .map((c, i): SubCabinetCluster => ({
      index: i,
      meshNames: c.meshNames,
      bbox: c.bbox,
      centroid: c.centroid,
      size: c.size,
    }));

  return {
    clusters: kept,
    orphans: [...missingBbox, ...orphansFromSmallClusters].sort(),
    gapToleranceMm: tol,
  };
}

// ---------------------------------------------------------------------------
// Internal geometry helpers
// ---------------------------------------------------------------------------

function mergeBoxes(boxes: ReadonlyArray<GeomBox>): GeomBox {
  const acc: GeomBox = {
    min: { x: Infinity, y: Infinity, z: Infinity },
    max: { x: -Infinity, y: -Infinity, z: -Infinity },
  };
  for (const b of boxes) {
    if (b.min.x < acc.min.x) acc.min.x = b.min.x;
    if (b.min.y < acc.min.y) acc.min.y = b.min.y;
    if (b.min.z < acc.min.z) acc.min.z = b.min.z;
    if (b.max.x > acc.max.x) acc.max.x = b.max.x;
    if (b.max.y > acc.max.y) acc.max.y = b.max.y;
    if (b.max.z > acc.max.z) acc.max.z = b.max.z;
  }
  return acc;
}

function bboxSize(b: GeomBox) {
  return {
    width:  Math.max(0, b.max.x - b.min.x),
    depth:  Math.max(0, b.max.z - b.min.z),
    height: Math.max(0, b.max.y - b.min.y),
  };
}

function bboxCentroid(b: GeomBox) {
  return {
    x: (b.min.x + b.max.x) / 2,
    y: (b.min.y + b.max.y) / 2,
    z: (b.min.z + b.max.z) / 2,
  };
}
