/**
 * useMeshGenerator — Manages AI mesh generation workflow
 *
 * Handles image upload, Cloud Function invocation, progress tracking,
 * and result loading into the viewer.
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { uploadReferenceImage, generateMeshFromImage, generateParametricModel } from '../services/meshGenerationService';
import type { GenerationProgress, GenerationResult, ParametricGenerationResult } from '../types/generation.types';

interface UseMeshGeneratorResult {
  progress: GenerationProgress;
  result: GenerationResult | null;
  generateFromImage: (file: File, dimensions?: { width: number; depth: number; height: number }, faceLimit?: number) => Promise<GenerationResult>;
  generateFromText: (prompt: string, faceLimit?: number) => Promise<GenerationResult>;
  generateFromTemplate: (templateId: string, parameters: Record<string, unknown>, finishSelections?: Record<string, string>) => Promise<ParametricGenerationResult>;
  reset: () => void;
}

const IDLE_PROGRESS: GenerationProgress = {
  status: 'idle',
  progress: 0,
  message: '',
};

export function useMeshGenerator(): UseMeshGeneratorResult {
  const { user } = useAuth();
  const [progress, setProgress] = useState<GenerationProgress>(IDLE_PROGRESS);
  const [result, setResult] = useState<GenerationResult | null>(null);

  const generateFromImage = useCallback(
    async (
      file: File,
      dimensions?: { width: number; depth: number; height: number },
      faceLimit?: number,
    ): Promise<GenerationResult> => {
      if (!user?.uid) throw new Error('Not authenticated');

      try {
        // Step 1: Upload image
        setProgress({ status: 'uploading', progress: 10, message: 'Uploading reference image...' });
        const storagePath = await uploadReferenceImage(file, user.uid);

        // Step 2: Generate mesh
        setProgress({ status: 'generating', progress: 30, message: 'Generating 3D model (this may take 30-60 seconds)...' });
        const genResult = await generateMeshFromImage({
          mode: 'image',
          imageStoragePath: storagePath,
          overallDimensions: dimensions,
          faceLimit,
        });

        // Step 3: Complete
        setProgress({ status: 'complete', progress: 100, message: 'Model generated successfully' });
        setResult(genResult);
        return genResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        setProgress({ status: 'error', progress: 0, message, error: message });
        throw error;
      }
    },
    [user],
  );

  const generateFromText = useCallback(
    async (prompt: string, faceLimit?: number): Promise<GenerationResult> => {
      if (!user?.uid) throw new Error('Not authenticated');

      try {
        setProgress({ status: 'generating', progress: 30, message: 'Generating 3D model from description...' });
        const genResult = await generateMeshFromImage({
          mode: 'text',
          textPrompt: prompt,
          faceLimit,
        });

        setProgress({ status: 'complete', progress: 100, message: 'Model generated successfully' });
        setResult(genResult);
        return genResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Generation failed';
        setProgress({ status: 'error', progress: 0, message, error: message });
        throw error;
      }
    },
    [user],
  );

  const generateFromTemplate = useCallback(
    async (
      templateId: string,
      parameters: Record<string, unknown>,
      finishSelections?: Record<string, string>,
    ): Promise<ParametricGenerationResult> => {
      if (!user?.uid) throw new Error('Not authenticated');

      try {
        setProgress({ status: 'generating', progress: 20, message: 'Building model from template (this may take 30-60 seconds)...' });
        const genResult = await generateParametricModel({
          templateId,
          parameters,
          finishSelections,
        });

        setProgress({ status: 'complete', progress: 100, message: 'Parametric model generated successfully' });
        setResult(genResult);
        return genResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Parametric generation failed';
        setProgress({ status: 'error', progress: 0, message, error: message });
        throw error;
      }
    },
    [user],
  );

  const reset = useCallback(() => {
    setProgress(IDLE_PROGRESS);
    setResult(null);
  }, []);

  return { progress, result, generateFromImage, generateFromText, generateFromTemplate, reset };
}
