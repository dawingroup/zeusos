/**
 * Scene Constants — Multi-cabinet scene composition
 */

export const SCENE_NODE_TYPES = ['project', 'cabinet', 'assembly', 'part'] as const;
export type SceneNodeType = (typeof SCENE_NODE_TYPES)[number];

export const SELECTION_MODES = ['project', 'cabinet', 'assembly', 'part'] as const;
export type SelectionMode = (typeof SELECTION_MODES)[number];

export const POSITIONING_MODES = ['free', 'snap_floor', 'snap_wall', 'grid_300mm', 'align_run'] as const;
export type PositioningMode = (typeof POSITIONING_MODES)[number];

export const VIEWPORT_VIEW_MODES = ['scene', 'isolated_cabinet', 'exploded_assembly', 'single_part'] as const;
export type ViewportViewMode = (typeof VIEWPORT_VIEW_MODES)[number];

export const GROUND_PLANE_SIZE_MM = 10_000;
export const GROUND_PLANE_GRID_MM = 100;

export const DEFAULT_CABINET_SPACING_MM = 0;
export const WALL_GAP_MM = 2;

/** Default distance (mm) within which a dragged cabinet's face snaps
 *  flush to a neighbouring cabinet's face. Matches the Cabinet
 *  Alignment System spec (50mm) — generous enough that snap feels
 *  "magnetic" during casual drag, tight enough that free placement
 *  in open areas stays 1:1 with the cursor. Scenes can override per
 *  scene via `DesignScene.snapSettings.faceThresholdMm`. */
export const SNAP_THRESHOLD_MM = 50;

/** Distance (mm) within which a dragged cabinet's named corner anchor
 *  snaps to a neighbouring cabinet's corner anchor along the already-
 *  matched face. Applied as a secondary translation *after* the face
 *  snap — e.g. two base cabinets snap flush on their side faces, then
 *  auto-align their front edges if the anchor pair is within this
 *  threshold. Smaller than the face threshold because the user has
 *  already committed to alignment by getting the faces touching. */
export const ANCHOR_THRESHOLD_MM = 20;

/** Arrow-key nudge distance (mm). Phase 4 keyboard handler uses this
 *  as the default; Shift divides by 10 (fine), Ctrl multiplies by 10
 *  (coarse). */
export const NUDGE_STEP_MM = 10;

/** Rotation snap increment (degrees). Phase 4 Rotate dialog uses this
 *  when "Snap to 15°" is checked. 15° covers 0/15/30/45/60/75/90 —
 *  the angles needed for irregular rooms. */
export const ROTATION_SNAP_DEG = 15;

/** Minimum measurable distance on the app (mm). All cabinet positions are
 *  rounded to this granularity — no sub-millimetre floating-point noise in
 *  stored coordinates, and drag motion feels deterministic. */
export const POSITION_GRID_MM = 1;

/** Fallback dimensions when a cabinet's configuration is missing width/depth
 *  (e.g. AI-detected cabinets before the archetype is resolved). Same values
 *  used by SceneLayoutEditor. */
export const DEFAULT_CABINET_WIDTH_MM = 600;
export const DEFAULT_CABINET_DEPTH_MM = 560;

export const MAX_SCENE_PARTS = 5000;
export const LOD_THRESHOLD_PARTS = 500;

/** TransformControls size multiplier. 2.0 is ~40% larger than the
 *  stock 1.4 — easier to hit on trackpads, small enough not to
 *  occlude small cabinets. iPad users benefit the most. */
export const GIZMO_SIZE = 2.0;

/** Three.js renderOrder for the gizmo helper. Keeps the arrows /
 *  rings in front of every cabinet wall. */
export const GIZMO_RENDER_ORDER = 999;

/** Default ground-plane padding multiplier. The dynamic ground plane
 *  always keeps (max-scene-extent × this) space around the scene,
 *  clamped so it never shrinks below `GROUND_PLANE_SIZE_MM`. */
export const GROUND_PLANE_PADDING = 1.5;

/** Free-slot placement — spacing between newly-added cabinets when
 *  the caller doesn't supply a position. 20mm keeps them visually
 *  separate without forcing the user to close large gaps manually. */
export const NEW_CABINET_SPACING_MM = 20;

/** Free-slot placement — maximum row width along +X before wrapping
 *  to a new row along +Z. 4m matches typical kitchen run length. */
export const NEW_CABINET_ROW_WIDTH_MM = 4_000;
