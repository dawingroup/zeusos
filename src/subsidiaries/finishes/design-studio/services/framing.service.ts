/**
 * Framing Service — Pure math: derive camera poses from subject bounds + preset
 *
 * No Three.js mutations. No side effects. Fully unit-testable.
 * Every function takes inputs and returns new values.
 */
import type { BoundingSphere, CameraPose, CameraSubject } from '../types/framing.types';
import type { ViewPresetKey } from '../constants/framing.constants';
import {
  FRAMING_PADDING,
  FRAMING_MIN_DISTANCE_MM,
  FRAMING_MAX_DISTANCE_MM,
  PERSPECTIVE_FOV_DEGREES,
  ORTHOGRAPHIC_NEAR_PLANE_MM,
  ORTHOGRAPHIC_FAR_PLANE_MM,
  VIEW_PRESETS,
} from '../constants/framing.constants';

const DEG2RAD = Math.PI / 180;

/** Unit vector */
interface Vec3 { x: number; y: number; z: number }

/**
 * Convert spherical (azimuth, elevation) coordinates to a unit direction vector.
 *
 * Convention:
 *   - Y-up world
 *   - azimuth = 0 points along -Z (toward the camera looking "north")
 *   - azimuth = 90 points along +X (east)
 *   - elevation = 0 is horizontal, 90 is straight up
 */
export function directionFromAzimuthElevation(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = azimuthDeg * DEG2RAD;
  const el = elevationDeg * DEG2RAD;

  const cosEl = Math.cos(el);
  const sinEl = Math.sin(el);
  const cosAz = Math.cos(az);
  const sinAz = Math.sin(az);

  // Direction FROM subject TO camera (so we place the camera out along this vector)
  return {
    x: sinAz * cosEl,
    y: sinEl,
    z: -cosAz * cosEl,  // negative because azimuth 0 looks down -Z (toward camera at +Z... wait no, away)
  };
}

/** Choose a preset for a subject — respects subject.preferredViewPreset override */
export function getPresetForSubject(
  subject: CameraSubject,
  defaultPreset: ViewPresetKey,
): ViewPresetKey {
  return subject.preferredViewPreset ?? defaultPreset;
}

/**
 * Core: given bounds, preset, and viewport aspect, compute the camera pose
 * that frames the subject with FRAMING_PADDING margin.
 */
export function computePoseForSubject(
  bounds: BoundingSphere,
  presetKey: ViewPresetKey,
  _viewportAspect: number,
): CameraPose {
  const preset = VIEW_PRESETS[presetKey];
  const radius = Math.max(bounds.radius, 1); // avoid div by zero on degenerate bounds
  const dir = directionFromAzimuthElevation(preset.azimuth, preset.elevation);

  if (preset.projection === 'perspective') {
    const fov = PERSPECTIVE_FOV_DEGREES;
    const halfFovRad = (fov / 2) * DEG2RAD;
    let distance = (radius / Math.sin(halfFovRad)) * FRAMING_PADDING;

    // Clamp to safe range
    distance = Math.max(FRAMING_MIN_DISTANCE_MM, Math.min(FRAMING_MAX_DISTANCE_MM, distance));

    return {
      position: {
        x: bounds.center.x + dir.x * distance,
        y: bounds.center.y + dir.y * distance,
        z: bounds.center.z + dir.z * distance,
      },
      target: { ...bounds.center },
      up: { x: 0, y: 1, z: 0 },
      projection: 'perspective',
      fov,
      near: Math.max(1, distance - radius * 5),
      far: distance + radius * 10,
    };
  }

  // Orthographic: distance doesn't affect apparent size, but we still set a
  // reasonable distance so rotations look natural and near/far planes work.
  const orthoSize = radius * FRAMING_PADDING;
  const orthoDistance = FRAMING_MAX_DISTANCE_MM * 0.5;

  return {
    position: {
      x: bounds.center.x + dir.x * orthoDistance,
      y: bounds.center.y + dir.y * orthoDistance,
      z: bounds.center.z + dir.z * orthoDistance,
    },
    target: { ...bounds.center },
    up: { x: 0, y: 1, z: 0 },
    projection: 'orthographic',
    orthoSize,
    near: ORTHOGRAPHIC_NEAR_PLANE_MM,
    far: ORTHOGRAPHIC_FAR_PLANE_MM,
  };
}

/**
 * Linearly interpolate two vec3s.
 */
function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

/**
 * Interpolate two camera poses.
 *
 * For perspective ↔ orthographic transitions, we keep the projection of the
 * `to` pose (the animator swaps the camera object at midpoint for visual
 * continuity). Size parameters (fov, orthoSize) interpolate too.
 */
export function interpolatePose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const tt = Math.max(0, Math.min(1, t));
  const useToProjection = tt >= 0.5;
  const projection = useToProjection ? to.projection : from.projection;

  return {
    position: lerpVec3(from.position, to.position, tt),
    target: lerpVec3(from.target, to.target, tt),
    up: lerpVec3(from.up, to.up, tt),
    projection,
    fov: from.fov != null && to.fov != null
      ? from.fov + (to.fov - from.fov) * tt
      : (useToProjection ? to.fov : from.fov),
    orthoSize: from.orthoSize != null && to.orthoSize != null
      ? from.orthoSize + (to.orthoSize - from.orthoSize) * tt
      : (useToProjection ? to.orthoSize : from.orthoSize),
    near: from.near + (to.near - from.near) * tt,
    far: from.far + (to.far - from.far) * tt,
  };
}

/**
 * Ensure camera distance stays within safe clamp range. Adjusts position
 * along the (position - target) direction.
 */
export function clampDistance(
  pose: CameraPose,
  minDist: number = FRAMING_MIN_DISTANCE_MM,
  maxDist: number = FRAMING_MAX_DISTANCE_MM,
): CameraPose {
  const dx = pose.position.x - pose.target.x;
  const dy = pose.position.y - pose.target.y;
  const dz = pose.position.z - pose.target.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist >= minDist && dist <= maxDist) return pose;
  if (dist === 0) return pose; // degenerate — can't project

  const clamped = Math.max(minDist, Math.min(maxDist, dist));
  const scale = clamped / dist;

  return {
    ...pose,
    position: {
      x: pose.target.x + dx * scale,
      y: pose.target.y + dy * scale,
      z: pose.target.z + dz * scale,
    },
  };
}
