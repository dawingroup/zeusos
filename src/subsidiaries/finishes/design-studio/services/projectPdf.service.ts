/**
 * Project PDF Service — Multi-cabinet project PDF generation
 *
 * Thin orchestrator that delegates to `scenePrintPackage.service`: loads the
 * scene, parses each cabinet's GLB, and produces a single PDF built on the
 * exact same page templates Quick View uses (cover, isometric, elevations,
 * plan, three-view, assemblies, cut list). The scene PDF adds a scene-level
 * cover + TOC as the first page, then appends one Quick-View package per
 * cabinet.
 *
 * Legacy `generateProjectPDF` + `previewProjectPDF` are kept as blob-returning
 * entry points so the dialog can just download the blob (no Storage upload
 * round-trip for now).
 */
import type { ProjectPDFRequest, ProjectPDFData } from '../types/projectPdf.types';
import type { SceneAssembly } from '../types/assembly.types';
import type {
  PrintPackageConfig,
  PrintPackageProjectInfo,
} from '../types/workshop-viewer.types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getScene, getSceneCabinets } from './scene.service';
import { getProjectCutList, getProjectRollup } from './sceneBomRollup.service';
import { extractHardwareSchedule } from './partProcessing.service';
import {
  buildCabinetInputs,
  generateScenePrintPackage,
  type SceneScheduleBundle,
} from './scenePrintPackage.service';
import type { GenerationProgress } from './printPackageService';
import { aggregateFinishSchedule, type FinishResolver } from './finishScheduleAggregator';
import {
  enrichHardwareSchedule,
  hardwareInventoryIds,
} from './hardwareScheduleEnricher';
import {
  createFinishLibraryResolver,
  createInventoryResolver,
} from './scheduleLibraryResolvers';

/**
 * Prepare aggregated, non-PDF data for a scene (used by in-UI summaries and
 * by the PDF generator for metadata / cover info).
 */
export async function prepareProjectPDFData(
  sceneId: string,
  _request: ProjectPDFRequest,
): Promise<ProjectPDFData> {
  const scene = await getScene(sceneId, true);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);

  const cabinets = await getSceneCabinets(sceneId);

  const assembliesByCabinet: Record<string, SceneAssembly[]> = {};
  for (const cab of cabinets) {
    assembliesByCabinet[cab.id] = cab.assemblies ?? [];
  }

  const cutList = getProjectCutList(cabinets, assembliesByCabinet, sceneId);
  const bomRollup = getProjectRollup(cabinets, assembliesByCabinet);
  const allParts = Object.values(assembliesByCabinet).flatMap(a => a.flatMap(asm => asm.parts));
  const hardwareSchedule = extractHardwareSchedule(allParts);

  return {
    scene,
    cabinets,
    cutList,
    bomRollup,
    hardwareSchedule,
    edgeBandingSchedule: [],
    totalPricing: bomRollup as unknown as ProjectPDFData['totalPricing'],
    generatedAt: null as unknown as ProjectPDFData['generatedAt'],
    generatedBy: 'design-studio',
  };
}

/**
 * Build the Quick-Review PrintPackageConfig used for each cabinet section.
 * The `layout` option from the dialog toggles which per-cabinet sheets are
 * included, matching the pattern Quick View uses.
 */
function cleanSceneName(raw: string | undefined | null): string {
  // Scenes created via AI Quick Review are auto-named "Scene from <file>" —
  // that prefix is noise in a client-facing PDF. Strip it (and any similar
  // internal prefixes) so the project name reads as the actual project.
  const s = (raw ?? '').trim();
  return s.replace(/^scene\s+from\s+/i, '').trim() || 'Project';
}

async function resolveProjectName(
  scene: { name: string; projectId?: string },
): Promise<string> {
  // Prefer the linked project's name when we have a projectId — that matches
  // how Quick View's PrintPackage populates projectInfo.projectName.
  const projectId = scene.projectId;
  if (projectId) {
    try {
      const snap = await getDoc(doc(db, 'projects', projectId));
      if (snap.exists()) {
        const data = snap.data() as { name?: string };
        if (data?.name) return data.name;
      }
    } catch (err) {
      console.warn('[projectPdf] project name lookup failed:', err);
    }
  }
  return cleanSceneName(scene.name);
}

function buildConfigFromRequest(
  request: ProjectPDFRequest,
  _scene: { name: string; description?: string },
  resolvedProjectName: string,
): PrintPackageConfig {
  const today = new Date().toISOString().slice(0, 10);

  const projectInfo: PrintPackageProjectInfo = {
    projectName: resolvedProjectName,
    client: request.customer?.name ?? '',
    address: request.customer?.address ?? '',
    projectNo: '',
    drawnBy: 'DawinOS',
    checkedBy: '',
    revision: 'A',
    stage: 'Issue for Review',
    date: today,
  };

  // Per-layout sheet selection. Mirrors the verbal spec from the dialog:
  //  detailed → all sheets (the default Quick View preset)
  //  workshop → cut list + schedules only (shop-floor bundle)
  //  client   → cover + iso + elevations + renders + finishes
  const layout = request.layout;

  // Scene-level schedule defaults by layout. Explicit request fields
  // override these — the dialog's checkboxes set them directly.
  const defaultRenderGallery      = layout !== 'workshop';
  const defaultHardwareSchedule   = layout !== 'client_presentation';
  const defaultFinishSchedule     = true; // useful in every layout
  const defaultArchitecturalPlans = layout !== 'workshop';

  // Map the dialog's PDFSectionType[] checkboxes into the per-block
  // flags the scene generator actually reads. Unticking "Project
  // Summary" now actually skips the P-block; unticking "Cabinet
  // Detail Pages" skips the C-block. When `sections` is omitted
  // (legacy callers), default each block ON so nothing changes.
  const sections = new Set(request.sections ?? []);
  const hasSections = (request.sections?.length ?? 0) > 0;
  const keep = (id: string, fallback: boolean) =>
    hasSections ? sections.has(id as never) : fallback;

  const includeProjectSection = keep('project_summary', true);
  const includeCabinetSection = keep('cabinet_detail', true);
  const includeAssemblyDrawings =
    layout !== 'client_presentation'
    && request.includeAssemblyDrawings
    && keep('assembly_drawings', true);
  const includeCutList =
    layout !== 'client_presentation'
    && keep('project_cutlist', true);
  const includeCover = keep('cover', true);

  const includeSheets: PrintPackageConfig['includeSheets'] = {
    cover: includeCover,
    isometricView: true,
    frontElevation: layout !== 'workshop',
    rearElevation: layout === 'detailed',
    planView: layout !== 'client_presentation',
    threeView: layout === 'detailed',
    partDetails: layout !== 'client_presentation',
    assemblyExploded: includeAssemblyDrawings,
    cutList: includeCutList,
    edgeBandSchedule: keep('project_edge_banding', false),
    shopTraveller: false,
    projectSection:     request.includeProjectSection     ?? includeProjectSection,
    cabinetSection:     request.includeCabinetSection     ?? includeCabinetSection,
    renderGallery:      request.includeRenderGallery      ?? defaultRenderGallery,
    hardwareSchedule:   request.includeHardwareSchedule
      ?? (defaultHardwareSchedule && keep('project_hardware_schedule', true)),
    finishSchedule:     request.includeFinishSchedule     ?? defaultFinishSchedule,
    architecturalPlans: request.includeArchitecturalPlans ?? defaultArchitecturalPlans,
  };

  return {
    projectInfo,
    includeSheets,
    dimensionTiers: { overall: true, intermediate: true, openings: true },
    hiddenLineMode: 'faint',
    shopTravellerSource: 'auto-generate',
    paperSize: 'A3',
    orientation: 'landscape',
    includeAutoDimensions: true,
    includeUserDimensions: true,
    respectVisibilityOverrides: true,
  };
}

/**
 * Generate a complete project PDF as a Blob. The caller (useProjectPDF) is
 * responsible for turning the blob into an object URL and triggering a
 * download — we don't upload to Storage yet.
 */
async function fetchFinishesLogoUrl(): Promise<string | undefined> {
  // Mirrors WorkshopViewerPage's lookup so scene PDFs carry the same
  // branding as Quick View PDFs.
  try {
    const snap = await getDoc(doc(db, 'organizations', 'default', 'settings', 'general'));
    if (!snap.exists()) return undefined;
    const data = snap.data() as { branding?: { subsidiaries?: Record<string, { logoUrl?: string }> } };
    const subs = data?.branding?.subsidiaries;
    return subs?.['zeus-the-agency']?.logoUrl;
  } catch (err) {
    console.warn('[projectPdf] logo lookup failed:', err);
    return undefined;
  }
}

export async function generateProjectPDFBlob(
  request: ProjectPDFRequest,
  onProgress?: (progress: GenerationProgress) => void,
  logoUrlOverride?: string,
): Promise<Blob> {
  onProgress?.({ phase: 'Loading scene', percent: 2 });
  const scene = await getScene(request.sceneId, true);
  if (!scene) throw new Error(`Scene ${request.sceneId} not found`);

  const [projectName, finishesLogo, cabinets] = await Promise.all([
    resolveProjectName(scene),
    logoUrlOverride ? Promise.resolve(logoUrlOverride) : fetchFinishesLogoUrl(),
    getSceneCabinets(request.sceneId),
  ]);

  onProgress?.({ phase: 'Preparing cabinets', percent: 5 });
  // Build assembliesByCabinet the same way prepareProjectPDFData does —
  // used by buildCabinetInputs to turn SceneAssembly[] into cut-list entries
  // and confirmed AssemblyGroups for the per-cabinet detail sheets.
  const assembliesByCabinet: Record<string, import('../types/assembly.types').SceneAssembly[]> = {};
  for (const cab of cabinets) {
    assembliesByCabinet[cab.id] = cab.assemblies ?? [];
  }
  const inputs = await buildCabinetInputs(
    cabinets,
    (phase, percent) => onProgress?.({ phase, percent }),
    assembliesByCabinet,
  );
  if (inputs.length === 0) {
    throw new Error('No cabinets in this scene have a loadable model.');
  }

  const config = buildConfigFromRequest(request, scene, projectName);

  // Scene-level schedule aggregates — only fetched when the matching
  // includeSheets flag is on. Keeps the zero-config path untouched.
  //
  // Resolvers are built lazily + SCOPED: we collect the exact set of
  // finishLibrary / inventoryItem ids that appear in this scene, then
  // batch-fetch just those docs. This gives the rendered schedule two
  // guarantees:
  //   (a) the table lists only the finishes / hardware actually used
  //       in the PDF — never the full library;
  //   (b) the Firestore bill doesn't balloon as the libraries grow.
  const schedules: SceneScheduleBundle = {};
  const sheetFlags = config.includeSheets;

  if (sheetFlags.hardwareSchedule || sheetFlags.finishSchedule) {
    onProgress?.({ phase: 'Loading library data', percent: 92 });
  }

  if (sheetFlags.hardwareSchedule) {
    const allParts = cabinets.flatMap(c => (c.assemblies ?? []).flatMap(a => a.parts ?? []));
    const rawSchedule = extractHardwareSchedule(allParts);
    // Resolve each entry's inventoryItemId against the Materials
    // library (inventoryItems). Caller can override with their own
    // resolver (e.g. a preloaded Map); default is a scoped fetch.
    const invResolver =
      request.inventoryResolver
      ?? await createInventoryResolver(hardwareInventoryIds(rawSchedule));
    schedules.hardwareSchedule = enrichHardwareSchedule(rawSchedule, invResolver);
  }

  if (sheetFlags.finishSchedule) {
    const finishIds = collectFinishIds(cabinets);
    const finishResolver: FinishResolver =
      request.finishResolver
      ?? await createFinishLibraryResolver(finishIds);
    schedules.finishSchedule = aggregateFinishSchedule(cabinets, finishResolver);
  }

  if (sheetFlags.architecturalPlans) {
    schedules.architecturalAssets = scene.architecturalAssets ?? [];
  }

  return generateScenePrintPackage(scene, inputs, config, onProgress, finishesLogo, schedules);
}

/**
 * Collect every finishLibraryId a scene touches — via cabinet
 * finishSelections (cabinet-level) and per-part finishLibraryId
 * overrides. The scoped resolver fetches exactly these ids.
 */
function collectFinishIds(
  cabinets: ReadonlyArray<import('../types/scene.types').SceneCabinet>,
): string[] {
  const set = new Set<string>();
  for (const cab of cabinets) {
    for (const id of Object.values(cab.finishSelections ?? {})) {
      if (id) set.add(id);
    }
    for (const asm of cab.assemblies ?? []) {
      for (const part of asm.parts ?? []) {
        if (part.finishLibraryId) set.add(part.finishLibraryId);
      }
    }
  }
  return Array.from(set);
}

/**
 * Legacy entry point — returns a blob-URL (object URL) so existing callers
 * that expect a URL string keep working. The dialog prefers the blob path
 * (generateProjectPDFBlob) for direct download.
 */
export async function generateProjectPDF(request: ProjectPDFRequest): Promise<string> {
  const blob = await generateProjectPDFBlob(request);
  return URL.createObjectURL(blob);
}

/** Browser-preview entry point — returns the raw Blob. */
export async function previewProjectPDF(
  sceneId: string,
  request: ProjectPDFRequest,
): Promise<Blob> {
  return generateProjectPDFBlob({ ...request, sceneId });
}

/**
 * Per-cabinet high-res render stub. Scene PDF does not yet call a headless
 * renderer — per-cabinet pages use the same vector projections Quick View
 * produces. Kept here so other callers (gallery thumbnails) don't break.
 */
export async function generateCabinetRender(
  cabinetId: string,
  _preset: string = 'product_catalog',
): Promise<string> {
  return `https://storage.googleapis.com/dawinos.appspot.com/cabinet-renders/${cabinetId}.png`;
}

/** Batch stub — see `generateCabinetRender`. */
export async function generateAllCabinetRenders(
  sceneId: string,
): Promise<Record<string, string>> {
  const cabinets = await getSceneCabinets(sceneId);
  const results: Record<string, string> = {};
  for (const cab of cabinets) {
    results[cab.id] = cab.renderUrl ?? await generateCabinetRender(cab.id);
  }
  return results;
}
