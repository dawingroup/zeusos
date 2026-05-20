/**
 * SceneBrowser — Lists design scenes for a project
 *
 * Shows scene cards with name, cabinet count, total value, status, last updated.
 * Provides create-scene functionality.
 */
import { useState, useCallback, useEffect } from 'react';
import { useSceneList } from '../../hooks/useScene';
import type { DesignScene } from '../../types/scene.types';
import { DesignProjectPicker, type DesignProjectPickerValue } from './DesignProjectPicker';
import { getProject } from '@/modules/design-manager/services';
import { isProjectBoundProjectId, suggestSceneName } from '../../utils/sceneProjectUtils';

interface SceneBrowserProps {
  projectId?: string;
  onSceneSelect: (sceneId: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', color: 'bg-blue-100 text-blue-700' },
  in_production: { label: 'In Production', color: 'bg-green-100 text-green-700' },
  archived: { label: 'Archived', color: 'bg-amber-100 text-amber-700' },
};

function formatCurrency(amount: number, currency: string): string {
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
  }
  return `UGX ${amount.toLocaleString('en-UG', { minimumFractionDigits: 0 })}`;
}

function formatDate(timestamp: unknown): string {
  if (!timestamp) return '';
  const ts = timestamp as { toDate?: () => Date };
  const date = ts.toDate ? ts.toDate() : new Date(timestamp as string);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function SceneBrowser({ projectId, onSceneSelect }: SceneBrowserProps) {
  const { scenes, isLoading, error, create, remove } = useSceneList();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSceneName, setNewSceneName] = useState('');
  const [pickedProject, setPickedProject] = useState<DesignProjectPickerValue | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingSceneId, setDeletingSceneId] = useState<string | null>(null);
  const [confirmingDeleteSceneId, setConfirmingDeleteSceneId] = useState<string | null>(null);

  const handleDelete = useCallback(async (sceneId: string) => {
    setDeletingSceneId(sceneId);
    try {
      await remove(sceneId);
      setConfirmingDeleteSceneId(null);
    } catch (err) {
      console.error('[SceneBrowser] Delete failed:', err);
      alert(`Failed to delete scene: ${(err as Error).message}`);
    } finally {
      setDeletingSceneId(null);
    }
  }, [remove]);

  const filteredScenes = projectId
    ? scenes.filter(s => s.projectId === projectId)
    : scenes;

  // P21.10 — scenes under whichever project is currently picked (for the
  // dialog) or shown (for the header). Used to derive the auto name and
  // to show the project scene count in the header.
  const scopedProjectId = pickedProject?.id ?? projectId;
  const scenesInScope = scopedProjectId
    ? scenes.filter(s => s.projectId === scopedProjectId)
    : [];

  // When the browser is opened from a project context (projectId prop
  // present), pre-fill the picker with that project so the user doesn't
  // re-choose it. When opened standalone (list view), the picker stays
  // empty and the user must choose.
  useEffect(() => {
    if (!showCreateDialog) return;
    if (!isProjectBoundProjectId(projectId)) {
      setPickedProject(null);
      return;
    }
    let cancelled = false;
    getProject(projectId)
      .then(p => {
        if (cancelled || !p) return;
        setPickedProject({
          id: p.id,
          name: p.name,
          code: p.code,
          customerId: p.customerId,
          customerName: p.customerName,
        });
      })
      .catch(() => {
        /* fall through — user can still pick manually */
      });
    return () => {
      cancelled = true;
    };
  }, [showCreateDialog, projectId]);

  // P21.10 — prefill the scene name from the picked project whenever the
  // dialog opens or the user changes their project pick. We only overwrite
  // an empty or auto-shaped name; a hand-typed override stays untouched.
  useEffect(() => {
    if (!showCreateDialog || !pickedProject) return;
    const existing = scenes
      .filter(s => s.projectId === pickedProject.id)
      .map(s => s.name);
    const suggestion = suggestSceneName(pickedProject.name, existing);
    setNewSceneName(prev => {
      // Keep user's typed value unless it's blank or still matches a
      // previously-generated suggestion prefix (same project name +
      // "Scene" pattern).
      if (!prev.trim()) return suggestion;
      const autoShape = new RegExp(
        `^${pickedProject.name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')} - Scene \\d+$`,
      );
      return autoShape.test(prev) ? suggestion : prev;
    });
  }, [showCreateDialog, pickedProject, scenes]);

  const openCreateDialog = useCallback(() => {
    setCreateError(null);
    setShowCreateDialog(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setShowCreateDialog(false);
    setNewSceneName('');
    setPickedProject(null);
    setCreateError(null);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!pickedProject) return;
    // P21.10 — blank name submission falls back to the auto suggestion.
    // The Create button is no longer disabled on empty name; users can
    // one-click create from a project-scoped URL.
    const existing = scenes
      .filter(s => s.projectId === pickedProject.id)
      .map(s => s.name);
    const nameToUse =
      newSceneName.trim() || suggestSceneName(pickedProject.name, existing);
    setIsCreating(true);
    setCreateError(null);
    try {
      const id = await create({
        name: nameToUse,
        projectId: pickedProject.id,
        // Reuse the project's customer so scene-level queries that filter
        // by customer (quotes, portals) don't need a second round-trip.
        customerId: pickedProject.customerId ?? '',
      });
      closeCreateDialog();
      onSceneSelect(id);
    } catch (err) {
      setCreateError((err as Error).message || 'Failed to create scene');
    } finally {
      setIsCreating(false);
    }
  }, [newSceneName, pickedProject, scenes, create, onSceneSelect, closeCreateDialog]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Failed to load scenes: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Design Scenes</h2>
        <button
          type="button"
          onClick={openCreateDialog}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Scene
        </button>
      </div>

      {filteredScenes.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-base font-semibold mb-1">No design scenes yet</h3>
              <p className="text-sm text-gray-500">
                Scenes let you compose multi-cabinet projects — kitchens, wardrobe walls, fitouts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
              <div className="rounded-lg bg-white border border-gray-200 p-3">
                <div className="text-xs font-semibold text-gray-700 mb-1">1. Create</div>
                <p className="text-[11px] text-gray-500">Name your scene and link it to a project.</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-3">
                <div className="text-xs font-semibold text-blue-700 mb-1">2. Add cabinets</div>
                <p className="text-[11px] text-gray-500">
                  Add one at a time from a PDD, or <span className="font-medium">Bulk Import</span> a multi-cabinet model.
                </p>
              </div>
              <div className="rounded-lg bg-white border border-gray-200 p-3">
                <div className="text-xs font-semibold text-purple-700 mb-1">3. Process with AI</div>
                <p className="text-[11px] text-gray-500">Claude groups assemblies, resolves materials, computes BOM.</p>
              </div>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={openCreateDialog}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create your first scene
              </button>
              {!projectId && (
                <p className="text-[10px] text-gray-400 mt-2">
                  You'll be asked to pick a Design Manager project in the next step.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredScenes.map(scene => (
            <SceneCard
              key={scene.id}
              scene={scene}
              onClick={() => onSceneSelect(scene.id)}
              onDelete={() => setConfirmingDeleteSceneId(scene.id)}
            />
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {confirmingDeleteSceneId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-2 text-red-700">Delete scene?</h3>
            <p className="text-sm text-gray-600 mb-4">
              {(() => {
                const s = scenes.find(sc => sc.id === confirmingDeleteSceneId);
                return s
                  ? `"${s.name}" and all ${s.totalCabinetCount} cabinet${s.totalCabinetCount !== 1 ? 's' : ''} in it will be permanently deleted, along with any uploaded source models. This cannot be undone.`
                  : 'This scene will be permanently deleted. This cannot be undone.';
              })()}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDeleteSceneId(null)}
                disabled={deletingSceneId === confirmingDeleteSceneId}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmingDeleteSceneId)}
                disabled={deletingSceneId === confirmingDeleteSceneId}
                className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deletingSceneId === confirmingDeleteSceneId ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Scene Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-1">New Design Scene</h3>
            <p className="text-xs text-gray-500 mb-4">
              Scenes must be linked to a Design Manager project so their
              cabinets roll up into item-level pricing and production.
            </p>

            <label className="block text-xs font-medium text-gray-700 mb-1">
              Scene name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={newSceneName}
              onChange={e => setNewSceneName(e.target.value)}
              placeholder={
                pickedProject
                  ? suggestSceneName(
                      pickedProject.name,
                      scenesInScope.map(s => s.name),
                    )
                  : 'Pick a project to auto-name…'
              }
              className="w-full border rounded-md px-3 py-2 text-sm mb-1"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && pickedProject) handleCreate();
              }}
            />
            <p className="text-[10px] text-gray-400 mb-4">
              Leave blank to auto-name as <span className="font-mono">{'{Project} - Scene N'}</span>.
            </p>

            <label className="block text-xs font-medium text-gray-700 mb-1">
              Design project
            </label>
            <DesignProjectPicker
              value={pickedProject}
              onChange={setPickedProject}
              disabled={isCreating}
            />

            {createError && (
              <p className="text-xs text-red-600 mt-3">{createError}</p>
            )}

            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={closeCreateDialog}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!pickedProject || isCreating}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                title={
                  !pickedProject
                    ? 'Pick a Design Manager project first'
                    : undefined
                }
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scene Card ──

function SceneCard({
  scene,
  onClick,
  onDelete,
}: {
  scene: DesignScene;
  onClick: () => void;
  onDelete: () => void;
}) {
  const badge = STATUS_BADGE[scene.status] ?? STATUS_BADGE.draft;

  return (
    <div
      className="relative rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all group"
    >
      {/* Delete button — visible on hover, stopPropagation so it doesn't open the scene */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete scene"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-md bg-white text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-opacity z-10"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
        </svg>
      </button>

      <button
        type="button"
        onClick={onClick}
        className="w-full text-left"
      >
        <div className="flex items-start justify-between mb-2 pr-8">
          <h3 className="font-medium text-sm truncate">{scene.name}</h3>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
            {badge.label}
          </span>
        </div>

        {scene.description && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-2">{scene.description}</p>
        )}

        <div className="flex items-center gap-4 text-xs text-gray-600">
          <span>{scene.totalCabinetCount} cabinet{scene.totalCabinetCount !== 1 ? 's' : ''}</span>
          {scene.totalEstimatedValue > 0 && (
            <span>{formatCurrency(scene.totalEstimatedValue, scene.currency)}</span>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-2">{formatDate(scene.updatedAt)}</p>
      </button>
    </div>
  );
}
