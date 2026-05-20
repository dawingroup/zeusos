/**
 * Selection Types — Four-level scene selection and isolation
 */
import type { SelectionMode } from '../constants/scene.constants';

/** Current selection state in the scene */
export interface SceneSelection {
  mode: SelectionMode;
  selectedIds: string[];
  isolatedId?: string;
  hoverId?: string;
}

/** Actions dispatched to scene selection reducer */
export type SelectionAction =
  | { type: 'SET_MODE'; payload: SelectionMode }
  | { type: 'SELECT'; payload: string }
  | { type: 'TOGGLE_SELECT'; payload: string }
  | { type: 'SELECT_RANGE'; payload: string[] }
  | { type: 'CLEAR' }
  | { type: 'ISOLATE'; payload: string }
  | { type: 'UNISOLATE' }
  | { type: 'HOVER'; payload: string | undefined };
