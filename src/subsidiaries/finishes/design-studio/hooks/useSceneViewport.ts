/**
 * useSceneViewport — Three.js scene management for multi-cabinet view
 *
 * Loads cabinet GLBs, applies position/rotation transforms, manages
 * ground plane, and handles selection-mode raycasting at all four
 * levels (project/cabinet/assembly/part).
 *
 * Exposes refs and a swap function so the framing system can drive
 * the camera (see useAutoFraming).
 */
import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import CameraControls from 'camera-controls';
import type { SceneCabinet } from '../types/scene.types';
import type { SelectionMode } from '../constants/scene.constants';
import {
  GROUND_PLANE_SIZE_MM,
  GROUND_PLANE_GRID_MM,
  GROUND_PLANE_PADDING,
  DEFAULT_CABINET_WIDTH_MM,
  DEFAULT_CABINET_DEPTH_MM,
} from '../constants/scene.constants';
import { updateTweens } from '../services/cameraAnimator.service';
import { computePoseForSubject } from '../services/framing.service';
import type { ViewPresetKey } from '../constants/framing.constants';
import type { BoundingSphere } from '../types/framing.types';

CameraControls.install({ THREE });

interface CabinetMeshGroup {
  cabinetId: string;
  cabinetCode: string;
  group: THREE.Group;
}

/** Payload for a richer click callback — includes the specific hit mesh's
 * identity so the page can resolve assembly/part selection from cabinet
 * metadata. `meshId` is the `userData.dawinMeshId` written at export time
 * (falling back to `mesh.name` if not present). */
export interface MeshClickPayload {
  cabinetId: string;
  meshId: string | null;
  meshName: string;
  /** World-space intersection point — the page uses this to fall back
   *  to a bbox-containment check when the mesh id doesn't map cleanly
   *  onto any stored ScenePart.meshNodeId. */
  worldPoint?: { x: number; y: number; z: number };
  /** Local-space bbox of the hit mesh (world-transformed) — lets the
   *  page compute "which ScenePart bbox is closest / contains the
   *  click?" without re-raycasting. */
  hitBbox?: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
}

interface UseSceneViewportOptions {
  cabinets: SceneCabinet[];
  selectionMode: SelectionMode;
  /** Fires on `cabinet` mode clicks with the cabinetId, OR with an empty
   * string when the user clicks empty space (deselect) or in `project` mode. */
  onCabinetClick?: (cabinetId: string) => void;
  /** Fires on `assembly` / `part` mode clicks with the specific hit mesh.
   * The page is responsible for mapping the meshId to an assembly/part. */
  onMeshClick?: (payload: MeshClickPayload) => void;
  showGroundPlane?: boolean;
  showGrid?: boolean;
  /** Current view preset. When it changes, the camera animates to the pose
   *  framing the current subject from that preset. */
  currentPreset?: ViewPresetKey;
  /** Cabinet whose bbox the preset should frame. When null/undefined we
   *  frame all cabinets together (scene-level). */
  subjectCabinetId?: string | null;
  /** Bumped by the parent to trigger a re-centre without changing preset. */
  recenterNonce?: number;
  /** Mesh identifiers currently selected as part context. */
  highlightedMeshNeedles?: string[];
}

interface ControlsAdapter {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, handler: (event?: unknown) => void) => void;
  removeEventListener: (type: string, handler: (event?: unknown) => void) => void;
  enabled?: boolean;
}

interface UseSceneViewportResult {
  containerRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  loadedCount: number;
  totalCount: number;
  error: Error | null;
  highlightCabinet: (cabinetId: string | null) => void;
  isolateCabinet: (cabinetId: string | null) => void;
  resetCamera: () => void;
  /** Internal refs for framing system */
  threeScene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera | null;
  controls: ControlsAdapter | null;
  swapCamera: (newCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera) => void;
  /** Additional refs + helpers for gizmo / transform-controls integration.
   *  These expose direct Three.js state so the gizmo hook can mount its own
   *  controls onto the same scene graph + canvas without duplicating the
   *  viewport-init effect. */
  rendererDomElement: HTMLCanvasElement | null;
  renderer: THREE.WebGLRenderer | null;
  getCabinetGroup: (cabinetId: string) => THREE.Group | null;
  setControlsEnabled: (enabled: boolean) => void;
  /** When set to true, the viewport's click-raycast handler short-circuits
   *  (used while the gizmo is being dragged, otherwise a click-release would
   *  also fire a selection-change). */
  suppressClicksRef: React.MutableRefObject<boolean>;
  /** Refit the camera to all loaded cabinets. Same as resetCamera but named
   *  for gizmo callers that want to recentre after a move. */
  fitAll: () => void;
  /** Highlight selected part meshes and dim non-selected meshes. */
  highlightMeshes: (meshNeedles: string[], enableXray?: boolean) => void;
}

export function useSceneViewport(options: UseSceneViewportOptions): UseSceneViewportResult {
  const {
    cabinets, selectionMode,
    onCabinetClick, onMeshClick,
    showGroundPlane = true, showGrid = true,
    currentPreset, subjectCabinetId, recenterNonce,
    highlightedMeshNeedles = [],
  } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | THREE.OrthographicCamera | null>(null);
  const controlsRef = useRef<CameraControls | null>(null);
  const clockRef = useRef<THREE.Timer | null>(null);
  const cabinetGroupsRef = useRef<CabinetMeshGroup[]>([]);
  const groundPlaneRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);
  const [, forceRender] = useState({});

  const [isLoading, setIsLoading] = useState(false);
  const [loadedCount, setLoadedCount] = useState(0);
  const [error] = useState<Error | null>(null);
  // Gizmo drag suppresses click-to-select so dragging doesn't also flip the
  // selection on mouseUp. Ref not state — no re-render needed, and the
  // raycast handler reads .current every click.
  const suppressClicksRef = useRef(false);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / container.clientHeight,
      1,
      50000,
    );
    camera.position.set(3000, 2000, 3000);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap was deprecated in newer three.js releases; PCFShadowMap
    // is the currently-supported soft-shadow equivalent.
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // CameraControls (dolly/orbit/pan) bound to the canvas.
    // `dampingFactor` was deprecated in camera-controls — use `smoothTime`
    // (seconds). 0.25s matches the library's new default and gives a similar
    // feel to the previous 0.1 per-frame lerp at 60fps.
    const controls = new CameraControls(camera, renderer.domElement);
    controls.smoothTime = 0.25;
    controls.dollySpeed = 1.0;
    controls.truckSpeed = 2.0;
    controls.minDistance = 200;
    controls.maxDistance = 50_000;
    controlsRef.current = controls;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
    keyLight.position.set(5000, 8000, 5000);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-3000, 4000, -2000);
    scene.add(fillLight);
    scene.add(new THREE.DirectionalLight(0xffffff, 0.2).translateY(2000));

    // Ground plane
    if (showGroundPlane) {
      const groundGroup = new THREE.Group();
      const planeGeom = new THREE.PlaneGeometry(GROUND_PLANE_SIZE_MM, GROUND_PLANE_SIZE_MM);
      const planeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9, metalness: 0 });
      const plane = new THREE.Mesh(planeGeom, planeMat);
      plane.rotation.x = -Math.PI / 2;
      plane.receiveShadow = true;
      groundGroup.add(plane);
      if (showGrid) {
        const gridHelper = new THREE.GridHelper(
          GROUND_PLANE_SIZE_MM,
          GROUND_PLANE_SIZE_MM / GROUND_PLANE_GRID_MM,
          0xcccccc, 0xe0e0e0,
        );
        groundGroup.add(gridHelper);
      }
      scene.add(groundGroup);
      groundPlaneRef.current = groundGroup;
    }

    // Render loop. THREE.Clock is deprecated — THREE.Timer replaces it,
    // with the API split into an explicit `update()` + `getDelta()` pair.
    const clock = new THREE.Timer();
    clockRef.current = clock;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      clock.update();
      const delta = clock.getDelta();
      updateTweens();                // advance camera animations
      if (controlsRef.current) controlsRef.current.update(delta);
      const camRef = cameraRef.current;
      const sceneR = sceneRef.current;
      if (camRef && sceneR) renderer.render(sceneR, camRef);
    };
    animate();

    // Resize
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const cam = cameraRef.current;
      if (cam instanceof THREE.PerspectiveCamera) {
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      } else if (cam instanceof THREE.OrthographicCamera) {
        const half = cam.top;
        cam.left = -half * (w / h);
        cam.right = half * (w / h);
        cam.updateProjectionMatrix();
      }
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      try { container.removeChild(renderer.domElement); } catch { /* already gone */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGroundPlane, showGrid]);

  // Signature of the *structural* scene content — cabinet membership + their
  // asset URLs + mesh filters. Rebuild of GLB groups only happens when this
  // changes, NOT on every cabinet-position change. Without this, every drag
  // release (which updates the cabinets array locally) would dispose every
  // cabinet group and re-parse every GLB, which the user perceives as the
  // viewport "reloading" on every interaction.
  const structuralSignature = useMemo(
    () => cabinets
      .map(c => [
        c.id,
        c.glbUrl ?? '',
        c.sourceModelUrl ?? '',
        (c.sourceMeshNames ?? []).join(','),
      ].join(':'))
      .join('|'),
    [cabinets],
  );

  // Pose-sync: when cabinets change (position / rotation) but the structural
  // signature hasn't, just update the existing group transforms in place.
  // This is the cheap path — no GLB reload, no camera refit, no disposal.
  useEffect(() => {
    for (const cab of cabinets) {
      const cg = cabinetGroupsRef.current.find(g => g.cabinetId === cab.id);
      if (!cg) continue;
      const pos = cab.position ?? { x: 0, y: 0, z: 0 };
      cg.group.position.set(pos.x, pos.y, pos.z);
      cg.group.rotation.y = THREE.MathUtils.degToRad(cab.rotation ?? 0);
      // Turn-round flag: flip the cabinet about its vertical centreline
      // via a -1 X scale. Cheap and keeps the mesh upright; downstream
      // BOM/manufacturing code reads the stored `mirrored` bool directly.
      const mirrored = cab.position?.mirrored === true;
      cg.group.scale.x = mirrored ? -1 : 1;
    }
  }, [cabinets]);

  // Dynamic ground plane: size the floor to cover the scene's current
  // cabinet spread + 50% padding, clamped to `GROUND_PLANE_SIZE_MM`
  // (10 m) as the minimum so empty scenes still feel grounded. Hysteresis
  // at `GROUND_PLANE_GRID_MM` (100 mm) prevents churn during drag — we
  // only swap geometry when the target has moved past one grid cell.
  const lastGroundSizeRef = useRef<number>(GROUND_PLANE_SIZE_MM);
  useEffect(() => {
    const group = groundPlaneRef.current;
    if (!group) return;
    if (cabinets.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const cab of cabinets) {
      const config = (cab.configuration ?? {}) as Record<string, unknown>;
      const width = typeof config.width === 'number' && config.width > 0
        ? config.width : DEFAULT_CABINET_WIDTH_MM;
      const depth = typeof config.depth === 'number' && config.depth > 0
        ? config.depth : DEFAULT_CABINET_DEPTH_MM;
      const x = cab.position?.x ?? 0;
      const z = cab.position?.z ?? 0;
      minX = Math.min(minX, x - width / 2);
      maxX = Math.max(maxX, x + width / 2);
      minZ = Math.min(minZ, z - depth / 2);
      maxZ = Math.max(maxZ, z + depth / 2);
    }
    const extentX = maxX - minX;
    const extentZ = maxZ - minZ;
    const targetSize = Math.max(
      GROUND_PLANE_SIZE_MM,
      Math.max(extentX, extentZ) * GROUND_PLANE_PADDING,
    );

    // Hysteresis gate — only rebuild if the change is at least one
    // grid cell. Keeps drag responsiveness smooth.
    if (Math.abs(targetSize - lastGroundSizeRef.current) < GROUND_PLANE_GRID_MM) return;
    lastGroundSizeRef.current = targetSize;

    // Centre the ground plane under the current scene centroid so the
    // grid lines up with the cabinets rather than with world-origin.
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    group.position.set(cx, 0, cz);

    // Rebuild both children (plane + grid) with the new size.
    const toDispose: THREE.Object3D[] = [];
    for (const child of group.children) toDispose.push(child);
    for (const child of toDispose) {
      group.remove(child);
      // Dispose geometry + material to free GPU memory — these meshes
      // change size only on cabinet add/remove/drag-end, which is rare.
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = (mesh as unknown as { material?: THREE.Material | THREE.Material[] }).material;
      if (mat) {
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) m.dispose?.();
      }
    }
    const planeGeom = new THREE.PlaneGeometry(targetSize, targetSize);
    const planeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.9, metalness: 0 });
    const plane = new THREE.Mesh(planeGeom, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    group.add(plane);
    if (showGrid) {
      const gridHelper = new THREE.GridHelper(
        targetSize,
        Math.max(1, Math.round(targetSize / GROUND_PLANE_GRID_MM)),
        0xcccccc, 0xe0e0e0,
      );
      group.add(gridHelper);
    }
  }, [cabinets, showGrid]);

  // Load cabinet GLBs when the structural signature changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear existing cabinet groups
    for (const cg of cabinetGroupsRef.current) {
      scene.remove(cg.group);
      cg.group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }
    cabinetGroupsRef.current = [];

    const cabinetsWithGlb = cabinets.filter(c => c.glbUrl);
    if (cabinetsWithGlb.length === 0) {
      setLoadedCount(0);
      if (cabinets.length > 0) {
        console.warn(
          `[useSceneViewport] Scene has ${cabinets.length} cabinet(s) but none have a glbUrl. ` +
          `If this scene was created by AI cabinet detection before the source-upload fix, ` +
          `re-run detection on the source model and save a new scene.`,
          cabinets.map(c => ({ code: c.cabinetCode, glbUrl: c.glbUrl, sourceModelUrl: c.sourceModelUrl })),
        );
      }
      return;
    }

    setIsLoading(true);
    setLoadedCount(0);

    const loader = new GLTFLoader();
    let loaded = 0;

    // Cache parsed GLTF by URL so N cabinets sharing a single sourceModelUrl
    // only trigger one network fetch.
    const gltfCache = new Map<string, Promise<THREE.Group>>();
    const loadGltfOnce = (url: string): Promise<THREE.Group> => {
      const hit = gltfCache.get(url);
      if (hit) return hit;
      const p = new Promise<THREE.Group>((resolve, reject) => {
        loader.load(url, (g) => resolve(g.scene), undefined, reject);
      });
      gltfCache.set(url, p);
      return p;
    };

    for (const cabinet of cabinetsWithGlb) {
      loadGltfOnce(cabinet.glbUrl)
        .then((sourceScene) => {
          const group = new THREE.Group();
          group.name = `cabinet-${cabinet.id}`;
          group.userData = { cabinetId: cabinet.id, cabinetCode: cabinet.cabinetCode };

          // If sourceMeshNames is present, this cabinet is a subset of a
          // shared source GLB (AI-detection path). Clone + filter so we only
          // show the meshes that belong to this cabinet.
          const isSubset = !!(cabinet.sourceMeshNames && cabinet.sourceMeshNames.length > 0);
          if (isSubset) {
            const normalize = (s: string) => s.trim().replace(/\s+/g, '_').toLowerCase();
            const wantedRaw = cabinet.sourceMeshNames ?? [];
            const wantedExact = new Set(wantedRaw);
            const wantedNormalized = new Set(wantedRaw.map(normalize));

            const cloned = sourceScene.clone(true);
            const allMeshes: THREE.Mesh[] = [];
            const keep: THREE.Mesh[] = [];

            cloned.traverse((obj) => {
              if (!(obj instanceof THREE.Mesh)) return;
              allMeshes.push(obj);
              // Try 3 matching strategies in order of reliability:
              //   1. userData.dawinMeshId (written at export — survives GLTF sanitization)
              //   2. exact mesh.name match
              //   3. normalized name match (whitespace/case insensitive)
              const dawinId = obj.userData?.dawinMeshId as string | undefined;
              if (dawinId && wantedExact.has(dawinId)) { keep.push(obj); return; }
              if (wantedExact.has(obj.name)) { keep.push(obj); return; }
              if (wantedNormalized.has(normalize(obj.name))) { keep.push(obj); return; }
            });

            if (keep.length === 0) {
              // Diagnostic: dump what we found vs what we asked for so the
              // developer can see the mismatch in the console. Then fall back
              // to rendering every mesh in the source for this cabinet — that
              // way the user at least sees geometry instead of an empty scene.
              console.warn(
                `[useSceneViewport] Cabinet ${cabinet.cabinetCode}: zero of ` +
                `${wantedRaw.length} sourceMeshNames matched. Falling back to ` +
                `whole-source render. Wanted=`, wantedRaw.slice(0, 10),
                ' GLB has=', allMeshes.slice(0, 10).map(m => ({
                  name: m.name,
                  dawinId: m.userData?.dawinMeshId,
                })),
              );
              for (const mesh of allMeshes) keep.push(mesh);
            } else {
              console.debug(
                `[useSceneViewport] Cabinet ${cabinet.cabinetCode}: matched ` +
                `${keep.length}/${wantedRaw.length} meshes from source GLB.`,
              );
            }

            // Re-parent each kept mesh to `group` while preserving its world
            // transform — otherwise the hierarchy of the source GLB is lost.
            for (const mesh of keep) {
              mesh.updateWorldMatrix(true, false);
              const worldMatrix = mesh.matrixWorld.clone();
              mesh.parent?.remove(mesh);
              group.add(mesh);
              worldMatrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
            }
            // Re-center the group around its own bounding box so the saved
            // `cabinet.position` (the detected centroid) places it correctly
            // — otherwise the original world coords + position would double up.
            const bbox = new THREE.Box3().setFromObject(group);
            if (bbox.isEmpty() === false) {
              const cx = (bbox.min.x + bbox.max.x) / 2;
              const cz = (bbox.min.z + bbox.max.z) / 2;
              const minY = bbox.min.y;
              for (const child of group.children) {
                child.position.x -= cx;
                child.position.y -= minY;
                child.position.z -= cz;
              }
            }
          } else {
            // Legacy path — whole GLB is this cabinet
            group.add(sourceScene.clone(true));
          }

          const pos = cabinet.position ?? { x: 0, y: 0, z: 0 };
          group.position.set(pos.x, pos.y, pos.z);
          group.rotation.y = THREE.MathUtils.degToRad(cabinet.rotation ?? 0);
          // Turn-round flag applied at mount time so the very first
          // render respects it (the cheap-path transform-sync effect
          // above keeps it in sync on subsequent updates).
          if (cabinet.position?.mirrored === true) group.scale.x = -1;
          scene.add(group);

          // Floor-clamp safety net. Scenes saved before the centroid rotation
          // fix stored position.y as the source's "forward" axis (often a
          // large negative number — we've seen Y: −11015mm). Those cabinets
          // render buried below the ground plane. Detect that state by
          // checking the group's world bbox min.y; if it's more than a small
          // tolerance below the floor (y=0), lift the group so the cabinet
          // stands on the ground. Idempotent for correctly-placed cabinets
          // because their bbox min.y is already ≈ 0.
          try {
            const preBox = new THREE.Box3().setFromObject(group);
            if (!preBox.isEmpty() && preBox.min.y < -1) {
              const lift = -preBox.min.y;
              group.position.y += lift;
              console.warn(
                `[useSceneViewport] Cabinet ${cabinet.cabinetCode} was stored ` +
                `${lift.toFixed(0)}mm below floor (legacy pre-axis-fix scene). ` +
                `Lifted at render-time. Drag the cabinet and release to persist a correct Y.`,
                { storedPos: pos },
              );
            }
          } catch { /* non-fatal */ }

          cabinetGroupsRef.current.push({
            cabinetId: cabinet.id,
            cabinetCode: cabinet.cabinetCode,
            group,
          });
          // Diagnostic: once a cabinet is in the scene, log its world-space
          // bounding box so we can confirm geometry exists AND see where it is.
          // A common failure mode is loading succeeds but positions come from
          // the source model's world coords, placing cabinets far outside the
          // default camera frustum — the user sees an empty viewport.
          try {
            const wbox = new THREE.Box3().setFromObject(group);
            console.debug(
              `[useSceneViewport] Cabinet ${cabinet.cabinetCode} placed at`,
              { x: pos.x, y: pos.y, z: pos.z },
              'world bbox=',
              wbox.isEmpty() ? 'EMPTY' : {
                min: wbox.min.toArray(),
                max: wbox.max.toArray(),
              },
            );
          } catch { /* non-fatal */ }
          loaded++;
          setLoadedCount(loaded);
          if (loaded === cabinetsWithGlb.length) {
            setIsLoading(false);
            // Fit the camera to the aggregated scene so we never leave the
            // user staring at an empty viewport when cabinet world coords are
            // far from the origin (common for source models authored anywhere
            // other than (0,0,0)).
            fitCameraToCabinets();
          }
        })
        .catch((err) => {
          loaded++;
          setLoadedCount(loaded);
          if (loaded === cabinetsWithGlb.length) setIsLoading(false);
          console.warn(`Failed to load GLB for cabinet ${cabinet.cabinetCode}:`, err);
        });
    }
    // Depend on the structural signature (not the `cabinets` array identity)
    // so position/rotation changes don't rebuild the whole viewport. Read
    // the latest `cabinets` inside via the closure — it's captured from this
    // render which fired BECAUSE the signature changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralSignature]);

  // Raycasting click handler — branches on selection mode so that
  //   project  → clicking anywhere clears any cabinet selection (scene root)
  //   cabinet  → click the group, report cabinetId (legacy behaviour)
  //   assembly → click a specific mesh, report { cabinetId, meshId }
  //   part     → same as assembly but semantics differ at callsite
  //
  // Without this branching every mode fired the same cabinet-level callback,
  // which is the user-reported "the selection modes aren't working".
  useEffect(() => {
    const container = containerRef.current;
    const camera = cameraRef.current;
    if (!container || !camera) return;
    if (!onCabinetClick && !onMeshClick) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const findCabinetGroup = (obj: THREE.Object3D | null): CabinetMeshGroup | null => {
      let cur: THREE.Object3D | null = obj;
      while (cur) {
        if (cur.userData?.cabinetId) {
          const id = cur.userData.cabinetId as string;
          return cabinetGroupsRef.current.find(cg => cg.cabinetId === id) ?? null;
        }
        cur = cur.parent;
      }
      return null;
    };

    const handleClick = (event: MouseEvent) => {
      // Swallow clicks while the gizmo is being dragged — otherwise the
      // mouseUp at the end of a drag also re-selects whatever was under the
      // pointer, which can feel like the selection is "jumping" between
      // cabinets during a move.
      if (suppressClicksRef.current) return;
      const rect = container.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // One raycast against all cabinet groups — the nearest hit wins.
      const allGroups = cabinetGroupsRef.current.map(cg => cg.group);
      const hits = raycaster.intersectObjects(allGroups, true);
      let nearest = hits[0];
      if (selectionMode === 'part' && hits.length > 1 && highlightedMeshNeedles.length > 0) {
        const normalize = (s: string | null | undefined) =>
          (s ?? '').trim().toLowerCase().replace(/\s+/g, '_');
        const selectedNeedles = new Set(
          highlightedMeshNeedles.filter(Boolean).flatMap(s => [s, normalize(s)]),
        );
        const alt = hits.find(hit => {
          const mesh = hit.object as THREE.Mesh;
          const dawinId = (mesh.userData?.dawinMeshId as string | undefined) ?? null;
          const meshName = mesh.name || '';
          return !selectedNeedles.has(meshName)
            && !selectedNeedles.has(normalize(meshName))
            && (!dawinId || (!selectedNeedles.has(dawinId) && !selectedNeedles.has(normalize(dawinId))));
        });
        if (alt) nearest = alt;
      }

      if (!nearest) {
        // Click on empty space — clear cabinet selection in every mode that
        // maintains one. Project mode treats this as "select the scene".
        onCabinetClick?.('');
        return;
      }

      const cg = findCabinetGroup(nearest.object);
      if (!cg) return;

      if (selectionMode === 'project') {
        // Project mode: ignore which cabinet was hit; the whole scene is
        // the addressable unit. Clear the cabinet selection.
        onCabinetClick?.('');
        return;
      }

      if (selectionMode === 'cabinet') {
        onCabinetClick?.(cg.cabinetId);
        return;
      }

      // assembly / part modes need the specific mesh identity.
      const mesh = nearest.object as THREE.Mesh;
      const dawinId = (mesh.userData?.dawinMeshId as string | undefined) ?? null;
      const meshName = mesh.name || '';
      if (onMeshClick) {
        // World-space intersection + world-transformed bbox of the hit
        // mesh. The scene page uses these as a fallback when the mesh
        // id doesn't map to any ScenePart.meshNodeId — "which part's
        // bbox contains the click point" catches cases where the GLB
        // mesh names diverged from what was stored on the parts.
        const worldBox = new THREE.Box3().setFromObject(mesh);
        onMeshClick({
          cabinetId: cg.cabinetId,
          meshId: dawinId ?? (meshName || null),
          meshName,
          worldPoint: {
            x: nearest.point.x, y: nearest.point.y, z: nearest.point.z,
          },
          hitBbox: worldBox.isEmpty() ? undefined : {
            min: { x: worldBox.min.x, y: worldBox.min.y, z: worldBox.min.z },
            max: { x: worldBox.max.x, y: worldBox.max.y, z: worldBox.max.z },
          },
        });
      } else {
        // Fall back to cabinet-level selection if the page didn't provide a
        // mesh handler — users at least get something on click.
        onCabinetClick?.(cg.cabinetId);
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [onCabinetClick, onMeshClick, selectionMode, highlightedMeshNeedles]);

  const highlightCabinet = useCallback((cabinetId: string | null) => {
    for (const cg of cabinetGroupsRef.current) {
      const dimmed = cabinetId !== null && cg.cabinetId !== cabinetId;
      cg.group.traverse(child => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          mat.opacity = dimmed ? 0.3 : 1.0;
          mat.transparent = dimmed;
        }
      });
    }
  }, []);

  const highlightMeshes = useCallback((meshNeedles: string[], enableXray = false) => {
    const normalize = (s: string | null | undefined) =>
      (s ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    const needles = new Set(meshNeedles.filter(Boolean).flatMap(s => [s, normalize(s)]));
    const hasSelection = needles.size > 0;

    for (const cg of cabinetGroupsRef.current) {
      cg.group.traverse(child => {
        if (!(child instanceof THREE.Mesh) || !child.material) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];

        const dawinId = child.userData?.dawinMeshId as string | undefined;
        const meshName = child.name || '';
        const isSelected = hasSelection && (
          needles.has(meshName)
          || needles.has(normalize(meshName))
          || (!!dawinId && (needles.has(dawinId) || needles.has(normalize(dawinId))))
        );

        for (const mat of mats) {
          const anyMat = mat as THREE.MeshStandardMaterial & {
            emissive?: THREE.Color;
            opacity: number;
            transparent: boolean;
            depthWrite: boolean;
          };
          if (isSelected) {
            anyMat.opacity = 1;
            anyMat.transparent = false;
            anyMat.depthWrite = !enableXray;
            if (anyMat.emissive) anyMat.emissive.setHex(0xC8962E);
          } else if (hasSelection || enableXray) {
            anyMat.opacity = enableXray ? 0.22 : 0.14;
            anyMat.transparent = true;
            anyMat.depthWrite = false;
            if (anyMat.emissive) anyMat.emissive.setHex(0x000000);
          } else {
            anyMat.opacity = 1;
            anyMat.transparent = false;
            anyMat.depthWrite = true;
            if (anyMat.emissive) anyMat.emissive.setHex(0x000000);
          }
        }
      });
    }
  }, []);

  const isolateCabinet = useCallback((cabinetId: string | null) => {
    // Flip visibility — the three.js-level enforcement of the isolation.
    for (const cg of cabinetGroupsRef.current) {
      cg.group.visible = cabinetId === null || cg.cabinetId === cabinetId;
    }
    // Re-frame the camera so the transition FEELS like isolation —
    // camera-controls' setLookAt(..., true) animates so the user sees
    // the viewport zoom to the focused cabinet (or pan back out to
    // the whole scene on un-isolate). Without this, isolation was a
    // silent visibility flip and users reported it as "not smooth".
    fitCameraToCabinets(cabinetId ?? undefined);
  }, []);

  const resetCamera = useCallback(() => {
    fitCameraToCabinets();
  }, []);

  /**
   * Compute the aggregated bounding box of every loaded cabinet group and move
   * the camera so the whole set is framed comfortably. This is the safety net
   * that prevents "empty viewport" symptoms when cabinet positions (from the
   * AI-detection centroids, in the source model's world coords) are far from
   * the origin — the default (3000, 2000, 3000) camera sees nothing.
   *
   * Pass `onlyCabinetId` to frame a single cabinet instead — used by the
   * isolate flow so the camera zooms to the focused cabinet.
   */
  function fitCameraToCabinets(onlyCabinetId?: string) {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;

    const aggBox = new THREE.Box3();
    let any = false;
    for (const cg of cabinetGroupsRef.current) {
      if (onlyCabinetId && cg.cabinetId !== onlyCabinetId) continue;
      const b = new THREE.Box3().setFromObject(cg.group);
      if (b.isEmpty()) continue;
      aggBox.union(b);
      any = true;
    }
    if (!any || aggBox.isEmpty()) {
      // Nothing to frame — fall back to default.
      controls.setLookAt(3000, 2000, 3000, 0, 0, 0, true);
      return;
    }
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    aggBox.getCenter(center);
    aggBox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 35;
    // Distance so `maxDim` fits the view with ~30% margin.
    const dist = (maxDim / 2) / Math.tan(THREE.MathUtils.degToRad(fov / 2)) * 1.8;
    // Iso-ish framing direction (NE-up).
    const dir = new THREE.Vector3(1, 0.7, 1).normalize();
    const camPos = center.clone().add(dir.multiplyScalar(dist));
    controls.setLookAt(
      camPos.x, camPos.y, camPos.z,
      center.x, center.y, center.z,
      true,
    );
    console.debug(
      '[useSceneViewport] fitCameraToCabinets — center=',
      center.toArray(), 'size=', size.toArray(), 'camPos=', camPos.toArray(),
    );
  }

  const swapCamera = useCallback((newCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera) => {
    cameraRef.current = newCamera;
    const controls = controlsRef.current;
    if (controls) {
      // camera-controls doesn't natively swap cameras; recreate controls with new camera
      const renderer = rendererRef.current;
      if (renderer) {
        const oldTarget = new THREE.Vector3();
        controls.getTarget(oldTarget);
        controls.dispose();
        const newControls = new CameraControls(newCamera, renderer.domElement);
        newControls.smoothTime = 0.25;
        newControls.setTarget(oldTarget.x, oldTarget.y, oldTarget.z, false);
        controlsRef.current = newControls;
      }
    }
    forceRender({});
  }, []);

  // Adapter so useAutoFraming can drive camera-controls via its minimal API
  const controlsAdapter: ControlsAdapter | null = controlsRef.current ? {
    target: (() => {
      const v = new THREE.Vector3();
      controlsRef.current?.getTarget(v);
      return v;
    })(),
    update: () => {
      const c = controlsRef.current;
      if (c) c.update(0);
    },
    addEventListener: (type, handler) => {
      const c = controlsRef.current as unknown as {
        addEventListener: (t: string, h: (e?: unknown) => void) => void;
      };
      c?.addEventListener?.(type, handler);
    },
    removeEventListener: (type, handler) => {
      const c = controlsRef.current as unknown as {
        removeEventListener: (t: string, h: (e?: unknown) => void) => void;
      };
      c?.removeEventListener?.(type, handler);
    },
    get enabled() { return controlsRef.current?.enabled ?? true; },
    set enabled(v: boolean) {
      if (controlsRef.current) controlsRef.current.enabled = v;
    },
  } : null;

  // ─── Framing: drive camera from currentPreset + subjectCabinetId ────────
  // When the toolbar picks Top / Front / Iso / etc. this effect fires,
  // computes a target pose for the (scene or selected-cabinet) subject using
  // the framing service, and asks camera-controls to animate there.
  // recenterNonce is a parent-controlled counter that forces a re-run even
  // when preset/subject haven't changed — used by the Recenter button and
  // F-hotkey.
  useEffect(() => {
    if (!currentPreset) return;
    const controls = controlsRef.current;
    if (!controls) return;

    // Build the bounding box we want to frame.
    let targetBox: THREE.Box3 | null = null;
    if (subjectCabinetId) {
      const grp = cabinetGroupsRef.current.find(cg => cg.cabinetId === subjectCabinetId)?.group;
      if (grp) targetBox = new THREE.Box3().setFromObject(grp);
    }
    if (!targetBox || targetBox.isEmpty()) {
      // Scene-level — aggregate all cabinet groups.
      const agg = new THREE.Box3();
      let any = false;
      for (const cg of cabinetGroupsRef.current) {
        const b = new THREE.Box3().setFromObject(cg.group);
        if (b.isEmpty()) continue;
        agg.union(b); any = true;
      }
      if (any) targetBox = agg;
    }
    if (!targetBox || targetBox.isEmpty()) return;   // nothing loaded yet

    const center = new THREE.Vector3();
    targetBox.getCenter(center);
    const size = new THREE.Vector3();
    targetBox.getSize(size);
    const radius = size.length() / 2;

    const bounds: BoundingSphere = {
      center: { x: center.x, y: center.y, z: center.z },
      radius,
    };
    const aspect = (() => {
      const c = cameraRef.current;
      if (c instanceof THREE.PerspectiveCamera) return c.aspect;
      return 1;
    })();
    const pose = computePoseForSubject(bounds, currentPreset, aspect);

    controls.setLookAt(
      pose.position.x, pose.position.y, pose.position.z,
      pose.target.x, pose.target.y, pose.target.z,
      true,     // smooth — camera-controls tweens to the target
    );
  }, [currentPreset, subjectCabinetId, recenterNonce]);

  const getCabinetGroup = useCallback((cabinetId: string): THREE.Group | null => {
    return cabinetGroupsRef.current.find(cg => cg.cabinetId === cabinetId)?.group ?? null;
  }, []);

  const setControlsEnabled = useCallback((enabled: boolean) => {
    const c = controlsRef.current;
    if (c) c.enabled = enabled;
  }, []);

  const fitAll = useCallback(() => {
    fitCameraToCabinets();
  }, []);

  return {
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    isLoading,
    loadedCount,
    totalCount: cabinets.filter(c => c.glbUrl).length,
    error,
    highlightCabinet,
    isolateCabinet,
    resetCamera,
    threeScene: sceneRef.current,
    camera: cameraRef.current,
    controls: controlsAdapter,
    swapCamera,
    rendererDomElement: rendererRef.current?.domElement ?? null,
    /** WebGLRenderer itself — exposed for capture flows (RenderPanel,
     *  `captureViewport(renderer, camera)`). The `rendererDomElement`
     *  alone isn't enough because captureViewport re-renders at a
     *  higher pixel ratio before reading pixels. */
    renderer: rendererRef.current,
    getCabinetGroup,
    setControlsEnabled,
    suppressClicksRef,
    fitAll,
    highlightMeshes,
  };
}
