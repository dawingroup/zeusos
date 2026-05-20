/**
 * Configurator Types
 *
 * Types for the product configurator state, actions, and shareable configurations.
 */
import type { Timestamp } from 'firebase/firestore';
import type { ConstraintValidationResult } from './constraintEngine.types';
import type { ConfiguratorMode } from '../constants/configurator.constants';

/** Full configurator state */
export interface ConfiguratorState {
  pddId: string;
  mode: ConfiguratorMode;
  parameters: Record<string, unknown>;
  finishSelections: Record<string, string>;
  validationResult: ConstraintValidationResult | null;
  isValidating: boolean;
  lastValidatedAt: Timestamp | null;
  shareableUrl: string | null;
}

/** Actions dispatched to configurator reducer */
export type ConfiguratorAction =
  | { type: 'SET_PARAMETER'; payload: { key: string; value: unknown } }
  | { type: 'SET_FINISH'; payload: { group: string; finishId: string } }
  | { type: 'RESET' }
  | { type: 'LOAD_ARCHETYPE'; payload: { archetypeId: string } }
  | { type: 'VALIDATE'; payload: ConstraintValidationResult }
  | { type: 'SET_VALIDATING'; payload: boolean }
  | { type: 'REQUEST_QUOTE' }
  | { type: 'REQUEST_MO' };

/** URL-serializable configuration for sharing */
export interface ShareableConfiguration {
  pddId: string;
  params: Record<string, unknown>;
  finishes: Record<string, string>;
  version: number;
}
