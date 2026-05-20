/**
 * bulkProcessModels — batch "Process with AI" across every cabinet in
 * a scene. Reuses the same `processModel` pipeline as the per-cabinet
 * ModelProcessingPanel so output is identical (modelPackage/current
 * with grouping + parts + materials + BOM).
 *
 * The GLB fetch is the slow part — cabinets that share a source GLB
 * (the Bulk Import path) have their parse result cached in-module, so
 * N cabinets on one source model trigger one download, not N.
 *
 * Runs sequentially (not parallel) because:
 *   - processModel calls Anthropic via `aiGroupModel`; parallel bursts
 *     of ~20 cabinets would trip rate limits and produce noisy
 *     partial failures.
 *   - progress reporting stays comprehensible — one cabinet at a time
 *     with a clear "3 of 12" status.
 */
import type { SceneCabinet } from '../types/scene.types';
import type { ParsedModel } from '../types/workshop-viewer.types';
import { processModel, type ProcessModelResult } from './processModel.service';
import { parseGLB } from './parserGlb';

export interface BulkProcessProgress {
  /** Zero-based index of the cabinet currently being processed. */
  index: number;
  total: number;
  cabinetId: string;
  cabinetLabel: string;
  /** Sub-step inside processModel (grouping / materials / bom / …). */
  step?: string;
  /** Free-text status — "Fetching GLB", "Running AI grouping", etc. */
  message?: string;
}

export interface BulkProcessRowResult {
  cabinetId: string;
  cabinetLabel: string;
  status: 'ok' | 'skipped' | 'error';
  detail?: string;
  assemblies?: number;
  parts?: number;
  durationMs?: number;
}

export interface BulkProcessSummary {
  ok: number;
  skipped: number;
  errored: number;
  totalMs: number;
  rows: BulkProcessRowResult[];
}

// Module-level cache of parsed-GLB promises, keyed by URL. Matches the
// cache in `useCabinetParsedModel` — N cabinets on one shared source
// GLB hit the network exactly once.
const parseCache = new Map<string, Promise<ParsedModel>>();

async function fetchAndParse(url: string): Promise<ParsedModel> {
  const hit = parseCache.get(url);
  if (hit) return hit;
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GLB fetch failed (${res.status}) for ${url}`);
    const buf = await res.arrayBuffer();
    return parseGLB(buf);
  })();
  parseCache.set(url, p);
  try {
    return await p;
  } catch (err) {
    parseCache.delete(url);
    throw err;
  }
}

function applyMeshFilter(model: ParsedModel, wantedNames: string[]): ParsedModel {
  if (wantedNames.length === 0) return model;
  const normalize = (s: string) => s.trim().replace(/\s+/g, '_').toLowerCase();
  const wantedExact = new Set(wantedNames);
  const wantedNormalized = new Set(wantedNames.map(normalize));
  const filtered = (model.objects ?? []).filter(o => {
    if (o.dawinMeshId && wantedExact.has(o.dawinMeshId)) return true;
    if (wantedExact.has(o.name)) return true;
    if (wantedNormalized.has(normalize(o.name ?? ''))) return true;
    return false;
  });
  // Fall back to full model on zero matches — same policy as
  // useCabinetParsedModel. Lets AI grouping still run rather than
  // silently skipping the cabinet.
  return filtered.length === 0 ? model : { ...model, objects: filtered };
}

export interface BulkProcessOptions {
  /** When true, skip cabinets that already have a modelPackage — only
   *  process the unprocessed ones. Default: false (reprocess all). */
  skipProcessed?: boolean;
  onProgress?: (p: BulkProcessProgress) => void;
  /** Called after each cabinet finishes (ok / skipped / error). */
  onRowComplete?: (row: BulkProcessRowResult) => void;
}

/**
 * Process every cabinet in the list. Sequential. Errors on one
 * cabinet don't abort the batch — they land in `rows` as
 * `status: 'error'` and processing continues.
 */
export async function bulkProcessModels(
  sceneId: string,
  cabinets: SceneCabinet[],
  options: BulkProcessOptions = {},
): Promise<BulkProcessSummary> {
  const { skipProcessed = false, onProgress, onRowComplete } = options;
  const start = Date.now();
  const rows: BulkProcessRowResult[] = [];
  let ok = 0, skipped = 0, errored = 0;

  for (let i = 0; i < cabinets.length; i++) {
    const cab = cabinets[i];
    const label = cab.cabinetCode || cab.displayName || cab.id;

    if (skipProcessed && cab.packageId) {
      skipped++;
      const row: BulkProcessRowResult = { cabinetId: cab.id, cabinetLabel: label, status: 'skipped', detail: 'Already processed' };
      rows.push(row);
      onRowComplete?.(row);
      continue;
    }

    const url = cab.sourceModelUrl || cab.glbUrl;
    if (!url) {
      errored++;
      const row: BulkProcessRowResult = { cabinetId: cab.id, cabinetLabel: label, status: 'error', detail: 'No GLB URL on cabinet' };
      rows.push(row);
      onRowComplete?.(row);
      continue;
    }

    onProgress?.({ index: i, total: cabinets.length, cabinetId: cab.id, cabinetLabel: label, message: 'Fetching model…' });

    try {
      const rawModel = await fetchAndParse(url);
      const meshNames = cab.sourceMeshNames ?? [];
      const scoped = meshNames.length > 0 ? applyMeshFilter(rawModel, meshNames) : rawModel;

      let lastStep: string | undefined;
      const result: ProcessModelResult = await processModel({
        sceneId,
        cabinetId: cab.id,
        cabinet: cab,
        parsedModel: scoped,
        archetypeKey: cab.archetypeId,
        archetypeKeys: cab.archetypeIds,
        modelName: cab.displayName,
        fileType: 'glb',
        onProgress: (update) => {
          lastStep = update.step;
          onProgress?.({
            index: i,
            total: cabinets.length,
            cabinetId: cab.id,
            cabinetLabel: label,
            step: update.step,
            message: update.message,
          });
        },
      });

      void lastStep;
      ok++;
      const row: BulkProcessRowResult = {
        cabinetId: cab.id,
        cabinetLabel: label,
        status: 'ok',
        assemblies: result.grouping.assemblies.length,
        parts: result.grouping.parts.length,
        durationMs: result.durationMs,
      };
      rows.push(row);
      onRowComplete?.(row);
    } catch (err) {
      errored++;
      const row: BulkProcessRowResult = {
        cabinetId: cab.id,
        cabinetLabel: label,
        status: 'error',
        detail: (err as Error).message || 'Processing failed',
      };
      rows.push(row);
      onRowComplete?.(row);
    }
  }

  return {
    ok,
    skipped,
    errored,
    totalMs: Date.now() - start,
    rows,
  };
}
