/**
 * Workshop Viewer Types
 * All TypeScript interfaces for the Workshop Viewer module
 */

import type { Timestamp } from 'firebase/firestore';

export interface Vec3 { x: number; y: number; z: number; }

// ============================================================================
// 3D MODEL TYPES (client-side, parsed from file)
// ============================================================================

export type ModelSource = '3ds' | 'dxf' | 'obj' | 'fbx' | 'skp' | 'glb';

export interface ParsedModel {
  source: ModelSource;
  fileName: string;
  objects: MeshObject[];
  materials: Record<string, MaterialDef>;
  /** Raw GLB buffer — when present, ThreeViewport loads via GLTFLoader to preserve textures */
  glbBuffer?: ArrayBuffer;
}

export interface MeshObject {
  name: string;
  vertices: Float32Array;
  faces: Uint16Array | Uint32Array;
  material: string;
  /** Stable mesh id written at export time (`userData.dawinMeshId`).
   * Survives GLTF name sanitization; used to isolate cabinets that share
   * a source GLB in scene PDF generation. */
  dawinMeshId?: string;
}

export interface MaterialDef {
  diffuse: [number, number, number]; // RGB 0-1
}

export interface BoundingBox3D {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

// ============================================================================
// PART GROUPING & ASSEMBLY TYPES
// ============================================================================

export interface PartGroup {
  cleanName: string;
  objects: MeshObject[];
  bbox: BoundingBox3D;
  dims: { w: number; d: number; h: number };
  meshCount: number;
}

/** Structural role of a part within its parent assembly */
export type PartRole =
  | 'side'
  | 'top_bottom'
  | 'vertical_division'
  | 'shelf'
  | 'mobile_shelf'
  | 'back'
  | 'door'
  | 'drawer'
  | 'drawer_component'
  | 'bar'
  | 'rail'
  | 'stile'
  | 'panel'
  | 'muntin'
  | 'counter_front'
  | 'cover'
  | 'plinth'
  | 'other';

/** Sub-assembly classification detected from PolyBoard naming patterns */
export type AssemblyType =
  | 'carcase'
  | 'shaker_door'
  | 'slab_door'
  | 'raised_panel_door'
  | 'drawer_box'
  | 'drawer_front'
  | 'shelf_unit'
  | 'countertop'
  | 'custom';

/** Hierarchical node in the part tree */
export interface PartTreeNode {
  id: string;
  name: string;
  role: PartRole;
  assemblyType?: AssemblyType;
  meshObjectNames: string[];
  cutListEntryIds: number[];
  children: PartTreeNode[];
  bbox: BoundingBox3D;
  dims: { w: number; d: number; h: number };
  isExpanded: boolean;
  isLeaf: boolean;
}

/** Bidirectional linkage between a 3DS mesh object and a cut list row */
export interface MeshCutListLink {
  meshObjectName: string;
  cutListIndex: number;
  confidence: 'exact' | 'fuzzy' | 'unmatched';
  matchedBy: 'name' | 'dimensions' | 'material_and_dims' | 'none';
}

/** Result of the name normalization step */
export interface NormalizedPartName {
  baseName: string;       // "Door", "Left Side", "Vertical Division"
  instance: number | null; // 1, 2, etc. or null
  variant: string | null;  // "Double", "Single", etc.
  subIndex: number | null;  // [1], [2] sub-component index
  original: string;         // Original PolyBoard name
}

// ============================================================================
// CUT LIST TYPES (parsed from CSV)
// ============================================================================

export interface CutListEntry {
  cabinet: string;
  partName: string;
  material: string;
  thickness: number;
  qty: number;
  length: number;
  width: number;
  edgeBanding: {
    L1: boolean;
    L2: boolean;
    W1: boolean;
    W2: boolean;
  };
  grainDirection?: 'length' | 'width' | 'none';
  originalRow: number;
}

// ============================================================================
// DIMENSION TYPES
// ============================================================================

export type DimensionTier = 1 | 2 | 3;

export type ViewDirection = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom' | 'iso' | 'iso_ne';

export interface DimensionSet {
  overall: {
    width: number;
    depth: number;
    height: number;
  };
  intermediate: IntermediateDimension[];
}

export interface IntermediateDimension {
  type: 'horizontal_chain' | 'vertical_chain' | 'single_horizontal' | 'single_vertical';
  view: ViewDirection;
  positions: number[];
  tier: DimensionTier;
  label: string;
  color: string;
}

// ============================================================================
// HIDDEN LINE TYPES
// ============================================================================

export type HiddenLineMode = 'faint' | 'hidden';

export interface EdgeVisibility {
  edgeId: string;
  partName: string;
  visibility: 'visible' | 'hidden';
}

// ============================================================================
// VIEWER STATE TYPES
// ============================================================================

export interface ViewPreset {
  name: string;
  theta: number;
  phi: number;
}

export interface ViewerState {
  currentView: string;
  showEdges: boolean;
  showDimensions: boolean;
  hiddenLineMode: HiddenLineMode;
  selectedPartId: string | null;
  selectedAssemblyId: string | null;
  expandedAssemblyIds: string[];
}

// ============================================================================
// PRINT PACKAGE TYPES
// ============================================================================

export interface PrintPackageProjectInfo {
  projectName: string;
  client: string;
  address: string;
  projectNo: string;
  drawnBy: string;
  checkedBy: string;
  revision: string;
  stage: string;
  date: string;
}

export interface PrintPackageConfig {
  projectInfo: PrintPackageProjectInfo;
  includeSheets: {
    cover: boolean;
    isometricView: boolean;
    frontElevation: boolean;
    rearElevation: boolean;
    planView: boolean;
    threeView: boolean;
    partDetails: boolean;
    assemblyExploded: boolean;
    cutList: boolean;
    edgeBandSchedule: boolean;
    shopTraveller: boolean;
    /**
     * Scene-level "Project section" — the consolidated arrangement
     * drawings (P-I100 isometric, P-I101 front elevation, …) plus
     * its sub-cover page. Default true for backwards-compat. When
     * false, the entire P- block is skipped: no sub-cover, no
     * project drawings. The per-cabinet blocks still render.
     */
    projectSection?: boolean;
    /**
     * Scene-level "Cabinet details" — every per-cabinet block
     * (C01-Ixxx, C02-Ixxx, …) plus its sub-cover page. Default true.
     * Switch off to produce a project-drawings-only PDF.
     */
    cabinetSection?: boolean;
    /**
     * Scene-level gallery page of cabinet render images
     * (cabinet.renderUrl / thumbnailUrl). One sheet, grid layout.
     */
    renderGallery?: boolean;
    /**
     * Project-wide ironmongery schedule table — one row per unique
     * hardware item across every cabinet in the scene, with quantities.
     * Driven by extractHardwareSchedule().
     */
    hardwareSchedule?: boolean;
    /**
     * Project-wide finish schedule — aggregated finishSelections from
     * every cabinet, resolved against the Finish Library, rendered as
     * a table with colour swatches + code + description.
     */
    finishSchedule?: boolean;
    /**
     * Embed user-uploaded architectural plans + sections into the PDF.
     * Assets live on the scene doc (`scene.architecturalAssets`);
     * each image lands as its own sheet with a title strip.
     */
    architecturalPlans?: boolean;
  };
  partFilter?: string[];
  dimensionTiers: {
    overall: boolean;
    intermediate: boolean;
    openings: boolean;
  };
  hiddenLineMode: HiddenLineMode;
  shopTravellerSource: 'auto-generate' | 'link-existing';
  paperSize: 'A3' | 'A4';
  orientation: 'landscape';
  includeAutoDimensions?: boolean;
  includeUserDimensions?: boolean;
  respectVisibilityOverrides?: boolean;
  /**
   * Optional prefix prepended to every drawing number (e.g. "C01-").
   * Used by multi-cabinet scene exports so sheets stay unique across the
   * whole project: C01-I100, C01-I101, C02-I100, etc.
   */
  sheetPrefix?: string;
  /**
   * Optional per-cabinet label shown as the subject of the drawing
   * (e.g. "KB-A Kitchen Base 2264"). When set, title blocks render
   * projectInfo.projectName as the top-level project and this label as the
   * drawing subject, instead of concatenating them into a single string.
   */
  itemLabel?: string;
}

/** One record per print package export — appended to ViewerSession.printPackageHistory */
export interface PrintPackageHistoryEntry {
  /** Stable id (client-generated) for list keys and dedupe */
  id: string;
  /** Snapshot of the config that was used for this export */
  config: PrintPackageConfig;
  /** ISO string of when the export completed */
  exportedAt: string;
  /** User id of who triggered the export */
  exportedBy?: string;
  /** Firebase Storage download URL of the resulting PDF (if retained) */
  pdfUrl?: string;
  /** Original file name of the produced PDF */
  fileName?: string;
}

// ============================================================================
// PROJECT CONTEXT (auto-populated from Firestore)
// ============================================================================

export interface ProjectContext {
  projectId: string;
  projectName: string;
  projectCode: string;
  clientName: string;
  clientAddress: string;
  stage: string;
  source: 'design-project' | 'manufacturing-order' | 'standalone';
  // Design item context (populated when launched from Design Manager)
  designItemId?: string;
  designItemName?: string;
  designItemStage?: string;
  designItemParts?: DesignItemPartSummary[];
  materialPalette?: MaterialPaletteEntry[];
  /**
   * P21.8.1 — compact summary of `DesignItem.manufacturingRollup` so the
   * Item Metadata panel can surface how many contributing cabinets are
   * locked (and therefore contribute frozen totals via `lockedSnapshot`).
   * Absent when the item has no rollup yet.
   */
  rollupSummary?: {
    cabinetCount: number;
    lockedCabinetCount: number;
  };
  modelFileUrl?: string;
  /** All 3D model files found across design item deliverables */
  modelFileUrls?: ProjectModelFile[];
  /** CSV cut list files found across design item deliverables */
  csvFileUrls?: ProjectModelFile[];
  /** Manufacturing Order production context (populated when source is 'manufacturing-order') */
  productionContext?: ProductionContext;
}

/** Reference to a 3D model file in a design item's deliverables */
export interface ProjectModelFile {
  fileName: string;
  storageUrl: string;
  itemId: string;
  itemName: string;
  /** Set when this entry is a mirror of a deliverable doc */
  _sourceId?: string;
}

/** Lightweight summary of a design item part for context passing */
export interface DesignItemPartSummary {
  name: string;
  materialName: string;
  length: number;
  width: number;
  thickness: number;
  quantity: number;
  edgeBanding?: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  grainDirection?: string;
}

/** Material palette entry from the design project */
export interface MaterialPaletteEntry {
  name: string;
  code?: string;
  thickness?: number;
  inventoryItemId?: string;
}

// ============================================================================
// PRODUCTION CONTEXT TYPES (Phase A: MO-aware viewer)
// ============================================================================

/** Stock availability status for a BOM line item */
export type StockBadge = 'available' | 'partial' | 'out_of_stock';

/** BOM entry enriched with stock availability for display in Production tab */
export interface ProductionBomEntry {
  id: string;
  inventoryItemId: string;
  sku: string;
  itemName: string;
  category: string;
  quantityRequired: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  /** Resolved from stockLevels collection */
  quantityAvailable: number;
  stockBadge: StockBadge;
}

/** Stage transition record from MO stageHistory */
export interface ProductionStageTransition {
  from: string;
  to: string;
  at: string; // ISO string
  by?: string;
  notes?: string;
}

/** Linked document reference from the MO */
export interface ProductionDocument {
  id: string;
  name: string;
  type: string;
  url?: string;
}

/** Full production context resolved from a Manufacturing Order */
export interface ProductionContext {
  moId: string;
  orderNumber: string;
  status: string;
  currentStage: string;
  priority: string;
  itemName: string;
  quantity: number;
  bomEntries: ProductionBomEntry[];
  stageHistory: ProductionStageTransition[];
  linkedDocuments: ProductionDocument[];
  targetCompletionDate?: string;
}

// ============================================================================
// DESIGN REVISION TYPES (Phase F placeholder)
// ============================================================================

export type RevisionStatus = 'draft' | 'in_review' | 'editing' | 'final';
export type GenerationSource = 'parametric' | 'ai_mesh' | 'manual_upload' | 'external_edit';

/** Lightweight revision entry for timeline display */
export interface RevisionEntry {
  id: string;
  revisionNumber: number;
  status: RevisionStatus;
  source: GenerationSource;
  thumbnailUrl?: string;
  createdAt: string; // ISO string
  createdBy?: string;
  editNotes?: string;
}

// ============================================================================
// FIRESTORE PERSISTENCE TYPES
// ============================================================================

export interface ViewerSession {
  id: string;
  organizationId: string;
  subsidiaryId?: string;
  name: string;
  modelFileUrl: string;
  csvFileUrl?: string;
  projectInfo: PrintPackageProjectInfo;
  linkedDesignProjectId?: string;
  linkedDesignItemId?: string;
  linkedMoId?: string;
  status: 'draft' | 'reviewed' | 'issued';
  lastPrintPackageUrl?: string;
  lastPrintPackageDate?: Timestamp;
  hiddenLineMode: HiddenLineMode;
  workshopAnalysisResult?: WorkshopAnalysisResult;
  userDimensions?: import('./dimension.types').ManagedDimension[];
  dimensionOverrides?: import('./dimension.types').DimensionOverrides;
  // Session persistence (UX enhancement)
  materialSwapOverrides?: Record<string, string>;  // materialName → finishId
  assemblyGroupsData?: AssemblyGroup[];
  partRecognitionResult?: Record<string, unknown>;
  generationResult?: { glbUrl: string; thumbnailUrl?: string; source: string };
  entryMode?: 'upload' | 'project' | 'generate' | 'mo';
  /**
   * P4: session scope.
   *
   *   - `'bound'` — session has a real `linkedDesignItemId` or `linkedMoId`.
   *     Writes here propagate back to design-manager / manufacturing
   *     (parts sync, print-package attach, deliverables).
   *   - `'standalone'` — quick-review upload with no project context.
   *     A session in this scope **cannot attach print packages** back to
   *     a DesignItem or MO; it exists only as a scratch pad. Users must
   *     bind the session to a DesignItem/MO before a print-package attach
   *     will succeed.
   *
   * Optional on read for backward compatibility with legacy docs. Writers
   * must always stamp it; readers should derive via `deriveSessionScope()`
   * when the field is absent.
   */
  scope?: 'bound' | 'standalone';
  /** Last print package configuration used — restored when user reopens the dialog */
  printPackageConfig?: PrintPackageConfig;
  /** Export history — one entry per successful print package generation */
  printPackageHistory?: PrintPackageHistoryEntry[];
  lastAccessedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  updatedBy?: string;
}

// ============================================================================
// AI ANALYSIS RESULT (cached on session)
// ============================================================================

export interface WorkshopAnalysisResult {
  materialMatches: MaterialMatch[];
  partDiscrepancies: PartDiscrepancy[];
  productionNotes: ProductionNote[];
  confidence: number;
  analysedAt: string;
}

export interface MaterialMatch {
  modelMaterial: string;
  suggestedPaletteMaterial: string;
  paletteCode?: string;
  confidence: number;
}

export interface PartDiscrepancy {
  type: 'missing_in_model' | 'missing_in_parts' | 'dimension_mismatch';
  partName: string;
  details: string;
}

export interface ProductionNote {
  partName: string;
  cncNotes?: string;
  assemblySequence?: number;
  note: string;
}

// ============================================================================
// 2D PROJECTION TYPES (for PDF rendering)
// ============================================================================

export interface ProjectedEdge {
  id: string;
  partName: string;
  a2d: { x: number; y: number };
  b2d: { x: number; y: number };
  a3d: { x: number; y: number; z: number };
  b3d: { x: number; y: number; z: number };
  visibility: 'visible' | 'hidden';
}

export interface ProjectedView {
  direction: ViewDirection;
  edges: ProjectedEdge[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
}

// ============================================================================
// SHOP TRAVELLER TYPES (extends optimization service types)
// ============================================================================

export interface ShopTravellerSheet {
  sheetIndex: number;
  drawingNumber: string; // I4xx
  material: string;
  stockWidth: number;
  stockHeight: number;
  placements: ShopTravellerPlacement[];
  wastePercent: number;
}

// ============================================================================
// ASSEMBLY GROUPING TYPES (Phase 3)
// ============================================================================

export type AssemblyCategory =
  | 'carcase'
  | 'fixed_shelves'
  | 'mobile_shelves'
  | 'drawer_box'
  | 'drawer_front'
  | 'door'
  | 'cover'
  | 'hardware'
  | 'other';

export interface AssemblyGroup {
  id: string;
  category: AssemblyCategory;
  name: string;
  partIds: string[];
  confidence: 'high' | 'medium' | 'low';
  isUserModified: boolean;
}

export interface ConstructionStep {
  stepNumber: number;
  groupId: string;
  title: string;
  parts: string[];
  instructions: string[];
}

export interface ShopTravellerPlacement {
  partName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  grainDirection?: 'horizontal' | 'vertical';
  assemblyName?: string;
}
