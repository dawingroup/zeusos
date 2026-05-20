/**
 * usePartRecognition — React hook for AI part recognition pipeline
 *
 * State machine: idle → analyzing → reviewed → syncing → synced
 * Orchestrates: furniture type selection → geometry analysis → Cloud Function → user review → Firestore sync
 */

import { useState, useCallback } from 'react';
import { recognizeParts, convertRecognitionToPartEntries, buildGeometrySummaries } from '../services/aiPartRecognitionService';
import { writePartsToProject } from '../services/partWriteService';
import { buildRAGContext } from '../services/partLearningService';
import { getFurnitureType, extractTypeContext } from '../services/furnitureTypeService';
import { paletteEntriesToFinishIds } from '../services/materialResolverService';
import { getFinishes } from '@/modules/inventory/services/finishLibraryService';
import type { ParsedModel, ProjectContext } from '../types/workshop-viewer.types';
import type { RecognitionState } from '../types/ai-recognition.types';
import type { FurnitureTypeContext } from '../types/furniture-type.types';
import type { WriteResult } from '../services/partWriteService';

export interface UsePartRecognitionReturn {
  state: RecognitionState;
  selectedTypeId: string | null;
  /** Select a furniture type before analysis */
  setFurnitureType: (typeId: string | null) => void;
  /** Start AI recognition analysis */
  analyze: () => Promise<void>;
  /** Rename a part (user edit) */
  renamePart: (originalName: string, newName: string) => void;
  /** Confirm all parts and write to Firestore */
  confirmAndSync: (userId: string) => Promise<WriteResult | null>;
  /** Reset back to idle */
  reset: () => void;
}

export function usePartRecognition(
  model: ParsedModel | null,
  projectContext: ProjectContext | null,
): UsePartRecognitionReturn {
  const [state, setState] = useState<RecognitionState>({
    status: 'idle',
    result: null,
    renames: {},
  });
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const setFurnitureType = useCallback((typeId: string | null) => {
    setSelectedTypeId(typeId);
  }, []);

  const analyze = useCallback(async () => {
    if (!model) return;
    setState(s => ({ ...s, status: 'analyzing', error: undefined }));

    try {
      // Fetch furniture type context if selected
      let typeContext: FurnitureTypeContext | undefined;
      if (selectedTypeId) {
        const type = await getFurnitureType(selectedTypeId);
        if (type) typeContext = extractTypeContext(type);
      }

      // Retrieve RAG examples from past identifications
      const summaries = buildGeometrySummaries(model);
      const ragExamples = await buildRAGContext(summaries);

      // Call AI recognition with furniture type context
      const result = await recognizeParts(model, projectContext, ragExamples, selectedTypeId, typeContext);

      setState({
        status: 'reviewed',
        result,
        renames: {},
      });
    } catch (err: any) {
      setState(s => ({
        ...s,
        status: 'error',
        error: err.message || 'Recognition failed',
      }));
    }
  }, [model, projectContext, selectedTypeId]);

  const renamePart = useCallback((originalName: string, newName: string) => {
    setState(s => ({
      ...s,
      renames: { ...s.renames, [originalName]: newName },
    }));
  }, []);

  const confirmAndSync = useCallback(async (userId: string): Promise<WriteResult | null> => {
    if (!state.result || !projectContext?.projectId || !projectContext?.designItemId) {
      return null;
    }

    setState(s => ({ ...s, status: 'syncing' }));

    try {
      // P21.11 — load the Finish Library once and compute which IDs are in
      // the project's palette so convertRecognitionToPartEntries can stamp
      // materialId / inventoryItemId / resolution provenance onto each
      // part. Failures here are non-fatal: we fall back to bare material
      // names (the pre-P21.11 behaviour).
      let finishes: Awaited<ReturnType<typeof getFinishes>> = [];
      let preferredFinishIds: Set<string> | undefined;
      try {
        finishes = await getFinishes({ isActive: true });
        const palette = projectContext.materialPalette ?? [];
        if (palette.length > 0 && finishes.length > 0) {
          preferredFinishIds = paletteEntriesToFinishIds(palette, finishes);
        }
      } catch (err) {
        console.warn('Finish library load failed (material resolution disabled):', err);
      }

      const parts = convertRecognitionToPartEntries(
        state.result,
        state.renames,
        model?.fileName,
        finishes,
        preferredFinishIds,
      );

      const writeResult = await writePartsToProject(
        projectContext.projectId,
        projectContext.designItemId,
        parts,
        state.result,
        state.renames,
        userId,
        'merge',
      );

      setState(s => ({ ...s, status: 'synced' }));
      return writeResult;
    } catch (err: any) {
      setState(s => ({
        ...s,
        status: 'error',
        error: err.message || 'Sync failed',
      }));
      return null;
    }
  }, [state.result, state.renames, projectContext, model]);

  const reset = useCallback(() => {
    setState({ status: 'idle', result: null, renames: {} });
  }, []);

  return { state, selectedTypeId, setFurnitureType, analyze, renamePart, confirmAndSync, reset };
}
