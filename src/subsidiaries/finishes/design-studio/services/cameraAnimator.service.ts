/**
 * Camera Animator Service — Animated Three.js camera mutations
 *
 * Wraps @tweenjs/tween.js for smooth transitions. Handles the tricky
 * PerspectiveCamera ↔ OrthographicCamera swap at animation midpoint.
 */
import * as THREE from 'three';
import { Tween, Easing, update as tweenUpdate } from '@tweenjs/tween.js';
import type { CameraPose } from '../types/framing.types';
import { CAMERA_TRANSITION_DURATION_MS } from '../constants/framing.constants';

export interface TweenHandle {
  stop: () => void;
  tween: Tween<object>;
}

export interface AnimateToPoseOptions {
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  controls: { target: THREE.Vector3; update: () => void };
  fromPose: CameraPose;
  toPose: CameraPose;
  durationMs?: number;
  easing?: (t: number) => number;
  onUpdate?: (pose: CameraPose) => void;
  onComplete?: () => void;
  /** Called when camera type changes mid-animation so caller can swap refs */
  onCameraSwap?: (newCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera) => void;
}

/**
 * Animate from one pose to another. Uses requestAnimationFrame via tween.js.
 */
export function animateToPose(opts: AnimateToPoseOptions): TweenHandle {
  const {
    camera, controls, fromPose, toPose,
    durationMs = CAMERA_TRANSITION_DURATION_MS,
    easing = Easing.Cubic.Out,
    onUpdate, onComplete, onCameraSwap,
  } = opts;

  const state = {
    px: fromPose.position.x, py: fromPose.position.y, pz: fromPose.position.z,
    tx: fromPose.target.x, ty: fromPose.target.y, tz: fromPose.target.z,
    fov: fromPose.fov ?? 35,
    orthoSize: fromPose.orthoSize ?? 500,
    near: fromPose.near,
    far: fromPose.far,
    t: 0,
  };

  const target = {
    px: toPose.position.x, py: toPose.position.y, pz: toPose.position.z,
    tx: toPose.target.x, ty: toPose.target.y, tz: toPose.target.z,
    fov: toPose.fov ?? state.fov,
    orthoSize: toPose.orthoSize ?? state.orthoSize,
    near: toPose.near,
    far: toPose.far,
    t: 1,
  };

  // For projection swap, we'll detect the midpoint crossing
  const needsSwap = fromPose.projection !== toPose.projection;
  let swapped = false;
  let activeCamera = camera;

  const tween = new Tween(state)
    .to(target, durationMs)
    .easing(easing)
    .onUpdate(() => {
      // Handle camera swap at midpoint
      if (needsSwap && !swapped && state.t >= 0.5) {
        const newCam = swapCameraType(activeCamera, toPose.projection, {
          aspect: activeCamera instanceof THREE.PerspectiveCamera
            ? activeCamera.aspect
            : (activeCamera.right - activeCamera.left) / (activeCamera.top - activeCamera.bottom),
        }, {
          position: state,
          fov: state.fov,
          orthoSize: state.orthoSize,
          near: state.near,
          far: state.far,
        });
        activeCamera = newCam;
        swapped = true;
        onCameraSwap?.(newCam);
      }

      // Apply current state to the active camera
      activeCamera.position.set(state.px, state.py, state.pz);
      controls.target.set(state.tx, state.ty, state.tz);
      activeCamera.lookAt(state.tx, state.ty, state.tz);

      if (activeCamera instanceof THREE.PerspectiveCamera) {
        activeCamera.fov = state.fov;
        activeCamera.near = state.near;
        activeCamera.far = state.far;
        activeCamera.updateProjectionMatrix();
      } else {
        const half = state.orthoSize;
        const aspect = (activeCamera.right - activeCamera.left) / (activeCamera.top - activeCamera.bottom) || 1;
        activeCamera.left = -half * aspect;
        activeCamera.right = half * aspect;
        activeCamera.top = half;
        activeCamera.bottom = -half;
        activeCamera.near = state.near;
        activeCamera.far = state.far;
        activeCamera.updateProjectionMatrix();
      }

      controls.update();
      onUpdate?.({
        position: { x: state.px, y: state.py, z: state.pz },
        target: { x: state.tx, y: state.ty, z: state.tz },
        up: { x: 0, y: 1, z: 0 },
        projection: activeCamera instanceof THREE.PerspectiveCamera ? 'perspective' : 'orthographic',
        fov: state.fov,
        orthoSize: state.orthoSize,
        near: state.near,
        far: state.far,
      });
    })
    .onComplete(() => {
      onComplete?.();
    })
    .start();

  return {
    tween,
    stop: () => tween.stop(),
  };
}

/**
 * Set camera pose instantly, no animation.
 */
export function snapToPose(
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  controls: { target: THREE.Vector3; update: () => void },
  pose: CameraPose,
): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  let activeCamera = camera;
  const currentType = camera instanceof THREE.PerspectiveCamera ? 'perspective' : 'orthographic';

  if (currentType !== pose.projection) {
    const aspect = camera instanceof THREE.PerspectiveCamera
      ? camera.aspect
      : (camera.right - camera.left) / (camera.top - camera.bottom);

    activeCamera = swapCameraType(camera, pose.projection, { aspect }, {
      position: { px: pose.position.x, py: pose.position.y, pz: pose.position.z },
      fov: pose.fov ?? 35,
      orthoSize: pose.orthoSize ?? 500,
      near: pose.near,
      far: pose.far,
    });
  }

  activeCamera.position.set(pose.position.x, pose.position.y, pose.position.z);
  controls.target.set(pose.target.x, pose.target.y, pose.target.z);
  activeCamera.lookAt(pose.target.x, pose.target.y, pose.target.z);

  if (activeCamera instanceof THREE.PerspectiveCamera && pose.fov != null) {
    activeCamera.fov = pose.fov;
  } else if (activeCamera instanceof THREE.OrthographicCamera && pose.orthoSize != null) {
    const half = pose.orthoSize;
    const aspect = (activeCamera.right - activeCamera.left) / (activeCamera.top - activeCamera.bottom) || 1;
    activeCamera.left = -half * aspect;
    activeCamera.right = half * aspect;
    activeCamera.top = half;
    activeCamera.bottom = -half;
  }

  activeCamera.near = pose.near;
  activeCamera.far = pose.far;
  activeCamera.updateProjectionMatrix();
  controls.update();

  return activeCamera;
}

/**
 * Create a new camera of the requested type, populated from current state.
 */
export function swapCameraType(
  _currentCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  newType: 'perspective' | 'orthographic',
  viewport: { aspect: number },
  state: {
    position: { px: number; py: number; pz: number };
    fov: number;
    orthoSize: number;
    near: number;
    far: number;
  },
): THREE.PerspectiveCamera | THREE.OrthographicCamera {
  const aspect = viewport.aspect || 1;
  let newCam: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  if (newType === 'perspective') {
    newCam = new THREE.PerspectiveCamera(state.fov, aspect, Math.max(1, state.near), state.far);
  } else {
    const half = state.orthoSize;
    newCam = new THREE.OrthographicCamera(
      -half * aspect, half * aspect,
      half, -half,
      state.near, state.far,
    );
  }

  newCam.position.set(state.position.px, state.position.py, state.position.pz);
  newCam.updateProjectionMatrix();

  // Copy lookAt state — caller sets target via controls.target
  return newCam;
}

/**
 * Cancel an in-progress animation.
 */
export function cancelAnimation(handle: TweenHandle | null | undefined): void {
  handle?.stop();
}

/**
 * Call from the render loop to advance all active tweens.
 * Must be called every frame (before renderer.render).
 */
export function updateTweens(time?: number): void {
  tweenUpdate(time);
}

export { Easing };
