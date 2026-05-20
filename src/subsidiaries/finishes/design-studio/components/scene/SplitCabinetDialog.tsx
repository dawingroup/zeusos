/**
 * SplitCabinetDialog — detect + confirm splitting a cabinet that
 * really contains multiple physical units.
 *
 * Flow:
 *   1. Open → runs detectSubCabinets against the cabinet's mesh
 *      bboxes with the current gap tolerance. Shows clusters + any
 *      orphan meshes.
 *   2. Dry-run preview → splitCabinet({ dryRun: true }) computes
 *      per-child cabinet code, position, size, and how many
 *      assemblies / parts land in each. User sees the split before
 *      committing.
 *   3. Confirm → splitCabinet() creates N cabinets + deletes the
 *      source. Parent refetches scene + closes dialog.
 *
 * The gap tolerance slider (10–200mm) lets the user tune the
 * clusterer when the default 50mm under- or over-splits their
 * geometry.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  X, Loader2, Scissors, Check, AlertTriangle, ArrowRight, Boxes,
} from 'lucide-react';
import type { SceneCabinet } from '../../types/scene.types';
import type { GeomBox } from '../../services/partGeometryClassifier';
import {
  detectSubCabinets, type DetectionResult,
} from '../../services/splitCabinetDetection';
import { splitCabinet, type SplitResult } from '../../services/splitCabinetService';

interface Props {
  sceneId: string;
  cabinet: SceneCabinet;
  meshBboxes: ReadonlyMap<string, GeomBox>;
  onClose: () => void;
  onSplit?: () => void;
}

export function SplitCabinetDialog({
  sceneId, cabinet, meshBboxes, onClose, onSplit,
}: Props) {
  const [gapToleranceMm, setGapToleranceMm] = useState(50);
  const [committing, setCommitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<SplitResult | null>(null);

  // Source mesh list — bulk-import cabinets use sourceMeshNames; if
  // missing (GLB-local cabinets), fall back to the bbox map's keys.
  const meshNames = useMemo(() => {
    if (cabinet.sourceMeshNames?.length) return cabinet.sourceMeshNames;
    return Array.from(meshBboxes.keys());
  }, [cabinet.sourceMeshNames, meshBboxes]);

  const detection: DetectionResult = useMemo(
    () => detectSubCabinets(meshNames, meshBboxes, { gapToleranceMm }),
    [meshNames, meshBboxes, gapToleranceMm],
  );

  // Dry-run the split to preview per-child payloads without writing.
  const [preview, setPreview] = useState<SplitResult | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  useEffect(() => {
    setPreviewErr(null);
    setPreview(null);
    if (detection.clusters.length < 2) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await splitCabinet(sceneId, cabinet, detection.clusters, { dryRun: true });
        if (!cancelled) setPreview(res);
      } catch (e) {
        if (!cancelled) setPreviewErr((e as Error).message || 'Preview failed');
      }
    })();
    return () => { cancelled = true; };
  }, [sceneId, cabinet, detection.clusters]);

  const canSplit = detection.clusters.length >= 2 && !cabinet.isLocked && !committing && !done;

  const handleSplit = async () => {
    setErr(null);
    setCommitting(true);
    try {
      const res = await splitCabinet(sceneId, cabinet, detection.clusters);
      setDone(res);
      onSplit?.();
    } catch (e) {
      setErr((e as Error).message || 'Split failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background rounded-lg shadow-xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-3 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Scissors className="h-4 w-4 text-boysenberry" /> Split cabinet
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Detect logically-separate cabinets inside {cabinet.cabinetCode || cabinet.displayName}
            </p>
          </div>
          <button
            type="button" onClick={onClose}
            className="p-1 rounded hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-auto p-3 space-y-3">
          {/* Gap tolerance control */}
          <section className="rounded-md border border-border bg-card p-2.5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium">Gap tolerance</label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {gapToleranceMm} mm
              </span>
            </div>
            <input
              type="range"
              min={10} max={200} step={5}
              value={gapToleranceMm}
              onChange={e => setGapToleranceMm(Number(e.target.value))}
              disabled={committing || !!done}
              className="w-full"
            />
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              Two meshes are in the same cluster when their bboxes touch or are within this gap on every axis.
              Default 50 mm — widen to merge cabinets with thick gaps between them, narrow to split tightly-packed units.
            </p>
          </section>

          {/* Detection summary */}
          {detection.clusters.length < 2 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Only one cluster detected — nothing to split.</p>
                <p className="text-[11px] mt-0.5 opacity-90">
                  The clusterer found a single connected group. If you expect multiple cabinets,
                  reduce the gap tolerance above.
                </p>
              </div>
            </div>
          ) : (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {detection.clusters.length} clusters detected
              </h3>
              <ul className="space-y-1.5">
                {(preview?.children ?? detection.clusters).map((_item, i) => {
                  const previewRow = preview?.children[i];
                  const clust = detection.clusters[i];
                  return (
                    <li key={i} className="rounded-md border border-border bg-card p-2">
                      <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded bg-boysenberry text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {previewRow?.cabinetCode ?? `${cabinet.cabinetCode || 'CAB'}-${i + 1}`}
                            {previewRow?.inheritsDesignItemId && (
                              <span className="ml-1.5 text-[9px] font-normal text-muted-foreground">
                                (inherits DesignItem)
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {Math.round(clust.size.width)}×{Math.round(clust.size.depth)}×{Math.round(clust.size.height)}mm
                            · {clust.meshNames.length} meshes
                            {previewRow && ` · ${previewRow.assemblyCount} assembl${previewRow.assemblyCount === 1 ? 'y' : 'ies'} · ${previewRow.partCount} parts`}
                          </p>
                        </div>
                        <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Orphan warning */}
          {detection.orphans.length > 0 && !done && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-2 text-[11px] text-blue-900">
              <p className="font-medium">
                {detection.orphans.length} mesh{detection.orphans.length === 1 ? '' : 'es'} didn&apos;t fit any cluster
              </p>
              <p className="mt-0.5 leading-snug">
                These will stay with cluster 1 as a safety net so nothing is lost:{' '}
                <span className="font-mono text-[10px]">
                  {detection.orphans.slice(0, 5).join(', ')}
                  {detection.orphans.length > 5 && ` + ${detection.orphans.length - 5} more`}
                </span>
              </p>
            </div>
          )}

          {/* Previews errors */}
          {previewErr && (
            <p className="text-[11px] text-red-600">Preview failed: {previewErr}</p>
          )}
          {err && <p className="text-[11px] text-red-600">{err}</p>}

          {/* Done */}
          {done && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-900 space-y-1">
              <p className="font-medium flex items-center gap-1">
                <Check className="h-4 w-4" /> Split complete — {done.children.length} cabinets created
              </p>
              <p className="text-[11px]">
                The source cabinet was replaced. Reassign DesignItems on the new cabinets via the Reassign button.
              </p>
            </div>
          )}
        </div>

        <footer className="flex justify-between items-center p-3 border-t border-border gap-2">
          <span className="text-[11px] text-muted-foreground">
            {cabinet.isLocked
              ? 'Cabinet is locked — unlock before splitting'
              : `Will delete the source cabinet (${cabinet.cabinetCode || cabinet.id})`}
          </span>
          <div className="flex gap-2">
            <button
              type="button" onClick={onClose}
              className="text-xs px-3 py-1.5 rounded border border-border hover:bg-accent"
            >
              {done ? 'Close' : 'Cancel'}
            </button>
            {!done && (
              <button
                type="button"
                onClick={handleSplit}
                disabled={!canSplit}
                className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-1"
              >
                {committing
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <ArrowRight className="h-3.5 w-3.5" />}
                Split into {detection.clusters.length}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
