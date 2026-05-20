/**
 * AI Assembly Grouper — AI-first grouping orchestrator
 *
 * Calls the `aiGroupModel` Cloud Function to intelligently group meshes into
 * canonical assemblies using Claude. Falls back to heuristic grouping if
 * the AI call fails.
 */
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';
import type { ParsedModel } from '../types/workshop-viewer.types';
import type { SceneAssembly, ScenePart } from '../types/assembly.types';
import type { ModelGrouping } from '../types/modelPackage.types';
import type { AssemblyTypeEnum, PartCategory } from '../constants/assembly.constants';
import type { RelativePosition } from '../types/ai-recognition.types';
import { extractAssembliesFromParsedModel } from './assembly.service';
import { computeBoundingBox, classifyPartRole, estimateMeshDimensions, type MeshDimensionEstimate } from './geometryEngine';
import {
  getArchetypeDefinition,
  mergeArchetypeContext,
  DOMAIN_PROMPT_HINTS,
  detectPartCategoryFromName,
} from '../constants/furnitureDomains';
import {
  classifyPartByGeometry,
  GEOMETRY_OVERRIDE_THRESHOLD,
  type GeomBox,
} from './partGeometryClassifier';

interface GeometrySummary {
  name: string;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  dims?: MeshDimensionEstimate;
  material?: string;
}

interface AIGroupingResponse {
  source: 'ai';
  model: string;
  durationMs: number;
  confidence: number;
  reasoning: string;
  assemblies: Array<{
    assemblyType: AssemblyTypeEnum;
    assemblyCode: string;
    displayName: string;
    confidence: number;
    meshNodeIds: string[];
    reasoning: string;
  }>;
  unmapped: Array<{ meshName: string; reason: string }>;
}

export interface GroupingInput {
  cabinetId: string;
  parsedModel: ParsedModel;
  /** Legacy single-archetype field. */
  archetypeKey?: string;
  /** New multi-archetype list — when set, grouping context merges
   *  every archetype's hints (expectedAssemblies, coverPanelHints, …).
   *  Preferred over `archetypeKey` for cross-domain fixtures. */
  archetypeKeys?: string[];
  archetypeContext?: string[];
  modelName?: string;
}

/**
 * Build a compact geometry summary for each mesh — enough context for the AI
 * without sending full vertex arrays.
 */
function buildGeometrySummaries(parsedModel: ParsedModel): GeometrySummary[] {
  const summaries: GeometrySummary[] = [];

  for (const obj of parsedModel.objects ?? []) {
    if (!obj.vertices || obj.vertices.length === 0) continue;
    const bbox = computeBoundingBox(obj.vertices);
    const sx = bbox.max.x - bbox.min.x;
    const sy = bbox.max.y - bbox.min.y;
    const sz = bbox.max.z - bbox.min.z;
    if (sx === 0 && sy === 0 && sz === 0) continue;

    const material = (obj as unknown as { material?: string }).material
      ?? (obj as unknown as { materialName?: string }).materialName;
    const dims = estimateMeshDimensions(obj.vertices, obj.faces);

    summaries.push({
      name: obj.name,
      bbox: {
        min: [bbox.min.x, bbox.min.y, bbox.min.z],
        max: [bbox.max.x, bbox.max.y, bbox.max.z],
      },
      dims,
      material,
    });
  }

  return summaries;
}

/**
 * AI-first grouping. Falls back to heuristic grouper on failure.
 */
export async function groupModelWithAI(input: GroupingInput): Promise<ModelGrouping> {
  const { cabinetId, parsedModel, archetypeKey, archetypeKeys, archetypeContext, modelName } = input;
  const summaries = buildGeometrySummaries(parsedModel);

  if (summaries.length === 0) {
    // No meshes — return empty heuristic result
    return heuristicFallback(cabinetId, [], archetypeKey, 'No geometry summaries available');
  }

  // Collapse single + multi inputs into one canonical key list, then
  // merge every archetype's context (expectedAssemblies,
  // expectedPartCategories, coverPanelHints) into a single payload
  // the Cloud Function prompt consumes.
  const mergedKeys: string[] = [];
  const seen = new Set<string>();
  const push = (k: string | undefined | null) => {
    if (!k) return;
    if (seen.has(k)) return;
    seen.add(k);
    mergedKeys.push(k);
  };
  push(archetypeKey);
  for (const k of archetypeKeys ?? []) push(k);

  const ctx = mergeArchetypeContext(mergedKeys);
  const archetypeDef = ctx.primary;
  const domainPrompt = ctx.domainPrompt
    || DOMAIN_PROMPT_HINTS[archetypeDef.domain];

  try {
    const callAI = httpsCallable<unknown, AIGroupingResponse>(functions, 'aiGroupModel');
    const result = await callAI({
      geometrySummaries: summaries,
      // Legacy singular — picked from the merged list head for CF
      // versions that still key off this field.
      archetypeKey: mergedKeys[0] ?? archetypeKey,
      // New plural field — CF v2+ uses this when present.
      archetypeKeys: mergedKeys,
      // Keep original field for backwards-compat with Cloud Function
      // versions that still read it verbatim.
      archetypeContext: archetypeContext ?? ctx.expectedAssemblies,
      modelName,

      // New fields — the Cloud Function prompt picks these up when
      // present but is robust when missing. Merged across every
      // archetype in `archetypeKeys` so cross-domain fixtures get
      // the union of hints.
      domain: archetypeDef.domain,
      domains: ctx.domains,
      domainPrompt,
      archetypeLabel: ctx.labels.join(' + ') || archetypeDef.label,
      archetypeLabels: ctx.labels,
      archetypeDescription: ctx.archetypeDescription || archetypeDef.description,
      expectedAssemblies: ctx.expectedAssemblies,
      expectedPartCategories: ctx.expectedPartCategories,
      coverPanelHints: ctx.coverPanelHints,
      typicalDimensions: archetypeDef.typicalDimensions,
    });

    const data = result.data;
    if (!data || !Array.isArray(data.assemblies)) {
      console.warn('aiGroupModel returned invalid response, falling back to heuristic');
      return heuristicFallback(cabinetId, summaries.map(s => s.name), archetypeKey, 'AI returned invalid response', summaries);
    }

    // Materialize AI response into SceneAssembly[]
    const assemblies: SceneAssembly[] = data.assemblies.map((a, i) => ({
      id: `${cabinetId}-${a.assemblyType}-${i}`,
      cabinetId,
      assemblyType: a.assemblyType,
      assemblyCode: a.assemblyCode,
      displayName: a.displayName,
      parts: [],
      meshNodeIds: a.meshNodeIds,
      boundingBox: { min: {x:0,y:0,z:0}, max: {x:0,y:0,z:0}, center: {x:0,y:0,z:0}, size: {x:0,y:0,z:0} },
      jointSpec: [],
      assemblySequence: [],
      isComplete: a.meshNodeIds.length > 0,
      totalPartCount: a.meshNodeIds.length,
      totalArea: 0,
      totalCost: 0,
      sequence: i,
    }));

    // Build bbox lookup + cabinet envelope from the geometry summaries
    // we already computed — the geometry classifier can then sharpen
    // `'panel'` into cover_panel / toe_kick / upright / fascia when
    // the mesh name is cryptic but shape + position are clear. Also
    // capture per-mesh material names so makePartStub can populate
    // `materialDescription` straight from the GLB (PolyBoard exports
    // carry the real finish name on each mesh — no need to wait for
    // a separate material-resolution pass).
    const bboxByName = new Map<string, GeomBox>();
    const materialByName = new Map<string, string>();
    const dimsByName = new Map<string, MeshDimensionEstimate>();
    for (const s of summaries) {
      bboxByName.set(s.name, {
        min: { x: s.bbox.min[0], y: s.bbox.min[1], z: s.bbox.min[2] },
        max: { x: s.bbox.max[0], y: s.bbox.max[1], z: s.bbox.max[2] },
      });
      if (s.dims) dimsByName.set(s.name, s.dims);
      if (s.material) materialByName.set(s.name, s.material);
    }
    const cabinetEnvelope = mergeGeomBoxes(Array.from(bboxByName.values()));

    // Build part stubs from mesh names for each assembly
    const parts: ScenePart[] = [];
    for (const assembly of assemblies) {
      for (const meshId of assembly.meshNodeIds) {
        parts.push(makePartStub(
          cabinetId, assembly, meshId, archetypeDef.domain,
          bboxByName.get(meshId), cabinetEnvelope,
          dimsByName.get(meshId),
          materialByName.get(meshId),
        ));
      }
    }

    // Sweep up every mesh the AI assigned — including ones present in
    // `summaries` but missing from both assemblies AND unmapped. Then
    // synthesise a catch-all "Unassigned parts" assembly so every mesh
    // in the model lands a procurement-priced part. Without this,
    // unmapped meshes silently disappear from the DM cutlist and
    // material costs under-count.
    const rescuedUnmapped = rescueUnmappedMeshes(
      cabinetId,
      summaries,
      assemblies,
      data.unmapped ?? [],
      bboxByName,
      cabinetEnvelope,
      dimsByName,
      materialByName,
      archetypeDef.domain,
    );
    if (rescuedUnmapped.assembly) {
      assemblies.push(rescuedUnmapped.assembly);
      parts.push(...rescuedUnmapped.parts);
    }

    return {
      source: 'ai',
      model: data.model,
      confidence: data.confidence,
      reasoning: data.reasoning,
      assemblies,
      parts,
      // `unmapped` here now means "the AI flagged these with a reason"
      // — UI can still surface it, but the meshes are already in the
      // rescue assembly so they flow to procurement. Think of it as
      // a diagnostic, not a dead list.
      unmapped: data.unmapped ?? [],
    };
  } catch (err) {
    console.warn('aiGroupModel call failed, falling back to heuristic:', (err as Error).message);
    return heuristicFallback(
      cabinetId,
      summaries.map(s => s.name),
      archetypeKey,
      `AI call failed: ${(err as Error).message}`,
      summaries,
    );
  }
}

/**
 * Heuristic fallback using the existing extractAssembliesFromParsedModel.
 */
function heuristicFallback(
  cabinetId: string,
  meshNames: string[],
  archetypeKey: string | undefined,
  reason: string,
  summaries: GeometrySummary[] = [],
): ModelGrouping {
  const assemblies = extractAssembliesFromParsedModel(cabinetId, meshNames, archetypeKey);
  const parts: ScenePart[] = [];
  const domain = getArchetypeDefinition(archetypeKey).domain;

  // Same bbox + material lookup as the AI path so heuristic-grouped
  // parts also land with real dimensions + material names on the
  // DesignItem. Previously dropped all of this info on the floor.
  const bboxByName = new Map<string, GeomBox>();
  const materialByName = new Map<string, string>();
  const dimsByName = new Map<string, MeshDimensionEstimate>();
  for (const s of summaries) {
    bboxByName.set(s.name, {
      min: { x: s.bbox.min[0], y: s.bbox.min[1], z: s.bbox.min[2] },
      max: { x: s.bbox.max[0], y: s.bbox.max[1], z: s.bbox.max[2] },
    });
    if (s.dims) dimsByName.set(s.name, s.dims);
    if (s.material) materialByName.set(s.name, s.material);
  }
  const cabinetEnvelope = bboxByName.size > 0
    ? mergeGeomBoxes(Array.from(bboxByName.values()))
    : undefined;

  for (const assembly of assemblies) {
    for (const meshId of assembly.meshNodeIds) {
      parts.push(makePartStub(
        cabinetId, assembly, meshId, domain,
        bboxByName.get(meshId), cabinetEnvelope,
        dimsByName.get(meshId),
        materialByName.get(meshId),
      ));
    }
  }

  return {
    source: 'heuristic',
    model: 'rule-based-v1',
    confidence: 0.5,
    reasoning: `Heuristic grouping used. ${reason}`,
    assemblies,
    parts,
    unmapped: [],
  };
}

/**
 * Create a minimal ScenePart from an assembly + mesh name.
 * Later pipeline stages (part recognition, material resolver) enrich this.
 *
 * `partCategory` picks the most specific classification the mesh name
 * supports (cover_panel, toe_kick, upright, …) and falls back to the
 * assembly-type heuristic for generic names.
 */
function makePartStub(
  cabinetId: string,
  assembly: SceneAssembly,
  meshName: string,
  domain: ReturnType<typeof getArchetypeDefinition>['domain'],
  bbox?: GeomBox,
  parentBbox?: GeomBox,
  dimsEstimate?: MeshDimensionEstimate,
  materialName?: string,
): ScenePart {
  // Persist structural role and spatial position so canonical naming
  // is deterministic across sessions, drawings, and sync pipelines.
  const role = classifyPartRole(meshName);
  const relativePosition = bbox && parentBbox
    ? classifyRelativePosition(bbox, parentBbox)
    : undefined;

  const stub: ScenePart = {
    id: `${cabinetId}-${assembly.assemblyCode}-${meshName}`,
    assemblyId: assembly.id,
    cabinetId,
    partCode: meshName.replace(/\s+/g, '_').slice(0, 40),
    partName: meshName,
    partCategory: resolvePartCategory(meshName, assembly.assemblyType, domain, bbox, parentBbox),
    role,
    relativePosition,
    inventoryItemId: '',
    inventoryItemName: '',
    meshNodeId: meshName,
    quantity: 1,
    unit: 'pcs',
    unitCost: 0,
    totalCost: 0,
    currency: 'UGX',
    materialDescription: materialName ?? '',
  };

  // P5.1: Use OBB-derived dimensions when available; fall back to AABB.
  if (dimsEstimate) {
    stub.dimensions = {
      length: Math.round(dimsEstimate.length),
      width: Math.round(dimsEstimate.width),
      thickness: Math.round(dimsEstimate.thickness),
      grainDirection: 'length',
    };
    stub.dimensionQuality = {
      source: dimsEstimate.method,
      confidence: dimsEstimate.confidence,
      uncertain: dimsEstimate.uncertain,
      aabb: dimsEstimate.aabb,
      obb: dimsEstimate.obb,
    };
  } else if (bbox) {
    const dx = Math.abs(bbox.max.x - bbox.min.x);
    const dy = Math.abs(bbox.max.y - bbox.min.y);
    const dz = Math.abs(bbox.max.z - bbox.min.z);
    const sorted = [dx, dy, dz].sort((a, b) => a - b);
    const [thickness, width, length] = sorted;
    if (length > 0) {
      stub.dimensions = {
        length: Math.round(length),
        width: Math.round(width),
        thickness: Math.round(thickness),
        grainDirection: length === dx || length === dy ? 'length' : 'none',
      };
      stub.dimensionQuality = {
        source: 'aabb',
        confidence: 0.6,
        uncertain: false,
        aabb: { length, width, thickness },
      };
    }
  }

  return stub;
}

/**
 * Pick the PartCategory for a mesh using three signals in descending
 * priority:
 *   1. Name-based domain-aware hint — "cable_cover" → cover_panel
 *      regardless of assembly, domain rules enforced.
 *   2. Geometry classifier — when name falls through to 'panel' but
 *      the part has a bbox, shape + position can sharpen the call
 *      (thin sheet outside parent envelope → cover_panel; floor-level
 *      thin wide sheet → toe_kick; stick-like vertical in retail/
 *      pharmacy → upright). Only overrides when confidence clears
 *      the GEOMETRY_OVERRIDE_THRESHOLD.
 *   3. Assembly-type fallback — coarse but consistent (hardware_kit
 *      → hardware, plinth_assembly → toe_kick, …).
 */
function resolvePartCategory(
  meshName: string,
  assemblyType: AssemblyTypeEnum,
  domain: ReturnType<typeof getArchetypeDefinition>['domain'],
  bbox?: GeomBox,
  parentBbox?: GeomBox,
): PartCategory {
  const byName = detectPartCategoryFromName(meshName, domain);
  if (byName !== 'panel') return byName;

  if (bbox) {
    const geom = classifyPartByGeometry(bbox, parentBbox, domain);
    if (geom.confidence >= GEOMETRY_OVERRIDE_THRESHOLD && geom.category !== 'panel') {
      return geom.category;
    }
  }

  return inferCategoryFromAssembly(assemblyType);
}

function inferCategoryFromAssembly(assemblyType: AssemblyTypeEnum): PartCategory {
  switch (assemblyType) {
    case 'hardware_kit':      return 'hardware';
    case 'cover_panel_run':   return 'cover_panel';
    case 'plinth_assembly':   return 'toe_kick';
    case 'cornice_run':       return 'fascia';
    case 'gable_run':         return 'upright';
    default:                  return 'panel';
  }
}

/**
 * Validate grouping: check every mesh is assigned, flag low confidence.
 */
export function validateGrouping(
  grouping: ModelGrouping,
  parsedModel: ParsedModel,
): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];

  const assignedMeshes = new Set<string>();
  for (const assembly of grouping.assemblies) {
    for (const id of assembly.meshNodeIds) assignedMeshes.add(id);
  }
  for (const u of grouping.unmapped) {
    assignedMeshes.add(u.meshName);
  }

  const allMeshes = (parsedModel.objects ?? []).map(o => o.name);
  const missing = allMeshes.filter(m => !assignedMeshes.has(m));

  if (missing.length > 0) {
    issues.push(`${missing.length} mesh(es) not assigned: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`);
  }

  if (grouping.confidence < 0.5) {
    warnings.push(`Overall grouping confidence is low (${(grouping.confidence * 100).toFixed(0)}%). Review before production.`);
  }

  for (const assembly of grouping.assemblies) {
    if (assembly.totalPartCount === 0) {
      warnings.push(`Assembly "${assembly.displayName}" has no parts.`);
    }
  }

  return { issues, warnings };
}

/**
 * Union of every mesh bbox = the cabinet envelope. Used by the
 * geometry classifier to decide whether a part sits OUTSIDE the
 * carcase (→ cover panel) vs inside.
 */
function mergeGeomBoxes(boxes: ReadonlyArray<GeomBox>): GeomBox | undefined {
  if (boxes.length === 0) return undefined;
  const acc = {
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

/**
 * Any mesh that the AI didn't put into an assembly AND didn't put on
 * the `unmapped` list is effectively lost — it carries no part entry,
 * no cost, no cutlist row. Same for meshes the AI explicitly unmapped
 * (procurement still needs their material/dims). This rescue builds a
 * synthetic `custom` assembly called "Unassigned parts" that scoops
 * up every survivor so the DM sync picks them up and pricing stays
 * accurate.
 *
 * Returns `{ assembly: null, parts: [] }` when there's nothing to
 * rescue — callers can skip appending.
 */
function rescueUnmappedMeshes(
  cabinetId: string,
  summaries: GeometrySummary[],
  assemblies: SceneAssembly[],
  unmapped: Array<{ meshName: string; reason: string }>,
  bboxByName: Map<string, GeomBox>,
  cabinetEnvelope: GeomBox | undefined,
  dimsByName: Map<string, MeshDimensionEstimate>,
  materialByName: Map<string, string>,
  domain: ReturnType<typeof getArchetypeDefinition>['domain'],
): { assembly: SceneAssembly | null; parts: ScenePart[] } {
  const assigned = new Set<string>();
  for (const a of assemblies) {
    for (const m of a.meshNodeIds) assigned.add(m);
  }

  // Union of "explicitly unmapped by AI" + "silently dropped".
  const survivors: string[] = [];
  for (const s of summaries) {
    if (!assigned.has(s.name)) survivors.push(s.name);
  }
  // Some AIs hallucinate unmapped entries — ignore ones not in summaries.
  for (const u of unmapped) {
    if (!assigned.has(u.meshName) && !survivors.includes(u.meshName)) {
      survivors.push(u.meshName);
    }
  }
  if (survivors.length === 0) return { assembly: null, parts: [] };

  const assemblyId = `${cabinetId}-custom-rescue`;
  const assembly: SceneAssembly = {
    id: assemblyId,
    cabinetId,
    assemblyType: 'custom',
    assemblyCode: 'custom-rescue',
    displayName: 'Unassigned parts',
    parts: [],                      // filled below
    meshNodeIds: [...survivors],
    boundingBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 } },
    jointSpec: [],
    assemblySequence: [],
    isComplete: false,
    totalPartCount: survivors.length,
    totalArea: 0,
    totalCost: 0,
    sequence: assemblies.length,
  };

  const parts: ScenePart[] = survivors.map(meshId =>
    makePartStub(
      cabinetId, assembly, meshId, domain,
      bboxByName.get(meshId), cabinetEnvelope,
      dimsByName.get(meshId),
      materialByName.get(meshId),
    ),
  );

  return { assembly, parts };
}

// ---------------------------------------------------------------------------
// Spatial position classifier — where is this part relative to its parent?
// ---------------------------------------------------------------------------

/**
 * Classify a part's position within its parent assembly by comparing
 * the part's bbox center to the parent envelope's center.
 *
 * Picks the axis with the strongest signal (greatest normalised offset
 * from center) so a part sitting at the far left of a wide cabinet
 * dominates over a slight vertical offset.
 */
function classifyRelativePosition(
  partBbox: GeomBox,
  parentBbox: GeomBox,
): RelativePosition {
  const partCenter = {
    x: (partBbox.min.x + partBbox.max.x) / 2,
    y: (partBbox.min.y + partBbox.max.y) / 2,
    z: (partBbox.min.z + partBbox.max.z) / 2,
  };
  const parentCenter = {
    x: (parentBbox.min.x + parentBbox.max.x) / 2,
    y: (parentBbox.min.y + parentBbox.max.y) / 2,
    z: (parentBbox.min.z + parentBbox.max.z) / 2,
  };
  const parentSize = {
    x: Math.abs(parentBbox.max.x - parentBbox.min.x) || 1,
    y: Math.abs(parentBbox.max.y - parentBbox.min.y) || 1,
    z: Math.abs(parentBbox.max.z - parentBbox.min.z) || 1,
  };

  // Normalised offsets: how far from center (0 = dead-center, ±1 = edge).
  const nx = (partCenter.x - parentCenter.x) / (parentSize.x / 2);
  const ny = (partCenter.y - parentCenter.y) / (parentSize.y / 2);
  const nz = (partCenter.z - parentCenter.z) / (parentSize.z / 2);

  const absx = Math.abs(nx);
  const absy = Math.abs(ny);
  const absz = Math.abs(nz);

  // Threshold: if all normalised offsets are within ±0.25, call it center.
  const threshold = 0.25;
  if (absx < threshold && absy < threshold && absz < threshold) return 'center';

  // Pick the axis with the strongest signal.
  if (absz >= absx && absz >= absy) return nz > 0 ? 'top' : 'bottom';
  if (absx >= absy) return nx > 0 ? 'right' : 'left';
  return ny > 0 ? 'back' : 'front';
}
