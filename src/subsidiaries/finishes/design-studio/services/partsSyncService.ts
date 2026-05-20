import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';
import {
  writePartsWithVersion,
  PartsConcurrencyError,
  readPartsVersion,
} from '@/modules/design-manager/services/partsVersioningService';
import type { CutListEntry } from '../types/workshop-viewer.types';
import { resolveMaterialByName } from './materialResolverService';

// Re-export so Studio callers don't need a cross-module import to catch the
// concurrency error type.
export { PartsConcurrencyError, readPartsVersion };

/**
 * Source format of a cut-list CSV, as detected by `parserCsv.parsePolyBoardCSV`.
 * Mirrors that parser's `detectedFormat` so callers can pass it through to
 * `convertCutListToPartEntries` and drive edge-banding interpretation.
 */
export type CutListSourceFormat =
  | 'polyboard-panel'
  | 'polyboard-bar'
  | 'polyboard-timber'
  | 'generic'
  | 'unknown';

/**
 * Options controlling how `convertCutListToPartEntries` interprets raw
 * L1/L2/W1/W2 edge-banding columns.
 */
export interface CutListConversionOptions {
  /** Detected CSV format — drives whether the PolyBoard edge mapping is trusted */
  sourceFormat?: CutListSourceFormat;
  /** Collector for non-fatal warnings surfaced during conversion */
  warnings?: string[];
  /**
   * Force application of the PolyBoard L1/L2/W1/W2 → left/right/top/bottom
   * mapping even when `sourceFormat` is not a recognised PolyBoard export.
   * Use only when the caller has separately validated the CSV schema.
   */
  forcePolyBoardEdgeMapping?: boolean;
  /**
   * P21.11 — Finish Library documents to resolve each CSV row's material
   * string against. When provided, each returned part carries
   * `materialId` / `materialCode` / `inventoryItemId` / resolution
   * provenance alongside the bare `materialName`. Omit to skip resolution.
   */
  finishes?: ReadonlyArray<import('@/modules/inventory/types/finishLibrary').FinishDocument>;
  /**
   * P21.11 — Finish IDs that belong to the project's `materialPalette`.
   * Resolver prefers these over equally-strong matches elsewhere in the
   * library so CSV imports land on the project's curated choices first.
   * Compute with {@link paletteEntriesToFinishIds}.
   */
  preferredFinishIds?: ReadonlySet<string>;
}

/** Formats whose L1/L2/W1/W2 columns map safely to left/right/top/bottom. */
const POLYBOARD_FORMATS: readonly CutListSourceFormat[] = [
  'polyboard-panel',
  'polyboard-bar',
  'polyboard-timber',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PartEntry {
  partNumber: string;
  name: string;
  partType: 'sheet' | 'bar' | 'slab' | 'fabric' | 'component' | 'timber';
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  materialName: string;
  materialCode?: string;
  materialId?: string;
  /**
   * P21.11 — material-mapper round-trip. See the canonical PartEntry in
   * src/modules/design-manager/types/index.ts for field documentation.
   * These are forwarded verbatim into the Firestore document.
   */
  inventoryItemId?: string;
  materialResolutionSource?: 'palette-exact' | 'palette-fuzzy' | 'ai-guess' | 'manual';
  materialResolutionConfidence?: number;
  grainDirection?: 'length' | 'width' | 'none';
  edgeBanding?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  source: 'manual' | 'csv-import' | 'polyboard' | 'sketchup';
  importedFrom?: string;
  purchasePriority?: number | null;
  hasCNCOperations?: boolean;
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/**
 * Convert Workshop Viewer cut list entries into Design Manager part entries.
 *
 * Edge-banding interpretation depends on the detected source format:
 *
 * - **PolyBoard panel / bar / timber exports** — columns 8–11 (`L1, L2, W1, W2`)
 *   map by convention to `left, right, top, bottom`. This is the historical
 *   behaviour and is preserved when `options.sourceFormat` is a PolyBoard
 *   format (or when `forcePolyBoardEdgeMapping` is set).
 *
 * - **Unknown / generic CSVs** — we cannot assume the PolyBoard column order
 *   applies, so edge-banding is dropped (`edgeBanding` is left undefined)
 *   rather than misattributed. A warning is emitted and `source` is tagged
 *   as `'csv-import'` so downstream callers know the origin is non-canonical.
 *
 * This replaces the previous hardcoded PolyBoard mapping (see finding F14 in
 * the data-model audit).
 */
export function convertCutListToPartEntries(
  cutList: CutListEntry[],
  csvFileName?: string,
  options: CutListConversionOptions = {},
): PartEntry[] {
  // Backward compatibility: callers that don't supply options are treated as
  // PolyBoard-origin (the legacy default). Once a caller passes `sourceFormat`
  // explicitly, we honour it — only PolyBoard formats trust the L1/L2/W1/W2
  // mapping; 'generic' / 'unknown' drop edge-banding to avoid misattribution.
  const trustPolyBoardMapping =
    options.forcePolyBoardEdgeMapping === true ||
    options.sourceFormat === undefined ||
    POLYBOARD_FORMATS.includes(options.sourceFormat);

  let warnedForUnknown = false;

  return cutList.map((entry, index) => {
    // Cutlist rows with length × width are panel/sheet stock. Thin stock
    // (3–4 mm backs, etc.) must stay `sheet`; `thickness <= 5 → component`
    // incorrectly sent those to Components and broke cutlist/shop sync.
    const hasPanelFootprint = entry.length > 0 && entry.width > 0;
    const partType: PartEntry['partType'] = hasPanelFootprint
      ? 'sheet'
      : entry.thickness <= 5
        ? 'component'
        : 'sheet';

    let edgeBanding: PartEntry['edgeBanding'];
    if (trustPolyBoardMapping) {
      edgeBanding = {
        left: entry.edgeBanding.L1,
        right: entry.edgeBanding.L2,
        top: entry.edgeBanding.W1,
        bottom: entry.edgeBanding.W2,
      };
    } else {
      // Non-PolyBoard / unknown schema: drop edge-banding rather than guess.
      // Only warn once per conversion batch.
      if (!warnedForUnknown && options.warnings) {
        options.warnings.push(
          `Edge-banding dropped on ${cutList.length} row(s): CSV source ` +
          `format "${options.sourceFormat ?? 'unknown'}" does not match the ` +
          `PolyBoard L1/L2/W1/W2 convention. Re-import as PolyBoard, or ` +
          `supply a custom column map, to preserve edge-banding.`,
        );
        warnedForUnknown = true;
      }
      edgeBanding = undefined;
    }

    const part: PartEntry = {
      partNumber: trustPolyBoardMapping ? `PB-${index + 1}` : `P-${index + 1}`,
      name: entry.partName.trim(),
      partType,
      length: entry.length,
      width: entry.width,
      thickness: entry.thickness,
      quantity: entry.qty,
      materialName: entry.material,
      grainDirection: entry.grainDirection,
      edgeBanding,
      source: trustPolyBoardMapping ? 'polyboard' : 'csv-import',
      importedFrom: csvFileName,
    };

    // P21.11 — resolve the CSV material string against the finish library.
    if (options.finishes && options.finishes.length > 0) {
      const resolved = resolveMaterialByName(
        entry.material,
        options.finishes,
        options.preferredFinishIds,
      );
      if (resolved) {
        part.materialId = resolved.finishId;
        part.materialCode = resolved.finishCode;
        part.materialName = resolved.finishName || entry.material;
        part.inventoryItemId = resolved.inventoryItemId;
        part.materialResolutionSource = resolved.source;
        part.materialResolutionConfidence = resolved.confidence;
      } else {
        part.materialResolutionSource = 'ai-guess';
        part.materialResolutionConfidence = 0;
      }
    }

    return part;
  });
}

// ---------------------------------------------------------------------------
// Diffing
// ---------------------------------------------------------------------------

/**
 * Compare existing parts against incoming parts.
 *
 * Matching is performed by **name** (case-insensitive) + **materialName**.
 * If a match is found but any dimension differs by more than 1 mm the part is
 * considered *modified*; otherwise it is *unchanged*. Parts with no match in
 * the existing set are *added*.
 */
export function diffParts(
  existing: PartEntry[],
  incoming: PartEntry[],
): { added: PartEntry[]; modified: PartEntry[]; unchanged: PartEntry[] } {
  const added: PartEntry[] = [];
  const modified: PartEntry[] = [];
  const unchanged: PartEntry[] = [];

  for (const inc of incoming) {
    const match = existing.find(
      (ex) =>
        ex.name.toLowerCase() === inc.name.toLowerCase() &&
        ex.materialName === inc.materialName,
    );

    if (!match) {
      added.push(inc);
    } else {
      const dimsDiffer =
        Math.abs(match.length - inc.length) > 1 ||
        Math.abs(match.width - inc.width) > 1 ||
        Math.abs(match.thickness - inc.thickness) > 1;

      if (dimsDiffer) {
        modified.push(inc);
      } else {
        unchanged.push(inc);
      }
    }
  }

  return { added, modified, unchanged };
}

// ---------------------------------------------------------------------------
// Firestore sync
// ---------------------------------------------------------------------------

/**
 * Compute the final parts array for a sync given the current server
 * state and the incoming proposal. Pure function — extracted so the
 * merge policy is testable without Firestore.
 *
 * - `'replace'` — incoming parts win wholesale.
 * - `'merge'`   — incoming parts overlay existing by `name|materialName`
 *                 (case-insensitive name). Untouched entries survive.
 */
export function computeFinalParts(
  existing: PartEntry[],
  incoming: PartEntry[],
  mode: 'replace' | 'merge',
): PartEntry[] {
  if (mode === 'replace') return incoming;

  const { added, modified } = diffParts(existing, incoming);
  const mergedMap = new Map<string, PartEntry>();
  for (const p of existing) {
    mergedMap.set(`${p.name.toLowerCase()}|${p.materialName}`, p);
  }
  for (const p of modified) {
    mergedMap.set(`${p.name.toLowerCase()}|${p.materialName}`, p);
  }
  for (const p of added) {
    mergedMap.set(`${p.name.toLowerCase()}|${p.materialName}`, p);
  }
  return Array.from(mergedMap.values());
}

/**
 * Sync part entries to a Design Manager design item in Firestore.
 *
 * P6: optimistic concurrency. Callers can supply `baseVersion` — the
 * `partsVersion` they observed when they began editing. If the server
 * has moved past it, the write is rejected with `PartsConcurrencyError`
 * so the UI can surface a 3-way merge prompt instead of silently
 * clobbering a design-manager edit.
 *
 * Callers that have no `baseVersion` (legacy code paths, or a brand-new
 * item being populated for the first time) can omit it. The version
 * still bumps so a subsequent sync from another client WILL see the
 * drift.
 *
 * @param mode
 *  - `'replace'` — overwrites `parts` entirely with incoming parts.
 *  - `'merge'`   — keeps existing parts that are not in the incoming set,
 *                   adds new ones, and updates matched ones.
 *
 * @param extras — optional `additionalUpdates` merged into the same
 *   versioned `writePartsWithVersion` call (e.g. `partsSummary: deleteField()`).
 *
 * @returns The total number of parts written and the new `partsVersion`.
 */
export interface SyncPartsToDesignItemExtras {
  additionalUpdates?: Record<string, unknown>;
}

export async function syncPartsToDesignItem(
  projectId: string,
  itemId: string,
  parts: PartEntry[],
  mode: 'replace' | 'merge',
  userId: string,
  baseVersion?: number,
  writeScope?: 'scene-origin' | 'procurement',
  extras?: SyncPartsToDesignItemExtras,
): Promise<{ synced: number; version: number }> {
  // For 'merge' we need the existing parts to compute the final array.
  // For 'replace' we'd otherwise skip the read entirely — but we still
  // need to know what's there if the caller didn't pass a baseVersion
  // (so the subsequent version-bump helper can grow from the correct
  // basis). We read unconditionally to keep the path simple; it's one
  // extra round trip but the sync UX is already async.
  //
  // When `writeScope` is set, the downstream `writePartsWithVersion`
  // handles the splice for us — caller only owns THEIR namespace, the
  // other namespace is preserved automatically. In that path we skip
  // the merge-with-existing step here to avoid double-work.
  let existingParts: PartEntry[] = [];
  if (mode === 'merge' && !writeScope) {
    const itemRef = doc(db, 'designProjects', projectId, 'designItems', itemId);
    const snap = await getDoc(itemRef);
    existingParts = snap.exists() ? ((snap.data() as { parts?: PartEntry[] }).parts ?? []) : [];
  }

  const finalParts = writeScope
    ? parts  // writePartsWithVersion splices against the current doc
    : computeFinalParts(existingParts, parts, mode);

  const result = await writePartsWithVersion(
    projectId,
    itemId,
    finalParts as unknown as Parameters<typeof writePartsWithVersion>[2],
    {
      baseVersion,
      userId,
      source: mode === 'replace' ? 'studio-sync-replace' : 'studio-sync-merge',
      writeScope,
      ...(extras?.additionalUpdates
        ? { additionalUpdates: extras.additionalUpdates }
        : {}),
    },
  );

  return { synced: result.writtenCount, version: result.version };
}
