/**
 * useConfiguratorState — Reducer-based state management for the product configurator
 */
import { useReducer, useEffect, useCallback } from 'react';
import type { ConfiguratorState, ConfiguratorAction } from '../types/configurator.types';
import type { ConfiguratorMode } from '../constants/configurator.constants';
import { useConstraintValidator } from './useConstraintValidator';
import { useProductDefinition } from './useProductDefinition';

function configuratorReducer(
  state: ConfiguratorState,
  action: ConfiguratorAction,
): ConfiguratorState {
  switch (action.type) {
    case 'SET_PARAMETER':
      return {
        ...state,
        parameters: {
          ...state.parameters,
          [action.payload.key]: action.payload.value,
        },
      };
    case 'SET_FINISH':
      return {
        ...state,
        finishSelections: {
          ...state.finishSelections,
          [action.payload.group]: action.payload.finishId,
        },
      };
    case 'RESET':
      return {
        ...state,
        parameters: {},
        finishSelections: {},
        validationResult: null,
        shareableUrl: null,
      };
    case 'VALIDATE':
      return {
        ...state,
        validationResult: action.payload,
        isValidating: false,
      };
    case 'SET_VALIDATING':
      return { ...state, isValidating: action.payload };
    default:
      return state;
  }
}

export function useConfiguratorState(pddId: string, mode: ConfiguratorMode = 'workshop') {
  const { data: pdd } = useProductDefinition(pddId);
  const { validate, validationResult, isValidating, violations, warnings, computedBOM, estimatedPrice, stockAvailability } =
    useConstraintValidator(pddId);

  // Initialize state with PDD defaults
  const initialParameters: Record<string, unknown> = {};
  if (pdd) {
    for (const param of pdd.parameters) {
      initialParameters[param.key] = param.default;
    }
  }

  const [state, dispatch] = useReducer(configuratorReducer, {
    pddId,
    mode,
    parameters: initialParameters,
    finishSelections: pdd?.defaultFinishMappings ?? {},
    validationResult: null,
    isValidating: false,
    lastValidatedAt: null,
    shareableUrl: null,
  });

  // Re-validate when parameters or finishes change
  useEffect(() => {
    if (Object.keys(state.parameters).length > 0) {
      validate(state.parameters, state.finishSelections);
    }
  }, [state.parameters, state.finishSelections, validate]);

  const setParameter = useCallback((key: string, value: unknown) => {
    dispatch({ type: 'SET_PARAMETER', payload: { key, value } });
  }, []);

  const setFinish = useCallback((group: string, finishId: string) => {
    dispatch({ type: 'SET_FINISH', payload: { group, finishId } });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Filter parameters for client mode
  const visibleParameters = pdd
    ? mode === 'client'
      ? pdd.parameters.filter(p => pdd.clientFacingConfig?.exposedParameters?.includes(p.key))
      : pdd.parameters
    : [];

  return {
    state,
    dispatch,
    pdd,
    setParameter,
    setFinish,
    reset,
    visibleParameters,
    validationResult,
    isValidating,
    violations,
    warnings,
    computedBOM,
    estimatedPrice,
    stockAvailability,
  };
}
