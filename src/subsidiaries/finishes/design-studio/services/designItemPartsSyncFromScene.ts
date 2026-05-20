/**
 * designItemPartsSyncFromScene — Design Studio → Design Manager
 * parts sync, built around a single ownership model.
 *
 * ## The ownership contract
 *
 * Every PartEntry on `designItems/{id}.parts` lives in exactly one of
 * two namespaces, keyed by `source`:
 *
 *   - **scene-origin** (`source: 'design-studio'`) — owned by the
 *     scene sync flow below. Wiped + rebuilt atomically on every
 *     sync. Procurement can VIEW these in PartsTab but must not edit
 *     them (edits belong in Design Studio).
 *
 *   - **procurement** (everything else) — owned by Design Manager:
 *     CSV imports (`polyboard`, `csv-import`, `sketchup`), manual
 *     PartsTab entries (`manual`), and legacy untagged rows
 *     (`source: undefined`, treated as procurement).
 *
 * The invariant is enforced at the write primitive
 * (`writePartsWithVersion`). Scene syncs NEVER touch procurement
 * rows; procurement writes NEVER touch scene-origin rows. Dedup only
 * happens within a namespace. No doubling by construction.
 *
 * ## The entry point
 *
 * `writeSceneOriginParts(sceneId, designItemId, userId, opts)` is the
 * single canonical write. Behaviour:
 *   1. Hydrate cabinets bound to the item (newest of
 *      cabinet.assemblies vs modelPackage.grouping by timestamp).
 *   2. Flatten + merge **in Studio**: mesh `ScenePart`s + optional CSV
 *      overlay (`partsCsvOverlay` on scene and/or per cabinet). CSV adds
 *      fabrication context to meshed parts when both exist; see
 *      `scenePartsToDesignManager.scenePartToPartEntry` for precedence
 *      (row match wins for cut spec; GLB for geometry linkage). Part
 *      numbers on pushed rows are always batch-generated (cabinet +
 *      assembly + role code), not the raw `ScenePart.partCode` string.
 *   3. Hand the resulting PartEntry[] with writeScope: 'scene-origin'
 *      to syncPartsToDesignItem — procurement rows survive untouched.
 *
 * Preview mode (`opts.preview: true`) runs steps 1-2 without writing
 * and returns a full diff report.
 *
 * Older entry points (syncDesignItemPartsFromScene, wipeAllAndResync,
 * resetSceneOriginParts, aiReconcileAndSync) are kept as thin
 * compatibility wrappers so existing UI call-sites keep working
 * through the transition. All funnel into writeSceneOriginParts.
 */
import { Timestamp, deleteField, getDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { PartEntry } from '@/modules/design-manager/types';
import { db, functions } from '@/firebase/config';
import { markCutlistStale } from '@/modules/design-manager/services/cutlistAggregation';
import { invalidateProjectOptimization } from '@/modules/design-manager/services/partsService';
import { getScene } from './scene.service';
import { getModelPackage } from './modelPackage.service';
import { syncPartsToDesignItem } from './partsSyncService';
import type { PartEntry as SyncServicePartEntry } from './partsSyncService';
import {
  mergeCabinetPartsForItem,
  buildCsvLookup,
  type CsvLookup,
} from './scenePartsToDesignManager';
import {
  analyzePartsQuality,
  collectAuditableParts,
  type PartIssueCode,
} from './partsQualityHelper';
import type { SceneCabinet, ScenePartsCsvOverlay } from '../types/scene.types';
import type { ScenePart } from '../types/assembly.types';
import { joinPartsIntoAssemblies } from './groupingAssemblyJoin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** CSV-row ↔ ScenePart pairing strategy. */
export type PairingStrategy =
  | 'heuristic'  // client-side exact-name → token → dim fallback
  | 'ai'         // aiReconcileParts Cloud Function (Claude Sonnet)
  | 'auto';      // 'ai' when CSV overlay present, else 'heuristic' (no-op)

export interface WriteSceneOriginPartsOptions {
  pairingStrategy?: PairingStrategy;  // default 'auto'
  preview?: boolean;                   // default false — preview only, no write
}

export interface PartSyncPreviewRow {
  /** Proposed Design Manager row (scene-origin). */
  part: PartEntry;
  /** e.g. `KB-A · Carcase` — cabinet + assembly for review. */
  contextLabel: string;
  /** Original scene / mesh label before DM batch naming. */
  sceneSourceName: string;
}

export interface SyncResult {
  synced: number;
  version: number;
  addedNew: number;
  /** Existing procurement rows that the invariant preserved
   *  (scene-origin writes never touch procurement-namespaced rows). */
  preservedProcurement: number;
  /** Scene-origin rows that the previous sync wrote but this sync
   *  isn't producing any more. Gone on the new write. */
  droppedStaleSceneOrigin: number;
  /** Diagnostic from the CSV matcher — populated when a CSV overlay
   *  is present on the scene, regardless of pairing strategy. */
  csvReport?: CsvMatchReport;
  /** Populated when pairingStrategy === 'ai'. */
  aiReport?: AiPairingReport;
  /** When `preview: true` — parts that would be written as scene-origin. */
  proposedParts?: PartEntry[];
  /** Row metadata for the review wizard (aligned with `proposedParts`). */
  previewDetail?: PartSyncPreviewRow[];

  // ── Compatibility aliases for older UI code ───────────────────────
  // Existing cabinet / scene panels read these. Renamed in v77 but
  // kept synonymous so the transition doesn't break references. Drop
  // in a later cleanup once every consumer migrates.
  /** @deprecated alias of `droppedStaleSceneOrigin` */
  matchedExisting?: number;
  /** @deprecated alias of `preservedProcurement` */
  preservedUnmatched?: number;
  /** @deprecated alias of `droppedStaleSceneOrigin` */
  droppedStale?: number;
}

export interface CsvMatchReport {
  totalRows: number;
  matchedRows: number;
  byExactName: number;
  byTokens: number;
  byDimensions: number;
  byAi?: number;                     // only set when strategy === 'ai'
  unmatchedRowNames: string[];
}

export interface AiPairingReport {
  confidence: number;
  reasoning: string;
  pairCount: number;
  durationMs: number;
  looseCsvRowCount: number;
}

export interface SyncPreview extends SyncResult {
  sceneId: string;
  designItemId: string;
  projectId: string;
  cabinetCount: number;
  perCabinet: Array<{
    cabinetId: string;
    cabinetCode: string;
    partsBeforeMerge: number;
    requiredQuantity: number;
    source: 'cabinet.assemblies' | 'modelPackage' | 'none';
  }>;
  mergedPartCount: number;
  existingPartCount: number;
  existingBySource: Record<string, number>;
  wouldFinalCount: number;
}

const BLOCKING_SYNC_CODES = new Set<PartIssueCode>([
  'MISSING_PART_CODE',
  // MISSING_DIMENSIONS — warning only: CSV overlay + AI pairing often fill
  // cut specs on sync; blocking left users with no remediation in Parts Review.
  'MISSING_THICKNESS',
  'INVALID_QUANTITY',
]);

function formatBlockingIssuesForMessage(
  issues: Array<{ code: PartIssueCode }>,
): string {
  const counts = new Map<PartIssueCode, number>();
  for (const i of issues) counts.set(i.code, (counts.get(i.code) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([code, count]) => `${code}×${count}`)
    .join(', ');
}

export function getBlockingSyncIssueCodes(): ReadonlySet<PartIssueCode> {
  return BLOCKING_SYNC_CODES;
}

export function getBlockingSyncErrorMessage(
  cabinets: SceneCabinet[],
): string | null {
  const quality = analyzePartsQuality(collectAuditableParts(cabinets));
  const blocking = quality.issues.filter(
    i => i.severity === 'error' && BLOCKING_SYNC_CODES.has(i.code),
  );
  if (blocking.length === 0) return null;
  const breakdown = formatBlockingIssuesForMessage(blocking);
  return `Sync blocked: ${blocking.length} blocking part-quality error${blocking.length === 1 ? '' : 's'} (${breakdown}). Resolve in Parts Review first.`;
}

/**
 * Preflight for UI / buttons: same part list as `writeSceneOriginParts` by
 * hydrating each cabinet (scene assemblies vs `modelPackage.grouping`) before
 * running part-quality. Avoids false `MISSING_*` when only the model package
 * carries OBB or richer part rows.
 */
export async function getBlockingSyncErrorMessageForDesignItem(
  sceneId: string,
  designItemId: string,
): Promise<string | null> {
  const scene = await getScene(sceneId, true);
  if (!scene) {
    return 'Scene not found';
  }
  const cabinets = (scene.cabinets ?? []).filter(c => c.designItemId === designItemId);
  if (cabinets.length === 0) {
    return null;
  }
  const hydrated = await Promise.all(cabinets.map(c => hydrateCabinet(sceneId, c)));
  return getBlockingSyncErrorMessage(hydrated.map(h => h.cabinet));
}

// ---------------------------------------------------------------------------
// Inbound sync — clear the Design Manager scene-origin target (P6)
// ---------------------------------------------------------------------------

export interface ClearSceneOriginOnDesignItemResult {
  /** Scene-origin rows removed (`source: 'design-studio'`). */
  removed: number;
  /** Procurement / manual rows left unchanged. */
  kept: number;
  /** `partsVersion` after the versioned write. */
  version: number;
}

/**
 * Remove every scene-origin part from `designItems/{id}.parts` in one
 * versioned write. Procurement rows are preserved. Use before a new
 * `writeSceneOriginParts` when you need a clean namespace without relying
 * on the splice pass alone, or to reset after unbinding work from a scene.
 */
export async function clearSceneOriginOnDesignItem(
  projectId: string,
  designItemId: string,
  userId: string,
  options?: {
    /**
     * Drop denormalized `partsSummary` on the design item so the Parts tab
     * does not show rollups from the previous push.
     * @default false (preserves `resetSceneOriginParts` behaviour)
     */
    clearPartsSummary?: boolean;
  },
): Promise<ClearSceneOriginOnDesignItemResult> {
  const itemRef = doc(db, 'designProjects', projectId, 'designItems', designItemId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) {
    throw new Error(
      `clearSceneOriginOnDesignItem: design item not found (${projectId}/${designItemId}).`,
    );
  }
  const data = itemSnap.data() as { parts?: PartEntry[]; partsVersion?: number };
  const existing: PartEntry[] = data.parts ?? [];
  const baseVersion = typeof data.partsVersion === 'number' ? data.partsVersion : 0;
  const removed = existing.filter(p => (p as { source?: string }).source === 'design-studio').length;
  const kept = existing.length - removed;

  const additionalUpdates: Record<string, unknown> = {};
  if (options?.clearPartsSummary) {
    additionalUpdates.partsSummary = deleteField();
  }

  const result = await syncPartsToDesignItem(
    projectId,
    designItemId,
    [],
    'replace',
    userId,
    baseVersion,
    'scene-origin',
    Object.keys(additionalUpdates).length > 0 ? { additionalUpdates } : undefined,
  );

  return { removed, kept, version: result.version };
}

export interface PrepareDesignItemForInboundSceneSyncResult extends ClearSceneOriginOnDesignItemResult {
  projectId: string;
  designItemId: string;
}

/**
 * Full cleanup before an inbound Design Studio → DM parts sync: clears the
 * scene-origin namespace, strips stale `partsSummary` by default, and
 * invalidates project optimization / cutlist so downstream views do not
 * flash outdated rollups. Procurement parts are left intact.
 */
export async function prepareDesignItemForInboundSceneSync(
  projectId: string,
  designItemId: string,
  userId: string,
  options?: {
    /** @default true */
    clearPartsSummary?: boolean;
    /** @default true */
    invalidateProjectRollups?: boolean;
    reason?: string;
  },
): Promise<PrepareDesignItemForInboundSceneSyncResult> {
  const { removed, kept, version } = await clearSceneOriginOnDesignItem(
    projectId,
    designItemId,
    userId,
    { clearPartsSummary: options?.clearPartsSummary !== false },
  );
  if (options?.invalidateProjectRollups !== false) {
    try {
      await invalidateProjectOptimization(
        projectId,
        userId,
        options?.reason
          ?? 'Preparing design item for Design Studio scene parts sync (scene-origin target cleared).',
      );
    } catch (err) {
      console.warn('[prepareDesignItemForInboundSceneSync] invalidateProjectOptimization failed:', err);
    }
  }
  return { removed, kept, version, projectId, designItemId };
}

// ---------------------------------------------------------------------------
// Helpers (kept from previous implementation — still useful)
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === null || proto === Object.prototype;
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(v => stripUndefinedDeep(v)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[k] = stripUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}

/**
 * Build cabinet + assembly labels for each proposed PartEntry so the
 * review wizard can show the same context as Design Manager (section/assembly).
 */
export function buildPartSyncPreviewDetail(
  hydratedCabinets: SceneCabinet[],
  sceneParts: PartEntry[],
): PartSyncPreviewRow[] {
  const idToMeta = new Map<string, { cabinetCode: string; assemblyLabel: string; sceneName: string }>();
  for (const cab of hydratedCabinets) {
    const cabinetCode = cab.cabinetCode || cab.displayName || cab.id;
    for (const asm of cab.assemblies ?? []) {
      const assemblyLabel = asm.displayName || asm.assemblyCode || 'Assembly';
      for (const p of asm.parts ?? []) {
        if (p.id) {
          idToMeta.set(p.id, {
            cabinetCode,
            assemblyLabel,
            sceneName: (p.partName || p.partCode || '').trim(),
          });
        }
      }
    }
  }
  return sceneParts.map(part => {
    const meta = part.id ? idToMeta.get(part.id) : undefined;
    const contextLabel = meta
      ? `${meta.cabinetCode} · ${meta.assemblyLabel}`
      : (part.cabinetId ? `Cabinet ${String(part.cabinetId).slice(0, 8)}…` : '—');
    return {
      part,
      contextLabel,
      sceneSourceName: meta?.sceneName || part.name || '—',
    };
  });
}

/**
 * Commit user-edited scene-origin parts after {@link writeSceneOriginParts}
 * with `preview: true`. Re-verifies `partsVersion` before write.
 */
export async function commitSceneOriginPartsWithEdits(
  sceneId: string,
  designItemId: string,
  userId: string,
  parts: PartEntry[],
  expectedBaseVersion: number,
): Promise<SyncResult> {
  const scene = await getScene(sceneId, true);
  if (!scene?.projectId) {
    throw new Error(`Scene ${sceneId} not found or not bound to a project`);
  }

  const itemRef = doc(db, 'designProjects', scene.projectId, 'designItems', designItemId);
  const itemSnap = await getDoc(itemRef);
  if (!itemSnap.exists()) {
    throw new Error(`Design item ${designItemId} not found`);
  }
  const itemData = itemSnap.data() as { parts?: PartEntry[]; partsVersion?: number };
  const baseVersion = typeof itemData.partsVersion === 'number' ? itemData.partsVersion : 0;
  if (baseVersion !== expectedBaseVersion) {
    throw new Error(
      'This design item was edited elsewhere. Close the review, refresh the scene, and run sync again.',
    );
  }

  const existing: PartEntry[] = itemData.parts ?? [];
  const existingSceneOrigin = existing.filter(p => (p as { source?: string }).source === 'design-studio');
  const preservedProcurement = existing.filter(p => (p as { source?: string }).source !== 'design-studio').length;
  const droppedStaleSceneOrigin = existingSceneOrigin.length;

  const now = Timestamp.now();
  const sanitized = parts.map(p => {
    const row = {
      ...p,
      sceneId,
      source: 'design-studio' as const,
      updatedAt: now,
    };
    return stripUndefinedDeep(row);
  }) as PartEntry[];

  const result = await syncPartsToDesignItem(
    scene.projectId,
    designItemId,
    sanitized as unknown as SyncServicePartEntry[],
    'replace',
    userId,
    baseVersion,
    'scene-origin',
  );

  try {
    await markCutlistStale(
      scene.projectId,
      'Parts synced from Design Studio (review) — regenerate to pick up changes',
    );
  } catch (err) {
    console.warn('[commitSceneOriginPartsWithEdits] Could not mark cutlist stale:', err);
  }

  return {
    synced: result.synced,
    version: result.version,
    addedNew: parts.length,
    preservedProcurement,
    droppedStaleSceneOrigin,
    matchedExisting: 0,
    preservedUnmatched: preservedProcurement,
    droppedStale: droppedStaleSceneOrigin,
  };
}

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (ts instanceof Date) return ts.getTime();
  const seconds = (ts as { seconds?: number }).seconds;
  if (typeof seconds === 'number') return seconds * 1000;
  return 0;
}

function flattenCabinetParts(cab: SceneCabinet): ScenePart[] {
  return (cab.assemblies ?? []).flatMap(a => a.parts ?? []);
}

function partDataQualityScore(parts: ScenePart[]): number {
  if (parts.length === 0) return 0;
  let score = 0;
  for (const p of parts) {
    // Strongly reward fields that DM processing critically needs.
    if ((p.partCode || '').trim()) score += 2;
    if ((p.partName || '').trim()) score += 1;
    if (p.dimensions?.length && p.dimensions?.width) score += 3;
    if (p.dimensions?.thickness && p.dimensions.thickness > 0) score += 3;
    if (p.edgeBanding && (p.edgeBanding.top || p.edgeBanding.bottom || p.edgeBanding.left || p.edgeBanding.right || p.edgeBanding.front)) score += 2;
    if ((p.materialDescription || '').trim()) score += 2;
    if ((p.inventoryItemId || '').trim() || (p.finishLibraryId || '').trim()) score += 2;
  }
  return score;
}

/**
 * Hydrate a cabinet to the form the converter expects, picking the
 * newer of `cabinet.assemblies` or `modelPackage/current.grouping`.
 */
async function hydrateCabinet(sceneId: string, cab: SceneCabinet): Promise<{
  cabinet: SceneCabinet;
  source: 'cabinet.assemblies' | 'modelPackage' | 'none';
}> {
  const pkg = await getModelPackage(sceneId, cab.id);
  const cabHas = cab.assemblies?.some(a => (a.parts ?? []).length > 0) ?? false;
  if (pkg && cabHas) {
    const pkgCabinet = {
      ...cab,
      assemblies: joinPartsIntoAssemblies(
        pkg.grouping.assemblies ?? [],
        pkg.grouping.parts ?? [],
        cab.id,
      ),
    } as SceneCabinet;
    const pkgParts = flattenCabinetParts(pkgCabinet);
    const cabParts = flattenCabinetParts(cab);
    const pkgScore = partDataQualityScore(pkgParts);
    const cabScore = partDataQualityScore(cabParts);

    // Prefer the richer source even when cabinet.updatedAt is newer.
    // Cabinet timestamps can move due to unrelated edits (position, lock,
    // metadata) while modelPackage still holds higher-fidelity part data.
    if (pkgScore > cabScore * 1.05) {
      return { cabinet: pkgCabinet, source: 'modelPackage' };
    }

    if (toMillis(pkg.metadata?.processedAt) > toMillis(cab.updatedAt)) {
      return {
        cabinet: pkgCabinet,
        source: 'modelPackage',
      };
    }
    return { cabinet: cab, source: 'cabinet.assemblies' };
  }
  if (cabHas) return { cabinet: cab, source: 'cabinet.assemblies' };
  if (!pkg) return { cabinet: cab, source: 'none' };
  return {
    cabinet: {
      ...cab,
      assemblies: joinPartsIntoAssemblies(
        pkg.grouping.assemblies ?? [],
        pkg.grouping.parts ?? [],
        cab.id,
      ),
    } as SceneCabinet,
    source: 'modelPackage',
  };
}

/**
 * Run the AI reconciler for a scene + return a CsvLookup that
 * resolves ScenePart id → CsvRow by the AI's pairings.
 */
async function buildAiCsvLookup(
  sceneId: string,
  sceneName: string | undefined,
  sceneParts: Array<{ cab: SceneCabinet; part: ScenePart }>,
  overlay: ScenePartsCsvOverlay,
): Promise<{ lookup: CsvLookup; report: AiPairingReport }> {
  const scenePartsForAi = sceneParts.map(({ cab, part }) => ({
    id: part.id,
    cabinetId: cab.id,
    cabinetCode: cab.cabinetCode || cab.id,
    assemblyType: part.partCategory,
    partName: part.partName,
    dimensions: part.dimensions,
    materialName: part.materialDescription || part.inventoryItemName || '',
  }));
  const csvRowsForAi = overlay.rows.map((r, i) => ({ index: i, ...r }));

  const callAI = httpsCallable<
    { sceneParts: typeof scenePartsForAi; csvRows: typeof csvRowsForAi; sceneName?: string },
    {
      model: string;
      durationMs: number;
      confidence: number;
      reasoning: string;
      pairings: Array<{ scenePartId: string; csvRowIndex: number; confidence: number }>;
      looseCsvRowIndices: number[];
    }
  >(functions, 'aiReconcileParts', { timeout: 180_000 });

  const resp = await callAI({
    sceneParts: scenePartsForAi,
    csvRows: csvRowsForAi,
    sceneName,
  });
  const ai = resp.data;

  const pairMap = new Map<string, ScenePartsCsvOverlay['rows'][number]>();
  for (const pair of ai.pairings ?? []) {
    const row = overlay.rows[pair.csvRowIndex];
    if (row) pairMap.set(pair.scenePartId, row);
  }

  const lookup: CsvLookup = {
    match: part => pairMap.get((part as ScenePart).id),
    getMatchReport: () => ({
      totalRows: overlay.rows.length,
      matchedRows: pairMap.size,
      byExactName: 0,
      byTokens: 0,
      byDimensions: 0,
      unmatchedRowNames: overlay.rows
        .filter((_, i) => !(ai.pairings ?? []).some(p => p.csvRowIndex === i))
        .map(r => r.name),
    }),
  };

  void sceneId; // sceneId is unused here but kept for future telemetry.

  return {
    lookup,
    report: {
      confidence: ai.confidence,
      reasoning: ai.reasoning,
      pairCount: (ai.pairings ?? []).length,
      durationMs: ai.durationMs,
      looseCsvRowCount: (ai.looseCsvRowIndices ?? []).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Canonical entry point
// ---------------------------------------------------------------------------

/**
 * Write the scene-origin namespace for one DesignItem. Single source
 * of truth for scene-to-DM parts flow.
 */
export async function writeSceneOriginParts(
  sceneId: string,
  designItemId: string,
  userId: string,
  opts: WriteSceneOriginPartsOptions = {},
): Promise<SyncResult> {
  const { preview = false } = opts;
  const scene = await getScene(sceneId, true);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);
  if (!scene.projectId) {
    throw new Error(
      `Scene ${sceneId} is not bound to a Design Manager project. ` +
      `Bind it first (Context drawer panel).`,
    );
  }

  const cabinets = (scene.cabinets ?? []).filter(c => c.designItemId === designItemId);
  if (cabinets.length === 0) {
    throw new Error(
      `No cabinets in scene ${sceneId} are bound to DesignItem ${designItemId}. ` +
      `Assign at least one cabinet to the item before syncing.`,
    );
  }

  // 1. Hydrate cabinets (newest-source priority).
  const hydrated = await Promise.all(cabinets.map(c => hydrateCabinet(sceneId, c)));
  const hydratedCabinets = hydrated.map(h => h.cabinet);

  // 2. Flat scene part list — the AI reconciler needs it for
  //    cross-cabinet pairing. It's also the only place we know the
  //    cabinet context per part.
  const flatSceneParts: Array<{ cab: SceneCabinet; part: ScenePart }> = [];
  for (const cab of hydratedCabinets) {
    for (const asm of cab.assemblies ?? []) {
      for (const p of asm.parts ?? []) flatSceneParts.push({ cab, part: p });
    }
  }

  // Sync guardrail: block low-quality scene data regardless of caller path.
  // This mirrors SceneFilesPanel preflight so non-UI callers cannot bypass
  // required part-quality gates.
  const blockReason = getBlockingSyncErrorMessage(hydratedCabinets);
  if (blockReason) throw new Error(blockReason);

  // 3. CSV overlay matching — 'auto' picks 'ai' when overlay present.
  //    P4.2: prefer per-cabinet overlay when available; scene-level is fallback.
  const sceneOverlay = scene.partsCsvOverlay;
  const hasCabinetOverlays = hydratedCabinets.some(c => c.partsCsvOverlay?.rows?.length);
  const effectiveOverlay = hasCabinetOverlays ? undefined : sceneOverlay;
  const strategy: PairingStrategy =
    opts.pairingStrategy === 'auto' || opts.pairingStrategy === undefined
      ? ((effectiveOverlay && effectiveOverlay.rows?.length) || hasCabinetOverlays ? 'ai' : 'heuristic')
      : opts.pairingStrategy;

  let csvLookup: CsvLookup | undefined;
  let aiReport: AiPairingReport | undefined;
  const csvLookupByCabinet = new Map<string, CsvLookup>();

  // P4.2: Build per-cabinet lookups for cabinets that have their own overlay.
  for (const cab of hydratedCabinets) {
    const cabOverlay = cab.partsCsvOverlay;
    if (cabOverlay && cabOverlay.rows?.length) {
      if (strategy === 'ai') {
        const cabParts = flatSceneParts.filter(fp => fp.cab.id === cab.id);
        const { lookup } = await buildAiCsvLookup(sceneId, scene.name, cabParts, cabOverlay);
        csvLookupByCabinet.set(cab.id, lookup);
      } else {
        csvLookupByCabinet.set(cab.id, buildCsvLookup(cabOverlay));
      }
    }
  }

  // Scene-level fallback for cabinets without their own overlay.
  if (effectiveOverlay && effectiveOverlay.rows?.length) {
    if (strategy === 'ai') {
      const { lookup, report } = await buildAiCsvLookup(sceneId, scene.name, flatSceneParts, effectiveOverlay);
      csvLookup = lookup;
      aiReport = report;
    } else {
      csvLookup = buildCsvLookup(effectiveOverlay);
    }
  }

  // 4. Merge + stamp sceneId on every row. Scene-origin dedup happens
  //    inside mergeCabinetPartsForItem by meshNodeId / (partNumber +
  //    material + dims).
  const now = Timestamp.now();
  const sceneParts = mergeCabinetPartsForItem(
    hydratedCabinets, now, csvLookup,
    csvLookupByCabinet.size > 0 ? csvLookupByCabinet : undefined,
  );
  for (const p of sceneParts) {
    (p as { sceneId?: string; source?: string }).sceneId = sceneId;
    // Converter already stamps source: 'design-studio', belt-and-braces.
    (p as { source?: string }).source = 'design-studio';
  }

  if (sceneParts.length === 0 && flatSceneParts.length === 0) {
    throw new Error(
      `No parts found on the cabinets bound to this DesignItem. ` +
      `Run AI grouping (Scene → cabinet → Process Model) before syncing.`,
    );
  }

  // 5. Read the DesignItem once — need current version + existing
  //    rows for the diagnostic report. The write itself will re-read
  //    atomically via writePartsWithVersion, which also owns the
  //    scene-origin↔procurement splice.
  const itemRef = doc(db, 'designProjects', scene.projectId, 'designItems', designItemId);
  const itemSnap = await getDoc(itemRef);
  const existing: PartEntry[] = itemSnap.exists()
    ? ((itemSnap.data() as { parts?: PartEntry[] }).parts ?? [])
    : [];
  const baseVersion = itemSnap.exists()
    ? ((itemSnap.data() as { partsVersion?: number }).partsVersion ?? 0)
    : 0;

  // For reporting: how many existing rows are scene-origin (will be
  // replaced) vs procurement (will survive)?
  const existingSceneOrigin = existing.filter(
    p => (p as { source?: string }).source === 'design-studio',
  );
  const existingProcurement = existing.filter(
    p => (p as { source?: string }).source !== 'design-studio',
  );
  const droppedStaleSceneOrigin = existingSceneOrigin.length;
  const preservedProcurement = existingProcurement.length;

  const combineCsvReports = (
    reports: Array<ReturnType<CsvLookup['getMatchReport']>>,
  ): CsvMatchReport | undefined => {
    if (reports.length === 0) return undefined;
    const unmatched = new Set<string>();
    let totalRows = 0;
    let matchedRows = 0;
    let byExactName = 0;
    let byTokens = 0;
    let byDimensions = 0;
    for (const r of reports) {
      totalRows += r.totalRows;
      matchedRows += r.matchedRows;
      byExactName += r.byExactName;
      byTokens += r.byTokens;
      byDimensions += r.byDimensions;
      for (const n of r.unmatchedRowNames) unmatched.add(n);
    }
    return {
      totalRows,
      matchedRows,
      byExactName,
      byTokens,
      byDimensions,
      unmatchedRowNames: Array.from(unmatched),
    };
  };

  const csvReports: Array<ReturnType<CsvLookup['getMatchReport']>> = [];
  if (csvLookup) csvReports.push(csvLookup.getMatchReport());
  if (csvLookupByCabinet.size > 0) {
    for (const lookup of csvLookupByCabinet.values()) {
      csvReports.push(lookup.getMatchReport());
    }
  }
  const csvReport = (sceneOverlay || hasCabinetOverlays)
    ? combineCsvReports(csvReports)
    : undefined;

  const previewDetail = buildPartSyncPreviewDetail(hydratedCabinets, sceneParts);

  if (preview) {
    // No write; caller uses the SyncResult as a forecast + proposed rows for review UI.
    return {
      synced: sceneParts.length + preservedProcurement,
      version: baseVersion,
      addedNew: sceneParts.length,
      preservedProcurement,
      droppedStaleSceneOrigin,
      matchedExisting: 0,
      preservedUnmatched: preservedProcurement,
      droppedStale: droppedStaleSceneOrigin,
      csvReport,
      aiReport,
      proposedParts: sceneParts,
      previewDetail,
    };
  }

  // 6. Sanitize — Firestore rejects undefined inside arrays.
  const sanitized = sceneParts.map(stripUndefinedDeep) as PartEntry[];

  // 7. Single atomic write. writeScope: 'scene-origin' tells
  //    writePartsWithVersion to splice against existing procurement
  //    rows instead of replacing the whole array. One write, one
  //    version bump, no races.
  const result = await syncPartsToDesignItem(
    scene.projectId,
    designItemId,
    sanitized as unknown as Parameters<typeof syncPartsToDesignItem>[2],
    'replace',      // we're authoring the entire scene-origin slice
    userId,
    baseVersion,
    'scene-origin',
  );

  // 8. Mark the project cutlist rollup stale so DM's Cutlist tab
  //    prompts regeneration on next view. Best-effort.
  try {
    await markCutlistStale(
      scene.projectId,
      `Parts synced from Design Studio — regenerate to pick up new dimensions`,
    );
  } catch (err) {
    console.warn('[writeSceneOriginParts] Could not mark cutlist stale:', err);
  }

  return {
    synced: result.synced,
    version: result.version,
    addedNew: sceneParts.length,
    preservedProcurement,
    droppedStaleSceneOrigin,
    // Compat aliases — old UI code reads these names.
    matchedExisting: 0,  // no longer a meaningful concept under namespacing
    preservedUnmatched: preservedProcurement,
    droppedStale: droppedStaleSceneOrigin,
    csvReport,
    aiReport,
  };
}

/**
 * Dry-run — same pipeline, no write. The SyncResult's `synced` is
 * what would be on the item after the write (scene parts + existing
 * procurement).
 */
export async function previewWriteSceneOriginParts(
  sceneId: string,
  designItemId: string,
  opts: Omit<WriteSceneOriginPartsOptions, 'preview'> = {},
): Promise<SyncPreview> {
  const scene = await getScene(sceneId, true);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);
  if (!scene.projectId) throw new Error(`Scene ${sceneId} is not bound to a project`);

  const cabinets = (scene.cabinets ?? []).filter(c => c.designItemId === designItemId);
  const perCabinet: SyncPreview['perCabinet'] = [];
  const hydratedCabinets: SceneCabinet[] = [];
  for (const cab of cabinets) {
    const { cabinet, source } = await hydrateCabinet(sceneId, cab);
    hydratedCabinets.push(cabinet);
    const partsInCabinet = (cabinet.assemblies ?? []).reduce(
      (sum, a) => sum + (a.parts?.length ?? 0),
      0,
    );
    perCabinet.push({
      cabinetId: cab.id,
      cabinetCode: cab.cabinetCode || cab.displayName || cab.id,
      partsBeforeMerge: partsInCabinet,
      requiredQuantity: (cab as { requiredQuantity?: number }).requiredQuantity ?? 1,
      source,
    });
  }

  // Run the real pipeline in preview mode to reuse identical logic.
  const forecast = await writeSceneOriginParts(sceneId, designItemId, '__preview__', {
    pairingStrategy: opts.pairingStrategy,
    preview: true,
  }).catch(err => {
    throw err;
  });

  const itemRef = doc(db, 'designProjects', scene.projectId, 'designItems', designItemId);
  const itemSnap = await getDoc(itemRef);
  const existing: PartEntry[] = itemSnap.exists()
    ? ((itemSnap.data() as { parts?: PartEntry[] }).parts ?? [])
    : [];
  const existingBySource: Record<string, number> = {};
  for (const p of existing) {
    const src = (p as { source?: string }).source ?? '(no source)';
    existingBySource[src] = (existingBySource[src] ?? 0) + 1;
  }

  return {
    ...forecast,
    sceneId,
    designItemId,
    projectId: scene.projectId,
    cabinetCount: cabinets.length,
    perCabinet,
    mergedPartCount: forecast.addedNew,
    existingPartCount: existing.length,
    existingBySource,
    wouldFinalCount: forecast.synced,
  };
}

// ---------------------------------------------------------------------------
// Compatibility wrappers (delete in a later cleanup pass)
// ---------------------------------------------------------------------------

/** Legacy name for `writeSceneOriginParts`. */
export async function syncDesignItemPartsFromScene(
  sceneId: string,
  designItemId: string,
  userId: string,
): Promise<SyncResult> {
  return writeSceneOriginParts(sceneId, designItemId, userId, { pairingStrategy: 'auto' });
}

/** Legacy AI-specific entry — now redundant with 'auto' but preserved
 *  so the existing UI button keeps working during rollout. */
export async function aiReconcileAndSync(
  sceneId: string,
  userId: string,
): Promise<{
  aiConfidence: number;
  aiReasoning: string;
  pairCount: number;
  looseCsvRowCount: number;
  perItem: Array<{ designItemId: string; synced: number; droppedStale: number; error?: string }>;
}> {
  const scene = await getScene(sceneId, true);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);
  if (!scene.projectId) throw new Error('Scene not bound to a project');
  if (!scene.partsCsvOverlay?.rows?.length) {
    throw new Error('AI reconciliation requires a CSV overlay uploaded on the scene.');
  }

  const itemIds = new Set(
    (scene.cabinets ?? []).map(c => c.designItemId).filter(Boolean) as string[],
  );

  const perItem: Array<{ designItemId: string; synced: number; droppedStale: number; error?: string }> = [];
  let lastAiReport: AiPairingReport | undefined;

  for (const designItemId of itemIds) {
    try {
      const r = await writeSceneOriginParts(sceneId, designItemId, userId, {
        pairingStrategy: 'ai',
      });
      if (r.aiReport) lastAiReport = r.aiReport;
      perItem.push({
        designItemId,
        synced: r.synced,
        droppedStale: r.droppedStaleSceneOrigin,
      });
    } catch (err) {
      perItem.push({
        designItemId,
        synced: 0,
        droppedStale: 0,
        error: (err as Error).message,
      });
    }
  }

  return {
    aiConfidence: lastAiReport?.confidence ?? 0,
    aiReasoning: lastAiReport?.reasoning ?? '',
    pairCount: lastAiReport?.pairCount ?? 0,
    looseCsvRowCount: lastAiReport?.looseCsvRowCount ?? 0,
    perItem,
  };
}

/** Legacy — equivalent to a sync today because scene-origin writes
 *  always replace the whole scene-origin namespace. */
export async function wipeAllAndResync(
  sceneId: string,
  designItemId: string,
  userId: string,
): Promise<{ wiped: number; syncResult: SyncResult }> {
  const result = await writeSceneOriginParts(sceneId, designItemId, userId, { pairingStrategy: 'auto' });
  return { wiped: result.droppedStaleSceneOrigin, syncResult: result };
}

/** Legacy — removes scene-origin parts without writing new ones. Now
 *  implemented as: write an empty scene-origin set. The namespace
 *  splice leaves procurement intact. */
export async function resetSceneOriginParts(
  sceneId: string,
  designItemId: string,
  userId: string,
): Promise<{ removed: number; kept: number; version: number }> {
  const scene = await getScene(sceneId, false);
  if (!scene?.projectId) throw new Error('Scene has no project binding');
  return clearSceneOriginOnDesignItem(scene.projectId, designItemId, userId, {
    clearPartsSummary: false,
  });
}

/** Legacy preview name. */
export async function previewDesignItemPartsSync(
  sceneId: string,
  designItemId: string,
): Promise<SyncPreview> {
  return previewWriteSceneOriginParts(sceneId, designItemId);
}

/** Legacy — unique DesignItem ids bound to scene cabinets. */
export async function listScenePartsSyncableDesignItems(
  sceneId: string,
): Promise<Array<{ designItemId: string; cabinetCount: number }>> {
  const scene = await getScene(sceneId, true);
  if (!scene) return [];
  const tally = new Map<string, number>();
  for (const cab of scene.cabinets ?? []) {
    if (!cab.designItemId) continue;
    tally.set(cab.designItemId, (tally.get(cab.designItemId) ?? 0) + 1);
  }
  return Array.from(tally.entries()).map(([designItemId, cabinetCount]) => ({
    designItemId,
    cabinetCount,
  }));
}

// ---------------------------------------------------------------------------
// Scene-wide CSV coverage (kept for the Files panel diagnostic)
// ---------------------------------------------------------------------------

export interface CsvCoverageReport {
  totalRows: number;
  matchedByAnyCabinet: number;
  unmatchedRows: Array<{
    name: string;
    length: number;
    width: number;
    thickness: number;
    quantity: number;
    materialName: string;
    materialCode?: string;
    partType: 'sheet' | 'bar';
  }>;
}

export async function analyzeCsvCoverage(sceneId: string): Promise<CsvCoverageReport> {
  const scene = await getScene(sceneId, true);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);
  const overlay = scene.partsCsvOverlay;
  if (!overlay?.rows?.length) {
    return { totalRows: 0, matchedByAnyCabinet: 0, unmatchedRows: [] };
  }
  const hydrated = await Promise.all(
    (scene.cabinets ?? []).map(c => hydrateCabinet(sceneId, c)),
  );
  const lookup = buildCsvLookup(overlay);
  const allParts = hydrated.flatMap(({ cabinet }) =>
    (cabinet.assemblies ?? []).flatMap(a => a.parts ?? []),
  );
  for (const part of allParts) lookup.match(part);
  const report = lookup.getMatchReport();
  const unmatchedNames = new Set(report.unmatchedRowNames);
  const unmatchedRows = overlay.rows.filter(r => unmatchedNames.has(r.name));
  return {
    totalRows: overlay.rows.length,
    matchedByAnyCabinet: report.matchedRows,
    unmatchedRows,
  };
}

// ---------------------------------------------------------------------------
// Match reconciliation report (Files panel diagnostic audit)
// ---------------------------------------------------------------------------

export interface SyncMatchReport {
  totalSceneParts: number;
  totalCsvRows: number;
  matched: number;
  matchDetails: Array<{
    scenePartName: string;
    cabinetCode: string;
    csvRowName: string;
    matchedBy: 'exact' | 'tokens' | 'dimensions';
  }>;
  scenePartsWithoutCsv: Array<{ cabinetCode: string; partName: string; dims: string }>;
  csvRowsWithoutPart: Array<{ name: string; dims: string; material: string }>;
  potentialDuplicates: Array<{
    scenePart: { cabinetCode: string; partName: string; dims: string };
    csvRow: { name: string; dims: string };
    dimDelta: number;
  }>;
}

export async function buildSyncMatchReport(sceneId: string): Promise<SyncMatchReport> {
  const scene = await getScene(sceneId, true);
  if (!scene) throw new Error(`Scene ${sceneId} not found`);
  const overlay = scene.partsCsvOverlay;

  const hydrated = await Promise.all(
    (scene.cabinets ?? []).map(c => hydrateCabinet(sceneId, c)),
  );
  const allParts: Array<{ cab: SceneCabinet; part: ScenePart }> = [];
  for (const { cabinet } of hydrated) {
    for (const asm of cabinet.assemblies ?? []) {
      for (const p of asm.parts ?? []) allParts.push({ cab: cabinet, part: p });
    }
  }

  const matchDetails: SyncMatchReport['matchDetails'] = [];
  const scenePartsWithoutCsv: SyncMatchReport['scenePartsWithoutCsv'] = [];
  const dimsStr = (d: ScenePart['dimensions']): string =>
    d ? `${Math.round(d.length)}×${Math.round(d.width)}×${Math.round(d.thickness)}` : '—';

  if (!overlay?.rows?.length) {
    for (const { cab, part } of allParts) {
      scenePartsWithoutCsv.push({
        cabinetCode: cab.cabinetCode || cab.id,
        partName: part.partName,
        dims: dimsStr(part.dimensions),
      });
    }
    return {
      totalSceneParts: allParts.length,
      totalCsvRows: 0,
      matched: 0,
      matchDetails: [],
      scenePartsWithoutCsv,
      csvRowsWithoutPart: [],
      potentialDuplicates: [],
    };
  }

  const lookup = buildCsvLookup(overlay);
  let prev = lookup.getMatchReport();
  for (const { cab, part } of allParts) {
    const matched = lookup.match(part);
    const now = lookup.getMatchReport();
    if (!matched) {
      scenePartsWithoutCsv.push({
        cabinetCode: cab.cabinetCode || cab.id,
        partName: part.partName,
        dims: dimsStr(part.dimensions),
      });
    } else {
      let matchedBy: 'exact' | 'tokens' | 'dimensions' = 'exact';
      if (now.byExactName > prev.byExactName) matchedBy = 'exact';
      else if (now.byTokens > prev.byTokens) matchedBy = 'tokens';
      else matchedBy = 'dimensions';
      matchDetails.push({
        scenePartName: part.partName,
        cabinetCode: cab.cabinetCode || cab.id,
        csvRowName: matched.name,
        matchedBy,
      });
    }
    prev = now;
  }

  const final = lookup.getMatchReport();
  const unmatchedNames = new Set(final.unmatchedRowNames);
  const csvRowsWithoutPart = overlay.rows
    .filter(r => unmatchedNames.has(r.name))
    .map(r => ({
      name: r.name,
      dims: `${r.length}×${r.width}×${r.thickness}`,
      material: r.materialName,
    }));

  const potentialDuplicates: SyncMatchReport['potentialDuplicates'] = [];
  const usedCsvIdx = new Set<number>();
  for (const sp of scenePartsWithoutCsv) {
    const [sL, sW, sT] = sp.dims.split('×').map(n => parseInt(n, 10));
    if (Number.isNaN(sL)) continue;
    let bestIdx = -1;
    let bestDelta = Infinity;
    for (let i = 0; i < csvRowsWithoutPart.length; i++) {
      if (usedCsvIdx.has(i)) continue;
      const [cL, cW, cT] = csvRowsWithoutPart[i].dims.split('×').map(n => parseInt(n, 10));
      if (Number.isNaN(cL)) continue;
      const dL = Math.abs(sL - cL);
      const dW = Math.abs(sW - cW);
      const dT = Math.abs(sT - cT);
      if (dL <= 10 && dW <= 10 && dT <= 10) {
        const delta = dL + dW + dT;
        if (delta < bestDelta) {
          bestDelta = delta;
          bestIdx = i;
        }
      }
    }
    if (bestIdx >= 0) {
      usedCsvIdx.add(bestIdx);
      potentialDuplicates.push({
        scenePart: sp,
        csvRow: csvRowsWithoutPart[bestIdx],
        dimDelta: bestDelta,
      });
    }
  }

  return {
    totalSceneParts: allParts.length,
    totalCsvRows: overlay.rows.length,
    matched: matchDetails.length,
    matchDetails,
    scenePartsWithoutCsv,
    csvRowsWithoutPart,
    potentialDuplicates,
  };
}

/**
 * @deprecated Replaced by the unified scene sync. The new model
 * keeps all scene-derived content (including unmatched CSV rows) in
 * the scene-origin namespace so they're wiped + rebuilt atomically
 * with every sync. Calling this now is a no-op that nudges the caller
 * to run "Sync parts" — which already handles CSV.
 */
export async function importUnmatchedCsvAsLooseParts(
  _sceneId: string,
  _designItemId: string,
  _userId: string,
): Promise<{ added: number; version: number }> {
  throw new Error(
    'importUnmatchedCsvAsLooseParts is deprecated. Use "Sync parts" — it now ' +
    'handles unmatched CSV rows as part of the scene-origin namespace, ' +
    'so no separate loose-parts import is needed.',
  );
}

// ---------------------------------------------------------------------------
// Procurement cleanup helper — deletes procurement rows by source bucket.
// Used by PartsTab's "Clean procurement by source" action to drain
// legacy untagged rows on DF-2026-694 without touching scene-origin.
// ---------------------------------------------------------------------------

/**
 * Report the procurement-row source distribution on one DesignItem.
 * Scene-origin rows (source: 'design-studio') are excluded by design.
 */
export async function listProcurementSourceCounts(
  projectId: string,
  designItemId: string,
): Promise<Array<{ source: string; count: number; samples: string[] }>> {
  const itemRef = doc(db, 'designProjects', projectId, 'designItems', designItemId);
  const snap = await getDoc(itemRef);
  if (!snap.exists()) return [];
  const parts = ((snap.data() as { parts?: PartEntry[] }).parts ?? [])
    .filter(p => (p as { source?: string }).source !== 'design-studio');
  const buckets = new Map<string, { count: number; samples: string[] }>();
  for (const p of parts) {
    const src = (p as { source?: string }).source ?? '(untagged legacy)';
    const b = buckets.get(src) ?? { count: 0, samples: [] };
    b.count++;
    if (b.samples.length < 3) b.samples.push(p.name || p.partNumber || '(unnamed)');
    buckets.set(src, b);
  }
  return Array.from(buckets.entries())
    .map(([source, { count, samples }]) => ({ source, count, samples }))
    .sort((a, b) => b.count - a.count);
}

/** Delete every procurement row whose `source` is in the supplied list. */
export async function deleteProcurementRowsBySource(
  projectId: string,
  designItemId: string,
  sources: string[],
  userId: string,
): Promise<{ removed: number; kept: number; version: number }> {
  const itemRef = doc(db, 'designProjects', projectId, 'designItems', designItemId);
  const snap = await getDoc(itemRef);
  if (!snap.exists()) throw new Error(`DesignItem ${designItemId} not found`);
  const existing = (snap.data() as { parts?: PartEntry[] }).parts ?? [];
  const baseVersion = (snap.data() as { partsVersion?: number }).partsVersion ?? 0;

  // Treat '(untagged legacy)' as shorthand for "source is missing".
  const targets = new Set(sources);
  const matchesTarget = (p: PartEntry) => {
    const src = (p as { source?: string }).source;
    if (src === 'design-studio') return false; // never touch scene-origin
    if (src === undefined || src === null) return targets.has('(untagged legacy)');
    return targets.has(src);
  };

  let removed = 0;
  const kept = existing.filter(p => {
    if (matchesTarget(p)) { removed++; return false; }
    return true;
  });

  // Hand off to the procurement-scoped write — writePartsWithVersion
  // will preserve the scene-origin namespace untouched.
  const result = await syncPartsToDesignItem(
    projectId,
    designItemId,
    kept.filter(p => (p as { source?: string }).source !== 'design-studio') as unknown as Parameters<typeof syncPartsToDesignItem>[2],
    'replace',
    userId,
    baseVersion,
    'procurement',
  );
  return { removed, kept: result.synced, version: result.version };
}
