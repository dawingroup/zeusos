/**
 * Scene Types — Multi-cabinet project scenes
 *
 * The Scene is the top-level container for a multi-cabinet project.
 * It owns positioning, selection state, and the cabinet roster.
 * Scenes persist independently of any single MO.
 */
import type { Timestamp } from 'firebase/firestore';
import type { CabinetAnchorPoint } from '../constants/positioning.constants';
import type { ComputedBOMLine, PricingBreakdown } from './constraintEngine.types';
import type { SceneAssembly } from './assembly.types';

/** Top-level scene containing multiple cabinets */
export interface DesignScene {
  id: string;
  name: string;
  projectId: string;
  customerId: string;
  description?: string;
  cabinets: SceneCabinet[];
  groundPlane: GroundPlane;
  cameraState: CameraState;
  status: 'draft' | 'active' | 'archived' | 'in_production';
  totalCabinetCount: number;
  totalEstimatedValue: number;
  currency: 'UGX' | 'USD';
  /**
   * P2 (Slice 1): denormalized cache of every DesignItem id referenced by
   * at least one cabinet in this scene. Maintained by `addCabinetToScene`,
   * `removeCabinetFromScene`, and `assignCabinetToDesignItem` (Slice 2+).
   * Purely for fast scene-level filtering and the "DesignItem chips" row
   * — `SceneCabinet.designItemId` is the source of truth.
   */
  linkedDesignItemIds?: string[];
  /**
   * Persisted material-swap overrides: mesh-material-name → finishLibraryId.
   * Consumed by `useMaterialSwap`'s `initialOverrides` seed in
   * `SceneWorkspacePage` so swatch selections survive reload.
   */
  materialOverrides?: Record<string, string>;
  /**
   * Cabinet Alignment System — per-scene snap tuning. When absent, the
   * defaults (`SNAP_THRESHOLD_MM`, `ANCHOR_THRESHOLD_MM`, enabled=true)
   * apply. Surfaced via scene settings UI so power users can tune
   * strictness without rebuilding.
   */
  snapSettings?: {
    /** Override for the primary face-snap threshold (mm). */
    faceThresholdMm?: number;
    /** Override for the anchor-to-anchor secondary snap threshold (mm). */
    anchorThresholdMm?: number;
    /** Kill-switch for snap behaviour on this scene. When false, drag is
     *  pure free-placement and Alt/two-finger bypass is a no-op. */
    enabled?: boolean;
  };
  /**
   * Architectural plans / sections uploaded by the user to accompany
   * the drawing package. Each entry lands as its own page in the PDF
   * (when `includeSheets.architecturalPlans` is on) with a title strip
   * showing label + caption. Kept on the scene doc (small array; the
   * heavy bytes live in Storage).
   */
  architecturalAssets?: SceneArchitecturalAsset[];
  /**
   * Optional parts cutlist overlay — a parsed CSV (PolyBoard / SketchUp
   * / generic) uploaded alongside the 3D model. **Merging with meshed
   * parts happens in Design Studio** (at scene sync): each ScenePart is
   * matched to a row and the combined result is what syncs to Design
   * Manager. Row hits overwrite dimensions, materialName, grain, and
   * edge banding on the outgoing PartEntry — the CSV is the authoritative
   * cutlist for fabrication, the GLB is authoritative for geometry and
   * mesh linkage.
   *
   * Kept as an inline array because a typical cutlist is 20–200 rows
   * (well under Firestore's 1 MiB doc limit) and the enrichment only
   * needs a Map<name, row> lookup — no subcollection query.
   */
  partsCsvOverlay?: ScenePartsCsvOverlay;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

/** A cabinet placed within a scene */
export interface SceneCabinet {
  id: string;
  sceneId: string;
  pddId: string;
  /**
   * Primary archetype — legacy field, still read everywhere. Kept as a
   * single string because a lot of older scene docs carry exactly one
   * archetype and the AI grouper's default context path is built for
   * one. For richer multi-archetype cases (transition pieces, hybrid
   * fixtures) use `archetypeIds` alongside.
   */
  archetypeId?: string;
  /**
   * Extended archetype list. When set, the AI grouper merges every
   * archetype's expectedAssemblies + expectedPartCategories +
   * coverPanelHints into the context block so the model sees the
   * union of hints — useful when a cabinet straddles domains (e.g.
   * a workstation with retail display integration, or a reception
   * counter with pharmacy back-bar elements).
   *
   * Read via `resolveCabinetArchetypes(cabinet)` so both the legacy
   * singular and the new array collapse to one canonical list.
   */
  archetypeIds?: string[];
  cabinetCode: string;
  displayName: string;
  configuration: Record<string, unknown>;
  finishSelections: Record<string, string>;
  position: CabinetPosition;
  rotation: number;
  anchorPoint: CabinetAnchorPoint;
  glbUrl: string;
  thumbnailUrl: string;
  renderUrl?: string;
  /**
   * When a cabinet is born from AI detection on a user-uploaded multi-cabinet
   * model, we persist a reference to the original GLB so the viewport can
   * render it without a per-cabinet GLB export. `sourceMeshNames` enumerates
   * which meshes (by name) from that source belong to this cabinet.
   */
  sourceModelUrl?: string;
  sourceMeshNames?: string[];
  /**
   * Current model-package id produced by Process Model.
   * Set after successful AI processing; absent when never processed.
   */
  packageId?: string;
  assemblies: SceneAssembly[];
  computedBOM: ComputedBOMLine[];
  estimatedPrice: PricingBreakdown;
  /**
   * FK to the DesignItem this cabinet belongs to (M:N Scene↔DesignItem via
   * cabinets — see the P2 audit).
   *
   * Invariant (post-Slice 6, deployed):
   *   - **Project-backed scene** (scene.projectId is a real id): `designItemId`
   *     is REQUIRED. Enforced at three layers — Firestore rules, the
   *     `addCabinetToScene`/`duplicateCabinet` service guards, and every
   *     cabinet-creation UI (`AddCabinetDialog`, `BulkCabinetImportDialog`,
   *     `CabinetDetectionPanel`).
   *   - **Standalone scene** (projectId empty or the `'standalone'`
   *     sentinel): `designItemId` is ABSENT by design. These are the legacy
   *     quick-review scenes that never attach to a project, so there's no
   *     DesignItem to point at.
   *
   * This is why the TypeScript type stays optional: it's the union of both
   * regimes. Call sites that need the project-backed guarantee should
   * narrow via {@link ProjectBoundSceneCabinet} / `isProjectBoundCabinet`
   * from `../utils/sceneProjectUtils`.
   *
   * Use `getCabinetsForDesignItem(designItemId)` (collection-group query)
   * for the reverse lookup — DesignItem does NOT store `sceneIds[]`.
   */
  designItemId?: string;
  mdpId?: string;
  manufacturingOrderId?: string;
  isLocked: boolean;
  /**
   * P21.8 — BOM/pricing frozen at the moment `lockCabinetForProduction`
   * flipped `isLocked=true`. The cost aggregator reads from this snapshot
   * (not the live `computedBOM` / `estimatedPrice`) when `isLocked` is
   * true, so the handover authority is explicit: once a cabinet is
   * committed to production, its contribution to
   * `DesignItem.manufacturingRollup` cannot drift even if someone later
   * rewrites the live fields.
   *
   * Set by `lockCabinetForProduction`; cleared by `unlockCabinet`.
   * Absent on never-locked cabinets.
   */
  lockedSnapshot?: {
    computedBOM: ComputedBOMLine[];
    estimatedPrice: PricingBreakdown;
    lockedAt: Timestamp;
    /** MO id the cabinet was locked against, for audit. */
    manufacturingOrderId: string;
  };
  notes?: string;
  /**
   * How many physical copies of this cabinet design the project requires.
   *
   * Defaults to 1 when absent. Values > 1 mean the scene carries a
   * single "template" SceneCabinet that represents N identical physical
   * units — use this for things like "4 identical base cabinets in
   * the kitchen" instead of duplicating the SceneCabinet N times.
   *
   * Every downstream rollup (cost, BOM, cutting list, DM parts sync)
   * multiplies per-part / per-cabinet figures by this value. Read via
   * `getCabinetRequiredQuantity(cabinet)` — never access directly, so
   * the implicit-1 default is applied consistently.
   */
  requiredQuantity?: number;
  sequence: number;
  /**
   * Cabinet Alignment System (Phase 1) — optional fields. Absent on legacy
   * cabinets; populated as users interact with the new alignment UI.
   */
  /** FK to `designScenes/{sceneId}/groups/{groupId}` when the cabinet is
   *  part of a group. Null/undefined → ungrouped. */
  groupId?: string | null;
  /** CAS token for optimistic concurrency. Incremented by every write that
   *  touches position / rotation / group / mirror. Callers pass the value
   *  they read as `expectedRevision`; writes reject on mismatch so stale
   *  edits don't silently overwrite newer data. */
  revision?: number;

  /**
   * Revision tracking — powers the stale-revision detector + the
   * "Apply latest revision" flow.
   *
   * `lastAppliedRevisionNumber` advances when parts are re-derived from
   * a new GLB and persisted to `modelPackage/current`. A value lower
   * than the project's newest `designRevisions.revisionNumber` means
   * the cabinet's parts are behind the latest 3D model.
   *
   * `lastAppliedRevisionId` pins the exact revision doc so an audit
   * can reconstruct *which* GLB produced the current parts.
   */
  lastAppliedRevisionNumber?: number;
  lastAppliedRevisionId?: string;

  /**
   * Per-part field locks. Set when a user commits a manual decision
   * that should survive a revision re-parse — e.g. accepting a
   * Parts Review rename (nameLocked) or hand-picking a Finish Library
   * entry from the cabinet detail panel (materialLocked). The revision
   * apply flow (`applyRevisionToCabinet`) reads this map to decide
   * which incoming fields to preserve against the new AI grouping.
   *
   * Keyed by `ScenePart.id`. Absent → treat as fully replaceable.
   */
  partOverrides?: Record<string, {
    nameLocked?: boolean;
    materialLocked?: boolean;
    quantityLocked?: boolean;
    /** When the lock was set, for debugging stale overrides. */
    lockedAt?: Timestamp;
  }>;

  /**
   * P4.2 — Per-cabinet CSV overlay. When present, the sync pipeline uses
   * this instead of the scene-level `partsCsvOverlay`, scoping CSV rows
   * to the correct cabinet so multi-cabinet scenes don't cross-contaminate.
   * Absent → fall back to scene-level overlay (backward compatible).
   */
  partsCsvOverlay?: ScenePartsCsvOverlay;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * A SceneCabinet narrowed to the project-backed regime — `designItemId` is
 * guaranteed present. Obtain one via `isProjectBoundCabinet()` or the
 * scene-level assertion when you've already verified the parent scene has
 * a real projectId.
 *
 * See {@link SceneCabinet.designItemId} for why the base type stays
 * optional.
 */
export type ProjectBoundSceneCabinet = SceneCabinet & {
  designItemId: string;
};

/** 3D position of a cabinet in the scene */
export interface CabinetPosition {
  x: number;
  y: number;
  z: number;
  anchoredTo?: 'floor' | 'wall' | 'ceiling' | 'free';
  alignedWithCabinetId?: string;
  alignmentEdge?: 'left' | 'right' | 'front' | 'back';
  /**
   * Cabinet Alignment System (Phase 1) — optional fields.
   *
   * `mirrored`: "Turn Round" flag. When true, the cabinet is rendered
   * flipped about its vertical centerline (X axis scaled -1 at render
   * time). Front-face semantics are preserved — downstream tooling
   * (BOM, manufacturing) should read `mirrored` and adjust hardware
   * handedness rather than treating it as a real 180° rotation.
   *
   * `axisLocks`: Per-axis pin. When `true`, that axis is immovable
   * during drag / nudge / snap / numeric edits. Used by the Positioning
   * panel's "Pin" toggle so a user can lock Y (height) while snapping
   * X/Z, for example.
   */
  mirrored?: boolean;
  axisLocks?: { x?: boolean; y?: boolean; z?: boolean };
}

/** Scene ground plane configuration */
export interface GroundPlane {
  width: number;
  depth: number;
  showGrid: boolean;
  gridSize: number;
  showWalls: boolean;
  walls?: WallSegment[];
}

/** A wall segment in the scene */
export interface WallSegment {
  id: string;
  startX: number;
  startZ: number;
  endX: number;
  endZ: number;
  height: number;
  thickness: number;
}

/** Camera state for scene persistence */
export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  fov: number;
  zoom: number;
}

/**
 * User-uploaded architectural plan / section / elevation that ships
 * with the drawing package. Stored as a Storage URL on the scene doc
 * so a PDF generation can embed it without additional lookups.
 */
export interface SceneArchitecturalAsset {
  id: string;
  /** What is this — "Ground floor plan", "Section A–A", "East elevation". */
  label: string;
  /** Free-form caption rendered under the title strip on the PDF sheet. */
  caption?: string;
  /** Kind of drawing (drives the sheet header icon + grouping). */
  kind: 'plan' | 'section' | 'elevation' | 'detail' | 'other';
  /** Storage URL of the image (PNG / JPG / SVG). PDFs are NOT supported
   *  by the in-browser jsPDF embed — convert to image before upload. */
  fileUrl: string;
  /** Original filename for display / re-upload. */
  fileName: string;
  /** Content type sniffed from the upload — 'image/png', 'image/jpeg'. */
  mimeType: string;
  /** Upload audit. */
  uploadedBy: string;
  uploadedAt: Timestamp;
}

/**
 * Parsed cutlist overlay cached on the scene doc. Rows line up 1:1
 * with the DM `ParsedPart` shape so the same PartEntry mapper that
 * DM's CSV importer uses (`parsedPartsToPartEntries`) can enrich
 * scene parts without reformatting.
 */
export interface ScenePartsCsvOverlay {
  /** Original filename shown in the upload UI. */
  fileName: string;
  /** Detected source — 'polyboard' / 'polyboard-bar' / 'generic' / … */
  sourceType: string;
  /** The parsed rows (what DM's csvParser calls ParsedPart). Kept in
   *  the raw shape so sync-time enrichment stays a straight name-map. */
  rows: Array<{
    name: string;
    length: number;
    width: number;
    thickness: number;
    quantity: number;
    materialName: string;
    materialCode?: string;
    grainDirection: 'length' | 'width' | 'none';
    edgeBanding: {
      top: boolean;
      bottom: boolean;
      left: boolean;
      right: boolean;
      material?: string;
    };
    notes?: string;
    partType: 'sheet' | 'bar';
    barProfile?: string;
  }>;
  uploadedBy: string;
  uploadedAt: Timestamp;
}

/**
 * One row in the project-wide finish schedule table rendered by the
 * PDF generator when `includeSheets.finishSchedule` is on. Built by
 * `aggregateFinishSchedule` from every cabinet's `finishSelections`
 * resolved against the Finish Library.
 */
export interface FinishScheduleEntry {
  /** Finish Library document id — lookup key. */
  finishLibraryId: string;
  /** Display name — e.g. "Oak 18mm veneered MDF". */
  name: string;
  /** Procurement code — e.g. "OAK-18-MDF" or supplier SKU. */
  code?: string;
  /** Colour hex (for swatch rendering), if the finish library carries one. */
  colorHex?: string;
  /** Short user-facing description. */
  description?: string;
  /** How many cabinets in the scene use this finish. */
  cabinetCount: number;
  /** Labels of cabinets using this finish (cabinetCode / displayName). */
  cabinetLabels: string[];
  /** Summed part count (multiplied by cabinet requiredQuantity) using it. */
  partCount: number;
  /** Where the finish is applied, e.g. "carcass", "door_front",
   *  "drawer_front". Aggregated from the cabinet's `finishSelections`
   *  keys so the same finish used in two roles shows both. */
  appliedTo: string[];
}
