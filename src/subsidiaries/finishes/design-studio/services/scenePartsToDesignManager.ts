/**
 * scenePartsToDesignManager — pure-TS converter from Design Studio's
 * rich `ScenePart` (per-cabinet authored parts that flow from 3D
 * parsing + AI assembly grouping) into Design Manager's `PartEntry`
 * (procurement-facing, inventory-aware, hand-curated in PartsTab).
 *
 * **Design Studio is the primary merge surface for parts + CSV.** After a
 * model upload, mesh-derived `ScenePart`s hold geometry-linked context; an
 * optional `partsCsvOverlay` (scene- or cabinet-level) is matched to those
 * parts in `scenePartToPartEntry`. Where a CSV row matches, it is treated as
 * authoritative for fabrication (dims, grain, edge banding, material label)
 * while the GLB/mesh remains authoritative for identity, `meshNodeId`, and
 * anything not overridden by the row. That merged result is what sync pushes
 * to Design Manager — DM does not re-merge CSV against meshes for
 * scene-origin rows. `PartEntry.partNumber` is always the batch-generated
 * code from `nameSceneAssemblyParts`, not `ScenePart.partCode`.
 * For material, a matched CSV row supplies `materialName` and/or
 * `materialCode`; scene `materialDescription` is not used when it only
 * duplicates the part name (a common mesh artefact).
 * Each `ScenePart.id` is emitted at most once per cabinet so the same
 * mesh is not synced twice when it appears under more than one assembly.
 *
 * **CSV row consumption:** the overlay matches one `ScenePart` per row
 * in order; additional meshes for the *same* cut can appear as a second
 * line (mesh GLB) until `consolidateMeshCsvOrphanMates` fuses a clearly
 * CSV-fabrication row with a much poorer, name-similar twin at the
 * same L×W×T.
 *
 * Also provides `mergeCabinetPartsForItem(cabinets)` which gathers
 * parts across every cabinet in a scene, dedupes identical parts
 * (same number + material + dimensions) and sums their quantities.
 * That's the form the sync orchestrator pushes into
 * `DesignItem.parts` via `partsSyncService.syncPartsToDesignItem`.
 *
 * Pure — no Firestore, no React, no Three.js. Unit-tested below.
 */
import { Timestamp } from 'firebase/firestore';
import type {
  PartEntry,
  PartSource,
  PartEdgeBanding,
  GrainDirection,
} from '@/modules/design-manager/types';
import type { SceneCabinet } from '../types/scene.types';
import type { ScenePart } from '../types/assembly.types';
import type { PartCategory } from '../constants/assembly.constants';
import { getCabinetRequiredQuantity } from '../utils/cabinetQuantity';
import type { ScenePartsCsvOverlay } from '../types/scene.types';
import {
  canonicalPartCode,
  compactPartDisplayName,
  inferPositionFromPartLabels,
  inferRoleFromPartLabels,
  inferRoleFromCategory,
  type CanonicalNameResult,
} from './partNamingService';
import { textFallbackLwt } from './partsQualityHelper';
import { nameSceneAssemblyParts } from './sceneAssemblyNaming';

type CsvRow = ScenePartsCsvOverlay['rows'][number];

/** True when a string is the same as the part’s name/code (mesh often echoes the label as “material”). */
function isSceneMaterialSameAsPartLabel(raw: string | undefined, sp: ScenePart): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return true;
  const name = (sp.partName ?? '').trim().toLowerCase();
  const code = (sp.partCode ?? '').trim().toLowerCase();
  return v === name || (code.length > 0 && v === code);
}

/**
 * `PartEntry.materialName`: CSV material column is authoritative when a row matches.
 * Uses {@link CsvRow.materialCode} when the material name cell is empty. Scene
 * `materialDescription` / `inventoryItemName` are only used when they are not
 * the same as the part name (a common bad mesh default).
 */
function resolvePartEntryMaterialName(sp: ScenePart, csvRow: CsvRow | undefined): string {
  if (csvRow) {
    const fromCsv =
      (csvRow.materialName ?? '').trim() || (csvRow.materialCode ?? '').trim();
    if (fromCsv) return fromCsv;
    const md = (sp.materialDescription ?? '').trim();
    if (md && !isSceneMaterialSameAsPartLabel(md, sp)) return md;
    const inv = (sp.inventoryItemName ?? '').trim();
    if (inv && !isSceneMaterialSameAsPartLabel(inv, sp)) return inv;
    return '';
  }
  const md = (sp.materialDescription ?? '').trim();
  if (md && !isSceneMaterialSameAsPartLabel(md, sp)) return md;
  const inv = (sp.inventoryItemName ?? '').trim();
  if (inv && !isSceneMaterialSameAsPartLabel(inv, sp)) return inv;
  return '';
}

/**
 * Stateful lookup that matches a ScenePart against a CSV overlay using
 * three strategies, in descending priority:
 *
 *   1. **Exact name** (lowercased + whitespace-collapsed). Covers the
 *      happy path where GLB mesh names were exported from the same
 *      tool that produced the CSV.
 *
 *   2. **Token overlap**. Both names tokenize on whitespace / `_` /
 *      `-` / camelCase boundaries; a CSV row wins when ≥50% of its
 *      non-trivial tokens appear in the part name (or vice versa).
 *      Handles "Side_L_01" → "Left Side", "Shelf 2" → "shelf_02".
 *
 *   3. **Dimensions** (±5 mm on every axis). Last-resort match when
 *      the names have drifted entirely — the CSV row with the
 *      closest L/W/T still wins so a PolyBoard cutlist drives the
 *      fabrication spec regardless of naming conventions.
 *
 * Matched rows are consumed — one CSV row satisfies one ScenePart so
 * duplicates in the model don't all grab the same row. Callers use
 * `getMatchReport()` after a sync for UI diagnostics.
 */
export interface CsvLookup {
  match: (
    part: Pick<ScenePart, 'partName' | 'dimensions' | 'materialDescription' | 'inventoryItemName'>,
  ) => CsvRow | undefined;
  getMatchReport: () => {
    totalRows: number;
    matchedRows: number;
    byExactName: number;
    byTokens: number;
    byDimensions: number;
    unmatchedRowNames: string[];
  };
}

const DIM_TOLERANCE_MM = 5;
const TOKEN_OVERLAP_THRESHOLD = 0.5;

function tokenize(s: string): string[] {
  return (s || '')
    .toLowerCase()
    // Split on non-alphanumerics AND on the gap between an uppercase
    // letter following a lowercase one so "SideLeft" -> ["side","left"].
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^a-z0-9]+/i)
    .filter(t => t.length > 1 && !/^\d+$/.test(t)); // drop tiny tokens + pure indices
}

function tokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const shared = a.filter(t => setB.has(t)).length;
  return shared / Math.min(a.length, b.length);
}

function normalizeMaterialTokens(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .toLowerCase()
    // Remove plain "18mm"/"2mm" style thickness tags from comparison.
    .replace(/\b\d+(?:\.\d+)?\s*mm\b/g, ' ')
    .replace(/[^\w]+/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !/^\d+$/.test(t));
}

function materialSimilarity(
  part: Pick<ScenePart, 'materialDescription' | 'inventoryItemName'>,
  row: CsvRow,
): number {
  const partTokens = normalizeMaterialTokens(
    [part.materialDescription, part.inventoryItemName].filter(Boolean).join(' '),
  );
  const rowTokens = normalizeMaterialTokens(
    [row.materialName, row.materialCode].filter(Boolean).join(' '),
  );
  return tokenOverlap(partTokens, rowTokens);
}

function dimsDistance(
  a: { length: number; width: number; thickness: number } | undefined,
  b: { length: number; width: number; thickness: number },
): number {
  if (!a) return Infinity;
  const dL = Math.abs((a.length ?? 0) - (b.length ?? 0));
  const dW = Math.abs((a.width ?? 0) - (b.width ?? 0));
  const dT = Math.abs((a.thickness ?? 0) - (b.thickness ?? 0));
  // Reject if any single axis is way off even if total is low.
  if (dL > DIM_TOLERANCE_MM || dW > DIM_TOLERANCE_MM || dT > DIM_TOLERANCE_MM) {
    return Infinity;
  }
  return dL + dW + dT;
}

export function buildCsvLookup(overlay: ScenePartsCsvOverlay | undefined): CsvLookup {
  const rows: CsvRow[] = overlay?.rows ?? [];
  const exactByName = new Map<string, number[]>();
  const tokensByRow: string[][] = rows.map(r => tokenize(r.name));
  rows.forEach((r, i) => {
    const key = (r.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!key) return;
    const list = exactByName.get(key) ?? [];
    list.push(i);
    exactByName.set(key, list);
  });

  const consumed = new Set<number>();
  let hitExact = 0, hitTokens = 0, hitDims = 0;

  const match = (
    part: Pick<ScenePart, 'partName' | 'dimensions' | 'materialDescription' | 'inventoryItemName'>,
  ): CsvRow | undefined => {
    const name = (part.partName || '').trim().toLowerCase().replace(/\s+/g, ' ');

    // 1. exact name
    const exactCandidates = (exactByName.get(name) ?? []).filter(i => !consumed.has(i));
    if (exactCandidates.length > 0) {
      let bestExactIdx = exactCandidates[0]!;
      let bestExactScore = -Infinity;
      for (const i of exactCandidates) {
        const row = rows[i]!;
        const matScore = materialSimilarity(part, row);
        const dimDist = dimsDistance(part.dimensions, row);
        const dimScore = dimDist === Infinity ? 0 : 1 / (1 + dimDist);
        const total = matScore * 2 + dimScore;
        if (total > bestExactScore) {
          bestExactScore = total;
          bestExactIdx = i;
        }
      }
      consumed.add(bestExactIdx);
      hitExact++;
      return rows[bestExactIdx];
    }

    // 2. token overlap
    const partTokens = tokenize(part.partName);
    let bestTokenIdx = -1;
    let bestTokenScore = 0;
    for (let i = 0; i < rows.length; i++) {
      if (consumed.has(i)) continue;
      const row = rows[i]!;
      const tokenScore = tokenOverlap(partTokens, tokensByRow[i]);
      const matScore = materialSimilarity(part, row);
      const dimDist = dimsDistance(part.dimensions, row);
      const dimScore = dimDist === Infinity ? 0 : 1 / (1 + dimDist);
      // Prefer strongest name hit first; material/dims break ties.
      const score = tokenScore * 10 + matScore * 2 + dimScore;
      if (score > bestTokenScore) {
        bestTokenScore = score;
        bestTokenIdx = i;
      }
    }
    if (bestTokenIdx >= 0 && (bestTokenScore / 10) >= TOKEN_OVERLAP_THRESHOLD) {
      consumed.add(bestTokenIdx);
      hitTokens++;
      return rows[bestTokenIdx];
    }

    // 3. dimensions
    if (part.dimensions) {
      let bestDimIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < rows.length; i++) {
        if (consumed.has(i)) continue;
        const row = rows[i]!;
        const d = dimsDistance(part.dimensions, row);
        if (d < bestDist) {
          bestDist = d;
          bestDimIdx = i;
        } else if (d === bestDist && d !== Infinity && bestDimIdx >= 0) {
          const prev = rows[bestDimIdx]!;
          if (materialSimilarity(part, row) > materialSimilarity(part, prev)) {
            bestDimIdx = i;
          }
        }
      }
      if (bestDimIdx >= 0 && bestDist !== Infinity) {
        consumed.add(bestDimIdx);
        hitDims++;
        return rows[bestDimIdx];
      }
    }

    return undefined;
  };

  const getMatchReport = () => ({
    totalRows: rows.length,
    matchedRows: consumed.size,
    byExactName: hitExact,
    byTokens: hitTokens,
    byDimensions: hitDims,
    unmatchedRowNames: rows
      .map((r, i) => ({ r, i }))
      .filter(({ i }) => !consumed.has(i))
      .map(({ r }) => r.name),
  });

  return { match, getMatchReport };
}

/** Scene part categories → Design Manager part types.
 *  `panel` covers carcase / door / drawer fronts — all sheet goods.
 *  `edge_band`, `hardware`, `fastener`, `fitting` are bought-out
 *  components. `finish_consumable` + `packaging` don't really belong
 *  in PartsTab, but we include them for traceability; procurement
 *  can filter them out if desired. */
function partCategoryToPartType(cat: PartCategory | undefined): NonNullable<PartEntry['partType']> {
  switch (cat) {
    case 'panel':
      return 'sheet';
    case 'edge_band':
      return 'bar';
    case 'hardware':
    case 'fastener':
    case 'fitting':
    case 'finish_consumable':
    case 'packaging':
      return 'component';
    default:
      return 'sheet';
  }
}

type SceneGrainDirection = NonNullable<ScenePart['dimensions']>['grainDirection'];

function toGrainDirection(dir: SceneGrainDirection | undefined): GrainDirection {
  // ScenePart's dimension.grainDirection is 'length' | 'width' | 'none'
  // — a superset of GrainDirection. Narrow with a pass-through since
  // the two unions are identical today.
  return (dir ?? 'none') as GrainDirection;
}

/** Deterministic 1..90 sequence for canonical part codes when batch naming is unavailable. */
function sequenceFromPartId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 90) + 1;
}

function parseThicknessMm(...candidates: Array<string | undefined>): number | undefined {
  for (const raw of candidates) {
    if (!raw) continue;
    const match = raw.match(/(\d+(?:\.\d+)?)\s*mm\b/i);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

function firstPositive(...values: Array<number | undefined>): number {
  for (const v of values) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

function fallbackDimsFromQuality(sp: ScenePart): { length: number; width: number; thickness: number } | undefined {
  const quality = sp.dimensionQuality;
  if (quality?.obb) return quality.obb;
  if (quality?.aabb) return quality.aabb;
  return undefined;
}

function inferPartType(
  category: PartCategory | undefined,
  materialName: string,
  partName: string,
  length: number,
  width: number,
  thickness: number,
): NonNullable<PartEntry['partType']> {
  if (category === 'edge_band') return 'bar';
  if (
    category === 'hardware'
    || category === 'fastener'
    || category === 'fitting'
    || category === 'finish_consumable'
    || category === 'packaging'
  ) {
    return 'component';
  }

  const haystack = `${materialName} ${partName}`.toLowerCase();
  if (/\b(fabric|upholstery|upholster|leather|vinyl)\b/.test(haystack)) return 'fabric';
  if (/\b(stone|granite|quartz|marble|terrazzo)\b/.test(haystack)) return 'slab';
  if (
    /\b(timber|hardwood|softwood|pine|mahogany|teak|stile|rail|batten|lumber)\b/.test(haystack)
    && length > 0
    && (width > 0 || thickness > 0)
  ) {
    return 'timber';
  }
  if (length <= 0 && width <= 0 && thickness <= 0) {
    // Missing bbox/text dims: do **not** default to `component` — that
    // misroutes normal millwork to the Parts tab / cutlist "Components"
    // bucket. Hardware-like categories are handled above. Otherwise follow
    // scene category (panel → sheet) or `sheet` by default.
    return partCategoryToPartType(category);
  }
  return partCategoryToPartType(category);
}

/** Build rich per-edge entries from a CSV overlay row's boolean edge flags. */
function buildCsvRichEdges(
  csv: { top: boolean; bottom: boolean; left: boolean; right: boolean; material?: string },
  partLength: number,
  partWidth: number,
  material?: string,
): PartEdgeBanding['edges'] | undefined {
  const edges: PartEdgeBanding['edges'] = {};
  const mat = material || undefined;
  if (csv.top) edges.top = { material: mat, length: partLength || undefined };
  if (csv.bottom) edges.bottom = { material: mat, length: partLength || undefined };
  if (csv.left) edges.left = { material: mat, length: partWidth || undefined };
  if (csv.right) edges.right = { material: mat, length: partWidth || undefined };
  return Object.keys(edges).length > 0 ? edges : undefined;
}

function toEdgeBanding(band: ScenePart['edgeBanding']): PartEdgeBanding {
  // ScenePart stores `{ top: { type, length } | null }`; PartEntry wants
  // booleans + an optional material reference. We keep the material
  // of the FIRST non-null edge as the representative material (edge
  // banding rarely mixes materials across a single part).
  //
  // P1.1: now also populates the rich `edges` map with per-edge
  // material + length so downstream consumers can access full fidelity.
  const b = band ?? {
    top: null, bottom: null, left: null, right: null, front: null,
  };
  const firstWithType =
    b.top ?? b.bottom ?? b.left ?? b.right ?? b.front ?? null;

  const toRichEdge = (edge: { type: string; length: number } | null | undefined) => {
    if (!edge) return undefined;
    return {
      material: edge.type || undefined,
      length: edge.length || undefined,
    };
  };

  const edges: PartEdgeBanding['edges'] = {};
  if (b.top) edges.top = toRichEdge(b.top);
  if (b.bottom) edges.bottom = toRichEdge(b.bottom);
  if (b.left) edges.left = toRichEdge(b.left);
  if (b.right) edges.right = toRichEdge(b.right);
  if (b.front) edges.front = toRichEdge(b.front);

  const out: PartEdgeBanding = {
    top: !!b.top,
    bottom: !!b.bottom,
    left: !!b.left,
    right: !!b.right,
    front: !!b.front,
    edges: Object.keys(edges).length > 0 ? edges : undefined,
  };
  if (firstWithType?.type) out.material = firstWithType.type;
  return out;
}

/**
 * Convert a single cabinet's assembled parts into PartEntry form.
 * `now` injected so tests + merge flows can share the same timestamp
 * across a write batch (keeps audit stamps consistent).
 */
export function sceneCabinetToDesignManagerParts(
  cabinet: SceneCabinet,
  now: Timestamp = Timestamp.now(),
  csvLookup?: CsvLookup,
): PartEntry[] {
  const out: PartEntry[] = [];
  const cabinetMultiplier = getCabinetRequiredQuantity(cabinet);
  const namingByPartId = new Map<string, CanonicalNameResult>();
  for (const assembly of cabinet.assemblies ?? []) {
    const batch = nameSceneAssemblyParts(
      assembly.parts ?? [],
      cabinet.cabinetCode,
      assembly.assemblyCode,
    );
    for (const [id, result] of batch) {
      if (!namingByPartId.has(id)) {
        namingByPartId.set(id, result);
      }
    }
  }
  const seenScenePartId = new Set<string>();
  for (const assembly of cabinet.assemblies ?? []) {
    for (const sp of assembly.parts ?? []) {
      if (sp.id) {
        if (seenScenePartId.has(sp.id)) continue;
        seenScenePartId.add(sp.id);
      }
      out.push(scenePartToPartEntry(
        sp,
        cabinet.sceneId,
        now,
        cabinetMultiplier,
        csvLookup,
        cabinet.cabinetCode,
        assembly.assemblyCode,
        namingByPartId,
      ));
    }
  }
  return out;
}

function scenePartToPartEntry(
  sp: ScenePart,
  sceneId: string | undefined,
  now: Timestamp,
  cabinetMultiplier: number,
  csvLookup?: CsvLookup,
  cabinetCode?: string,
  assemblyCode?: string,
  assemblyNaming?: Map<string, CanonicalNameResult>,
): PartEntry {
  const qualityDims = fallbackDimsFromQuality(sp);
  const dims = sp.dimensions
    ?? (qualityDims
      ? {
          length: qualityDims.length,
          width: qualityDims.width,
          thickness: qualityDims.thickness,
          grainDirection: 'none' as const,
        }
      : { length: 0, width: 0, thickness: 0, grainDirection: 'none' as const });

  // CSV overlay — when the scene has an uploaded cutlist, the stateful
  // matcher picks the best unused row via exact-name → token-overlap
  // → dimensions fallback. CSV is authoritative for fabrication
  // because GLB bbox numbers include hardware envelopes while the
  // cutlist carries exact cut dimensions.
  const csvRow = csvLookup?.match(sp);

  const geomLength = firstPositive(dims.length, qualityDims?.length);
  const geomWidth = firstPositive(dims.width, qualityDims?.width);
  const geomThickness = firstPositive(dims.thickness, qualityDims?.thickness);
  const allowTextFallback = !csvRow && geomLength <= 0 && geomWidth <= 0;
  const textDims = allowTextFallback ? textFallbackLwt(sp) : { length: 0, width: 0, thickness: 0 };

  const length = firstPositive(
    csvRow?.length,
    geomLength,
    textDims.length > 0 ? textDims.length : undefined,
  );
  const width = firstPositive(
    csvRow?.width,
    geomWidth,
    textDims.width > 0 ? textDims.width : undefined,
  );
  const csvMaterialString = csvRow
    ? (csvRow.materialName ?? '').trim() || (csvRow.materialCode ?? '').trim()
    : '';
  const parsedThickness = !csvRow && geomThickness <= 0
    ? parseThicknessMm(
        csvMaterialString || undefined,
        sp.materialDescription,
        sp.inventoryItemName,
        sp.notes,
      )
    : undefined;
  const thickness = firstPositive(
    csvRow?.thickness,
    geomThickness,
    parsedThickness,
    textDims.thickness > 0 ? textDims.thickness : undefined,
  );
  const materialName = resolvePartEntryMaterialName(sp, csvRow);
  const grain: GrainDirection = csvRow?.grainDirection
    ?? toGrainDirection(dims.grainDirection);

  const edgeBanding: PartEdgeBanding = csvRow?.edgeBanding
    ? {
        top: !!csvRow.edgeBanding.top,
        bottom: !!csvRow.edgeBanding.bottom,
        left: !!csvRow.edgeBanding.left,
        right: !!csvRow.edgeBanding.right,
        ...(csvRow.edgeBanding.material ? { material: csvRow.edgeBanding.material } : {}),
        // P1.1: populate rich per-edge data from CSV overlay
        edges: buildCsvRichEdges(csvRow.edgeBanding, length, width, csvRow.edgeBanding.material),
      }
    : toEdgeBanding(sp.edgeBanding);

  // Roles: explicit AI/authoring, then label heuristics (PolyBoard), then category.
  const fromLabelRole = inferRoleFromPartLabels(sp.partName, sp.partCode);
  const fromLabelPos = inferPositionFromPartLabels(sp.partName, sp.partCode);
  const role = sp.role ?? fromLabelRole ?? inferRoleFromCategory(sp.partCategory);
  const position = sp.relativePosition ?? fromLabelPos;
  const named = assemblyNaming?.get(sp.id);
  // Design Manager always uses batch-generated codes (cabinet + assembly + role/sequence),
  // not raw mesh/PolyBoard partCode strings — so Shop Traveler and DM stay aligned.
  const partNumber = named?.partCode
    ?? canonicalPartCode({
        role,
        position: sp.relativePosition ?? fromLabelPos,
        sequence: sequenceFromPartId(sp.id),
        cabinetCode: cabinetCode || sp.cabinetId?.slice(0, 6),
        assemblyCode,
      });
  // DM Name field should carry the scene-authored part label when present.
  // This keeps DS -> DM naming aligned and avoids compact-code aliases.
  const sceneAuthoredName = (sp.partName ?? '').trim();
  const name = sceneAuthoredName
    || named?.displayName
    || named?.compactName
    || compactPartDisplayName({ role, position: position ?? undefined, sequence: 1, peerCount: 1 });
  const partType = csvRow?.partType
    ?? inferPartType(sp.partCategory, materialName, name, length, width, thickness);

  return {
    id: sp.id,
    partNumber,
    name,
    partType,
    length,
    width,
    thickness,
    materialId: sp.finishLibraryId,
    materialName,
    materialCode: csvRow?.materialCode,
    inventoryItemId: sp.inventoryItemId || undefined,
    // Multiply by the cabinet's requiredQuantity — one SceneCabinet can
    // represent N physical units, and procurement needs to see the
    // multiplied figures on the DesignItem parts list.
    quantity: (csvRow?.quantity ?? sp.quantity ?? 1) * cabinetMultiplier,
    grainDirection: grain,
    edgeBanding,
    hasCNCOperations: !!sp.boringSpec,
    boringSpec: sp.boringSpec,
    notes: csvRow?.notes ?? sp.notes,
    barProfile: csvRow?.barProfile,
    source: 'design-studio' as PartSource,
    createdAt: now,
    updatedAt: now,
    // Back-links to the 3D model so (a) re-syncs don't create duplicates
    // and (b) Design Studio's material resolver can look up "what
    // material does DM say this mesh is?" for any procurement-authored
    // finish override.
    meshNodeId: sp.meshNodeId,
    cabinetId: sp.cabinetId,
    sceneId,
  };
}

/**
 * Key used by `mergeCabinetPartsForItem` to decide two PartEntries
 * are the same thing (sum quantities) vs distinct (keep both).
 *
 * When `meshNodeId` is present we key on it directly — a mesh IS
 * a unique physical panel, so any two PartEntries sharing a mesh
 * are the same part surfacing twice (e.g. re-synced after an edit).
 * Falls back to partNumber + material + dimensions for CSV-imported
 * parts that predate the meshNodeId roundtrip.
 *
 * (We do **not** key on `PartEntry.id` here: two real panels of the
 * same type in two cabinets can share a part number but have different
 * `ScenePart.id` values. Sparse-vs-CSV “ghost” rows are handled by
 * `consolidateSparseSceneDuplicates` after the map merge.)
 */
function dedupKey(p: PartEntry): string {
  if (p.meshNodeId) return `mesh:${p.meshNodeId}`;
  return [
    'attr',
    p.partNumber,
    p.inventoryItemId ?? p.materialId ?? '',
    Math.round(p.length),
    Math.round(p.width),
    Math.round(p.thickness),
  ].join('|');
}

/** Heuristic: CSV / fabrication context vs GLB-only row (ignore mesh grain for this). */
function scenePartEntryRichness(p: PartEntry): number {
  const mat = (p.materialName ?? '').trim() || (p.materialCode ?? '').trim();
  let s = 0;
  if (mat) s += 4;
  const eb = p.edgeBanding;
  if (eb) {
    if (eb.top || eb.bottom || eb.left || eb.right || eb.front) s += 2;
    if (eb.edges && Object.keys(eb.edges).length > 0) s += 1;
  }
  return s;
}

/** Token overlap on the DM `name` field (not PolyBoard partName). */
function partEntryNameTokenOverlap(a: PartEntry, b: PartEntry): number {
  return tokenOverlap(tokenize(a.name), tokenize(b.name));
}

const DIM_DUP_TOL_MM = 2;
/** Treat as "has size" if any GLB/CSV axis resolved to a real mm value. */
const DIM_MIN_MEANINGFUL_MM = 0.5;

function hasMeaningfulPanelDims(p: PartEntry): boolean {
  const l = p.length ?? 0;
  const w = p.width ?? 0;
  const t = p.thickness ?? 0;
  // Thickness alone (often inferred from a material name like "Oak 18mm" when
  // L×W are still 0) is not an in-plane cut — same situation as 0×0×0 for
  // `consolidateMeshCsvOrphanMates` mesh/CSV twin pairing.
  if (l <= DIM_MIN_MEANINGFUL_MM && w <= DIM_MIN_MEANINGFUL_MM) {
    return false;
  }
  return l > DIM_MIN_MEANINGFUL_MM || w > DIM_MIN_MEANINGFUL_MM || t > DIM_MIN_MEANINGFUL_MM;
}

function nearSameDims(
  a: { length: number; width: number; thickness: number },
  b: { length: number; width: number; thickness: number },
): boolean {
  return (
    Math.abs((a.length ?? 0) - (b.length ?? 0)) <= DIM_DUP_TOL_MM
    && Math.abs((a.width ?? 0) - (b.width ?? 0)) <= DIM_DUP_TOL_MM
    && Math.abs((a.thickness ?? 0) - (b.thickness ?? 0)) <= DIM_DUP_TOL_MM
  );
}

/**
 * Pairs the mesh that never got bbox/CSV L×W×T (0×0×0) with a sibling row
 * that has fabrication dimensions. `nearSameDims` alone would always fail.
 * When part numbers already match, we trust the non-empty side as the cut.
 * Otherwise require strong name token overlap.
 */
function dimsCompatibleForMerge(
  a: PartEntry,
  b: PartEntry,
  nameOvlIfDifferentPartNo: number,
): boolean {
  const ha = hasMeaningfulPanelDims(a);
  const hb = hasMeaningfulPanelDims(b);
  if (ha && hb) return nearSameDims(a, b);
  if (!ha && !hb) return true;
  const samePn = (a.partNumber ?? '') === (b.partNumber ?? '') && (a.partNumber ?? '') !== '';
  if (samePn) return true;
  return partEntryNameTokenOverlap(a, b) >= nameOvlIfDifferentPartNo;
}

/**
 * When two “copies” of the same real panel are emitted (e.g. one matched
 * a CSV row with material/edges, one fell through with mesh-only dims so
 * `dedupKey` differed: mesh vs attr, or different rounded lengths), collapse
 * to a single PartEntry, prefer the richer one, and sum quantities.
 */
function shouldLinkSparseDup(a: PartEntry, b: PartEntry): boolean {
  // Same `ScenePart.id` (duplicate rows for that mesh): merge when L×W×T are
  // compatible, including 0×0×0 vs CSV-filled — but not e.g. 18mm vs 22mm, and
  // not when two cabs use the test default `id: 'p1'` for different parts.
  if (a.id && b.id && a.id === b.id && dimsCompatibleForMerge(a, b, 0.45)) return true;
  if (a.meshNodeId && b.meshNodeId && a.meshNodeId === b.meshNodeId) return true;
  const samePn = (a.partNumber ?? '') === (b.partNumber ?? '') && (a.partNumber ?? '') !== '';
  if (!samePn || !dimsCompatibleForMerge(a, b, 0.45)) return false;
  // Two GLB mesh nodes for the same cut part: same code + size, different
  // `meshNodeId` — may both be CSV-matched, so the sparse vs rich check must
  // not block the link (otherwise duplicate rows reach DM with count N×).
  if (a.meshNodeId && b.meshNodeId && a.meshNodeId !== b.meshNodeId) return true;
  const ra = scenePartEntryRichness(a);
  const rb = scenePartEntryRichness(b);
  if (ra === 0 && rb === 0) return false;
  if (ra > 0 && rb > 0) return false;
  return true;
}

/**
 * When several scene cabinets are bound to the same Design Item (e.g. four
 * night stands in one run), each instance has its own `meshNodeId` and
 * part numbers that differ only by the first segment (cabinet code, e.g.
 * `NS1-CARC-…` vs `NS2-CARC-…`). The mesh-level dedup pass intentionally
 * keeps them separate, which inflates the written row count to N ×
 * (parts per unit) instead of a single line-item BOM with higher quantity.
 *
 * This pass collapses rows that are the same *product* part: identical
 * structural code (part number with leading cabinet segment removed) and
 * same fabrication spec (L/W/T + material), summing `quantity` and
 * preferring the richer (CSV) row.
 */
function consolidateProductInstancesAcrossCabinets(parts: PartEntry[]): PartEntry[] {
  if (parts.length < 2) return parts;
  const keyOf = (p: PartEntry): string | null => {
    const pn = (p.partNumber ?? '').trim();
    if (!pn || !pn.includes('-')) return null;
    const segs = pn.split('-');
    if (segs.length < 2) return null;
    // `canonicalPartCode` is `{cabinet}-{assembly}-{role+pos+seq}`. Stipping
    // the first token only for 3+ segments avoids turning `A1-SPL01` into
    // `SPL01` and merging unrelated parts. Two-segment codes have no leading
    // cabinet; use the full part number for the structural slice.
    const structuralSlice = segs.length >= 3 ? segs.slice(1).join('-') : pn;
    // Align with `dedupKey` attr branch: inventory + material identity must
    // not collapse when the first merge pass kept rows separate.
    const invOrMat = (p.inventoryItemId ?? p.materialId ?? '').trim();
    return [
      structuralSlice,
      Math.round(p.length ?? 0),
      Math.round(p.width ?? 0),
      Math.round(p.thickness ?? 0),
      (p.materialName ?? '').trim().toLowerCase(),
      invOrMat,
    ].join('|');
  };
  const buckets = new Map<string, PartEntry[]>();
  const unkeyed: PartEntry[] = [];
  for (const p of parts) {
    const k = keyOf(p);
    if (!k) {
      unkeyed.push(p);
      continue;
    }
    const list = buckets.get(k) ?? [];
    list.push(p);
    buckets.set(k, list);
  }
  const out: PartEntry[] = [];
  for (const group of buckets.values()) {
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    let best = group[0]!;
    let bestScore = scenePartEntryRichness(best);
    for (const p of group.slice(1)) {
      const s = scenePartEntryRichness(p);
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    const qty = group.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
    out.push({ ...best, quantity: qty });
  }
  return [...out, ...unkeyed];
}

/**
 * `buildCsvLookup` / AI pairing assigns each CSV row to at most one
 * `ScenePart`. A second mesh with the same cut (same or similar name,
 * same L×W×T) then ships as a **separate** line with mesh-only
 * fabrication context — the usual reason counts exceed the cut list.
 * Collapse one **clearly CSV-rich** row with a **sibling** row that is
 * much poorer when names still overlap on tokens; when one side has no
 * bbox/CSV dimensions (0×0×0), `nearSameDims` is not used alone — see
 * `dimsCompatibleForMerge`.
 */
const MESH_CSV_TWIN_NAME_OVERLAP = 0.35;
const MESH_CSV_TWIN_RICHNESS_GAP = 2;

function consolidateMeshCsvOrphanMates(parts: PartEntry[]): PartEntry[] {
  const n = parts.length;
  if (n < 2) return parts;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]!);
    return parent[i]!;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = parts[i]!;
      const b = parts[j]!;
      if (!dimsCompatibleForMerge(a, b, MESH_CSV_TWIN_NAME_OVERLAP)) continue;
      const ra = scenePartEntryRichness(a);
      const rb = scenePartEntryRichness(b);
      const hda = hasMeaningfulPanelDims(a);
      const hdb = hasMeaningfulPanelDims(b);
      const oneNoBBox = !hda || !hdb;
      const strongSplit = Math.abs(ra - rb) >= MESH_CSV_TWIN_RICHNESS_GAP;
      // Mesh ghost (no L×W×T) can sit at a similar "richness" to mesh-only; still
      // prefer merging with a CSV-sibling by name.
      const ghostWithCsvSibling = oneNoBBox
        && Math.max(ra, rb) >= 2
        && partEntryNameTokenOverlap(a, b) >= MESH_CSV_TWIN_NAME_OVERLAP;
      if (!strongSplit && !ghostWithCsvSibling) continue;
      union(i, j);
    }
  }
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    const g = byRoot.get(r) ?? [];
    g.push(i);
    byRoot.set(r, g);
  }
  const out: PartEntry[] = [];
  for (const idxs of byRoot.values()) {
    const group = idxs.map(i => parts[i]!);
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    let best = group[0]!;
    let bestScore = scenePartEntryRichness(best);
    for (const p of group.slice(1)) {
      const s = scenePartEntryRichness(p);
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    const qty = group.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
    out.push({ ...best, quantity: qty });
  }
  return out;
}

function consolidateSparseSceneDuplicates(parts: PartEntry[]): PartEntry[] {
  const n = parts.length;
  if (n < 2) return parts;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]!);
    return parent[i]!;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (shouldLinkSparseDup(parts[i]!, parts[j]!)) union(i, j);
    }
  }
  const byRoot = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    const g = byRoot.get(r) ?? [];
    g.push(i);
    byRoot.set(r, g);
  }
  const out: PartEntry[] = [];
  for (const idxs of byRoot.values()) {
    const group = idxs.map(i => parts[i]!);
    if (group.length === 1) {
      out.push(group[0]!);
      continue;
    }
    let best = group[0]!;
    let bestScore = scenePartEntryRichness(best);
    for (const p of group.slice(1)) {
      const s = scenePartEntryRichness(p);
      if (s > bestScore) {
        best = p;
        bestScore = s;
      }
    }
    const qty = group.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
    out.push({ ...best, quantity: qty });
  }
  return out;
}

/**
 * Shared dedup key suitable for matching a scene-derived PartEntry
 * against an existing DM PartEntry (e.g. one that came from a CSV
 * import). Exposed so `designItemPartsSyncFromScene` can run a
 * "merge, not replace" write that preserves procurement's hand-
 * edits on matched PartEntries.
 */
export function partEntryIdentityKey(p: PartEntry): string {
  return dedupKey(p);
}

/**
 * Gather parts from every cabinet, dedupe, sum quantities.
 * Returns a list ready to hand to `syncPartsToDesignItem`. When the
 * caller only wants a single cabinet's parts, pass a one-element
 * array — the dedup is a no-op for unique parts.
 *
 * P4.2: Accepts an optional `csvLookupByCabinet` map so each cabinet
 * can use its own per-cabinet CSV overlay. When a cabinet-level lookup
 * exists it takes priority over the scene-level `csvLookup` fallback.
 *
 * A final pass (`consolidateProductInstancesAcrossCabinets`) rolls up
 * rows that are the same engineering part (structural slice of
 * `partNumber`, same L/W/T, material, inventory link) across instance
 * cabinet codes, and after `consolidateSparseSceneDuplicates` collapses
 * duplicate GLB mesh nodes that share a part number.
 */
export function mergeCabinetPartsForItem(
  cabinets: SceneCabinet[],
  now: Timestamp = Timestamp.now(),
  csvLookup?: CsvLookup,
  csvLookupByCabinet?: Map<string, CsvLookup>,
): PartEntry[] {
  const merged = new Map<string, PartEntry>();
  for (const cab of cabinets) {
    const lookup = csvLookupByCabinet?.get(cab.id) ?? csvLookup;
    const parts = sceneCabinetToDesignManagerParts(cab, now, lookup);
    for (const p of parts) {
      const key = dedupKey(p);
      const existing = merged.get(key);
      if (existing) {
        const nextQty = (existing.quantity ?? 0) + (p.quantity ?? 0);
        if (scenePartEntryRichness(p) > scenePartEntryRichness(existing)) {
          merged.set(key, { ...p, quantity: nextQty, createdAt: existing.createdAt });
        } else {
          existing.quantity = nextQty;
        }
      } else {
        merged.set(key, p);
      }
    }
  }
  const sparsityMerged = consolidateSparseSceneDuplicates(Array.from(merged.values()));
  // Runs for one or more cabinets: rolls up the same product part across
  // instance cabinet codes, and (with matching keys) duplicate rows in a
  // single-cabinet export.
  const byProduct = consolidateProductInstancesAcrossCabinets(sparsityMerged);
  return consolidateMeshCsvOrphanMates(byProduct);
}
