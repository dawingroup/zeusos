/**
 * useSceneSelection — Four-level scene selection state
 *
 * Manages selection at project/cabinet/assembly/part levels.
 * Supports multi-select, isolation, and hover tracking.
 */
import { useReducer, useCallback } from 'react';
import type { SceneSelection, SelectionAction } from '../types/selection.types';
import type { SelectionMode } from '../constants/scene.constants';

function selectionReducer(state: SceneSelection, action: SelectionAction): SceneSelection {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload, selectedIds: [] };
    case 'SELECT':
      return { ...state, selectedIds: [action.payload] };
    case 'TOGGLE_SELECT': {
      const id = action.payload;
      const has = state.selectedIds.includes(id);
      return {
        ...state,
        selectedIds: has
          ? state.selectedIds.filter(i => i !== id)
          : [...state.selectedIds, id],
      };
    }
    case 'SELECT_RANGE':
      return { ...state, selectedIds: action.payload };
    case 'CLEAR':
      return { ...state, selectedIds: [], isolatedId: undefined, hoverId: undefined };
    case 'ISOLATE':
      return { ...state, isolatedId: action.payload };
    case 'UNISOLATE':
      return { ...state, isolatedId: undefined };
    case 'HOVER':
      return { ...state, hoverId: action.payload };
    default:
      return state;
  }
}

const INITIAL_SELECTION: SceneSelection = {
  mode: 'cabinet',
  selectedIds: [],
  isolatedId: undefined,
  hoverId: undefined,
};

export function useSceneSelection() {
  const [selection, dispatch] = useReducer(selectionReducer, INITIAL_SELECTION);

  const setMode = useCallback((mode: SelectionMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  const select = useCallback((id: string) => {
    dispatch({ type: 'SELECT', payload: id });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_SELECT', payload: id });
  }, []);

  const selectRange = useCallback((ids: string[]) => {
    dispatch({ type: 'SELECT_RANGE', payload: ids });
  }, []);

  const clear = useCallback(() => {
    dispatch({ type: 'CLEAR' });
  }, []);

  const isolate = useCallback((id: string) => {
    dispatch({ type: 'ISOLATE', payload: id });
  }, []);

  const unisolate = useCallback(() => {
    dispatch({ type: 'UNISOLATE' });
  }, []);

  const hover = useCallback((id: string | undefined) => {
    dispatch({ type: 'HOVER', payload: id });
  }, []);

  return {
    selection,
    setMode,
    select,
    toggleSelect,
    selectRange,
    clear,
    isolate,
    unisolate,
    hover,
    selectedId: selection.selectedIds[0] ?? null,
    /**
     * Full multi-select id list (may have length 0, 1, or N). Use this
     * for panels like PositioningPanel that need to operate on every
     * selected cabinet (e.g. centroid-delta moves). Single-select-only
     * callers keep using `selectedId`.
     */
    selectedIds: selection.selectedIds,
    isIsolated: !!selection.isolatedId,
  };
}
