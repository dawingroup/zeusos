/**
 * Design Studio Module — Public API
 *
 * Unified design-to-production pipeline: 3D model viewer, parametric configurator,
 * product definition documents, constraint engine, and manufacturing data package generation.
 *
 * Formerly: Workshop Viewer Module (renamed in Phase A of design-to-production pipeline spec)
 */

// Types
export type {
  ParsedModel,
  MeshObject,
  MaterialDef,
  BoundingBox3D,
  PartGroup,
  PartRole,
  AssemblyType,
  PartTreeNode,
  MeshCutListLink,
  NormalizedPartName,
  CutListEntry,
  DimensionSet,
  IntermediateDimension,
  DimensionTier,
  ViewDirection,
  HiddenLineMode,
  EdgeVisibility,
  ViewPreset,
  ViewerState,
  PrintPackageProjectInfo,
  PrintPackageConfig,
  ProjectContext,
  ViewerSession,
  ProjectedEdge,
  ProjectedView,
  ShopTravellerSheet,
  ShopTravellerPlacement,
} from './types/workshop-viewer.types';

// Constants
export {
  VIEW_PRESETS,
  DIMENSION_COLORS,
  DF_BRAND_COLORS,
  A3_DIMENSIONS,
  TITLE_BLOCK_FIELDS,
  SHEET_NUMBERING,
  PART_ROLE_PATTERNS,
  ASSEMBLY_PATTERNS,
  OUTFIT_FONT_URLS,
  EDGE_RENDERING,
  EXPLODE_SETTINGS,
  SCENE_DEFAULTS,
  CUT_LIST_COLUMNS,
  DF_CONTACT_INFO,
} from './constants/workshop-viewer.constants';

// Schemas
export {
  printPackageProjectInfoSchema,
  printPackageConfigSchema,
} from './schemas/printPackageSchema';

// Parsers
export { parse3DS } from './services/parser3ds';
export { parseDXF } from './services/parserDxf';
export { parsePolyBoardCSV } from './services/parserCsv';

// Engines
export { computeDimensions } from './services/dimensionEngine';
export { buildMeshCutListLinks, buildPartTree, normalizePartName } from './services/assemblyEngine';
export { computeExplodeOffsets } from './services/explodeEngine';
export { classifyEdgeVisibility } from './services/hiddenLineEngine';
export { extractSilhouetteEdges } from './utils/silhouetteExtractor';
export { createProjectedView, projectEdgesToView } from './utils/projectionUtils';
export {
  computeBoundingBox,
  mergeBoundingBoxes,
  bboxDimensions,
  computeModelBounds,
  groupPartsByName,
  classifyPartRole,
} from './services/geometryEngine';

// PDF Services
export { generatePrintPackage } from './services/printPackageService';
export { drawTitleBlock, loadOutfitFont } from './utils/titleBlockRenderer';

// Firestore Services
export {
  createSession,
  getSession,
  listSessions,
  updateSession,
  deleteSession,
  attachPrintPackage,
} from './services/workshopViewerService';
export {
  resolveFromDesignProject,
  resolveFromManufacturingOrder,
  resolveFromUrlParams,
} from './services/projectContextService';

// Hooks
export { useModelParser } from './hooks/useModelParser';
export { usePartSelection } from './hooks/usePartSelection';
export { usePrintPackage } from './hooks/usePrintPackage';
export { useViewerSession } from './hooks/useViewerSession';

// Pages
export { default as WorkshopViewerPage } from './pages/WorkshopViewerPage';

// ── Phase 2: Scene Composition ──

// Scene Types
export type {
  DesignScene,
  SceneCabinet,
  CabinetPosition,
  GroundPlane,
  WallSegment,
  CameraState,
} from './types/scene.types';

export type {
  SceneAssembly,
  ScenePart,
  BoundingBox,
  SceneBOMRollup,
  BOMCategoryRollup,
  BOMRollupLine,
  ProjectCutList,
  CabinetCutListSection,
  AssemblyCutListSection,
  AggregatedCutList,
} from './types/assembly.types';

export type {
  ProjectPDFRequest,
  ProjectPDFData,
  CabinetPDFSection,
} from './types/projectPdf.types';

export type {
  SceneSelection,
  SelectionAction,
} from './types/selection.types';

// Scene Constants
export {
  SCENE_NODE_TYPES,
  SELECTION_MODES,
  POSITIONING_MODES,
  VIEWPORT_VIEW_MODES,
  GROUND_PLANE_SIZE_MM,
  GROUND_PLANE_GRID_MM,
  DEFAULT_CABINET_SPACING_MM,
  WALL_GAP_MM,
  MAX_SCENE_PARTS,
  LOD_THRESHOLD_PARTS,
} from './constants/scene.constants';

export {
  ASSEMBLY_TYPES,
  PART_CATEGORIES,
  DEFAULT_ASSEMBLY_HIERARCHIES,
  ASSEMBLY_BOM_GROUP_ORDER,
} from './constants/assembly.constants';

export {
  PDF_SECTION_TYPES,
  DEFAULT_PDF_SECTIONS,
  PDF_PAGE_SIZE,
  PDF_RENDER_PRESET,
} from './constants/projectPdf.constants';

export {
  CARDINAL_DIRECTIONS,
  WALL_RUN_TYPES,
  CABINET_ANCHOR_POINTS,
  ROTATION_INCREMENTS_DEG,
} from './constants/positioning.constants';

// Scene Schemas
export {
  createSceneSchema,
  addCabinetToSceneSchema,
  updateCabinetPositionSchema,
  duplicateCabinetSchema,
  updateCabinetDesignItemSchema,
} from './schemas/scene.schemas';

export {
  createAssemblySchema,
  createPartSchema,
  bulkAssemblyImportSchema,
} from './schemas/assembly.schemas';

export { projectPdfRequestSchema } from './schemas/projectPdf.schemas';

// Scene Services
export {
  createScene,
  getScene,
  updateScene,
  archiveScene,
  getScenesForProject,
  listActiveScenes,
  getSceneCabinets,
  addCabinetToScene,
  duplicateCabinet,
  updateCabinetPosition,
  removeCabinetFromScene,
  lockCabinetForProduction,
  unlockCabinet,
  // P2 (Slice 2): DesignItem FK helpers
  getCabinetsForDesignItem,
  assignCabinetToDesignItem,
} from './services/scene.service';

export {
  extractAssembliesFromParsedModel,
  mapPartsToAssemblies,
  getAssemblyBOM,
  getAssemblyBoundingBox,
  mergePartsIntoAssembly,
  splitAssembly,
} from './services/assembly.service';

export {
  computePartCutList,
  groupPartsByMaterial,
  estimateSheetCount,
  computeEdgeBandingTotals,
  extractHardwareSchedule,
  validatePartProcessability,
  bulkValidateParts,
  buildAggregatedCutList,
} from './services/partProcessing.service';

export {
  getProjectRollup,
  getCabinetRollup,
  getAssemblyRollup,
  getProjectCutList,
  getProjectPricing,
} from './services/sceneBomRollup.service';

export {
  generateProjectPDF,
  prepareProjectPDFData,
  generateCabinetRender,
  generateAllCabinetRenders,
  previewProjectPDF,
} from './services/projectPdf.service';

// ── Phase 3: AI Processing & ModelPackage ──

export type {
  ModelPackage,
  ModelGrouping,
  ModelMaterials,
  ModelRenders,
  ModelPackageMetadata,
  ModelProcessingStep,
  CreateModelPackageInput,
  ProcessModelProgress,
  MaterialMappingLite,
} from './types/modelPackage.types';

export {
  createModelPackageSchema,
} from './schemas/modelPackage.schemas';

export {
  createModelPackage,
  getModelPackage,
  getModelPackageVersions,
  updateModelPackageGrouping,
  updateModelPackageMaterials,
  updateModelPackageRenders,
  updateModelPackageBOM,
} from './services/modelPackage.service';

export {
  groupModelWithAI,
  validateGrouping,
} from './services/aiAssemblyGrouper.service';

export {
  processModel,
} from './services/processModel.service';

export type {
  ProcessModelInput,
  ProcessModelResult,
} from './services/processModel.service';

export { useModelPackage } from './hooks/useModelPackage';
export { useModelProcessor } from './hooks/useModelProcessor';
export { useBulkCabinetDetector } from './hooks/useBulkCabinetDetector';

// Cabinet Detection (multi-cabinet model splitting)
export type {
  DetectedCabinet,
  BulkCabinetDetectionResult,
  DetectCabinetsInput,
} from './types/cabinetDetection.types';

export {
  detectCabinetsWithAI,
} from './services/cabinetDetector.service';

// Scene Hooks
export { useScene, useSceneList } from './hooks/useScene';
export { useSceneCabinets } from './hooks/useSceneCabinets';
export { useSceneDesignItems } from './hooks/useSceneDesignItems';
export { useCabinet } from './hooks/useCabinet';
export { useSceneSelection } from './hooks/useSceneSelection';
export { useSceneViewport } from './hooks/useSceneViewport';
export { useAssemblyExtractor } from './hooks/useAssemblyExtractor';
export { useSceneBOMRollup } from './hooks/useSceneBOMRollup';
export { useProjectCutList } from './hooks/useProjectCutList';
export { useProjectPDF } from './hooks/useProjectPDF';
export { useCabinetPositioning } from './hooks/useCabinetPositioning';
export { useScenePricing } from './hooks/useScenePricing';
