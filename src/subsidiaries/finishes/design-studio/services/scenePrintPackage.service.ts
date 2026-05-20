/**
 * scenePrintPackage.service — Multi-cabinet PDF using Quick Review format.
 *
 * Structure of the generated PDF:
 *   1. Scene Cover (Quick View cover format — centered logo, "SHOP DRAWINGS",
 *      project code, W×D×H cards, client, date · stage footer).
 *   2. Scene Contents & Summary (Quick View contents format — aggregate
 *      model summary, drawing index, materials).
 *   3. PROJECT SECTION — consolidated arrangement of ALL cabinets rendered
 *      together (iso SW/NE, front, rear, plan, three-view). Sheet prefix "P-".
 *   4. Per-cabinet sections — each cabinet ISOLATED to its own meshes.
 *      Sheet prefix "C01-", "C02-", …
 *
 * Coordinate convention: `parseGLB` returns vertex data in Three.js / glTF
 * **Y-up**. The PDF iso + elevation projections (`printPackageService.ts`,
 * `hiddenLineEngine.ts`) expect **Z-up** (front: (0,-1,0), top: (0,0,-1);
 * `isoY = -p.z + (p.x + p.y)·SIN30`). `applySceneTransform` is the single
 * conversion site: it mirrors the viewer's recenter + rotate-around-Y +
 * position-offset pipeline, then applies one final R_x(+90°)
 * `(x,y,z)→(x,-z,y)` to flip the output into Z-up for PDF consumption.
 */
import type {
  DesignScene, SceneCabinet,
  SceneArchitecturalAsset, FinishScheduleEntry,
} from '../types/scene.types';
import type { HardwareScheduleEntry } from '../types/mdp.types';
import type { SceneAssembly } from '../types/assembly.types';
import type {
  ParsedModel,
  MeshObject,
  CutListEntry,
  PrintPackageConfig,
  PartTreeNode,
  MeshCutListLink,
  DimensionSet,
  AssemblyGroup,
  AssemblyCategory,
} from '../types/workshop-viewer.types';
import {
  appendCabinetSheets,
  drawCoverSheet,
  preparePackageContext,
  type GenerationProgress,
  type PackageContext,
} from './printPackageService';
import { parseGLB } from './parserGlb';
import {
  drawHardwareScheduleSheet,
  drawFinishScheduleSheet,
  drawRenderGallerySheet,
  drawArchitecturalPlansSheets,
  drawSubCoverSheet,
  architecturalSubtitle,
  drawAssemblyLegend,
  assemblyCountsAcross,
  drawAssemblyInventorySheet,
  buildAssemblyInventoryRows,
} from './sceneScheduleSheets';
import { buildMeshCutListLinks, buildPartTree } from './assemblyEngine';
import { computeDimensions } from './dimensionEngine';
import { computeBoundingBox, mergeBoundingBoxes } from './geometryEngine';
import { drawTitleBlock } from '../utils/titleBlockRenderer';
import { SHEET_NUMBERING, A3_DIMENSIONS, DF_BRAND_COLORS } from '../constants/workshop-viewer.constants';

export interface SceneCabinetInput {
  cabinet: SceneCabinet;
  model: ParsedModel;          // filtered to this cabinet's meshes (+ oriented)
  rawModel: ParsedModel;       // full source model (+ oriented) — shared by cabinets with same source
  cutList: CutListEntry[];
  partTree: PartTreeNode[];
  meshLinks: MeshCutListLink[];
  dimensions: DimensionSet;
  confirmedGroups?: AssemblyGroup[];
}

// ── GLB fetch+parse cache (module-level; mirrors useCabinetParsedModel) ────
const parseCache = new Map<string, Promise<ParsedModel>>();

async function fetchAndParse(url: string): Promise<ParsedModel> {
  const hit = parseCache.get(url);
  if (hit) return hit;
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GLB fetch failed (${res.status}) for ${url}`);
    return parseGLB(await res.arrayBuffer());
  })();
  parseCache.set(url, p);
  try {
    return await p;
  } catch (err) {
    parseCache.delete(url);
    throw err;
  }
}

/**
 * Clone a ParsedModel's objects with fresh Float32Array vertices. Necessary
 * before mutating vertices in place, because multiple cabinets that share a
 * rawModel source also share MeshObject refs (and therefore Float32Array refs)
 * via `applyMeshFilter`'s spread-only clone.
 */
function cloneModelVertices(model: ParsedModel): ParsedModel {
  return {
    ...model,
    objects: model.objects.map(o => ({ ...o, vertices: new Float32Array(o.vertices) })),
  };
}

/**
 * Apply the viewer's per-cabinet orient-and-place transform to vertex data,
 * then flip into Z-up for PDF consumption.
 *
 * Pipeline (all in Y-up, matching `useSceneViewport`):
 *   1. Recenter the cabinet around its own bbox: subtract (cx, minY, cz)
 *      so the cabinet's base sits on y=0 and is centered on x/z=0.
 *   2. Rotate around Y by `cabinet.rotation` (degrees).
 *   3. (Optional) Translate by `cabinet.position` — only when assembling the
 *      scene-aggregate for the consolidated project section.
 *
 * Then — and ONLY here — a final R_x(+90°): `(x, y, z) → (x, -z, y)` maps
 * Y-up (y=height) into Z-up (z=height) so the PDF's iso / front / top
 * projections, which assume Z-up, render cabinets standing on their base.
 *
 * Also clears `glbBuffer` so `appendCabinetSheets`' BVH path reads the
 * transformed vertex data instead of the original Y-up GLB.
 */
function applySceneTransform(
  model: ParsedModel,
  cabinet: SceneCabinet,
  includePosition: boolean,
): ParsedModel {
  const cloned = cloneModelVertices(model);
  if (cloned.objects.length === 0) {
    return { ...cloned, glbBuffer: undefined };
  }
  const bboxes = cloned.objects.map(o => computeBoundingBox(o.vertices));
  const merged = mergeBoundingBoxes(bboxes);
  const cx = (merged.min.x + merged.max.x) / 2;
  const cz = (merged.min.z + merged.max.z) / 2;
  const minY = merged.min.y;

  const rotY = ((cabinet.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const px = includePosition ? (cabinet.position?.x ?? 0) : 0;
  const py = includePosition ? (cabinet.position?.y ?? 0) : 0;
  const pz = includePosition ? (cabinet.position?.z ?? 0) : 0;

  for (const o of cloned.objects) {
    const v = o.vertices;
    for (let i = 0; i < v.length; i += 3) {
      // Step 1: recenter (Y-up frame)
      const x0 = v[i] - cx;
      const y0 = v[i + 1] - minY;
      const z0 = v[i + 2] - cz;
      // Step 2: rotate around Y axis: x' = x·cos + z·sin, z' = -x·sin + z·cos
      const rx = x0 * cos + z0 * sin;
      const ry = y0;
      const rz = -x0 * sin + z0 * cos;
      // Step 3: translate by cabinet.position (Y-up)
      const tx = rx + px;
      const ty = ry + py;
      const tz = rz + pz;
      // Step 4: Y-up → Z-up via R_x(+90°): (x, y, z) → (x, -z, y)
      v[i]     = tx;
      v[i + 1] = -tz;
      v[i + 2] = ty;
    }
  }
  return { ...cloned, glbBuffer: undefined };
}

/**
 * Build `AssemblyGroup[]` (the shape `appendCabinetSheets` consumes) from
 * a cabinet's stored `SceneAssembly[]`. Maps `SceneAssembly.meshNodeIds` →
 * partTree node IDs by matching mesh object names, so the detail-sheet
 * generator can look up geometry for each group.
 *
 * Returns empty array when no assemblies are stored — callers let
 * `buildDetailGroups` fall back to `suggestAssemblyGroups(partTree)`.
 */
export function sceneAssembliesToGroups(
  assemblies: SceneAssembly[] | undefined,
  partTree: PartTreeNode[],
): AssemblyGroup[] {
  if (!assemblies || assemblies.length === 0) return [];

  // Flatten partTree so we can look up nodes by the mesh names they cover.
  const flatten = (nodes: PartTreeNode[]): PartTreeNode[] => {
    const out: PartTreeNode[] = [];
    for (const n of nodes) {
      out.push(n);
      if (n.children?.length) out.push(...flatten(n.children));
    }
    return out;
  };
  const allNodes = flatten(partTree);

  // Build mesh-name → node-id map (prefer leaf node IDs so detail sheets
  // render individual parts; but fall back to any node covering the mesh).
  const meshToNodeIds = new Map<string, string[]>();
  for (const node of allNodes) {
    for (const meshName of node.meshObjectNames) {
      const existing = meshToNodeIds.get(meshName) ?? [];
      existing.push(node.id);
      meshToNodeIds.set(meshName, existing);
    }
  }

  const mapType = (t: string): AssemblyCategory => {
    switch (t) {
      case 'carcass':          return 'carcase';
      case 'door_assembly':    return 'door';
      case 'drawer_box':       return 'drawer_box';
      case 'drawer_front':     return 'drawer_front';
      case 'shelf_pack':       return 'fixed_shelves';
      case 'hardware_kit':     return 'hardware';
      case 'plinth_assembly':
      case 'cornice_run':
      case 'panel_run':        return 'cover';
      default:                 return 'other';
    }
  };

  return assemblies.map((asm) => {
    const ids = new Set<string>();
    for (const meshName of asm.meshNodeIds ?? []) {
      for (const id of meshToNodeIds.get(meshName) ?? []) ids.add(id);
    }
    return {
      id: asm.id,
      category: mapType(asm.assemblyType),
      name: asm.displayName || asm.assemblyCode || 'Assembly',
      partIds: Array.from(ids),
      confidence: 'high',
      isUserModified: true,
    } as AssemblyGroup;
  }).filter(g => g.partIds.length > 0);
}

/**
 * Flatten a cabinet's `SceneAssembly[]` into `CutListEntry[]` for the PDF
 * cut-list / detail pages. Each `ScenePart` with dimensions becomes one
 * entry; parts without dimensions (hardware, fasteners) are skipped.
 */
function sceneAssembliesToCutList(
  cabinet: SceneCabinet,
  assemblies: SceneAssembly[] | undefined,
): CutListEntry[] {
  if (!assemblies || assemblies.length === 0) return [];
  const cabLabel = cabinet.cabinetCode || cabinet.displayName || cabinet.id;
  const out: CutListEntry[] = [];
  let row = 1;
  for (const asm of assemblies) {
    for (const p of asm.parts) {
      if (!p.dimensions) continue;
      out.push({
        cabinet: cabLabel,
        partName: p.partName || p.partCode,
        material: p.materialDescription || p.inventoryItemName || '—',
        thickness: p.dimensions.thickness,
        qty: p.quantity,
        length: p.dimensions.length,
        width: p.dimensions.width,
        edgeBanding: {
          L1: !!p.edgeBanding?.front,
          L2: !!p.edgeBanding?.bottom,
          W1: !!p.edgeBanding?.left,
          W2: !!p.edgeBanding?.right,
        },
        grainDirection: p.dimensions.grainDirection,
        originalRow: row++,
      });
    }
  }
  return out;
}

/**
 * Mirrors the 3-strategy matcher in `useSceneViewport`:
 *   1. `userData.dawinMeshId` — stable id written at export time
 *   2. exact mesh `name` match
 *   3. normalized name match (trim, whitespace→underscore, lowercase)
 * Returns a filtered ParsedModel; if the filter matches zero meshes, returns
 * null so the caller can decide whether to fall back or skip this cabinet.
 */
function applyMeshFilter(model: ParsedModel, wantedNames: string[] | undefined): ParsedModel | null {
  if (!wantedNames || wantedNames.length === 0) return model;
  const normalize = (s: string) => s.trim().replace(/\s+/g, '_').toLowerCase();
  const wantedExact = new Set(wantedNames);
  const wantedNormalized = new Set(wantedNames.map(normalize));

  const filtered = (model.objects ?? []).filter(o => {
    if (o.dawinMeshId && wantedExact.has(o.dawinMeshId)) return true;
    if (wantedExact.has(o.name)) return true;
    if (wantedNormalized.has(normalize(o.name ?? ''))) return true;
    return false;
  });

  if (filtered.length === 0) return null;
  // IMPORTANT: drop glbBuffer — appendCabinetSheets' BVH path prefers the
  // original GLB buffer when present, which would render the FULL source and
  // bleed neighboring cabinets into this cabinet's isolated sheets.
  return { ...model, objects: filtered, glbBuffer: undefined };
}

/**
 * Build SceneCabinetInput[] from raw SceneCabinet[]. Handles GLB fetch,
 * Y-up → Z-up orientation (via `applySceneTransform`), mesh filtering, and
 * Quick-View-equivalent derivations (partTree, cut list, confirmed groups).
 *
 * `assembliesByCabinet` is the same map `prepareProjectPDFData` builds —
 * when provided, each cabinet's stored `SceneAssembly[]` is flattened into
 * a `CutListEntry[]` and mapped into `AssemblyGroup[]` so the per-cabinet
 * detail sheets reflect the confirmed assemblies (rather than auto-suggested
 * ones from the part tree).
 */
export async function buildCabinetInputs(
  cabinets: SceneCabinet[],
  onProgress?: (phase: string, percent: number) => void,
  assembliesByCabinet?: Record<string, SceneAssembly[]>,
): Promise<SceneCabinetInput[]> {
  const inputs: SceneCabinetInput[] = [];
  for (let i = 0; i < cabinets.length; i++) {
    const cab = cabinets[i];
    const url = cab.sourceModelUrl || cab.glbUrl;
    if (!url) {
      console.warn(`[scenePrintPackage] Cabinet ${cab.id} has no GLB URL — skipping`);
      continue;
    }
    onProgress?.(`Loading cabinet ${i + 1}/${cabinets.length}`, 8 + (i / cabinets.length) * 6);
    try {
      const raw = await fetchAndParse(url);
      const filtered = applyMeshFilter(raw, cab.sourceMeshNames);
      let model: ParsedModel;
      if (filtered) {
        // Apply the viewport's orient-and-place transform (recenter + rotate)
        // and the Y-up → Z-up flip. Position offset is OMITTED here —
        // per-cabinet drawings render each cabinet standalone at the origin.
        // The scene-aggregate model re-applies position for the consolidated
        // project section.
        model = applySceneTransform(filtered, cab, /* includePosition */ false);
        console.debug(`[scenePrintPackage] ${cab.cabinetCode || cab.id}: isolated ${filtered.objects.length}/${cab.sourceMeshNames?.length ?? 0} meshes`);
      } else {
        // No meshes matched via dawinMeshId / name / normalized match. Render
        // the full raw source (still Y-up) and log for traceability.
        console.warn(
          `[scenePrintPackage] ${cab.cabinetCode || cab.id}: 0 of ${cab.sourceMeshNames?.length ?? 0} sourceMeshNames matched.`,
          'Wanted:', (cab.sourceMeshNames ?? []).slice(0, 5),
          'Raw names sample:', raw.objects.slice(0, 5).map(o => ({ name: o.name, id: o.dawinMeshId })),
        );
        model = applySceneTransform(raw, cab, /* includePosition */ false);
      }
      const cabAssemblies = assembliesByCabinet?.[cab.id] ?? cab.assemblies;
      const cutList = sceneAssembliesToCutList(cab, cabAssemblies);
      const meshLinks = buildMeshCutListLinks(model, cutList);
      const partTree = buildPartTree(model, cutList, meshLinks);
      const dimensions = computeDimensions(model);
      const confirmedGroups = sceneAssembliesToGroups(cabAssemblies, partTree);
      inputs.push({
        cabinet: cab,
        model,
        rawModel: raw,
        cutList,
        partTree,
        meshLinks,
        dimensions,
        confirmedGroups: confirmedGroups.length > 0 ? confirmedGroups : undefined,
      });
    } catch (err) {
      console.warn(`[scenePrintPackage] Failed to prep cabinet ${cab.id}:`, err);
    }
  }
  return inputs;
}

/**
 * Build a single aggregate ParsedModel representing the whole scene. Each
 * cabinet is transformed by its own `rotation` + `position` so the aggregate
 * mirrors the viewer's scene layout (cabinets arranged in a run, upright).
 *
 * We can't dedupe by rawModel identity anymore — two cabinets sharing a
 * source but sitting at different positions/rotations must each contribute
 * their own transformed copy.
 */
function buildSceneAggregateModel(inputs: SceneCabinetInput[]): ParsedModel {
  const objects: MeshObject[] = [];
  let materials: Record<string, { diffuse: [number, number, number] }> = {};
  let fileName = 'Scene';

  for (const inp of inputs) {
    // Re-derive the filtered (no-transform) model by mesh-filter on rawModel,
    // then apply the full transform INCLUDING position. We can't just take
    // inp.model (which is per-cabinet no-position) and shift it, because
    // that shift must happen in the cabinet's own rotation frame — applying
    // position after rotation matches the viewer's `group.position.set(...)`.
    const filtered = applyMeshFilter(inp.rawModel, inp.cabinet.sourceMeshNames) ?? inp.rawModel;
    const placed = applySceneTransform(filtered, inp.cabinet, /* includePosition */ true);
    objects.push(...placed.objects);
    materials = { ...materials, ...placed.materials };
    if (inp.rawModel.fileName) fileName = inp.rawModel.fileName;
  }

  return {
    source: '3ds',       // non-glb → forces buildModelGroup path in appendCabinetSheets
    fileName,
    objects,
    materials,
  };
}

/**
 * Generate a multi-cabinet scene PDF. One jsPDF document:
 *   [scene cover] + [scene contents/summary] +
 *   [Project section: iso/front/rear/plan/three-view of consolidated scene] +
 *   [per-cabinet sections isolated to each cabinet's meshes]
 */
export interface SceneScheduleBundle {
  /** Accepts either the raw HardwareScheduleEntry[] or the richer
   *  EnrichedHardwareEntry[] (Materials-library-resolved). Renderer
   *  detects which shape it got and picks the right column set. */
  hardwareSchedule?: HardwareScheduleEntry[] | import('./hardwareScheduleEnricher').EnrichedHardwareEntry[];
  finishSchedule?: FinishScheduleEntry[];
  architecturalAssets?: SceneArchitecturalAsset[];
}

export async function generateScenePrintPackage(
  scene: DesignScene,
  inputs: SceneCabinetInput[],
  config: PrintPackageConfig,
  onProgress?: (progress: GenerationProgress) => void,
  logoUrl?: string,
  schedules?: SceneScheduleBundle,
): Promise<Blob> {
  const ctx = await preparePackageContext(config, logoUrl, onProgress);
  const { doc, pdfFormat, font, hasOutfit, logoBase64, logoFormat } = ctx;

  // ── Scene-aggregate model + dimensions ────────────────────────────────
  const sceneModel = buildSceneAggregateModel(inputs);
  const sceneDimensions = computeDimensions(sceneModel);
  const scenePartTree = buildPartTree(sceneModel, [], buildMeshCutListLinks(sceneModel, []));

  // ── Page 1: scene cover (Quick View format) ──────────────────────────
  // Gated on the "Cover Page" section checkbox — skipped when the user
  // explicitly unticks it. The initial jsPDF page gets re-used for the
  // Contents sheet in that case so we don't leave a blank page behind.
  let pageIndex = 0;
  if (config.includeSheets.cover) {
    onProgress?.({ phase: 'Scene cover', percent: 10 });
    drawCoverSheet(doc, config, sceneDimensions, font, logoBase64, logoFormat, hasOutfit);
    pageIndex = 1;
    // Next sheet (Contents) begins a new page.
    doc.addPage(pdfFormat, 'landscape');
  }
  // When cover is skipped the initial blank page becomes Contents —
  // no addPage() needed here, drawSceneContentsSheet renders onto it.

  // ── Page 2 (or 1 when cover skipped): scene contents & summary ───────
  onProgress?.({ phase: 'Scene contents', percent: 12 });
  const sceneTb = (title: string, dwgNum: string) => {
    drawTitleBlock(doc, config.projectInfo, title, dwgNum, hasOutfit, logoBase64, logoFormat, config.paperSize);
  };
  drawSceneContentsSheet(ctx, scene, inputs, sceneModel, sceneDimensions, config, sceneTb);
  pageIndex++;

  // ── Assembly inventory — drawing-to-assembly navigation index ───────
  // Project-wide table keyed by cabinet ref × assembly with colour
  // dots that match the ASSEMBLY LEGEND on the contents page and the
  // pills on each detail sheet. Skips cleanly when no cabinet has
  // confirmed assemblies (e.g. early-stage scenes).
  const hasAssemblies = inputs.some(inp => (inp.cabinet.assemblies ?? []).length > 0);
  if (hasAssemblies) {
    onProgress?.({ phase: 'Assembly inventory', percent: 13 });
    const inventoryRows = buildAssemblyInventoryRows(
      inputs.map((inp, i) => ({
        cabinetRef: `C${String(i + 1).padStart(2, '0')}`,
        cabinetLabel: inp.cabinet.cabinetCode || inp.cabinet.displayName || `Cabinet ${i + 1}`,
        assemblies: (inp.cabinet.assemblies ?? []).map(a => ({
          assemblyType: a.assemblyType,
          displayName: a.displayName,
          partCount: a.totalPartCount ?? (a.parts?.length ?? 0),
        })),
      })),
    );
    drawAssemblyInventorySheet(doc, config, inventoryRows, hasOutfit, logoBase64, logoFormat);
    pageIndex++;
  }

  const includeProjectSection = config.includeSheets.projectSection ?? true;
  const includeCabinetSection = config.includeSheets.cabinetSection ?? true;

  // ── Sub-cover: project drawings ──────────────────────────────────────
  // Skip both the sub-cover AND the consolidated drawings when the
  // user unticks "Project Summary" in the export dialog.
  if (includeProjectSection) {
    onProgress?.({ phase: 'Project section cover', percent: 14 });
    drawSubCoverSheet(
      doc, config, SHEET_NUMBERING.projectCover,
      'Project Drawings',
      [
        `${scene.name ?? 'Scene'} — consolidated arrangement`,
        'Scene-level isometric, elevations, plan & three-view',
      ],
      hasOutfit, logoBase64, logoFormat,
    );
    pageIndex++;
  }

  // ── Project section: consolidated arrangement ────────────────────────
  if (includeProjectSection) {
  onProgress?.({ phase: 'Project section', percent: 15 });
  const projectConfig: PrintPackageConfig = {
    ...config,
    includeSheets: {
      ...config.includeSheets,
      cover: false,              // scene cover already drawn
      // Detail/cut-list sheets are per-cabinet; project section shows
      // overview drawings only.
      partDetails: false,
      assemblyExploded: false,
      cutList: false,
    },
    sheetPrefix: 'P-',
    itemLabel: `${scene.name ?? 'Scene'} — Project`,
  };
  pageIndex = await appendCabinetSheets(
    ctx,
    sceneModel,
    [],
    projectConfig,
    scenePartTree,
    buildMeshCutListLinks(sceneModel, []),
    sceneDimensions,
    pageIndex,
    (p) => onProgress?.({
      phase: `Project: ${p.phase}`,
      percent: 15 + (p.percent / 100) * 20,
    }),
  );
  } // end of `if (includeProjectSection)`

  // ── Sub-cover: cabinet details ───────────────────────────────────────
  // Gate BOTH the sub-cover and the per-cabinet loop on the Cabinet
  // section flag — ticking "Cabinet Detail Pages" off skips the
  // whole block.
  if (includeCabinetSection && inputs.length > 0) {
    onProgress?.({ phase: 'Cabinets section cover', percent: 34 });
    const cabinetLabels = inputs
      .slice(0, 4)
      .map((inp, i) => inp.cabinet.cabinetCode || inp.cabinet.displayName || `Cabinet ${i + 1}`);
    const tail = inputs.length > 4 ? ` + ${inputs.length - 4} more` : '';
    drawSubCoverSheet(
      doc, config, SHEET_NUMBERING.cabinetsCover,
      `Cabinet Details — ${inputs.length} ${inputs.length === 1 ? 'cabinet' : 'cabinets'}`,
      [
        cabinetLabels.join(' · ') + tail,
        'Isometric, elevations, assembly exploded views & cut list per cabinet',
      ],
      hasOutfit, logoBase64, logoFormat,
    );
    pageIndex++;
  }

  // ── Per-cabinet sections ─────────────────────────────────────────────
  for (let i = 0; includeCabinetSection && i < inputs.length; i++) {
    const input = inputs[i];
    const basePct = 35 + (i / Math.max(inputs.length, 1)) * 60;
    const cabLabel = `${input.cabinet.cabinetCode ?? ''} ${input.cabinet.displayName ?? ''}`.trim()
      || `Cabinet ${i + 1}`;

    // Enable assembly / part-detail sheets per cabinet so confirmed
    // SceneAssemblies produce one detail page each (via buildDetailGroups).
    // Scene-level (P-) pages stay overview-only.
    const cabConfig: PrintPackageConfig = {
      ...config,
      includeSheets: {
        ...config.includeSheets,
        cover: false,
        partDetails: true,
        assemblyExploded: true,
        cutList: input.cutList.length > 0,
      },
      sheetPrefix: `C${String(i + 1).padStart(2, '0')}-`,
      itemLabel: cabLabel,
    };

    const innerProgress = (p: GenerationProgress) => {
      const slice = 60 / Math.max(inputs.length, 1);
      onProgress?.({
        phase: `[${i + 1}/${inputs.length}] ${cabLabel}: ${p.phase}`,
        percent: Math.min(95, basePct + (p.percent / 100) * slice),
      });
    };

    pageIndex = await appendCabinetSheets(
      ctx,
      input.model,
      input.cutList,
      cabConfig,
      input.partTree,
      input.meshLinks,
      input.dimensions,
      pageIndex,
      innerProgress,
      input.confirmedGroups,
    );
  }

  // ── Scene-level schedule sheets ──────────────────────────────────────
  // Render gallery, hardware schedule, finish schedule, architectural
  // plans — each gated on its includeSheets flag. Each block is fronted
  // by a sub-cover divider that mirrors the main cover styling so the
  // package reads as one coherent document rather than a concatenation.
  const cabinetsForRender = inputs.map(i => i.cabinet);

  const wantSchedulesBlock =
    (config.includeSheets.hardwareSchedule && !!schedules?.hardwareSchedule?.length)
    || (config.includeSheets.finishSchedule && !!schedules?.finishSchedule?.length);

  if (wantSchedulesBlock) {
    onProgress?.({ phase: 'Schedules cover', percent: 95 });
    const subtitleBits: string[] = [];
    if (config.includeSheets.hardwareSchedule && schedules?.hardwareSchedule?.length) {
      subtitleBits.push(`${schedules.hardwareSchedule.length} hardware rows`);
    }
    if (config.includeSheets.finishSchedule && schedules?.finishSchedule?.length) {
      subtitleBits.push(`${schedules.finishSchedule.length} finish rows`);
    }
    drawSubCoverSheet(
      doc, config, SHEET_NUMBERING.schedulesCover,
      'Schedules',
      [
        subtitleBits.join(' · '),
        'Hardware & ironmongery, finishes — sorted to items used in this project',
      ],
      hasOutfit, logoBase64, logoFormat,
    );
    pageIndex++;

    if (config.includeSheets.hardwareSchedule && schedules?.hardwareSchedule) {
      onProgress?.({ phase: 'Hardware schedule', percent: 96 });
      drawHardwareScheduleSheet(doc, config, schedules.hardwareSchedule, hasOutfit, logoBase64, logoFormat);
      pageIndex++;
    }
    if (config.includeSheets.finishSchedule && schedules?.finishSchedule) {
      onProgress?.({ phase: 'Finish schedule', percent: 97 });
      drawFinishScheduleSheet(doc, config, schedules.finishSchedule, hasOutfit, logoBase64, logoFormat);
      pageIndex++;
    }
  }

  if (config.includeSheets.renderGallery) {
    const rendersAvailable = cabinetsForRender.filter(c => c.renderUrl || c.thumbnailUrl);
    onProgress?.({ phase: 'Renders cover', percent: 97.5 });
    drawSubCoverSheet(
      doc, config, SHEET_NUMBERING.rendersCover,
      'Rendered Views',
      rendersAvailable.length > 0
        ? [`${rendersAvailable.length} cabinet render${rendersAvailable.length === 1 ? '' : 's'}`,
           'Product-catalog-quality visuals for client presentation']
        : 'No rendered images available for this scene yet',
      hasOutfit, logoBase64, logoFormat,
    );
    pageIndex++;

    onProgress?.({ phase: 'Render gallery', percent: 98 });
    await drawRenderGallerySheet(doc, config, cabinetsForRender, hasOutfit, logoBase64, logoFormat);
    pageIndex++;
  }

  if (config.includeSheets.architecturalPlans && schedules?.architecturalAssets?.length) {
    onProgress?.({ phase: 'Architectural cover', percent: 98.5 });
    drawSubCoverSheet(
      doc, config, SHEET_NUMBERING.architecturalCover,
      'Architectural Drawings',
      [
        architecturalSubtitle(schedules.architecturalAssets),
        'A-series drawings issued with this package',
      ],
      hasOutfit, logoBase64, logoFormat,
    );
    pageIndex++;

    onProgress?.({ phase: 'Architectural plans', percent: 99 });
    const added = await drawArchitecturalPlansSheets(
      doc, config, schedules.architecturalAssets, hasOutfit, logoBase64, logoFormat,
    );
    pageIndex += added;
  }

  onProgress?.({ phase: 'Complete', percent: 100 });
  return ctx.doc.output('blob');
}

/**
 * Scene-specific contents & summary page. Replaces the Quick View
 * `drawContentsSheet` (which is per-model and doesn't know about multiple
 * cabinets). Two-column layout on A3 landscape:
 *   LEFT COLUMN: project summary card + cabinet list with dwg refs
 *   RIGHT COLUMN: drawing index grouped by section (scene/project/per-cabinet)
 * The standard title block lives in the reserved right strip.
 */
function drawSceneContentsSheet(
  ctx: PackageContext,
  scene: DesignScene,
  inputs: SceneCabinetInput[],
  sceneModel: ParsedModel,
  sceneDimensions: DimensionSet,
  config: PrintPackageConfig,
  tb: (title: string, dwgNum: string) => void,
): void {
  const { doc, font } = ctx;
  tb('Scene Contents & Cabinet Index', SHEET_NUMBERING.contentsLegend);

  const navy = DF_BRAND_COLORS.navy;
  const muted = '#6B6B6B';
  const M = A3_DIMENSIONS.margin;
  // Title block occupies the right ~70mm; leave ~75mm for content region.
  const titleBlockW = 70;
  const contentW = A3_DIMENSIONS.width - 2 * M - titleBlockW - 4;
  const colGap = 10;
  const leftColW = Math.round(contentW * 0.45);
  const rightColW = contentW - leftColW - colGap;
  const leftX = M + 4;
  const rightX = leftX + leftColW + colGap;
  const topY = M + 8;

  // ── LEFT COLUMN ───────────────────────────────────────────────────────
  let ly = topY;

  // Heading
  doc.setFont(font, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(navy);
  doc.text('PROJECT SUMMARY', leftX, ly);
  ly += 3;
  doc.setDrawColor(DF_BRAND_COLORS.cashmere);
  doc.setLineWidth(0.6);
  doc.line(leftX, ly + 1, leftX + leftColW, ly + 1);
  ly += 7;

  const summaryRows: Array<[string, string]> = [
    ['Project', config.projectInfo.projectName || '—'],
    ['Scene', scene.name || '—'],
    ['Client', config.projectInfo.client || '—'],
    ['Cabinets', `${inputs.length}`],
    ['Overall', `${Math.round(sceneDimensions.overall.width)} × ${Math.round(sceneDimensions.overall.depth)} × ${Math.round(sceneDimensions.overall.height)} mm (W × D × H)`],
    ['Materials', `${new Set(sceneModel.objects.map(o => o.material).filter(Boolean)).size} used`],
    ['Components', `${sceneModel.objects.length} mesh objects`],
    ['Stage', config.projectInfo.stage || 'Issue for Review'],
    ['Revision', config.projectInfo.revision || 'A'],
    ['Date', config.projectInfo.date || ''],
  ];
  const labelW = 28;
  doc.setFontSize(8);
  for (const [label, value] of summaryRows) {
    doc.setFont(font, 'normal');
    doc.setTextColor(muted);
    doc.text(label.toUpperCase(), leftX, ly);
    doc.setFont(font, 'bold');
    doc.setTextColor(navy);
    const wrapped = doc.splitTextToSize(value, leftColW - labelW - 2) as string[];
    doc.text(wrapped, leftX + labelW, ly);
    ly += Math.max(5, wrapped.length * 4);
  }

  // Cabinets in this scene (full-width list under summary)
  ly += 6;
  doc.setFont(font, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(navy);
  doc.text('CABINETS IN THIS SCENE', leftX, ly);
  ly += 3;
  doc.line(leftX, ly + 1, leftX + leftColW, ly + 1);
  ly += 7;

  // Column headers
  doc.setFont(font, 'bold');
  doc.setFontSize(7);
  doc.setTextColor(muted);
  doc.text('REF', leftX, ly);
  doc.text('CODE', leftX + 12, ly);
  doc.text('CABINET', leftX + 40, ly);
  doc.text('DWGS', leftX + leftColW - 22, ly);
  ly += 4;
  doc.setDrawColor('#E0DED8');
  doc.setLineWidth(0.2);
  doc.line(leftX, ly - 1, leftX + leftColW, ly - 1);

  doc.setFont(font, 'normal');
  doc.setFontSize(8);
  doc.setTextColor('#2B2B2B');
  inputs.forEach((input, idx) => {
    const prefix = `C${String(idx + 1).padStart(2, '0')}`;
    const code = input.cabinet.cabinetCode ?? '—';
    const name = input.cabinet.displayName ?? '';
    doc.setTextColor(navy);
    doc.setFont(font, 'bold');
    doc.text(prefix, leftX, ly);
    doc.setFont(font, 'normal');
    doc.setTextColor('#2B2B2B');
    doc.text(code, leftX + 12, ly);
    const nameLines = doc.splitTextToSize(name, leftColW - 62) as string[];
    doc.text(nameLines, leftX + 40, ly);
    doc.setTextColor(muted);
    doc.setFontSize(7);
    doc.text(`${prefix}-I100…`, leftX + leftColW - 22, ly);
    doc.setFontSize(8);
    doc.setTextColor('#2B2B2B');
    ly += Math.max(5, nameLines.length * 4);
  });

  // ── Assembly legend — colour key for the (future) per-assembly
  // highlighting on isometric / detail sheets. Even without the colour-
  // coded edges it gives the recipient a quick read of which assembly
  // types the package contains + how many of each. Aggregates across
  // every cabinet's confirmed SceneAssembly[].
  const assemblyEntries = assemblyCountsAcross(
    inputs.map(input => input.cabinet.assemblies ?? []),
  );
  if (assemblyEntries.length > 0) {
    ly += 6;
    drawAssemblyLegend(doc, assemblyEntries, ctx.hasOutfit, {
      x: leftX,
      y: ly,
      width: leftColW,
      columns: 2,
    });
  }

  // ── RIGHT COLUMN: DRAWING INDEX ───────────────────────────────────────
  let ry = topY;
  doc.setFont(font, 'bold');
  doc.setFontSize(14);
  doc.setTextColor(navy);
  doc.text('DRAWING INDEX', rightX, ry);
  ry += 3;
  doc.setDrawColor(DF_BRAND_COLORS.cashmere);
  doc.setLineWidth(0.6);
  doc.line(rightX, ry + 1, rightX + rightColW, ry + 1);
  ry += 7;

  // Helper to render a section header + a list of (dwg, title)
  const drawSection = (header: string, rows: Array<[string, string]>) => {
    doc.setFont(font, 'bold');
    doc.setFontSize(9);
    doc.setTextColor(navy);
    doc.text(header, rightX, ry);
    ry += 4;
    doc.setDrawColor('#E0DED8');
    doc.setLineWidth(0.15);
    doc.line(rightX, ry - 1, rightX + rightColW, ry - 1);
    doc.setFontSize(8);
    for (const [num, title] of rows) {
      if (ry > A3_DIMENSIONS.height - M - 8) return;
      doc.setFont(font, 'bold');
      doc.setTextColor(navy);
      doc.text(num, rightX, ry);
      doc.setFont(font, 'normal');
      doc.setTextColor('#2B2B2B');
      const lines = doc.splitTextToSize(title, rightColW - 30) as string[];
      doc.text(lines, rightX + 30, ry);
      ry += Math.max(4.2, lines.length * 4);
    }
    ry += 3;
  };

  drawSection('SCENE', [
    ['I001', 'Scene Cover'],
    ['I002', 'Contents & Cabinet Index (this page)'],
  ]);

  const projectRows: Array<[string, string]> = [];
  if (config.includeSheets.isometricView) {
    projectRows.push(['P-I100', 'Project — Isometric SW']);
    projectRows.push(['P-I110', 'Project — Isometric NE']);
  }
  if (config.includeSheets.frontElevation) projectRows.push(['P-I101', 'Project — Front Elevation']);
  if (config.includeSheets.rearElevation)  projectRows.push(['P-I102', 'Project — Rear Elevation']);
  if (config.includeSheets.planView)       projectRows.push(['P-I103', 'Project — Plan View']);
  if (config.includeSheets.threeView)      projectRows.push(['P-I104', 'Project — Three-View']);
  drawSection('PROJECT (CONSOLIDATED SCENE)', projectRows);

  // Per-cabinet sections
  const perCabHeader = 'PER-CABINET SECTIONS';
  doc.setFont(font, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(navy);
  doc.text(perCabHeader, rightX, ry);
  ry += 4;
  doc.setDrawColor('#E0DED8');
  doc.setLineWidth(0.15);
  doc.line(rightX, ry - 1, rightX + rightColW, ry - 1);

  doc.setFontSize(8);
  inputs.forEach((input, idx) => {
    if (ry > A3_DIMENSIONS.height - M - 8) return;
    const prefix = `C${String(idx + 1).padStart(2, '0')}`;
    const code = input.cabinet.cabinetCode ?? '';
    const name = input.cabinet.displayName ?? '';
    doc.setFont(font, 'bold');
    doc.setTextColor(navy);
    doc.text(`${prefix}-I###`, rightX, ry);
    doc.setFont(font, 'normal');
    doc.setTextColor('#2B2B2B');
    const label = `${code ? code + ' — ' : ''}${name}`;
    const lines = doc.splitTextToSize(label, rightColW - 30) as string[];
    doc.text(lines, rightX + 30, ry);
    ry += Math.max(4.2, lines.length * 4);
  });
}
