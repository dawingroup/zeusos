/**
 * Cabinet Detector Service — Splits a multi-cabinet model into individual cabinets
 *
 * Strategies:
 *   1. AI-powered detection (Claude analyzes mesh names + bboxes)
 *   2. Spatial clustering fallback (groups parts that share bounding regions)
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';
import type { ParsedModel } from '../types/workshop-viewer.types';
import type {
  DetectedCabinet,
  BulkCabinetDetectionResult,
  DetectCabinetsInput,
} from '../types/cabinetDetection.types';
import { computeBoundingBox } from './geometryEngine';

interface MeshSummary {
  name: string;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  material?: string;
}

const COVER_MESH_HINTS = [
  'cover',
  'gable',
  'end_cap',
  'endcap',
  'modesty',
  'filler',
  'infill',
  'shroud',
  'apron',
  'fascia',
  'rear_panel',
  'rearcover',
  'back_cover',
  'cable_cover',
  'kick_cover',
];

const COVER_REASON_HINTS = [
  'cover',
  'trim',
  'filler',
  'infill',
  'gable',
  'modesty',
  'kick',
  'toe kick',
  'toe-kick',
  'apron',
  'fascia',
  'shroud',
];

function normalizeMeshLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

export function isCoverLikeMeshName(meshName: string): boolean {
  const norm = normalizeMeshLabel(meshName);
  return COVER_MESH_HINTS.some(hint => norm.includes(hint));
}

function isCoverLikeUnassignedEntry(entry: { meshName: string; reason?: string }): boolean {
  if (isCoverLikeMeshName(entry.meshName)) return true;
  const reason = (entry.reason ?? '').toLowerCase();
  return COVER_REASON_HINTS.some(hint => reason.includes(hint));
}

function bboxGapDistance(
  a: { min: [number, number, number]; max: [number, number, number] },
  b: { min: [number, number, number]; max: [number, number, number] },
): number {
  const dx = Math.max(0, a.min[0] - b.max[0], b.min[0] - a.max[0]);
  const dy = Math.max(0, a.min[1] - b.max[1], b.min[1] - a.max[1]);
  const dz = Math.max(0, a.min[2] - b.max[2], b.min[2] - a.max[2]);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function expandCabinetBbox(
  target: DetectedCabinet['boundingBox'],
  mesh: { min: [number, number, number]; max: [number, number, number] },
): DetectedCabinet['boundingBox'] {
  const minX = Math.min(target.min.x, mesh.min[0]);
  const minY = Math.min(target.min.y, mesh.min[1]);
  const minZ = Math.min(target.min.z, mesh.min[2]);
  const maxX = Math.max(target.max.x, mesh.max[0]);
  const maxY = Math.max(target.max.y, mesh.max[1]);
  const maxZ = Math.max(target.max.z, mesh.max[2]);
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  };
}

export function repairUnassignedCoverMeshes(
  cabinets: DetectedCabinet[],
  unassigned: BulkCabinetDetectionResult['unassigned'],
  meshes: Array<{ name: string; bbox: { min: [number, number, number]; max: [number, number, number] } }>,
): {
  cabinets: DetectedCabinet[];
  unassigned: BulkCabinetDetectionResult['unassigned'];
} {
  if (cabinets.length === 0 || unassigned.length === 0 || meshes.length === 0) {
    // Keep behavior for empty-cabinet / empty-mesh cases, but allow the
    // dropped-cover sweep below to run when AI forgot to populate `unassigned`.
    if (cabinets.length === 0 || meshes.length === 0) {
      return { cabinets, unassigned };
    }
  }

  const meshByName = new Map(meshes.map(m => [m.name.toLowerCase(), m]));
  const assignedLower = new Set(
    cabinets.flatMap(c => c.meshNames.map(n => n.toLowerCase())),
  );
  const explicitUnassignedLower = new Set(
    unassigned.map(u => u.meshName.toLowerCase()),
  );
  const stillUnassigned: BulkCabinetDetectionResult['unassigned'] = [];
  const coverCandidates = new Map<string, { meshName: string; reason: string }>();

  // 1) Cover-like meshes AI explicitly flagged as unassigned.
  for (const entry of unassigned) {
    if (isCoverLikeUnassignedEntry(entry)) {
      coverCandidates.set(entry.meshName.toLowerCase(), {
        meshName: entry.meshName,
        reason: entry.reason,
      });
      continue;
    }
    stillUnassigned.push(entry);
  }

  // 2) Cover-like meshes that were silently dropped by AI (not in any cabinet,
  //    not listed in `unassigned` at all).
  for (const mesh of meshes) {
    const lower = mesh.name.toLowerCase();
    if (assignedLower.has(lower) || explicitUnassignedLower.has(lower)) continue;
    if (!isCoverLikeMeshName(mesh.name)) continue;
    coverCandidates.set(lower, {
      meshName: mesh.name,
      reason: 'cover-like mesh was not assigned to any detected cabinet',
    });
  }

  for (const entry of coverCandidates.values()) {
    const mesh = meshByName.get(entry.meshName.toLowerCase());
    if (!mesh) {
      stillUnassigned.push(entry);
      continue;
    }

    let bestIdx = -1;
    let bestGap = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cabinets.length; i++) {
      const cab = cabinets[i];
      const cabBox = {
        min: [cab.boundingBox.min.x, cab.boundingBox.min.y, cab.boundingBox.min.z] as [number, number, number],
        max: [cab.boundingBox.max.x, cab.boundingBox.max.y, cab.boundingBox.max.z] as [number, number, number],
      };
      const gap = bboxGapDistance(mesh.bbox, cabBox);
      if (gap < bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) {
      stillUnassigned.push(entry);
      continue;
    }

    const target = cabinets[bestIdx];
    if (!target.meshNames.includes(mesh.name)) {
      target.meshNames.push(mesh.name);
      target.boundingBox = expandCabinetBbox(target.boundingBox, mesh.bbox);
      target.centroid = bboxCentroid(target.boundingBox);
      target.reasoning = `${target.reasoning} Auto-attached cover mesh "${mesh.name}" by nearest cabinet proximity.`;
      assignedLower.add(mesh.name.toLowerCase());
    }
  }

  return { cabinets, unassigned: stillUnassigned };
}

/**
 * Build mesh summaries from a parsed model for detection.
 *
 * ParsedModel objects don't carry a pre-computed bbox — we derive one
 * from each object's vertex array, matching assemblyEngine / dimensionEngine.
 */
function buildMeshSummaries(parsedModel: ParsedModel): MeshSummary[] {
  const summaries: MeshSummary[] = [];
  for (const obj of parsedModel.objects ?? []) {
    if (!obj.vertices || obj.vertices.length === 0) continue;
    const bbox = computeBoundingBox(obj.vertices);
    // Skip zero-sized/degenerate meshes
    const size = {
      x: bbox.max.x - bbox.min.x,
      y: bbox.max.y - bbox.min.y,
      z: bbox.max.z - bbox.min.z,
    };
    if (size.x === 0 && size.y === 0 && size.z === 0) continue;

    const material = (obj as unknown as { material?: string }).material
      ?? (obj as unknown as { materialName?: string }).materialName;

    summaries.push({
      name: obj.name,
      bbox: {
        min: [bbox.min.x, bbox.min.y, bbox.min.z],
        max: [bbox.max.x, bbox.max.y, bbox.max.z],
      },
      material,
    });
  }
  return summaries;
}

/**
 * AI-powered cabinet detection. Returns one DetectedCabinet per identified
 * cabinet boundary. Falls back to spatial clustering on failure.
 */
export async function detectCabinetsWithAI(
  parsedModel: ParsedModel,
  options: { expectedCount?: number; contextHint?: string } = {},
): Promise<BulkCabinetDetectionResult> {
  const summaries = buildMeshSummaries(parsedModel);
  if (summaries.length === 0) {
    return spatialClusteringFallback([], 'No mesh summaries available');
  }

  const start = Date.now();
  try {
    const callAI = httpsCallable<DetectCabinetsInput, AIDetectionResponse>(functions, 'aiDetectCabinets');
    const result = await callAI({
      meshes: summaries,
      expectedCount: options.expectedCount,
      contextHint: options.contextHint,
    });

    const data = result.data;
    if (!data || !Array.isArray(data.cabinets)) {
      return spatialClusteringFallback(summaries, 'AI returned invalid response');
    }

    const cabinets: DetectedCabinet[] = data.cabinets.map((c, i) => {
      const bbox = computeGroupBBox(summaries, c.meshNames);
      return {
        provisionalCode: c.provisionalCode || `CAB-${String.fromCharCode(65 + i)}`,
        suggestedName: c.suggestedName,
        suggestedArchetypeKey: c.suggestedArchetypeKey,
        meshNames: c.meshNames,
        boundingBox: bbox,
        centroid: bboxCentroid(bbox),
        confidence: c.confidence,
        reasoning: c.reasoning,
        selected: true,
        sequence: i,
      };
    });
    const repaired = repairUnassignedCoverMeshes(
      cabinets,
      data.unassigned ?? [],
      summaries,
    );

    return {
      source: 'ai',
      model: data.model,
      confidence: data.confidence,
      reasoning: data.reasoning,
      cabinets: repaired.cabinets,
      unassigned: repaired.unassigned,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    console.warn('aiDetectCabinets call failed, using spatial clustering:', (err as Error).message);
    return spatialClusteringFallback(summaries, `AI failed: ${(err as Error).message}`);
  }
}

interface AIDetectionResponse {
  source: 'ai';
  model: string;
  confidence: number;
  reasoning: string;
  cabinets: Array<{
    provisionalCode: string;
    suggestedName: string;
    suggestedArchetypeKey?: string;
    confidence: number;
    reasoning: string;
    meshNames: string[];
  }>;
  unassigned: Array<{ meshName: string; reason: string }>;
}

/**
 * Spatial clustering fallback — groups meshes by bbox proximity (X-axis runs).
 * Cabinets are typically arranged in a row, so we cluster on X with gaps > 50mm.
 */
function spatialClusteringFallback(
  summaries: MeshSummary[],
  reason: string,
): BulkCabinetDetectionResult {
  if (summaries.length === 0) {
    return {
      source: 'spatial',
      model: 'spatial-clustering-v1',
      confidence: 0,
      reasoning: reason,
      cabinets: [],
      unassigned: [],
      durationMs: 0,
    };
  }

  // Sort meshes by min X
  const sorted = [...summaries].sort((a, b) => a.bbox.min[0] - b.bbox.min[0]);

  // Cluster by X-axis gap > 50mm
  const GAP_THRESHOLD = 50;
  const clusters: MeshSummary[][] = [];
  let current: MeshSummary[] = [];
  let lastMaxX = -Infinity;

  for (const mesh of sorted) {
    if (mesh.bbox.min[0] - lastMaxX > GAP_THRESHOLD && current.length > 0) {
      clusters.push(current);
      current = [];
    }
    current.push(mesh);
    lastMaxX = Math.max(lastMaxX, mesh.bbox.max[0]);
  }
  if (current.length > 0) clusters.push(current);

  const cabinets: DetectedCabinet[] = clusters.map((cluster, i) => {
    const meshNames = cluster.map(m => m.name);
    const bbox = computeGroupBBox(cluster, meshNames);
    return {
      provisionalCode: `CAB-${String.fromCharCode(65 + i)}`,
      suggestedName: `Cabinet ${String.fromCharCode(65 + i)}`,
      meshNames,
      boundingBox: bbox,
      centroid: bboxCentroid(bbox),
      confidence: 0.5,
      reasoning: `Spatial cluster: ${cluster.length} meshes within ${GAP_THRESHOLD}mm X-gap.`,
      selected: true,
      sequence: i,
    };
  });

  return {
    source: 'spatial',
    model: 'spatial-clustering-v1',
    confidence: 0.5,
    reasoning: reason,
    cabinets,
    unassigned: [],
    durationMs: 0,
  };
}

function computeGroupBBox(meshes: MeshSummary[], names: string[]): DetectedCabinet['boundingBox'] {
  const targetMeshes = meshes.filter(m => names.includes(m.name));
  if (targetMeshes.length === 0) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 } };
  }

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const m of targetMeshes) {
    minX = Math.min(minX, m.bbox.min[0]);
    minY = Math.min(minY, m.bbox.min[1]);
    minZ = Math.min(minZ, m.bbox.min[2]);
    maxX = Math.max(maxX, m.bbox.max[0]);
    maxY = Math.max(maxY, m.bbox.max[1]);
    maxZ = Math.max(maxZ, m.bbox.max[2]);
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
  };
}

function bboxCentroid(bbox: DetectedCabinet['boundingBox']): DetectedCabinet['centroid'] {
  return {
    x: (bbox.min.x + bbox.max.x) / 2,
    y: (bbox.min.y + bbox.max.y) / 2,
    z: (bbox.min.z + bbox.max.z) / 2,
  };
}
