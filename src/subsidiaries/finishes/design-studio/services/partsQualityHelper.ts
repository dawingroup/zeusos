/**
 * partsQualityHelper — read-only audit + name-enhancement for scene parts.
 *
 * Scene cabinets accumulate `ScenePart`s over their lifecycle:
 *   - Authored from the 3D viewer (mesh-tagged, full dims).
 *   - Imported from a GLB's embedded part manifest (names often look
 *     like "node_037" or "SIDE" with no material).
 *   - Hand-tweaked during cut-list fixes.
 *
 * By the time they flow into Design Manager (via
 * `designItemPartsSyncFromScene`), they carry the scene's name choices
 * forward verbatim — which means procurement sees cryptic `PART01` rows
 * with no clear link to the cabinet they came from. This helper does
 * two jobs:
 *
 *   1. `enhancePartName(part)` — suggest a readable name of the form
 *      `"{base} — {dims}mm · {material}"` using effective L/W/T, label + category
 *      heuristics for the base when the stored name is weak. Deterministic, no
 *      network.
 *
 *   2. `analyzePartsQuality(parts)` — flag inconsistencies that will bite
 *      downstream (missing dims, thickness > length, edge banding length
 *      mismatching the panel, duplicate part codes with conflicting
 *      specs, missing meshNodeId, etc).
 *
 * The output is consumed by the SceneFilesPanel "Parts Review" UI and
 * can be acted on via `applyPartQualityFixes` in a companion writer.
 *
 * Kept pure so it unit-tests cleanly and can be reused from a Cloud
 * Function if we later want pre-sync server-side validation.
 */
import type { ScenePart } from '../types/assembly.types';
import type { PartCategory } from '../constants/assembly.constants';
import type { MaterialMappingLite } from '../types/modelPackage.types';
import {
  canonicalDisplayName,
  inferPositionFromPartLabels,
  inferRoleFromCategory,
  inferRoleFromPartLabels,
} from './partNamingService';
import { nameSceneAssemblyParts } from './sceneAssemblyNaming';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PartIssueSeverity = 'error' | 'warning' | 'info';

/** A single problem found on a part. */
export interface PartIssue {
  partId: string;
  cabinetId: string;
  partLabel: string;
  severity: PartIssueSeverity;
  code: PartIssueCode;
  message: string;
  hint?: string;
}

/** Stable codes so UI can filter / suppress specific classes of issue. */
export type PartIssueCode =
  | 'MISSING_PART_CODE'
  | 'MISSING_NAME'
  | 'MISSING_DIMENSIONS'
  | 'MISSING_THICKNESS'
  | 'MISSING_EDGE_BANDING'
  | 'SUSPICIOUS_THICKNESS'
  | 'OVERSIZE_LENGTH'
  | 'UNUSUAL_THICKNESS'
  | 'NO_MATERIAL'
  | 'NO_MESH_LINK'
  | 'INVALID_QUANTITY'
  | 'BAD_GRAIN'
  | 'EDGEBAND_MISMATCH'
  | 'DUPLICATE_CODE_CONFLICT'
  | 'GENERIC_NAME'
  | 'LOW_CONFIDENCE_MATERIAL'
  | 'UNRESOLVED_MATERIAL'
  | 'DIMENSION_UNCERTAIN';

/** Proposal to rename a part. */
export interface NameSuggestion {
  partId: string;
  cabinetId: string;
  currentName: string;
  suggestedName: string;
  rationale: string;
}

export interface PartsQualityReport {
  issues: PartIssue[];
  suggestions: NameSuggestion[];
  summary: {
    partsChecked: number;
    errors: number;
    warnings: number;
    infos: number;
    suggestions: number;
  };
}

/** Input shape — ScenePart already carries cabinetId, but we accept it
 *  loosely so callers can pass flat arrays hand-built from other sources. */
export type AuditablePart = ScenePart & { cabinetId: string };

// ---------------------------------------------------------------------------
// Name enhancement
// ---------------------------------------------------------------------------

/** Names that convey no information — worth replacing. */
const GENERIC_NAME_PATTERNS: RegExp[] = [
  /^node[_-]?\d+$/i,
  /^mesh[_-]?\d+$/i,
  /^part[_-]?\d+$/i,
  /^p\d+$/i,
  /^object[_-]?\d+$/i,
  /^untitled/i,
  /^unnamed/i,
  /^[a-z]$/i,          // single letter
  /^panel$/i,          // unqualified mesh/CSV default — we replace with role + context
];

export function isGenericName(name: string | undefined | null): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length < 3) return true;
  return GENERIC_NAME_PATTERNS.some(rx => rx.test(trimmed));
}

/**
 * Compute the recommended display name for a part.
 * Keeps names concise and structural (role + position + peer sequence)
 * without embedding dimensions/material into the part label.
 */
export function enhancePartName(part: ScenePart): string {
  const rawName = (part.partName || '').trim();
  const rawCode = (part.partCode || '').trim();
  const fromLabels = inferRoleFromPartLabels(rawName, rawCode);
  const posInferred = inferPositionFromPartLabels(rawName, rawCode);

  let base: string;
  // Prefer canonical naming when the part carries persisted role data
  // from AI recognition — produces drawing-grade names like "Left Side Panel".
  if (part.role) {
    base = canonicalDisplayName({ role: part.role, position: part.relativePosition });
  } else if (rawName && !isGenericName(rawName)) {
    // Strip any pre-existing dims/material suffix so we don't stack.
    base = rawName.split(' — ')[0].trim();
  } else if (rawCode && !isGenericName(rawCode)) {
    // Explicit part codes (cutlist / user) outrank free-text heuristics.
    base = toTitleCase(rawCode.replace(/[_-]+/g, ' '));
  } else if (fromLabels) {
    base = canonicalDisplayName({
      role: fromLabels,
      position: part.relativePosition ?? posInferred,
    });
  } else {
    base = canonicalDisplayName({
      role: inferRoleFromCategory(part.partCategory),
      position: part.relativePosition ?? posInferred,
    });
  }

  return base;
}

function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Consistency analysis
// ---------------------------------------------------------------------------

const MAX_SHEET_LENGTH_MM = 3500;       // > typical 3050 sheet stock
const MAX_USUAL_THICKNESS_MM = 50;
const EDGEBAND_TOLERANCE_MM = 5;

/** P2.3 — confidence below this flags a warning. */
const LOW_CONFIDENCE_THRESHOLD = 0.7;
/** P2.3 — confidence below this flags an error. */
const VERY_LOW_CONFIDENCE_THRESHOLD = 0.4;

function requiresCutSpec(category: PartCategory): boolean {
  return [
    'panel',
    'cover_panel',
    'toe_kick',
    'fascia',
    'upright',
    'stretcher',
  ].includes(category);
}

/** Same `mm` trailer parse as `scenePartsToDesignManager.scenePartToPartEntry`. */
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

/**
 * Pull L/W/T from common authoring patterns in names (e.g. "Side 720×560×18",
 * "Part 1200x600x18mm") when mesh/CSV have not stamped `dimensions` yet.
 * Aligned with `textFallbackLwt` used in `scenePartToPartEntry`.
 */
function parseLwhFromPartStrings(
  ...raws: Array<string | undefined>
): { l: number; w: number; t: number } {
  const joined = raws.filter(Boolean).join(' ');
  if (joined) {
    const m3 = joined.match(
      /(\d{2,4})\s*[x×]\s*(\d{2,4})\s*[x×]\s*(\d{1,2}(?:\.\d+)?)(?:\s*mm)?/i,
    );
    if (m3) {
      const a = Number(m3[1]);
      const b = Number(m3[2]);
      const c = Number(m3[3]);
      if (Number.isFinite(a) && a > 0 && Number.isFinite(b) && b > 0 && Number.isFinite(c) && c > 0) {
        return { l: a, w: b, t: c };
      }
    }
  }
  let l = 0;
  let w = 0;
  for (const raw of raws) {
    if (!raw) continue;
    const m2 = raw.match(/(\d{2,4})\s*[x×]\s*(\d{2,4})/i);
    if (m2) {
      const a = Number(m2[1]);
      const b = Number(m2[2]);
      if (Number.isFinite(a) && a > 0 && Number.isFinite(b) && b > 0) {
        l = a;
        w = b;
        break;
      }
    }
  }
  return { l, w, t: 0 };
}

/**
 * Exposed for `scenePartToPartEntry` so PartEntry and parts-quality use the
 * same text fallbacks.
 */
export function textFallbackLwt(
  p: Pick<ScenePart, 'partName' | 'partCode' | 'notes' | 'materialDescription' | 'inventoryItemName'>,
): { length: number; width: number; thickness: number } {
  const { l, w, t: tLwh } = parseLwhFromPartStrings(
    // Avoid reading dimensions from `partName` to prevent stale or
    // user-facing labels from mutating fabrication dimensions.
    p.partCode,
    p.notes,
    p.materialDescription,
    p.inventoryItemName,
  );
  const tMm = parseThicknessMm(
    p.materialDescription,
    p.inventoryItemName,
    p.notes,
  );
  const t = firstPositive(tLwh > 0 ? tLwh : undefined, tMm);
  return { length: l, width: w, thickness: t };
}

/**
 * Effective L/W/T for quality checks — matches the merge order in
 * `scenePartToPartEntry` (scene `dimensions`, then OBB/AABB, then `mm` text,
 * then L×W(×T) in names). CSV overlay is not applied here (scene-only audit).
 */
function effectivePartDims(p: AuditablePart): {
  length: number;
  width: number;
  thickness: number;
  hasAnyDim: boolean;
} {
  const d = p.dimensions;
  const qd = p.dimensionQuality?.obb ?? p.dimensionQuality?.aabb;
  const geomLength = firstPositive(d?.length, qd?.length);
  const geomWidth = firstPositive(d?.width, qd?.width);
  const geomThickness = firstPositive(d?.thickness, qd?.thickness);
  const allowTextFallback = geomLength <= 0 && geomWidth <= 0;
  const tx = allowTextFallback ? textFallbackLwt(p) : { length: 0, width: 0, thickness: 0 };
  const parsedT = allowTextFallback
    ? parseThicknessMm(
        p.materialDescription,
        p.inventoryItemName,
        p.notes,
      )
    : undefined;

  const length = firstPositive(geomLength, tx.length > 0 ? tx.length : undefined);
  const width = firstPositive(geomWidth, tx.width > 0 ? tx.width : undefined);
  const thickness = firstPositive(
    geomThickness,
    parsedT,
    tx.thickness > 0 ? tx.thickness : undefined,
  );
  const hasAnyDim = length > 0 || width > 0 || thickness > 0;
  return { length, width, thickness, hasAnyDim };
}

/**
 * For each (cabinet, assembly) group, assign peer sequences (e.g. two shelves
 * → "Fixed Shelf 1" / "2") and return a stable display base per part id.
 */
function buildDisplayBaseByAssembly(parts: AuditablePart[]): Map<string, string> {
  const byAsm = new Map<string, AuditablePart[]>();
  for (const p of parts) {
    const key = `${p.cabinetId}|${p.assemblyId ?? ''}`;
    if (!byAsm.has(key)) byAsm.set(key, []);
    byAsm.get(key)!.push(p);
  }
  const out = new Map<string, string>();
  for (const group of byAsm.values()) {
    const named = nameSceneAssemblyParts(group);
    for (const [pid, res] of named) {
      out.set(pid, res.displayName);
    }
  }
  return out;
}

function fullSuggestedPartName(_p: AuditablePart, displayBase: string): string {
  // Keep naming concise and structural. Dimensions/material remain separate
  // structured fields and should not be embedded in the part label.
  return displayBase;
}

/**
 * @param materialMappings  Optional resolved material mappings from
 *   `ModelPackage.materials.mappings`. When supplied, parts whose mesh
 *   material matched at low confidence get flagged so the user can
 *   verify or override.
 */
export function analyzePartsQuality(
  parts: AuditablePart[],
  materialMappings?: MaterialMappingLite[],
): PartsQualityReport {
  const issues: PartIssue[] = [];
  const suggestions: NameSuggestion[] = [];
  const displayBases = buildDisplayBaseByAssembly(parts);

  // Build a confidence lookup from material mappings (keyed by threeDSName, case-insensitive)
  const confidenceByMat = new Map<string, MaterialMappingLite>();
  if (materialMappings) {
    for (const m of materialMappings) {
      confidenceByMat.set(m.threeDSName.toLowerCase(), m);
    }
  }

  // Group parts by (cabinetId, partCode) to detect duplicate codes with
  // conflicting specs — a common artefact of copy-pasted cabinets.
  const byCodePerCabinet = new Map<string, AuditablePart[]>();

  for (const p of parts) {
    const id = p.id;
    const cabinetId = p.cabinetId;
    const partLabel = p.partCode || p.partName || id;

    const push = (severity: PartIssueSeverity, code: PartIssueCode, message: string, hint?: string) => {
      issues.push({ partId: id, cabinetId, partLabel, severity, code, message, hint });
    };

    // --- Identity ----
    if (!p.partCode?.trim()) {
      push('error', 'MISSING_PART_CODE', 'Part has no part code (partNumber).');
    }
    if (!p.partName?.trim()) {
      push('warning', 'MISSING_NAME', 'Part has no human-readable name.');
    } else if (isGenericName(p.partName)) {
      push(
        'info',
        'GENERIC_NAME',
        `Name "${p.partName}" reads as a generic placeholder.`,
        'Accept the suggested name to include dimensions + material.',
      );
    }

    // --- Dimensions (merge order matches `scenePartToPartEntry`: dims, OBB/AABB, text mm) ---
    const d = p.dimensions;
    const { length: effL, width: effW, thickness: effT, hasAnyDim } = effectivePartDims(p);
    if (requiresCutSpec(p.partCategory) && !hasAnyDim) {
      push(
        'warning',
        'MISSING_DIMENSIONS',
        'Panel has no dimensions in scene data (mesh/OBB/text) — add a cutlist CSV, name sizes (e.g. 720×560×18), or fix in 3D.',
        'Sync is not blocked; CSV row match on sync can still supply cut dimensions.',
      );
    } else if (!hasAnyDim && p.partCategory !== 'hardware' && p.partCategory !== 'fastener' && p.partCategory !== 'fitting') {
      push('warning', 'MISSING_DIMENSIONS', 'Part has no dimensions set.');
    }
    if (requiresCutSpec(p.partCategory) && hasAnyDim && effT <= 0) {
      push(
        'error',
        'MISSING_THICKNESS',
        'Part has no usable thickness (0mm) — board yield and machining cannot be computed.',
        'Set thickness from CSV overlay, mesh/quality dimensions, or part text (e.g. 18mm) before syncing.',
      );
    }
    if (effT && effL && effT > effL) {
      push(
        'warning',
        'SUSPICIOUS_THICKNESS',
        `Thickness (${effT}mm) exceeds length (${effL}mm).`,
        'Likely a units mix-up or swapped axes during authoring.',
      );
    }
    if (effL && effL > MAX_SHEET_LENGTH_MM) {
      push(
        'warning',
        'OVERSIZE_LENGTH',
        `Length ${effL}mm exceeds typical sheet stock (${MAX_SHEET_LENGTH_MM}mm).`,
        'Confirm the sheet can be sourced — may need bespoke panel supplier.',
      );
    }
    if (effT && effT > MAX_USUAL_THICKNESS_MM) {
      push(
        'info',
        'UNUSUAL_THICKNESS',
        `Thickness ${effT}mm is unusually thick; most carcase panels are 15–25mm.`,
      );
    }
    if (d?.grainDirection && !['length', 'width', 'none'].includes(d.grainDirection)) {
      push('warning', 'BAD_GRAIN', `Unknown grain direction: "${d.grainDirection}".`);
    }
    const dq = p.dimensionQuality;
    if (
      dq?.uncertain
      && dq.source !== 'csv'
      && p.partCategory === 'panel'
    ) {
      const obb = dq.obb;
      const aabb = dq.aabb;
      const compared = obb && aabb
        ? ` (OBB ${Math.round(obb.length)}x${Math.round(obb.width)}x${Math.round(obb.thickness)} vs AABB ${Math.round(aabb.length)}x${Math.round(aabb.width)}x${Math.round(aabb.thickness)})`
        : '';
      push(
        'warning',
        'DIMENSION_UNCERTAIN',
        `Mesh-derived dimensions are uncertain${compared}.`,
        'Prefer CSV overlay dimensions for production cut lists.',
      );
    }

    // --- Material linkage ---
    if (p.partCategory === 'panel' && !p.inventoryItemId) {
      push(
        'warning',
        'NO_MATERIAL',
        'Panel has no linked inventory item.',
        'Pick a material in the Finish Library so procurement can cost + order it.',
      );
    }

    // --- P2.3: Material resolution confidence ---
    if (materialMappings && p.materialDescription) {
      const matKey = p.materialDescription.toLowerCase();
      const mapping = confidenceByMat.get(matKey);
      if (mapping) {
        if (mapping.confidence < VERY_LOW_CONFIDENCE_THRESHOLD) {
          push(
            'error',
            'LOW_CONFIDENCE_MATERIAL',
            `Material "${p.materialDescription}" resolved to "${mapping.finishLibraryName}" at only ${(mapping.confidence * 100).toFixed(0)}% confidence.`,
            'Manually verify and override in the Finish Library mapping.',
          );
        } else if (mapping.confidence < LOW_CONFIDENCE_THRESHOLD) {
          push(
            'warning',
            'LOW_CONFIDENCE_MATERIAL',
            `Material "${p.materialDescription}" → "${mapping.finishLibraryName}" at ${(mapping.confidence * 100).toFixed(0)}% confidence — worth verifying.`,
            'Check the material mapping looks correct.',
          );
        }
      } else if (!mapping && confidenceByMat.size > 0) {
        // Mappings were provided but this material wasn't resolved at all
        push(
          'warning',
          'UNRESOLVED_MATERIAL',
          `Material "${p.materialDescription}" has no match in the resolved material mappings.`,
          'Add this material to the Finish Library or manually assign a finish.',
        );
      }
    }

    // --- Mesh linkage (design-studio specific) ---
    if (!p.meshNodeId) {
      push(
        'info',
        'NO_MESH_LINK',
        'Part has no meshNodeId — round-trip material edits from Design Manager won\'t reach this mesh.',
        'Re-tag the part in the 3D viewer.',
      );
    }

    // --- Quantity ---
    if (!p.quantity || p.quantity < 1) {
      push('error', 'INVALID_QUANTITY', `Quantity ${p.quantity ?? 'missing'} is invalid; must be ≥ 1.`);
    }

    // --- Edge banding lengths vs panel dims (warning — many Studio scenes omit explicit edges; refine in DM / CSV) ---
    if (
      (p.partCategory === 'panel' || p.partCategory === 'cover_panel')
      && effL > 0
      && effW > 0
      && !p.edgeBanding
    ) {
      push(
        'warning',
        'MISSING_EDGE_BANDING',
        'Sheet part has no edge-banding spec.',
        'Add edging in the scene, use a CSV cutlist overlay, or confirm banding when preparing procurement.',
      );
    }
    if (p.edgeBanding && (effL > 0 || effW > 0)) {
      const edges: Array<{ edge: 'top' | 'bottom' | 'left' | 'right' | 'front'; along: 'length' | 'width' }> = [
        { edge: 'top', along: 'length' },
        { edge: 'bottom', along: 'length' },
        { edge: 'front', along: 'length' },
        { edge: 'left', along: 'width' },
        { edge: 'right', along: 'width' },
      ];
      for (const { edge, along } of edges) {
        const e = p.edgeBanding[edge];
        if (!e) continue;
        const expected = along === 'length' ? effL : effW;
        if (expected && Math.abs(e.length - expected) > EDGEBAND_TOLERANCE_MM) {
          push(
            'warning',
            'EDGEBAND_MISMATCH',
            `Edge banding on ${edge} (${e.length}mm) disagrees with panel ${along} (${expected}mm).`,
          );
        }
      }
    }

    // Index for duplicate-code sweep below.
    if (p.partCode) {
      const key = `${cabinetId}|${p.partCode}`;
      const arr = byCodePerCabinet.get(key) ?? [];
      arr.push(p);
      byCodePerCabinet.set(key, arr);
    }

    // --- Name suggestion (assembly-scoped structural labels only) ---
    const displayBase = displayBases.get(id) ?? enhancePartName(p);
    const suggested = fullSuggestedPartName(p, displayBase);
    if (suggested && suggested !== p.partName) {
      suggestions.push({
        partId: id,
        cabinetId,
        currentName: p.partName || '(unnamed)',
        suggestedName: suggested,
        rationale: isGenericName(p.partName)
          ? 'Use assembly-scoped structural naming (role, position, and peer sequence when needed).'
          : 'Refine to a cleaner assembly-scoped structural label.',
      });
    }
  }

  // Duplicate-code conflicts (same cabinet, same code, different specs).
  for (const [, group] of byCodePerCabinet) {
    if (group.length < 2) continue;
    const [first, ...rest] = group;
    const firstD = first.dimensions;
    for (const other of rest) {
      const od = other.dimensions;
      const specsDiffer =
        first.inventoryItemId !== other.inventoryItemId ||
        firstD?.length !== od?.length ||
        firstD?.width !== od?.width ||
        firstD?.thickness !== od?.thickness;
      if (specsDiffer) {
        issues.push({
          partId: other.id,
          cabinetId: other.cabinetId,
          partLabel: other.partCode,
          severity: 'warning',
          code: 'DUPLICATE_CODE_CONFLICT',
          message: `Two parts in the same cabinet share code "${other.partCode}" but have different specs.`,
          hint: 'Rename one, or consolidate them — downstream dedup keys on partCode + dims.',
        });
      }
    }
  }

  return {
    issues,
    suggestions,
    summary: {
      partsChecked: parts.length,
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      infos: issues.filter(i => i.severity === 'info').length,
      suggestions: suggestions.length,
    },
  };
}

/** Flatten a scene's cabinets → assemblies → parts for the audit. */
export function collectAuditableParts(
  cabinets: Array<{ id: string; assemblies?: Array<{ parts?: ScenePart[] }> }>,
): AuditablePart[] {
  const flat: AuditablePart[] = [];
  for (const cab of cabinets) {
    for (const asm of cab.assemblies ?? []) {
      for (const p of asm.parts ?? []) {
        flat.push({ ...p, cabinetId: cab.id });
      }
    }
  }
  return flat;
}

/** Convenience: analyse every scene cabinet in one call. */
export function analyzeSceneCabinets(
  cabinets: Array<{ id: string; assemblies?: Array<{ parts?: ScenePart[] }> }>,
): PartsQualityReport {
  return analyzePartsQuality(collectAuditableParts(cabinets));
}
