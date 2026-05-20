/**
 * useModelProcessor — Pipeline state machine for model processing
 *
 * State: idle → grouping → materials → bom → renders → saving → done | error
 *
 * Exposes process(), progress (0-1), currentStep, result, error, cancel.
 */
import { useState, useCallback, useRef } from 'react';
import type { ParsedModel } from '../types/workshop-viewer.types';
import type { SceneCabinet } from '../types/scene.types';
import type { ProcessModelResult } from '../services/processModel.service';
import type { ModelProcessingStep } from '../types/modelPackage.types';
import { processModel } from '../services/processModel.service';

type Status = 'idle' | 'processing' | 'done' | 'error';

interface UseModelProcessorResult {
  status: Status;
  currentStep: ModelProcessingStep['name'] | null;
  progress: number;
  message: string;
  result: ProcessModelResult | null;
  error: Error | null;
  process: (params: ProcessParams) => Promise<ProcessModelResult | null>;
  reset: () => void;
}

interface ProcessParams {
  sceneId: string;
  cabinetId: string;
  cabinet: SceneCabinet;
  parsedModel: ParsedModel;
  archetypeKey?: string;
  archetypeContext?: string[];
  modelName?: string;
  fileType?: 'glb' | '3ds' | 'dxf' | 'csv' | 'unknown';
}

export function useModelProcessor(): UseModelProcessorResult {
  const [status, setStatus] = useState<Status>('idle');
  const [currentStep, setCurrentStep] = useState<ModelProcessingStep['name'] | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ProcessModelResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const activeRef = useRef(false);

  const reset = useCallback(() => {
    setStatus('idle');
    setCurrentStep(null);
    setProgress(0);
    setMessage('');
    setResult(null);
    setError(null);
  }, []);

  const process = useCallback(async (params: ProcessParams): Promise<ProcessModelResult | null> => {
    if (activeRef.current) {
      console.warn('Model processor already running');
      return null;
    }

    activeRef.current = true;
    setStatus('processing');
    setCurrentStep(null);
    setProgress(0);
    setMessage('Starting...');
    setResult(null);
    setError(null);

    try {
      const output = await processModel({
        ...params,
        onProgress: (update) => {
          setCurrentStep(update.step);
          setProgress(update.progress);
          if (update.message) setMessage(update.message);
        },
      });
      setResult(output);
      setStatus('done');
      setProgress(1);
      setMessage('Complete');
      return output;
    } catch (err) {
      setError(err as Error);
      setStatus('error');
      setMessage(`Failed: ${(err as Error).message}`);
      return null;
    } finally {
      activeRef.current = false;
    }
  }, []);

  return {
    status,
    currentStep,
    progress,
    message,
    result,
    error,
    process,
    reset,
  };
}
