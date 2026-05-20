/**
 * Process Model Service — Unified pipeline orchestrator
 *
 * Runs the full processing pipeline for a cabinet's 3D model:
 *   1. AI assembly grouping
 *   2. Material resolution (finish library)
 *   3. BOM computation
 *   4. Render generation (thumbnail placeholder)
 *   5. Save ModelPackage
 *
 * Each step reports progress via callback. Step failures are captured but
 * don't abort the pipeline where possible.
 */
import { doc, getDoc } from 'firebase/firestore';
import type { ParsedModel } from '../types/workshop-viewer.types';
import type {
  CreateModelPackageInput,
  ModelGrouping,
  ModelMaterials,
  ModelRenders,
  ModelProcessingStep,
  ProcessModelProgress,
  MaterialMappingLite,
} from '../types/modelPackage.types';
import type { SceneCabinet } from '../types/scene.types';
import type { ComputedBOMLine, PricingBreakdown } from '../types/constraintEngine.types';
import { groupModelWithAI, validateGrouping } from './aiAssemblyGrouper.service';
import { hydrateMissingPartDimensions } from './partDimensionHydration';
import { createModelPackage } from './modelPackage.service';
import type { FinishDocument } from '@/modules/inventory/types/finishLibrary';
import { getFinishes } from '@/modules/inventory/services/finishLibraryService';
import { db } from '@/firebase/config';
import {
  resolveFromThreeDSNames,
  paletteEntriesToFinishIds,
} from './materialResolverService';
import { applyMaterialUpdates, propagateMaterials } from './materialPropagationService';

export interface ProcessModelInput {
  sceneId: string;
  cabinetId: string;
  cabinet: SceneCabinet;
  parsedModel: ParsedModel;
  /** When set, the model is filtered to only these mesh names — used during bulk import */
  meshFilter?: string[];
  archetypeKey?: string;
  /** New multi-archetype list — AI grouping merges every archetype's
   *  context (expectedAssemblies, coverPanelHints, domain prompts). */
  archetypeKeys?: string[];
  archetypeContext?: string[];
  modelName?: string;
  fileType?: 'glb' | '3ds' | 'dxf' | 'csv' | 'unknown';
  onProgress?: ProcessModelProgress;
  /**
   * When true, run AI grouping + material + BOM as usual but SKIP the
   * final `createModelPackage` Firestore write. Returned result carries
   * `packageId: ''` — callers use this to preview a re-parse (e.g. the
   * Revision → Parts Refresh flow) before committing.
   */
  dryRun?: boolean;
  /**
   * P2.1 — Finish Library entries for persisted material resolution.
   * When provided, `processModel` runs `resolveFromThreeDSNames` at
   * pipeline time and stores the results on `ModelPackage.materials.mappings`
   * so the resolution survives without React state.
   */
  finishes?: FinishDocument[];
  /** Project palette entries — same shape as `DesignProject.materialPalette`. */
  materialPalette?: ReadonlyArray<{ name?: string; code?: string }>;
}

export interface ProcessModelResult {
  packageId: string;
  grouping: ModelGrouping;
  materials: ModelMaterials;
  renders: ModelRenders;
  bom: ComputedBOMLine[];
  pricing: PricingBreakdown | null;
  validation: { issues: string[]; warnings: string[] };
  durationMs: number;
}

type PaletteEntryLite = { name?: string; code?: string };

const FINISH_CACHE_TTL_MS = 60_000;
let finishCache: { fetchedAt: number; data: FinishDocument[] } | null = null;
const scenePaletteCache = new Map<string, { fetchedAt: number; data: PaletteEntryLite[] }>();

async function getActiveFinishesCached(): Promise<FinishDocument[]> {
  const now = Date.now();
  if (finishCache && now - finishCache.fetchedAt < FINISH_CACHE_TTL_MS) {
    return finishCache.data;
  }
  const finishes = await getFinishes({ isActive: true });
  finishCache = { fetchedAt: now, data: finishes };
  return finishes;
}

async function getScenePaletteCached(sceneId: string): Promise<PaletteEntryLite[]> {
  const now = Date.now();
  const hit = scenePaletteCache.get(sceneId);
  if (hit && now - hit.fetchedAt < FINISH_CACHE_TTL_MS) {
    return hit.data;
  }

  const sceneSnap = await getDoc(doc(db, 'designScenes', sceneId));
  if (!sceneSnap.exists()) return [];
  const scene = sceneSnap.data() as { projectId?: string };
  if (!scene.projectId) return [];

  const projectSnap = await getDoc(doc(db, 'designProjects', scene.projectId));
  if (!projectSnap.exists()) return [];
  const project = projectSnap.data() as {
    materialPalette?: {
      entries?: Array<{ name?: string; code?: string; designName?: string }>;
    };
  };
  const entries = project.materialPalette?.entries ?? [];
  const palette = entries.map(e => ({
    name: e.name ?? e.designName,
    code: e.code,
  }));
  scenePaletteCache.set(sceneId, { fetchedAt: now, data: palette });
  return palette;
}

/**
 * Run the full model processing pipeline and persist the result.
 */
export async function processModel(input: ProcessModelInput): Promise<ProcessModelResult> {
  const start = Date.now();
  const steps: ModelProcessingStep[] = [];
  const errors: string[] = [];

  const report = (step: ModelProcessingStep['name'], progress: number, message?: string) => {
    input.onProgress?.({ step, progress, message });
  };

  // Apply mesh filter if provided (used by bulk import to scope to one cabinet's meshes)
  const filteredModel: ParsedModel = input.meshFilter && input.meshFilter.length > 0
    ? {
        ...input.parsedModel,
        objects: (input.parsedModel.objects ?? []).filter(o => input.meshFilter!.includes(o.name)),
      } as ParsedModel
    : input.parsedModel;

  // Step 1: AI Grouping
  report('grouping', 0.05, 'Analyzing model structure with AI...');
  const groupingStart = Date.now();
  let grouping: ModelGrouping;
  try {
    // Prefer the multi-archetype list when the caller supplied one;
    // fall back to the cabinet's own archetypeIds array so every
    // processing path (direct, revision apply, bulk import) picks
    // up the same context the user authored.
    const archetypeKeys = input.archetypeKeys
      ?? input.cabinet.archetypeIds
      ?? undefined;
    grouping = await groupModelWithAI({
      cabinetId: input.cabinetId,
      parsedModel: filteredModel,
      archetypeKey: input.archetypeKey ?? input.cabinet.archetypeId,
      archetypeKeys,
      archetypeContext: input.archetypeContext,
      modelName: input.modelName,
    });
    if (grouping.parts.length > 0) {
      const hydrated = hydrateMissingPartDimensions(grouping.parts, filteredModel);
      grouping = { ...grouping, parts: hydrated };
    }
    steps.push({
      name: 'grouping',
      startedAt: groupingStart,
      durationMs: Date.now() - groupingStart,
      status: 'success',
      detail: `${grouping.source} grouping, confidence ${(grouping.confidence * 100).toFixed(0)}%`,
    });
  } catch (err) {
    const msg = `Grouping failed: ${(err as Error).message}`;
    errors.push(msg);
    steps.push({ name: 'grouping', startedAt: groupingStart, durationMs: Date.now() - groupingStart, status: 'error', detail: msg });
    grouping = {
      source: 'heuristic',
      model: 'fallback',
      confidence: 0,
      reasoning: msg,
      assemblies: [],
      parts: [],
      unmapped: [],
    };
  }
  report('grouping', 0.25, `Found ${grouping.assemblies.length} assemblies`);

  // Step 2: Validation
  const validation = validateGrouping(grouping, input.parsedModel);
  errors.push(...validation.issues);

  // Step 3: Material resolution
  // P2.1: when finishes are supplied, resolve against Finish Library and
  // persist the mappings so downstream consumers don't need React state.
  report('materials', 0.35, 'Resolving materials...');
  const materialsStart = Date.now();
  const finishes =
    input.finishes
    ?? await getActiveFinishesCached().catch(() => []);
  const materialPalette =
    input.materialPalette
    ?? await getScenePaletteCached(input.sceneId).catch(() => []);
  const materials = resolveMaterialsFromParsedModel(
    filteredModel,
    finishes,
    materialPalette,
  );

  // P2.2: stamp resolved material mappings onto grouped parts so
  // downstream ScenePart consumers carry concrete finish/inventory ids.
  if (materials.mappings.length > 0 && grouping.parts.length > 0) {
    const propagation = propagateMaterials(
      grouping.parts,
      materials.mappings,
      finishes.map(f => ({ id: f.id, inventoryItemId: f.inventoryItemId, name: f.name })),
    );
    if (propagation.mappedParts > 0) {
      const updatedParts = applyMaterialUpdates(grouping.parts, propagation.updates);
      grouping = {
        ...grouping,
        parts: updatedParts,
        assemblies: grouping.assemblies.map(a => ({
          ...a,
          parts: applyMaterialUpdates(a.parts ?? [], propagation.updates),
        })),
      };
    }
  }
  steps.push({
    name: 'materials',
    startedAt: materialsStart,
    durationMs: Date.now() - materialsStart,
    status: materials.mappings.length > 0 ? 'success' : 'skipped',
    detail: `${materials.mappings.length} mapped, ${materials.unresolved.length} unresolved`,
  });
  report('materials', 0.50, `${materials.mappings.length} materials mapped`);

  // Step 4: BOM — use cabinet's existing computedBOM
  report('bom', 0.60, 'Computing BOM...');
  const bomStart = Date.now();
  const bom = input.cabinet.computedBOM ?? [];
  const pricing = input.cabinet.estimatedPrice ?? null;
  steps.push({
    name: 'bom',
    startedAt: bomStart,
    durationMs: Date.now() - bomStart,
    status: 'success',
    detail: `${bom.length} BOM lines`,
  });
  report('bom', 0.75, `${bom.length} BOM lines ready`);

  // Step 5: Renders — placeholder (real client-side capture happens separately)
  // Only populate keys we actually have — Firestore rejects undefined values.
  report('renders', 0.80, 'Preparing render placeholders...');
  const rendersStart = Date.now();
  const renders: ModelRenders = {};
  if (input.cabinet.thumbnailUrl) renders.thumbnail = input.cabinet.thumbnailUrl;
  if (input.cabinet.renderUrl) renders.productCatalog = input.cabinet.renderUrl;
  steps.push({
    name: 'renders',
    startedAt: rendersStart,
    durationMs: Date.now() - rendersStart,
    status: renders.thumbnail || renders.productCatalog ? 'success' : 'skipped',
    detail: renders.thumbnail || renders.productCatalog ? 'Using existing renders' : 'No renders yet',
  });
  report('renders', 0.90, 'Renders prepared');

  // Step 6: Save ModelPackage
  report('save', 0.92, 'Saving model package...');
  const saveStart = Date.now();
  const totalMs = Date.now() - start;

  // Firestore rejects any `undefined` field value — build modelRef and context
  // conditionally so optional fields that would otherwise be undefined are
  // simply omitted. This is what previously broke the BulkCabinetImportDialog
  // auto-process path for cabinets with no glbUrl yet.
  const modelRef: CreateModelPackageInput['modelRef'] = {
    fileType: input.fileType ?? 'glb',
  };
  if (input.modelName) modelRef.fileName = input.modelName;
  if (input.cabinet.glbUrl) modelRef.glbUrl = input.cabinet.glbUrl;

  const context: CreateModelPackageInput['context'] = {};
  if (input.cabinet.archetypeId) context.archetypeId = input.cabinet.archetypeId;

  const pkgInput: CreateModelPackageInput = {
    sceneId: input.sceneId,
    cabinetId: input.cabinetId,
    sourceType: 'cabinet',
    sourceId: input.cabinetId,
    modelRef,
    grouping,
    materials,
    renders,
    bom,
    pricing,
    context,
    metadata: {
      processedBy: 'design-studio',
      processingDurationMs: totalMs,
      errors,
      steps,
    },
  };

  let packageId = '';
  if (input.dryRun) {
    steps.push({
      name: 'save',
      startedAt: saveStart,
      durationMs: 0,
      status: 'skipped',
      detail: 'dryRun — no Firestore write',
    });
  } else {
    try {
      packageId = await createModelPackage(pkgInput);
      steps.push({
        name: 'save',
        startedAt: saveStart,
        durationMs: Date.now() - saveStart,
        status: 'success',
      });
    } catch (err) {
      const msg = `Save failed: ${(err as Error).message}`;
      errors.push(msg);
      steps.push({ name: 'save', startedAt: saveStart, durationMs: Date.now() - saveStart, status: 'error', detail: msg });
      throw err;
    }
  }

  report('save', 1.0, input.dryRun ? 'Preview complete' : 'Complete');

  return {
    packageId,
    grouping,
    materials,
    renders,
    bom,
    pricing,
    validation,
    durationMs: totalMs,
  };
}

/**
 * Build a lightweight materials section from the parsed model's materials list.
 *
 * P2.1: when `finishes` are provided, runs `resolveFromThreeDSNames` and
 * persists the results as `MaterialMappingLite` entries on the ModelPackage.
 * Without finishes (legacy path), only records unresolved material names
 * for later resolution via the `useMaterialResolver` React hook.
 */
function resolveMaterialsFromParsedModel(
  parsedModel: ParsedModel,
  finishes?: FinishDocument[],
  palette?: ReadonlyArray<{ name?: string; code?: string }>,
): ModelMaterials {
  const mappings: MaterialMappingLite[] = [];
  const unresolved: { materialName: string; reason: string }[] = [];

  const rawMaterials = parsedModel.materials;

  // If we have finishes and the raw materials are in Record<string, { diffuse }> form,
  // resolve directly using the full matching cascade.
  if (finishes && finishes.length > 0 && rawMaterials && !Array.isArray(rawMaterials)) {
    const matRecord = rawMaterials as Record<string, { diffuse: [number, number, number] }>;
    const preferredIds = palette ? paletteEntriesToFinishIds(palette, finishes) : undefined;
    const resolved = resolveFromThreeDSNames(matRecord, finishes, {
      preferredFinishIds: preferredIds,
    });

    for (const m of resolved) {
      if (m.finishLibraryId) {
        mappings.push({
          threeDSName: m.threeDsMaterialName,
          threeDSColor: m.hexColor,
          finishLibraryId: m.finishLibraryId,
          finishLibraryName: m.finishName,
          finishCategory: m.category,
          confidence: m.confidence,
          matchedOn: m.matchedOn === 'none' ? 'fuzzy_name' : m.matchedOn,
        });
      } else {
        unresolved.push({
          materialName: m.threeDsMaterialName,
          reason: m.matchedOn === 'none'
            ? 'No match in Finish Library'
            : `Low confidence match (${(m.confidence * 100).toFixed(0)}%)`,
        });
      }
    }

    const source = mappings.length > 0
      ? (mappings.every(m => m.matchedOn === 'code') ? 'exact' : 'fuzzy')
      : 'fuzzy';

    return { source, mappings, unresolved };
  }

  // Legacy path: just record the material names for later hook-based resolution
  const materialNames: string[] = rawMaterials
    ? Array.isArray(rawMaterials)
      ? (rawMaterials as Array<{ name: string }>).map(m => m.name).filter(Boolean)
      : Object.keys(rawMaterials as Record<string, unknown>)
    : [];

  for (const name of materialNames) {
    if (!name) continue;
    unresolved.push({
      materialName: name,
      reason: 'Awaiting Finish Library resolution',
    });
  }

  return {
    source: unresolved.length === 0 ? 'manual' : 'fuzzy',
    mappings,
    unresolved,
  };
}
