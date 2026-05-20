/**
 * SceneContextCard — read-only summary of the scene's project binding.
 *
 * Shows the linked DesignProject's name + code + customer, the scene's
 * current status, and `createdAt`. On a standalone scene (no real
 * projectId) surfaces a "Bind to project…" button that opens the
 * existing `DesignProjectPicker` and round-trips through `updateScene`.
 *
 * Deliberately minimal — a dedicated replacement for Workshop Viewer's
 * SessionContextCard, which assumes a 1:1 session↔item binding that
 * doesn't map onto a multi-cabinet scene.
 */
import { useEffect, useState } from 'react';
import { Link2, Loader2, Building, User } from 'lucide-react';
import { getProject } from '@/modules/design-manager/services';
import type { DesignProject } from '@/modules/design-manager/types';
import type { DesignScene } from '../../types/scene.types';
import { updateScene } from '../../services/scene.service';
import { isStandaloneProjectId } from '../../utils/sceneProjectUtils';
import { DesignProjectPicker, type DesignProjectPickerValue } from './DesignProjectPicker';

interface SceneContextCardProps {
  scene: DesignScene | null;
  onBound?: () => void;
}

function formatDate(ts: unknown): string {
  if (!ts) return '';
  const t = ts as { toDate?: () => Date };
  const d = t.toDate ? t.toDate() : new Date(ts as string);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SceneContextCard({ scene, onBound }: SceneContextCardProps) {
  const [project, setProject] = useState<DesignProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState<DesignProjectPickerValue | null>(null);
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);

  const standalone = !scene || isStandaloneProjectId(scene.projectId);

  // Hydrate the linked project once per scene.projectId. Standalone
  // scenes skip the fetch — there's nothing to look up.
  useEffect(() => {
    if (!scene || standalone) {
      setProject(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProject(scene.projectId)
      .then(p => { if (!cancelled) setProject(p); })
      .catch(() => { if (!cancelled) setProject(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [scene, standalone]);

  const handleBind = async () => {
    if (!scene || !pickerValue) return;
    setBinding(true);
    setBindError(null);
    try {
      await updateScene(scene.id, {
        projectId: pickerValue.id,
        customerId: pickerValue.customerId ?? scene.customerId ?? '',
      } as Partial<DesignScene>);
      setPickerOpen(false);
      setPickerValue(null);
      onBound?.();
    } catch (err) {
      setBindError((err as Error).message || 'Failed to bind to project');
    } finally {
      setBinding(false);
    }
  };

  if (!scene) {
    return (
      <div className="p-4 text-xs text-muted-foreground leading-relaxed">
        No scene loaded.
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 text-sm">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> Scene Context
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{scene.name}</p>
      </div>

      {/* Project binding block */}
      {standalone ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs space-y-2">
          <p className="text-amber-900 font-medium">Standalone scene</p>
          <p className="text-amber-800 leading-relaxed">
            This scene isn't bound to a Design Manager project yet. Some features
            (production rollup, project PDFs, DesignItem metadata) require a
            project link.
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700"
          >
            Bind to project…
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading project…
        </div>
      ) : project ? (
        <div className="rounded-md border border-border p-3 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Project</p>
            <p className="text-sm font-semibold">{project.name}</p>
            {project.code && (
              <p className="text-[11px] font-mono text-muted-foreground">{project.code}</p>
            )}
          </div>
          {project.customerName && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <User className="h-3 w-3" /> {project.customerName}
            </div>
          )}
          {project.status && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Building className="h-3 w-3" /> Project status:
              <span className="font-medium text-foreground capitalize">{project.status}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
          Project <span className="font-mono">{scene.projectId}</span> not found
          or you don't have access.
        </div>
      )}

      {/* Scene meta */}
      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium capitalize">{scene.status ?? '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Cabinets</dt>
          <dd className="font-medium">{scene.totalCabinetCount ?? 0}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Created</dt>
          <dd className="font-medium">{formatDate(scene.createdAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Updated</dt>
          <dd className="font-medium">{formatDate(scene.updatedAt)}</dd>
        </div>
      </dl>

      {/* Bind-to-project dialog */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setPickerOpen(false); }}
        >
          <div className="bg-card rounded-lg shadow-xl border border-border w-96 max-w-[90vw] p-4 space-y-3">
            <h3 className="text-sm font-semibold">Bind scene to project</h3>
            <DesignProjectPicker
              value={pickerValue}
              onChange={setPickerValue}
            />
            {bindError && (
              <p className="text-xs text-red-600">{bindError}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBind}
                disabled={!pickerValue || binding}
                className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                {binding ? 'Binding…' : 'Bind'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
