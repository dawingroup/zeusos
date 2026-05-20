/**
 * useAutoFraming — Top-level orchestration for the framing system
 *
 * Wires: subject (selection) + preset + bounds cache + camera + controls
 * → smooth animated re-framing whenever any input changes.
 *
 * The caller owns the Three.js scene / camera / controls refs and passes
 * them in. The hook manages the framing state and animations.
 */
import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { CameraSubject } from '../types/framing.types';
import type { ViewPresetKey } from '../constants/framing.constants';
import { useFramingState } from './useFramingState';
import { useBoundsCache } from './useBoundsCache';
import { useUserInteractionDetector } from './useUserInteractionDetector';
import { getBoundsForSubject } from '../services/bounds.service';
import { computePoseForSubject } from '../services/framing.service';
import { animateToPose, snapToPose, cancelAnimation, updateTweens, type TweenHandle } from '../services/cameraAnimator.service';

interface OrbitControlsLike {
  target: THREE.Vector3;
  update: () => void;
  addEventListener: (type: string, handler: (event?: unknown) => void) => void;
  removeEventListener: (type: string, handler: (event?: unknown) => void) => void;
  enabled?: boolean;
}

interface UseAutoFramingOptions {
  threeScene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera | null;
  controls: OrbitControlsLike | null;
  onCameraSwap?: (newCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera) => void;
  /** Initial subject — if not provided, starts with scene root */
  initialSubject?: CameraSubject;
}

interface UseAutoFramingResult {
  setSubject: (subject: CameraSubject) => void;
  setPreset: (preset: ViewPresetKey) => void;
  setProjection: (projection: 'perspective' | 'orthographic') => void;
  recenter: () => void;
  /** Current state exposed for UI indicators */
  isUserControlled: boolean;
  isAnimating: boolean;
  currentSubject: CameraSubject;
  currentPreset: ViewPresetKey;
  /** Bounds cache invalidation (call when geometry changes) */
  invalidateBounds: (scope?: 'scene' | 'cabinet' | 'assembly' | 'part' | 'all', id?: string) => void;
  /** Call every frame before renderer.render() */
  updateAnimations: () => void;
}

export function useAutoFraming(opts: UseAutoFramingOptions): UseAutoFramingResult {
  const { threeScene, camera, controls, onCameraSwap, initialSubject } = opts;
  const { state, setSubject, setPreset, setProjection, startInteraction, endInteraction, recenter: dispatchRecenter, startAnimation, endAnimation } = useFramingState(initialSubject ? { subject: initialSubject } : undefined);
  const { cache, invalidate } = useBoundsCache();

  const activeTweenRef = useRef<TweenHandle | null>(null);
  const lastKeyRef = useRef<string>('');

  // Detect user interactions with orbit controls
  useUserInteractionDetector({
    controls,
    onStart: startInteraction,
    onEnd: endInteraction,
  });

  // Framing effect: whenever subject/preset changes (and we're not user-controlled),
  // compute the target pose and animate the camera to it.
  useEffect(() => {
    if (!camera || !controls || !threeScene) return;
    if (state.isUserControlled) return;

    // Get fresh bounds for the current subject
    const bounds = getBoundsForSubject(state.subject, threeScene, cache);
    if (bounds.radius === 0) {
      // No geometry yet — wait for next render when bounds are available
      return;
    }

    // Build the target subject with current bounds
    const subjectWithBounds: CameraSubject = {
      ...state.subject,
      bounds,
    };

    const aspect = camera instanceof THREE.PerspectiveCamera
      ? camera.aspect
      : (camera.right - camera.left) / (camera.top - camera.bottom);

    const targetPose = computePoseForSubject(bounds, state.preset, aspect);

    // Cheap key to avoid re-animating on unchanged state
    const key = `${subjectWithBounds.type}:${subjectWithBounds.id}:${state.preset}:${bounds.radius.toFixed(1)}:${bounds.center.x.toFixed(1)},${bounds.center.y.toFixed(1)},${bounds.center.z.toFixed(1)}`;
    if (key === lastKeyRef.current) return;
    lastKeyRef.current = key;

    // Capture current pose as starting point
    const fromPose = {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
      up: { x: 0, y: 1, z: 0 },
      projection: (camera instanceof THREE.PerspectiveCamera ? 'perspective' : 'orthographic') as 'perspective' | 'orthographic',
      fov: camera instanceof THREE.PerspectiveCamera ? camera.fov : undefined,
      orthoSize: camera instanceof THREE.OrthographicCamera ? camera.top : undefined,
      near: camera.near,
      far: camera.far,
    };

    // Cancel any running animation
    cancelAnimation(activeTweenRef.current);

    // If this is the first-ever frame or user just pressed Recenter, snap instantly.
    // Otherwise animate.
    const isInitial = lastKeyRef.current === key && fromPose.position.x === 0 && fromPose.position.y === 0 && fromPose.position.z === 0;
    if (isInitial) {
      snapToPose(camera, controls, targetPose);
      return;
    }

    startAnimation();
    if (controls.enabled !== undefined) controls.enabled = false;

    activeTweenRef.current = animateToPose({
      camera,
      controls,
      fromPose,
      toPose: targetPose,
      onCameraSwap,
      onComplete: () => {
        endAnimation();
        if (controls.enabled !== undefined) controls.enabled = true;
        activeTweenRef.current = null;
      },
    });
  }, [camera, controls, threeScene, state.subject, state.preset, state.isUserControlled, cache, onCameraSwap, startAnimation, endAnimation]);

  // Keep tweens advancing
  const updateAnimations = useCallback(() => {
    updateTweens();
  }, []);

  // Recenter = clear user-controlled flag which triggers the framing effect
  const recenter = useCallback(() => {
    // Force a key mismatch so the effect fires
    lastKeyRef.current = '';
    dispatchRecenter();
  }, [dispatchRecenter]);

  return {
    setSubject,
    setPreset,
    setProjection,
    recenter,
    isUserControlled: state.isUserControlled,
    isAnimating: state.isAnimating,
    currentSubject: state.subject,
    currentPreset: state.preset,
    invalidateBounds: invalidate,
    updateAnimations,
  };
}
