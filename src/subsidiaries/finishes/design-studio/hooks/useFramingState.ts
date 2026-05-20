/**
 * useFramingState — Reducer-based framing state
 *
 * Single source of truth for what the camera is looking at and how.
 * Dispatches FramingActions. Coordinates bounds service + framing service.
 */
import { useReducer, useCallback } from 'react';
import type { FramingState, FramingAction, CameraSubject, CameraPose, BoundingSphere } from '../types/framing.types';
import type { ViewPresetKey } from '../constants/framing.constants';
import { DEFAULT_VIEW_PRESET, VIEW_PRESETS } from '../constants/framing.constants';

const INITIAL_POSE: CameraPose = {
  position: { x: 3000, y: 2000, z: 3000 },
  target: { x: 0, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  projection: 'perspective',
  fov: 35,
  near: 1,
  far: 50_000,
};

const INITIAL_SUBJECT: CameraSubject = {
  type: 'scene',
  id: 'root',
  bounds: { center: { x: 0, y: 0, z: 0 }, radius: 1000 },
};

const INITIAL_STATE: FramingState = {
  subject: INITIAL_SUBJECT,
  preset: DEFAULT_VIEW_PRESET,
  pose: INITIAL_POSE,
  isUserControlled: false,
  isAnimating: false,
  lastUserInteractionAt: null,
};

function reducer(state: FramingState, action: FramingAction): FramingState {
  switch (action.type) {
    case 'SET_SUBJECT':
      // Selection change updates *what* we're focused on but must NOT
      // flip `isUserControlled` — doing so made the camera re-frame on
      // every cabinet click, ripping the user out of the vantage they
      // had carefully set up. Keep their stance; explicit re-frame
      // gestures (`SET_PRESET`, `RECENTER`) still reset the flag.
      return {
        ...state,
        subject: action.payload,
      };
    case 'SET_PRESET':
      return {
        ...state,
        preset: action.payload,
        isUserControlled: false,
      };
    case 'SET_PROJECTION': {
      // Find a preset with the requested projection, preferring current preset family
      const current = VIEW_PRESETS[state.preset];
      if (current.projection === action.payload) return state;
      // Fall back to iso_ne (perspective) or front (orthographic)
      const fallback: ViewPresetKey = action.payload === 'perspective' ? 'iso_ne' : 'front';
      return {
        ...state,
        preset: fallback,
        isUserControlled: false,
      };
    }
    case 'USER_INTERACTION_START':
      return {
        ...state,
        isUserControlled: true,
        lastUserInteractionAt: Date.now(),
      };
    case 'USER_INTERACTION_END':
      return {
        ...state,
        lastUserInteractionAt: Date.now(),
      };
    case 'RECENTER':
      return {
        ...state,
        isUserControlled: false,
      };
    case 'SET_CUSTOM_BOUNDS':
      return {
        ...state,
        subject: {
          type: 'custom_bounds',
          id: 'custom',
          bounds: action.payload,
        },
        isUserControlled: false,
      };
    case 'ANIMATION_START':
      return { ...state, isAnimating: true };
    case 'ANIMATION_END':
      return { ...state, isAnimating: false };
    case 'SET_POSE':
      return { ...state, pose: action.payload };
    default:
      return state;
  }
}

interface UseFramingStateResult {
  state: FramingState;
  setSubject: (subject: CameraSubject) => void;
  setPreset: (preset: ViewPresetKey) => void;
  setProjection: (projection: 'perspective' | 'orthographic') => void;
  startInteraction: () => void;
  endInteraction: () => void;
  recenter: () => void;
  setCustomBounds: (bounds: BoundingSphere) => void;
  startAnimation: () => void;
  endAnimation: () => void;
  setPose: (pose: CameraPose) => void;
}

export function useFramingState(initial?: Partial<FramingState>): UseFramingStateResult {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, ...initial });

  return {
    state,
    setSubject: useCallback((subject: CameraSubject) => dispatch({ type: 'SET_SUBJECT', payload: subject }), []),
    setPreset: useCallback((preset: ViewPresetKey) => dispatch({ type: 'SET_PRESET', payload: preset }), []),
    setProjection: useCallback((projection: 'perspective' | 'orthographic') => dispatch({ type: 'SET_PROJECTION', payload: projection }), []),
    startInteraction: useCallback(() => dispatch({ type: 'USER_INTERACTION_START' }), []),
    endInteraction: useCallback(() => dispatch({ type: 'USER_INTERACTION_END' }), []),
    recenter: useCallback(() => dispatch({ type: 'RECENTER' }), []),
    setCustomBounds: useCallback((bounds: BoundingSphere) => dispatch({ type: 'SET_CUSTOM_BOUNDS', payload: bounds }), []),
    startAnimation: useCallback(() => dispatch({ type: 'ANIMATION_START' }), []),
    endAnimation: useCallback(() => dispatch({ type: 'ANIMATION_END' }), []),
    setPose: useCallback((pose: CameraPose) => dispatch({ type: 'SET_POSE', payload: pose }), []),
  };
}
