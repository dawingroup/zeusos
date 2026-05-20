/**
 * usePrintPackage — PDF generation hook with progress state
 */

import { useState, useCallback } from 'react';
import type {
  ParsedModel,
  CutListEntry,
  PrintPackageConfig,
  PartTreeNode,
  MeshCutListLink,
  DimensionSet,
  AssemblyGroup,
} from '../types/workshop-viewer.types';
import { generatePrintPackage, type GenerationProgress } from '../services/printPackageService';
import {
  assertPrintReady,
  MaterialValidationError,
  type MaterialException,
} from '../services/materialValidationService';

interface UsePrintPackageReturn {
  generate: (config: PrintPackageConfig) => Promise<void>;
  progress: GenerationProgress | null;
  loading: boolean;
  error: string | null;
  pdfBlob: Blob | null;
  download: (filename?: string) => void;
}

export function usePrintPackage(
  model: ParsedModel | null,
  cutList: CutListEntry[],
  partTree: PartTreeNode[],
  meshLinks: MeshCutListLink[],
  dimensions: DimensionSet | null,
  logoUrl?: string,
  confirmedGroups?: AssemblyGroup[],
  /**
   * P13 hardening: blocking material exceptions from `useMaterialValidation`.
   * The UI already disables the submit button when these are non-empty,
   * but this hook enforces the gate at the service layer so any caller
   * (not just ExportConfigPanel) gets the same check. Omit or pass an
   * empty array to opt out (e.g. when validation is still loading and
   * the caller has its own loading gate).
   */
  materialExceptions: MaterialException[] = [],
): UsePrintPackageReturn {
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  const generate = useCallback(async (config: PrintPackageConfig) => {
    if (!model || !dimensions) {
      setError('No model loaded');
      return;
    }

    setLoading(true);
    setError(null);
    setProgress({ phase: 'Starting', percent: 0 });

    try {
      // P13: reject before we spend time building a PDF whose BOM
      // references finishes with no inventory backing.
      assertPrintReady(materialExceptions);
      const blob = await generatePrintPackage(
        model, cutList, config, partTree, meshLinks, dimensions,
        (p) => setProgress(p),
        logoUrl,
        confirmedGroups,
      );
      setPdfBlob(blob);
    } catch (err) {
      if (err instanceof MaterialValidationError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'PDF generation failed');
        console.error('PDF generation error:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [model, cutList, partTree, meshLinks, dimensions, logoUrl, confirmedGroups, materialExceptions]);

  const download = useCallback((filename?: string) => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? 'print-package.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }, [pdfBlob]);

  return { generate, progress, loading, error, pdfBlob, download };
}
