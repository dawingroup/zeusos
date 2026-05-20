/**
 * AutoFramingViewport — SceneViewport wrapped with framing toolbar
 *
 * Renders ViewportToolbar (preset selector, projection toggle, recenter
 * button, subject indicator) above the existing SceneViewport. Framing
 * state is maintained via useFramingState + useViewPreset; the selected
 * preset drives camera positioning on the viewport via an onPresetApply
 * callback.
 *
 * Deep camera animation integration (useAutoFraming with tweened poses)
 * is available as a composable hook — callers that need it can pass
 * their own camera/controls refs and use it directly.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil } from 'lucide-react';
import { SceneViewport } from './SceneViewport';
import { ViewportToolbar } from './ViewportToolbar';
import { GizmoModeToggle } from './GizmoModeToggle';
import type { GizmoMode } from '../../hooks/useCabinetGizmo';
import type { SceneViewportRefs } from './SceneViewport';
import { useFramingState } from '../../hooks/useFramingState';
import { useViewPreset } from '../../hooks/useViewPreset';
import type { SceneCabinet, CabinetPosition } from '../../types/scene.types';
import type { SelectionMode } from '../../constants/scene.constants';
import type { CameraSubject } from '../../types/framing.types';
import type { ViewPresetKey } from '../../constants/framing.constants';
import { VIEW_PRESETS } from '../../constants/framing.constants';
import type { MeshClickPayload } from '../../hooks/useSceneViewport';

interface AutoFramingViewportProps {
  sceneId: string;
  cabinets: SceneCabinet[];
  selectionMode: SelectionMode;
  selectedCabinetId?: string;
  selectedPartMeshNeedles?: string[];
  isolatedCabinetId?: string;
  onCabinetClick?: (cabinetId: string) => void;
  onMeshClick?: (payload: MeshClickPayload) => void;
  /** Drag-release handler for the 3D translate gizmo. When omitted, no gizmo
   *  is mounted. */
  onCabinetMove?: (cabinetId: string, position: CabinetPosition, rotationDeg?: number) => Promise<void>;
  /** Called when user picks a new preset — viewport can snap camera accordingly */
  onPresetChange?: (preset: ViewPresetKey) => void;
  /** External gizmo mode — when provided, overrides the viewport's own
   *  state. Keyboard shortcuts (`G` / `R`) from `useKeyboardShortcuts`
   *  drive this through the parent. */
  gizmoMode?: GizmoMode;
  /** Called when the GizmoModeToggle pill changes mode. */
  onGizmoModeChange?: (mode: GizmoMode) => void;
  /** Forwarded from SceneViewport — callers that need the Three.js
   *  renderer / camera / scene (Render drawer capture, export flows)
   *  pass a handler here. */
  onViewportReady?: (refs: SceneViewportRefs | null) => void;
  className?: string;
}

export function AutoFramingViewport({
  sceneId,
  cabinets,
  selectionMode,
  selectedCabinetId,
  selectedPartMeshNeedles,
  isolatedCabinetId,
  onCabinetClick,
  onMeshClick,
  onCabinetMove,
  onPresetChange,
  gizmoMode: externalGizmoMode,
  onGizmoModeChange,
  onViewportReady,
  className,
}: AutoFramingViewportProps) {
  // Local gizmo-mode state — controlled if parent passes both `gizmoMode`
  // and `onGizmoModeChange`, otherwise self-managed. Lets simple callers
  // get the pill + translate default without wiring anything.
  const [internalGizmoMode, setInternalGizmoMode] = useState<GizmoMode>('translate');
  const gizmoMode = externalGizmoMode ?? internalGizmoMode;
  const handleGizmoModeChange = useCallback((m: GizmoMode) => {
    if (onGizmoModeChange) onGizmoModeChange(m);
    else setInternalGizmoMode(m);
  }, [onGizmoModeChange]);

  // Edit mode — default OFF so the translate/rotate gizmo doesn't
  // permanently hover on every selected cabinet and block mesh clicks
  // / camera orbit. User opts in via the "Edit" pill (or `E` hotkey)
  // when they actually want to move things. Matches the pattern most
  // CAD tools use: inspect first, edit on demand.
  const [editEnabled, setEditEnabled] = useState(false);
  const toggleEdit = useCallback(() => setEditEnabled(v => !v), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'e' && e.key !== 'E') return;
      // Don't hijack when the user is typing in an input.
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      toggleEdit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleEdit]);
  const { preset, setPreset: setPersistedPreset } = useViewPreset(sceneId);
  const { state, setSubject, setPreset, setProjection, recenter, startInteraction } = useFramingState({ preset });
  // Monotonic counter that the Recenter button / F-hotkey bumps to re-trigger
  // framing even when the preset/subject haven't changed. Kept in AutoFraming
  // so a single click on Recenter translates to a single effect in the
  // viewport — simpler than wiring a command channel.
  const [recenterNonce, setRecenterNonce] = useState(0);

  // Derive the current subject from selection
  const subject: CameraSubject = useMemo(() => {
    const effectiveId = isolatedCabinetId ?? selectedCabinetId;
    if (effectiveId) {
      return {
        type: 'cabinet',
        id: effectiveId,
        bounds: { center: { x: 0, y: 0, z: 0 }, radius: 0 },
      };
    }
    return {
      type: 'scene',
      id: 'root',
      bounds: { center: { x: 0, y: 0, z: 0 }, radius: 0 },
    };
  }, [selectedCabinetId, isolatedCabinetId]);

  // Keep framing state subject in sync with selection.
  // Must be useEffect — setSubject triggers a state update and must not run
  // during render (previously useMemo, which caused React error #310 by
  // dispatching a setState mid-render and corrupting hook counts in sibling
  // components rendered later in the same tree).
  useEffect(() => {
    if (state.subject.id !== subject.id || state.subject.type !== subject.type) {
      setSubject(subject);
    }
  }, [subject, state.subject.id, state.subject.type, setSubject]);

  const subjectLabel = useMemo(() => {
    if (subject.type !== 'cabinet') return undefined;
    const cab = cabinets.find(c => c.id === subject.id);
    return cab ? `${cab.cabinetCode} — ${cab.displayName}` : undefined;
  }, [subject, cabinets]);

  const handlePresetChange = useCallback((p: ViewPresetKey) => {
    setPreset(p);
    setPersistedPreset(p);
    onPresetChange?.(p);
  }, [setPreset, setPersistedPreset, onPresetChange]);

  const handleProjectionChange = useCallback((p: 'perspective' | 'orthographic') => {
    setProjection(p);
    // When the user toggles projection, pick a preset of the matching kind —
    // we persist it so the viewport's preset-driven framing effect fires.
    const currentProj = VIEW_PRESETS[preset].projection;
    if (currentProj !== p) {
      const fallback: ViewPresetKey = p === 'perspective' ? 'iso_ne' : 'front';
      setPersistedPreset(fallback);
      onPresetChange?.(fallback);
    }
  }, [setProjection, preset, setPersistedPreset, onPresetChange]);

  const handleRecenter = useCallback(() => {
    recenter();
    setRecenterNonce(n => n + 1);
  }, [recenter]);

  return (
    <div className={`flex flex-col h-full ${className ?? ''}`}>
      {/* Top toolbar */}
      <div className="px-3 py-2 bg-white border-b">
        <ViewportToolbar
          currentPreset={preset}
          onPresetChange={handlePresetChange}
          onProjectionChange={handleProjectionChange}
          onRecenter={handleRecenter}
          isUserControlled={state.isUserControlled}
          subject={subject}
          subjectLabel={subjectLabel}
        />
      </div>

      {/* 3D scene */}
      <div
        className="flex-1 min-h-0 relative"
        onMouseDown={startInteraction}
      >
        <SceneViewport
          cabinets={cabinets}
          selectionMode={selectionMode}
          selectedCabinetId={selectedCabinetId}
          selectedPartMeshNeedles={selectedPartMeshNeedles}
          isolatedCabinetId={isolatedCabinetId}
          onCabinetClick={onCabinetClick}
          onMeshClick={onMeshClick}
          // Gizmo-bearing move handler is only passed down when the user
          // explicitly flips on edit mode; otherwise useCabinetGizmo sees
          // `onCabinetMove === undefined`, gates `enabled` to false, and
          // the TransformControls never attach.
          onCabinetMove={editEnabled ? onCabinetMove : undefined}
          gizmoMode={gizmoMode}
          currentPreset={preset}
          subjectCabinetId={subject.type === 'cabinet' ? subject.id : null}
          recenterNonce={recenterNonce}
          onViewportReady={onViewportReady}
          className="h-full"
        />
        {/* Edit-mode toggle — always visible so the user can opt into
            dragging even from an unselected state. When active, the
            translate/rotate pill appears alongside. */}
        {onCabinetMove && (
          <div
            className="absolute z-40 flex items-center gap-2"
            style={{ left: 'max(0.75rem, env(safe-area-inset-left))', bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            <button
              type="button"
              onClick={toggleEdit}
              title={editEnabled ? 'Exit edit mode (E)' : 'Enter edit mode (E)'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border transition-colors ${
                editEnabled
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card/95 backdrop-blur text-muted-foreground hover:text-foreground border-border'
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>{editEnabled ? 'Editing' : 'Edit'}</span>
              <kbd className={`ml-1 px-1 text-[9px] font-mono rounded ${
                editEnabled ? 'bg-primary-foreground/20' : 'bg-accent'
              }`}>E</kbd>
            </button>
            <GizmoModeToggle
              visible={editEnabled && !!selectedCabinetId && selectionMode === 'cabinet'}
              mode={gizmoMode}
              onChange={handleGizmoModeChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
