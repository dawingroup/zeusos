/**
 * AI Part Recognition Service
 *
 * Builds geometry summaries from 3D models and calls the Cloud Function
 * to identify, name, and classify cabinet parts using AI.
 * Falls back to rule-based classification when AI is unavailable.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/firebase/config';
import { computeBoundingBox, bboxNear, classifyPartRole, estimateMeshDimensions } from './geometryEngine';
import { normalizePartName, buildPartTree, suggestAssemblyGroups } from './assemblyEngine';
import { canonicalDisplayName } from './partNamingService';
import type { ParsedModel, BoundingBox3D, PartRole, ProjectContext } from '../types/workshop-viewer.types';
import type {
  GeometrySummary,
  RecognitionResult,
  PartIdentification,
  RecognitionRequest,
  RelativePosition,
  PastIdentification,
} from '../types/ai-recognition.types';
import type { PartEntry } from './partsSyncService';
import type { FurnitureTypeContext, ExpectedPart } from '../types/furniture-type.types';
import type { FinishDocument } from '@/modules/inventory/types/finishLibrary';
import { resolveMaterialByName } from './materialResolverService';

// ---------------------------------------------------------------------------
// Geometry Summary Builder
// ---------------------------------------------------------------------------

/**
 * Build compact geometry summaries for all mesh objects in a model.
 * These are sent to the Cloud Function for AI analysis.
 */
export function buildGeometrySummaries(model: ParsedModel): GeometrySummary[] {
  // First pass: compute all bounding boxes
  const bboxes: { name: string; bbox: BoundingBox3D; dims: { w: number; d: number; h: number } }[] = [];
  for (const obj of model.objects) {
    const bbox = computeBoundingBox(obj.vertices);
    const estimate = estimateMeshDimensions(obj.vertices, obj.faces);
    bboxes.push({
      name: obj.name,
      bbox,
      dims: { w: estimate.length, d: estimate.width, h: estimate.thickness },
    });
  }

  // Compute overall center for relative positioning
  const allMins = bboxes.map(b => b.bbox.min);
  const allMaxs = bboxes.map(b => b.bbox.max);
  const overallCenter = {
    x: (Math.min(...allMins.map(m => m.x)) + Math.max(...allMaxs.map(m => m.x))) / 2,
    y: (Math.min(...allMins.map(m => m.y)) + Math.max(...allMaxs.map(m => m.y))) / 2,
    z: (Math.min(...allMins.map(m => m.z)) + Math.max(...allMaxs.map(m => m.z))) / 2,
  };

  return model.objects.map((obj, index) => {
    const { bbox, dims } = bboxes[index];
    const center = {
      x: (bbox.min.x + bbox.max.x) / 2,
      y: (bbox.min.y + bbox.max.y) / 2,
      z: (bbox.min.z + bbox.max.z) / 2,
    };

    // Find neighbors (within 100mm proximity)
    const neighbors: string[] = [];
    for (let j = 0; j < bboxes.length; j++) {
      if (j === index) continue;
      if (bboxNear(bbox, bboxes[j].bbox)) {
        neighbors.push(bboxes[j].name);
      }
    }

    // Determine relative position
    const relativePosition = classifyPosition(center, overallCenter);

    // Material info
    const matDef = model.materials[obj.material];
    const materialColor = matDef
      ? '#' + matDef.diffuse.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('')
      : undefined;

    return {
      partName: obj.name,
      meshIndex: index,
      bbox,
      dims,
      material: obj.material || undefined,
      materialColor,
      neighbors,
      relativePosition,
    };
  });
}

function classifyPosition(
  center: { x: number; y: number; z: number },
  overallCenter: { x: number; y: number; z: number },
): RelativePosition {
  const dx = center.x - overallCenter.x;
  const dy = center.y - overallCenter.y;
  const dz = center.z - overallCenter.z;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  const absDz = Math.abs(dz);

  // Threshold: must be >30% of max offset to count as non-center
  const maxOff = Math.max(absDx, absDy, absDz);
  if (maxOff < 20) return 'center'; // within 20mm of center

  if (absDz >= absDx && absDz >= absDy) return dz > 0 ? 'top' : 'bottom';
  if (absDx >= absDy) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'back' : 'front';
}

// ---------------------------------------------------------------------------
// AI Recognition (calls Cloud Function)
// ---------------------------------------------------------------------------

/**
 * Call the recognizeCabinetParts Cloud Function.
 * Falls back to rule-based classification if the function fails.
 */
export async function recognizeParts(
  model: ParsedModel,
  context?: ProjectContext | null,
  ragExamples?: PastIdentification[],
  furnitureTypeId?: string | null,
  furnitureTypeContext?: import('../types/furniture-type.types').FurnitureTypeContext,
): Promise<RecognitionResult> {
  const summaries = buildGeometrySummaries(model);

  // Compute overall dimensions
  const allBboxes = model.objects.map(o => computeBoundingBox(o.vertices));
  const overallMin = { x: Infinity, y: Infinity, z: Infinity };
  const overallMax = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const b of allBboxes) {
    overallMin.x = Math.min(overallMin.x, b.min.x);
    overallMin.y = Math.min(overallMin.y, b.min.y);
    overallMin.z = Math.min(overallMin.z, b.min.z);
    overallMax.x = Math.max(overallMax.x, b.max.x);
    overallMax.y = Math.max(overallMax.y, b.max.y);
    overallMax.z = Math.max(overallMax.z, b.max.z);
  }

  const request: RecognitionRequest = {
    geometrySummaries: summaries,
    overallDims: {
      width: overallMax.x - overallMin.x,
      depth: overallMax.y - overallMin.y,
      height: overallMax.z - overallMin.z,
    },
    materialList: Object.keys(model.materials),
    materialPalette: context?.materialPalette,
    ragExamples,
    furnitureTypeId: furnitureTypeId || undefined,
    furnitureTypeContext: furnitureTypeContext || undefined,
  };

  try {
    const fn = httpsCallable(functions, 'recognizeCabinetParts');
    const response = await fn(request);
    const data = response.data as RecognitionResult & { error?: string };

    // If AI returned empty parts, fall back to rule-based
    if (!data.parts || data.parts.length === 0 || data.source === 'rule-based') {
      return buildRuleBasedResult(model, summaries, furnitureTypeContext);
    }

    return {
      parts: data.parts,
      assemblies: data.assemblies || [],
      modelSummary: data.modelSummary || '',
      source: 'ai',
      confidence: data.confidence || 0.5,
    };
  } catch (err) {
    console.warn('AI recognition failed, using rule-based fallback:', err);
    return buildRuleBasedResult(model, summaries, furnitureTypeContext);
  }
}

// ---------------------------------------------------------------------------
// Rule-Based Fallback (Knowledge-Base-Aware)
// ---------------------------------------------------------------------------

/**
 * Generate part identifications using the rule-based engine.
 * When a furniture type context is provided, uses the knowledge base's
 * expected parts, naming patterns, and assembly groups for accurate naming.
 */
function buildRuleBasedResult(
  model: ParsedModel,
  summaries: GeometrySummary[],
  typeContext?: FurnitureTypeContext,
): RecognitionResult {
  // If we have a furniture type from the knowledge base, use it for naming
  if (typeContext && typeContext.expectedParts.length > 0) {
    return buildKBEnhancedResult(model, summaries, typeContext);
  }

  // Generic fallback without knowledge base
  const partTree = buildPartTree(model, [], []);
  const groups = suggestAssemblyGroups(partTree);

  const parts: PartIdentification[] = summaries.map(s => {
    const role = classifyPartRole(s.partName) as PartRole;
    const dims = sortDims(s.dims);
    const suggestedName = canonicalDisplayName({ role, position: s.relativePosition as PartIdentification['relativePosition'] });

    const group = groups.find(g => g.partIds.some(pid => {
      const node = partTree.find(n => n.id === pid);
      return node?.meshObjectNames.includes(s.partName);
    }));

    return {
      originalName: s.partName,
      suggestedName,
      role,
      relativePosition: s.relativePosition as PartIdentification['relativePosition'],
      assemblyGroup: group?.name || 'Other',
      confidence: 0.5,
      dims: { length: dims.length, width: dims.width, thickness: dims.thickness },
      inferredMaterial: s.material,
    };
  });

  const assemblies = groups.map(g => ({
    name: g.name,
    category: g.category,
    partNames: g.partIds.flatMap(pid => {
      const node = partTree.find(n => n.id === pid);
      return node?.meshObjectNames || [];
    }),
  }));

  return {
    parts,
    assemblies,
    modelSummary: `${model.objects.length} parts (generic rule-based)`,
    source: 'rule-based',
    confidence: 0.5,
  };
}

/**
 * Enhanced rule-based result using the furniture type knowledge base.
 * Matches meshes to expected parts by role + dimensions, then applies
 * naming patterns and assembly groups from the KB.
 */
function buildKBEnhancedResult(
  model: ParsedModel,
  summaries: GeometrySummary[],
  typeContext: FurnitureTypeContext,
): RecognitionResult {
  const prefixes = typeContext.namingPatterns?.prefixes || {};
  const includePos = typeContext.namingPatterns?.includePosition ?? true;
  const includeNum = typeContext.namingPatterns?.includeNumber ?? true;

  // Classify each mesh by role.
  // sortDims rewrites dims from GeometrySummary's {w,d,h} → {length,width,thickness},
  // but matchToExpectedParts is typed as `GeometrySummary & {dims: {length,width,thickness}}`
  // — an impossible intersection. Cast at the call site so the typed view of `classified`
  // matches the param shape.
  const classified = summaries.map(s => ({
    ...s,
    role: classifyPartRole(s.partName) as PartRole,
    dims: sortDims(s.dims),
    normalized: normalizePartName(s.partName),
  }));

  // Match meshes to expected parts from the knowledge base
  const matched = matchToExpectedParts(
    classified as unknown as Parameters<typeof matchToExpectedParts>[0],
    typeContext.expectedParts,
    prefixes,
    includePos,
    includeNum,
  );

  // Build assembly groups from the knowledge base
  const assemblies = typeContext.assemblyGroups.map(g => ({
    name: g.name,
    category: g.category,
    partNames: matched
      .filter(m => g.roles.includes(m.role))
      .map(m => m.originalName),
  }));

  // Any parts not matched to a KB assembly group go to "Other"
  const allGroupedNames = new Set(assemblies.flatMap(a => a.partNames));
  const ungrouped = matched.filter(m => !allGroupedNames.has(m.originalName));
  if (ungrouped.length > 0) {
    assemblies.push({
      name: 'Other',
      category: 'other' as any,
      partNames: ungrouped.map(m => m.originalName),
    });
  }

  return {
    parts: matched,
    assemblies,
    modelSummary: `${typeContext.name} — ${model.objects.length} parts matched to knowledge base`,
    source: 'rule-based',
    confidence: 0.75,
  };
}

/**
 * Match mesh summaries to expected parts from the furniture type knowledge base.
 * Uses role matching + dimension similarity + position ordering.
 */
function matchToExpectedParts(
  classified: (GeometrySummary & { role: PartRole; dims: ReturnType<typeof sortDims>; normalized: ReturnType<typeof normalizePartName> })[],
  expectedParts: ExpectedPart[],
  prefixes: Record<string, string>,
  includePosition: boolean,
  includeNumber: boolean,
): PartIdentification[] {
  // Group classified meshes by role
  const byRole = new Map<string, typeof classified>();
  for (const c of classified) {
    if (!byRole.has(c.role)) byRole.set(c.role, []);
    byRole.get(c.role)!.push(c);
  }

  // Sort each role group by position for numbering (top→bottom, left→right)
  for (const [, group] of byRole) {
    group.sort((a, b) => {
      // Sort by Z desc (top first), then X asc (left first)
      const za = (a.bbox.min.z + a.bbox.max.z) / 2;
      const zb = (b.bbox.min.z + b.bbox.max.z) / 2;
      if (Math.abs(za - zb) > 20) return zb - za; // top first
      const xa = (a.bbox.min.x + a.bbox.max.x) / 2;
      const xb = (b.bbox.min.x + b.bbox.max.x) / 2;
      return xa - xb; // left first
    });
  }

  // Track which expected parts have been assigned
  const assignedParts: PartIdentification[] = [];
  const usedMeshes = new Set<string>();

  // First pass: match expected parts to meshes by role
  for (const expected of expectedParts) {
    const candidates = byRole.get(expected.role) || [];
    const unassigned = candidates.filter(c => !usedMeshes.has(c.partName));

    if (unassigned.length === 0) continue;

    // If expected quantity is a number, take that many; otherwise take all
    const qty = typeof expected.quantity === 'number' ? expected.quantity : unassigned.length;
    const toAssign = unassigned.slice(0, qty);

    // If thickness hint exists, prefer parts matching it
    if (expected.typicalThickness) {
      toAssign.sort((a, b) => {
        const diffA = Math.abs(a.dims.thickness - expected.typicalThickness!);
        const diffB = Math.abs(b.dims.thickness - expected.typicalThickness!);
        return diffA - diffB;
      });
    }

    for (let i = 0; i < toAssign.length; i++) {
      const mesh = toAssign[i];
      usedMeshes.add(mesh.partName);

      // Build name from KB template
      let name = prefixes[expected.role] || expected.nameTemplate;

      // Add position qualifier
      if (includePosition && toAssign.length <= 2) {
        const pos = mesh.relativePosition;
        if (pos === 'left' || pos === 'right') name = `${pos === 'left' ? 'Left' : 'Right'} ${name}`;
        else if (pos === 'top') name = `Top ${name}`;
        else if (pos === 'bottom') name = `Bottom ${name}`;
      }

      // Add number for multiples
      if (includeNumber && toAssign.length > 2) {
        name = `${name} ${i + 1}`;
      } else if (includeNumber && toAssign.length === 2 && !includePosition) {
        name = `${name} ${i + 1}`;
      }

      // Find which assembly group this role belongs to
      const asmGroup = findAssemblyGroupForRole(expected.role);

      assignedParts.push({
        originalName: mesh.partName,
        suggestedName: name.trim(),
        role: expected.role as PartRole,
        relativePosition: mesh.relativePosition as PartIdentification['relativePosition'],
        assemblyGroup: asmGroup,
        confidence: 0.75,
        dims: { length: mesh.dims.length, width: mesh.dims.width, thickness: mesh.dims.thickness },
        inferredMaterial: mesh.material,
        notes: expected.notes,
      });
    }
  }

  // Second pass: any unmatched meshes get generic names
  for (const c of classified) {
    if (usedMeshes.has(c.partName)) continue;

    const name = prefixes[c.role]
      ? prefixes[c.role]
      : generateNameFromRole(c.role, c.relativePosition, c.normalized.baseName);

    assignedParts.push({
      originalName: c.partName,
      suggestedName: name,
      role: c.role,
      relativePosition: c.relativePosition as PartIdentification['relativePosition'],
      assemblyGroup: 'Other',
      confidence: 0.5,
      dims: { length: c.dims.length, width: c.dims.width, thickness: c.dims.thickness },
      inferredMaterial: c.material,
    });
  }

  return assignedParts;

  function findAssemblyGroupForRole(role: string): string {
    // This is a closure — typeContext is available from buildKBEnhancedResult scope
    // We'll search expectedParts' parent context... but we don't have it here.
    // Instead, just return the role name — the assembly grouping is done in buildKBEnhancedResult
    return role;
  }
}

function sortDims(dims: { w: number; d: number; h: number }): { length: number; width: number; thickness: number } {
  const sorted = [dims.w, dims.d, dims.h].sort((a, b) => b - a);
  return { length: sorted[0], width: sorted[1], thickness: sorted[2] };
}

function generateNameFromRole(role: PartRole, position: string, baseName: string): string {
  const posMap: Record<string, string> = {
    left: 'Left', right: 'Right', top: 'Top', bottom: 'Bottom',
    front: 'Front', back: 'Back', center: '',
  };
  const pos = posMap[position] || '';

  const roleNames: Record<string, string> = {
    side: `${pos} Side Panel`,
    top_bottom: `${pos === 'Top' ? 'Top' : 'Bottom'} Panel`,
    back: 'Back Panel',
    shelf: `${pos} Shelf`,
    mobile_shelf: `Adjustable Shelf`,
    vertical_division: 'Vertical Division',
    door: `Door${pos ? ` - ${pos}` : ''}`,
    drawer: `Drawer Front`,
    drawer_component: `Drawer ${pos} Component`,
    cover: `${pos} Cover Panel`,
    plinth: 'Plinth',
    rail: `${pos} Rail`,
    stile: `${pos} Stile`,
    panel: `${pos} Panel`,
    bar: `${pos} Bar`,
    counter_front: 'Counter Front',
    muntin: 'Muntin',
    other: baseName || 'Part',
  };

  return roleNames[role] || baseName || 'Part';
}

// ---------------------------------------------------------------------------
// Conversion to PartEntry (for Firestore sync)
// ---------------------------------------------------------------------------

/**
 * Convert AI recognition results to PartEntry format for writing to Firestore.
 *
 * P21.11 — when the optional `finishes` + `preferredFinishIds` pair is
 * provided, each part's `inferredMaterial` string is matched against the
 * Finish Library (biased toward the project's material palette). Match
 * hits stamp `materialId`, `materialCode`, `inventoryItemId`, and a
 * `materialResolutionSource` + `materialResolutionConfidence` pair so
 * Design Manager's PartsTab can show where the mapping came from. When
 * the resolver returns null the part falls back to a bare `materialName`
 * (previous behaviour) and is marked `'ai-guess'` with confidence 0 so
 * downstream UI can flag it for manual resolution.
 */
export function convertRecognitionToPartEntries(
  result: RecognitionResult,
  renames: Record<string, string>,
  modelFileName?: string,
  finishes?: ReadonlyArray<FinishDocument>,
  preferredFinishIds?: ReadonlySet<string>,
): PartEntry[] {
  return result.parts.map((part, index) => {
    const name = renames[part.originalName] || part.suggestedName;
    const materialName = part.inferredMaterial || 'Unknown';

    // Resolve the AI-inferred material name to a Finish Library entry when
    // we have the library loaded. The empty-finishes case (no library yet)
    // skips resolution entirely — we don't want to stamp 'ai-guess' on a
    // part when we haven't actually tried to match it.
    const resolved =
      finishes && finishes.length > 0
        ? resolveMaterialByName(materialName, finishes, preferredFinishIds)
        : null;

    const isPanel = part.dims.length > 0 && part.dims.width > 0;
    const base: PartEntry = {
      partNumber: `AI-${index + 1}`,
      name,
      partType: isPanel ? 'sheet' : (part.dims.thickness <= 5 ? 'component' : 'sheet'),
      length: Math.round(part.dims.length),
      width: Math.round(part.dims.width),
      thickness: Math.round(part.dims.thickness),
      quantity: 1,
      materialName,
      source: 'polyboard' as const,
      importedFrom: modelFileName ? `AI recognition from ${modelFileName}` : 'AI recognition',
    };

    if (resolved) {
      base.materialId = resolved.finishId;
      base.materialCode = resolved.finishCode;
      base.materialName = resolved.finishName || materialName;
      base.inventoryItemId = resolved.inventoryItemId;
      base.materialResolutionSource = resolved.source;
      base.materialResolutionConfidence = resolved.confidence;
    } else if (finishes && finishes.length > 0) {
      // Library was consulted but produced no match — flag it for manual
      // resolution so PartsTab can highlight the row.
      base.materialResolutionSource = 'ai-guess';
      base.materialResolutionConfidence = 0;
    }

    return base;
  });
}
