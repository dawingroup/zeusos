/**
 * SceneFilesPanel — asset manifest for a scene.
 *
 * Lists every 3D / image asset referenced by the scene so users can:
 *   - Confirm the source GLB is actually persisted (common "no model
 *     shows" diagnosis — if there's no row here, Bulk Import didn't
 *     upload; see the bulk-import fix in commit 4e83d5ed).
 *   - Download per-cabinet GLBs / thumbnails / renders for sharing.
 *   - Spot-check storage URLs during debugging.
 *
 * Deduplication: most scenes have ONE source GLB shared across every
 * cabinet (Bulk Import workflow), so we group by `sourceModelUrl`
 * and show a single "Source model" row rather than N duplicates.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileBox, Image as ImageIcon, Box, ExternalLink, Send, Loader2,
  AlertCircle, AlertTriangle, Info, Sparkles, Check, MessageSquare,
  Cpu,
} from 'lucide-react';
import type { SceneCabinet } from '../../types/scene.types';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  writeSceneOriginParts,
  listProcurementSourceCounts,
  deleteProcurementRowsBySource,
  getBlockingSyncErrorMessageForDesignItem,
  type PairingStrategy,
  type SyncResult,
} from '../../services/designItemPartsSyncFromScene';
import { SceneSyncReviewDialog } from './SceneSyncReviewDialog';
import {
  bulkProcessModels, type BulkProcessRowResult,
} from '../../services/bulkProcessModels';
import {
  uploadPartsCsv,
  clearPartsCsv,
  uploadCabinetPartsCsv,
  clearCabinetPartsCsv,
} from '../../services/uploadPartsCsv';
import type { ScenePartsCsvOverlay } from '../../types/scene.types';
import { useSceneDesignItems } from '../../hooks/useSceneDesignItems';
import {
  analyzePartsQuality,
  collectAuditableParts,
  type PartsQualityReport,
  type PartIssueSeverity,
  type PartIssue,
} from '../../services/partsQualityHelper';
import { applyPartNameEnhancements, type PartRename } from '../../services/partsQualityApply';
import { createDesignItemIssue } from '@/modules/design-manager/services/designItemIssueService';
import type { IssueKind, IssueSeverity } from '@/modules/design-manager/types/designItemIssue';
import { raiseStaleRevisionIssues } from '../../services/staleRevisionDetector';
import { batchApplyRevisionToScene, type BatchApplyResult } from '../../services/revisionPartsRefresh';
import { subscribeToRevisions } from '../../services/designRevisionService';
import type { DesignRevision } from '../../types/designRevision.types';
import { usePartsReviewMaterialMappings } from '../../hooks/usePartsReviewMaterialMappings';
import { UploadRevisedModelButton } from '../handoff/UploadRevisedModelButton';
import { ArchitecturalPlansSection } from './ArchitecturalPlansSection';
import type { SceneArchitecturalAsset } from '../../types/scene.types';

/** Snapshot from `useAutoPartsSync` — surfaces background sync failures in the Files drawer. */
export interface SceneAutoPartsSyncState {
  syncing: Set<string>;
  lastResults: Map<string, { synced: number; at: Date }>;
  lastErrors: Map<string, string>;
}

interface SceneFilesPanelProps {
  cabinets: SceneCabinet[];
  sceneId?: string;
  projectId?: string;
  /** Scene-level architectural plans / sections attached to the scene. */
  architecturalAssets?: SceneArchitecturalAsset[];
  /** Currently-cached cutlist overlay (if one's been uploaded). The
   *  upload UI only needs to know it's there so it can show "Replace"
   *  vs "Upload". */
  partsCsvOverlay?: ScenePartsCsvOverlay;
  /** Called after a scene-scoped write (architectural upload / remove)
   *  so the parent re-fetches and propagates the new assets array. */
  onSceneChanged?: () => void;
  /** Increment to force-scroll the panel to Design Manager sync section. */
  focusSyncSignal?: number;
  /** Background auto-sync (debounced) — show errors and in-progress state next to manual sync. */
  autoPartsSyncState?: SceneAutoPartsSyncState;
}

/** Inferred asset kind for icon + label. */
type AssetKind = 'source' | 'glb' | 'thumbnail' | 'render';

interface AssetRow {
  kind: AssetKind;
  label: string;
  url: string;
  /** Cabinets using this asset (for dedup display). */
  cabinetRefs: string[];
}

const KIND_META: Record<AssetKind, { icon: typeof FileBox; tint: string; description: string }> = {
  source: {
    icon: FileBox,
    tint: 'text-purple-700 bg-purple-100',
    description: 'Shared source model — every cabinet tagged with its mesh subset is rendered from this GLB.',
  },
  glb: {
    icon: Box,
    tint: 'text-blue-700 bg-blue-100',
    description: 'Per-cabinet GLB export.',
  },
  thumbnail: {
    icon: ImageIcon,
    tint: 'text-amber-700 bg-amber-100',
    description: 'Thumbnail preview.',
  },
  render: {
    icon: ImageIcon,
    tint: 'text-emerald-700 bg-emerald-100',
    description: 'Rendered still.',
  },
};

function shortenUrl(url: string): string {
  try {
    const u = new URL(url);
    // Storage URLs look like …/o/<encoded-path>?alt=media&token=…
    const encodedPath = u.pathname.split('/o/')[1] ?? u.pathname;
    const path = decodeURIComponent(encodedPath);
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  } catch {
    return url.slice(0, 40) + (url.length > 40 ? '…' : '');
  }
}

export function SceneFilesPanel({
  cabinets, sceneId, projectId, architecturalAssets = [], partsCsvOverlay, onSceneChanged,
  focusSyncSignal = 0,
  autoPartsSyncState,
}: SceneFilesPanelProps) {
  useEffect(() => {
    if (!focusSyncSignal) return;
    const el = document.getElementById('scene-files-design-manager-sync');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusSyncSignal]);

  const rows = useMemo<AssetRow[]>(() => {
    const sourceMap = new Map<string, AssetRow>();
    const out: AssetRow[] = [];

    for (const cab of cabinets) {
      const label = cab.cabinetCode || cab.displayName || cab.id;

      // Source GLB — dedupe by URL so one bulk-imported source shows once.
      if (cab.sourceModelUrl) {
        const existing = sourceMap.get(cab.sourceModelUrl);
        if (existing) {
          existing.cabinetRefs.push(label);
        } else {
          const row: AssetRow = {
            kind: 'source',
            label: 'Source model',
            url: cab.sourceModelUrl,
            cabinetRefs: [label],
          };
          sourceMap.set(cab.sourceModelUrl, row);
          out.push(row);
        }
      }

      if (cab.glbUrl) {
        out.push({ kind: 'glb', label: `${label} — GLB`, url: cab.glbUrl, cabinetRefs: [label] });
      }
      if (cab.thumbnailUrl) {
        out.push({ kind: 'thumbnail', label: `${label} — Thumbnail`, url: cab.thumbnailUrl, cabinetRefs: [label] });
      }
      if (cab.renderUrl) {
        out.push({ kind: 'render', label: `${label} — Render`, url: cab.renderUrl, cabinetRefs: [label] });
      }
    }
    return out;
  }, [cabinets]);

  if (cabinets.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground leading-relaxed">
        Add a cabinet to see its assets here.
      </div>
    );
  }

  const counts = rows.reduce<Record<AssetKind, number>>(
    (acc, r) => { acc[r.kind] = (acc[r.kind] ?? 0) + 1; return acc; },
    { source: 0, glb: 0, thumbnail: 0, render: 0 },
  );

  return (
    <div className="p-3 space-y-4">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Scene Files
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {counts.source} source · {counts.glb} GLB · {counts.thumbnail} thumbnail · {counts.render} render
        </p>
      </div>

      {/* Upload updated 3D model — scene-level entry point into the
          revision → parts refresh loop. Creates one project-scoped
          revision; the Apply button in the DM Sync section below picks
          it up automatically. */}
      {projectId && (
        <UploadRevisedModelButton projectId={projectId} />
      )}

      {sceneId && (
        <ArchitecturalPlansSection
          sceneId={sceneId}
          assets={architecturalAssets}
          onChanged={onSceneChanged}
        />
      )}

      {/* Parts Review — name enhancement + inconsistency flags. Runs on
          every cabinet in the scene; shows nothing when the parts list
          is empty to avoid visual noise on fresh scenes. */}
      {sceneId && cabinets.some(c => (c.assemblies ?? []).some(a => (a.parts ?? []).length > 0)) && (
        <PartsReviewSection sceneId={sceneId} projectId={projectId} cabinets={cabinets} />
      )}

      {/* Parts cutlist CSV overlay — optional but powerful: upload the
          PolyBoard / SketchUp cutlist that matches this 3D model and
          the DM parts sync will use it as the authoritative source
          for cut dimensions, material, grain, edge banding. GLB bbox
          numbers are envelope-including-hardware; the CSV has the
          actual cut spec. */}
      {sceneId && (
        <PartsCsvSection
          sceneId={sceneId}
          projectId={projectId}
          cabinets={cabinets}
          overlay={partsCsvOverlay}
          onChanged={onSceneChanged}
        />
      )}

      {/* Bulk AI processing — kicks off `processModel` for every cabinet
          in the scene, sequentially, with per-row status. Reuses the
          GLB-parse cache so cabinets that share a source model hit the
          network exactly once. */}
      {sceneId && cabinets.length > 0 && (
        <BulkProcessSection sceneId={sceneId} cabinets={cabinets} />
      )}

      {/* Design Manager parts sync (scene-level). Only meaningful when the
          scene has a projectId and at least one cabinet bound to a
          DesignItem — otherwise nothing to push. */}
      {sceneId && projectId && (
        <div id="scene-files-design-manager-sync">
          <DesignManagerSyncSection
            sceneId={sceneId}
            projectId={projectId}
            cabinets={cabinets}
            autoPartsSyncState={autoPartsSyncState}
          />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
          None of the cabinets in this scene have stored assets. If they
          were created via Bulk Import, the source GLB upload may have
          failed — try re-running the import.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((row, i) => {
            const meta = KIND_META[row.kind];
            const Icon = meta.icon;
            return (
              <li key={`${row.kind}-${i}`} className="rounded-md border border-border p-2 flex items-start gap-2">
                <div className={`shrink-0 h-7 w-7 rounded flex items-center justify-center ${meta.tint}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" title={row.label}>
                    {row.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate font-mono" title={row.url}>
                    {shortenUrl(row.url)}
                  </p>
                  {row.cabinetRefs.length > 1 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Shared by {row.cabinetRefs.length} cabinets
                    </p>
                  )}
                </div>
                <a
                  href={row.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  className="shrink-0 h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Parts CSV overlay — scene-level cutlist upload (Studio is the merge point).
//
// Upload a PolyBoard / SketchUp / generic cutlist CSV. Parsed with
// the same `csvParser` Design Manager's Parts Import uses, so a CSV
// that imports cleanly there imports cleanly here. Rows are cached
// on the scene doc as `partsCsvOverlay`. On **Sync parts to Design
// Manager** (from this panel), each meshed ScenePart is matched to a
// CSV row in Design Studio; the merged PartEntrys are then written to
// the design item. Row matches override dimensions, material name, grain,
// and edge banding (authoritative for fabrication) while the model keeps
// geometry / mesh identity.
// ---------------------------------------------------------------------------

interface PartsCsvSectionProps {
  sceneId: string;
  projectId?: string;
  cabinets: SceneCabinet[];
  overlay?: ScenePartsCsvOverlay;
  onChanged?: () => void;
}

function csv(v: string): string {
  const s = v ?? '';
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function PartsCsvSection({ sceneId, projectId, cabinets, overlay, onChanged }: PartsCsvSectionProps) {
  const { user } = useAuth();
  const { byId: designItemsById } = useSceneDesignItems(projectId ?? '', cabinets);
  const [uploading, setUploading] = useState(false);
  const [cabinetBusy, setCabinetBusy] = useState<Record<string, boolean>>({});
  const [cabinetStatus, setCabinetStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rows: number; sourceType: string; warnings: string[]; skipped: number } | null>(null);
  const [coverage, setCoverage] = useState<{ totalRows: number; matchedByAnyCabinet: number; unmatchedRows: Array<{ name: string }> } | null>(null);
  const [matchReport, setMatchReport] = useState<Awaited<ReturnType<typeof import('../../services/designItemPartsSyncFromScene').buildSyncMatchReport>> | null>(null);
  const [reporting, setReporting] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  // Scene-level overlay: run heuristic coverage automatically so unmatched rows are visible without a click.
  useEffect(() => {
    if (!sceneId || !overlay?.rows?.length) {
      setCoverage(null);
      return;
    }
    let cancelled = false;
    setAnalysing(true);
    setError(null);
    void (async () => {
      try {
        const { analyzeCsvCoverage } = await import('../../services/designItemPartsSyncFromScene');
        const c = await analyzeCsvCoverage(sceneId);
        if (!cancelled) setCoverage(c);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Coverage analysis failed');
      } finally {
        if (!cancelled) setAnalysing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sceneId, overlay?.fileName, overlay?.rows?.length]);

  const hasCabinetOnlyCsv = useMemo(
    () => !overlay?.rows?.length && cabinets.some(c => (c.partsCsvOverlay?.rows?.length ?? 0) > 0),
    [overlay?.rows?.length, cabinets],
  );

  // Unique item ids bound to scene cabinets.
  const boundItems = useMemo(() => {
    const ids = new Set<string>();
    for (const c of cabinets) if (c.designItemId) ids.add(c.designItemId);
    return Array.from(ids).map(id => ({ id, name: designItemsById.get(id)?.name ?? id }));
  }, [cabinets, designItemsById]);

  const handleAnalyse = async () => {
    setAnalysing(true);
    setError(null);
    try {
      const { analyzeCsvCoverage } = await import('../../services/designItemPartsSyncFromScene');
      const c = await analyzeCsvCoverage(sceneId);
      setCoverage(c);
    } catch (e) {
      setError((e as Error).message || 'Coverage analysis failed');
    } finally {
      setAnalysing(false);
    }
  };

  const handleReconcile = async () => {
    setReporting(true);
    setError(null);
    try {
      const { buildSyncMatchReport } = await import('../../services/designItemPartsSyncFromScene');
      const r = await buildSyncMatchReport(sceneId);
      setMatchReport(r);
    } catch (e) {
      setError((e as Error).message || 'Match report failed');
    } finally {
      setReporting(false);
    }
  };

  const handleDownloadReport = () => {
    if (!matchReport) return;
    const rows: string[] = [];
    rows.push('type,cabinet,scenePart,sceneDims,csvRow,csvDims,matchedBy,notes');
    for (const m of matchReport.matchDetails) {
      rows.push(`matched,${csv(m.cabinetCode)},${csv(m.scenePartName)},,${csv(m.csvRowName)},,${m.matchedBy},`);
    }
    for (const s of matchReport.scenePartsWithoutCsv) {
      rows.push(`scene-only,${csv(s.cabinetCode)},${csv(s.partName)},${s.dims},,,,"will sync with bbox dims only"`);
    }
    for (const c of matchReport.csvRowsWithoutPart) {
      rows.push(`csv-only,,,"",${csv(c.name)},${c.dims},,"loose-part candidate · material ${csv(c.material)}"`);
    }
    for (const p of matchReport.potentialDuplicates) {
      rows.push(`POTENTIAL-DUP,${csv(p.scenePart.cabinetCode)},${csv(p.scenePart.partName)},${p.scenePart.dims},${csv(p.csvRow.name)},${p.csvRow.dims},,"dim delta ${p.dimDelta}mm — matcher missed"`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-match-report-${sceneId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);
    try {
      const r = await uploadPartsCsv(sceneId, file, user?.uid ?? '');
      setResult(r);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message || 'CSV parse failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    setError(null);
    setUploading(true);
    try {
      await clearPartsCsv(sceneId);
      setResult(null);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message || 'Failed to clear');
    } finally {
      setUploading(false);
    }
  };

  const handleCabinetFile = async (cabinetId: string, file: File | null) => {
    if (!file) return;
    setError(null);
    setCabinetStatus(prev => ({ ...prev, [cabinetId]: '' }));
    setCabinetBusy(prev => ({ ...prev, [cabinetId]: true }));
    try {
      const r = await uploadCabinetPartsCsv(sceneId, cabinetId, file, user?.uid ?? '');
      setCabinetStatus(prev => ({
        ...prev,
        [cabinetId]: `Parsed ${r.rows} rows (${r.sourceType})${r.skipped > 0 ? ` · ${r.skipped} skipped` : ''}`,
      }));
      onChanged?.();
    } catch (e) {
      setCabinetStatus(prev => ({ ...prev, [cabinetId]: (e as Error).message || 'Upload failed' }));
    } finally {
      setCabinetBusy(prev => ({ ...prev, [cabinetId]: false }));
    }
  };

  const handleClearCabinet = async (cabinetId: string) => {
    setError(null);
    setCabinetStatus(prev => ({ ...prev, [cabinetId]: '' }));
    setCabinetBusy(prev => ({ ...prev, [cabinetId]: true }));
    try {
      await clearCabinetPartsCsv(sceneId, cabinetId);
      setCabinetStatus(prev => ({ ...prev, [cabinetId]: 'Cleared' }));
      onChanged?.();
    } catch (e) {
      setCabinetStatus(prev => ({ ...prev, [cabinetId]: (e as Error).message || 'Clear failed' }));
    } finally {
      setCabinetBusy(prev => ({ ...prev, [cabinetId]: false }));
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Cutlist CSV overlay
        </h4>
        <div className="flex items-center gap-2">
          {overlay && (
            <button
              type="button"
              onClick={handleClear}
              disabled={uploading}
              className="text-[11px] px-2 py-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              Clear
            </button>
          )}
          <label className={`text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90 cursor-pointer inline-flex items-center gap-1 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileBox className="h-3 w-3" />}
            {overlay ? 'Replace CSV' : 'Upload CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={uploading}
              onChange={e => handleFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      {overlay ? (
        <div className="rounded-md border border-border p-2 text-[11px] space-y-0.5">
          <p className="font-medium truncate" title={overlay.fileName}>{overlay.fileName}</p>
          <p className="text-muted-foreground">
            {overlay.rows.length} rows · format: {overlay.sourceType}
          </p>
          <p className="text-muted-foreground leading-snug">
            On next sync, parts whose name matches a CSV row get their
            dimensions, material, grain, and edge banding from the CSV.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Upload the PolyBoard / SketchUp cutlist CSV that matches this
          model. Sync picks up cut dimensions, material name, grain, and
          edge banding from the CSV — GLB bboxes include hardware envelopes
          and don't match the fabricator's spec.
        </p>
      )}

      {cabinets.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-card p-2 space-y-1.5">
          <p className="text-[11px] font-medium">Per-cabinet overlays</p>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Upload a cabinet-scoped CSV when a scene has multiple cabinets with different part lists.
            Cabinet overlay takes priority over scene-level overlay for that cabinet.
          </p>
          <ul className="space-y-1">
            {cabinets.map(cab => {
              const busy = !!cabinetBusy[cab.id];
              const cabOverlay = cab.partsCsvOverlay;
              const status = cabinetStatus[cab.id];
              const label = cab.cabinetCode || cab.displayName || cab.id;
              return (
                <li key={cab.id} className="rounded border border-border p-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate">{label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {cabOverlay
                          ? `${cabOverlay.fileName} · ${cabOverlay.rows.length} rows (${cabOverlay.sourceType})`
                          : 'No cabinet-specific CSV'}
                      </p>
                    </div>
                    {cabOverlay && (
                      <button
                        type="button"
                        onClick={() => handleClearCabinet(cab.id)}
                        disabled={busy}
                        className="text-[10px] px-1.5 py-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        Clear
                      </button>
                    )}
                    <label className={`text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground rounded hover:opacity-90 cursor-pointer inline-flex items-center gap-1 ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileBox className="h-3 w-3" />}
                      {cabOverlay ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        disabled={busy}
                        onChange={e => handleCabinetFile(cab.id, e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                  {status && (
                    <p className="text-[10px] mt-1 text-muted-foreground">{status}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {result && (
        <p className="text-[11px] text-green-700 mt-1.5">
          Parsed {result.rows} rows ({result.sourceType}){result.skipped > 0 ? ` · ${result.skipped} skipped` : ''}
          {result.warnings.length > 0 && (
            <span className="block text-amber-700 mt-0.5">{result.warnings[0]}</span>
          )}
        </p>
      )}

      {/* Reconciliation — full side-by-side view of every ScenePart
          vs every CSV row, plus a potential-duplicate list where the
          matcher gave up but a human would likely pair them. This is
          the audit layer that stops scene-parts + csv-loose-imports
          from double-counting the same physical piece. */}
      {overlay && (
        <div className="mt-2 rounded-md border border-border bg-card p-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium">Match reconciliation</p>
            <div className="flex items-center gap-2">
              {matchReport && (
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="text-[11px] px-2 py-1 border border-border rounded hover:bg-accent"
                >
                  Download CSV
                </button>
              )}
              <button
                type="button"
                onClick={handleReconcile}
                disabled={reporting}
                className="text-[11px] px-2 py-1 border border-border rounded hover:bg-accent disabled:opacity-50"
              >
                {reporting ? 'Building…' : matchReport ? 'Rebuild' : 'Build match report'}
              </button>
            </div>
          </div>
          {!matchReport && (
            <p className="text-[10px] text-muted-foreground leading-snug">
              Diagnostic view: build a side-by-side report of every scene part
              and every CSV row — see what the heuristic matcher paired, what
              it missed, and any potential duplicates where the same physical
              part appears in both but didn&apos;t pair up. The actual sync in
              &ldquo;Design Manager sync&rdquo; section above uses AI pairing
              when a CSV is present, which catches most of these cases.
            </p>
          )}
          {matchReport && (
            <div className="text-[10px] space-y-1">
              <p>
                <span className="text-green-700">{matchReport.matched}/{matchReport.totalSceneParts} scene parts matched a CSV row</span>
                {' · '}
                <span className="text-muted-foreground">{matchReport.scenePartsWithoutCsv.length} scene-only</span>
                {' · '}
                <span className="text-muted-foreground">{matchReport.csvRowsWithoutPart.length} CSV-only</span>
              </p>
              {matchReport.potentialDuplicates.length > 0 && (
                <details className="rounded-md border border-red-300 bg-red-50 p-1.5">
                  <summary className="cursor-pointer text-red-800 font-medium">
                    ⚠ {matchReport.potentialDuplicates.length} potential duplicate{matchReport.potentialDuplicates.length === 1 ? '' : 's'} — matcher missed, human would pair
                  </summary>
                  <ul className="mt-1 space-y-0.5 pl-3 text-red-900">
                    {matchReport.potentialDuplicates.slice(0, 10).map((p, i) => (
                      <li key={i}>
                        <span className="font-mono">{p.scenePart.partName}</span> ({p.scenePart.cabinetCode} · {p.scenePart.dims})
                        {' ↔ '}
                        <span className="font-mono">{p.csvRow.name}</span> ({p.csvRow.dims})
                        <span className="text-red-700"> · Δ{p.dimDelta}mm</span>
                      </li>
                    ))}
                    {matchReport.potentialDuplicates.length > 10 && (
                      <li className="italic">…and {matchReport.potentialDuplicates.length - 10} more — download CSV to see all</li>
                    )}
                  </ul>
                  <p className="mt-1 text-red-800 text-[10px] leading-snug">
                    If these are genuinely the same parts, rename the CSV rows or
                    mesh names so the matcher pairs them. Otherwise importing the
                    CSV rows as loose parts WILL duplicate them in DM.
                  </p>
                </details>
              )}
              {matchReport.scenePartsWithoutCsv.length > 0 && (
                <details>
                  <summary className="cursor-pointer hover:underline">Scene parts with no CSV match ({matchReport.scenePartsWithoutCsv.length})</summary>
                  <ul className="mt-1 space-y-0.5 pl-3 text-muted-foreground max-h-32 overflow-auto">
                    {matchReport.scenePartsWithoutCsv.map((s, i) => (
                      <li key={i}><span className="font-mono">{s.partName}</span> ({s.cabinetCode} · {s.dims})</li>
                    ))}
                  </ul>
                </details>
              )}
              {matchReport.csvRowsWithoutPart.length > 0 && (
                <details>
                  <summary className="cursor-pointer hover:underline">CSV rows with no scene part ({matchReport.csvRowsWithoutPart.length})</summary>
                  <ul className="mt-1 space-y-0.5 pl-3 text-muted-foreground max-h-32 overflow-auto">
                    {matchReport.csvRowsWithoutPart.map((c, i) => (
                      <li key={i}><span className="font-mono">{c.name}</span> ({c.dims} · {c.material})</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* Coverage analysis — scene-wide read-only check; auto-runs when a scene-level CSV exists. */}
      {overlay && boundItems.length > 0 && (
        <div className="mt-2 rounded-md border border-border bg-card p-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium">Scene-wide CSV coverage</p>
            <button
              type="button"
              onClick={handleAnalyse}
              disabled={analysing}
              className="text-[11px] px-2 py-1 border border-border rounded hover:bg-accent disabled:opacity-50"
            >
              {analysing ? 'Analysing…' : coverage ? 'Re-analyse' : 'Analyse'}
            </button>
          </div>
          {analysing && (
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin shrink-0" /> Analysing scene CSV vs parts…
            </p>
          )}
          {coverage && (
            <p className="text-[10px] text-muted-foreground">
              {coverage.matchedByAnyCabinet} / {coverage.totalRows} rows matched by the heuristic matcher (scene-level CSV)
              {coverage.unmatchedRows.length > 0 && (
                <span className="block text-amber-700 mt-0.5" title={coverage.unmatchedRows.map(r => r.name).join('\n')}>
                  {coverage.unmatchedRows.length} unmatched by heuristic — Sync / AI match usually pairs these; hover for names
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {hasCabinetOnlyCsv && (
        <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
          Only per-cabinet CSV overlays are set — scene-wide heuristic coverage above does not apply.
          Use <strong className="font-medium">Match reconciliation</strong> or <strong className="font-medium">Sync parts</strong> (AI pairing) to see pairing for each cabinet.
        </p>
      )}

      {error && <p className="text-[11px] text-red-600 mt-1.5">{error}</p>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Bulk AI processing — scene-level section.
//
// Runs `processModel` across every cabinet in the scene so the user
// doesn't have to open each detail panel and click "Process with AI"
// 20 times. Sequential — AI grouping hits Anthropic per cabinet and a
// parallel burst would trip rate limits and produce noisy partial
// failures.
// ---------------------------------------------------------------------------

interface BulkProcessSectionProps {
  sceneId: string;
  cabinets: SceneCabinet[];
}

function BulkProcessSection({ sceneId, cabinets }: BulkProcessSectionProps) {
  const [running, setRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkProcessRowResult[]>([]);
  const [summary, setSummary] = useState<{ ok: number; skipped: number; errored: number; totalMs: number } | null>(null);
  const [skipProcessed, setSkipProcessed] = useState(true);

  const unprocessedCount = useMemo(
    () => cabinets.filter(c => !c.packageId).length,
    [cabinets],
  );

  const handleRun = async () => {
    setRunning(true);
    setRows([]);
    setSummary(null);
    setProgressLabel('Starting…');
    try {
      const res = await bulkProcessModels(sceneId, cabinets, {
        skipProcessed,
        onProgress: p => setProgressLabel(
          `${p.index + 1} / ${p.total} — ${p.cabinetLabel}${p.message ? ` · ${p.message}` : ''}`,
        ),
        onRowComplete: row => setRows(prev => [...prev, row]),
      });
      setSummary({ ok: res.ok, skipped: res.skipped, errored: res.errored, totalMs: res.totalMs });
      setProgressLabel(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5" /> AI processing
        </h4>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={skipProcessed}
              onChange={e => setSkipProcessed(e.target.checked)}
              disabled={running}
              className="h-3 w-3"
            />
            Skip processed
          </label>
          <button
            type="button"
            onClick={handleRun}
            disabled={running || cabinets.length === 0}
            className="text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            {running ? 'Processing…' : `Process ${skipProcessed ? unprocessedCount : cabinets.length}`}
          </button>
        </div>
      </div>

      {progressLabel && (
        <p className="text-[11px] text-muted-foreground mb-1.5 truncate" title={progressLabel}>
          {progressLabel}
        </p>
      )}

      {rows.length > 0 && (
        <ul className="space-y-0.5 max-h-40 overflow-auto rounded border border-border bg-card/50 p-1.5">
          {rows.map((r, i) => (
            <li key={i} className="text-[10px] flex items-center gap-2 px-1 py-0.5">
              {r.status === 'ok' && <Check className="h-3 w-3 text-green-600 shrink-0" />}
              {r.status === 'skipped' && <Info className="h-3 w-3 text-muted-foreground shrink-0" />}
              {r.status === 'error' && <AlertCircle className="h-3 w-3 text-red-600 shrink-0" />}
              <span className="font-medium truncate flex-1">{r.cabinetLabel}</span>
              <span className={`truncate ${
                r.status === 'ok' ? 'text-green-700' :
                r.status === 'error' ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {r.status === 'ok'
                  ? `${r.assemblies} asm · ${r.parts} parts`
                  : r.detail}
              </span>
            </li>
          ))}
        </ul>
      )}

      {summary && (
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Done in {Math.round(summary.totalMs / 1000)}s —
          <span className="text-green-700 mx-1">{summary.ok} ok</span>·
          <span className="mx-1">{summary.skipped} skipped</span>·
          <span className="text-red-600 mx-1">{summary.errored} failed</span>
        </p>
      )}

      {cabinets.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No cabinets in this scene yet.</p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Design Manager parts sync — scene-level section.
//
// Groups scene cabinets by their `designItemId` and shows one row per
// DesignItem with a "Sync parts" button. The orchestrator
// (`syncDesignItemPartsFromScene`) already handles multi-cabinet merge
// via `mergeCabinetPartsForItem`, so one click per item is enough —
// no need to iterate cabinets manually.
// ---------------------------------------------------------------------------

interface DesignManagerSyncSectionProps {
  sceneId: string;
  projectId: string;
  cabinets: SceneCabinet[];
  autoPartsSyncState?: SceneAutoPartsSyncState;
}

function DesignManagerSyncSection({
  sceneId, projectId, cabinets, autoPartsSyncState,
}: DesignManagerSyncSectionProps) {
  const { user } = useAuth();
  const { byId: designItemsById } = useSceneDesignItems(projectId, cabinets);

  // Group cabinets by designItemId to compute the row set.
  const groups = useMemo(() => {
    const tally = new Map<string, SceneCabinet[]>();
    for (const c of cabinets) {
      if (!c.designItemId) continue;
      const bucket = tally.get(c.designItemId) ?? [];
      bucket.push(c);
      tally.set(c.designItemId, bucket);
    }
    return Array.from(tally.entries()).map(([designItemId, group]) => ({
      designItemId,
      cabinets: group,
    }));
  }, [cabinets]);

  const [reviewDialog, setReviewDialog] = useState<{
    designItemId: string;
    pairingStrategy: PairingStrategy;
    /** Remaining Design Items after the current one (sequential “Review all”). */
    queue?: string[];
  } | null>(null);
  /** After commit, dialog calls `onClose` — skip one close so queue advance / unmount is not cleared. */
  const suppressReviewCloseRef = useRef(false);

  // Per-item sync state.
  const [state, setState] = useState<Record<string, {
    syncing: boolean;
    lastResult?: {
      added: number;
      preservedProcurement: number;
      droppedStaleSceneOrigin: number;
      aiUsed: boolean;
      aiConfidence?: number;
      aiReasoning?: string;
      csvMatched?: number;
      csvTotal?: number;
      /** CSV rows that did not pair to any ScenePart in this sync (fabrication may be missing). */
      csvUnmatchedNames?: string[];
    };
    error?: string;
  }>>({});

  const validateGroupForSync = async (designItemId: string): Promise<string | null> => {
    const group = groups.find(g => g.designItemId === designItemId);
    if (!group) return null;
    return getBlockingSyncErrorMessageForDesignItem(sceneId, designItemId);
  };

  const rowStateFromSyncResult = (res: SyncResult) => ({
    added: res.addedNew,
    preservedProcurement: res.preservedProcurement,
    droppedStaleSceneOrigin: res.droppedStaleSceneOrigin,
    aiUsed: !!res.aiReport,
    aiConfidence: res.aiReport?.confidence,
    aiReasoning: res.aiReport?.reasoning,
    csvMatched: res.csvReport?.matchedRows,
    csvTotal: res.csvReport?.totalRows,
    csvUnmatchedNames: res.csvReport?.unmatchedRowNames?.length
      ? res.csvReport.unmatchedRowNames
      : undefined,
  });

  const handleSyncOne = async (designItemId: string) => {
    const blockReason = await validateGroupForSync(designItemId);
    if (blockReason) {
      setState(prev => ({
        ...prev,
        [designItemId]: { syncing: false, error: blockReason },
      }));
      return;
    }
    setState(prev => ({ ...prev, [designItemId]: { syncing: true } }));
    try {
      const res = await writeSceneOriginParts(sceneId, designItemId, user?.uid ?? '', {
        pairingStrategy: 'auto',
      });
      setState(prev => ({
        ...prev,
        [designItemId]: {
          syncing: false,
          lastResult: rowStateFromSyncResult(res),
        },
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        [designItemId]: { syncing: false, error: (err as Error).message || 'Sync failed' },
      }));
    }
  };

  const handleSyncAll = async () => {
    for (const g of groups) {
      // eslint-disable-next-line no-await-in-loop -- sequential writes avoid
      // burning through DesignItem partsVersion races; the user-perceived
      // runtime is dominated by Firestore RTT anyway.
      await handleSyncOne(g.designItemId);
    }
  };

  const openReview = (designItemId: string, pairingStrategy: PairingStrategy) => {
    void (async () => {
      if (!user?.uid) {
        setState(prev => ({
          ...prev,
          [designItemId]: { syncing: false, error: 'Sign in to review and sync parts.' },
        }));
        return;
      }
      const blockReason = await validateGroupForSync(designItemId);
      if (blockReason) {
        setState(prev => ({
          ...prev,
          [designItemId]: { syncing: false, error: blockReason },
        }));
        return;
      }
      setReviewDialog({ designItemId, pairingStrategy });
    })();
  };

  const openReviewAll = (pairingStrategy: PairingStrategy) => {
    void (async () => {
      if (!user?.uid) {
        setState(prev => {
          const next = { ...prev };
          for (const g of groups) {
            next[g.designItemId] = { syncing: false, error: 'Sign in to review and sync parts.' };
          }
          return next;
        });
        return;
      }
      const ready: string[] = [];
      for (const g of groups) {
        // eslint-disable-next-line no-await-in-loop -- need stable order
        const blockReason = await validateGroupForSync(g.designItemId);
        if (blockReason) {
          setState(prev => ({
            ...prev,
            [g.designItemId]: { syncing: false, error: blockReason },
          }));
          continue;
        }
        ready.push(g.designItemId);
      }
      if (ready.length === 0) return;
      const [first, ...queue] = ready;
      setReviewDialog(
        queue.length > 0
          ? { designItemId: first, pairingStrategy, queue }
          : { designItemId: first, pairingStrategy },
      );
    })();
  };

  const handleAiMatchOne = async (designItemId: string) => {
    const blockReason = await validateGroupForSync(designItemId);
    if (blockReason) {
      setState(prev => ({
        ...prev,
        [designItemId]: { syncing: false, error: blockReason },
      }));
      return;
    }
    setState(prev => ({ ...prev, [designItemId]: { syncing: true } }));
    try {
      const res = await writeSceneOriginParts(sceneId, designItemId, user?.uid ?? '', {
        pairingStrategy: 'ai',
      });
      setState(prev => ({
        ...prev,
        [designItemId]: {
          syncing: false,
          lastResult: rowStateFromSyncResult(res),
        },
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        [designItemId]: { syncing: false, error: (err as Error).message || 'AI match failed' },
      }));
    }
  };

  const handleAiMatchAll = async () => {
    for (const g of groups) {
      // eslint-disable-next-line no-await-in-loop
      await handleAiMatchOne(g.designItemId);
    }
  };

  const handleWipeProcurementAll = async () => {
    if (!projectId) return;
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      `Drain procurement rows on every DesignItem in this scene?\n\n` +
      `${groups.length} DesignItem${groups.length === 1 ? '' : 's'} will have their non-scene rows (CSV imports, manual entries, legacy untagged) deleted.\n` +
      `Scene-origin parts are protected. No undo.`,
    );
    if (!ok) return;
    for (const g of groups) {
      // eslint-disable-next-line no-await-in-loop
      setState(prev => ({ ...prev, [g.designItemId]: { syncing: true } }));
      try {
        const counts = await listProcurementSourceCounts(projectId, g.designItemId);
        if (counts.length === 0) {
          setState(prev => ({
            ...prev,
            [g.designItemId]: { syncing: false, lastResult: {
              added: 0, preservedProcurement: 0, droppedStaleSceneOrigin: 0, aiUsed: false,
            } },
          }));
          continue;
        }
        const sources = counts.map(c => c.source);
        const r = await deleteProcurementRowsBySource(projectId, g.designItemId, sources, user?.uid ?? '');
        setState(prev => ({
          ...prev,
          [g.designItemId]: {
            syncing: false,
            lastResult: {
              added: 0,
              preservedProcurement: r.kept,
              droppedStaleSceneOrigin: 0,
              aiUsed: false,
              // reuse droppedStaleSceneOrigin display for deletion count
              // procurementRemoved not in type — embed in message via droppedStaleSceneOrigin
              // (simpler than widening the state shape here)
            },
          },
        }));
        // Telemetry via alert-less console so multi-item run is readable.
        console.info(`[wipe-procurement] ${g.designItemId}: removed ${r.removed}, kept ${r.kept}`);
      } catch (err) {
        setState(prev => ({
          ...prev,
          [g.designItemId]: { syncing: false, error: (err as Error).message || 'Drain failed' },
        }));
      }
    }
  };

  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-border p-3 text-xs text-muted-foreground leading-relaxed">
        No cabinets are bound to a Design Item yet. Assign cabinets from the
        Cabinet detail panel to unlock Design Manager parts sync.
      </div>
    );
  }

  return (
    <section>
      {reviewDialog && user?.uid && (
        <SceneSyncReviewDialog
          key={reviewDialog.designItemId}
          open
          onClose={() => {
            if (suppressReviewCloseRef.current) {
              suppressReviewCloseRef.current = false;
              return;
            }
            setReviewDialog(null);
          }}
          sceneId={sceneId}
          designItemId={reviewDialog.designItemId}
          userId={user.uid}
          pairingStrategy={reviewDialog.pairingStrategy}
          designItemLabel={designItemsById.get(reviewDialog.designItemId)?.name
            ?? reviewDialog.designItemId}
          onCommitted={res => {
            const id = reviewDialog.designItemId;
            setState(prev => ({
              ...prev,
              [id]: { syncing: false, lastResult: rowStateFromSyncResult(res) },
            }));
            setReviewDialog(prev => {
              if (!prev) return null;
              if (prev.queue !== undefined) {
                if (prev.queue.length > 0) {
                  suppressReviewCloseRef.current = true;
                  return {
                    designItemId: prev.queue[0],
                    pairingStrategy: prev.pairingStrategy,
                    queue: prev.queue.slice(1),
                  };
                }
                suppressReviewCloseRef.current = true;
                return null;
              }
              return prev;
            });
          }}
        />
      )}
      {autoPartsSyncState && autoPartsSyncState.syncing.size > 0 && (
        <p className="text-[10px] text-muted-foreground mb-2 flex items-start gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mt-0.5" />
          <span>
            Auto-sync running for{' '}
            {Array.from(autoPartsSyncState.syncing)
              .map(id => designItemsById.get(id)?.name ?? id)
              .join(', ')}
            …
          </span>
        </p>
      )}
      {autoPartsSyncState && autoPartsSyncState.lastErrors.size > 0 && (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-2 mb-2 text-[11px] text-amber-950 space-y-1"
          role="status"
        >
          <p className="font-medium flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Background auto-sync failed
          </p>
          <p className="text-[10px] text-amber-900/90 leading-snug">
            Assembly changes trigger a debounced sync. If it fails, merged parts are not written to the design item
            until you fix the issue and use Review & sync or quick Sync below.
          </p>
          <ul className="space-y-0.5 pl-1">
            {Array.from(autoPartsSyncState.lastErrors.entries()).map(([id, msg]) => (
              <li key={id} className="text-[10px]">
                <span className="font-medium">{designItemsById.get(id)?.name ?? id}</span>
                <span className="text-amber-950"> — {msg}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground flex-1 min-w-0">
          Design Manager sync
        </h4>
        <StaleRevisionButton sceneId={sceneId} projectId={projectId} cabinets={cabinets} />
        <BatchRevisionApplyButton sceneId={sceneId} projectId={projectId} cabinets={cabinets} />
        <button
          type="button"
          onClick={handleAiMatchAll}
          title="Force AI pairing across every bound DesignItem. Uses Claude Sonnet even if a scene has heuristic matching already — best for stubborn naming drift. One Claude call per DesignItem (~$0.18 each)."
          className="text-[11px] px-2 py-1 bg-purple-600 text-white rounded hover:opacity-90 inline-flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" /> AI match all
        </button>
        <button
          type="button"
          onClick={handleWipeProcurementAll}
          title="Drain procurement rows (CSV imports, manual entries, legacy untagged) on every DesignItem bound to this scene. Scene-origin parts protected by invariant."
          className="text-[11px] px-2 py-1 text-amber-700 border border-amber-200 bg-amber-50 rounded hover:bg-amber-100"
        >
          Clean procurement
        </button>
        <button
          type="button"
          onClick={() => openReviewAll('auto')}
          title="Open the pre-sync review for each Design Item in order. Items that fail validation are skipped and show an error on that row. Apply to advance; cancel stops the run."
          className="text-[11px] px-2 py-1 border border-border bg-card rounded hover:bg-muted/60 inline-flex items-center gap-1"
        >
          <Send className="h-3 w-3" /> Review all
        </button>
        <button
          type="button"
          onClick={() => openReviewAll('ai')}
          title="Like Review all, but each step runs forced AI pairing (Claude) in the preview. About one API call per Design Item."
          className="text-[11px] px-2 py-1 bg-purple-600 text-white rounded hover:opacity-90 inline-flex items-center gap-1"
        >
          <Sparkles className="h-3 w-3" /> AI review all
        </button>
        <button
          type="button"
          onClick={handleSyncAll}
          title="Write scene-origin parts for every DesignItem bound to this scene. Procurement rows (CSV, manual, legacy untagged) are always preserved. Uses AI pairing if a CSV overlay is uploaded."
          className="text-[11px] px-2 py-1 bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          Sync all parts
        </button>
      </div>
      <ul className="space-y-1.5">
        {groups.map(({ designItemId, cabinets: group }) => {
          const item = designItemsById.get(designItemId);
          const rowState = state[designItemId];
          return (
            <li key={designItemId} className="rounded-md border border-border p-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item?.name ?? designItemId}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {item?.itemCode ?? '—'} · {group.length} cabinet{group.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openReview(designItemId, 'auto')}
                  disabled={rowState?.syncing}
                  title="Match and merge, then review names, materials, and dimensions before saving."
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
                >
                  {rowState?.syncing
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Send className="h-3 w-3" />}
                  Review & sync
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncOne(designItemId)}
                  disabled={rowState?.syncing}
                  title="Write scene parts immediately without opening the review step."
                  className="shrink-0 text-[10px] px-1.5 py-1 text-muted-foreground border border-border rounded hover:bg-muted/60 disabled:opacity-50"
                >
                  Quick sync
                </button>
                <button
                  type="button"
                  onClick={() => openReview(designItemId, 'ai')}
                  disabled={rowState?.syncing}
                  title="Preview AI pairing, review names and dimensions, then write to the DesignItem."
                  className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-purple-600 text-white rounded hover:opacity-90 disabled:opacity-50"
                >
                  <Sparkles className="h-3 w-3" /> AI review
                </button>
                <button
                  type="button"
                  onClick={() => handleAiMatchOne(designItemId)}
                  disabled={rowState?.syncing}
                  title="Force AI pairing and write immediately (no review step). Uses Claude when needed."
                  className="shrink-0 text-[10px] px-1.5 py-1 text-purple-800 border border-purple-200 bg-purple-50/80 rounded hover:bg-purple-100 disabled:opacity-50"
                >
                  Quick AI
                </button>
              </div>
              {rowState?.lastResult && (
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-[10px] text-green-700">
                    {rowState.lastResult.added} scene parts written
                    {' · '}{rowState.lastResult.preservedProcurement} procurement rows preserved
                    {rowState.lastResult.droppedStaleSceneOrigin > 0 && (
                      <span className="text-amber-700">
                        {' · '}{rowState.lastResult.droppedStaleSceneOrigin} stale scene rows replaced
                      </span>
                    )}
                  </p>
                  {rowState.lastResult.aiUsed && rowState.lastResult.aiConfidence !== undefined && (
                    <p className="text-[10px] text-purple-700" title={rowState.lastResult.aiReasoning}>
                      AI pairing · {Math.round(rowState.lastResult.aiConfidence * 100)}% confidence · hover for reasoning
                    </p>
                  )}
                  {rowState.lastResult.csvMatched !== undefined && rowState.lastResult.csvTotal !== undefined && (
                    <p className="text-[10px] text-muted-foreground">
                      CSV overlay: {rowState.lastResult.csvMatched}/{rowState.lastResult.csvTotal} rows paired to scene parts
                    </p>
                  )}
                  {rowState.lastResult.csvUnmatchedNames && rowState.lastResult.csvUnmatchedNames.length > 0 && (
                    <details className="text-[10px] rounded border border-amber-200 bg-amber-50/80 px-1.5 py-1">
                      <summary className="cursor-pointer text-amber-900 font-medium">
                        {rowState.lastResult.csvUnmatchedNames.length} CSV row{rowState.lastResult.csvUnmatchedNames.length === 1 ? '' : 's'} did not pair — no cut spec from CSV for these names
                      </summary>
                      <ul className="mt-1 pl-3 text-amber-950 max-h-24 overflow-auto space-y-0.5 font-mono text-[9px]">
                        {rowState.lastResult.csvUnmatchedNames.slice(0, 40).map((name, idx) => (
                          <li key={`${idx}-${name}`}>{name}</li>
                        ))}
                        {rowState.lastResult.csvUnmatchedNames.length > 40 && (
                          <li className="italic">…and {rowState.lastResult.csvUnmatchedNames.length - 40} more</li>
                        )}
                      </ul>
                      <p className="text-[9px] text-amber-800 mt-1 leading-snug">
                        Rename scene parts or CSV rows, run AI match, or add per-cabinet CSV. See Match reconciliation in the cutlist section above.
                      </p>
                    </details>
                  )}
                </div>
              )}
              {rowState?.error && (
                <p className="text-[10px] text-red-600 mt-1.5">{rowState.error}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Parts Review — scene-wide name enhancement + inconsistency audit.
//
// Runs `analyzePartsQuality` on every render (pure, sub-millisecond even
// for scenes with hundreds of parts). Surfaces:
//   - A summary chip row (errors / warnings / info / suggestions).
//   - Collapsible "Issues" list grouped by severity.
//   - Collapsible "Suggested renames" list, each with accept/reject.
//     A bulk "Accept all" ships every remaining suggestion via
//     `applyPartNameEnhancements`.
//
// Kept deliberately read-only for issue flags — those call for human
// judgement (e.g. rethinking a dimension). Name fixes are safe to
// automate because the scene retains the full mesh linkage regardless.
// ---------------------------------------------------------------------------

const SEVERITY_META: Record<PartIssueSeverity, { label: string; icon: typeof AlertCircle; tint: string }> = {
  error:   { label: 'Errors',   icon: AlertCircle,   tint: 'text-red-700 bg-red-100 border-red-200' },
  warning: { label: 'Warnings', icon: AlertTriangle, tint: 'text-amber-700 bg-amber-100 border-amber-200' },
  info:    { label: 'Info',     icon: Info,          tint: 'text-blue-700 bg-blue-100 border-blue-200' },
};

interface PartsReviewSectionProps {
  sceneId: string;
  projectId?: string;
  cabinets: SceneCabinet[];
}

function PartsReviewSection({ sceneId, projectId, cabinets }: PartsReviewSectionProps) {
  const MAPPINGS_STALE_MS = 2 * 60 * 1000;
  const { user } = useAuth();
  const {
    mappings: materialMappings,
    isLoading: mappingsLoading,
    error: mappingsError,
    lastAttemptAt: mappingsLastAttemptAt,
    lastSuccessAt: mappingsLastSuccessAt,
    refetch: refetchMappings,
  } = usePartsReviewMaterialMappings(sceneId, cabinets);
  const mappingsLastAttemptLabel = mappingsLastAttemptAt
    ? mappingsLastAttemptAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  const mappingsLastSuccessLabel = mappingsLastSuccessAt
    ? mappingsLastSuccessAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;
  const mappingsIsStale = !!(
    mappingsLastSuccessAt
    && (Date.now() - mappingsLastSuccessAt.getTime() > MAPPINGS_STALE_MS)
    && !mappingsLoading
  );

  // Cabinet lookup — issue raise needs to resolve cabinetId → designItemId
  // so the issue lands on the right DesignItem. Cabinets without a
  // designItemId can't produce issues until they're bound.
  const cabinetById = useMemo(() => {
    const m = new Map<string, SceneCabinet>();
    for (const c of cabinets) m.set(c.id, c);
    return m;
  }, [cabinets]);

  // Per-issue raise state so each row can show its own spinner + result.
  const [raiseState, setRaiseState] = useState<Record<string, {
    raising: boolean;
    raisedIssueId?: string;
    error?: string;
  }>>({});

  const raiseIssueFromFlag = async (issue: PartIssue) => {
    const cab = cabinetById.get(issue.cabinetId);
    const designItemId = cab?.designItemId;
    if (!projectId || !designItemId) {
      setRaiseState(prev => ({
        ...prev,
        [issue.partId + issue.code]: {
          raising: false,
          error: 'Cabinet not bound to a Design Item — can\'t route the issue.',
        },
      }));
      return;
    }
    if (!user) return;
    const key = issue.partId + issue.code;
    setRaiseState(prev => ({ ...prev, [key]: { raising: true } }));
    try {
      const id = await createDesignItemIssue(
        {
          projectId,
          designItemId,
          kind: partIssueCodeToIssueKind(issue.code),
          severity: partIssueSeverityToIssueSeverity(issue.severity),
          title: `${issue.code}: ${issue.partLabel}`,
          body: `${issue.message}${issue.hint ? `\n\nHint: ${issue.hint}` : ''}\n\n(auto-raised from Parts Review — scene ${sceneId}, cabinet ${issue.cabinetId}, part ${issue.partLabel})`,
          scope: {
            sceneId,
            cabinetId: issue.cabinetId,
            partId: issue.partId,
          },
          source: 'parts-review',
        },
        user,
      );
      setRaiseState(prev => ({ ...prev, [key]: { raising: false, raisedIssueId: id } }));
    } catch (err) {
      setRaiseState(prev => ({
        ...prev,
        [key]: { raising: false, error: (err as Error).message || 'Failed to raise issue' },
      }));
    }
  };

  // Recompute on every cabinet change — pure + cheap.
  const report = useMemo<PartsQualityReport>(
    () => analyzePartsQuality(collectAuditableParts(cabinets), materialMappings),
    [cabinets, materialMappings],
  );

  // Rejected suggestions stay out of the "apply all" batch for this session.
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<'issues' | 'suggestions' | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ renamed: number; cabinets: number } | null>(null);

  const pendingSuggestions = report.suggestions.filter(s => !rejected.has(s.partId));

  const handleAcceptAll = async () => {
    setApplying(true);
    setApplyError(null);
    setApplyResult(null);
    try {
      const renames: PartRename[] = pendingSuggestions.map(s => ({
        cabinetId: s.cabinetId,
        partId: s.partId,
        newName: s.suggestedName,
      }));
      const res = await applyPartNameEnhancements(sceneId, renames);
      setApplyResult({ renamed: res.partsRenamed, cabinets: res.cabinetsUpdated });
    } catch (err) {
      setApplyError((err as Error).message || 'Apply failed');
    } finally {
      setApplying(false);
    }
  };

  const { errors, warnings, infos, suggestions: suggestionCount, partsChecked } = report.summary;
  const pendingCount = pendingSuggestions.length;
  const hasAnything = errors + warnings + infos + suggestionCount > 0;

  if (!hasAnything) {
    return (
      <section className="rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-900 leading-relaxed">
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 shrink-0" />
          <span>Parts review clean — {partsChecked} parts, no issues or naming improvements found.</span>
        </div>
        {mappingsLoading && (
          <p className="mt-1 text-[10px] text-green-800/80">
            Loading persisted material mappings for confidence checks...
          </p>
        )}
        {!mappingsLoading && mappingsLastSuccessLabel && !mappingsError && (
          <div className="mt-1 flex items-center gap-2">
            <p className={`text-[10px] ${mappingsIsStale ? 'text-amber-700' : 'text-green-800/80'}`}>
              Material confidence checks last updated {mappingsLastSuccessLabel}
              {mappingsIsStale ? ' (refresh recommended)' : ''}
            </p>
            {mappingsIsStale && (
              <button
                type="button"
                onClick={() => { void refetchMappings(); }}
                disabled={mappingsLoading}
                className="text-[10px] px-1.5 py-0.5 border border-amber-300 rounded text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                Refresh
              </button>
            )}
          </div>
        )}
        {mappingsError && (
          <div className="mt-1 flex items-center gap-2">
            <p className="text-[10px] text-amber-700">
              Material confidence checks unavailable: {mappingsError.message}
            </p>
            {mappingsLastAttemptLabel && (
              <span className="text-[10px] text-amber-800/80">
                Last attempted {mappingsLastAttemptLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => { void refetchMappings(); }}
              disabled={mappingsLoading}
              className="text-[10px] px-1.5 py-0.5 border border-amber-300 rounded text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Parts review
        </h4>
        <span className="text-[10px] text-muted-foreground">{partsChecked} parts checked</span>
      </div>
      {mappingsLoading && (
        <p className="mb-2 text-[10px] text-muted-foreground">
          Loading persisted material mappings for confidence checks...
        </p>
      )}
      {!mappingsLoading && mappingsLastSuccessLabel && !mappingsError && (
        <div className="mb-2 flex items-center gap-2">
          <p className={`text-[10px] ${mappingsIsStale ? 'text-amber-700' : 'text-muted-foreground'}`}>
            Material confidence checks last updated {mappingsLastSuccessLabel}
            {mappingsIsStale ? ' (refresh recommended)' : ''}
          </p>
          {mappingsIsStale && (
            <button
              type="button"
              onClick={() => { void refetchMappings(); }}
              disabled={mappingsLoading}
              className="text-[10px] px-1.5 py-0.5 border border-amber-300 rounded text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              Refresh
            </button>
          )}
        </div>
      )}
      {mappingsError && (
        <div className="mb-2 flex items-center gap-2">
          <p className="text-[10px] text-amber-700">
            Material confidence checks unavailable: {mappingsError.message}
          </p>
          {mappingsLastAttemptLabel && (
            <span className="text-[10px] text-amber-800/80">
              Last attempted {mappingsLastAttemptLabel}
            </span>
          )}
          <button
            type="button"
            onClick={() => { void refetchMappings(); }}
            disabled={mappingsLoading}
            className="text-[10px] px-1.5 py-0.5 border border-amber-300 rounded text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary chip row. */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {errors > 0 && <SeverityChip count={errors} severity="error" onClick={() => setExpanded(v => v === 'issues' ? null : 'issues')} />}
        {warnings > 0 && <SeverityChip count={warnings} severity="warning" onClick={() => setExpanded(v => v === 'issues' ? null : 'issues')} />}
        {infos > 0 && <SeverityChip count={infos} severity="info" onClick={() => setExpanded(v => v === 'issues' ? null : 'issues')} />}
        {suggestionCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(v => v === 'suggestions' ? null : 'suggestions')}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-purple-200 bg-purple-100 text-purple-700 text-[10px] font-medium hover:opacity-80"
          >
            <Sparkles className="h-3 w-3" />
            {suggestionCount} name {suggestionCount === 1 ? 'suggestion' : 'suggestions'}
          </button>
        )}
      </div>

      {/* Accept-all bar (suggestions only). */}
      {suggestionCount > 0 && (
        <div className="flex items-center gap-2 mb-2 rounded-md border border-border p-2">
          <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0" />
          <span className="text-[11px] text-foreground flex-1">
            {pendingCount > 0
              ? `${pendingCount} rename${pendingCount === 1 ? '' : 's'} ready to apply`
              : 'All suggestions handled this session'}
          </span>
          <button
            type="button"
            onClick={handleAcceptAll}
            disabled={applying || pendingCount === 0}
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-[11px] bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Accept all
          </button>
        </div>
      )}

      {applyResult && (
        <p className="text-[10px] text-green-700 mb-2">
          Renamed {applyResult.renamed} part{applyResult.renamed === 1 ? '' : 's'} across {applyResult.cabinets} cabinet{applyResult.cabinets === 1 ? '' : 's'}.
        </p>
      )}
      {applyError && (
        <p className="text-[10px] text-red-600 mb-2">{applyError}</p>
      )}

      {/* Expanded: issues list. */}
      {expanded === 'issues' && report.issues.length > 0 && (
        <ul className="space-y-1.5">
          {report.issues.map((iss, i) => {
            const meta = SEVERITY_META[iss.severity];
            const Icon = meta.icon;
            const cab = cabinetById.get(iss.cabinetId);
            const canRaise = !!(projectId && cab?.designItemId && user);
            const key = iss.partId + iss.code;
            const rs = raiseState[key];
            return (
              <li key={`${iss.partId}-${iss.code}-${i}`} className={`rounded-md border p-2 flex items-start gap-2 ${meta.tint}`}>
                <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium">
                    <span className="font-mono">{iss.partLabel}</span>
                    <span className="text-muted-foreground ml-1">· {iss.code}</span>
                  </p>
                  <p className="text-[10px] leading-snug opacity-90">{iss.message}</p>
                  {iss.hint && (
                    <p className="text-[10px] leading-snug mt-0.5 opacity-70 italic">{iss.hint}</p>
                  )}
                  {rs?.raisedIssueId && (
                    <p className="text-[10px] mt-1 text-green-800">Issue raised · #{rs.raisedIssueId.slice(0, 6)}</p>
                  )}
                  {rs?.error && (
                    <p className="text-[10px] mt-1 text-red-700">{rs.error}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => raiseIssueFromFlag(iss)}
                  disabled={!canRaise || rs?.raising || !!rs?.raisedIssueId}
                  title={
                    !projectId
                      ? 'Bind the scene to a project first'
                      : !cab?.designItemId
                      ? 'Cabinet not bound to a Design Item'
                      : 'Raise as a Design Item issue'
                  }
                  className="shrink-0 inline-flex items-center gap-1 h-7 px-2 text-[10px] bg-white/60 hover:bg-white rounded border border-border disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {rs?.raising
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : rs?.raisedIssueId
                    ? <Check className="h-3 w-3" />
                    : <MessageSquare className="h-3 w-3" />}
                  Raise
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Expanded: name suggestions. */}
      {expanded === 'suggestions' && report.suggestions.length > 0 && (
        <ul className="space-y-1.5">
          {report.suggestions.map(sug => {
            const isRejected = rejected.has(sug.partId);
            return (
              <li key={sug.partId} className="rounded-md border border-border p-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate" title={sug.currentName}>
                      from: <span className="font-mono">{sug.currentName}</span>
                    </p>
                    <p className="text-[11px] font-medium truncate" title={sug.suggestedName}>
                      to: {sug.suggestedName}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">{sug.rationale}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRejected(prev => {
                        const next = new Set(prev);
                        if (isRejected) next.delete(sug.partId);
                        else next.add(sug.partId);
                        return next;
                      });
                    }}
                    className="shrink-0 text-[10px] px-2 py-1 rounded border border-border hover:bg-accent"
                  >
                    {isRejected ? 'Restore' : 'Skip'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Stale-revision button — one-click sweep that raises "revision pending
 * parts refresh" issues for any cabinet whose applied revision is older
 * than the project's latest. Idempotent: re-clicking doesn't duplicate.
 */
function StaleRevisionButton({
  sceneId, projectId, cabinets,
}: { sceneId: string; projectId: string; cabinets: SceneCabinet[] }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ raised: number; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handle = async () => {
    if (!user) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await raiseStaleRevisionIssues(projectId, sceneId, cabinets, user);
      setResult(r);
    } catch (e) {
      setErr((e as Error).message || 'Revision check failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-1.5">
      {result && (
        <span className="text-[10px] text-muted-foreground">
          {result.raised > 0 ? `Raised ${result.raised}` : 'All in sync'}
        </span>
      )}
      {err && <span className="text-[10px] text-red-600">{err}</span>}
      <button
        type="button"
        onClick={handle}
        disabled={busy || !user}
        title="Check the latest 3D revision against each cabinet's applied version"
        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 inline-flex items-center gap-1"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
        Check revisions
      </button>
    </div>
  );
}

/**
 * Batch revision apply — iterates every cabinet in the scene, applies
 * the latest revision using default decisions (auto-pilot path).
 * Sequential, reports per-cabinet result after completion.
 */
function BatchRevisionApplyButton({
  sceneId, projectId, cabinets,
}: { sceneId: string; projectId: string; cabinets: SceneCabinet[] }) {
  const { user } = useAuth();
  const [latest, setLatest] = useState<DesignRevision | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ index: number; total: number } | null>(null);
  const [result, setResult] = useState<BatchApplyResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    const unsub = subscribeToRevisions({ projectId }, list => setLatest(list[0] ?? null));
    return () => unsub();
  }, [projectId]);

  const staleCount = useMemo(() => {
    if (!latest) return 0;
    return cabinets.filter(c => (c.lastAppliedRevisionNumber ?? 0) < latest.revisionNumber).length;
  }, [cabinets, latest]);

  if (!latest || staleCount === 0) return null;

  const handle = async () => {
    if (!user) return;
    setBusy(true); setErr(null); setResult(null); setProgress({ index: 0, total: staleCount });
    try {
      const staleCabs = cabinets.filter(c => (c.lastAppliedRevisionNumber ?? 0) < latest.revisionNumber);
      const r = await batchApplyRevisionToScene(
        sceneId, latest.id, staleCabs, user,
        (_id, i, total) => setProgress({ index: i + 1, total }),
      );
      setResult(r);
    } catch (e) {
      setErr((e as Error).message || 'Batch apply failed');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      {result && (
        <span className="text-[10px] text-muted-foreground" title={result.cabinets.map(c => `${c.cabinetLabel}: ${c.status}`).join('\n')}>
          {result.applied} applied · {result.skipped} skipped{result.errored ? ` · ${result.errored} errored` : ''}
        </span>
      )}
      {progress && (
        <span className="text-[10px] text-muted-foreground">
          {progress.index}/{progress.total}
        </span>
      )}
      {err && <span className="text-[10px] text-red-600">{err}</span>}
      <button
        type="button"
        onClick={handle}
        disabled={busy || !user}
        title={`Apply revision #${latest.revisionNumber} to ${staleCount} cabinet${staleCount === 1 ? '' : 's'} using default decisions`}
        className="text-[11px] px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40 inline-flex items-center gap-1"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        Apply rev #{latest.revisionNumber} ({staleCount})
      </button>
    </div>
  );
}

/** Map part-level issue codes to the DesignItem issue taxonomy. */
function partIssueCodeToIssueKind(code: string): IssueKind {
  switch (code) {
    case 'MISSING_DIMENSIONS':
    case 'SUSPICIOUS_THICKNESS':
    case 'OVERSIZE_LENGTH':
    case 'UNUSUAL_THICKNESS':
    case 'EDGEBAND_MISMATCH':
    case 'BAD_GRAIN':
      return 'cutlist';
    case 'NO_MATERIAL':
      return 'material';
    case 'NO_MESH_LINK':
      return 'geometry';
    default:
      return 'general';
  }
}

function partIssueSeverityToIssueSeverity(s: PartIssueSeverity): IssueSeverity {
  switch (s) {
    case 'error':   return 'major';
    case 'warning': return 'minor';
    case 'info':    return 'info';
  }
}

function SeverityChip({ count, severity, onClick }: { count: number; severity: PartIssueSeverity; onClick: () => void }) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium hover:opacity-80 ${meta.tint}`}
    >
      <Icon className="h-3 w-3" />
      {count} {meta.label.toLowerCase()}
    </button>
  );
}
