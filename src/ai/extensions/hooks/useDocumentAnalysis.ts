/**
 * useDocumentAnalysis Hook
 * Document intelligence and extraction
 */

import { useState, useCallback } from 'react';
import { documentIntelligenceService } from '../services/document-intelligence';
import {
  DocumentAnalysis,
  IPCExtraction,
  BOQExtraction,
} from '../types/ai-extensions';

interface UseDocumentAnalysisReturn {
  analysis: DocumentAnalysis | null;
  isAnalyzing: boolean;
  error: Error | null;
  analyzeDocument: (documentId: string, content: string, mimeType?: string) => Promise<void>;
  analyzeIPC: (documentId: string, content: string) => Promise<IPCExtraction | null>;
  analyzeBOQ: (documentId: string, content: string) => Promise<BOQExtraction | null>;
  clearAnalysis: () => void;
}

export function useDocumentAnalysis(): UseDocumentAnalysisReturn {
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const analyzeDocument = useCallback(async (
    documentId: string,
    content: string,
    mimeType: string = 'application/pdf'
  ) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await documentIntelligenceService.analyzeDocument(
        documentId,
        content,
        mimeType
      );
      setAnalysis(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const analyzeIPC = useCallback(async (
    documentId: string,
    content: string
  ): Promise<IPCExtraction | null> => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await documentIntelligenceService.analyzeIPC(documentId, content);
      setAnalysis(result);
      return result.ipcData;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const analyzeBOQ = useCallback(async (
    documentId: string,
    content: string
  ): Promise<BOQExtraction | null> => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const result = await documentIntelligenceService.analyzeBOQ(documentId, content);
      setAnalysis(result);
      return result.boqData;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const clearAnalysis = useCallback(() => {
    setAnalysis(null);
    setError(null);
  }, []);

  return {
    analysis,
    isAnalyzing,
    error,
    analyzeDocument,
    analyzeIPC,
    analyzeBOQ,
    clearAnalysis,
  };
}

/**
 * Hook for retrieving existing document analysis
 */
export function useExistingAnalysis(documentId: string | null): {
  analysis: DocumentAnalysis | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const [analysis, setAnalysis] = useState<DocumentAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!documentId) return;

    setIsLoading(true);
    try {
      const result = await documentIntelligenceService.getAnalysis(documentId);
      setAnalysis(result);
    } catch (error) {
      console.error('Error fetching analysis:', error);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  return { analysis, isLoading, refresh };
}
