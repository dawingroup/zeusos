/**
 * useCabinetGizmo — 3D translate/rotate gizmo for a selected scene cabinet.
 *
 * Mounts a Three.js `TransformControls` onto the viewport's scene. When a
 * cabinet is selected, the gizmo attaches to that cabinet's Group; when
 * nothing is selected, it detaches. On drag-release we run the snap service
 * against all other cabinets and persist the (possibly snapped) position
 * via the `onCommit` callback.
 *
 * Y is pinned — cabinets stay on the floor. Vertical movement is handled
 * by a separate wall-anchor mode later.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
// Three's TransformControls lives in the examples dir — same pattern as
// GLTFLoader elsewhere in this codebase.
// eslint-disable-next-line import/no-unresolved
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import type { SceneCabinet, CabinetPosition } from '../types/scene.types';
import { computeFaceSnap, resolveCollisions, cabinetFootprint } from '../services/snap.service';
import type { CabinetBox } from '../services/snap.service';
import { POSITION_GRID_MM, GIZMO_SIZE, GIZMO_RENDER_ORDER } from '../constants/scene.constants';

/** Round to the position grid (1mm) — app's minimum measurable unit. */
const quantise = (v: number): number => Math.round(v / POSITION_GRID_MM) * POSITION_GRID_MM;

export type GizmoMode = 'translate' | 'rotate';

/** Snap-indicator payload emitted by the gizmo as the user drags. Null
 *  when nothing is snapped — the indicator component should hide. */
export interface SnapPreview {
  /** Cabinet id we snapped to. */
  snappedToId: string;
  /** World-space centre of the dragged cabinet (post-snap). */
  draggedCentre: { x: number; y: number; z: number };
  /** World-space centre of the neighbour we're aligned with. */
  neighbourCentre: { x: number; y: number; z: number };
}

interface UseCabinetGizmoOptions {
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera | null;
  rendererDomElement: HTMLCanvasElement | null;
  cabinets: SceneCabinet[];
  selectedCabinetId: string | null | undefined;
  mode: GizmoMode;
  /** Look up the Three.js Group for a cabinet — exposed by useSceneViewport. */
  getCabinetGroup: (cabinetId: string) => THREE.Group | null;
  /** Toggle the orbit/pan controls while the gizmo is being dragged. */
  setControlsEnabled: (enabled: boolean) => void;
  /** Ref that the viewport reads to short-circuit click-raycast during drag. */
  suppressClicksRef: React.MutableRefObject<boolean>;
  /** Persist the new position / rotation. Called once per drag release. */
  onCommit: (cabinetId: string, position: CabinetPosition, rotationDeg?: number) => Promise<void>;
  /** Optional snap-indicator hook. Invoked on every drag tick with the
   *  current snap state (or `null` when not snapped). Viewport mounts
   *  a `<SnapIndicator>` and consumes this. */
  onSnapPreview?: (preview: SnapPreview | null) => void;
  /** When false the gizmo never mounts (used to disable feature per-viewport). */
  enabled?: boolean;
}

export function useCabinetGizmo(opts: UseCabinetGizmoOptions): void {
  const {
    scene, camera, rendererDomElement, cabinets,
    selectedCabinetId, mode, getCabinetGroup,
    setControlsEnabled, suppressClicksRef, onCommit, onSnapPreview,
    enabled = true,
  } = opts;
  const onSnapPreviewRef = useRef(onSnapPreview);
  onSnapPreviewRef.current = onSnapPreview;

  // Keep the transform-controls instance across re-renders (but not across
  // scene/camera swaps — those get their own dispose + recreate).
  const gizmoRef = useRef<TransformControls | null>(null);
  // Keep latest `cabinets` reachable from listener closures without retriggering
  // the main setup effect every render.
  const cabinetsRef = useRef(cabinets);
  cabinetsRef.current = cabinets;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  // Setup: create TransformControls once per scene/camera/canvas triple.
  useEffect(() => {
    if (!enabled || !scene || !camera || !rendererDomElement) {
      console.info('[useCabinetGizmo] setup skipped', {
        enabled, hasScene: !!scene, hasCamera: !!camera, hasCanvas: !!rendererDomElement,
      });
      return;
    }
    console.info('[useCabinetGizmo] mounting TransformControls');

    const gizmo = new TransformControls(camera, rendererDomElement);
    gizmo.setSize(GIZMO_SIZE);                       // bigger handles — easier to grab on trackpad + touch
    gizmo.setTranslationSnap(null);                  // snap handled by our own service
    gizmo.setRotationSnap(THREE.MathUtils.degToRad(15));
    // All three axes enabled — users need Y too (wall cabinets, stacked units,
    // plinths). Floor-clamp only fires for legacy-broken positions far below
    // the ground plane, so intentional vertical placement is preserved.
    // NOTE on the Three.js API: as of r164 (~2024) `TransformControls`
    // extends `Controls` (the new controller base class), NOT `Object3D`.
    // The visible part lives on a separate helper returned by `.getHelper()`.
    // Calling `scene.add(gizmo)` directly throws
    // "THREE.Object3D.add: object not an instance of THREE.Object3D" at
    // runtime. Always add the helper instead.
    const helper = gizmo.getHelper();
    // Render on top of every cabinet wall — by default the helper respects
    // depth, which hides the arrows *inside* the cabinet body (pivot is the
    // cabinet's base-centre after subset-centering). Force handles through
    // geometry.
    helper.renderOrder = GIZMO_RENDER_ORDER;
    helper.traverse((obj) => {
      const mat = (obj as { material?: THREE.Material | THREE.Material[] }).material;
      if (!mat) return;
      const mats = Array.isArray(mat) ? mat : [mat];
      for (const m of mats) {
        m.depthTest = false;
        m.depthWrite = false;
        m.transparent = true;
      }
      (obj as THREE.Object3D).renderOrder = GIZMO_RENDER_ORDER;
    });
    scene.add(helper);
    gizmoRef.current = gizmo;

    // Track dragging state so we can gate the per-tick snap / collision.
    let isDragging = false;
    // Alt held (desktop) OR two-finger touch (iPad) → bypass snap and
    // collision. `altBypass` is the unified flag; keyboard listener
    // writes it, and the per-tick handler also reads the module-global
    // `__sceneMultiTouch` set by `useInputAdapter` so touch bypass is
    // truly live (no React round-trip per drag frame).
    let altBypass = false;
    // Remember the position at drag-start so we can enforce per-axis
    // locks (a "pinned" axis reverts to its pre-drag value every tick).
    let dragStartPos: { x: number; y: number; z: number } | null = null;
    const onKeyDown = (e: KeyboardEvent) => { if (e.altKey) altBypass = true; };
    const onKeyUp = (e: KeyboardEvent) => { if (!e.altKey) altBypass = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    /** True when snap should be suppressed — Alt (desktop) OR two-finger (touch). */
    const snapBypass = () =>
      altBypass ||
      !!(window as unknown as { __sceneMultiTouch?: boolean }).__sceneMultiTouch;
    // Cabinet heights are derived from their Three.js group bboxes. Cached
    // per-id for the lifetime of this effect — heights don't change during
    // drag (we only rotate around Y, which doesn't alter height).
    const heightCache = new Map<string, number>();
    const getHeight = (cabId: string): number => {
      const hit = heightCache.get(cabId);
      if (hit !== undefined) return hit;
      const grp = getCabinetGroup(cabId);
      if (!grp) return 720; // sensible base-cabinet fallback (720mm)
      const bbox = new THREE.Box3().setFromObject(grp);
      const h = bbox.isEmpty() ? 720 : Math.max(1, bbox.max.y - bbox.min.y);
      heightCache.set(cabId, h);
      return h;
    };
    const buildBox = (cab: SceneCabinet, x: number, y: number, z: number): CabinetBox => {
      const { width, depth } = cabinetFootprint(cab);
      return { id: cab.id, position: { x, y, z }, width, depth, height: getHeight(cab.id) };
    };

    // Live physics + snap tick. On every gizmo update while dragging:
    //   1. Resolve 3D AABB collisions against every other cabinet (cabinets
    //      are solid bodies — they can't interpenetrate; a wall cabinet
    //      lifted above a base cabinet's top *is* allowed because the Y
    //      dimension has no overlap).
    //   2. Clamp Y ≥ 0 (never below the floor, handled inside resolveCollisions).
    //   3. Apply magnetic face / corner snap over the resolved position so
    //      the cabinet "sticks" to nearby alignments as the user approaches.
    //   4. Write back to the gizmo's target. TransformControls recomputes
    //      from dragStart + cursorDelta each tick, so this post-processing
    //      wins per-frame without fighting the gizmo.
    const handleObjectChange = () => {
      if (!isDragging) return;
      const attached = (gizmo as unknown as { object?: THREE.Object3D }).object;
      if (!attached) return;
      const cabinetId = (attached.userData?.cabinetId as string) || '';
      if (!cabinetId) return;
      const dragged = cabinetsRef.current.find(c => c.id === cabinetId);
      if (!dragged) return;

      // ── Per-axis lock enforcement ──────────────────────────────────
      // If the user pinned an axis via the Positioning panel, the gizmo
      // is still free-moving in Three.js space, so we clamp the
      // position back to the drag-start value on each locked axis
      // every tick. This keeps the gizmo visually stuck on that axis
      // without disabling the whole translate handle.
      const locks = dragged.position?.axisLocks;
      if (dragStartPos && locks) {
        if (locks.x) attached.position.x = dragStartPos.x;
        if (locks.y) attached.position.y = dragStartPos.y;
        if (locks.z) attached.position.z = dragStartPos.z;
      }

      // ── Snap bypass: no snap, no collision (Alt or two-finger) ─────
      if (snapBypass()) {
        attached.position.set(
          quantise(attached.position.x),
          quantise(attached.position.y),
          quantise(attached.position.z),
        );
        return;
      }

      const draggedBox = buildBox(dragged, attached.position.x, attached.position.y, attached.position.z);
      const neighbourBoxes: CabinetBox[] = [];
      for (const c of cabinetsRef.current) {
        if (c.id === cabinetId) continue;
        const grp = getCabinetGroup(c.id);
        if (!grp) continue;
        neighbourBoxes.push(buildBox(c, grp.position.x, grp.position.y, grp.position.z));
      }

      const resolved = resolveCollisions(draggedBox, neighbourBoxes);
      const snapped = computeFaceSnap(
        dragged,
        cabinetsRef.current,
        { x: resolved.x, z: resolved.z },
      );
      // Round to the 1mm position grid — app's minimum measurable distance.
      // Eliminates sub-mm float noise that made drag motion feel jittery
      // and ensures stored coordinates are deterministic.
      attached.position.set(
        locks?.x && dragStartPos ? dragStartPos.x : quantise(snapped.position.x),
        locks?.y && dragStartPos ? dragStartPos.y : quantise(resolved.y),
        locks?.z && dragStartPos ? dragStartPos.z : quantise(snapped.position.z),
      );

      // Emit snap preview (or clear it) so the viewport's SnapIndicator
      // component can render the green matched-face line. Ref'd so the
      // caller's callback identity doesn't reset the main effect.
      const emit = onSnapPreviewRef.current;
      if (emit) {
        if (snapped.snappedToId) {
          const nbGroup = getCabinetGroup(snapped.snappedToId);
          if (nbGroup) {
            emit({
              snappedToId: snapped.snappedToId,
              draggedCentre: {
                x: attached.position.x,
                y: attached.position.y,
                z: attached.position.z,
              },
              neighbourCentre: {
                x: nbGroup.position.x,
                y: nbGroup.position.y,
                z: nbGroup.position.z,
              },
            });
          } else {
            emit(null);
          }
        } else {
          emit(null);
        }
      }
    };
    // three.js typed addEventListener wants EventListener<{}, 'objectChange', TransformControls>;
    // our argument-free handler is structurally compatible — coerce via unknown to bypass nominal mismatch.
    gizmo.addEventListener('objectChange', handleObjectChange as unknown as Parameters<typeof gizmo.addEventListener<'objectChange'>>[1]);

    const handleDraggingChanged = (event: { value: boolean }) => {
      isDragging = event.value;
      setControlsEnabled(!event.value);
      suppressClicksRef.current = event.value;
      // Drag boundary → clear any stale snap indicator. On start we
      // haven't computed a snap yet; on end we either committed a final
      // position (indicator irrelevant) or bailed out.
      onSnapPreviewRef.current?.(null);
      if (event.value) {
        // Drag starting — snapshot the start position so per-tick lock
        // enforcement and the final commit can reason about deltas.
        const attached = (gizmo as unknown as { object?: THREE.Object3D }).object;
        if (attached) {
          dragStartPos = {
            x: attached.position.x, y: attached.position.y, z: attached.position.z,
          };
        }
        return;
      }
      // Drag just ended → run the physics pipeline once more so the
      // persisted position is guaranteed valid (the live tick may not
      // have fired at the exact release point).
      {
        const attached = (gizmo as unknown as { object?: THREE.Object3D }).object;
        if (!attached) return;
        const cabinetId = (attached.userData?.cabinetId as string) || '';
        if (!cabinetId) return;
        const dragged = cabinetsRef.current.find(c => c.id === cabinetId);
        if (!dragged) return;

        const locks = dragged.position?.axisLocks;

        // Alt / two-finger / per-axis locks bypass the snap pipeline;
        // keep the raw drag output (clamping to locked-axis start
        // values).
        let finalX: number, finalY: number, finalZ: number;
        if (snapBypass()) {
          finalX = quantise(locks?.x && dragStartPos ? dragStartPos.x : attached.position.x);
          finalY = quantise(locks?.y && dragStartPos ? dragStartPos.y : attached.position.y);
          finalZ = quantise(locks?.z && dragStartPos ? dragStartPos.z : attached.position.z);
          attached.position.set(finalX, finalY, finalZ);
          dragStartPos = null;
          const newPosition: CabinetPosition = {
            x: finalX, y: finalY, z: finalZ,
            anchoredTo: dragged.position?.anchoredTo ?? 'floor',
            ...(locks ? { axisLocks: locks } : {}),
          };
          const rotationDeg = mode === 'rotate'
            ? THREE.MathUtils.radToDeg(attached.rotation.y)
            : undefined;
          onCommitRef.current(cabinetId, newPosition, rotationDeg)
            .catch(err => console.warn('[useCabinetGizmo] commit failed:', err));
          return;
        }

        const draggedBox = buildBox(dragged, attached.position.x, attached.position.y, attached.position.z);
        const neighbourBoxes: CabinetBox[] = [];
        for (const c of cabinetsRef.current) {
          if (c.id === cabinetId) continue;
          const grp = getCabinetGroup(c.id);
          if (!grp) continue;
          neighbourBoxes.push(buildBox(c, grp.position.x, grp.position.y, grp.position.z));
        }
        const resolved = resolveCollisions(draggedBox, neighbourBoxes);
        const snapped = computeFaceSnap(
          dragged,
          cabinetsRef.current,
          { x: resolved.x, z: resolved.z },
        );
        finalX = quantise(locks?.x && dragStartPos ? dragStartPos.x : snapped.position.x);
        finalY = quantise(locks?.y && dragStartPos ? dragStartPos.y : resolved.y);
        finalZ = quantise(locks?.z && dragStartPos ? dragStartPos.z : snapped.position.z);
        attached.position.set(finalX, finalY, finalZ);

        dragStartPos = null;
        const newPosition: CabinetPosition = {
          x: finalX,
          y: finalY,
          z: finalZ,
          anchoredTo: dragged.position?.anchoredTo ?? 'floor',
          ...(locks ? { axisLocks: locks } : {}),
        };
        if (snapped.snappedToId) {
          newPosition.alignedWithCabinetId = snapped.snappedToId;
          // The position schema accepts 'left' | 'right' | 'front' | 'back'
          // as alignmentEdge values — all four match our snap outputs.
          if (snapped.edge) newPosition.alignmentEdge = snapped.edge;
        }
        const rotationDeg = mode === 'rotate'
          ? THREE.MathUtils.radToDeg(attached.rotation.y)
          : undefined;

        onCommitRef.current(cabinetId, newPosition, rotationDeg)
          .catch(err => console.warn('[useCabinetGizmo] commit failed:', err));
      }
    };

    gizmo.addEventListener('dragging-changed', handleDraggingChanged as unknown as Parameters<typeof gizmo.addEventListener<'dragging-changed'>>[1]);

    return () => {
      gizmo.removeEventListener('dragging-changed', handleDraggingChanged as unknown as Parameters<typeof gizmo.removeEventListener<'dragging-changed'>>[1]);
      gizmo.removeEventListener('objectChange', handleObjectChange as unknown as Parameters<typeof gizmo.removeEventListener<'objectChange'>>[1]);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      gizmo.detach();
      scene.remove(helper);
      gizmo.dispose();
      gizmoRef.current = null;
      // Always restore interactions if the hook unmounts mid-drag.
      setControlsEnabled(true);
      suppressClicksRef.current = false;
    };
  }, [enabled, scene, camera, rendererDomElement, setControlsEnabled, suppressClicksRef, mode]);

  // Attach / detach based on the current selection.
  useEffect(() => {
    const gizmo = gizmoRef.current;
    if (!gizmo) {
      console.info('[useCabinetGizmo] attach skipped — gizmo not mounted yet', { selectedCabinetId });
      return;
    }
    if (!selectedCabinetId) {
      gizmo.detach();
      console.info('[useCabinetGizmo] detached (no selection)');
      return;
    }
    // Lock enforcement: cabinets with `isLocked === true` (production-
    // locked after an MO was created) never get the gizmo attached, so
    // drag is impossible. The context menu and Positioning panel also
    // read `isLocked` to grey out their actions — this is the last-line
    // guard for the drag path.
    const selectedCabinet = cabinetsRef.current.find(c => c.id === selectedCabinetId);
    if (selectedCabinet?.isLocked) {
      gizmo.detach();
      console.info('[useCabinetGizmo] selection is locked — gizmo detached', { selectedCabinetId });
      return;
    }
    const grp = getCabinetGroup(selectedCabinetId);
    if (!grp) {
      gizmo.detach();
      console.info('[useCabinetGizmo] cabinet group not loaded yet', { selectedCabinetId });
      return;
    }
    gizmo.attach(grp);
    console.info('[useCabinetGizmo] attached to cabinet', {
      selectedCabinetId, groupPos: grp.position.toArray(),
    });
    // `getCabinetGroup` is a stable useCallback([]) and `cabinets` changing
    // identity doesn't actually affect which group the selected cabinet
    // maps to — gating this effect on selectedCabinetId alone eliminates
    // dozens of redundant re-attaches per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCabinetId]);

  // Mode swap.
  useEffect(() => {
    const gizmo = gizmoRef.current;
    if (!gizmo) return;
    gizmo.setMode(mode);
  }, [mode]);
}
