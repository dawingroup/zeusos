/**
 * useBulkCabinetDetector — Detect cabinets in a parsed multi-cabinet model
 */
import { useState, useCallback } from 'react';
import type { ParsedModel } from '../types/workshop-viewer.types';
import type { BulkCabinetDetectionResult } from '../types/cabinetDetection.types';
import { detectCabinetsWithAI } from '../services/cabinetDetector.service';

interface UseBulkCabinetDetectorResult {
  status: 'idle' | 'detecting' | 'done' | 'error';
  result: BulkCabinetDetectionResult | null;
  error: Error | null;
  detect: (parsedModel: ParsedModel, options?: { expectedCount?: number; contextHint?: string }) => Promise<BulkCabinetDetectionResult | null>;
  reset: () => void;
}

export function useBulkCabinetDetector(): UseBulkCabinetDetectorResult {
  const [status, setStatus] = useState<'idle' | 'detecting' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<BulkCabinetDetectionResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const detect = useCallback(async (
    parsedModel: ParsedModel,
    options: { expectedCount?: number; contextHint?: string } = {},
  ) => {
    setStatus('detecting');
    setError(null);
    setResult(null);

    try {
      const r = await detectCabinetsWithAI(parsedModel, options);
      setResult(r);
      setStatus('done');
      return r;
    } catch (err) {
      setError(err as Error);
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
  }, []);

  return { status, result, error, detect, reset };
}
