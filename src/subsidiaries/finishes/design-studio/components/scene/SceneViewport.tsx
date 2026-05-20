/**
 * SceneViewport — Multi-cabinet Three.js viewport
 *
 * Renders composed scene with ground plane, walls, and cabinet GLBs.
 * Click handler routes to cabinet selection based on selection mode.
 * Supports highlighting and isolation.
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { useSceneViewport } from '../../hooks/useSceneViewport';
import type { MeshClickPayload } from '../../hooks/useSceneViewport';

/**
 * Refs exposed to callers that need to reach into the Three.js context
 * (capture flows, custom gizmos, external framing drivers). Populated
 * once the viewport finishes init.
 */
export interface SceneViewportRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  renderer: THREE.WebGLRenderer;
}
import { useCabinetGizmo } from '../../hooks/useCabinetGizmo';
import type { GizmoMode, SnapPreview } from '../../hooks/useCabinetGizmo';
import { SnapIndicator } from './SnapIndicator';
import type { SceneCabinet, CabinetPosition } from '../../types/scene.types';
import type { SelectionMode } from '../../constants/scene.constants';
import type { ViewPresetKey } from '../../constants/framing.constants';

interface SceneViewportProps {
  cabinets: SceneCabinet[];
  selectionMode: SelectionMode;
  selectedCabinetId?: string;
  selectedPartMeshNeedles?: string[];
  isolatedCabinetId?: string;
  onCabinetClick?: (cabinetId: string) => void;
  onMeshClick?: (payload: MeshClickPayload) => void;
  /** Optional — when provided, renders a translate/rotate gizmo on the
   *  selected cabinet and commits drag-ended positions via this callback. */
  onCabinetMove?: (cabinetId: string, position: CabinetPosition, rotationDeg?: number) => Promise<void>;
  gizmoMode?: GizmoMode;
  /** Current view preset — drives camera framing. */
  currentPreset?: ViewPresetKey;
  /** Cabinet to frame (defaults to all cabinets when null). */
  subjectCabinetId?: string | null;
  /** Bump to re-trigger framing without preset/subject changing. */
  recenterNonce?: number;
  showGroundPlane?: boolean;
  showGrid?: boolean;
  /** Called once the Three.js renderer + camera + scene are mounted.
   *  Callers with capture / export flows (e.g. the Render drawer panel)
   *  stash these refs and call `captureViewport(renderer, camera)` on
   *  demand. Fires again whenever any of the refs changes (camera
   *  projection swap). */
  onViewportReady?: (refs: SceneViewportRefs | null) => void;
  className?: string;
}

export function SceneViewport({
  cabinets,
  selectionMode,
  selectedCabinetId,
  selectedPartMeshNeedles = [],
  isolatedCabinetId,
  onCabinetClick,
  onMeshClick,
  onCabinetMove,
  gizmoMode = 'translate',
  currentPreset,
  subjectCabinetId,
  recenterNonce,
  showGroundPlane = true,
  showGrid = true,
  onViewportReady,
  className,
}: SceneViewportProps) {
  const {
    containerRef,
    isLoading,
    loadedCount,
    totalCount,
    highlightCabinet,
    isolateCabinet,
    resetCamera,
    threeScene,
    camera,
    renderer,
    rendererDomElement,
    getCabinetGroup,
    setControlsEnabled,
    suppressClicksRef,
    highlightMeshes,
  } = useSceneViewport({
    cabinets,
    selectionMode,
    onCabinetClick,
    onMeshClick,
    showGroundPlane,
    showGrid,
    currentPreset,
    subjectCabinetId,
    recenterNonce,
    highlightedMeshNeedles: selectedPartMeshNeedles,
  });

  // Snap indicator — live preview of the matched-face line while the
  // gizmo is dragging a cabinet close to a neighbour.
  const [snapPreview, setSnapPreview] = useState<SnapPreview | null>(null);

  // Translate/rotate gizmo — only active when the page provides a commit
  // handler AND the user is in cabinet-selection mode (moving parts/assemblies
  // individually doesn't make sense yet).
  useCabinetGizmo({
    scene: threeScene,
    camera,
    rendererDomElement,
    cabinets,
    selectedCabinetId: selectedCabinetId ?? null,
    mode: gizmoMode,
    getCabinetGroup,
    setControlsEnabled,
    suppressClicksRef,
    onCommit: onCabinetMove ?? (async () => { /* no-op */ }),
    onSnapPreview: setSnapPreview,
    enabled: !!onCabinetMove && selectionMode === 'cabinet',
  });

  // Apply highlight / isolation as side effects — calling these during render
  // mutates Three.js materials mid-commit which, while not a hook-rules
  // violation per se, is exactly the kind of render-time mutation that has
  // caused React error #310 in this tree before (see AutoFramingViewport
  // history). Running them in useEffect keeps the render pure.
  useEffect(() => {
    if (selectedCabinetId !== undefined) highlightCabinet(selectedCabinetId ?? null);
  }, [selectedCabinetId, highlightCabinet]);

  useEffect(() => {
    const useXray = selectionMode === 'part' || selectedPartMeshNeedles.length > 0;
    highlightMeshes(selectedPartMeshNeedles, useXray);
  }, [selectedPartMeshNeedles, selectionMode, highlightMeshes]);

  // Isolation: always reconcile viewport visibility with the prop.
  // The previous `!== undefined` guard skipped the un-isolate path —
  // when a user un-isolated, `isolatedCabinetId` became `undefined`
  // and the effect was a no-op, so the three.js groups stayed hidden.
  // `isolateCabinet(null)` is the correct "show all" call; the helper
  // treats `null` as "every cabinet visible" so re-applying on mount
  // (initial render with `undefined` prop) is a safe noop.
  useEffect(() => {
    isolateCabinet(isolatedCabinetId ?? null);
  }, [isolatedCabinetId, isolateCabinet]);

  // Hand out Three.js refs to callers (RenderPanel's capture flow, etc.)
  // once everything is populated. Null out on unmount so stale callbacks
  // don't hold references to a torn-down scene.
  useEffect(() => {
    if (!onViewportReady) return;
    if (threeScene && camera && renderer) {
      onViewportReady({ scene: threeScene, camera, renderer });
    } else {
      onViewportReady(null);
    }
    return () => { onViewportReady(null); };
  }, [onViewportReady, threeScene, camera, renderer]);

  return (
    <div className={`relative ${className ?? ''}`}>
      <div ref={containerRef} className="w-full h-full min-h-[400px] rounded-lg overflow-hidden" />

      {/* Snap indicator — lives inside the Three.js scene, not the DOM,
          but mounting it here keeps its lifecycle bound to the viewport. */}
      <SnapIndicator scene={threeScene ?? null} preview={snapPreview} />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Loading cabinets ({loadedCount}/{totalCount})
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && cabinets.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-gray-400">Add cabinets to see the scene</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute top-3 right-3 flex gap-1">
        <button
          type="button"
          onClick={resetCamera}
          className="p-1.5 bg-white/90 rounded shadow-sm hover:bg-white text-gray-500 hover:text-gray-700"
          title="Reset camera"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
