/**
 * Framing Constants — RealityKit-inspired auto-framing system
 *
 * Every value here is tuned for millimeter units (Dawin Finishes uses mm
 * throughout, matching PolyBoard exports).
 */

export const FRAMING_PADDING = 1.15;            // 15% margin around subject
export const FRAMING_MIN_DISTANCE_MM = 200;
export const FRAMING_MAX_DISTANCE_MM = 50_000;

export const CAMERA_TRANSITION_DURATION_MS = 400;
export const CAMERA_TRANSITION_EASING = 'easeOutCubic' as const;
export type TransitionEasing = typeof CAMERA_TRANSITION_EASING | 'linear' | 'easeInCubic' | 'easeInOutCubic';

export const PERSPECTIVE_FOV_DEGREES = 35;
export const ORTHOGRAPHIC_NEAR_PLANE_MM = -50_000;
export const ORTHOGRAPHIC_FAR_PLANE_MM = 50_000;

export const USER_CONTROL_PAUSE_MS = 100;
export const RECENTER_HOTKEY = 'f';

/** Azimuth + elevation (degrees) + projection for each canonical view */
export type ViewPresetKey =
  | 'iso_ne' | 'iso_nw' | 'iso_se' | 'iso_sw'
  | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'
  | 'three_quarter' | 'perspective_default';

export interface ViewPresetDef {
  azimuth: number;      // rotation around vertical axis (0 = facing -Z/north, 90 = +X/east)
  elevation: number;    // 0 = horizontal, 90 = straight down (top-down)
  projection: 'perspective' | 'orthographic';
}

export const VIEW_PRESETS: Record<ViewPresetKey, ViewPresetDef> = {
  iso_ne:              { azimuth:  45,  elevation:  35, projection: 'perspective' },
  iso_nw:              { azimuth: -45,  elevation:  35, projection: 'perspective' },
  iso_se:              { azimuth:  135, elevation:  35, projection: 'perspective' },
  iso_sw:              { azimuth: -135, elevation:  35, projection: 'perspective' },
  front:               { azimuth:  0,   elevation:  0,  projection: 'orthographic' },
  back:                { azimuth:  180, elevation:  0,  projection: 'orthographic' },
  left:                { azimuth: -90,  elevation:  0,  projection: 'orthographic' },
  right:               { azimuth:  90,  elevation:  0,  projection: 'orthographic' },
  top:                 { azimuth:  0,   elevation:  90, projection: 'orthographic' },
  bottom:              { azimuth:  0,   elevation: -90, projection: 'orthographic' },
  three_quarter:       { azimuth:  30,  elevation:  20, projection: 'perspective' },
  perspective_default: { azimuth:  25,  elevation:  22, projection: 'perspective' },
};

export const DEFAULT_VIEW_PRESET: ViewPresetKey = 'iso_ne';

/** Preset keys grouped for UI */
export const ISO_PRESETS: ViewPresetKey[] = ['iso_ne', 'iso_nw', 'iso_se', 'iso_sw'];
export const ORTHO_PRESETS: ViewPresetKey[] = ['front', 'back', 'left', 'right', 'top', 'bottom'];
export const PERSPECTIVE_PRESETS: ViewPresetKey[] = ['three_quarter', 'perspective_default'];

/** Human-friendly labels */
export const PRESET_LABELS: Record<ViewPresetKey, string> = {
  iso_ne: 'Iso NE',
  iso_nw: 'Iso NW',
  iso_se: 'Iso SE',
  iso_sw: 'Iso SW',
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
  top: 'Top',
  bottom: 'Bottom',
  three_quarter: '3/4 View',
  perspective_default: 'Perspective',
};
