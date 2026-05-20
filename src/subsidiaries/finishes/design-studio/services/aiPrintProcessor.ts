/**
 * AI Print Package Processor
 *
 * Uses Claude (via Firebase Cloud Function) to intelligently analyse
 * the 3D model's part structure and determine:
 * 1. Which edges should be visible vs hidden (structural importance)
 * 2. Which dimensions are most critical for the workshop
 * 3. Suggested annotation callouts for key features
 *
 * Falls back to a comprehensive rule-based engine if Claude is unavailable.
 */

import { httpsCallable } from 'firebase/functions';
import { functions } from '@/shared/services/firebase';
import type {
  ParsedModel,
  CutListEntry,
  PartTreeNode,
  DimensionSet,
  IntermediateDimension,
  ViewDirection,
  ProjectContext,
  MaterialMatch,
  PartDiscrepancy,
  ProductionNote,
} from '../types/workshop-viewer.types';
import { DIMENSION_COLORS } from '../constants/workshop-viewer.constants';
import { computeBoundingBox, bboxDimensions, classifyPartRole } from './geometryEngine';

// ============================================================================
// TYPES
// ============================================================================

export interface AIProcessingResult {
  enhancedDimensions: DimensionSet;
  partVisibility: PartVisibilityMap;
  annotations: ViewAnnotation[];
  materialMatches: MaterialMatch[];
  partDiscrepancies: PartDiscrepancy[];
  productionNotes: ProductionNote[];
  meta: {
    processingTimeMs: number;
    aiModel: string;
    confidence: number;
  };
}

export interface PartVisibilityMap {
  [view: string]: PartVisibilityEntry[];
}

export interface PartVisibilityEntry {
  partName: string;
  importance: 'primary' | 'secondary' | 'background';
  reason: string;
}

export interface ViewAnnotation {
  view: ViewDirection;
  text: string;
  position: { x: number; y: number };
  type: 'material' | 'hardware' | 'dimension' | 'note';
}

// ============================================================================
// IN-MEMORY CACHE — skip redundant Claude calls
//
// processWithAI runs per cabinet per PDF export. On a 17-cabinet scene
// that's 17 × ~12s = ~3.5 minutes of AI time, almost all of it repeat
// work since the underlying geometry is identical between exports.
//
// Keyed by a signature of mesh names + bboxes + cutList length, which
// changes only when the cabinet's geometry or cut list actually
// changes. First export populates, subsequent exports in the same
// session hit the cache and finish sub-second.
//
// FIFO eviction at 50 entries — per-cabinet footprint is a few KB, and
// realistic use tops out at 30-40 distinct cabinets per session.
// ============================================================================

const AI_CACHE_LIMIT = 50;
const aiResultCache = new Map<string, AIProcessingResult>();

/**
 * Stable signature: mesh name + vertex-count + bbox extremes per
 * object, plus the cut-list length. Catches scale changes (bbox
 * extremes differ), topology changes (vertex count differs), and
 * mesh additions/removals. O(vertices) once per call — sub-ms for
 * typical cabinets.
 */
export function computeModelSignature(
  model: ParsedModel,
  cutList: CutListEntry[],
): string {
  const parts: string[] = [];
  for (const obj of model.objects ?? []) {
    if (!obj.name || !obj.vertices || obj.vertices.length === 0) continue;
    // One pass for bbox extremes — rounded to 1mm so sub-ms float
    // jitter doesn't miss the cache.
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    const v = obj.vertices;
    for (let i = 0; i < v.length; i += 3) {
      if (v[i] < minX) minX = v[i];
      if (v[i + 1] < minY) minY = v[i + 1];
      if (v[i + 2] < minZ) minZ = v[i + 2];
      if (v[i] > maxX) maxX = v[i];
      if (v[i + 1] > maxY) maxY = v[i + 1];
      if (v[i + 2] > maxZ) maxZ = v[i + 2];
    }
    parts.push([
      obj.name,
      v.length,
      Math.round(minX), Math.round(minY), Math.round(minZ),
      Math.round(maxX), Math.round(maxY), Math.round(maxZ),
    ].join(','));
  }
  parts.sort();
  parts.push(`cuts:${cutList.length}`);
  return parts.join('|');
}

/** Test-only — drop everything in the cache. */
export function clearAIDimensionCache(): void {
  aiResultCache.clear();
}

/** Diagnostic — how many cabinets are cached this session. */
export function aiDimensionCacheSize(): number {
  return aiResultCache.size;
}

// ============================================================================
// MAIN PROCESSOR
// ============================================================================

/**
 * Process the model through Claude AI to enhance the print package.
 * Falls back to rule-based processing if Claude is unavailable.
 * Results are cached in memory keyed by the model signature — repeat
 * exports of the same cabinet skip the AI round-trip entirely.
 */
export async function processWithAI(
  model: ParsedModel,
  cutList: CutListEntry[],
  _partTree: PartTreeNode[],
  dimensions: DimensionSet,
  onProgress?: (phase: string) => void,
  designContext?: ProjectContext | null,
): Promise<AIProcessingResult> {
  const startTime = Date.now();

  // ── Cache lookup ──────────────────────────────────────────────────
  const cacheKey = computeModelSignature(model, cutList);
  const cached = aiResultCache.get(cacheKey);
  if (cached) {
    onProgress?.('Using cached AI analysis');
    console.log(
      `[aiPrint] cache hit — skipped Claude call ` +
      `(size=${aiResultCache.size}/${AI_CACHE_LIMIT})`,
    );
    return {
      ...cached,
      meta: {
        ...cached.meta,
        processingTimeMs: Date.now() - startTime, // reflect the lookup cost, not the original
      },
    };
  }

  onProgress?.('Analysing model structure');

  // Build a structural summary for analysis
  const modelSummary = buildModelSummary(model, cutList, dimensions);

  // Build design context for enhanced AI analysis
  const designCtxPayload = designContext?.designItemParts ? {
    existingParts: designContext.designItemParts,
    materialPalette: designContext.materialPalette || [],
    projectStage: designContext.stage || '',
  } : undefined;

  let aiResult: AIAnalysis | null = null;

  // Try Claude via Cloud Function
  onProgress?.('Claude AI processing dimensions and visibility');
  try {
    aiResult = await callClaudeAnalysis(modelSummary, designCtxPayload);
  } catch (err) {
    console.warn('Claude analysis unavailable, falling back to rule-based:', err);
  }

  // Fall back to rule-based analysis
  if (!aiResult) {
    onProgress?.('Rule-based dimension analysis');
    aiResult = ruleBasedAnalysis(modelSummary);
  }

  onProgress?.('Applying enhancements');

  const enhancedDimensions = mergeDimensions(dimensions, aiResult);
  const partVisibility = buildPartVisibility(modelSummary, aiResult);
  const annotations = buildAnnotations(modelSummary, aiResult);

  const result: AIProcessingResult = {
    enhancedDimensions,
    partVisibility,
    annotations,
    materialMatches: aiResult.materialMatches || [],
    partDiscrepancies: aiResult.partDiscrepancies || [],
    productionNotes: aiResult.productionNotes || [],
    meta: {
      processingTimeMs: Date.now() - startTime,
      aiModel: aiResult.source,
      confidence: aiResult.confidence,
    },
  };

  // Cache the result keyed by the model signature we computed on
  // entry. FIFO evict when we hit the limit — first inserted goes.
  if (aiResultCache.size >= AI_CACHE_LIMIT) {
    const oldest = aiResultCache.keys().next().value;
    if (oldest) aiResultCache.delete(oldest);
  }
  aiResultCache.set(cacheKey, result);

  return result;
}

// ============================================================================
// MODEL SUMMARY BUILDER
// ============================================================================

interface ModelSummary {
  overallDims: { width: number; depth: number; height: number };
  partCount: number;
  parts: PartSummary[];
  materialList: string[];
  hasDoors: boolean;
  hasDrawers: boolean;
  hasShelves: boolean;
  hasVerticalDivisions: boolean;
}

interface PartSummary {
  name: string;
  role: string;
  dims: { w: number; d: number; h: number };
  bbox: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  material?: string;
}

function buildModelSummary(
  model: ParsedModel,
  cutList: CutListEntry[],
  dimensions: DimensionSet,
): ModelSummary {
  const parts: PartSummary[] = [];
  const materialSet = new Set<string>();

  for (const obj of model.objects) {
    const bbox = computeBoundingBox(obj.vertices);
    const dims = bboxDimensions(bbox);
    const role = classifyPartRole(obj.name);

    if (obj.material) materialSet.add(obj.material);

    const cutMatch = cutList.find(e =>
      obj.name.toLowerCase().includes(e.partName.toLowerCase().split(',')[0].trim())
    );

    parts.push({
      name: obj.name,
      role,
      dims,
      bbox: {
        minX: bbox.min.x, maxX: bbox.max.x,
        minY: bbox.min.y, maxY: bbox.max.y,
        minZ: bbox.min.z, maxZ: bbox.max.z,
      },
      material: cutMatch?.material,
    });
  }

  return {
    overallDims: dimensions.overall,
    partCount: model.objects.length,
    parts,
    materialList: Array.from(materialSet),
    hasDoors: parts.some(p => p.role === 'door'),
    hasDrawers: parts.some(p => p.role === 'drawer'),
    hasShelves: parts.some(p => p.role === 'shelf'),
    hasVerticalDivisions: parts.some(p => p.role === 'vertical_division'),
  };
}

// ============================================================================
// CLAUDE AI ANALYSIS (via Cloud Function)
// ============================================================================

interface AIAnalysis {
  suggestedDimensions: SuggestedDimension[];
  partRanking: { partName: string; importance: string; view: string; reason: string }[];
  suggestedAnnotations: { text: string; partName: string; type: string }[];
  materialMatches?: MaterialMatch[];
  partDiscrepancies?: PartDiscrepancy[];
  productionNotes?: ProductionNote[];
  confidence: number;
  source: string;
}

interface SuggestedDimension {
  view: ViewDirection;
  type: 'horizontal_chain' | 'vertical_chain' | 'single_horizontal' | 'single_vertical';
  positions: number[];
  label: string;
  tier: 1 | 2 | 3;
  reason: string;
}

async function callClaudeAnalysis(summary: ModelSummary, designContext?: Record<string, unknown>): Promise<AIAnalysis> {
  const analyzeWorkshopModel = httpsCallable<
    { modelSummary: ModelSummary; designContext?: Record<string, unknown> },
    { success: boolean; analysis: Omit<AIAnalysis, 'source'> }
  >(functions, 'analyzeWorkshopModel');

  const result = await analyzeWorkshopModel({ modelSummary: summary, designContext });

  if (!result.data.success) {
    throw new Error('Claude analysis returned unsuccessful');
  }

  return {
    ...result.data.analysis,
    source: 'claude-sonnet',
  };
}

// ============================================================================
// RULE-BASED FALLBACK
// ============================================================================

function ruleBasedAnalysis(summary: ModelSummary): AIAnalysis {
  const suggestedDimensions: SuggestedDimension[] = [];
  const partRanking: AIAnalysis['partRanking'] = [];
  const suggestedAnnotations: AIAnalysis['suggestedAnnotations'] = [];

  // ── Door opening dimensions ──
  const doors = summary.parts.filter(p => p.role === 'door');
  for (const door of doors) {
    suggestedDimensions.push({
      view: 'front',
      type: 'single_horizontal',
      positions: [door.bbox.minX, door.bbox.maxX],
      label: `${door.name} opening`,
      tier: 3,
      reason: 'Door opening width for hardware selection',
    });
    suggestedDimensions.push({
      view: 'front',
      type: 'single_vertical',
      positions: [door.bbox.minZ, door.bbox.maxZ],
      label: `${door.name} height`,
      tier: 3,
      reason: 'Door opening height',
    });
  }

  // ── Drawer dimensions ──
  const drawers = summary.parts.filter(p => p.role === 'drawer');
  for (const drawer of drawers) {
    suggestedDimensions.push({
      view: 'front',
      type: 'single_horizontal',
      positions: [drawer.bbox.minX, drawer.bbox.maxX],
      label: `${drawer.name} width`,
      tier: 3,
      reason: 'Drawer runner length selection',
    });
  }

  // ── Shelf spacing — vertical chain ──
  const shelves = summary.parts.filter(p => p.role === 'shelf' || p.role === 'top_bottom');
  if (shelves.length > 1) {
    const zPositions = new Set<number>();
    for (const shelf of shelves) {
      zPositions.add(Math.round(shelf.bbox.minZ));
      zPositions.add(Math.round(shelf.bbox.maxZ));
    }
    const sorted = Array.from(zPositions).sort((a, b) => a - b);
    if (sorted.length >= 2) {
      suggestedDimensions.push({
        view: 'front',
        type: 'vertical_chain',
        positions: sorted,
        label: 'Shelf positions',
        tier: 2,
        reason: 'Internal shelf heights for adjustable shelf drilling',
      });
    }
  }

  // ── Vertical division chain ──
  const divisions = summary.parts.filter(p => p.role === 'vertical_division');
  const sides = summary.parts.filter(p => p.role === 'side');
  if (divisions.length > 0) {
    const xPositions = new Set<number>();
    for (const side of sides) {
      xPositions.add(Math.round(side.bbox.minX));
      xPositions.add(Math.round(side.bbox.maxX));
    }
    for (const div of divisions) {
      xPositions.add(Math.round(div.bbox.minX));
      xPositions.add(Math.round(div.bbox.maxX));
    }
    const sorted = Array.from(xPositions).sort((a, b) => a - b);
    if (sorted.length >= 2) {
      suggestedDimensions.push({
        view: 'front',
        type: 'horizontal_chain',
        positions: sorted,
        label: 'Division positions',
        tier: 2,
        reason: 'Compartment widths for fitting',
      });
    }
  }

  // ── Depth chain for side view ──
  const topBottom = summary.parts.filter(p => p.role === 'top_bottom');
  const backs = summary.parts.filter(p => p.role === 'back');
  if (topBottom.length > 0) {
    const yPositions = new Set<number>();
    for (const part of [...topBottom, ...backs, ...sides]) {
      yPositions.add(Math.round(part.bbox.minY));
      yPositions.add(Math.round(part.bbox.maxY));
    }
    const sorted = Array.from(yPositions).sort((a, b) => a - b);
    if (sorted.length >= 2) {
      suggestedDimensions.push({
        view: 'right',
        type: 'horizontal_chain',
        positions: sorted,
        label: 'Depth positions',
        tier: 2,
        reason: 'Back recess and face frame depth',
      });
    }
  }

  // ── Part ranking ──
  for (const part of summary.parts) {
    const importance = ['side', 'top_bottom', 'vertical_division', 'back'].includes(part.role)
      ? 'primary'
      : ['door', 'drawer', 'shelf'].includes(part.role)
        ? 'secondary'
        : 'background';

    partRanking.push({
      partName: part.name,
      importance,
      view: 'front',
      reason: `${part.role} — ${importance === 'primary' ? 'structural' : importance === 'secondary' ? 'functional' : 'detail'} component`,
    });
  }

  // ── Material annotations ──
  const seenMaterials = new Set<string>();
  for (const part of summary.parts) {
    if (part.material && !seenMaterials.has(part.material)) {
      seenMaterials.add(part.material);
      suggestedAnnotations.push({
        text: part.material,
        partName: part.name,
        type: 'material',
      });
    }
  }

  return {
    suggestedDimensions,
    partRanking,
    suggestedAnnotations,
    confidence: 0.85,
    source: 'rule-based',
  };
}

// ============================================================================
// MERGE AI RESULTS INTO DIMENSIONS
// ============================================================================

function mergeDimensions(
  existing: DimensionSet,
  aiResult: AIAnalysis,
): DimensionSet {
  const mergedIntermediate = [...existing.intermediate];

  for (const suggested of aiResult.suggestedDimensions) {
    const isDuplicate = mergedIntermediate.some(e =>
      e.view === suggested.view &&
      e.type === suggested.type &&
      arraysOverlap(e.positions, suggested.positions)
    );

    if (!isDuplicate && suggested.positions.length >= 2) {
      const color = suggested.type.includes('horizontal')
        ? DIMENSION_COLORS.horizontal
        : suggested.tier === 3
          ? DIMENSION_COLORS.detail
          : DIMENSION_COLORS.vertical;

      mergedIntermediate.push({
        type: suggested.type,
        view: suggested.view,
        positions: suggested.positions,
        tier: suggested.tier,
        label: suggested.label,
        color,
      } as IntermediateDimension);
    }
  }

  return {
    overall: existing.overall,
    intermediate: mergedIntermediate,
  };
}

function arraysOverlap(a: number[], b: number[]): boolean {
  const setA = new Set(a.map(v => Math.round(v)));
  return b.some(v => setA.has(Math.round(v)));
}

// ============================================================================
// BUILD PART VISIBILITY MAP
// ============================================================================

function buildPartVisibility(
  summary: ModelSummary,
  aiResult: AIAnalysis,
): PartVisibilityMap {
  const map: PartVisibilityMap = {};
  const views: ViewDirection[] = ['front', 'back', 'right', 'left', 'top'];

  for (const view of views) {
    const aiRanking = aiResult.partRanking.filter(r => r.view === view || r.view === 'front');
    map[view] = summary.parts.map(part => {
      const aiEntry = aiRanking.find(r => r.partName === part.name);
      return {
        partName: part.name,
        importance: (aiEntry?.importance as 'primary' | 'secondary' | 'background') || 'secondary',
        reason: aiEntry?.reason || `${part.role} component`,
      };
    });
  }

  return map;
}

// ============================================================================
// BUILD ANNOTATIONS
// ============================================================================

function buildAnnotations(
  summary: ModelSummary,
  aiResult: AIAnalysis,
): ViewAnnotation[] {
  const annotations: ViewAnnotation[] = [];

  for (const suggested of aiResult.suggestedAnnotations) {
    const part = summary.parts.find(p => p.name === suggested.partName);
    if (!part) continue;

    annotations.push({
      view: 'front',
      text: suggested.text,
      position: {
        x: (part.bbox.minX + part.bbox.maxX) / 2,
        y: (part.bbox.minZ + part.bbox.maxZ) / 2,
      },
      type: suggested.type as ViewAnnotation['type'],
    });
  }

  return annotations;
}
