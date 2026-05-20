/**
 * ProjectScenesPanel — drop-in section for Design Manager's project
 * detail page that makes the M:N Project→Scenes→Cabinets→DesignItems
 * relationship tangible.
 *
 * Today the link is only discoverable from the opposite end
 * (SceneContextCard shows a scene's project; DesignItemMetadataPanel
 * groups a DesignItem's cabinets by scene). Procurement / design users
 * opening a project have no way to see "all the scenes that make up
 * this project" without manually navigating the scene list.
 *
 * This panel collapses that: aggregate stats across the project's
 * scenes + a card grid with per-scene headline numbers + an
 * "Open in Design Studio" affordance.
 *
 * Realtime-ish: refetches on mount + on window focus. Scenes don't
 * churn often enough to justify a live listener for this card.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers, Box, Package, ExternalLink, Plus, Loader2, RefreshCw, Archive,
} from 'lucide-react';
import { getScenesForProject } from '@/subsidiaries/finishes/design-studio/services/scene.service';
import type { DesignScene } from '@/subsidiaries/finishes/design-studio/types/scene.types';

interface Props {
  projectId: string;
  /** Show archived scenes — off by default so procurement isn't
   *  distracted by legacy rounds. */
  includeArchived?: boolean;
}

/**
 * Scene shape as stored in Firestore at the top level — cabinets live
 * in a subcollection and aren't fetched by `getScenesForProject`, so
 * the per-scene cabinet stats come from cabinet counters denormalised
 * onto the scene doc if present, or fall back to an em-dash.
 */
type SceneRow = DesignScene & {
  /** Denormalised on `addCabinetToScene` / `removeCabinetFromScene`. */
  linkedDesignItemIds?: string[];
  cabinetCount?: number;
};

export function ProjectScenesPanel({ projectId, includeArchived = false }: Props) {
  const [scenes, setScenes] = useState<SceneRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setErr(null);
    try {
      const list = await getScenesForProject(projectId);
      setScenes(list as SceneRow[]);
    } catch (e) {
      setErr((e as Error).message || 'Failed to load scenes');
    } finally {
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    // Refetch when the tab regains focus — keeps the card honest
    // without a heavy listener.
    const onFocus = () => { void load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const visible = useMemo(() => {
    if (!scenes) return null;
    return includeArchived ? scenes : scenes.filter(s => s.status !== 'archived');
  }, [scenes, includeArchived]);

  // Aggregates — work off visible so the counts match what's shown.
  const totals = useMemo(() => {
    if (!visible) return null;
    let cabinets = 0;
    const allDesignItemIds = new Set<string>();
    for (const s of visible) {
      cabinets += s.cabinetCount ?? 0;
      for (const id of s.linkedDesignItemIds ?? []) allDesignItemIds.add(id);
    }
    return {
      scenes: visible.length,
      cabinets,
      designItems: allDesignItemIds.size,
    };
  }, [visible]);

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-600" />
            Scenes in this project
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each scene composes cabinets from one or more Design Items. Open a scene
            in Design Studio to author, re-price or push revisions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border hover:bg-accent disabled:opacity-40"
            title="Refresh scene list"
          >
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh
          </button>
          <Link
            to={`/workshop/scenes?projectId=${projectId}`}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-3 w-3" />
            New scene
          </Link>
        </div>
      </header>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-900">{err}</div>
      )}

      {/* Aggregate chips */}
      {totals && (
        <div className="flex flex-wrap gap-2">
          <AggregateChip icon={Layers} label="Scenes" value={totals.scenes} />
          <AggregateChip icon={Box} label="Cabinets" value={totals.cabinets || '—'} />
          <AggregateChip icon={Package} label="Design Items touched" value={totals.designItems || '—'} />
        </div>
      )}

      {/* Scene grid */}
      {visible === null ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading scenes…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState projectId={projectId} />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map(s => (
            <SceneCard key={s.id} scene={s} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function AggregateChip({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card">
      <Icon className="h-3.5 w-3.5 text-blue-600" />
      <span className="text-xs font-medium">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}

function SceneCard({ scene }: { scene: SceneRow }) {
  const isArchived = scene.status === 'archived';
  const cabinetCount = scene.cabinetCount ?? 0;
  const itemCount = scene.linkedDesignItemIds?.length ?? 0;
  const updated = (() => {
    const ts = scene.updatedAt as unknown as { toDate?: () => Date } | undefined;
    try {
      const d = ts?.toDate ? ts.toDate() : null;
      return d ? d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
    } catch { return '—'; }
  })();

  return (
    <li className={`rounded-lg border bg-card overflow-hidden ${isArchived ? 'opacity-70 border-dashed' : 'border-border'}`}>
      <Link to={`/workshop/scenes/${scene.id}`} className="block p-3 hover:bg-accent/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" title={scene.name}>
              {scene.name}
              {isArchived && (
                <span className="ml-1.5 text-[9px] uppercase text-muted-foreground inline-flex items-center gap-0.5">
                  <Archive className="h-2.5 w-2.5" /> archived
                </span>
              )}
            </p>
            {scene.description && (
              <p className="text-[11px] text-muted-foreground line-clamp-2">{scene.description}</p>
            )}
          </div>
          <StatusPill status={scene.status} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <Metric icon={Box} label="cabinets" value={cabinetCount} />
          <Metric icon={Package} label="items" value={itemCount} />
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Updated {updated}</span>
          <span className="inline-flex items-center gap-0.5 text-blue-600">
            Open <ExternalLink className="h-2.5 w-2.5" />
          </span>
        </div>
      </Link>
    </li>
  );
}

function Metric({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 text-foreground">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="font-medium">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function StatusPill({ status }: { status: DesignScene['status'] }) {
  const tint: Record<DesignScene['status'], string> = {
    draft:         'bg-amber-50 text-amber-700 border-amber-200',
    active:        'bg-green-50 text-green-700 border-green-200',
    in_production: 'bg-blue-50 text-blue-700 border-blue-200',
    archived:      'bg-muted text-muted-foreground border-border',
  };
  return (
    <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider border ${tint[status] ?? tint.draft}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

function EmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center space-y-2">
      <Layers className="h-6 w-6 mx-auto text-muted-foreground" />
      <p className="text-sm font-medium">No scenes for this project yet</p>
      <p className="text-xs text-muted-foreground">
        Scenes compose cabinets from this project's Design Items into a physical layout —
        the source of truth for 3D, cut lists, and production rollups.
      </p>
      <Link
        to={`/workshop/scenes?projectId=${projectId}`}
        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90"
      >
        <Plus className="h-3 w-3" />
        Create first scene
      </Link>
    </div>
  );
}

