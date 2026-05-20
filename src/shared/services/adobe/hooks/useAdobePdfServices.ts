/**
 * React Hook for Adobe PDF Services
 *
 * Provides a React-friendly interface to Adobe PDF Services with
 * loading states, progress tracking, and error handling.
 *
 * @example
 * ```tsx
 * function PDFConverter() {
 *   const { loading, progress, status, createPdf, extractTables } = useAdobePdfServices();
 *
 *   const handleConvert = async (file: File) => {
 *     const result = await createPdf({
 *       input: { type: 'buffer', value: await file.arrayBuffer(), fileName: file.name }
 *     });
 *     if (result.success) {
 *       // Download or use the PDF blob
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {loading && <ProgressBar value={progress} label={status} />}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useMemo } from 'react';
import { adobePdfServices } from '../pdf/pdf-services-client';
import { adobePdfExtract, BOQExtractionResult } from '../pdf/pdf-extract';
import {
  CreatePdfOptions,
  CreatePdfFromHtmlOptions,
  ExportPdfOptions,
  CombinePdfOptions,
  SplitPdfOptions,
  SplitPdfResult,
  OcrPdfOptions,
  CompressPdfOptions,
  CompressPdfResult,
  ProtectPdfOptions,
  LinearizePdfOptions,
  WatermarkOptions,
  ExtractPdfOptions,
  PdfExtractResult,
  ExtractedTable,
  ExtractedText,
} from '../types/pdf-services.types';
import { AdobeOperationResult, AdobeFileRef, ProgressCallback } from '../types/common';

interface PdfOperationState {
  loading: boolean;
  progress: number;
  status: string;
  error?: string;
}

interface UseAdobePdfServicesReturn {
  // State
  loading: boolean;
  progress: number;
  status: string;
  error?: string;
  isEnabled: boolean;

  // PDF Services Operations
  createPdf: (options: CreatePdfOptions) => Promise<AdobeOperationResult<Blob>>;
  createPdfFromHtml: (options: CreatePdfFromHtmlOptions) => Promise<AdobeOperationResult<Blob>>;
  exportPdf: (options: ExportPdfOptions) => Promise<AdobeOperationResult<Blob>>;
  combinePdfs: (options: CombinePdfOptions) => Promise<AdobeOperationResult<Blob>>;
  splitPdf: (options: SplitPdfOptions) => Promise<AdobeOperationResult<SplitPdfResult>>;
  ocrPdf: (options: OcrPdfOptions) => Promise<AdobeOperationResult<Blob>>;
  compressPdf: (options: CompressPdfOptions) => Promise<AdobeOperationResult<CompressPdfResult>>;
  protectPdf: (options: ProtectPdfOptions) => Promise<AdobeOperationResult<Blob>>;
  linearizePdf: (options: LinearizePdfOptions) => Promise<AdobeOperationResult<Blob>>;
  addWatermark: (options: WatermarkOptions) => Promise<AdobeOperationResult<Blob>>;

  // PDF Extract Operations
  extractPdf: (options: ExtractPdfOptions) => Promise<AdobeOperationResult<PdfExtractResult>>;
  extractTables: (input: AdobeFileRef) => Promise<AdobeOperationResult<ExtractedTable[]>>;
  extractText: (input: AdobeFileRef) => Promise<AdobeOperationResult<ExtractedText[]>>;
  extractAll: (input: AdobeFileRef) => Promise<AdobeOperationResult<PdfExtractResult>>;
  extractTablesForBOQ: (input: AdobeFileRef) => Promise<AdobeOperationResult<BOQExtractionResult>>;

  // Utilities
  reset: () => void;
  downloadBlob: (blob: Blob, fileName: string) => void;
}

export function useAdobePdfServices(): UseAdobePdfServicesReturn {
  const [state, setState] = useState<PdfOperationState>({
    loading: false,
    progress: 0,
    status: '',
  });

  const handleProgress: ProgressCallback = useCallback((progress) => {
    setState((prev) => ({
      ...prev,
      progress: progress.percent,
      status: progress.status,
    }));
  }, []);

  const startOperation = useCallback(() => {
    setState({ loading: true, progress: 0, status: 'Starting...', error: undefined });
  }, []);

  const endOperation = useCallback((error?: string) => {
    setState((prev) => ({ ...prev, loading: false, error }));
  }, []);

  // ==========================================================================
  // PDF Services Operations
  // ==========================================================================

  const createPdf = useCallback(
    async (options: CreatePdfOptions): Promise<AdobeOperationResult<Blob>> => {
      startOperation();
      try {
        const result = await adobePdfServices.createPdf(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const createPdfFromHtml = useCallback(
    async (options: CreatePdfFromHtmlOptions): Promise<AdobeOperationResult<Blob>> => {
      startOperation();
      try {
        const result = await adobePdfServices.createPdfFromHtml(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const exportPdf = useCallback(
    async (options: ExportPdfOptions): Promise<AdobeOperationResult<Blob>> => {
      startOperation();
      try {
        const result = await adobePdfServices.exportPdf(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const combinePdfs = useCallback(
    async (options: CombinePdfOptions): Promise<AdobeOperationResult<Blob>> => {
      startOperation();
      try {
        const result = await adobePdfServices.combinePdfs(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const splitPdf = useCallback(
    async (options: SplitPdfOptions): Promise<AdobeOperationResult<SplitPdfResult>> => {
      startOperation();
      try {
        const result = await adobePdfServices.splitPdf(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const ocrPdf = useCallback(
    async (options: OcrPdfOptions): Promise<AdobeOperationResult<Blob>> => {
      startOperation();
      try {
        const result = await adobePdfServices.ocrPdf(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const compressPdf = useCallback(
    async (options: CompressPdfOptions): Promise<AdobeOperationResult<CompressPdfResult>> => {
      startOperation();
      try {
        const result = await adobePdfServices.compressPdf(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const protectPdf = useCallback(
    async (options: ProtectPdfOptions): Promise<AdobeOperationResult<Blob>> => {
      startOperation();
      try {
        const result = await adobePdfServices.protectPdf(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const linearizePdf = useCallback(
    async (options: LinearizePdfOptions): Promise<AdobeOperationResult<Blob>> => {
      startOperation();
      try {
        const result = await adobePdfServices.linearizePdf(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const addWatermark = useCallback(
    async (options: WatermarkOptions): Promise<AdobeOperationResult<Blob>> => {
      startOperation();
      try {
        const result = await adobePdfServices.addWatermark(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  // ==========================================================================
  // PDF Extract Operations
  // ==========================================================================

  const extractPdf = useCallback(
    async (options: ExtractPdfOptions): Promise<AdobeOperationResult<PdfExtractResult>> => {
      startOperation();
      try {
        const result = await adobePdfExtract.extract(options, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const extractTables = useCallback(
    async (input: AdobeFileRef): Promise<AdobeOperationResult<ExtractedTable[]>> => {
      startOperation();
      try {
        const result = await adobePdfExtract.extractTables(input, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const extractText = useCallback(
    async (input: AdobeFileRef): Promise<AdobeOperationResult<ExtractedText[]>> => {
      startOperation();
      try {
        const result = await adobePdfExtract.extractText(input, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const extractAll = useCallback(
    async (input: AdobeFileRef): Promise<AdobeOperationResult<PdfExtractResult>> => {
      startOperation();
      try {
        const result = await adobePdfExtract.extractAll(input, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  const extractTablesForBOQ = useCallback(
    async (input: AdobeFileRef): Promise<AdobeOperationResult<BOQExtractionResult>> => {
      startOperation();
      try {
        const result = await adobePdfExtract.extractTablesForBOQ(input, handleProgress);
        endOperation(result.success ? undefined : result.error?.message);
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        endOperation(errorMsg);
        throw error;
      }
    },
    [startOperation, endOperation, handleProgress]
  );

  // ==========================================================================
  // Utilities
  // ==========================================================================

  const reset = useCallback(() => {
    setState({ loading: false, progress: 0, status: '', error: undefined });
  }, []);

  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const isEnabled = useMemo(() => adobePdfServices.isEnabled(), []);

  return {
    // State
    loading: state.loading,
    progress: state.progress,
    status: state.status,
    error: state.error,
    isEnabled,

    // PDF Services Operations
    createPdf,
    createPdfFromHtml,
    exportPdf,
    combinePdfs,
    splitPdf,
    ocrPdf,
    compressPdf,
    protectPdf,
    linearizePdf,
    addWatermark,

    // PDF Extract Operations
    extractPdf,
    extractTables,
    extractText,
    extractAll,
    extractTablesForBOQ,

    // Utilities
    reset,
    downloadBlob,
  };
}
