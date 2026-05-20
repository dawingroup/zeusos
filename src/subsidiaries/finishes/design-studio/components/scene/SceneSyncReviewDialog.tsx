/**
 * SceneSyncReviewDialog — pre-commit review for Design Studio → Design Manager
 * scene-origin parts sync. Loads a preview (match + merge, optional AI),
 * shows cabinet/assembly context, and lets the user adjust names and
 * dimensions before writing.
 */
import { useCallback, useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, Check } from 'lucide-react';
import type { PartEntry } from '@/modules/design-manager/types';
import {
  writeSceneOriginParts,
  commitSceneOriginPartsWithEdits,
  type PartSyncPreviewRow,
  type PairingStrategy,
  type SyncResult,
} from '../../services/designItemPartsSyncFromScene';

const PART_TYPES: NonNullable<PartEntry['partType']>[] = [
  'sheet', 'bar', 'timber', 'slab', 'fabric', 'component',
];

export interface SceneSyncReviewDialogProps {
  open: boolean;
  onClose: () => void;
  sceneId: string;
  designItemId: string;
  userId: string;
  /** `auto` follows overlay (AI when CSV present); `ai` forces AI pairing. */
  pairingStrategy: PairingStrategy;
  designItemLabel?: string;
  onCommitted?: (result: SyncResult) => void;
}

export function SceneSyncReviewDialog({
  open,
  onClose,
  sceneId,
  designItemId,
  userId,
  pairingStrategy,
  designItemLabel,
  onCommitted,
}: SceneSyncReviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseVersion, setBaseVersion] = useState<number>(0);
  const [rows, setRows] = useState<PartSyncPreviewRow[]>([]);
  const [aiInfo, setAiInfo] = useState<{ reasoning?: string; confidence?: number } | null>(null);
  const [csvInfo, setCsvInfo] = useState<{ matched?: number; total?: number } | null>(null);

  const loadPreview = useCallback(async () => {
    if (!open || !userId) return;
    setLoading(true);
    setError(null);
    setRows([]);
    setAiInfo(null);
    setCsvInfo(null);
    try {
      const res = await writeSceneOriginParts(sceneId, designItemId, userId, {
        pairingStrategy,
        preview: true,
      });
      setBaseVersion(res.version);
      if (res.previewDetail?.length) {
        setRows(res.previewDetail.map(r => ({ ...r, part: { ...r.part } })));
      } else if (res.proposedParts?.length) {
        setRows(
          res.proposedParts.map(p => ({
            part: { ...p },
            contextLabel: '—',
            sceneSourceName: p.name || '—',
          })),
        );
      }
      if (res.aiReport) {
        setAiInfo({ reasoning: res.aiReport.reasoning, confidence: res.aiReport.confidence });
      }
      if (res.csvReport) {
        setCsvInfo({ matched: res.csvReport.matchedRows, total: res.csvReport.totalRows });
      }
    } catch (err) {
      setError((err as Error).message || 'Preview failed');
    } finally {
      setLoading(false);
    }
  }, [open, sceneId, designItemId, userId, pairingStrategy]);

  useEffect(() => {
    if (open) {
      void loadPreview();
    }
  }, [open, loadPreview]);

  const updatePart = (index: number, patch: Partial<PartEntry>) => {
    setRows(prev => {
      const next = [...prev];
      const cur = next[index];
      if (!cur) return prev;
      next[index] = {
        ...cur,
        part: { ...cur.part, ...patch },
      };
      return next;
    });
  };

  const handleApply = async () => {
    if (!userId || rows.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const parts = rows.map(r => r.part);
      const res = await commitSceneOriginPartsWithEdits(
        sceneId,
        designItemId,
        userId,
        parts,
        baseVersion,
      );
      onCommitted?.(res);
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Could not save parts');
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scene-sync-review-title"
      className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-black/50 p-2 sm:p-3 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget && !applying) onClose();
      }}
    >
      <div className="bg-card rounded-lg shadow-xl border border-border w-full max-w-5xl max-h-[95dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div>
            <h3 id="scene-sync-review-title" className="text-sm font-semibold">
              Review parts before sync
            </h3>
            {designItemLabel && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-md" title={designItemLabel}>
                {designItemLabel}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => !applying && onClose()}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-2 border-b border-border bg-muted/30 text-[11px] space-y-1 shrink-0">
          {aiInfo && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">AI pairing</span>
              {typeof aiInfo.confidence === 'number' && (
                <span className="ml-2">confidence {(aiInfo.confidence * 100).toFixed(0)}%</span>
              )}
              {aiInfo.reasoning && (
                <span className="block mt-1 text-[10px] leading-snug max-h-16 overflow-y-auto">
                  {aiInfo.reasoning}
                </span>
              )}
            </p>
          )}
          {csvInfo && typeof csvInfo.total === 'number' && (
            <p className="text-muted-foreground">
              CSV overlay: {csvInfo.matched ?? 0} / {csvInfo.total} rows matched to scene parts
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              Building preview…
            </div>
          )}
          {error && !loading && (
            <div className="flex items-start gap-2 p-4 text-sm text-red-700 bg-red-50">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">No parts to sync for this item.</p>
          )}
          {!loading && !error && rows.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[760px] text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10 border-b border-border">
                    <tr className="text-left text-muted-foreground">
                      <th className="px-2 py-2 font-medium w-[14%]">Cabinet / assembly</th>
                      <th className="px-2 py-2 font-medium w-[12%]">Scene name</th>
                      <th className="px-2 py-2 font-medium w-[14%]">DM name</th>
                      <th className="px-2 py-2 font-medium w-[10%]">Part #</th>
                      <th className="px-2 py-2 font-medium w-[8%]">Type</th>
                      <th className="px-2 py-2 font-medium w-[6%]">L</th>
                      <th className="px-2 py-2 font-medium w-[6%]">W</th>
                      <th className="px-2 py-2 font-medium w-[6%]">T</th>
                      <th className="px-2 py-2 font-medium min-w-[120px]">Material</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const p = row.part;
                      return (
                        <tr key={p.id || i} className="border-b border-border/60 hover:bg-muted/20">
                          <td className="px-2 py-1.5 align-top text-muted-foreground leading-tight" title={row.contextLabel}>
                            {row.contextLabel}
                          </td>
                          <td className="px-2 py-1.5 align-top text-muted-foreground leading-tight">
                            {row.sceneSourceName}
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              className="w-full min-w-0 px-1.5 py-1 rounded border border-border bg-background text-foreground"
                              value={p.name ?? ''}
                              onChange={e => updatePart(i, { name: e.target.value })}
                              disabled={applying}
                            />
                          </td>
                          <td className="px-1 py-1 align-top font-mono text-[10px] text-muted-foreground">
                            {p.partNumber}
                          </td>
                          <td className="px-1 py-1 align-top">
                            <select
                              className="w-full max-w-[7rem] px-1 py-1 rounded border border-border bg-background text-[10px]"
                              value={p.partType ?? 'sheet'}
                              onChange={e =>
                                updatePart(i, { partType: e.target.value as PartEntry['partType'] })
                              }
                              disabled={applying}
                            >
                              {PART_TYPES.map(t => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="number"
                              className="w-full min-w-[3.5rem] px-1 py-1 rounded border border-border bg-background font-mono"
                              value={p.length ?? ''}
                              onChange={e =>
                                updatePart(i, { length: Number(e.target.value) || 0 })
                              }
                              disabled={applying}
                            />
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="number"
                              className="w-full min-w-[3.5rem] px-1 py-1 rounded border border-border bg-background font-mono"
                              value={p.width ?? ''}
                              onChange={e =>
                                updatePart(i, { width: Number(e.target.value) || 0 })
                              }
                              disabled={applying}
                            />
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              type="number"
                              className="w-full min-w-[3.5rem] px-1 py-1 rounded border border-border bg-background font-mono"
                              value={p.thickness ?? ''}
                              onChange={e =>
                                updatePart(i, { thickness: Number(e.target.value) || 0 })
                              }
                              disabled={applying}
                            />
                          </td>
                          <td className="px-1 py-1 align-top">
                            <input
                              className="w-full min-w-[100px] px-1.5 py-1 rounded border border-border bg-background"
                              value={p.materialName ?? ''}
                              onChange={e => updatePart(i, { materialName: e.target.value })}
                              disabled={applying}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-2 p-2">
                {rows.map((row, i) => {
                  const p = row.part;
                  return (
                    <div key={p.id || i} className="rounded-md border border-border bg-background p-2 space-y-2">
                      <div className="text-[10px] text-muted-foreground">
                        {row.contextLabel} · {row.sceneSourceName}
                      </div>
                      <input
                        className="w-full px-2 py-1.5 rounded border border-border bg-background text-foreground text-xs"
                        value={p.name ?? ''}
                        onChange={e => updatePart(i, { name: e.target.value })}
                        disabled={applying}
                        placeholder="DM name"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <div className="text-[10px] text-muted-foreground">Part #</div>
                        <div className="font-mono text-[10px] text-right text-muted-foreground truncate">{p.partNumber}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="w-full px-2 py-1.5 rounded border border-border bg-background text-[11px]"
                          value={p.partType ?? 'sheet'}
                          onChange={e =>
                            updatePart(i, { partType: e.target.value as PartEntry['partType'] })
                          }
                          disabled={applying}
                        >
                          {PART_TYPES.map(t => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <input
                          className="w-full px-2 py-1.5 rounded border border-border bg-background text-[11px]"
                          value={p.materialName ?? ''}
                          onChange={e => updatePart(i, { materialName: e.target.value })}
                          disabled={applying}
                          placeholder="Material"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="number"
                          className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-[11px]"
                          value={p.length ?? ''}
                          onChange={e => updatePart(i, { length: Number(e.target.value) || 0 })}
                          disabled={applying}
                          placeholder="L"
                        />
                        <input
                          type="number"
                          className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-[11px]"
                          value={p.width ?? ''}
                          onChange={e => updatePart(i, { width: Number(e.target.value) || 0 })}
                          disabled={applying}
                          placeholder="W"
                        />
                        <input
                          type="number"
                          className="w-full px-2 py-1.5 rounded border border-border bg-background font-mono text-[11px]"
                          value={p.thickness ?? ''}
                          onChange={e => updatePart(i, { thickness: Number(e.target.value) || 0 })}
                          disabled={applying}
                          placeholder="T"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 py-3 border-t border-border bg-card shrink-0">
          <p className="text-[10px] text-muted-foreground max-w-xl">
            Edits apply to the scene-origin slice only. Procurement rows on the design item are unchanged.
            {rows.length > 0 && (
              <span className="ml-1">
                <Check className="inline h-3 w-3 text-green-600 mb-px" /> {rows.length} part
                {rows.length === 1 ? '' : 's'}
              </span>
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={applying}
              className="text-xs px-3 py-1.5 border border-border rounded hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={applying || loading || !!error || rows.length === 0}
              className="text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {applying ? 'Saving…' : 'Apply to Design Manager'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
