/**
 * useProcurementAdvisor Hook
 * Manages AI procurement advisor state for supplier enrichment,
 * recommendations, and risk analysis.
 */

import { useState, useCallback } from 'react';
import {
  enrichSupplierProfile,
  analyzeSupplier,
  applyEnrichmentToSupplier,
  saveFullAnalysis,
} from '../services/procurementAdvisorService';
import type { Supplier } from '../types/supplier';
import type {
  ProcurementAdvisorResult,
  SupplierEnrichmentResult,
} from '../types/procurementAdvisor';
import { useAuth } from '@/shared/hooks';

interface UseProcurementAdvisorReturn {
  result: ProcurementAdvisorResult | null;
  enrichmentResult: SupplierEnrichmentResult | null;
  isAnalyzing: boolean;
  isEnriching: boolean;
  isApplying: boolean;
  isSaving: boolean;
  error: string | null;
  runFullAnalysis: (supplier: Supplier) => Promise<void>;
  enrichProfile: (supplier: Supplier) => Promise<void>;
  applyEnrichment: (
    supplierId: string,
    enrichment: SupplierEnrichmentResult
  ) => Promise<void>;
  saveResults: (supplierId: string) => Promise<void>;
}

export function useProcurementAdvisor(): UseProcurementAdvisorReturn {
  const { user } = useAuth();
  const [result, setResult] = useState<ProcurementAdvisorResult | null>(null);
  const [enrichmentResult, setEnrichmentResult] =
    useState<SupplierEnrichmentResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runFullAnalysis = useCallback(async (supplier: Supplier) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const analysisResult = await analyzeSupplier(supplier);
      setResult(analysisResult);
      setEnrichmentResult(analysisResult.supplierEnrichment);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
      console.error('Procurement advisor analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const enrichProfile = useCallback(async (supplier: Supplier) => {
    setIsEnriching(true);
    setError(null);

    try {
      const enrichment = await enrichSupplierProfile(supplier);
      setEnrichmentResult(enrichment);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Enrichment failed';
      setError(message);
      console.error('Supplier enrichment failed:', err);
    } finally {
      setIsEnriching(false);
    }
  }, []);

  const applyEnrichment = useCallback(
    async (supplierId: string, enrichment: SupplierEnrichmentResult) => {
      if (!user?.uid) return;

      setIsApplying(true);
      setError(null);

      try {
        await applyEnrichmentToSupplier(supplierId, enrichment, user.uid);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to apply enrichment';
        setError(message);
        console.error('Failed to apply supplier enrichment:', err);
      } finally {
        setIsApplying(false);
      }
    },
    [user?.uid]
  );

  const saveResults = useCallback(
    async (supplierId: string) => {
      if (!user?.uid || !result) return;

      setIsSaving(true);
      setError(null);

      try {
        await saveFullAnalysis(supplierId, result, user.uid);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save results';
        setError(message);
        console.error('Failed to save advisor results:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [user?.uid, result]
  );

  return {
    result,
    enrichmentResult,
    isAnalyzing,
    isEnriching,
    isApplying,
    isSaving,
    error,
    runFullAnalysis,
    enrichProfile,
    applyEnrichment,
    saveResults,
  };
}
