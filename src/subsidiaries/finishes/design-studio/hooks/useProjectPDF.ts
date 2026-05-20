/**
 * useProjectPDF — Multi-cabinet scene PDF lifecycle hook
 *
 * Generates the PDF as a Blob (via `generateProjectPDFBlob`) and exposes a
 * `download()` helper mirroring `usePrintPackage` so the dialog can trigger
 * a file download as soon as generation finishes.
 */
import { useState, useCallback } from 'react';
import type { ProjectPDFRequest } from '../types/projectPdf.types';
import { generateProjectPDFBlob } from '../services/projectPdf.service';
import type { GenerationProgress } from '../services/printPackageService';

interface UseProjectPDFResult {
  isGenerating: boolean;
  progress: GenerationProgress | null;
  pdfBlob: Blob | null;
  error: Error | null;
  generate: (request: ProjectPDFRequest) => Promise<void>;
  download: (filename?: string) => void;
  reset: () => void;
}

export function useProjectPDF(): UseProjectPDFResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const generate = useCallback(async (request: ProjectPDFRequest) => {
    setIsGenerating(true);
    setProgress({ phase: 'Starting', percent: 0 });
    setError(null);
    setPdfBlob(null);

    try {
      const blob = await generateProjectPDFBlob(request, (p) => setProgress(p));
      setPdfBlob(blob);
      setProgress({ phase: 'Complete', percent: 100 });
    } catch (err) {
      setError(err as Error);
      setProgress({ phase: 'Failed', percent: 0 });
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const download = useCallback((filename?: string) => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? 'project.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }, [pdfBlob]);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress(null);
    setPdfBlob(null);
    setError(null);
  }, []);

  return { isGenerating, progress, pdfBlob, error, generate, download, reset };
}
