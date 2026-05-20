/**
 * ThreeViewport — Main Three.js 3D viewport component
 *
 * Features:
 * - WebGLRenderer + PerspectiveCamera + bright 3-point lighting
 * - Custom orbit controls (no three/examples dependency)
 * - Auto-center and fit on every view preset change (ortho + iso)
 * - Part selection via raycasting
 * - Assembly highlighting (gold selected, dimmed others)
 * - Explode/collapse animation
 * - Coordinate transform: PolyBoard Z-up → Three.js Y-up
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import CameraControls from 'camera-controls';
CameraControls.install({ THREE });
import type {
  ParsedModel,
  ViewerState,
  PartTreeNode,
  DimensionSet,
  AssemblyGroup,
} from '../types/workshop-viewer.types';
import type { ManagedDimension, SnapTarget } from '../types/dimension.types';
import { SCENE_DEFAULTS, VIEW_PRESETS } from '../constants/workshop-viewer.constants';
import { computeBoundingBox, mergeBoundingBoxes, bboxDimensions } from '../services/geometryEngine';
import { computeExplodeOffsets } from '../services/explodeEngine';
import { createSnapIndicator } from '../services/snapEngine';
import type { MaterialMapping } from '../services/materialResolverService';
import { TEXTURE_CACHE_MAX_SIZE } from '../constants/materials.constants';

// ============================================================================
// PBR TEXTURE CACHE — module-level LRU cache for loaded textures
// ============================================================================
const textureCache = new Map<string, THREE.Texture>();
const textureCacheOrder: string[] = [];
const textureLoader = new THREE.TextureLoader();

function getCachedTexture(url: string): Promise<THREE.Texture> {
  const cached = textureCache.get(url);
  if (cached) {
    // Move to end of LRU order
    const idx = textureCacheOrder.indexOf(url);
    if (idx >= 0) textureCacheOrder.splice(idx, 1);
    textureCacheOrder.push(url);
    return Promise.resolve(cached);
  }
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        textureCache.set(url, tex);
        textureCacheOrder.push(url);
        // Evict oldest if over limit
        while (textureCacheOrder.length > TEXTURE_CACHE_MAX_SIZE) {
          const evictUrl = textureCacheOrder.shift()!;
          const evicted = textureCache.get(evictUrl);
          if (evicted) { evicted.dispose(); textureCache.delete(evictUrl); }
        }
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

// Load ISOCPEUR (osifont) for dimension labels in 3D viewport canvas textures
void (async () => {
  if (typeof document === 'undefined') return;
  try {
    const font = new FontFace('ISOCPEUR', 'url(/fonts/osifont.ttf)');
    await font.load();
    document.fonts.add(font);
  } catch { /* fallback to monospace */ }
})();

interface ThreeViewportProps {
  model: ParsedModel | null;
  viewerState: ViewerState;
  partTree: PartTreeNode[];
  dimensions: DimensionSet | null;
  highlightedGroupId?: string | null;
  assemblyGroups?: AssemblyGroup[];
  onPartSelect: (meshName: string | null) => void;
  onViewChange?: (viewName: string) => void;
  measureTool?: {
    isActive: boolean;
    handleClick: (p: THREE.Vector3) => ManagedDimension | null;
    handleMouseMove: (p: THREE.Vector3) => SnapTarget | null;
    firstPoint?: THREE.Vector3; // world-space first pick point (during picking_second state)
  };
  onUserDimensionCreated?: (dim: ManagedDimension) => void;
  userDimensions?: ManagedDimension[];
  /** Material mappings from Finish Library resolver (Phase B) */
  materialMappings?: MaterialMapping[];
  /** Resolved material overrides from swatch picker (Phase E) — materialName → resolved data */
  materialOverrides?: Map<string, { hexColor: string; roughness: number; metalness: number; textureAssets?: { diffuseUrl?: string; normalUrl?: string; roughnessUrl?: string; tileRepeat?: [number, number] } }>;
  /** Called once scene is initialized, providing access to Three.js internals for capture */
  onSceneReady?: (refs: {
    getScene: () => THREE.Scene | null;
    getCamera: () => THREE.PerspectiveCamera | null;
    getRenderer: () => THREE.WebGLRenderer | null;
    getControls: () => CameraControls | null;
  }) => void;
}

// ============================================================================
// CAMERA CONTROLS
// ============================================================================

export default function ThreeViewport({
  model,
  viewerState,
  partTree,
  dimensions,
  highlightedGroupId,
  assemblyGroups,
  onPartSelect,
  measureTool,
  materialMappings,
  materialOverrides,
  onSceneReady,
}: ThreeViewportProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const edgeMapRef = useRef<Map<string, THREE.LineSegments>>(new Map());
  const controlsRef = useRef<CameraControls | null>(null);
  const rafRef = useRef<number>(0);
  const dimGroupRef = useRef<THREE.Group | null>(null);
  const snapIndicatorRef = useRef<THREE.Group | null>(null);
  const firstPointMarkerRef = useRef<THREE.Group | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // ============================================================================
  // SCENE INITIALIZATION
  // ============================================================================

  useEffect(() => {
    if (!canvasRef.current) return;
    const container = canvasRef.current;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_DEFAULTS.backgroundColor);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      SCENE_DEFAULTS.cameraFov,
      container.clientWidth / container.clientHeight,
      0.1,
      100000,
    );
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4; // Brighter overall exposure
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting — bright 3-point setup for workshop visibility
    const ambient = new THREE.AmbientLight(0xffffff, 0.6); // Increased from 0.3
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0); // Increased from 0.7
    keyLight.position.set(2000, 3000, 1500);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5); // New fill light
    fillLight.position.set(-2000, 1000, -1000);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xE8E0D8, 0.4); // Warm rim
    rimLight.position.set(-1500, -2000, 1000);
    scene.add(rimLight);

    // Hemisphere light for natural fill from sky/ground
    const hemiLight = new THREE.HemisphereLight(0xF0EDE8, 0xB0A890, 0.3);
    scene.add(hemiLight);

    // Root group for model (coordinate transform applied here)
    const rootGroup = new THREE.Group();
    rootGroup.rotation.x = -Math.PI / 2; // Z-up → Y-up
    scene.add(rootGroup);
    rootGroupRef.current = rootGroup;

    // Snap indicator for measure tool (cyan hover sphere)
    const snapIndicator = createSnapIndicator();
    snapIndicator.visible = false;
    snapIndicator.renderOrder = 999;
    scene.add(snapIndicator);
    snapIndicatorRef.current = snapIndicator;

    // First-point marker (orange crosshair shown after first click)
    const firstPointMarker = new THREE.Group();
    const fpMat = new THREE.LineBasicMaterial({ color: 0xFF6B00, depthTest: false, linewidth: 2 });
    const fpSize = 14;
    const mkFpLine = (a: THREE.Vector3, b: THREE.Vector3) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), fpMat);
    firstPointMarker.add(mkFpLine(new THREE.Vector3(-fpSize, 0, 0), new THREE.Vector3(fpSize, 0, 0)));
    firstPointMarker.add(mkFpLine(new THREE.Vector3(0, -fpSize, 0), new THREE.Vector3(0, fpSize, 0)));
    firstPointMarker.add(mkFpLine(new THREE.Vector3(0, 0, -fpSize), new THREE.Vector3(0, 0, fpSize)));
    firstPointMarker.visible = false;
    firstPointMarker.renderOrder = 998;
    scene.add(firstPointMarker);
    firstPointMarkerRef.current = firstPointMarker;

    // Camera controls (replaces custom orbit — adds touch support)
    const controls = new CameraControls(camera, renderer.domElement);
    controls.minDistance = 10;
    controls.maxDistance = 50000;
    controls.smoothTime = 0.12;
    controls.draggingSmoothTime = 0.08;
    controlsRef.current = controls;

    setIsInitialized(true);

    // Expose scene refs for render capture + auto-framing integration
    onSceneReady?.({
      getScene: () => sceneRef.current,
      getCamera: () => cameraRef.current,
      getRenderer: () => rendererRef.current,
      getControls: () => controlsRef.current,
    });

    // Animation loop. THREE.Clock is deprecated — THREE.Timer replaces it
    // with an explicit update()/getDelta() split.
    const clock = new THREE.Timer();
    function animate() {
      rafRef.current = requestAnimationFrame(animate);
      clock.update();
      const delta = clock.getDelta();
      controls.update(delta);
      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // ============================================================================
  // MODEL BUILDING
  // ============================================================================

  useEffect(() => {
    if (!isInitialized || !model || !rootGroupRef.current) return;
    const rootGroup = rootGroupRef.current;

    // Clear previous meshes
    while (rootGroup.children.length > 0) rootGroup.remove(rootGroup.children[0]);
    meshMapRef.current.clear();
    edgeMapRef.current.clear();

    // GLB source — load via GLTFLoader to preserve original textures/PBR materials
    if (model.source === 'glb' && model.glbBuffer) {
      const loader = new GLTFLoader();
      loader.parse(model.glbBuffer, '', (gltf) => {
        // GLB scenes are Y-up already, undo the Z-up→Y-up rotation for this model
        const glbGroup = new THREE.Group();
        glbGroup.rotation.x = Math.PI / 2; // undo rootGroup's -PI/2

        // Auto-scale: Tripo AI models are in meters, viewer expects mm-scale.
        // Measure raw bounding box and scale up if model is very small (< 100 units).
        const rawBox = new THREE.Box3().setFromObject(gltf.scene);
        const rawSize = new THREE.Vector3();
        rawBox.getSize(rawSize);
        const rawMax = Math.max(rawSize.x, rawSize.y, rawSize.z);
        const scaleFactor = rawMax < 100 ? 1000 : 1; // meters → mm
        if (scaleFactor !== 1) {
          gltf.scene.scale.setScalar(scaleFactor);
        }

        glbGroup.add(gltf.scene);
        rootGroup.add(glbGroup);

        // Force world matrix update so raycasting and Box3 work correctly
        rootGroup.updateMatrixWorld(true);

        // Register meshes for raycasting/selection
        let meshIdx = 0;
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const name = child.name || `glb_mesh_${meshIdx}`;
            child.userData.partName = name;
            child.userData.originalMaterial = (child.material as THREE.Material).clone();
            child.userData.materialName = name;
            meshMapRef.current.set(name, child);
            meshIdx++;
          }
        });

        // Compute bounding box from actual Three.js scene (not parsed flat arrays)
        fitCameraToGlb(rootGroup);
      }, (err) => {
        console.error('[ThreeViewport] GLB load error:', err);
      });
      return;
    }

    // Non-GLB source — build meshes from parsed vertex/face arrays
    for (const obj of model.objects) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(obj.vertices, 3));
      geometry.setIndex(new THREE.BufferAttribute(obj.faces, 1));
      geometry.computeVertexNormals();

      // Material color from model or default
      const matDef = model.materials[obj.material];
      const color = matDef
        ? new THREE.Color(matDef.diffuse[0], matDef.diffuse[1], matDef.diffuse[2])
        : new THREE.Color(SCENE_DEFAULTS.defaultMaterialColor);

      // Check for PBR material mapping from Finish Library
      const mapping = materialMappings?.find(m => m.threeDsMaterialName === obj.material);
      let roughness = 0.6;
      let metalness = 0.05;
      let matColor = color;

      if (mapping && mapping.confidence > 0 && mapping.hexColor) {
        matColor = new THREE.Color(mapping.hexColor);
        roughness = mapping.pbrDefaults.roughness;
        metalness = mapping.pbrDefaults.metalness;
      }

      const material = new THREE.MeshStandardMaterial({
        color: matColor,
        roughness,
        metalness,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = {
        partName: obj.name,
        originalColor: color.getHex(),
        originalMaterial: material.clone(), // preserve for Phase E reset
        materialName: obj.material,
      };

      // Async PBR texture loading (non-blocking)
      if (mapping?.textureAssets) {
        const ta = mapping.textureAssets;
        const loadAndApply = async () => {
          try {
            if (ta.diffuseUrl) {
              const diffTex = await getCachedTexture(ta.diffuseUrl);
              if (ta.tileRepeat) {
                diffTex.wrapS = diffTex.wrapT = THREE.RepeatWrapping;
                diffTex.repeat.set(ta.tileRepeat[0], ta.tileRepeat[1]);
              }
              material.map = diffTex;
            }
            if (ta.normalUrl) {
              const normTex = await getCachedTexture(ta.normalUrl);
              if (ta.tileRepeat) {
                normTex.wrapS = normTex.wrapT = THREE.RepeatWrapping;
                normTex.repeat.set(ta.tileRepeat[0], ta.tileRepeat[1]);
              }
              material.normalMap = normTex;
            }
            if (ta.roughnessUrl) {
              const roughTex = await getCachedTexture(ta.roughnessUrl);
              if (ta.tileRepeat) {
                roughTex.wrapS = roughTex.wrapT = THREE.RepeatWrapping;
                roughTex.repeat.set(ta.tileRepeat[0], ta.tileRepeat[1]);
              }
              material.roughnessMap = roughTex;
            }
            material.needsUpdate = true;
          } catch (err) {
            // Texture load failed — material stays at hex color fallback
            console.warn(`[ThreeViewport] Texture load failed for ${obj.material}:`, err);
          }
        };
        loadAndApply();
      }
      rootGroup.add(mesh);
      meshMapRef.current.set(obj.name, mesh);

      // Edge wireframe
      if (viewerState.showEdges) {
        const edgeGeom = new THREE.EdgesGeometry(geometry, 15);
        const edgeMat = new THREE.LineBasicMaterial({
          color: 0x1B2A4A,
          depthTest: true,
        });
        const edges = new THREE.LineSegments(edgeGeom, edgeMat);
        rootGroup.add(edges);
        edgeMapRef.current.set(obj.name, edges);

        // Pass 2: faint edges (depthTest: false — renders through geometry)
        if (viewerState.hiddenLineMode === 'faint') {
          const faintMat = new THREE.LineBasicMaterial({
            color: 0x888888,
            depthTest: false,
            transparent: true,
            opacity: 0.08,
          });
          const faintEdges = new THREE.LineSegments(edgeGeom, faintMat);
          faintEdges.renderOrder = -1;
          faintEdges.name = `${mesh.name}_faint_edges`;
          rootGroup.add(faintEdges);
        }
      }
    }

    // Fit camera to model
    fitCameraToModel();
  }, [model, isInitialized, viewerState.showEdges, materialMappings]);

  // ============================================================================
  // MATERIAL OVERRIDE — live swatch swapping without scene rebuild
  // ============================================================================

  useEffect(() => {
    if (!materialOverrides || materialOverrides.size === 0) {
      // Reset all meshes to original material when overrides cleared
      meshMapRef.current.forEach((mesh) => {
        const original = mesh.userData.originalMaterial as THREE.MeshStandardMaterial | undefined;
        if (original && mesh.userData._isOverridden) {
          const currentMat = mesh.material as THREE.MeshStandardMaterial;
          currentMat.color.copy(original.color);
          currentMat.roughness = original.roughness;
          currentMat.metalness = original.metalness;
          currentMat.map = original.map;
          currentMat.normalMap = original.normalMap;
          currentMat.roughnessMap = original.roughnessMap;
          currentMat.needsUpdate = true;
          mesh.userData._isOverridden = false;
        }
      });
      return;
    }

    meshMapRef.current.forEach((mesh) => {
      const matName = mesh.userData.materialName as string | undefined;
      if (!matName) return;

      const overrideData = materialOverrides.get(matName);
      if (overrideData) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.set(overrideData.hexColor);
        mat.roughness = overrideData.roughness;
        mat.metalness = overrideData.metalness;

        // Clear existing texture maps before applying new ones
        mat.map = null;
        mat.normalMap = null;
        mat.roughnessMap = null;

        // Load textures if available
        if (overrideData.textureAssets) {
          const ta = overrideData.textureAssets;
          const loadTex = async () => {
            try {
              if (ta.diffuseUrl) {
                const tex = await getCachedTexture(ta.diffuseUrl);
                if (ta.tileRepeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(ta.tileRepeat[0], ta.tileRepeat[1]); }
                mat.map = tex;
              }
              if (ta.normalUrl) {
                const tex = await getCachedTexture(ta.normalUrl);
                if (ta.tileRepeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(ta.tileRepeat[0], ta.tileRepeat[1]); }
                mat.normalMap = tex;
              }
              if (ta.roughnessUrl) {
                const tex = await getCachedTexture(ta.roughnessUrl);
                if (ta.tileRepeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(ta.tileRepeat[0], ta.tileRepeat[1]); }
                mat.roughnessMap = tex;
              }
              mat.needsUpdate = true;
            } catch (err) {
              console.warn('[ThreeViewport] Override texture load failed:', err);
            }
          };
          loadTex();
        }

        mat.needsUpdate = true;
        mesh.userData._isOverridden = true;
      } else if (mesh.userData._isOverridden) {
        // This material was overridden but no longer — restore original
        const original = mesh.userData.originalMaterial as THREE.MeshStandardMaterial | undefined;
        if (original) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.color.copy(original.color);
          mat.roughness = original.roughness;
          mat.metalness = original.metalness;
          mat.map = original.map;
          mat.normalMap = original.normalMap;
          mat.roughnessMap = original.roughnessMap;
          mat.needsUpdate = true;
          mesh.userData._isOverridden = false;
        }
      }
    });
  }, [materialOverrides]);

  // ============================================================================
  // FIT CAMERA — centres on model and adjusts radius
  // ============================================================================

  const fitCameraToModel = useCallback(() => {
    if (!model) return;
    const boxes = model.objects.map(o => computeBoundingBox(o.vertices));
    const overallBbox = mergeBoundingBoxes(boxes);
    const dims = bboxDimensions(overallBbox);
    const maxDim = Math.max(dims.w, dims.d, dims.h);

    // Center target on model center (after Z-up→Y-up transform: swap Y and Z)
    const cx = (overallBbox.min.x + overallBbox.max.x) / 2;
    const cy = (overallBbox.min.z + overallBbox.max.z) / 2;
    const cz = (overallBbox.min.y + overallBbox.max.y) / 2;
    const controls = controlsRef.current;
    if (controls) {
      const dist = maxDim * 2;
      // Position camera at default iso angle looking at center
      controls.setLookAt(
        cx + dist * 0.6, cy + dist * 0.7, cz + dist * 0.6,
        cx, cy, cz,
        false,
      );
    }

    // Add grid
    if (rootGroupRef.current && sceneRef.current) {
      const existingGrid = sceneRef.current.getObjectByName('grid');
      if (existingGrid) sceneRef.current.remove(existingGrid);

      const grid = new THREE.GridHelper(
        maxDim * 2,
        SCENE_DEFAULTS.gridSubdivisions,
        SCENE_DEFAULTS.gridColor1,
        SCENE_DEFAULTS.gridColor2,
      );
      grid.name = 'grid';
      grid.position.y = 0;
      sceneRef.current.add(grid);
    }
  }, [model]);

  // Fit camera for GLB models using Three.js Box3 on the actual scene graph
  const fitCameraToGlb = useCallback((group: THREE.Group) => {
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return;

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    const controls = controlsRef.current;
    if (controls) {
      // Adjust min/max distance relative to model size
      controls.minDistance = maxDim * 0.1;
      controls.maxDistance = maxDim * 20;

      const dist = maxDim * 2;
      controls.setLookAt(
        center.x + dist * 0.6, center.y + dist * 0.7, center.z + dist * 0.6,
        center.x, center.y, center.z,
        false,
      );
    }

    // Add grid at bottom of model
    if (sceneRef.current) {
      const existingGrid = sceneRef.current.getObjectByName('grid');
      if (existingGrid) sceneRef.current.remove(existingGrid);

      const grid = new THREE.GridHelper(
        maxDim * 2,
        SCENE_DEFAULTS.gridSubdivisions,
        SCENE_DEFAULTS.gridColor1,
        SCENE_DEFAULTS.gridColor2,
      );
      grid.name = 'grid';
      grid.position.y = box.min.y;
      sceneRef.current.add(grid);
    }
  }, []);

  // ============================================================================
  // VIEW PRESET CHANGES — always re-center and fit
  // ============================================================================

  useEffect(() => {
    const preset = VIEW_PRESETS[viewerState.currentView];
    if (!preset || !model) return;
    const controls = controlsRef.current;
    if (!controls) return;

    // Always re-center on model regardless of view type
    const boxes = model.objects.map(obj => computeBoundingBox(obj.vertices));
    const overallBbox = mergeBoundingBoxes(boxes);
    const dims = bboxDimensions(overallBbox);
    const maxDim = Math.max(dims.w, dims.d, dims.h);

    // Center on model (Z-up→Y-up: swap Y and Z)
    const cx = (overallBbox.min.x + overallBbox.max.x) / 2;
    const cy = (overallBbox.min.z + overallBbox.max.z) / 2;
    const cz = (overallBbox.min.y + overallBbox.max.y) / 2;

    // Tight fit for ortho; wider for iso to show full 3D context
    const isOrtho = ['front', 'back', 'right', 'left', 'top', 'bottom'].includes(viewerState.currentView);
    const dist = isOrtho ? maxDim * 1.5 : maxDim * 1.8;

    // Compute camera position from spherical angles (theta = azimuth, phi = polar)
    const camX = cx + dist * Math.sin(preset.phi) * Math.sin(preset.theta);
    const camY = cy + dist * Math.cos(preset.phi);
    const camZ = cz + dist * Math.sin(preset.phi) * Math.cos(preset.theta);

    controls.setLookAt(camX, camY, camZ, cx, cy, cz, false);
  }, [viewerState.currentView, model]);

  // ============================================================================
  // SELECTION HIGHLIGHTING
  // ============================================================================

  useEffect(() => {
    const selectedMeshNames = new Set<string>();

    // Find all mesh names for the selected part/assembly
    if (viewerState.selectedPartId) {
      function findNode(nodes: PartTreeNode[], id: string): PartTreeNode | null {
        for (const node of nodes) {
          if (node.id === id) return node;
          const found = findNode(node.children, id);
          if (found) return found;
        }
        return null;
      }

      const node = findNode(partTree, viewerState.selectedPartId);
      if (node) {
        for (const name of node.meshObjectNames) selectedMeshNames.add(name);
      }
    }

    // Apply highlighting
    for (const [name, mesh] of meshMapRef.current) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const isSelected = selectedMeshNames.has(name);
      const hasSelection = selectedMeshNames.size > 0;

      if (isSelected) {
        mat.color.set(SCENE_DEFAULTS.selectedColor);
        mat.opacity = 1;
        mat.transparent = false;
      } else if (hasSelection) {
        mat.color.set(mesh.userData.originalColor);
        mat.opacity = SCENE_DEFAULTS.dimmedOpacity;
        mat.transparent = true;
      } else {
        mat.color.set(mesh.userData.originalColor);
        mat.opacity = 1;
        mat.transparent = false;
      }
    }
  }, [viewerState.selectedPartId, partTree]);

  // ============================================================================
  // EXPLODE ANIMATION
  // ============================================================================

  useEffect(() => {
    if (!viewerState.expandedAssemblyIds?.length) {
      // Reset all positions
      for (const mesh of meshMapRef.current.values()) {
        mesh.position.set(0, 0, 0);
      }
      return;
    }

    // Compute explode offsets for expanded assemblies
    for (const asmId of viewerState.expandedAssemblyIds) {
      function findNode(nodes: PartTreeNode[], id: string): PartTreeNode | null {
        for (const node of nodes) {
          if (node.id === id) return node;
          const found = findNode(node.children, id);
          if (found) return found;
        }
        return null;
      }

      const node = findNode(partTree, asmId);
      if (!node) continue;

      const offsets = computeExplodeOffsets(node);
      for (const [meshName, offset] of offsets) {
        const mesh = meshMapRef.current.get(meshName);
        if (mesh) {
          // Apply offset (note: in PolyBoard coords, need to swap Y/Z for Three.js)
          mesh.position.set(offset.x, offset.z, offset.y);
        }
      }
    }
  }, [viewerState.expandedAssemblyIds, partTree]);

  // ============================================================================
  // ASSEMBLY GROUP HIGHLIGHTING
  // ============================================================================

  useEffect(() => {
    if (!highlightedGroupId || !assemblyGroups) {
      // Reset all materials to original (only if no part selection active)
      for (const mesh of meshMapRef.current.values()) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (!viewerState.selectedPartId) {
          mat.color.set(mesh.userData.originalColor);
          mat.opacity = 1;
          mat.transparent = false;
        }
      }
      return;
    }

    const group = assemblyGroups.find(g => g.id === highlightedGroupId);
    if (!group) return;

    // Find all mesh names in this group's partIds
    const groupMeshNames = new Set<string>();
    function findMeshNames(nodes: PartTreeNode[], ids: Set<string>) {
      for (const node of nodes) {
        if (ids.has(node.id)) {
          node.meshObjectNames.forEach(n => groupMeshNames.add(n));
        }
        findMeshNames(node.children || [], ids);
      }
    }
    findMeshNames(partTree, new Set(group.partIds));

    for (const [name, mesh] of meshMapRef.current) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (groupMeshNames.has(name)) {
        mat.color.set(0x4CAF50); // Green tint for hovered group
        mat.opacity = 1;
        mat.transparent = false;
      } else {
        mat.color.set(mesh.userData.originalColor);
        mat.opacity = 0.15;
        mat.transparent = true;
      }
    }
  }, [highlightedGroupId, assemblyGroups, partTree, viewerState.selectedPartId]);

  // ============================================================================
  // POINTER INTERACTION — selection + measure tool
  // (orbit / pan / zoom / touch handled by camera-controls)
  // ============================================================================

  useEffect(() => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;

    let pointerDownTime = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      pointerDownTime = Date.now();
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const handlePointerMove = (e: PointerEvent) => {
      // Cursor style: crosshair when measure tool is active
      canvas.style.cursor = measureTool?.isActive ? 'crosshair' : '';

      // Measure tool hover: show snap indicator
      if (measureTool?.isActive) {
        const camera = cameraRef.current;
        if (camera) {
          const rect = canvas.getBoundingClientRect();
          const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
          );
          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(mouse, camera);
          const allMeshes = Array.from(meshMapRef.current.values());
          const hits = raycaster.intersectObjects(allMeshes);
          if (hits.length > 0) {
            const snap = measureTool.handleMouseMove(hits[0].point);
            if (snapIndicatorRef.current) {
              snapIndicatorRef.current.visible = true;
              if (snap) {
                const p = snap.worldPosition;
                snapIndicatorRef.current.position.set(p.x, p.z, -p.y);
              } else {
                snapIndicatorRef.current.position.copy(hits[0].point);
              }
            }
          } else if (snapIndicatorRef.current) {
            snapIndicatorRef.current.visible = false;
          }
        }
      } else if (snapIndicatorRef.current) {
        snapIndicatorRef.current.visible = false;
        canvas.style.cursor = '';
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      // Detect click (no drag, quick)
      const elapsed = Date.now() - pointerDownTime;
      const moved = Math.abs(e.clientX - pointerDownPos.x) + Math.abs(e.clientY - pointerDownPos.y);
      if (elapsed < 300 && moved < 5) {
        handleClick(e as unknown as MouseEvent);
      }
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onPartSelect, measureTool]);

  // ============================================================================
  // MEASURE TOOL — FIRST-POINT MARKER
  // ============================================================================

  useEffect(() => {
    const marker = firstPointMarkerRef.current;
    if (!marker) return;
    if (measureTool?.firstPoint) {
      // firstPoint is already in Three.js world space (from hits[0].point via handleClick)
      marker.position.copy(measureTool.firstPoint);
      marker.visible = true;
    } else {
      marker.visible = false;
    }
  }, [measureTool?.firstPoint]);

  // ============================================================================
  // DIMENSION LINES
  // ============================================================================

  useEffect(() => {
    const rootGroup = rootGroupRef.current;
    if (!rootGroup || !model) return;

    // Remove previous dimension group
    const prev = rootGroup.getObjectByName('__dimensions__');
    if (prev) {
      prev.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      rootGroup.remove(prev);
    }
    dimGroupRef.current = null;

    if (!viewerState.showDimensions || !dimensions) return;

    const dimGroup = new THREE.Group();
    dimGroup.name = '__dimensions__';

    // Compute target bbox - selected part or overall
    // NOTE: dimensions are in PolyBoard coords (Z-up), rootGroup rotation converts them
    let targetBbox: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };

    if (viewerState.selectedPartId) {
      // Find meshes for selected part
      const selectedMeshes: THREE.Mesh[] = [];
      function findNodeForDims(nodes: PartTreeNode[], id: string): PartTreeNode | null {
        for (const node of nodes) {
          if (node.id === id) return node;
          const found = findNodeForDims(node.children, id);
          if (found) return found;
        }
        return null;
      }
      const node = findNodeForDims(partTree, viewerState.selectedPartId);
      if (node) {
        for (const name of node.meshObjectNames) {
          const mesh = meshMapRef.current.get(name);
          if (mesh) selectedMeshes.push(mesh);
        }
      }
      if (selectedMeshes.length > 0) {
        // Compute bbox from selected meshes' vertices (in PolyBoard Z-up coords)
        const boxes = selectedMeshes.map(m => {
          const pos = m.geometry.getAttribute('position');
          return computeBoundingBox(pos.array as Float32Array);
        });
        targetBbox = mergeBoundingBoxes(boxes);
      } else {
        targetBbox = getOverallBbox();
      }
    } else {
      targetBbox = getOverallBbox();
    }

    function getOverallBbox() {
      const boxes = model!.objects.map(o => computeBoundingBox(o.vertices));
      return mergeBoundingBoxes(boxes);
    }

    const size = {
      x: targetBbox.max.x - targetBbox.min.x,
      y: targetBbox.max.y - targetBbox.min.y,
      z: targetBbox.max.z - targetBbox.min.z,
    };
    const maxDim = Math.max(size.x, size.y, size.z);
    const pad = maxDim * 0.12;

    // Width (X) - RED - along bottom edge, offset in -Y direction (PolyBoard coords)
    if (size.x > 1) {
      dimGroup.add(createDimLine3D(
        new THREE.Vector3(targetBbox.min.x, targetBbox.min.y, targetBbox.min.z),
        new THREE.Vector3(targetBbox.max.x, targetBbox.min.y, targetBbox.min.z),
        new THREE.Vector3(0, -pad, 0),
        0xE63946,
        `${Math.round(size.x)}`,
        maxDim,
      ));
    }

    // Depth (Y) - GREEN - along bottom edge, offset in -X direction
    if (size.y > 1) {
      dimGroup.add(createDimLine3D(
        new THREE.Vector3(targetBbox.min.x, targetBbox.min.y, targetBbox.min.z),
        new THREE.Vector3(targetBbox.min.x, targetBbox.max.y, targetBbox.min.z),
        new THREE.Vector3(-pad, 0, 0),
        0x16A34A,
        `${Math.round(size.y)}`,
        maxDim,
      ));
    }

    // Height (Z) - BLUE - along left edge, offset in -X and -Y direction
    if (size.z > 1) {
      dimGroup.add(createDimLine3D(
        new THREE.Vector3(targetBbox.min.x, targetBbox.min.y, targetBbox.min.z),
        new THREE.Vector3(targetBbox.min.x, targetBbox.min.y, targetBbox.max.z),
        new THREE.Vector3(-pad * 0.7, -pad * 0.7, 0),
        0x2563EB,
        `${Math.round(size.z)}`,
        maxDim,
      ));
    }

    rootGroup.add(dimGroup);
    dimGroupRef.current = dimGroup;
  }, [viewerState.showDimensions, viewerState.selectedPartId, dimensions, model, partTree]);

  // ============================================================================
  // RAYCAST CLICK HANDLER
  // ============================================================================

  const handleClick = useCallback((e: MouseEvent) => {
    const camera = cameraRef.current;
    const canvas = rendererRef.current?.domElement;
    if (!camera || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const allMeshes = Array.from(meshMapRef.current.values());
    const hits = raycaster.intersectObjects(allMeshes);

    // If measure tool is active, handle click for measurement
    if (measureTool?.isActive) {
      if (hits.length > 0) {
        measureTool.handleClick(hits[0].point);
      }
      return; // Don't do normal part selection
    }

    if (hits.length > 0) {
      const hitMesh = hits[0].object;
      onPartSelect(hitMesh.userData.partName);
    } else {
      onPartSelect(null);
    }
  }, [onPartSelect, measureTool]);

  // ============================================================================
  // DIMENSION LINE HELPERS
  // ============================================================================

  function createDimLine3D(
    from: THREE.Vector3,
    to: THREE.Vector3,
    offset: THREE.Vector3,
    color: number,
    label: string,
    _modelMaxDim: number,
  ): THREE.Group {
    const group = new THREE.Group();
    const offDir = offset.clone().normalize();
    const p1 = from.clone().add(offset);
    const p2 = to.clone().add(offset);
    const lineMat = new THREE.LineBasicMaterial({ color, toneMapped: false });

    // Main dimension line
    const mainGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    group.add(new THREE.Line(mainGeom, lineMat));

    // Extension lines (from near model edge to dimension line)
    const extStart = 8; // gap from model
    const extEnd = 6;   // overshoot past dim line

    const ext1Start = from.clone().add(offDir.clone().multiplyScalar(extStart));
    const ext1End = p1.clone().add(offDir.clone().multiplyScalar(extEnd));
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([ext1Start, ext1End]),
      lineMat,
    ));

    const ext2Start = to.clone().add(offDir.clone().multiplyScalar(extStart));
    const ext2End = p2.clone().add(offDir.clone().multiplyScalar(extEnd));
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([ext2Start, ext2End]),
      lineMat,
    ));

    // Tick marks at dimension line endpoints (along p1→p2 direction)
    const dimDir = new THREE.Vector3().subVectors(p2, p1).normalize();
    const tickSize = 10;
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        p1.clone().addScaledVector(dimDir, -tickSize),
        p1.clone().addScaledVector(dimDir, tickSize),
      ]),
      lineMat,
    ));
    group.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        p2.clone().addScaledVector(dimDir, -tickSize),
        p2.clone().addScaledVector(dimDir, tickSize),
      ]),
      lineMat,
    ));

    // Text sprite at midpoint
    const mid = p1.clone().add(p2).multiplyScalar(0.5).add(offDir.clone().multiplyScalar(14));
    const sprite = makeTextSprite3D(label, color);
    sprite.position.copy(mid);
    sprite.renderOrder = 999;
    const dir = new THREE.Vector3().subVectors(to, from);
    const ss = Math.max(60, Math.min(120, dir.length() * 0.15));
    sprite.scale.set(ss * 2.5, ss * 0.625, 1); // world-space, matches 4:1 canvas aspect
    group.add(sprite);

    return group;
  }

  function makeTextSprite3D(text: string, color: number): THREE.Sprite {
    // High-DPI canvas that fills its entire area — no wasted transparent pixels
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    const hex = '#' + (color & 0xFFFFFF).toString(16).padStart(6, '0');
    const cw = canvas.width, ch = canvas.height;

    // Fill entire canvas with white rounded rect
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(2, 2, cw - 4, ch - 4, 8);
    ctx.fill();

    // Coloured border
    ctx.strokeStyle = hex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(2, 2, cw - 4, ch - 4, 8);
    ctx.stroke();

    // Bold text filling most of the canvas height
    const fontFace = "'ISOCPEUR', 'Courier New', monospace";
    ctx.font = `bold 42px ${fontFace}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Dark outline for extra crispness
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 5;
    ctx.strokeText(text, cw / 2, ch / 2);

    // Solid colour fill
    ctx.fillStyle = hex;
    ctx.fillText(text, cw / 2, ch / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter; // prevent mipmap blurring

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      toneMapped: false, // CRITICAL: bypass ACES tone mapping that washes out colours
      depthTest: false,
      depthWrite: false,
    });

    return new THREE.Sprite(spriteMat);
  }

  return (
    <div
      ref={canvasRef}
      className="w-full h-full relative"
      style={{ minHeight: 400 }}
    />
  );
}
