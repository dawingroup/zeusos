/**
 * SceneWorkspacePage — Full scene composition workspace
 *
 * Four-region layout:
 *   [CabinetRoster] [Viewport/Layout (+ RightDrawer overlay)] [CabinetDetailPanel?] [DrawerTriggerBar]
 *
 * The right-edge DrawerTriggerBar + RightDrawer mirror Quick Review so users
 * can reach Parts / Cut List / Dimensions / Assemblies / AI / Materials etc.
 * from inside a scene. Per-cabinet panels are scoped to the currently-selected
 * cabinet's parsed GLB (via `useCabinetParsedModel`); scene-global panels
 * (KB, Export PDF, Cabinet-detection help) are always enabled.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks/useAuth';
import { useScene } from '../hooks/useScene';
import { useSceneSelection } from '../hooks/useSceneSelection';
import { useCabinetParsedModel } from '../hooks/useCabinetParsedModel';
import { usePartSelection } from '../hooks/usePartSelection';
import { useAssemblyGroups } from '../hooks/useAssemblyGroups';
import { useMaterialResolver } from '../hooks/useMaterialResolver';
import { useMaterialSwap } from '../hooks/useMaterialSwap';
import { usePartRecognition } from '../hooks/usePartRecognition';
import { useMeasureTool } from '../hooks/useMeasureTool';
import { buildMeshCutListLinks, buildPartTree } from '../services/assemblyEngine';
import { computeDimensions } from '../services/dimensionEngine';
import { updateScene } from '../services/scene.service';
import { convertAutoToManaged, mergeDimensions } from '../services/dimensionManager';
import { CabinetRoster } from '../components/scene/CabinetRoster';
import { SceneWorkspaceBreadcrumb } from '../components/scene/SceneWorkspaceBreadcrumb';
import { AutoFramingViewport } from '../components/scene/AutoFramingViewport';
import { CabinetDetailPanel } from '../components/scene/CabinetDetailPanel';
import { SceneStatusBar } from '../components/scene/SceneStatusBar';
import { SceneLayoutEditor } from '../components/scene/SceneLayoutEditor';
import { AddCabinetDialog } from '../components/scene/AddCabinetDialog';
import { BulkCabinetImportDialog } from '../components/scene/BulkCabinetImportDialog';
import { AddCabinetChooser } from '../components/scene/AddCabinetChooser';
import { SelectionModeToggle } from '../components/scene/SelectionModeToggle';
import { PositioningPanel } from '../components/scene/PositioningPanel';
import { ContextMenu } from '../components/scene/ContextMenu';
import { RotateDialog } from '../components/scene/RotateDialog';
import { NudgePad, type NudgeStep } from '../components/scene/NudgePad';
import { SceneContextCard } from '../components/scene/SceneContextCard';
import { SceneFilesPanel } from '../components/scene/SceneFilesPanel';
import { SceneProductionPanel } from '../components/scene/SceneProductionPanel';
import type { SceneViewportRefs } from '../components/scene/SceneViewport';
import DesignItemMetadataPanel from '../components/DesignItemMetadataPanel';
import RenderPanel from '../components/RenderPanel';
import { useRenderCapture } from '../hooks/useRenderCapture';
import {
  applyPresetToScene,
  captureViewport,
  type RenderPreset,
} from '../services/renderPresetService';
import { useContextMenu } from '../hooks/useContextMenu';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useCabinetGroup } from '../hooks/useCabinetGroup';
import { useInputAdapter } from '../hooks/useInputAdapter';
import { useCommandStack } from '../hooks/useCommandStack';
import {
  snapshot as cabinetSnapshot,
  positionCommand,
  createGroupCommand,
  ungroupCommand,
} from '../services/alignmentCommands';
import type { CabinetPosition } from '../types/scene.types';
import { IsolationToggle } from '../components/scene/IsolationToggle';
import { ProjectPDFExportDialog } from '../components/scene/ProjectPDFExportDialog';
import { ReleaseToProductionDialog } from '../components/scene/ReleaseToProductionDialog';
import { useSceneDesignItems } from '../hooks/useSceneDesignItems';
import DrawerTriggerBar, { type DrawerPanel } from '../components/DrawerTriggerBar';
import RightDrawer from '../components/RightDrawer';
import PartTree from '../components/PartTree';
import CutListTable from '../components/CutListTable';
import { DimensionReviewPanel } from '../components/DimensionReviewPanel';
import { PartDetailPanel } from '../components/scene/PartDetailPanel';
import type { ScenePart } from '../types/assembly.types';
import type { SceneCabinet } from '../types/scene.types';
import { useMeshBboxes } from '../hooks/useMeshBboxes';
import { useScenePartModeMeshBboxIndex } from '../hooks/useScenePartModeMeshBboxes';
import { usePartInventoryResolver } from '../hooks/usePartInventoryResolver';
import { useAutoPartsSync } from '../hooks/useAutoPartsSync';
import { sceneAssembliesToGroups } from '../services/scenePrintPackage.service';
import {
  assemblyGroupsToSceneAssemblies,
  saveCabinetAssemblies,
} from '../services/assemblyGroupsPersistence';
import type { PartTreeNode } from '../types/workshop-viewer.types';
import {
  expandMeshNeedles,
  findPartTreeNodeIdByMeshNeedles,
} from '../utils/findPartTreeNodeIdByMeshNeedles';
import AssemblyReviewPanel from '../components/AssemblyReviewPanel';
import AIGroupingTrigger from '../components/AIGroupingTrigger';
import PartRecognitionPanel from '../components/PartRecognitionPanel';
import MaterialPanel from '../components/MaterialPanel';
import { KBBrowser } from '../components/kb/KBBrowser';
import type { AddCabinetInput } from '../schemas/scene.schemas';
import type { MeshClickPayload } from '../hooks/useSceneViewport';
import type {
  ManagedDimension,
  DimensionOverrides,
} from '../types/dimension.types';
import type { ProjectContext } from '../types/workshop-viewer.types';

type ViewTab = '3d' | 'layout';

// Empty-state pill used by every drawer panel that needs a cabinet selection
function DrawerEmptyState({ text }: { text: string }) {
  return (
    <div className="p-4 text-xs text-gray-500 text-center leading-relaxed">
      {text}
    </div>
  );
}

export default function SceneWorkspacePage() {
  const { sceneId } = useParams<{ sceneId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    scene,
    cabinets,
    isLoading,
    error,
    addCabinet,
    duplicate,
    removeCabinet,
    moveCabinet,
    refetch,
  } = useScene(sceneId ?? null, { includeFullCabinets: true });

  // P4.1: debounced auto-sync from Scene -> Design Manager when cabinet
  // assemblies change. Best-effort background behavior; users can still
  // run explicit sync from the Files drawer.
  const autoPartsSync = useAutoPartsSync({
    sceneId: sceneId ?? undefined,
    cabinets,
    userId: user?.uid,
    debounceMs: 3000,
    disabled: isLoading,
  });

  const latestAutoSync = useMemo(() => {
    let latest: { synced: number; at: Date } | null = null;
    for (const value of autoPartsSync.lastResults.values()) {
      if (!latest || value.at.getTime() > latest.at.getTime()) latest = value;
    }
    return latest;
  }, [autoPartsSync.lastResults]);

  const {
    selection,
    setMode,
    select,
    selectRange,
    isolate,
    unisolate,
    selectedId,
    selectedIds,
  } = useSceneSelection();

  const [viewTab, setViewTab] = useState<ViewTab>('3d');
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);
  const [showRosterSheet, setShowRosterSheet] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  // P3: release-to-production dialog targets a single DesignItem group.
  const [releaseDesignItemId, setReleaseDesignItemId] = useState<string | null>(null);

  // Hydrate DesignItem metadata so the release dialog can render name + code
  // without re-fetching. Same cache the roster uses.
  const { byId: designItemsById } = useSceneDesignItems(scene?.projectId, cabinets);

  const releaseGroupCabinets = releaseDesignItemId
    ? cabinets.filter(c => c.designItemId === releaseDesignItemId)
    : [];
  const releaseDesignItem = releaseDesignItemId
    ? designItemsById.get(releaseDesignItemId) ?? null
    : null;

  // ─── Drawer state ────────────────────────────────────────────────────────
  const [drawerPanel, setDrawerPanel] = useState<DrawerPanel>(null);
  const [filesFocusSyncSignal, setFilesFocusSyncSignal] = useState(0);

  // Derive the currently-selected cabinet from the hydrated scene cabinets
  // array. This keeps drawer panels consistent with optimistic position/
  // rotation updates that useScene.moveCabinet applies locally.
  const selectedCabinet = useMemo(
    () => (selectedId ? cabinets.find(c => c.id === selectedId) ?? null : null),
    [cabinets, selectedId],
  );

  // Load the selected cabinet's GLB and produce a ParsedModel. The hook has
  // a module-level URL cache, so simultaneous use here and inside
  // CabinetDetailPanel does not double-fetch.
  const {
    parsedModel,
    isLoading: isModelLoading,
    error: modelError,
  } = useCabinetParsedModel(sceneId ?? null, selectedCabinet);

  // Derivations Quick Review gets from useModelParser. Scene cabinets don't
  // ship with a CSV cut list, so `cutList` is always empty — buildPartTree
  // still returns a valid mesh-only tree.
  const partTreeDerived = useMemo(() => {
    if (!parsedModel) return [];
    return buildPartTree(parsedModel, [], []);
  }, [parsedModel]);

  const meshLinks = useMemo(() => {
    if (!parsedModel) return [];
    return buildMeshCutListLinks(parsedModel, []);
  }, [parsedModel]);

  // Cabinet that owns the currently selected ScenePart (may differ from the
  // roster `selectedId` when the user picked a part in another cabinet).
  const partInspectorCabinet = useMemo(() => {
    if (selection.mode !== 'part') return null;
    const id = selection.selectedIds[0];
    if (!id) return null;
    for (const cab of cabinets) {
      for (const asm of cab.assemblies ?? []) {
        if ((asm.parts ?? []).some(p => p.id === id)) return cab;
      }
    }
    return null;
  }, [selection.mode, selection.selectedIds, cabinets]);

  const loadPartInspectorGlb = Boolean(
    partInspectorCabinet
    && selectedCabinet
    && partInspectorCabinet.id !== selectedCabinet.id,
  );
  const { parsedModel: partInspectorParsedModel } = useCabinetParsedModel(
    sceneId ?? null,
    loadPartInspectorGlb ? partInspectorCabinet : null,
  );
  const meshBboxesForPartPanel = useMeshBboxes(
    loadPartInspectorGlb ? partInspectorParsedModel : parsedModel,
  );

  const getPartModeMeshBbox = useScenePartModeMeshBboxIndex(
    sceneId ?? null,
    cabinets,
    selection.mode === 'part',
  );

  // Resolve the scene's currently-selected part id into a ScenePart so
  // the Part Detail panel + the hardware resolver share one lookup.
  // Walks every cabinet, not just the selected one, so a user who
  // clicked a mesh in a different cabinet still lands on its detail.
  const selectedPartForPanel = useMemo(() => {
    if (selection.mode !== 'part') return null;
    const id = selection.selectedIds[0];
    if (!id) return null;
    for (const cab of cabinets) {
      for (const asm of cab.assemblies ?? []) {
        const p = (asm.parts ?? []).find(pt => pt.id === id);
        if (p) return p;
      }
    }
    return null;
  }, [selection.mode, selection.selectedIds, cabinets]);

  // Lazy Materials-library resolver scoped to the selected part's
  // boringSpec hardware references. Fires zero reads when the part
  // has no inventory links; memoised across re-selections of the
  // same part.
  const partInventoryResolver = usePartInventoryResolver(selectedPartForPanel);

  const dimensionSet = useMemo(
    () => (parsedModel ? computeDimensions(parsedModel) : null),
    [parsedModel],
  );

  // Per-cabinet dimension state (persisted in-memory; the scene model doesn't
  // store user dimensions yet — parity with Quick Review's initial shape).
  const [userDimensions, setUserDimensions] = useState<ManagedDimension[]>([]);
  const [dimensionOverrides, setDimensionOverrides] = useState<DimensionOverrides>({});
  const [selectedDimId, setSelectedDimId] = useState<string | null>(null);

  // Reset per-cabinet dimension state whenever the selection changes.
  useEffect(() => {
    setUserDimensions([]);
    setDimensionOverrides({});
    setSelectedDimId(null);
  }, [selectedCabinet?.id]);

  const managedDimensions = useMemo(
    () =>
      mergeDimensions(
        convertAutoToManaged(dimensionSet),
        userDimensions,
        dimensionOverrides,
      ),
    [dimensionSet, userDimensions, dimensionOverrides],
  );

  // Quick-Review-compatible selection/assemblies/materials hooks, bound to
  // the selected cabinet's parsed model.
  const {
    selectedPartId,
    expandedIds,
    selectNodeById,
    toggleExpand,
    toggleExplode,
    clearSelection,
    getSelectedNode,
  } = usePartSelection(partTreeDerived);

  const selectedPartNode = getSelectedNode();
  const selectedPartMeshNeedles = useMemo(() => {
    const base = selectedPartNode?.meshObjectNames ?? [];
    const fromPanel = selectedPartForPanel?.meshNodeId ? [selectedPartForPanel.meshNodeId] : [];
    return [...new Set([...base, ...fromPanel])];
  }, [selectedPartNode, selectedPartForPanel?.meshNodeId]);

  const selectedCabinetIdForViewport = useMemo(() => {
    if (selection.mode === 'cabinet') return selectedId ?? undefined;
    if (selection.mode === 'part') return partInspectorCabinet?.id ?? selectedCabinet?.id ?? undefined;
    if (selection.mode === 'assembly') {
      const assemblyId = selectedId;
      if (!assemblyId) return undefined;
      for (const cab of cabinets) {
        if ((cab.assemblies ?? []).some(a => a.id === assemblyId)) return cab.id;
      }
      return undefined;
    }
    return selectedCabinet?.id ?? undefined;
  }, [selection.mode, selectedId, partInspectorCabinet?.id, selectedCabinet?.id, cabinets]);

  // Hydrate the assembly-review state from the cabinet's PERSISTED
  // assemblies when available, so the drag-and-drop reorganisation
  // a user did earlier doesn't vanish on page reload — and flows
  // through to PDF generation (which reads cabinet.assemblies via
  // sceneAssembliesToGroups).
  const hydrateAssemblies = useCallback((tree: PartTreeNode[]) => {
    if (!selectedCabinet?.assemblies?.length) return null;
    return sceneAssembliesToGroups(selectedCabinet.assemblies, tree);
  }, [selectedCabinet?.assemblies]);

  const {
    groups: assemblyGroups,
    isConfirmed: groupsConfirmed,
    movePart,
    confirmGroups: confirmGroupsLocal,
    resetGroups,
  } = useAssemblyGroups(partTreeDerived, hydrateAssemblies);

  // Wrap confirmGroups so Confirm ALSO persists the rearrangement
  // onto the cabinet doc — without this, PDF generation (and every
  // other downstream consumer that reads cabinet.assemblies) kept
  // seeing the pre-edit state.
  const [assemblySaveError, setAssemblySaveError] = useState<string | null>(null);
  const confirmGroups = useCallback(async () => {
    confirmGroupsLocal();
    if (!sceneId || !selectedCabinet) return;
    setAssemblySaveError(null);
    try {
      const next = assemblyGroupsToSceneAssemblies(
        assemblyGroups, partTreeDerived, selectedCabinet,
      );
      await saveCabinetAssemblies(sceneId, selectedCabinet.id, next);
      await refetch();  // re-pull so downstream panels see the new shape
    } catch (e) {
      setAssemblySaveError((e as Error).message || 'Failed to save assemblies');
    }
  }, [
    confirmGroupsLocal, sceneId, selectedCabinet, assemblyGroups,
    partTreeDerived, refetch,
  ]);

  const { mappings: materialMappings } = useMaterialResolver(parsedModel);
  const materialSwap = useMaterialSwap();

  // Render drawer — live refs to the Three.js viewport plus the capture
  // hook's state machine. `onViewportReady` from AutoFramingViewport
  // fires whenever the scene/camera/renderer triple changes (camera
  // projection swap, unmount); we stash them in a ref for the capture
  // handler rather than state to avoid re-rendering the tree when
  // Three.js swaps cameras.
  const viewportRefsRef = useRef<SceneViewportRefs | null>(null);
  const [activeRenderPresetId, setActiveRenderPresetId] = useState<string | null>(null);
  const renderCapture = useRenderCapture();
  const handleViewportReady = useCallback((refs: SceneViewportRefs | null) => {
    viewportRefsRef.current = refs;
  }, []);
  const handleSelectRenderPreset = useCallback((preset: RenderPreset) => {
    setActiveRenderPresetId(preset.id);
    const refs = viewportRefsRef.current;
    // applyPresetToScene + captureViewport are PerspectiveCamera-specific.
    // Scene only swaps to orthographic when the user explicitly picks the
    // ortho preset; render work only runs from a perspective vantage.
    if (refs && 'isPerspectiveCamera' in refs.camera && refs.camera.isPerspectiveCamera) {
      applyPresetToScene(refs.scene, refs.camera, preset);
    }
  }, []);
  const handleCaptureRender = useCallback(async ({ scale, watermark }: { scale: number; watermark: boolean }) => {
    const refs = viewportRefsRef.current;
    if (!refs || !('isPerspectiveCamera' in refs.camera) || !refs.camera.isPerspectiveCamera) {
      console.warn('[SceneRender] capture skipped — need a perspective camera');
      return;
    }
    try {
      const blob = await captureViewport(refs.renderer, refs.scene, refs.camera, { scale });
      if (blob) {
        renderCapture.setCapturedImage(blob, watermark ? 'DawinOS · Design Studio' : undefined);
      }
    } catch (err) {
      console.warn('[SceneRender] capture failed:', err);
    }
  }, [renderCapture]);

  // ── Material-override persistence (hydrate + debounced save) ──────────
  // Two independent effects that compose cleanly without extra non-effect
  // hooks — important so useMaterialSwap's own hook count stays untouched.
  //
  // Hydrate: when a scene loads and it carries `materialOverrides`, seed
  // the swatch map once. Keyed on scene.id so switching scenes re-seeds.
  const hydratedSceneRef = useRef<string | null>(null);
  useEffect(() => {
    if (!scene) return;
    if (hydratedSceneRef.current === scene.id) return;
    hydratedSceneRef.current = scene.id;
    const stored = scene.materialOverrides;
    if (stored && Object.keys(stored).length > 0) {
      materialSwap.setAllOverrides(stored);
    } else {
      materialSwap.setAllOverrides({});
    }
  }, [scene, materialSwap]);
  // Persist: debounced write when the override map changes, but only
  // after hydration has run (otherwise we'd overwrite stored data with
  // our initial empty map).
  useEffect(() => {
    if (!sceneId) return;
    if (hydratedSceneRef.current !== sceneId) return;
    const snapshot = Object.fromEntries(materialSwap.overrides);
    const handle = window.setTimeout(() => {
      updateScene(sceneId, { materialOverrides: snapshot })
        .catch(err => console.warn('[SceneWorkspace] failed to persist material overrides:', err));
    }, 600);
    return () => window.clearTimeout(handle);
  }, [materialSwap.overrides, sceneId]);

  // Scene → ProjectContext shim so PartRecognitionPanel can write into the
  // scene's project. The scene doc carries `projectId` (and typically a
  // customer). designItemId is not meaningful at scene level; leave empty.
  const projectContext = useMemo<ProjectContext | null>(() => {
    if (!scene) return null;
    return {
      source: 'standalone',
      projectId: scene.projectId ?? '',
      projectName: scene.name ?? '',
      projectCode: '',
      clientName: '',
      clientAddress: '',
      stage: '',
    };
  }, [scene]);

  const partRecognition = usePartRecognition(parsedModel, projectContext);

  // Item Metadata panel context — a richer ProjectContext derived from the
  // selected cabinet's DesignItem link. `DesignItemMetadataPanel` reads
  // designItemId/Name/Stage + projectName/Code + rollupSummary; everything
  // else is optional and the panel handles missing fields gracefully.
  const itemMetadataContext = useMemo<ProjectContext | null>(() => {
    if (!scene || !selectedCabinet?.designItemId) return null;
    const item = designItemsById.get(selectedCabinet.designItemId);
    if (!item) return null;
    const rollup = item.manufacturingRollup;
    return {
      source: 'design-project',
      projectId: scene.projectId ?? '',
      projectName: scene.name ?? '',
      projectCode: item.projectCode ?? '',
      clientName: '',
      clientAddress: '',
      stage: item.currentStage ?? '',
      designItemId: item.id,
      designItemName: item.name,
      designItemStage: item.currentStage,
      rollupSummary: rollup
        ? {
            cabinetCount: rollup.cabinetCount ?? 0,
            lockedCabinetCount: rollup.lockedCabinetCount ?? 0,
          }
        : undefined,
    };
  }, [scene, selectedCabinet, designItemsById]);

  // measureTool is created for parity; its click pipeline is wired in
  // WorkshopViewer's ThreeViewport only, so in scene view it toggles a
  // mode but won't capture picks until AutoFramingViewport is extended
  // to forward pointer events to it. The button still lives in the UI.
  const measureTool = useMeasureTool(parsedModel);

  // Cabinet Alignment System — groups must be resolved BEFORE
  // `handleCabinetSelect` so its dependency array can reference
  // `siblingIds` without hitting a temporal-dead-zone error in
  // production (minifier hoisting can make this visible). Keep the
  // rest of the alignment state (context menu, rotate target,
  // commands, input adapter) near the bottom — those are only read
  // by handlers that don't close over each other.
  const { groupOf, siblingIds, createGroup, ungroup: ungroupGroup } =
    useCabinetGroup(sceneId ?? null);

  const handleCabinetSelect = useCallback((cabinetId: string) => {
    // Auto-expand to the whole group when a member is clicked. Matches
    // PolyBoard's Group Mode behaviour — selecting any member selects
    // the whole run. Single-cabinet picks (ungrouped) still work as
    // before because `siblingIds` returns `[cabinetId]` for a cabinet
    // with no groupId.
    const siblings = siblingIds(cabinetId);
    if (siblings.length > 1) selectRange(siblings);
    else select(cabinetId);
    setShowRosterSheet(false);
    setShowDetailSheet(false);
  }, [select, selectRange, siblingIds]);

  // assembly/part mode → resolve the hit mesh to an assembly or part within the
  // cabinet it belongs to. If assembly data isn't loaded yet (assemblies array
  // empty), fall back to cabinet-level selection so the user still gets feedback.
  const handleMeshClick = useCallback((payload: MeshClickPayload) => {
    const { cabinetId, meshId, meshName } = payload;
    const cabinet = cabinets.find(c => c.id === cabinetId);
    if (!cabinet) return;

    // Normalise a mesh-name-or-id into the form we store on
    // ScenePart.meshNodeId so the match works even when GLTF
    // sanitisation has mangled whitespace / case between export
    // and viewer load.
    const needles = expandMeshNeedles(meshId, meshName);

    if (selection.mode === 'assembly') {
      const assemblies = cabinet.assemblies ?? [];
      const hit = assemblies.find(a =>
        (a.meshNodeIds ?? []).some(id =>
          needles.has(id) || needles.has(id.trim().toLowerCase().replace(/\s+/g, '_')),
        ),
      );
      if (hit) {
        select(hit.id);
      } else {
        select(cabinetId);
      }
      return;
    }

    if (selection.mode === 'part') {
      const assemblies = cabinet.assemblies ?? [];
      let hitPartId: string | undefined;
      // Strategy 1: exact meshNodeId match.
      // Strategy 2: normalised match (trim + lowercase + whitespace→_)
      //   — handles GLTF name sanitisation drift between export and
      //   viewer load which was silently dropping clicks before.
      for (const a of assemblies) {
        for (const pt of a.parts ?? []) {
          const mn = pt.meshNodeId;
          if (!mn) continue;
          if (needles.has(mn) || needles.has(mn.trim().toLowerCase().replace(/\s+/g, '_'))) {
            hitPartId = pt.id;
            break;
          }
        }
        if (hitPartId) break;
      }
      // Strategy 3: bbox fallback. When name matching produced nothing
      // but the raycaster gave us a world-space hit point, pick the
      // ScenePart whose parsed-model bbox (via useMeshBboxes) contains
      // the click. Catches cases where mesh-name identifiers diverged
      // entirely between viewer GLB and the stored ScenePart data.
      if (!hitPartId && payload.worldPoint) {
        const p = payload.worldPoint;
        for (const a of assemblies) {
          for (const pt of a.parts ?? []) {
            if (!pt.meshNodeId) continue;
            const bb = getPartModeMeshBbox(cabinetId, pt.meshNodeId);
            if (!bb) continue;
            if (
              p.x >= bb.min.x && p.x <= bb.max.x
              && p.y >= bb.min.y && p.y <= bb.max.y
              && p.z >= bb.min.z && p.z <= bb.max.z
            ) {
              hitPartId = pt.id;
              break;
            }
          }
          if (hitPartId) break;
        }
      }
      if (hitPartId) {
        select(hitPartId);
        // Keep the scene-side part-tree selection in sync with viewport picks
        // for the currently loaded cabinet model. This mirrors Quick Review:
        // clicked mesh -> highlighted tree node -> consistent dim context.
        if (selectedCabinet?.id === cabinetId && partTreeDerived.length > 0) {
          const treeNodeId = findPartTreeNodeIdByMeshNeedles(partTreeDerived, needles);
          if (treeNodeId) {
            selectNodeById(treeNodeId);
          }
        }
        // Auto-open the Part Detail drawer when the user actually hits
        // a part — matches Quick View's "click a part → see the spec
        // on the right" flow. Skip when the drawer already shows a
        // per-part view (parts tree, cut list, dims) so we don't yank
        // the user away from what they just opened.
        setDrawerPanel(prev => (prev === null || prev === 'context' || prev === 'itemMeta')
          ? 'part'
          : prev);
      } else {
        // Fallback: when ScenePart records are missing / stale, still allow
        // part picking from the currently loaded cabinet model via PartTree.
        const fallbackNodeId = selectedCabinet?.id === cabinetId
          ? findPartTreeNodeIdByMeshNeedles(partTreeDerived, needles)
          : null;
        if (fallbackNodeId) {
          selectNodeById(fallbackNodeId);
          setDrawerPanel(prev => (prev === null || prev === 'context' || prev === 'itemMeta')
            ? 'parts'
            : prev);
          return;
        }
        // Diagnostic — scene has parts but the click didn't map to one.
        // Common cause: cabinet.assemblies is empty (not AI-grouped yet)
        // or the mesh name in the GLB diverged from the stored meshNodeId.
        const hasAnyParts = (cabinet.assemblies ?? []).some(a => (a.parts ?? []).length > 0);
        if (hasAnyParts) {
          console.warn(
            '[scene] part-mode click didn\'t resolve to any ScenePart. ' +
            'Mesh ids stored on parts may have drifted from the loaded GLB.',
            { meshId, meshName, cabinet: cabinet.cabinetCode },
          );
        }
        clearSelection();
        select(cabinetId);
      }
      return;
    }

    select(cabinetId);
  }, [
    cabinets,
    selection.mode,
    select,
    getPartModeMeshBbox,
    selectedCabinet?.id,
    partTreeDerived,
    selectNodeById,
    clearSelection,
  ]);

  const handleAddCabinet = useCallback(async (input: AddCabinetInput) => {
    await addCabinet(input);
  }, [addCabinet]);

  const handleDuplicate = useCallback(async (cabinetId: string) => {
    await duplicate(cabinetId);
  }, [duplicate]);

  const handleRemove = useCallback(async (cabinetId: string) => {
    await removeCabinet(cabinetId);
    if (selectedId === cabinetId) {
      select(cabinets[0]?.id ?? '');
    }
  }, [removeCabinet, selectedId, cabinets, select]);

  // ─── Cabinet Alignment System — context menu + shortcuts + groups ───────
  // Group hook is hoisted above `handleCabinetSelect` (see earlier in this
  // component) because its `siblingIds` is read by that callback's dep array.
  const contextMenu = useContextMenu();
  const [rotateTargetIds, setRotateTargetIds] = useState<string[] | null>(null);

  // Touch / pointer adapter. Provides:
  //  - `isTouchDevice` → drives the NudgePad's visibility
  //  - `isMultiTouch`  → surfaced globally as window.__sceneMultiTouch
  //    so `useCabinetGizmo` can read it as the touch equivalent of Alt
  //    (bypass snap). We use a module-global flag rather than threading
  //    a prop through `AutoFramingViewport → useSceneViewport → gizmo`
  //    because the gizmo polls the flag every drag tick; propagating
  //    React state that fast would force re-renders.
  //  - `bindLongPress` → props spread onto the viewport container so
  //    touch long-press opens the context menu.
  const handleLongPress = useCallback(({ clientX, clientY }: { clientX: number; clientY: number }) => {
    if (selectedIds.length === 0) return;
    contextMenu.open(clientX, clientY, selectedIds);
  }, [contextMenu, selectedIds]);
  const input = useInputAdapter({ onLongPress: handleLongPress });
  const [nudgeStep, setNudgeStep] = useState<NudgeStep>('default');
  // Gizmo mode lifted here so the keyboard shortcut hook + the
  // GizmoModeToggle pill inside AutoFramingViewport both drive the same
  // state without a bi-directional prop dance.
  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate'>('translate');

  // Bridge isMultiTouch → window flag consumed by useCabinetGizmo. The
  // gizmo's keydown listener already toggles a local Alt flag; we now
  // push the same bypass signal from touch by flipping this sentinel.
  useEffect(() => {
    (window as unknown as { __sceneMultiTouch?: boolean }).__sceneMultiTouch = input.isMultiTouch;
  }, [input.isMultiTouch]);

  // Undo/redo command stack. Keyboard shortcuts (Cmd/Ctrl+Z,
  // Shift+Cmd/Ctrl+Z, Ctrl+Y) are bound inside the hook.
  const commands = useCommandStack(!isLoading);

  // Raw group-aware move (no command recording). Commits position /
  // rotation / mirror; if the cabinet belongs to a group, every
  // sibling moves by the same delta. Callers that want undo/redo
  // should use `recordedMove` below, which snapshots before + after
  // and pushes an AlignmentCommand.
  const applyMoveRaw = useCallback(
    async (cabinetId: string, position: CabinetPosition, rotation?: number) => {
      const group = groupOf(cabinetId);
      const current = cabinets.find(c => c.id === cabinetId);
      if (!group || !current) {
        await moveCabinet(cabinetId, position, rotation);
        return;
      }
      const delta = {
        x: (position.x ?? 0) - (current.position?.x ?? 0),
        y: (position.y ?? 0) - (current.position?.y ?? 0),
        z: (position.z ?? 0) - (current.position?.z ?? 0),
      };
      await moveCabinet(cabinetId, position, rotation);
      const siblings = group.cabinetIds
        .map(id => cabinets.find(c => c.id === id))
        .filter((c): c is NonNullable<typeof c> => !!c && c.id !== cabinetId);
      await Promise.all(siblings.map(s => {
        const next: CabinetPosition = {
          ...(s.position ?? { x: 0, y: 0, z: 0 }),
          x: (s.position?.x ?? 0) + delta.x,
          y: (s.position?.y ?? 0) + delta.y,
          z: (s.position?.z ?? 0) + delta.z,
        };
        return moveCabinet(s.id, next, s.rotation);
      }));
    }, [cabinets, groupOf, moveCabinet],
  );

  // Command-recording wrapper. Snapshots before + after per-cabinet
  // state so undo reverses the same set of writes the forward call
  // produced. The snapshot is captured *synchronously* from the
  // current `cabinets` array (still holds pre-mutation values at
  // call time — optimistic updates happen inside moveCabinet).
  const moveCabinetGroupAware = useCallback(
    async (cabinetId: string, position: CabinetPosition, rotation?: number) => {
      const group = groupOf(cabinetId);
      const affectedIds = group ? group.cabinetIds : [cabinetId];
      const before = cabinets
        .filter(c => affectedIds.includes(c.id))
        .map(cabinetSnapshot);

      await applyMoveRaw(cabinetId, position, rotation);

      // Build the "after" snapshot by projecting the delta we just
      // wrote onto the pre-mutation positions — cheaper than another
      // read of the cabinets array (which may not yet reflect the
      // optimistic update at the time this closure runs).
      const delta = {
        x: (position.x ?? 0) - (before.find(s => s.id === cabinetId)?.position.x ?? 0),
        y: (position.y ?? 0) - (before.find(s => s.id === cabinetId)?.position.y ?? 0),
        z: (position.z ?? 0) - (before.find(s => s.id === cabinetId)?.position.z ?? 0),
      };
      const rotationSet = rotation !== undefined;
      const after = before.map(s => {
        if (s.id === cabinetId) {
          return {
            id: s.id,
            position,
            rotation: rotationSet ? rotation : s.rotation,
          };
        }
        return {
          id: s.id,
          position: {
            ...s.position,
            x: s.position.x + delta.x,
            y: s.position.y + delta.y,
            z: s.position.z + delta.z,
          },
          rotation: s.rotation,
        };
      });

      commands.push(positionCommand(before, after, moveCabinet, group ? 'Move group' : 'Move'));
    }, [cabinets, groupOf, applyMoveRaw, moveCabinet, commands],
  );

  // Arrow-key nudging. Disabled while the scene is still loading so keystrokes
  // during initial fetch don't race with state hydration.
  useKeyboardShortcuts({
    enabled: !isLoading,
    cabinets,
    selectedIds,
    onMove: moveCabinetGroupAware,
    onGizmoModeChange: setGizmoMode,
  });

  const handleViewportContextMenu = useCallback((payload: { cabinetId: string; clientX: number; clientY: number }) => {
    const targetInSelection = selectedIds.includes(payload.cabinetId);
    const targets = targetInSelection && selectedIds.length > 1
      ? selectedIds
      : [payload.cabinetId];
    contextMenu.open(payload.clientX, payload.clientY, targets);
  }, [contextMenu, selectedIds]);

  const handleRotateCabinets = useCallback((cabinetIds: string[]) => {
    setRotateTargetIds(cabinetIds);
  }, []);
  const handleRotateCommit = useCallback(async (angleDeg: number) => {
    if (!rotateTargetIds) return;
    const targets = cabinets.filter(c => rotateTargetIds.includes(c.id));
    // Rotate uses the plain moveCabinet (not group-aware) because the
    // rotation is an absolute angle — applying it to every group member
    // individually is the desired semantic. If the selection is a group,
    // every member will already be in `rotateTargetIds` via
    // auto-expand.
    await Promise.all(targets.map(c => moveCabinet(c.id, c.position ?? { x: 0, y: 0, z: 0 }, angleDeg)));
    setRotateTargetIds(null);
  }, [rotateTargetIds, cabinets, moveCabinet]);

  const handleTurnRound = useCallback((cabinetIds: string[]) => {
    const targets = cabinets.filter(c => cabinetIds.includes(c.id));
    // If every target is already mirrored, toggle off; otherwise turn on.
    const allMirrored = targets.length > 0 && targets.every(c => c.position?.mirrored === true);
    const nextMirrored = !allMirrored;
    for (const c of targets) {
      const next = { ...(c.position ?? { x: 0, y: 0, z: 0 }), mirrored: nextMirrored };
      // Mirror is a property of each cabinet — apply per-member, not
      // group-wide-delta. Group membership already expanded the targets.
      moveCabinet(c.id, next, c.rotation).catch(err =>
        console.warn('[SceneWorkspace] turn-round failed:', err),
      );
    }
  }, [cabinets, moveCabinet]);

  const handleGroup = useCallback(async (ids: string[]) => {
    if (ids.length < 2) return;
    try {
      const newGroupId = await createGroup(ids);
      await refetch();
      commands.push(createGroupCommand(ids, undefined, createGroup, ungroupGroup, newGroupId));
    } catch (err) {
      console.warn('[SceneWorkspace] createGroup failed:', err);
    }
  }, [createGroup, ungroupGroup, refetch, commands]);

  const handleUngroup = useCallback(async (ids: string[]) => {
    // The context menu passes a selection; we look up the group id of any
    // target (they share a group because auto-expand replaces single-member
    // selections with the full group) and dissolve that group. If the
    // selection spans multiple groups, each is dissolved in turn.
    const groupsToDissolve = new Map<string, { cabinetIds: string[]; name: string | undefined }>();
    for (const id of ids) {
      const g = groupOf(id);
      if (g && !groupsToDissolve.has(g.id)) {
        groupsToDissolve.set(g.id, { cabinetIds: g.cabinetIds, name: g.name });
      }
    }
    if (groupsToDissolve.size === 0) return;
    try {
      await Promise.all(Array.from(groupsToDissolve.keys()).map(gid => ungroupGroup(gid)));
      await refetch();
      // Push one command per dissolved group so each can be individually
      // undone (a user who ungrouped two distinct groups by chance can
      // restore them one Cmd+Z at a time).
      for (const [gid, meta] of groupsToDissolve.entries()) {
        commands.push(ungroupCommand(gid, meta.cabinetIds, meta.name, createGroup, ungroupGroup));
      }
    } catch (err) {
      console.warn('[SceneWorkspace] ungroup failed:', err);
    }
  }, [groupOf, ungroupGroup, createGroup, refetch, commands]);
  const handleLock = useCallback((_ids: string[], _next: boolean) => {
    console.info('[SceneWorkspace] Lock toggle requested — implementation lands in Phase 7');
  }, []);
  const handleDuplicateIds = useCallback((ids: string[]) => {
    for (const id of ids) duplicate(id).catch(err =>
      console.warn('[SceneWorkspace] duplicate failed:', err),
    );
  }, [duplicate]);
  const handleDeleteIds = useCallback((ids: string[]) => {
    for (const id of ids) handleRemove(id).catch(err =>
      console.warn('[SceneWorkspace] delete failed:', err),
    );
  }, [handleRemove]);

  // ─── Drawer-panel callbacks ──────────────────────────────────────────────
  const handleToggleDimVisibility = useCallback((dimId: string, visible: boolean) => {
    setDimensionOverrides(prev => ({ ...prev, [dimId]: { ...prev[dimId], visible } }));
  }, []);

  const handleToggleTier = useCallback((tier: string, visible: boolean) => {
    const tieredDims = managedDimensions.filter(d => {
      if (tier === 'overall') return d.source === 'overall';
      if (tier === 'intermediate') return d.source === 'intermediate';
      if (tier === 'detail') return d.source === 'detail';
      if (tier === 'manual') return d.type === 'user';
      return false;
    });
    const updates: DimensionOverrides = {};
    tieredDims.forEach(d => { updates[d.id] = { ...(dimensionOverrides[d.id] ?? {}), visible }; });
    setDimensionOverrides(prev => ({ ...prev, ...updates }));
  }, [managedDimensions, dimensionOverrides]);

  const handleDeleteUserDim = useCallback((dimId: string) => {
    setUserDimensions(prev => prev.filter(d => d.id !== dimId));
  }, []);

  const handleResetOverrides = useCallback(() => {
    setDimensionOverrides({});
  }, []);

  const handleCutListRowClick = useCallback((meshName: string) => {
    const needles = expandMeshNeedles(null, meshName);
    const nodeId = findPartTreeNodeIdByMeshNeedles(partTreeDerived, needles);
    if (nodeId) {
      selectNodeById(nodeId);
    } else {
      clearSelection();
    }
  }, [partTreeDerived, selectNodeById, clearSelection]);

  /** AssemblyReviewPanel passes PartTreeNode ids, not mesh names */
  const handleAssemblyPartSelect = useCallback((partId: string | null) => {
    if (partId) selectNodeById(partId);
    else clearSelection();
  }, [selectNodeById, clearSelection]);

  if (!sceneId) {
    navigate('/workshop/scenes');
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !scene) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <p className="text-red-600 text-sm mb-2">Failed to load scene</p>
        <p className="text-gray-500 text-xs">{error?.message ?? 'Scene not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/workshop/scenes')}
          className="mt-4 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700"
        >
          Back to scenes
        </button>
      </div>
    );
  }

  const existingCodes = cabinets.map(c => c.cabinetCode);

  // `hasModel` for the drawer trigger bar: a cabinet is selected AND its
  // GLB has been parsed. Panels marked `alwaysAvailable` (KB, Files, etc.)
  // stay enabled regardless.
  const drawerHasModel = !!(selectedCabinet && parsedModel);

  // ─── Drawer panel content ────────────────────────────────────────────────
  const renderDrawerContent = () => {
    // Status chip while the GLB is loading
    if (
      selectedCabinet &&
      !parsedModel &&
      (isModelLoading || modelError) &&
      drawerPanel !== null &&
      ['parts', 'cutlist', 'dims', 'assemblies', 'ai', 'materials'].includes(drawerPanel)
    ) {
      if (isModelLoading) {
        return (
          <div className="p-4 flex items-center gap-2 text-[11px] text-gray-500">
            <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600" />
            Preparing 3D model…
          </div>
        );
      }
      if (modelError) {
        return (
          <div className="p-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded m-3">
            Model unavailable: {modelError.message}
          </div>
        );
      }
    }

    switch (drawerPanel) {
      case 'context':
        return <SceneContextCard scene={scene ?? null} onBound={refetch} />;

      case 'itemMeta':
        if (!selectedCabinet) {
          return <DrawerEmptyState text="Select a cabinet to view its Design Manager metadata." />;
        }
        if (!itemMetadataContext) {
          return <DrawerEmptyState text="This cabinet isn't bound to a Design Item yet. Bind it from the Cabinet detail panel (Design Item → Reassign)." />;
        }
        return (
          <DesignItemMetadataPanel
            projectContext={itemMetadataContext}
            userId={user?.uid ?? ''}
            onItemChanged={refetch}
          />
        );

      case 'part': {
        // Per-part detail panel — resolves the scene's selected id
        // (when in 'part' mode) to a ScenePart anywhere in any cabinet.
        // Falls back to hints when the user hasn't selected a part yet.
        if (selection.mode !== 'part') {
          return (
            <DrawerEmptyState text="Switch selection mode to Part and click a component to inspect it." />
          );
        }
        const selectedPartSceneId = selection.selectedIds[0];
        if (!selectedPartSceneId) {
          return (
            <DrawerEmptyState text="Click a part in the viewport to see its size, material, and connections." />
          );
        }
        let partHit: ScenePart | undefined;
        let partCabinet: SceneCabinet | undefined;
        for (const cab of cabinets) {
          for (const asm of cab.assemblies ?? []) {
            const p = (asm.parts ?? []).find(pt => pt.id === selectedPartSceneId);
            if (p) { partHit = p; partCabinet = cab; break; }
          }
          if (partHit) break;
        }
        if (!partHit || !partCabinet) {
          return (
            <DrawerEmptyState text="Selected id doesn't resolve to a known part — re-click a mesh in the viewport." />
          );
        }
        return (
          <PartDetailPanel
            part={partHit}
            cabinet={partCabinet}
            onNavigateToPart={(id) => select(id)}
            meshBboxes={meshBboxesForPartPanel}
            inventoryResolver={partInventoryResolver}
          />
        );
      }

      case 'parts':
        if (!selectedCabinet) return <DrawerEmptyState text="Select a cabinet from the roster to view its part tree." />;
        if (!parsedModel) return <DrawerEmptyState text="This cabinet has no 3D model attached." />;
        return (
          <PartTree
            nodes={partTreeDerived}
            selectedId={selectedPartId}
            expandedIds={expandedIds}
            meshLinks={meshLinks}
            onSelect={selectNodeById}
            onToggleExpand={toggleExpand}
            onExplode={toggleExplode}
          />
        );

      case 'cutlist':
        if (!selectedCabinet) return <DrawerEmptyState text="Select a cabinet to view its cut list." />;
        if (!parsedModel) return <DrawerEmptyState text="This cabinet has no 3D model attached." />;
        return (
          <CutListTable
            entries={[]}
            meshLinks={meshLinks}
            partTree={partTreeDerived}
            selectedPartId={selectedPartId}
            onRowClick={handleCutListRowClick}
          />
        );

      case 'positioning':
        return (
          <PositioningPanel
            cabinets={cabinets}
            selectedIds={selectedIds}
            onMove={moveCabinetGroupAware}
          />
        );

      case 'dims':
        if (!selectedCabinet) return <DrawerEmptyState text="Select a cabinet to view its dimensions." />;
        if (!parsedModel) return <DrawerEmptyState text="This cabinet has no 3D model attached." />;
        return (
          <DimensionReviewPanel
            dimensions={managedDimensions}
            onToggleVisibility={handleToggleDimVisibility}
            onToggleTier={handleToggleTier}
            onDeleteUserDim={handleDeleteUserDim}
            onActivateMeasureTool={
              measureTool.isActive ? measureTool.deactivateTool : measureTool.activateTool
            }
            onResetOverrides={handleResetOverrides}
            measureToolActive={measureTool.isActive}
            selectedDimId={selectedDimId}
            onSelectDim={setSelectedDimId}
          />
        );

      case 'assemblies':
        if (!selectedCabinet) return <DrawerEmptyState text="Select a cabinet to review its assemblies." />;
        if (!parsedModel) return <DrawerEmptyState text="This cabinet has no 3D model attached." />;
        return (
          <div className="flex flex-col h-full">
            <AIGroupingTrigger parsedModel={parsedModel} />
            {assemblySaveError && (
              <div className="mx-3 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-900">
                {assemblySaveError}
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              <AssemblyReviewPanel
                groups={assemblyGroups}
                partTree={partTreeDerived}
                isConfirmed={groupsConfirmed}
                onMovePart={movePart}
                onConfirm={confirmGroups}
                onReset={resetGroups}
                onPartSelect={handleAssemblyPartSelect}
              />
            </div>
          </div>
        );

      case 'ai':
        if (!selectedCabinet) return <DrawerEmptyState text="Select a cabinet to run AI part recognition." />;
        if (!parsedModel) return <DrawerEmptyState text="This cabinet has no 3D model attached." />;
        return (
          <PartRecognitionPanel
            state={partRecognition.state}
            selectedTypeId={partRecognition.selectedTypeId}
            onSelectType={partRecognition.setFurnitureType}
            onAnalyze={partRecognition.analyze}
            onRenamePart={partRecognition.renamePart}
            onConfirmAndSync={() => partRecognition.confirmAndSync('current-user')}
            onReset={partRecognition.reset}
            hasProjectContext={!!scene.projectId}
            hasModel={!!parsedModel}
          />
        );

      case 'materials':
        if (!selectedCabinet) return <DrawerEmptyState text="Select a cabinet to browse its materials." />;
        if (!parsedModel) return <DrawerEmptyState text="This cabinet has no 3D model attached." />;
        return (
          <MaterialPanel
            materialMappings={materialMappings}
            onSwapMaterial={materialSwap.applyOverride}
            onResetMaterial={materialSwap.resetOverride}
            onResetAll={materialSwap.resetAll}
            overrides={materialSwap.overrides}
          />
        );

      case 'cabinets':
        return (
          <div className="p-3 space-y-2">
            <DrawerEmptyState text="To detect more cabinets from a 3D model, use Add Cabinet → From 3D Model." />
            <button
              type="button"
              onClick={() => {
                setDrawerPanel(null);
                setShowBulkImport(true);
              }}
              className="w-full px-3 py-2 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Open Bulk Import
            </button>
          </div>
        );

      case 'export':
        return (
          <div className="p-3 space-y-2">
            <p className="text-xs text-gray-600">
              Generate a full project PDF (cover, cabinet sheets, BOM, cut lists).
            </p>
            <button
              type="button"
              onClick={() => {
                setDrawerPanel(null);
                setShowPDFExport(true);
              }}
              className="w-full px-3 py-2 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
            >
              Open Export Dialog
            </button>
          </div>
        );

      case 'kb':
        return <KBBrowser />;

      case 'files':
        return (
          <SceneFilesPanel
            cabinets={cabinets}
            sceneId={sceneId}
            projectId={scene?.projectId}
            architecturalAssets={scene?.architecturalAssets ?? []}
            partsCsvOverlay={scene?.partsCsvOverlay}
            onSceneChanged={refetch}
            focusSyncSignal={filesFocusSyncSignal}
            autoPartsSyncState={{
              syncing: autoPartsSync.syncing,
              lastResults: autoPartsSync.lastResults,
              lastErrors: autoPartsSync.lastErrors,
            }}
          />
        );

      case 'production':
        return <SceneProductionPanel cabinets={cabinets} />;

      case 'render':
        return (
          <RenderPanel
            activePresetId={activeRenderPresetId}
            onSelectPreset={handleSelectRenderPreset}
            onCapture={handleCaptureRender}
            capturing={renderCapture.capturing}
            capturedImageUrl={renderCapture.capturedImageUrl}
            onDownload={renderCapture.download}
            onCopyToClipboard={renderCapture.copyToClipboard}
            onResetCapture={renderCapture.reset}
          />
        );

      // `generate`, `configurator`, `revisions`, `handoff`, `mdp` are
      // tagged `viewerType: 'workshop'` in `DrawerTriggerBar` so the
      // Scene bar no longer surfaces them — their cases would be
      // unreachable.

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-[calc(100dvh-7.5rem)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2 border-b bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/workshop/scenes')}
            className="text-gray-400 hover:text-gray-600 shrink-0"
            title="All scenes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold truncate">{scene.name}</h1>
          {scene.projectId && sceneId && (
            <SceneWorkspaceBreadcrumb sceneId={sceneId} projectId={scene.projectId} />
          )}
        </div>

        <div className="flex items-center flex-wrap justify-end gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setShowRosterSheet(true)}
            className="lg:hidden px-2.5 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Cabinets
          </button>
          <button
            type="button"
            onClick={() => setShowDetailSheet(true)}
            disabled={!selectedId}
            className="lg:hidden px-2.5 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Details
          </button>
          {/* View toggle */}
          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => setViewTab('3d')}
              className={`px-2.5 py-1 text-xs font-medium rounded ${viewTab === '3d' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
            >
              3D View
            </button>
            <button
              type="button"
              onClick={() => setViewTab('layout')}
              className={`px-2.5 py-1 text-xs font-medium rounded ${viewTab === 'layout' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'}`}
            >
              Layout
            </button>
          </div>

          <SelectionModeToggle mode={selection.mode} onChange={setMode} />

          <IsolationToggle
            isolatedId={selection.isolatedId}
            selectedId={selectedCabinetIdForViewport}
            onIsolate={isolate}
            onUnisolate={unisolate}
          />

          <button
            type="button"
            onClick={() => setShowAddChooser(true)}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-medium hover:bg-blue-700 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Cabinet
          </button>

          <button
            type="button"
            onClick={() => setShowPDFExport(true)}
            className="px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Cabinet roster */}
        <div className="hidden lg:block w-56 border-r bg-white flex-shrink-0 overflow-hidden">
          <CabinetRoster
            sceneId={sceneId}
            projectId={scene?.projectId}
            userId={user?.uid ?? ''}
            selectedCabinetId={selectedCabinet?.id ?? partInspectorCabinet?.id ?? undefined}
            onCabinetSelect={handleCabinetSelect}
            onAddCabinet={() => setShowAddChooser(true)}
            onDuplicateCabinet={handleDuplicate}
            onRemoveCabinet={handleRemove}
            onReleaseGroup={setReleaseDesignItemId}
          />
        </div>

        {/* Center: Viewport / Layout (RightDrawer overlays this region) */}
        <div
          className="flex-1 bg-gray-100 overflow-hidden relative min-w-0"
          onContextMenu={(e) => {
            // Desktop right-click → context menu for the current selection.
            // Touch users reach the same menu via long-press, handled by
            // the input-adapter's `bindLongPress` props below.
            if (selectedIds.length === 0) return;
            e.preventDefault();
            handleViewportContextMenu({
              cabinetId: selectedIds[0],
              clientX: e.clientX,
              clientY: e.clientY,
            });
          }}
          {...input.bindLongPress}
        >
          {viewTab === '3d' ? (
            <AutoFramingViewport
              sceneId={sceneId}
              cabinets={cabinets}
              selectionMode={selection.mode}
              selectedCabinetId={selectedCabinetIdForViewport}
              selectedPartMeshNeedles={selectedPartMeshNeedles}
              isolatedCabinetId={selection.isolatedId}
              onCabinetClick={handleCabinetSelect}
              onMeshClick={handleMeshClick}
              onCabinetMove={moveCabinetGroupAware}
              gizmoMode={gizmoMode}
              onGizmoModeChange={setGizmoMode}
              onViewportReady={handleViewportReady}
              className="h-full"
            />
          ) : (
            <div className="p-4 h-full overflow-auto">
              <SceneLayoutEditor
                sceneId={sceneId}
                cabinets={cabinets}
                selectedCabinetId={selectedId ?? undefined}
                onCabinetSelect={handleCabinetSelect}
                onPositionChange={refetch}
              />
            </div>
          )}

          {/* Right drawer (overlays viewport) */}
          <RightDrawer
            activePanel={drawerPanel}
            onClose={() => setDrawerPanel(null)}
          >
            {renderDrawerContent()}
          </RightDrawer>
        </div>

        {/* Right: Cabinet detail (when selected) */}
        {selectedId && (
          <div className="hidden lg:block w-72 border-l bg-white flex-shrink-0 overflow-hidden">
            <CabinetDetailPanel
              sceneId={sceneId}
              cabinetId={selectedId}
              onClose={() => select('')}
              onCabinetUpdated={() => {
                void refetch();
              }}
              onSplit={() => {
                // After a split the source cabinet is deleted — drop
                // the selection (the CabinetDetailPanel would otherwise
                // wedge on a cabinetId that no longer exists) and
                // refetch the scene so the new cabinets show up in
                // the roster immediately.
                select('');
                void refetch();
              }}
            />
          </div>
        )}

        {/* Rightmost: Drawer trigger bar */}
        <DrawerTriggerBar
          activePanel={drawerPanel}
          onSelectPanel={setDrawerPanel}
          hasModel={drawerHasModel}
          viewerType="scene"
        />
      </div>

      {/* Mobile roster sheet */}
      {showRosterSheet && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setShowRosterSheet(false)}>
          <div
            className="absolute inset-y-0 left-0 w-[88vw] max-w-xs bg-white border-r shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <CabinetRoster
              sceneId={sceneId}
              projectId={scene?.projectId}
              userId={user?.uid ?? ''}
              selectedCabinetId={selectedCabinet?.id ?? partInspectorCabinet?.id ?? undefined}
              onCabinetSelect={handleCabinetSelect}
              onAddCabinet={() => {
                setShowRosterSheet(false);
                setShowAddChooser(true);
              }}
              onDuplicateCabinet={handleDuplicate}
              onRemoveCabinet={handleRemove}
              onReleaseGroup={setReleaseDesignItemId}
            />
          </div>
        </div>
      )}

      {/* Mobile detail sheet */}
      {showDetailSheet && selectedId && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/40" onClick={() => setShowDetailSheet(false)}>
          <div
            className="absolute inset-y-0 right-0 w-[92vw] max-w-sm bg-white border-l shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <CabinetDetailPanel
              sceneId={sceneId}
              cabinetId={selectedId}
              onClose={() => {
                setShowDetailSheet(false);
                select('');
              }}
              onCabinetUpdated={() => {
                void refetch();
              }}
              onSplit={() => {
                setShowDetailSheet(false);
                select('');
                void refetch();
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom: Status bar */}
      <SceneStatusBar
        scene={scene}
        autoSyncSyncingCount={autoPartsSync.syncing.size}
        autoSyncErrorCount={autoPartsSync.lastErrors.size}
        autoSyncLastAt={latestAutoSync?.at}
        autoSyncLastSyncedParts={latestAutoSync?.synced}
        onAutoSyncErrorsClick={() => {
          setDrawerPanel('files');
          setFilesFocusSyncSignal(v => v + 1);
        }}
      />

      {/* Dialogs */}
      {showAddChooser && (
        <AddCabinetChooser
          onPickTemplate={() => {
            setShowAddChooser(false);
            setShowAddDialog(true);
          }}
          onPickModel={() => {
            setShowAddChooser(false);
            setShowBulkImport(true);
          }}
          onClose={() => setShowAddChooser(false)}
        />
      )}

      {showAddDialog && (
        <AddCabinetDialog
          sceneId={sceneId}
          projectId={scene?.projectId ?? ''}
          userId={user?.uid ?? ''}
          onAdd={handleAddCabinet}
          onClose={() => setShowAddDialog(false)}
          existingCodes={existingCodes}
        />
      )}

      {showPDFExport && (
        <ProjectPDFExportDialog
          sceneId={sceneId}
          scene={scene}
          cabinets={cabinets}
          onClose={() => setShowPDFExport(false)}
        />
      )}

      {showBulkImport && (
        <BulkCabinetImportDialog
          sceneId={sceneId}
          projectId={scene?.projectId ?? ''}
          userId={user?.uid ?? ''}
          existingCodes={existingCodes}
          onComplete={async () => {
            await refetch();
            setShowBulkImport(false);
          }}
          onClose={() => setShowBulkImport(false)}
        />
      )}

      {releaseDesignItemId && releaseDesignItem && scene?.projectId && (
        <ReleaseToProductionDialog
          projectId={scene.projectId}
          designItem={releaseDesignItem}
          cabinets={releaseGroupCabinets}
          userId={user?.uid ?? ''}
          onClose={() => setReleaseDesignItemId(null)}
          onReleased={async () => {
            // Refresh the roster so the freshly-locked cabinets show their
            // new lock badge. The dialog closes itself once the user hits Done.
            await refetch();
          }}
        />
      )}

      {contextMenu.menu && (
        <ContextMenu
          x={contextMenu.menu.x}
          y={contextMenu.menu.y}
          cabinetIds={contextMenu.menu.cabinetIds}
          cabinets={cabinets}
          onClose={contextMenu.close}
          onRotate={handleRotateCabinets}
          onTurnRound={handleTurnRound}
          onGroup={handleGroup}
          onUngroup={handleUngroup}
          onLock={handleLock}
          onDuplicate={handleDuplicateIds}
          onDelete={handleDeleteIds}
        />
      )}

      {rotateTargetIds && (
        <RotateDialog
          cabinets={cabinets}
          cabinetIds={rotateTargetIds}
          onCommit={handleRotateCommit}
          onClose={() => setRotateTargetIds(null)}
        />
      )}

      <NudgePad
        visible={input.isTouchDevice && selectedIds.length > 0}
        cabinets={cabinets}
        selectedIds={selectedIds}
        step={nudgeStep}
        onStepChange={setNudgeStep}
        onMove={moveCabinetGroupAware}
      />
    </div>
  );
}
