/**
 * Cabinet Detection Panel — Quick Review inline AI cabinet detection
 *
 * Lets a user run aiDetectCabinets against the currently-loaded ParsedModel
 * without requiring a Scene context. Results are displayed in a read-only
 * review panel. The user can then promote the detection into a new Scene
 * (creating the scene + each selected cabinet in Firestore) for persistence
 * + production handoff — bridging Quick Review to the Scenes workspace.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { useAuth } from '@/shared/hooks/useAuth';
import { useBulkCabinetDetector } from '../hooks/useBulkCabinetDetector';
import { createScene, addCabinetToScene } from '../services/scene.service';
import { isCoverLikeMeshName } from '../services/cabinetDetector.service';
import { persistSceneSourceModel, detectionCentroidToPosition } from '../services/sceneSourceAsset.service';
import type { ParsedModel } from '../types/workshop-viewer.types';
import { DesignItemPicker, type DesignItemPickerValue } from './scene/DesignItemPicker';
import { isStandaloneProjectId } from '../utils/sceneProjectUtils';

interface CabinetDetectionPanelProps {
  parsedModel: ParsedModel | null;
  modelName?: string;
  projectId?: string;
}

export default function CabinetDetectionPanel({ parsedModel, modelName, projectId }: CabinetDetectionPanelProps) {
  const { user } = useAuth();
  const { status, result, error, detect, reset } = useBulkCabinetDetector();
  const [contextHint, setContextHint] = useState('');
  const [expectedCount, setExpectedCount] = useState<string>('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedSceneId, setSavedSceneId] = useState<string | null>(null);
  // P2 Slice 3 — when the panel has a real projectId, require a DesignItem
  // binding before we create the scene. Standalone (no projectId) still
  // works — those scenes go through the amber "standalone" path.
  const [selectedDesignItem, setSelectedDesignItem] = useState<DesignItemPickerValue | null>(null);
  const navigate = useNavigate();
  const isStandaloneScene = isStandaloneProjectId(projectId);
  const unassignedCoverMeshes = result?.unassigned.filter(u => isCoverLikeMeshName(u.meshName)) ?? [];

  const handleDetect = async () => {
    if (!parsedModel) return;
    const r = await detect(parsedModel, {
      contextHint: contextHint || undefined,
      expectedCount: expectedCount ? Number(expectedCount) : undefined,
    });
    if (r) setSelectedCodes(new Set(r.cabinets.map(c => c.provisionalCode)));
  };

  const toggle = (code: string) => {
    const next = new Set(selectedCodes);
    if (next.has(code)) next.delete(code); else next.add(code);
    setSelectedCodes(next);
  };

  const handleSaveScene = async () => {
    if (!result) return;
    const chosen = result.cabinets.filter(c => selectedCodes.has(c.provisionalCode));
    if (chosen.length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const sceneName = modelName
        ? `Scene from ${modelName.replace(/\.[a-z0-9]+$/i, '')}`
        : `Scene ${new Date().toLocaleString()}`;
      // P21.1 — `createScene` now rejects the legacy `'standalone'`
      // sentinel. Quick Review must run inside a real project context
      // (the page only renders this panel when one is available); the
      // `isStandaloneScene` guard below keeps the Save button disabled
      // otherwise, so this throw is defence-in-depth.
      if (isStandaloneScene || !projectId) {
        throw new Error(
          'Cannot save scene without a Design Manager project. ' +
            'Open Design Studio from a project context and try again.',
        );
      }
      const sceneId = await createScene({
        name: sceneName,
        projectId,
        customerId: 'standalone',
        description: `Generated from Quick Review — ${result.source} detection, ${chosen.length} cabinet(s).`,
      });

      // Export + upload the original model once as a shared source GLB so each
      // detected cabinet can render the relevant meshes in the Scene workspace.
      // This is REQUIRED — without it the saved cabinets have no geometry to
      // render. If the upload fails (e.g. storage rules reject, quota, CORS)
      // we fail the save so the user can retry instead of silently producing
      // an empty scene.
      let sourceModelUrl: string | undefined;
      if (parsedModel) {
        try {
          sourceModelUrl = await persistSceneSourceModel(sceneId, parsedModel, modelName);
        } catch (uploadErr) {
          console.error('[CabinetDetectionPanel] Failed to persist source GLB:', uploadErr);
          throw new Error(
            `Couldn't upload the source model to Storage: ${(uploadErr as Error).message || 'unknown error'}. ` +
            `Cabinets would render empty without it — please retry.`,
          );
        }
      }

      for (const cab of chosen) {
        // Rotate Z-up detection centroids (3DS / DXF) into Y-up world space
        // so the stored position matches the already-rotated GLB geometry —
        // otherwise `position.y` ends up being the source's "forward" axis
        // and cabinets render thousands of mm below the floor. Non-Z-up
        // sources (GLB, OBJ, FBX) pass through unchanged.
        const position = detectionCentroidToPosition(
          cab.centroid,
          cab.boundingBox.min.y,
          parsedModel?.source ?? 'glb',
        );
        await addCabinetToScene(sceneId, {
          pddId: cab.suggestedArchetypeKey || 'pdd-default',
          cabinetCode: cab.provisionalCode,
          displayName: cab.suggestedName,
          configuration: {},
          finishSelections: {},
          position,
          notes: cab.reasoning,
          // P2 Slice 3 — bind every cabinet to the selected DesignItem when
          // the panel has project context; standalone scenes skip this.
          ...(selectedDesignItem && !isStandaloneScene
            ? { designItemId: selectedDesignItem.id }
            : {}),
          sourceModelUrl,
          sourceMeshNames: cab.meshNames,
        });
      }

      setSavedSceneId(sceneId);
    } catch (err) {
      setSaveError((err as Error).message || 'Failed to save scene');
    } finally {
      setSaving(false);
    }
  };

  if (!parsedModel) {
    return (
      <div className="p-4 text-sm text-muted-foreground space-y-2">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4" />
          <span className="font-medium">Detect Cabinets</span>
        </div>
        <p>Upload a multi-cabinet 3D model to identify distinct cabinet boundaries with AI.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 text-sm overflow-y-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Boxes className="h-4 w-4" />
          <span className="font-medium">Detect Cabinets (AI)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Splits a multi-cabinet model into individual cabinets using Claude. Review results, then save as a Scene to continue production work.
        </p>
      </div>

      {status === 'idle' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Context hint (optional)</label>
            <input
              type="text"
              value={contextHint}
              onChange={(e) => setContextHint(e.target.value)}
              placeholder="e.g. kitchen base run, wardrobe wall"
              className="mt-1 w-full h-8 px-2 rounded border border-border bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Expected count (optional)</label>
            <input
              type="number"
              min="1"
              value={expectedCount}
              onChange={(e) => setExpectedCount(e.target.value)}
              placeholder="e.g. 5"
              className="mt-1 w-full h-8 px-2 rounded border border-border bg-background text-sm"
            />
          </div>
          <Button onClick={handleDetect} className="w-full" size="sm">
            <Boxes className="h-4 w-4 mr-2" />
            Run AI Detection
          </Button>
        </div>
      )}

      {status === 'detecting' && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-accent/50 text-accent-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Analyzing {parsedModel.objects?.length ?? 0} meshes with Claude…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Detection failed</div>
            <div>{error?.message ?? 'Unknown error'}</div>
            <Button variant="outline" size="sm" className="mt-2" onClick={reset}>Try again</Button>
          </div>
        </div>
      )}

      {status === 'done' && result && !savedSceneId && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={result.source === 'ai' ? 'default' : 'secondary'}>
              {result.source === 'ai' ? 'AI' : 'Spatial'}
            </Badge>
            <span>{(result.confidence * 100).toFixed(0)}% confidence</span>
            <span className="text-muted-foreground">· {result.durationMs}ms</span>
          </div>
          <p className="text-xs text-muted-foreground italic">{result.reasoning}</p>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">
              {result.cabinets.length} cabinet(s) found — select to include in scene:
            </div>
            {result.cabinets.map((cab) => {
              const sel = selectedCodes.has(cab.provisionalCode);
              return (
                <label
                  key={cab.provisionalCode}
                  className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${sel ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/40'}`}
                >
                  <input
                    type="checkbox"
                    checked={sel}
                    onChange={() => toggle(cab.provisionalCode)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold">{cab.provisionalCode}</span>
                      <span className="text-xs truncate">{cab.suggestedName}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {cab.meshNames.length} meshes · {cab.boundingBox.size.x.toFixed(0)}×{cab.boundingBox.size.y.toFixed(0)}×{cab.boundingBox.size.z.toFixed(0)}mm
                      · {(cab.confidence * 100).toFixed(0)}%
                      {cab.suggestedArchetypeKey ? ` · ${cab.suggestedArchetypeKey}` : ''}
                    </div>
                    <div className="text-[10px] text-muted-foreground italic mt-0.5 line-clamp-2">
                      {cab.reasoning}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {result.unassigned.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              {result.unassigned.length} mesh(es) unassigned
            </div>
          )}
          {unassignedCoverMeshes.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
              {unassignedCoverMeshes.length} cover panel mesh
              {unassignedCoverMeshes.length !== 1 ? 'es are' : ' is'} still unassigned. Re-run detection or adjust grouping before saving the scene.
            </div>
          )}

          {/* P2 Slice 3 — DesignItem binding for the scene-to-be. */}
          {!isStandaloneScene && selectedCodes.size > 0 && (
            <div className="rounded-md border border-blue-200 bg-blue-50/40 p-2 space-y-1.5">
              <p className="text-[11px] font-semibold text-blue-900">
                Design Item <span className="text-red-500">*</span>
              </p>
              <p className="text-[10px] text-blue-700">
                All cabinets in this new scene will belong to this DesignItem.
              </p>
              <DesignItemPicker
                projectId={projectId ?? ''}
                userId={user?.uid ?? ''}
                value={selectedDesignItem}
                onChange={setSelectedDesignItem}
              />
            </div>
          )}

          {saveError && (
            <div className="flex items-start gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSaveScene}
              disabled={
                saving ||
                selectedCodes.size === 0 ||
                // P2 Slice 3 — require a DesignItem on project-backed scenes.
                (!isStandaloneScene && !selectedDesignItem) ||
                unassignedCoverMeshes.length > 0
              }
              size="sm"
              className="flex-1"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Save as Scene ({selectedCodes.size})
            </Button>
            <Button variant="outline" size="sm" onClick={reset}>Re-run</Button>
          </div>
        </div>
      )}

      {savedSceneId && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400 text-xs">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Scene created</div>
              <div>Your detected cabinets were persisted as a Scene. You can open it to continue processing, positioning, and production handoff.</div>
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => navigate(`/workshop/scenes/${savedSceneId}`)}
          >
            Open Scene
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              reset();
              setSavedSceneId(null);
              setSelectedCodes(new Set());
            }}
          >
            Detect Again
          </Button>
        </div>
      )}
    </div>
  );
}
