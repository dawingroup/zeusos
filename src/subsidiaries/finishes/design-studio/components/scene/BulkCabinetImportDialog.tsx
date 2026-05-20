/**
 * BulkCabinetImportDialog — Upload one multi-cabinet model, AI splits it into N cabinets
 *
 * Workflow:
 *   1. User uploads a model file (3DS / DXF / GLB)
 *   2. File is parsed
 *   3. AI detects distinct cabinets within the model
 *   4. User reviews detected cabinets, can rename/exclude
 *   5. On confirm, one SceneCabinet is created per selected detection
 */
import { useState, useCallback, useRef } from 'react';
import { Upload, Loader2, Check, Box, Sparkles } from 'lucide-react';
import { useModelParser } from '../../hooks/useModelParser';
import { useBulkCabinetDetector } from '../../hooks/useBulkCabinetDetector';
import { addCabinetToScene, getSceneCabinets } from '../../services/scene.service';
import { isCoverLikeMeshName } from '../../services/cabinetDetector.service';
import { processModel } from '../../services/processModel.service';
import { createDesignItem } from '@/modules/design-manager/services';
import {
  detectionCentroidToPosition,
  persistSceneSourceModel,
} from '../../services/sceneSourceAsset.service';
import type { DetectedCabinet } from '../../types/cabinetDetection.types';
import { DesignItemPicker, type DesignItemPickerValue } from './DesignItemPicker';
import { isStandaloneProjectId } from '../../utils/sceneProjectUtils';

interface BulkCabinetImportDialogProps {
  sceneId: string;
  /** P2 Slice 3: required so detected cabinets can be bound to a DesignItem. */
  projectId: string;
  userId: string;
  existingCodes: string[];
  onComplete: () => void;
  onClose: () => void;
}

/**
 * P2 Slice 3 — DesignItem binding modes for bulk import.
 *  - 'shared'            → all detected cabinets → one DesignItem chosen in the picker
 *  - 'per-cabinet-auto'  → one auto-created DesignItem per detected cabinet,
 *                          named after the detection's suggestedName
 *  - 'per-cabinet-manual' → P21.10: render a DesignItemPicker per cabinet row
 *                          so the user selects (or inline-creates) a distinct
 *                          DesignItem for each processed cabinet. This is
 *                          the precise-mapping mode.
 */
type DesignItemBindingMode = 'shared' | 'per-cabinet-auto' | 'per-cabinet-manual';

type Step = 'upload' | 'detecting' | 'review' | 'creating' | 'done';

const MODEL_EXTENSIONS = ['.3ds', '.dxf', '.glb', '.gltf'];

export function BulkCabinetImportDialog({
  sceneId,
  projectId,
  userId,
  existingCodes,
  onComplete,
  onClose,
}: BulkCabinetImportDialogProps) {
  const isStandaloneScene = isStandaloneProjectId(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { model, loading: parsing, error: parseError, loadModelFile, modelFileName } = useModelParser();
  const { status: detectStatus, result, detect, reset: resetDetect } = useBulkCabinetDetector();

  const [step, setStep] = useState<Step>('upload');
  const [contextHint, setContextHint] = useState('');
  const [expectedCount, setExpectedCount] = useState<number | undefined>(undefined);
  const [detectedCabinets, setDetectedCabinets] = useState<DetectedCabinet[]>([]);
  const [autoProcess, setAutoProcess] = useState(true);
  const [creatingProgress, setCreatingProgress] = useState({ done: 0, total: 0, currentName: '' });
  const [createError, setCreateError] = useState<string | null>(null);

  // P2 Slice 3 — DesignItem binding state.
  const [bindingMode, setBindingMode] = useState<DesignItemBindingMode>('shared');
  const [sharedDesignItem, setSharedDesignItem] = useState<DesignItemPickerValue | null>(null);
  // P21.10 — per-cabinet-manual mode: one picker value per detection index.
  const [perCabinetDesignItems, setPerCabinetDesignItems] = useState<
    Record<number, DesignItemPickerValue | null>
  >({});
  const unassignedCoverMeshes = result?.unassigned?.filter(u => isCoverLikeMeshName(u.meshName)) ?? [];

  const handleFilePick = useCallback((file: File) => {
    loadModelFile(file);
  }, [loadModelFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFilePick(file);
  }, [handleFilePick]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFilePick(file);
  }, [handleFilePick]);

  const handleDetect = useCallback(async () => {
    if (!model) return;
    setStep('detecting');
    const r = await detect(model, { expectedCount, contextHint: contextHint || undefined });
    if (r) {
      setDetectedCabinets(r.cabinets);
      setStep('review');
    } else {
      setStep('upload');
    }
  }, [model, detect, expectedCount, contextHint]);

  const toggleSelect = useCallback((idx: number) => {
    setDetectedCabinets(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  }, []);

  const updateCabinet = useCallback((idx: number, patch: Partial<DetectedCabinet>) => {
    setDetectedCabinets(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
  }, []);

  const handleCreate = useCallback(async () => {
    const toCreate = detectedCabinets.filter(c => c.selected);
    if (toCreate.length === 0 || !model) return;

    setStep('creating');
    setCreatingProgress({ done: 0, total: toCreate.length, currentName: '' });
    setCreateError(null);

    const usedCodes = new Set(existingCodes);
    const createdCabinetIds: { id: string; meshes: string[]; archetype?: string; name: string }[] = [];

    try {
      // Phase 0: upload the source GLB once. Without this, every cabinet
      // is stored with no geometry pointer and the scene viewport has
      // nothing to render. Match CabinetDetectionPanel's contract — if
      // the upload fails, abort the bulk save so the user can retry.
      let sourceModelUrl: string | undefined;
      try {
        sourceModelUrl = await persistSceneSourceModel(sceneId, model, modelFileName ?? undefined);
      } catch (uploadErr) {
        console.error('[BulkCabinetImportDialog] Failed to persist source GLB:', uploadErr);
        throw new Error(
          `Couldn't upload the source model to Storage: ${(uploadErr as Error).message || 'unknown error'}. ` +
          `Cabinets would render empty without it — please retry.`,
        );
      }

      // Phase A: create all cabinets in Firestore
      // We need the detection's *original* index (before the selected-filter)
      // so that `perCabinetDesignItems` lookups still line up.
      const selectedWithIndex = detectedCabinets
        .map((c, idx) => ({ cab: c, idx }))
        .filter(x => x.cab.selected);
      for (let i = 0; i < selectedWithIndex.length; i++) {
        const { cab, idx: originalIdx } = selectedWithIndex[i];
        let code = cab.provisionalCode;
        let suffix = 1;
        while (usedCodes.has(code)) {
          code = `${cab.provisionalCode}-${suffix++}`;
        }
        usedCodes.add(code);

        setCreatingProgress({ done: i, total: toCreate.length, currentName: `Creating ${cab.suggestedName}...` });

        // P2 Slice 3 — resolve DesignItem binding for this cabinet.
        let designItemId: string | undefined;
        if (!isStandaloneScene) {
          if (bindingMode === 'shared' && sharedDesignItem) {
            designItemId = sharedDesignItem.id;
          } else if (bindingMode === 'per-cabinet-auto') {
            designItemId = await createDesignItem(
              projectId,
              {
                name: cab.suggestedName,
                category: 'casework',
                sourcingType: 'MANUFACTURED',
              },
              userId,
            );
          } else if (bindingMode === 'per-cabinet-manual') {
            const picked = perCabinetDesignItems[originalIdx];
            if (picked) designItemId = picked.id;
          }
        }

        // Apply the same Z-up → Y-up rotation as the geometry export so
        // `position.y` doesn't end up as the source's "forward" axis.
        const position = model
          ? detectionCentroidToPosition(
              cab.centroid,
              cab.boundingBox?.min?.y ?? 0,
              model.source,
            )
          : { ...cab.centroid, anchoredTo: 'floor' as const };
        const cabinetId = await addCabinetToScene(sceneId, {
          pddId: cab.suggestedArchetypeKey || 'pdd-default',
          cabinetCode: code,
          displayName: cab.suggestedName,
          configuration: {},
          finishSelections: {},
          position,
          ...(designItemId ? { designItemId } : {}),
          // Without these two, the viewport's `useSceneViewport` can't
          // find any geometry to render for the cabinet. `sourceModelUrl`
          // points at the shared source GLB uploaded above; `sourceMeshNames`
          // narrows that GLB down to the meshes this cabinet owns.
          sourceModelUrl,
          sourceMeshNames: cab.meshNames,
        });

        createdCabinetIds.push({
          id: cabinetId,
          meshes: cab.meshNames,
          archetype: cab.suggestedArchetypeKey,
          name: cab.suggestedName,
        });

        setCreatingProgress({ done: i + 1, total: toCreate.length, currentName: '' });
      }

      // Phase B: optionally auto-process each cabinet using the parsed model
      if (autoProcess && createdCabinetIds.length > 0) {
        // Load the freshly-created cabinets back to get full SceneCabinet objects
        const allCabinets = await getSceneCabinets(sceneId);
        const cabinetMap = new Map(allCabinets.map(c => [c.id, c]));

        const totalSteps = toCreate.length + createdCabinetIds.length;

        for (let i = 0; i < createdCabinetIds.length; i++) {
          const created = createdCabinetIds[i];
          const cabinet = cabinetMap.get(created.id);
          if (!cabinet) continue;

          setCreatingProgress({
            done: toCreate.length + i,
            total: totalSteps,
            currentName: `Processing ${created.name} with AI...`,
          });

          try {
            await processModel({
              sceneId,
              cabinetId: created.id,
              cabinet,
              parsedModel: model,
              meshFilter: created.meshes,
              archetypeKey: created.archetype,
              modelName: created.name,
              fileType: 'glb',
            });
          } catch (procErr) {
            // Don't abort the bulk; cabinets are created — processing can be retried
            console.warn(`Auto-processing failed for ${created.name}:`, procErr);
          }

          setCreatingProgress({
            done: toCreate.length + i + 1,
            total: totalSteps,
            currentName: '',
          });
        }
      }

      setStep('done');
      onComplete();
    } catch (err) {
      setCreateError((err as Error).message);
      setStep('review');
    }
  }, [
    detectedCabinets,
    sceneId,
    existingCodes,
    onComplete,
    model,
    autoProcess,
    isStandaloneScene,
    bindingMode,
    sharedDesignItem,
    perCabinetDesignItems,
    projectId,
    userId,
  ]);

  const handleStartOver = useCallback(() => {
    resetDetect();
    setDetectedCabinets([]);
    setStep('upload');
  }, [resetDetect]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Bulk Import — Multi-Cabinet Model</h3>
            <p className="text-xs text-gray-500 mt-0.5">Upload one model, AI splits it into individual cabinets</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Upload */}
          {step === 'upload' && !model && (
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm font-medium">Drop a 3DS, DXF, or GLB file</p>
              <p className="text-xs text-gray-400 mt-1">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={MODEL_EXTENSIONS.join(',')}
                onChange={handleFileInput}
                className="hidden"
              />
              {parsing && (
                <p className="text-xs text-blue-600 mt-3 flex items-center justify-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Parsing {modelFileName}...
                </p>
              )}
              {parseError && (
                <p className="text-xs text-red-600 mt-3">{parseError}</p>
              )}
            </div>
          )}

          {/* Step 1b: Model loaded, ready to detect */}
          {step === 'upload' && model && (
            <div className="space-y-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm font-medium">{modelFileName}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {model.objects?.length ?? 0} meshes parsed
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Context hint (optional)</label>
                <input
                  type="text"
                  value={contextHint}
                  onChange={e => setContextHint(e.target.value)}
                  placeholder="e.g. Kitchen base run with sink unit"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
                <p className="text-[10px] text-gray-400 mt-1">Helps the AI choose the right archetype.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expected cabinet count (optional)</label>
                <input
                  type="number"
                  min={1}
                  value={expectedCount ?? ''}
                  onChange={e => setExpectedCount(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="Auto-detect"
                  className="w-full border rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {/* Step 2: Detecting */}
          {step === 'detecting' && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-3 animate-spin" />
              <p className="text-sm font-medium">AI detecting cabinets...</p>
              <p className="text-xs text-gray-400 mt-1">Analyzing {model?.objects?.length ?? 0} meshes</p>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 'review' && (
            <div className="space-y-3">
              {result && (
                <div className="rounded-lg bg-blue-50 p-3 text-xs">
                  <p className="font-medium text-blue-900">
                    {detectedCabinets.length} cabinet{detectedCabinets.length !== 1 ? 's' : ''} detected
                    <span className="ml-2 text-blue-600">
                      ({Math.round(result.confidence * 100)}% confidence, {result.source})
                    </span>
                  </p>
                  <p className="text-blue-700 mt-1 italic">"{result.reasoning}"</p>
                </div>
              )}

              {detectedCabinets.map((cab, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${cab.selected ? 'border-blue-300 bg-blue-50/30' : 'border-gray-200 opacity-60'}`}
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => toggleSelect(i)}
                      className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        cab.selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}
                    >
                      {cab.selected && <Check className="w-3 h-3 text-white" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <input
                          type="text"
                          value={cab.provisionalCode}
                          onChange={e => updateCabinet(i, { provisionalCode: e.target.value.toUpperCase() })}
                          className="text-xs font-mono font-semibold border rounded px-1.5 py-0.5 w-24"
                          disabled={!cab.selected}
                        />
                        <input
                          type="text"
                          value={cab.suggestedName}
                          onChange={e => updateCabinet(i, { suggestedName: e.target.value })}
                          className="text-sm flex-1 border rounded px-2 py-0.5"
                          disabled={!cab.selected}
                        />
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-gray-500">
                        {cab.suggestedArchetypeKey && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 font-medium">
                            {cab.suggestedArchetypeKey}
                          </span>
                        )}
                        <span>{cab.meshNames.length} meshes</span>
                        <span>
                          {cab.boundingBox.size.x.toFixed(0)}×{cab.boundingBox.size.y.toFixed(0)}×{cab.boundingBox.size.z.toFixed(0)} mm
                        </span>
                        <span className={cab.confidence >= 0.8 ? 'text-green-600' : cab.confidence >= 0.5 ? 'text-amber-600' : 'text-red-600'}>
                          {Math.round(cab.confidence * 100)}%
                        </span>
                      </div>

                      <p className="text-[10px] text-gray-500 italic mt-1">"{cab.reasoning}"</p>

                      {/* P21.10 — per-cabinet-manual DesignItem picker */}
                      {cab.selected &&
                        !isStandaloneScene &&
                        bindingMode === 'per-cabinet-manual' && (
                          <div className="mt-2 pt-2 border-t border-blue-100">
                            <p className="text-[10px] font-medium text-blue-900 mb-1">
                              Design Item for this cabinet
                            </p>
                            <DesignItemPicker
                              projectId={projectId}
                              userId={userId}
                              value={perCabinetDesignItems[i] ?? null}
                              onChange={val =>
                                setPerCabinetDesignItems(prev => ({ ...prev, [i]: val }))
                              }
                              defaultCategory="casework"
                            />
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ))}

              {result?.unassigned && result.unassigned.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <p className="text-[10px] font-semibold text-amber-700 uppercase mb-1">
                    {result.unassigned.length} unassigned mesh{result.unassigned.length !== 1 ? 'es' : ''}
                  </p>
                  <ul className="space-y-0.5">
                    {result.unassigned.slice(0, 5).map((u, i) => (
                      <li key={i} className="text-[10px] text-amber-700">
                        · {u.meshName}: {u.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {unassignedCoverMeshes.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                  <p className="text-[10px] font-semibold text-red-700 uppercase mb-1">
                    Cover panels must be assigned before import
                  </p>
                  <p className="text-[10px] text-red-700">
                    {unassignedCoverMeshes.length} cover-like mesh
                    {unassignedCoverMeshes.length !== 1 ? 'es are' : ' is'} still unassigned.
                    Re-run detection or adjust cabinet grouping before creating cabinets.
                  </p>
                </div>
              )}

              {/* Auto-process toggle */}
              <label className="flex items-start gap-2 rounded-lg border border-purple-200 bg-purple-50/50 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoProcess}
                  onChange={e => setAutoProcess(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-xs font-medium text-purple-900">Auto-process each cabinet with AI</span>
                  </div>
                  <p className="text-[10px] text-purple-700 mt-0.5">
                    Run AI assembly grouping immediately for each cabinet using the uploaded model.
                    Without this, you'll need to process each cabinet individually later.
                  </p>
                </div>
              </label>

              {/* P2 Slice 3 — DesignItem binding for the imported batch. */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-900">Design Item binding</p>
                <p className="text-[10px] text-blue-700">
                  Every cabinet must belong to a DesignItem (the customer-facing grouping used for
                  pricing and production handoff).
                </p>
                <div className="flex flex-col gap-1.5 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="binding-mode"
                      checked={bindingMode === 'shared'}
                      onChange={() => setBindingMode('shared')}
                      disabled={isStandaloneScene}
                    />
                    <span>All cabinets → one DesignItem</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="binding-mode"
                      checked={bindingMode === 'per-cabinet-manual'}
                      onChange={() => setBindingMode('per-cabinet-manual')}
                      disabled={isStandaloneScene}
                    />
                    <span>Choose a DesignItem per cabinet</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="binding-mode"
                      checked={bindingMode === 'per-cabinet-auto'}
                      onChange={() => setBindingMode('per-cabinet-auto')}
                      disabled={isStandaloneScene}
                    />
                    <span>One DesignItem per cabinet (auto-create)</span>
                  </label>
                </div>

                {bindingMode === 'shared' && (
                  <DesignItemPicker
                    projectId={projectId}
                    userId={userId}
                    value={sharedDesignItem}
                    onChange={setSharedDesignItem}
                  />
                )}
                {bindingMode === 'per-cabinet-manual' && !isStandaloneScene && (
                  <p className="text-[10px] text-blue-700 italic">
                    A picker will appear on each selected cabinet above. Choose an existing
                    DesignItem or create a new one inline — each cabinet can land on a different
                    item.
                  </p>
                )}
                {bindingMode === 'per-cabinet-auto' && !isStandaloneScene && (
                  <p className="text-[10px] text-blue-700 italic">
                    A new DesignItem will be created for each selected cabinet, named after the
                    detection's suggested name. You can merge or rename them later from the Design
                    Manager.
                  </p>
                )}
              </div>

              {createError && (
                <p className="text-xs text-red-600">{createError}</p>
              )}
            </div>
          )}

          {/* Step 4: Creating */}
          {step === 'creating' && (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-3 animate-spin" />
              <p className="text-sm font-medium">
                {autoProcess ? 'Creating & processing cabinets...' : 'Creating cabinets...'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {creatingProgress.done} of {creatingProgress.total}
              </p>
              {creatingProgress.currentName && (
                <p className="text-[10px] text-gray-400 mt-1 italic">{creatingProgress.currentName}</p>
              )}
              <div className="max-w-xs mx-auto h-1 bg-gray-200 rounded mt-3 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${creatingProgress.total > 0 ? (creatingProgress.done / creatingProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 5: Done */}
          {step === 'done' && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium">{creatingProgress.done} cabinets created</p>
              <p className="text-xs text-gray-400 mt-1">Process each one to run AI grouping</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-3 border-t bg-gray-50">
          <div>
            {(step === 'review' || step === 'done') && (
              <button
                type="button"
                onClick={handleStartOver}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Start over
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              {step === 'done' ? 'Close' : 'Cancel'}
            </button>
            {step === 'upload' && model && (
              <button
                type="button"
                onClick={handleDetect}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 flex items-center gap-1.5"
              >
                <Box className="w-3.5 h-3.5" />
                Detect Cabinets
              </button>
            )}
            {step === 'review' && detectedCabinets.some(c => c.selected) && (
              <button
                type="button"
                onClick={handleCreate}
                disabled={
                  detectStatus === 'detecting' ||
                  // P2 Slice 3 — require a shared DesignItem when in 'shared' mode
                  // on project-backed scenes. Standalone scenes skip the check.
                  (!isStandaloneScene && bindingMode === 'shared' && !sharedDesignItem) ||
                  // P21.10 — require every selected cabinet to have a picked item
                  // when in per-cabinet-manual mode.
                  (!isStandaloneScene &&
                    bindingMode === 'per-cabinet-manual' &&
                    detectedCabinets.some(
                      (c, i) => c.selected && !perCabinetDesignItems[i],
                    )) ||
                  unassignedCoverMeshes.length > 0
                }
                className="px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Create {detectedCabinets.filter(c => c.selected).length} Cabinet{detectedCabinets.filter(c => c.selected).length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
