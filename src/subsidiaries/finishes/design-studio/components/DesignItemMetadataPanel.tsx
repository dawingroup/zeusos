/**
 * DesignItemMetadataPanel — "what Design Manager already knows"
 *
 * P21.6: before this, parts parsed in the viewer were the only truth the
 * user could see. If the linked DesignItem already had a `parts` array
 * (seeded from a prior PolyBoard import or hand-entered by the designer)
 * or a `materialPalette` (curated finishes available on this project),
 * the viewer was blind to it — users would re-key the same cabinet from
 * scratch, or AI-recognise parts into the wrong finish because it had no
 * palette to aim at.
 *
 * This panel reads the already-resolved `projectContext` (populated by
 * `resolveFromDesignItem`) and surfaces:
 *   - DesignItem name + current stage (so the user knows what item this
 *     session is attached to, without leaving the viewer)
 *   - Existing parts (name / material / dims / qty) with a comparison
 *     badge vs. the count parsed from the loaded model
 *   - Material palette for the project (name / code / thickness /
 *     whether the finish has a linked inventoryItemId)
 *
 * It's read-only on purpose — edits belong in Design Manager or the
 * Parts / Materials panels that already exist. The value is the heads-up.
 *
 * Empty states cover three cases: (1) session not bound to an item,
 * (2) item has no recorded parts, (3) project has no material palette.
 */
import { useEffect, useState } from 'react';
import { Boxes, Layers, Palette, Package, CheckCircle2, AlertCircle, Lock, ExternalLink, Pencil, Loader2, Grid } from 'lucide-react';
import type { ProjectContext } from '../types/workshop-viewer.types';
import { getDesignItem, transitionStage } from '@/modules/design-manager/services/firestore';
import { EditDesignItemDialog } from '@/modules/design-manager/components/design-item/EditDesignItemDialog';
import { DesignItemIssuesPanel } from '@/modules/design-manager/components/DesignItemIssuesPanel';
import type { DesignItem, DesignStage } from '@/modules/design-manager/types';
import {
  getCabinetsForDesignItem,
  getScenesForProject,
} from '../services/scene.service';
import type { DesignScene, SceneCabinet } from '../types/scene.types';

/**
 * P21.9 — stage options mirror the `DesignStage` union in
 * design-manager/types/index.ts:98–124. Grouped so the dropdown reflects
 * the comment blocks in the type file (Manufacturing / Procurement /
 * Design Document / Construction). Keep in sync if that union changes.
 */
const STAGE_GROUPS: Array<{ label: string; stages: DesignStage[] }> = [
  {
    label: 'Manufacturing',
    stages: ['concept', 'preliminary', 'technical', 'pre-production', 'production-ready'],
  },
  {
    label: 'Procurement',
    stages: ['procure-identify', 'procure-quote', 'procure-approve', 'procure-order', 'procure-received'],
  },
  {
    label: 'Design Document',
    stages: ['arch-brief', 'arch-schematic', 'arch-development', 'arch-construction-docs', 'arch-approved'],
  },
  {
    label: 'Construction',
    stages: ['const-scope', 'const-spec', 'const-quote', 'const-approve', 'const-in-progress', 'const-inspection', 'const-complete'],
  },
];

interface DesignItemMetadataPanelProps {
  projectContext: ProjectContext | null;
  /** Parsed parts count from the loaded model — used for comparison badge. */
  parsedPartCount?: number;
  /** Needed for write paths (stage transition, item edit). */
  userId?: string;
  /**
   * Fired after a successful inline edit (rename, stage, full-dialog save)
   * so the parent can re-resolve `projectContext` and refresh the panel.
   */
  onItemChanged?: () => void | Promise<void>;
}

export function DesignItemMetadataPanel({
  projectContext,
  parsedPartCount,
  userId,
  onItemChanged,
}: DesignItemMetadataPanelProps) {
  const [stageSaving, setStageSaving] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editItem, setEditItem] = useState<DesignItem | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // P21.10 — reverse-lookup: every cabinet (across any scene in the
  // project) that belongs to this DesignItem. DesignItem→Cabinet is 1:N,
  // so this can easily be non-trivial; cap the render at a sensible
  // count and link the rest out to the project scene list.
  const [linkedCabinets, setLinkedCabinets] = useState<SceneCabinet[] | null>(null);
  const [scenesById, setScenesById] = useState<Map<string, DesignScene>>(new Map());
  const [cabinetsLoading, setCabinetsLoading] = useState(false);
  useEffect(() => {
    const itemId = projectContext?.designItemId;
    const projId = projectContext?.projectId;
    if (!itemId || !projId) {
      setLinkedCabinets(null);
      setScenesById(new Map());
      return;
    }
    let cancelled = false;
    setCabinetsLoading(true);
    Promise.all([
      getCabinetsForDesignItem(itemId),
      getScenesForProject(projId),
    ])
      .then(([cabs, scenes]) => {
        if (cancelled) return;
        setLinkedCabinets(cabs);
        setScenesById(new Map(scenes.map(s => [s.id, s])));
      })
      .catch(() => {
        if (cancelled) return;
        setLinkedCabinets([]);
        setScenesById(new Map());
      })
      .finally(() => {
        if (!cancelled) setCabinetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Refetch when the viewer's parent signals the item changed (rename /
    // stage) — use designItemName/Stage as a cheap proxy. The external
    // mutation signal is `onItemChanged` which re-resolves `projectContext`.
  }, [projectContext?.designItemId, projectContext?.projectId, projectContext?.designItemName, projectContext?.designItemStage]);
  const hasItem = !!projectContext?.designItemId;
  const knownParts = projectContext?.designItemParts ?? [];
  const palette = projectContext?.materialPalette ?? [];

  if (!projectContext) {
    return (
      <div className="p-3">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          No project context resolved. Open the viewer with
          <code className="mx-1 rounded bg-background px-1 py-0.5 text-[10px]">?projectId=…&amp;itemId=…</code>
          or bind the session from the Context panel to see Design Manager metadata.
        </div>
      </div>
    );
  }

  if (!hasItem) {
    return (
      <div className="p-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Session is bound to a project, but not to a specific DesignItem. Bind
          an item in the Context panel to surface its parts and palette here.
        </div>
      </div>
    );
  }

  // Compare parsed vs. known. `undefined` means nothing parsed yet — don't nag.
  let comparison: { tone: 'neutral' | 'match' | 'diff'; label: string } | null = null;
  if (typeof parsedPartCount === 'number' && parsedPartCount > 0) {
    if (knownParts.length === 0) {
      comparison = {
        tone: 'neutral',
        label: `Parsed ${parsedPartCount} — item has none on record`,
      };
    } else if (parsedPartCount === knownParts.length) {
      comparison = {
        tone: 'match',
        label: `Parsed ${parsedPartCount} · matches item count`,
      };
    } else {
      const delta = parsedPartCount - knownParts.length;
      comparison = {
        tone: 'diff',
        label: `Parsed ${parsedPartCount} vs. item's ${knownParts.length} (${delta > 0 ? '+' : ''}${delta})`,
      };
    }
  }

  const projectId = projectContext.projectId;
  const itemId = projectContext.designItemId!;
  const itemHref = `/design/project/${projectId}/item/${itemId}`;
  const projectHref = `/design/project/${projectId}`;
  const canWrite = !!userId;

  const handleStageChange = async (next: string) => {
    if (!canWrite || !next || next === projectContext.designItemStage) return;
    setStageSaving(true);
    setStageError(null);
    try {
      await transitionStage(projectId, itemId, next as DesignStage, userId!);
      await onItemChanged?.();
    } catch (err) {
      setStageError((err as Error).message || 'Stage change failed');
    } finally {
      setStageSaving(false);
    }
  };

  const handleOpenEdit = async () => {
    if (!canWrite) return;
    setEditLoading(true);
    setEditError(null);
    try {
      const full = await getDesignItem(projectId, itemId);
      if (!full) throw new Error('Item not found');
      setEditItem(full);
    } catch (err) {
      setEditError((err as Error).message || 'Failed to load item');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCloseEdit = async () => {
    const hadItem = !!editItem;
    setEditItem(null);
    if (hadItem) await onItemChanged?.();
  };

  return (
    <div className="p-3 space-y-3">
      {/* Item header */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-foreground/70 shrink-0" />
          <span className="text-xs font-medium truncate flex-1" title={projectContext.designItemName}>
            {projectContext.designItemName || projectContext.designItemId}
          </span>
          {canWrite && (
            <button
              type="button"
              onClick={handleOpenEdit}
              disabled={editLoading}
              className="inline-flex items-center gap-1 text-[11px] text-blue-700 hover:underline disabled:text-muted-foreground"
              title="Edit item (name, category, quantity, due date…)"
            >
              {editLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Pencil className="h-3 w-3" />
              )}
              Edit
            </button>
          )}
          <a
            href={itemHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-muted-foreground hover:text-foreground"
            title="Open in Design Manager"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
        {editError && <p className="text-[11px] text-red-600">{editError}</p>}
        <div className="text-[11px] text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-14 shrink-0">Stage</span>
            {canWrite ? (
              <>
                <select
                  value={projectContext.designItemStage ?? ''}
                  onChange={(e) => handleStageChange(e.target.value)}
                  disabled={stageSaving}
                  className="flex-1 min-w-0 rounded border border-border bg-background px-1.5 py-0.5 text-[11px] text-foreground disabled:opacity-60"
                >
                  {!projectContext.designItemStage && (
                    <option value="">—</option>
                  )}
                  {STAGE_GROUPS.map((grp) => (
                    <optgroup key={grp.label} label={grp.label}>
                      {grp.stages.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {stageSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </>
            ) : (
              <span className="text-foreground">{projectContext.designItemStage ?? '—'}</span>
            )}
          </div>
          {stageError && <p className="pl-16 text-[11px] text-red-600">{stageError}</p>}
          <div className="flex items-baseline gap-2">
            <span className="w-14 shrink-0">Project</span>
            <a
              href={projectHref}
              target="_blank"
              rel="noreferrer"
              className="truncate text-foreground hover:underline inline-flex items-center gap-1"
              title="Open project in Design Manager"
            >
              <span className="truncate">
                {projectContext.projectName || projectContext.projectCode || projectContext.projectId}
              </span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
          </div>
        </div>
      </div>

      {/* P21.8.1 — rollup authority summary. When any contributing cabinet
          is locked, its BOM/pricing contribution is a frozen snapshot and
          the rollup no longer tracks live scene edits on that cabinet.
          Making this visible here prevents silent drift surprises. */}
      {projectContext.rollupSummary && projectContext.rollupSummary.cabinetCount > 0 && (
        <div
          className={`flex items-start gap-2 rounded-md border p-2 text-[11px] ${
            projectContext.rollupSummary.lockedCabinetCount > 0
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-border bg-muted/40 text-muted-foreground'
          }`}
        >
          <Lock
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
              projectContext.rollupSummary.lockedCabinetCount > 0
                ? 'text-amber-600'
                : 'text-muted-foreground'
            }`}
          />
          <div className="min-w-0 leading-snug">
            {projectContext.rollupSummary.lockedCabinetCount > 0 ? (
              <>
                <strong className="font-medium">
                  {projectContext.rollupSummary.lockedCabinetCount} of{' '}
                  {projectContext.rollupSummary.cabinetCount}
                </strong>{' '}
                contributing cabinets are locked — their BOM &amp; pricing
                contributions are frozen in the rollup.
              </>
            ) : (
              <>
                {projectContext.rollupSummary.cabinetCount} contributing cabinet
                {projectContext.rollupSummary.cabinetCount === 1 ? '' : 's'}, all
                live — rollup tracks scene edits.
              </>
            )}
          </div>
        </div>
      )}

      {/* P21.10 — Cabinets in this DesignItem (reverse-lookup across all
          scenes in the project). Makes the 1:N relationship visible so
          users don't misread it as 1:1. */}
      <section>
        <div className="flex items-center gap-1.5 mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Grid className="h-3.5 w-3.5" />
          Cabinets in this item
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-foreground">
            {cabinetsLoading ? '…' : linkedCabinets?.length ?? 0}
          </span>
        </div>
        {cabinetsLoading ? (
          <div className="flex items-center gap-1.5 px-2 py-2 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading cabinets…
          </div>
        ) : !linkedCabinets || linkedCabinets.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-2.5 text-[11px] text-muted-foreground">
            No cabinets linked to this item yet. Add cabinets in a scene
            and assign them to this item from the Cabinet detail panel.
          </div>
        ) : (
          <CabinetsBySceneList
            cabinets={linkedCabinets}
            scenesById={scenesById}
            projectId={projectContext.projectId}
          />
        )}
      </section>

      {/* Parts known to Design Manager */}
      <section>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            Item parts on record
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-foreground">
              {knownParts.length}
            </span>
          </div>
        </div>
        {comparison && (
          <div
            className={`mb-1.5 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] ${
              comparison.tone === 'match'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : comparison.tone === 'diff'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-border bg-muted/40 text-muted-foreground'
            }`}
          >
            {comparison.tone === 'match' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : comparison.tone === 'diff' ? (
              <AlertCircle className="h-3 w-3" />
            ) : null}
            <span>{comparison.label}</span>
          </div>
        )}
        {knownParts.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-2.5 text-[11px] text-muted-foreground">
            No parts recorded on this item yet. Syncing from the Parts panel
            after recognition will populate it.
          </div>
        ) : (
          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-2 py-1 text-left font-medium">Part</th>
                  <th className="px-2 py-1 text-left font-medium">Material</th>
                  <th className="px-2 py-1 text-right font-medium">L×W×T</th>
                  <th className="px-2 py-1 text-right font-medium">Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {knownParts.map((p, i) => (
                  <tr key={`${p.name}-${i}`} className="hover:bg-accent/40">
                    <td className="px-2 py-1 truncate max-w-[140px]" title={p.name}>
                      {p.name || '—'}
                    </td>
                    <td
                      className="px-2 py-1 truncate max-w-[120px] text-muted-foreground"
                      title={p.materialName}
                    >
                      {p.materialName || '—'}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-muted-foreground whitespace-nowrap">
                      {p.length}×{p.width}×{p.thickness}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">{p.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Material palette */}
      <section>
        <div className="flex items-center gap-1.5 mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Palette className="h-3.5 w-3.5" />
          Project palette
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-foreground">
            {palette.length}
          </span>
        </div>
        {palette.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-2.5 text-[11px] text-muted-foreground">
            No curated palette on this project. Add finishes in Design Manager
            so material recognition can aim at known choices.
          </div>
        ) : (
          <ul className="space-y-1">
            {palette.map((m, i) => (
              <li
                key={`${m.code || m.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-[11px]"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package
                    className={`h-3 w-3 shrink-0 ${
                      m.inventoryItemId ? 'text-emerald-600' : 'text-amber-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground" title={m.name}>
                      {m.name || '—'}
                    </div>
                    {m.code && (
                      <div className="truncate text-[10px] font-mono text-muted-foreground">
                        {m.code}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                  {typeof m.thickness === 'number' && m.thickness > 0 && (
                    <span className="font-mono">{m.thickness}mm</span>
                  )}
                  {!m.inventoryItemId && (
                    <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] font-medium text-amber-800">
                      no inventory link
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Deep-link footer — for anything the inline edit doesn't cover
          (parts, pricing, approvals, deliverables). */}
      {/* Internal issues thread — raised from Parts Review or manually.
          Same panel is surfaced on the Design Manager detail page so
          both sides see one unified conversation. */}
      <DesignItemIssuesPanel
        projectId={projectId}
        designItemId={itemId}
        source="design-studio"
      />

      <a
        href={itemHref}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-1 text-[11px] text-blue-700 hover:underline"
      >
        Need to edit parts, pricing, or approvals? Open in Design Manager
        <ExternalLink className="h-3 w-3" />
      </a>

      {/* Full edit dialog — lazy-mounted once `getDesignItem` resolves. */}
      {editItem && userId && (
        <EditDesignItemDialog
          open={true}
          onClose={handleCloseEdit}
          item={editItem}
          projectId={projectId}
          userId={userId}
        />
      )}
    </div>
  );
}

export default DesignItemMetadataPanel;

// ── Reverse-lookup list ──

/**
 * P21.10 — groups cabinets by their parent scene and renders each group
 * with a link into the scene workspace (project-scoped URL). Scenes that
 * are no longer in the project's active scene set (archived, or a
 * cabinet that slipped through) still render under an "(unknown scene)"
 * heading rather than getting dropped — observability matters.
 */
function CabinetsBySceneList({
  cabinets,
  scenesById,
  projectId,
}: {
  cabinets: readonly SceneCabinet[];
  scenesById: ReadonlyMap<string, DesignScene>;
  projectId: string;
}) {
  // Group by sceneId while preserving the server-side order (which is
  // by cabinet.sequence ASC inside each scene).
  const groups = new Map<string, SceneCabinet[]>();
  for (const c of cabinets) {
    const arr = groups.get(c.sceneId) ?? [];
    arr.push(c);
    groups.set(c.sceneId, arr);
  }
  const sortedScenes = Array.from(groups.entries()).sort(([a], [b]) => {
    const an = scenesById.get(a)?.name ?? '~';
    const bn = scenesById.get(b)?.name ?? '~';
    return an.localeCompare(bn);
  });

  return (
    <div className="space-y-2">
      {sortedScenes.map(([sceneId, sceneCabs]) => {
        const scene = scenesById.get(sceneId);
        const sceneName = scene?.name ?? '(unknown scene)';
        const sceneHref = `/workshop/projects/${projectId}/scenes/${sceneId}`;
        return (
          <div key={sceneId} className="rounded-md border border-border overflow-hidden">
            <a
              href={sceneHref}
              className="flex items-center justify-between bg-muted/60 px-2 py-1 text-[11px] font-medium hover:bg-muted"
            >
              <span className="truncate flex items-center gap-1" title={sceneName}>
                {sceneName}
                <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
              </span>
              <span className="text-[10px] text-muted-foreground">
                {sceneCabs.length} cab{sceneCabs.length === 1 ? '' : 's'}
              </span>
            </a>
            <ul className="divide-y divide-border">
              {sceneCabs.map(c => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 px-2 py-1 text-[11px]"
                >
                  <a
                    href={`${sceneHref}?cabinetId=${c.id}`}
                    className="min-w-0 flex-1 flex items-center gap-1.5 hover:underline"
                  >
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {c.cabinetCode || c.id.slice(0, 6)}
                    </span>
                    <span className="truncate" title={c.displayName}>
                      {c.displayName || '—'}
                    </span>
                  </a>
                  {c.isLocked && (
                    <span className="rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-medium text-emerald-800 shrink-0">
                      Locked
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
