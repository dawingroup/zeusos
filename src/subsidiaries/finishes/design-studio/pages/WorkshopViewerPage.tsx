/**
 * WorkshopViewerPage — Main page assembling all workshop viewer components
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │ ViewerToolbar                               │
 *   ├────────────┬────────────────────────────────┤
 *   │ Sidebar    │ ThreeViewport / FileUploadZone │
 *   │ (260px)    │ (flex-1)                       │
 *   │            │                                │
 *   │ ViewCtrl   │                                │
 *   │ DimPanel   │                                │
 *   │ PartTree   │                                │
 *   │ CutList    │                                │
 *   └────────────┴────────────────────────────────┘
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import ThreeViewport from '../components/ThreeViewport';
import LeftToolbar from '../components/LeftToolbar';
import RightDrawer from '../components/RightDrawer';
import DrawerTriggerBar, { type DrawerPanel } from '../components/DrawerTriggerBar';
import SessionContextCard from '../components/SessionContextCard';
import DesignItemMetadataPanel from '../components/DesignItemMetadataPanel';
import PartTree from '../components/PartTree';
import { DimensionReviewPanel } from '../components/DimensionReviewPanel';
import CutListTable from '../components/CutListTable';
import FileUploadZone from '../components/FileUploadZone';
import EntryHub from '../components/EntryHub';
import ViewerActionBar from '../components/ViewerActionBar';
import ExportConfigPanel from '../components/ExportConfigPanel';
import AssemblyReviewPanel from '../components/AssemblyReviewPanel';
import PartRecognitionPanel from '../components/PartRecognitionPanel';
import CabinetDetectionPanel from '../components/CabinetDetectionPanel';
import AIGroupingTrigger from '../components/AIGroupingTrigger';
import ProductionTab from '../components/ProductionTab';
import MaterialPanel from '../components/MaterialPanel';
import RenderPanel from '../components/RenderPanel';
import ImageDraftUploader from '../components/generator/ImageDraftUploader';
import ParametricConfigurator from '../components/generator/ParametricConfigurator';
import TemplateLibrary from '../components/generator/TemplateLibrary';
import RevisionTimeline from '../components/RevisionTimeline';
import ExportPanel from '../components/handoff/ExportPanel';
import ImportDropzone from '../components/handoff/ImportDropzone';
import { ClientConfigurator } from '../components/configurator/ClientConfigurator';
import { KBBrowser } from '../components/kb/KBBrowser';
import { ViewportToolbar } from '../components/scene/ViewportToolbar';
import { useFramingState } from '../hooks/useFramingState';
import { useViewPreset } from '../hooks/useViewPreset';
import { VIEW_PRESETS, type ViewPresetKey } from '../constants/framing.constants';
import type { CameraSubject } from '../types/framing.types';
import type CameraControls from 'camera-controls';
import { useModelParser } from '../hooks/useModelParser';
import { useProductionContext } from '../hooks/useProductionContext';
import { useMaterialResolver } from '../hooks/useMaterialResolver';
import { useMaterialValidation } from '../hooks/useMaterialValidation';
import { useMaterialSwap } from '../hooks/useMaterialSwap';
import { useMeshGenerator } from '../hooks/useMeshGenerator';
import { useFinishLibrary } from '@/modules/inventory/hooks/useFinishLibrary';
import { resolvePBRDefaults } from '../services/materialResolverService';
import { listRevisions, exportForShapr3D, uploadRevisedModel } from '../services/designRevisionService';
import { uploadToTrimbleConnect } from '../services/trimbleConnectService';
import type { RevisionEntry } from '../types/workshop-viewer.types';
import type { DesignRevision } from '../types/designRevision.types';
import { useRenderCapture } from '../hooks/useRenderCapture';
import { applyPresetToScene, captureViewport, type RenderPreset } from '../services/renderPresetService';
import { usePartSelection } from '../hooks/usePartSelection';
import { usePrintPackage } from '../hooks/usePrintPackage';
import { useAssemblyGroups } from '../hooks/useAssemblyGroups';
import { useMeasureTool } from '../hooks/useMeasureTool';
import { usePartRecognition } from '../hooks/usePartRecognition';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { resolveFromUrlParams } from '../services/projectContextService';
import { convertAutoToManaged, mergeDimensions } from '../services/dimensionManager';
import {
  getOrCreateSession,
  createStandaloneSession,
  attachPrintPackage,
  getSession,
  loadMaterialOverrides,
} from '../services/workshopViewerService';
import { persistWorkshopUploadToProjectFiles } from '../services/workshopViewerFileService';
import { useAutoSave } from '../hooks/useAutoSave';
import { useAuth } from '@/shared/hooks/useAuth';
import type { ViewerState, HiddenLineMode, PrintPackageConfig, ProjectContext } from '../types/workshop-viewer.types';
import type { ManagedDimension, DimensionOverrides } from '../types/dimension.types';

export default function WorkshopViewerPage() {
  const {
    model,
    cutList,
    partTree,
    meshLinks,
    dimensions,
    modelFileName,
    csvFileName,
    loading,
    error,
    loadModelFile,
    loadMultipleModelFiles,
    loadCsvFile,
  } = useModelParser();

  const {
    selectedPartId,
    expandedIds,
    expandedAssemblyIds,
    selectPart,
    selectNodeById,
    toggleExpand,
    toggleExplode,
    clearSelection,
    getSelectedNode,
  } = usePartSelection(partTree);

  const {
    groups: assemblyGroups,
    isConfirmed: groupsConfirmed,
    movePart,
    confirmGroups,
    resetGroups,
  } = useAssemblyGroups(partTree);

  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  const [viewerState, setViewerState] = useState<ViewerState>({
    currentView: 'iso',
    showEdges: true,
    showDimensions: true,
    hiddenLineMode: 'faint',
    selectedPartId: null,
    selectedAssemblyId: null,
    expandedAssemblyIds: [],
  });

  const [, setShowExportDialog] = useState(false);
  const [drawerPanel, setDrawerPanel] = useState<DrawerPanel>(null);
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null);

  // PDD / Configurator state — loaded from URL ?pddId=xxx
  const [activePddId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('pddId');
  });
  const partRecognition = usePartRecognition(model, projectContext);

  // Extract moId from URL params or project context for Production tab
  const moId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('moId') || (projectContext?.source === 'manufacturing-order' ? projectContext.projectId : null);
  }, [projectContext]);
  const { production } = useProductionContext(moId);

  // Material resolver: fuzzy-match 3DS materials to Finish Library
  // P21.7 — feed the project's curated materialPalette so recognition
  // biases toward finishes the designer has already committed to.
  const { mappings: materialMappings, paletteMatchedCount } = useMaterialResolver(
    model,
    projectContext?.materialPalette,
  );

  // P13: inventory-aware validation gate for print-package export.
  // Surfaces exceptions when a mapped finish has no inventoryItemId or
  // has zero available stock — blocks `ExportConfigPanel`'s Generate
  // button until resolved.
  const materialValidation = useMaterialValidation(materialMappings);

  // Phase E: Material swap and render capture
  const { finishes } = useFinishLibrary({ isActive: true });
  const materialSwap = useMaterialSwap();
  // Hydration state — `undefined` means "still loading", any concrete value
  // (including `{}`) means "load complete, safe to persist". Used below to
  // gate the auto-save so we don't write an empty Map on top of stored data.
  const [materialHydrated, setMaterialHydrated] = useState(false);
  const renderCapture = useRenderCapture();
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Resolve material overrides: finishId → actual material data for ThreeViewport
  const resolvedMaterialOverrides = useMemo(() => {
    if (materialSwap.overrides.size === 0 || finishes.length === 0) return undefined;
    const resolved = new Map<string, { hexColor: string; roughness: number; metalness: number; textureAssets?: { diffuseUrl?: string; normalUrl?: string; roughnessUrl?: string; tileRepeat?: [number, number] } }>();
    materialSwap.overrides.forEach((finishId, materialName) => {
      const finish = finishes.find(f => f.id === finishId);
      if (!finish) return;
      const pbr = resolvePBRDefaults(finish.category, finish.subtype);
      resolved.set(materialName, {
        hexColor: finish.hexColor || '#CCCCCC',
        roughness: pbr.roughness,
        metalness: pbr.metalness,
        textureAssets: finish.textureAssets,
      });
    });
    return resolved.size > 0 ? resolved : undefined;
  }, [materialSwap.overrides, finishes]);

  // Scene refs provided by ThreeViewport via onSceneReady callback
  const sceneRefsRef = useRef<{
    getScene: () => THREE.Scene | null;
    getCamera: () => THREE.PerspectiveCamera | null;
    getRenderer: () => THREE.WebGLRenderer | null;
    getControls: () => CameraControls | null;
  } | null>(null);

  const handleSceneReady = useCallback((refs: {
    getScene: () => THREE.Scene | null;
    getCamera: () => THREE.PerspectiveCamera | null;
    getRenderer: () => THREE.WebGLRenderer | null;
    getControls: () => CameraControls | null;
  }) => {
    sceneRefsRef.current = refs;
  }, []);

  const handleSelectPreset = useCallback((preset: RenderPreset) => {
    setActivePresetId(preset.id);
    const scene = sceneRefsRef.current?.getScene();
    const camera = sceneRefsRef.current?.getCamera();
    if (scene && camera) {
      applyPresetToScene(scene, camera, preset);
    }
  }, []);

  const handleCapture = useCallback(async (opts: { scale: number; watermark: boolean }) => {
    const renderer = sceneRefsRef.current?.getRenderer();
    const scene = sceneRefsRef.current?.getScene();
    const camera = sceneRefsRef.current?.getCamera();
    if (!renderer || !scene || !camera) return;

    const blob = await captureViewport(renderer, scene, camera, { scale: opts.scale });
    const watermarkText = opts.watermark
      ? `DAWIN FINISHES${projectContext?.projectName ? ' | ' + projectContext.projectName : ''}`
      : undefined;
    await renderCapture.setCapturedImage(blob, watermarkText);
  }, [projectContext, renderCapture]);

  // Phase C: AI mesh generation
  const meshGenerator = useMeshGenerator();

  const handleImageGenerate = useCallback(async (
    file: File,
    dimensions?: { width: number; depth: number; height: number },
    faceLimit?: number,
  ) => {
    const result = await meshGenerator.generateFromImage(file, dimensions, faceLimit);
    // Load the generated GLB into the viewer
    if (result?.glbUrl) {
      try {
        const resp = await fetch(result.glbUrl);
        const blob = await resp.blob();
        const glbFile = new File([blob], 'generated-model.glb', { type: 'model/gltf-binary' });
        loadModelFile(glbFile);
      } catch (err) {
        console.error('[WorkshopViewer] Failed to load generated GLB:', err);
      }
    }
  }, [meshGenerator, loadModelFile]);

  const handleTextGenerate = useCallback(async (prompt: string, faceLimit?: number) => {
    const result = await meshGenerator.generateFromText(prompt, faceLimit);
    if (result?.glbUrl) {
      try {
        const resp = await fetch(result.glbUrl);
        const blob = await resp.blob();
        const glbFile = new File([blob], 'generated-model.glb', { type: 'model/gltf-binary' });
        loadModelFile(glbFile);
      } catch (err) {
        console.error('[WorkshopViewer] Failed to load generated GLB:', err);
      }
    }
  }, [meshGenerator, loadModelFile]);

  const handleParametricGenerate = useCallback(async (templateId: string, parameters: Record<string, unknown>) => {
    const result = await meshGenerator.generateFromTemplate(templateId, parameters);
    if (result?.glbUrl) {
      try {
        const resp = await fetch(result.glbUrl);
        const blob = await resp.blob();
        const glbFile = new File([blob], `${result.templateName || 'parametric'}-model.glb`, { type: 'model/gltf-binary' });
        loadModelFile(glbFile);
      } catch (err) {
        console.error('[WorkshopViewer] Failed to load parametric GLB:', err);
      }
    }
  }, [meshGenerator, loadModelFile]);

  // Phase F: Design revisions
  const [revisions, setRevisions] = useState<RevisionEntry[]>([]);
  const [activeRevision, setActiveRevision] = useState<DesignRevision | null>(null);
  const [activeRevisionId, setActiveRevisionId] = useState<string | null>(null);

  // Load revisions when moId or projectId is available
  useEffect(() => {
    const loadRevisions = async () => {
      const filter: { moId?: string; projectId?: string } = {};
      if (moId) filter.moId = moId;
      else if (projectContext?.projectId) filter.projectId = projectContext.projectId;
      else return;

      try {
        const revs = await listRevisions(filter);
        setRevisions(revs.map(r => ({
          id: r.id,
          revisionNumber: r.revisionNumber,
          status: r.status,
          source: r.source,
          thumbnailUrl: r.files.thumbnailUrl,
          createdAt: r.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          createdBy: r.createdBy,
          editNotes: r.editNotes,
        })));
        if (revs.length > 0 && !activeRevision) {
          setActiveRevision(revs[0]);
          setActiveRevisionId(revs[0].id);
        }
      } catch (err) {
        console.warn('[WorkshopViewer] Failed to load revisions:', err);
      }
    };
    loadRevisions();
  }, [moId, projectContext?.projectId]);

  const handleExportShapr3D = useCallback(async (revisionId: string) => {
    return exportForShapr3D(revisionId);
  }, []);

  const handleExportSketchUp = useCallback(async (revisionId: string, projectName: string) => {
    await uploadToTrimbleConnect(revisionId, projectName, moId || undefined);
  }, [moId]);

  // Session management + auto-save
  const { user } = useAuth();

  const handleImportRevision = useCallback(async (file: File, editNotes?: string) => {
    if (!activeRevisionId) throw new Error('No active revision');
    const userId = user?.uid ?? 'unknown-user';
    return uploadRevisedModel(file, activeRevisionId, userId, editNotes);
  }, [activeRevisionId, user]);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('sessionId');
  });

  // useAutoSave is called after userDimensions/dimensionOverrides are declared (see below)

  // Auto-create session when model is loaded.
  //
  // P4: split explicitly on whether we have project context.
  //   - With a DesignItem or MO → `getOrCreateSession` (bound scope).
  //   - Without → `createStandaloneSession` (scratch-pad scope; cannot
  //     attach print packages until bound via `bindSessionToContext`).
  //
  // The branch has to be at the call site — the service layer fails loud
  // if `getOrCreateSession` is called with no links, by design.
  useEffect(() => {
    if (!model || !user?.uid || sessionId) return;
    const linkedDesignItemId = projectContext?.designItemId;
    const linkedMoId = moId || undefined;
    const hasContext = Boolean(linkedDesignItemId || linkedMoId);

    const creation = hasContext
      ? getOrCreateSession(
          {
            modelFileUrl: model.fileName || '',
            name: modelFileName || 'Untitled',
            linkedDesignProjectId: projectContext?.projectId,
            linkedDesignItemId,
            linkedMoId,
            entryMode:
              projectContext?.source === 'manufacturing-order'
                ? 'mo'
                : projectContext?.designItemId
                ? 'project'
                : 'upload',
          },
          user.uid,
        )
      : createStandaloneSession(
          {
            modelFileUrl: model.fileName || '',
            name: modelFileName || 'Untitled',
          },
          user.uid,
        );

    creation.then(setSessionId).catch(console.error);
  }, [model, user?.uid, sessionId, modelFileName, projectContext, moId]);

  // Hydrate material overrides from the session once we know its ID.
  // Guarded by `materialHydrated` so we only load once per session.
  useEffect(() => {
    if (!sessionId || materialHydrated) return;
    let cancelled = false;
    loadMaterialOverrides(sessionId)
      .then(stored => {
        if (cancelled) return;
        if (stored && Object.keys(stored).length > 0) {
          materialSwap.setAllOverrides(stored);
        }
        setMaterialHydrated(true);
      })
      .catch(err => {
        console.warn('[WorkshopViewer] failed to load material overrides:', err);
        if (!cancelled) setMaterialHydrated(true);
      });
    return () => { cancelled = true; };
  }, [sessionId, materialHydrated, materialSwap]);

  // Handle resume session
  const handleResumeSession = useCallback((sid: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('sessionId', sid);
    window.location.href = url.toString();
  }, []);

  // P21.5 — wrap user-initiated model uploads so they persist into the
  // unified `projectFiles` collection as `cad-model` docs linked to the
  // bound DesignItem. Fire-and-forget: the viewer must not block on a
  // 200MB upload. Auto-loads from `?fileUrl=…` deliberately use the raw
  // `loadModelFile` below (the file is already in projectFiles), and
  // standalone sessions short-circuit inside the service.
  const handleUserLoadModelFile = useCallback((file: File) => {
    loadModelFile(file);

    const projectId = projectContext?.projectId;
    const itemId = projectContext?.designItemId;
    if (!projectId || !itemId || !user?.uid) return;

    void persistWorkshopUploadToProjectFiles(file, {
      projectId,
      // Phase 4b — thread the policy code + uploader display name so
      // Phase 1 naming enforcement + Phase 2 Drive mirror can do their
      // job (was silently falling back to 'UNKNOWN' / null before).
      projectCode: projectContext?.projectCode,
      itemId,
      itemName: projectContext?.designItemName,
      userId: user.uid,
      userName: user.displayName || user.email || undefined,
      skipIfNameExists: true,
    }).then(result => {
      if (result.skipped) {
        console.debug('[WorkshopViewer] Skipped projectFiles persist:', result.reason);
      } else {
        console.debug('[WorkshopViewer] Persisted upload to projectFiles:', result.file?.id);
      }
    }).catch(err => {
      // Non-fatal: the user can still work with the in-memory model.
      console.warn('[WorkshopViewer] Failed to persist upload to projectFiles:', err);
    });
  }, [loadModelFile, projectContext?.projectId, projectContext?.projectCode, projectContext?.designItemId, projectContext?.designItemName, user?.uid, user?.displayName, user?.email]);

  const handleUserLoadMultipleModelFiles = useCallback((files: File[]) => {
    if (loadMultipleModelFiles) {
      loadMultipleModelFiles(files);
    } else {
      // Fallback: load the first file only (matches legacy behavior).
      const first = files[0];
      if (first) loadModelFile(first);
    }

    const projectId = projectContext?.projectId;
    const itemId = projectContext?.designItemId;
    if (!projectId || !itemId || !user?.uid) return;

    // Persist each file independently. No batch endpoint yet; keeping
    // these as parallel uploads is fine — they're independent writes.
    for (const file of files) {
      void persistWorkshopUploadToProjectFiles(file, {
        projectId,
        projectCode: projectContext?.projectCode,
        itemId,
        itemName: projectContext?.designItemName,
        userId: user.uid,
        userName: user.displayName || user.email || undefined,
        skipIfNameExists: true,
      }).catch(err => {
        console.warn('[WorkshopViewer] Failed to persist bulk upload:', file.name, err);
      });
    }
  }, [loadMultipleModelFiles, loadModelFile, projectContext?.projectId, projectContext?.projectCode, projectContext?.designItemId, projectContext?.designItemName, user?.uid, user?.displayName, user?.email]);

  // Handle "Generate from Image" action bar click (opens generate drawer)
  const handleActionBarGenerateImage = useCallback(() => {
    setDrawerPanel('generate');
  }, []);

  // Handle "Browse Files" action bar click
  const handleActionBarBrowseFiles = useCallback(() => {
    setDrawerPanel('files');
  }, []);

  const autoLoadAttempted = useRef(false);

  // Dimension management state
  const [userDimensions, setUserDimensions] = useState<ManagedDimension[]>([]);
  const [dimensionOverrides, setDimensionOverrides] = useState<DimensionOverrides>({});
  const [selectedDimId, setSelectedDimId] = useState<string | null>(null);
  // saveTimeoutRef removed — auto-save now handled by useAutoSave hook

  // Measure tool
  const measureTool = useMeasureTool(model);

  // Managed dimensions merged from auto + user + overrides
  const managedDimensions = useMemo(
    () => mergeDimensions(convertAutoToManaged(dimensions), userDimensions, dimensionOverrides),
    [dimensions, userDimensions, dimensionOverrides],
  );

  // Fetch Dawin Finishes logo directly (not Dawin Group)
  const [finishesLogoUrl, setFinishesLogoUrl] = useState<string | undefined>();
  useEffect(() => {
    const orgSettingsRef = doc(db, 'organizations', 'default', 'settings', 'general');
    const unsub = onSnapshot(orgSettingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const subs = data?.branding?.subsidiaries;
        const url = subs?.['zeus-the-agency']?.logoUrl;
        setFinishesLogoUrl(url || undefined);
      }
    });
    return () => unsub();
  }, []);

  // Auto-load from URL params (Design Manager / MO integration)
  useEffect(() => {
    if (autoLoadAttempted.current) return;
    autoLoadAttempted.current = true;

    (async () => {
      const ctx = await resolveFromUrlParams();
      if (ctx) {
        setProjectContext(ctx);

        // If a fileUrl is provided, auto-load the 3D model
        const params = new URLSearchParams(window.location.search);
        const fileUrl = params.get('fileUrl');
        if (fileUrl) {
          try {
            const resp = await fetch(decodeURIComponent(fileUrl));
            const blob = await resp.blob();
            const fileName = ctx.designItemName
              ? `${ctx.designItemName}.3ds`
              : 'model.3ds';
            const file = new File([blob], fileName, { type: blob.type });
            loadModelFile(file);
          } catch (err) {
            console.error('Failed to auto-load model from URL:', err);
          }
        }

        // Auto-load first CSV cut list if available
        if (ctx.csvFileUrls?.length) {
          const csvFile = ctx.csvFileUrls[0];
          try {
            const csvResp = await fetch(csvFile.storageUrl);
            const text = await csvResp.text();
            const blob = new Blob([text], { type: 'text/csv' });
            const file = new File([blob], csvFile.fileName, { type: 'text/csv' });
            loadCsvFile(file);
          } catch (err) {
            console.warn('Failed to auto-load CSV:', err);
          }
        }
      }
    })();
  }, [loadModelFile, loadCsvFile]);

  const {
    generate,
    progress,
    loading: pdfLoading,
    pdfBlob,
    download,
  } = usePrintPackage(
    model, cutList, partTree, meshLinks, dimensions, finishesLogoUrl,
    assemblyGroups.length > 0 ? assemblyGroups : undefined,
    materialValidation.exceptions,
  );

  // P14: when a session is resumed, pull the last saved print-package
  // config so ExportConfigPanel can hydrate its form with the user's
  // previous choices instead of re-defaulting to the boilerplate.
  const [persistedPrintConfig, setPersistedPrintConfig] =
    useState<PrintPackageConfig | null>(null);
  useEffect(() => {
    if (!sessionId) {
      setPersistedPrintConfig(null);
      return;
    }
    let cancelled = false;
    getSession(sessionId)
      .then((s) => {
        if (!cancelled) setPersistedPrintConfig(s?.printPackageConfig ?? null);
      })
      .catch(() => {
        // Non-fatal — hydration is a nice-to-have; the form will still
        // render its hardcoded defaults.
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // P14: capture the last config the user submitted so we can persist it
  // on the session alongside the generated PDF. The form state is owned
  // by ExportConfigPanel, so we hoist the submitted value into a ref
  // here — setState would trigger a re-render + regenerate loop.
  const lastConfigRef = useRef<PrintPackageConfig | null>(null);
  const handleGenerate = useCallback(async (config: PrintPackageConfig) => {
    lastConfigRef.current = config;
    await generate(config);
  }, [generate]);

  // Auto-download when PDF is ready
  const handlePdfReady = useCallback(() => {
    if (pdfBlob) {
      const filename = modelFileName
        ? `${modelFileName.replace(/\.\w+$/, '')}_print-package.pdf`
        : 'print-package.pdf';
      download(filename);
      setShowExportDialog(false);

      // P14: persist the config + PDF onto the session so the next
      // dialog open can hydrate from it and the export history is
      // auditable. Fire-and-forget — standalone sessions throw by
      // design (see P4 gate in attachPrintPackage) and that's a
      // non-fatal "scratch pad" outcome for the user.
      const config = lastConfigRef.current;
      if (sessionId && user?.uid && config) {
        attachPrintPackage(sessionId, pdfBlob, filename, user.uid, config).catch(
          (err) => console.warn('P14: print package not attached to session', err),
        );
      }
    }
  }, [pdfBlob, download, modelFileName, sessionId, user?.uid]);

  // Sync selection to viewer state
  const fullViewerState: ViewerState = {
    ...viewerState,
    selectedPartId,
    expandedAssemblyIds,
  };

  const handleViewChange = useCallback((view: string) => {
    setViewerState(prev => ({ ...prev, currentView: view }));
  }, []);

  const handleToggleEdges = useCallback(() => {
    setViewerState(prev => ({ ...prev, showEdges: !prev.showEdges }));
  }, []);

  const handleToggleDimensions = useCallback(() => {
    setViewerState(prev => ({ ...prev, showDimensions: !prev.showDimensions }));
  }, []);

  const handleHiddenLineMode = useCallback((mode: HiddenLineMode) => {
    setViewerState(prev => ({ ...prev, hiddenLineMode: mode }));
  }, []);

  const handleResetView = useCallback(() => {
    setViewerState(prev => ({ ...prev, currentView: 'iso' }));
  }, []);

  // Phase 2.1: Auto-framing UI for Quick Review
  // Mirrors the scene AutoFramingViewport pattern — ViewportToolbar overlay
  // on top of ThreeViewport, with preset changes forwarded to viewerState.currentView.
  const { preset: framingPreset, setPreset: setPersistedFramingPreset } = useViewPreset('quick-review');
  const {
    state: framingState,
    setSubject: setFramingSubject,
    setPreset: setFramingPreset,
    setProjection: setFramingProjection,
    recenter: dispatchFramingRecenter,
  } = useFramingState({ preset: framingPreset });

  // Derive subject from current selection — a selected part scopes the subject;
  // otherwise frame the whole model.
  const framingSubject: CameraSubject = useMemo(() => {
    if (selectedPartId) {
      return {
        type: 'part',
        id: selectedPartId,
        bounds: { center: { x: 0, y: 0, z: 0 }, radius: 0 },
      };
    }
    return {
      type: 'scene',
      id: 'quick-review',
      bounds: { center: { x: 0, y: 0, z: 0 }, radius: 0 },
    };
  }, [selectedPartId]);

  useEffect(() => {
    if (framingState.subject.id !== framingSubject.id || framingState.subject.type !== framingSubject.type) {
      setFramingSubject(framingSubject);
    }
  }, [framingSubject, framingState.subject.id, framingState.subject.type, setFramingSubject]);

  // Map framing preset → existing viewerState.currentView so ThreeViewport
  // actually repositions the camera.
  const presetToCurrentView = useCallback((p: ViewPresetKey): string => {
    if (p.startsWith('iso_') || p === 'three_quarter' || p === 'perspective_default') return 'iso';
    return p; // 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
  }, []);

  const handleFramingPresetChange = useCallback((p: ViewPresetKey) => {
    setFramingPreset(p);
    setPersistedFramingPreset(p);
    setViewerState(prev => ({ ...prev, currentView: presetToCurrentView(p) }));
  }, [setFramingPreset, setPersistedFramingPreset, presetToCurrentView]);

  const handleFramingProjectionChange = useCallback((proj: 'perspective' | 'orthographic') => {
    setFramingProjection(proj);
    const currentProj = VIEW_PRESETS[framingPreset].projection;
    if (currentProj !== proj) {
      const fallback: ViewPresetKey = proj === 'perspective' ? 'iso_ne' : 'front';
      setPersistedFramingPreset(fallback);
      setFramingPreset(fallback);
      setViewerState(prev => ({ ...prev, currentView: presetToCurrentView(fallback) }));
    }
  }, [setFramingProjection, framingPreset, setPersistedFramingPreset, setFramingPreset, presetToCurrentView]);

  const handleFramingRecenter = useCallback(() => {
    dispatchFramingRecenter();
    setViewerState(prev => ({ ...prev, currentView: presetToCurrentView(framingPreset) }));
  }, [dispatchFramingRecenter, framingPreset, presetToCurrentView]);

  // Keyboard shortcuts for measure tool
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.key === 'd' || e.key === 'D') && !measureTool.isActive) {
        measureTool.activateTool();
      }
      if (e.key === 'Escape' && measureTool.isActive) {
        measureTool.deactivateTool();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [measureTool]);

  // Dimension callbacks
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

  const handleUserDimensionCreated = useCallback((dim: ManagedDimension) => {
    setUserDimensions(prev => [...prev, dim]);
  }, []);

  // Auto-save all workstreams (must be after userDimensions/dimensionOverrides declarations).
  // `isHydrated` gates the first save until material overrides have been
  // loaded from the session; otherwise the debounce could fire with an
  // empty Map and wipe persisted swatch selections.
  const { saveStatus } = useAutoSave({
    sessionId,
    materialOverrides: materialSwap.overrides,
    assemblyGroups,
    userDimensions,
    dimensionOverrides,
    isHydrated: materialHydrated,
  });

  const handlePartSelect = useCallback((meshName: string | null) => {
    selectPart(meshName);
  }, [selectPart]);

  /** AssemblyReviewPanel passes PartTreeNode ids, not mesh names */
  const handleAssemblyPartSelect = useCallback((partId: string | null) => {
    if (partId) selectNodeById(partId);
    else clearSelection();
  }, [selectNodeById, clearSelection]);

  const handleCutListRowClick = useCallback((meshName: string) => {
    selectPart(meshName);
  }, [selectPart]);

  // Auto-download PDF when generation completes
  useEffect(() => {
    handlePdfReady();
  }, [pdfBlob, handlePdfReady]);

  const selectedNode = getSelectedNode();
  const canExplode = !!selectedNode?.assemblyType;

  // Drawer panel content renderer
  const renderDrawerContent = () => {
    switch (drawerPanel) {
      case 'context':
        return (
          <SessionContextCard
            sessionId={sessionId}
            userId={user?.uid ?? ''}
            onBound={async () => {
              // Re-resolve projectContext from URL + session so hooks
              // downstream (usePartRecognition, ExportConfigPanel) pick
              // up the new ids without a full page refresh.
              try {
                const ctx = await resolveFromUrlParams();
                setProjectContext(ctx);
              } catch {
                /* non-fatal */
              }
            }}
          />
        );
      case 'itemMeta':
        return (
          <DesignItemMetadataPanel
            projectContext={projectContext}
            parsedPartCount={cutList.length}
            userId={user?.uid ?? ''}
            onItemChanged={async () => {
              // Mirrors SessionContextCard.onBound — after an edit, pull
              // the fresh projectContext so the panel re-renders with the
              // new name / stage without a page refresh.
              try {
                const ctx = await resolveFromUrlParams();
                setProjectContext(ctx);
              } catch {
                /* non-fatal */
              }
            }}
          />
        );
      case 'parts':
        return (
          <PartTree
            nodes={partTree}
            selectedId={selectedPartId}
            expandedIds={expandedIds}
            meshLinks={meshLinks}
            onSelect={selectNodeById}
            onToggleExpand={toggleExpand}
            onExplode={toggleExplode}
          />
        );
      case 'cutlist':
        return (
          <CutListTable
            entries={cutList}
            meshLinks={meshLinks}
            partTree={partTree}
            selectedPartId={selectedPartId}
            onRowClick={handleCutListRowClick}
          />
        );
      case 'dims':
        return (
          <DimensionReviewPanel
            dimensions={managedDimensions}
            onToggleVisibility={handleToggleDimVisibility}
            onToggleTier={handleToggleTier}
            onDeleteUserDim={handleDeleteUserDim}
            onActivateMeasureTool={measureTool.isActive ? measureTool.deactivateTool : measureTool.activateTool}
            onResetOverrides={handleResetOverrides}
            measureToolActive={measureTool.isActive}
            selectedDimId={selectedDimId}
            onSelectDim={setSelectedDimId}
          />
        );
      case 'assemblies':
        return (
          <div className="flex flex-col h-full">
            <AIGroupingTrigger parsedModel={model} />
            <div className="flex-1 overflow-y-auto">
              <AssemblyReviewPanel
                groups={assemblyGroups}
                partTree={partTree}
                isConfirmed={groupsConfirmed}
                onMovePart={movePart}
                onConfirm={confirmGroups}
                onReset={resetGroups}
                onGroupHover={setHoveredGroupId}
                onPartSelect={handleAssemblyPartSelect}
              />
            </div>
          </div>
        );
      case 'ai':
        return (
          <PartRecognitionPanel
            state={partRecognition.state}
            selectedTypeId={partRecognition.selectedTypeId}
            onSelectType={partRecognition.setFurnitureType}
            onAnalyze={partRecognition.analyze}
            onRenamePart={partRecognition.renamePart}
            onConfirmAndSync={() => partRecognition.confirmAndSync(user?.uid ?? 'unknown-user')}
            onReset={partRecognition.reset}
            hasProjectContext={!!projectContext?.designItemId}
            hasModel={!!model}
          />
        );
      case 'cabinets':
        return (
          <CabinetDetectionPanel
            parsedModel={model}
            modelName={modelFileName}
            projectId={projectContext?.projectId}
          />
        );
      case 'production':
        return production ? (
          <ProductionTab production={production} />
        ) : (
          <div className="p-3 text-xs text-muted-foreground text-center">
            No manufacturing order linked.
          </div>
        );
      case 'materials':
        return (
          <MaterialPanel
            materialMappings={materialMappings}
            onSwapMaterial={materialSwap.applyOverride}
            onResetMaterial={materialSwap.resetOverride}
            onResetAll={materialSwap.resetAll}
            overrides={materialSwap.overrides}
            paletteMatchedCount={paletteMatchedCount}
          />
        );
      case 'render':
        return (
          <RenderPanel
            activePresetId={activePresetId}
            onSelectPreset={handleSelectPreset}
            onCapture={handleCapture}
            capturing={renderCapture.capturing}
            capturedImageUrl={renderCapture.capturedImageUrl}
            onDownload={renderCapture.download}
            onCopyToClipboard={renderCapture.copyToClipboard}
            onResetCapture={renderCapture.reset}
          />
        );
      case 'generate':
        return (
          <div className="flex flex-col gap-3">
            <div className="px-2 pt-2">
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                AI Mesh Generation
              </div>
            </div>
            <ImageDraftUploader
              onGenerate={handleImageGenerate}
              onTextGenerate={handleTextGenerate}
              progress={meshGenerator.progress}
            />
            <div className="border-t border-border mx-2" />
            <ParametricConfigurator
              onGenerate={handleParametricGenerate}
              progress={meshGenerator.progress}
            />
            <div className="border-t border-border mx-2" />
            <TemplateLibrary onSelectTemplate={(template) => {
              // Switch to parametric configurator with this template pre-selected
              console.log('[WorkshopViewer] Template selected from library:', template.name);
            }} />
          </div>
        );
      case 'revisions':
        return (
          <RevisionTimeline
            revisions={revisions}
            activeRevisionId={activeRevisionId}
            onSelectRevision={setActiveRevisionId}
          />
        );
      case 'handoff':
        return (
          <div className="flex flex-col gap-3">
            <ExportPanel
              revision={activeRevision}
              onExportShapr3D={handleExportShapr3D}
              onExportSketchUp={handleExportSketchUp}
            />
            <div className="border-t border-border mx-2" />
            <ImportDropzone
              sourceRevisionId={activeRevisionId}
              onImport={handleImportRevision}
            />
          </div>
        );
      case 'files':
        return (
          <div className="p-2">
            <FileUploadZone
              onModelFile={handleUserLoadModelFile}
              onMultipleModelFiles={handleUserLoadMultipleModelFiles}
              onCsvFile={loadCsvFile}
              modelFileName={modelFileName}
              csvFileName={csvFileName}
              projectContext={projectContext}
            />
          </div>
        );
      case 'export':
        return (
          <ExportConfigPanel
            onGenerate={handleGenerate}
            projectContext={projectContext}
            progress={progress}
            loading={pdfLoading}
            assemblyGroupCount={assemblyGroups.length}
            groupsConfirmed={groupsConfirmed}
            onReviewGroups={() => setDrawerPanel('assemblies')}
            initialConfig={persistedPrintConfig ?? undefined}
            materialExceptions={materialValidation.exceptions}
            materialValidationLoading={materialValidation.loading}
            onReviewMaterials={() => setDrawerPanel('materials')}
          />
        );
      case 'configurator':
        return activePddId ? (
          <ClientConfigurator pddId={activePddId} />
        ) : (
          <div className="p-3 text-xs text-muted-foreground text-center">
            No Product Definition loaded. Add <code>?pddId=...</code> to the URL to open a configurator.
          </div>
        );
      case 'kb':
        return <KBBrowser />;
      case 'mdp':
        return (
          <div className="p-2 text-xs text-muted-foreground text-center">
            Generate an MDP from the Configurator to view BOM, cut list, and hardware schedule here.
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-0 h-[calc(100dvh-64px)]">
      {/* Action bar (replaces ViewerToolbar when model loaded) */}
      {model ? (
        <ViewerActionBar
          modelFileName={modelFileName}
          csvFileName={csvFileName}
          meshLinks={meshLinks}
          projectContext={projectContext}
          onExportPdf={() => setDrawerPanel('export')}
          hasModel={!!model}
          saveStatus={saveStatus}
          onAddModel={handleUserLoadModelFile}
          onAddCsv={loadCsvFile}
          onGenerateFromImage={handleActionBarGenerateImage}
          onBrowseFiles={handleActionBarBrowseFiles}
        />
      ) : (
        <div className="px-4 py-2 bg-slate-900 text-white">
          <span className="text-sm font-semibold tracking-wide">DAWIN Design Studio</span>
        </div>
      )}

      {error && (
        <div className="px-3 py-1 bg-destructive/10 text-destructive text-[10px]">{error}</div>
      )}
      {loading && (
        <div className="px-3 py-1 bg-primary/10 text-primary text-[10px]">Parsing file...</div>
      )}

      {/* Main content: Left bar + Viewport + Right trigger bar + Drawer */}
      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {/* Left icon toolbar — always visible for discoverability */}
        <div className="hidden sm:block">
          <LeftToolbar
            viewerState={fullViewerState}
            onViewChange={handleViewChange}
            onToggleEdges={handleToggleEdges}
            onToggleDimensions={handleToggleDimensions}
            onHiddenLineModeChange={handleHiddenLineMode}
            onResetView={handleResetView}
            onExplodeToggle={selectedNode ? () => toggleExplode(selectedNode.id) : undefined}
            canExplode={canExplode}
            hasModel={!!model}
          />
        </div>

        {/* Viewport — min-w-0 prevents Three.js canvas from forcing trigger bar off-screen */}
        <div className="flex-1 relative min-w-0">
          {model ? (
            <>
              <ThreeViewport
                model={model}
                viewerState={fullViewerState}
                partTree={partTree}
                dimensions={dimensions}
                highlightedGroupId={hoveredGroupId}
                assemblyGroups={assemblyGroups}
                onPartSelect={handlePartSelect}
                measureTool={measureTool.isActive ? {
                  isActive: true,
                  handleClick: (p) => {
                    const dim = measureTool.handleClick(p);
                    if (dim) handleUserDimensionCreated(dim);
                    return dim;
                  },
                  handleMouseMove: measureTool.handleMouseMove,
                  firstPoint: measureTool.toolState.mode === 'picking_second'
                    ? measureTool.toolState.firstPoint
                    : undefined,
                } : undefined}
                onUserDimensionCreated={handleUserDimensionCreated}
                userDimensions={userDimensions}
                materialMappings={materialMappings}
                materialOverrides={resolvedMaterialOverrides}
                onSceneReady={handleSceneReady}
              />
              {/* Phase 2.1: Auto-framing toolbar overlay — ported from scene workspace */}
              <div className="absolute top-2 left-2 right-2 sm:left-3 sm:right-3 z-10 px-2 sm:px-3 py-2 rounded-md bg-white/85 dark:bg-slate-900/85 backdrop-blur-sm border border-border shadow-sm pointer-events-auto">
                <ViewportToolbar
                  currentPreset={framingPreset}
                  onPresetChange={handleFramingPresetChange}
                  onProjectionChange={handleFramingProjectionChange}
                  onRecenter={handleFramingRecenter}
                  isUserControlled={framingState.isUserControlled}
                  subject={framingSubject}
                  subjectLabel={selectedPartId ? selectedPartId : (modelFileName ?? 'Model')}
                />
              </div>
            </>
          ) : (
            <EntryHub
              onModelFile={handleUserLoadModelFile}
              onMultipleModelFiles={handleUserLoadMultipleModelFiles}
              onCsvFile={loadCsvFile}
              onProjectContextChange={setProjectContext}
              onGenerateFromImage={handleImageGenerate}
              onResumeSession={handleResumeSession}
            />
          )}

          {/* Right drawer (overlays viewport) */}
          <RightDrawer
            activePanel={drawerPanel}
            onClose={() => setDrawerPanel(null)}
          >
            {renderDrawerContent()}
          </RightDrawer>
        </div>

        {/* Right trigger bar */}
        <DrawerTriggerBar
          activePanel={drawerPanel}
          onSelectPanel={setDrawerPanel}
          hasModel={!!model}
          hasMoContext={!!production}
          viewerType="workshop"
        />
      </div>
    </div>
  );
}
