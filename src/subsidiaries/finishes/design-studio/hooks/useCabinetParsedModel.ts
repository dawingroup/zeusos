/**
 * useCabinetParsedModel — Load a scene cabinet's GLB into a ParsedModel.
 *
 * `ModelProcessingPanel.canProcess` gates on `parsedModel`, but a scene
 * cabinet only carries Storage URLs (`glbUrl` or `sourceModelUrl` when it
 * was born from AI multi-cabinet detection). This hook bridges the gap:
 * fetch the GLB once per URL, parse it via the existing `parseGLB` utility,
 * and — if the cabinet is a subset of a shared source — filter `objects`
 * down to the cabinet's `sourceMeshNames` (exactly the `meshFilter` pattern
 * that BulkCabinetImportDialog already uses per-cabinet).
 *
 * Fetches are cached per URL (module-level Map) so N cabinets that share a
 * single source GLB trigger exactly one network download, not N.
 */
import { useEffect, useState, useRef } from 'react';
import type { SceneCabinet } from '../types/scene.types';
import type { ParsedModel } from '../types/workshop-viewer.types';
import { parseGLB } from '../services/parserGlb';

interface UseCabinetParsedModelResult {
  parsedModel: ParsedModel | null;
  isLoading: boolean;
  error: Error | null;
}

// Module-level cache keyed by URL. Value is the parse promise so parallel
// callers for the same URL share a single fetch.
const parseCache = new Map<string, Promise<ParsedModel>>();

/**
 * Load + parse a GLB URL, with module-level de-dupe of concurrent fetches.
 * Used by `useCabinetParsedModel` and by scene part-mode mesh-bbox index.
 */
export async function fetchAndParse(url: string): Promise<ParsedModel> {
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
    // Don't cache failures — next attempt should retry.
    parseCache.delete(url);
    throw err;
  }
}

/**
 * Filter a ParsedModel's `objects` down to the named meshes belonging to
 * one cabinet. Uses the same 3-strategy matcher as `useSceneViewport` +
 * `scenePrintPackage.service`:
 *   1. `userData.dawinMeshId` — stable ID written at export time
 *   2. exact `mesh.name`
 *   3. normalized name (trim + whitespace→underscore + lowercased)
 *
 * Falls back to the full model on zero matches so the AI-processing button
 * enables even when mesh names were sanitized during GLTF export.
 */
export function applyMeshFilter(model: ParsedModel, wantedNames: string[]): ParsedModel {
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
  if (filtered.length === 0) {
    console.warn(
      `[useCabinetParsedModel] 0 of ${wantedNames.length} sourceMeshNames ` +
      `matched against GLB (wanted=`, wantedNames.slice(0, 5),
      'raw sample=', (model.objects ?? []).slice(0, 5).map(o => ({ name: o.name, id: o.dawinMeshId })),
      `). Falling back to full model so AI processing can still run.`,
    );
    return model;
  }
  return { ...model, objects: filtered };
}

/** Fetch a cabinet's GLB and scope meshes to `sourceMeshNames` when set. */
export async function loadParsedModelForCabinetGlb(
  url: string,
  sourceMeshNames: string[] | undefined,
): Promise<ParsedModel> {
  const model = await fetchAndParse(url);
  const f = sourceMeshNames ?? [];
  return f.length > 0 ? applyMeshFilter(model, f) : model;
}

export function useCabinetParsedModel(
  sceneId: string | null,
  cabinet: SceneCabinet | null,
): UseCabinetParsedModelResult {
  const [parsedModel, setParsedModel] = useState<ParsedModel | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Guard against setting state after unmount or after a newer cabinet took over.
  const lastRequestId = useRef(0);

  // Derive *primitive* effect dependencies so the effect doesn't re-fire on
  // every render just because `cabinet` is a fresh object literal from
  // `useCabinet`'s setState. `sourceMeshNames` is joined into a stable key
  // so the effect runs once per real cabinet selection. NOTE: computed
  // inline (no useMemo) to keep the hook order identical on every render —
  // the component this hook is used in (CabinetDetailPanel) was hitting
  // React error #310 when hooks were added behind it.
  const url = cabinet?.sourceModelUrl || cabinet?.glbUrl || '';
  const meshFilterKey = (cabinet?.sourceMeshNames ?? []).join('|');

  useEffect(() => {
    if (!sceneId || !url) {
      setParsedModel(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++lastRequestId.current;
    setIsLoading(true);
    setError(null);
    setParsedModel(null);

    const meshFilter = meshFilterKey ? meshFilterKey.split('|') : [];
    fetchAndParse(url)
      .then(model => {
        if (requestId !== lastRequestId.current) return;
        const scoped = meshFilter.length > 0
          ? applyMeshFilter(model, meshFilter)
          : model;
        setParsedModel(scoped);
        setIsLoading(false);
      })
      .catch(err => {
        if (requestId !== lastRequestId.current) return;
        setError(err as Error);
        setIsLoading(false);
        console.warn(`[useCabinetParsedModel] Failed to load ${url}:`, err);
      });
  }, [sceneId, url, meshFilterKey]);

  return { parsedModel, isLoading, error };
}
