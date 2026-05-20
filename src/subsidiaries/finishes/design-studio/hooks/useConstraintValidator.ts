/**
 * useConstraintValidator — Debounced constraint validation on parameter/finish changes
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { validateConfiguration, validateBOMAgainstDKB } from '../services/constraintEngine.service';
import type { ConstraintValidationResult, DKBValidationResult } from '../types/constraintEngine.types';
import { PRICE_UPDATE_DEBOUNCE_MS } from '../constants/configurator.constants';

export function useConstraintValidator(pddId: string | undefined) {
  const [validationResult, setValidationResult] = useState<ConstraintValidationResult | null>(null);
  const [dkbValidation, setDkbValidation] = useState<DKBValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validate = useCallback(
    (configuration: Record<string, unknown>, finishSelections: Record<string, string>) => {
      if (!pddId) return;

      // Clear previous timer
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(async () => {
        setIsValidating(true);
        setError(null);
        try {
          // Run PDD constraint validation
          const result = await validateConfiguration({
            pddId,
            configuration,
            finishSelections,
          });
          setValidationResult(result);

          // Run DKB validation on the computed BOM
          if (result.computedBOM.length > 0) {
            const dkbResult = await validateBOMAgainstDKB(result.computedBOM, configuration);
            setDkbValidation(dkbResult);
          }
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setIsValidating(false);
        }
      }, PRICE_UPDATE_DEBOUNCE_MS);
    },
    [pddId],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return {
    validationResult,
    dkbValidation,
    isValidating,
    error,
    validate,
    violations: validationResult?.violations ?? [],
    warnings: validationResult?.warnings ?? [],
    infos: validationResult?.infos ?? [],
    dkbViolations: dkbValidation?.violations ?? [],
    computedBOM: validationResult?.computedBOM ?? [],
    estimatedPrice: validationResult?.estimatedPrice ?? null,
    stockAvailability: validationResult?.stockAvailability ?? {},
  };
}
