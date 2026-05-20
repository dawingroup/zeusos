/**
 * useFeatureFlag Hook
 * Simple hook for checking feature flag status
 */

import { useMemo } from 'react';
import { FEATURES } from '../constants';

/**
 * Feature flag keys available in the app
 */
export type FeatureFlag = keyof typeof FEATURES;

/**
 * Hook to check if a feature flag is enabled
 *
 * @param flag - The feature flag to check
 * @returns true if the feature is enabled, false otherwise
 *
 * @example
 * const isGuidedWorkflowEnabled = useFeatureFlag('STRATEGY_GUIDED_WORKFLOW');
 *
 * if (isGuidedWorkflowEnabled) {
 *   return <GuidedStrategyWorkflow />;
 * }
 */
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return useMemo(() => {
    return FEATURES[flag] === true;
  }, [flag]);
}

/**
 * Hook to check multiple feature flags at once
 *
 * @param flags - Array of feature flags to check
 * @returns Object with boolean values for each flag
 *
 * @example
 * const { STRATEGY_GUIDED_WORKFLOW, STRATEGY_VALIDATION_UI } = useFeatureFlags([
 *   'STRATEGY_GUIDED_WORKFLOW',
 *   'STRATEGY_VALIDATION_UI'
 * ]);
 */
export function useFeatureFlags(flags: FeatureFlag[]): Record<string, boolean> {
  return useMemo(() => {
    return flags.reduce((acc, flag) => {
      acc[flag] = FEATURES[flag] === true;
      return acc;
    }, {} as Record<string, boolean>);
  }, [flags]);
}

/**
 * Get all enabled feature flags
 * Useful for debugging or admin panels
 */
export function getEnabledFeatures(): FeatureFlag[] {
  return (Object.keys(FEATURES) as FeatureFlag[]).filter(
    (flag) => FEATURES[flag] === true
  );
}

/**
 * Check if a feature is enabled (non-hook version for use outside React components)
 *
 * @param flag - The feature flag to check
 * @returns true if the feature is enabled, false otherwise
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag] === true;
}
