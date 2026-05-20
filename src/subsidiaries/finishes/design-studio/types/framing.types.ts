/**
 * Framing Types — Auto-framing camera system
 *
 * The camera always has a subject. Bounds are the source of truth.
 * Projection is independent of subject. Transitions are animated.
 * User control overrides framing temporarily.
 */
import type { ViewPresetKey } from '../constants/framing.constants';

/** Axis-aligned bounding sphere — rotation-invariant, simpler framing math */
export interface BoundingSphere {
  center: { x: number; y: number; z: number };
  radius: number;                       // mm — encompasses all geometry
}

/** What the camera is currently framing. Always defined. */
export interface CameraSubject {
  type: 'scene' | 'cabinet' | 'assembly' | 'part' | 'custom_bounds';
  id: string;                           // sceneId, cabinetId, assemblyId, partId, or 'custom'
  bounds: BoundingSphere;
  preferredViewPreset?: ViewPresetKey;
}

/** Complete camera state — what the framing system targets */
export interface CameraPose {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  projection: 'perspective' | 'orthographic';
  fov?: number;                         // degrees, perspective only
  orthoSize?: number;                   // half-height of view frustum, orthographic only
  near: number;
  far: number;
}

/** Top-level framing reducer state */
export interface FramingState {
  subject: CameraSubject;
  preset: ViewPresetKey;
  pose: CameraPose;
  isUserControlled: boolean;
  isAnimating: boolean;
  lastUserInteractionAt: number | null; // ms since epoch
}

/** Reducer actions */
export type FramingAction =
  | { type: 'SET_SUBJECT'; payload: CameraSubject }
  | { type: 'SET_PRESET'; payload: ViewPresetKey }
  | { type: 'SET_PROJECTION'; payload: 'perspective' | 'orthographic' }
  | { type: 'USER_INTERACTION_START' }
  | { type: 'USER_INTERACTION_END' }
  | { type: 'RECENTER' }
  | { type: 'SET_CUSTOM_BOUNDS'; payload: BoundingSphere }
  | { type: 'ANIMATION_START' }
  | { type: 'ANIMATION_END' }
  | { type: 'SET_POSE'; payload: CameraPose };

/** Per-entity bounds cache — populated on demand, invalidated on geometry changes */
export interface BoundsCache {
  sceneBounds?: BoundingSphere;
  cabinetBounds: Record<string, BoundingSphere>;
  assemblyBounds: Record<string, BoundingSphere>;
  partBounds: Record<string, BoundingSphere>;
  computedAt: number;                   // ms since epoch
  geometryVersion: number;              // bumped when any geometry changes
}

/** Input for bounds computation — a Three.js Object3D is needed */
export interface BoundsComputeContext {
  threeScene: unknown;                  // THREE.Scene (unknown to keep type deps light here)
  cache: BoundsCache;
}
