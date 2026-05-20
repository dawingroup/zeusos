/**
 * useAssetIntelligence Hook
 * Manages AI intelligence panel state for asset analysis and profile enrichment.
 */

import { useState, useCallback } from 'react';
import { AssetService } from '../services/AssetService';
import {
  enrichAssetProfile,
  analyzeAssetHealth,
} from '../services/assetIntelligenceService';
import type { Asset, AssetStatusChange } from '@/shared/types';
import type { MaintenanceLog, AssetCheckout } from '../types';
import type {
  AssetIntelligenceResult,
  AssetEnrichmentResult,
} from '../types/assetIntelligence';
import { useAuth } from '@/shared/hooks';

const assetService = new AssetService();

interface UseAssetIntelligenceReturn {
  result: AssetIntelligenceResult | null;
  enrichmentResult: AssetEnrichmentResult | null;
  isAnalyzing: boolean;
  isEnriching: boolean;
  isApplying: boolean;
  error: string | null;
  runAnalysis: (
    asset: Asset,
    logs: MaintenanceLog[],
    changes: AssetStatusChange[],
    checkouts: AssetCheckout[]
  ) => Promise<void>;
  enrichProfile: (asset: Asset) => Promise<void>;
  applyEnrichment: (
    assetId: string,
    enrichment: AssetEnrichmentResult
  ) => Promise<void>;
}

export function useAssetIntelligence(): UseAssetIntelligenceReturn {
  const { user } = useAuth();
  const [result, setResult] = useState<AssetIntelligenceResult | null>(null);
  const [enrichmentResult, setEnrichmentResult] =
    useState<AssetEnrichmentResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(
    async (
      asset: Asset,
      logs: MaintenanceLog[],
      changes: AssetStatusChange[],
      checkouts: AssetCheckout[]
    ) => {
      setIsAnalyzing(true);
      setError(null);

      try {
        const analysisResult = await analyzeAssetHealth(
          asset,
          logs,
          changes,
          checkouts
        );
        setResult(analysisResult);
        setEnrichmentResult(analysisResult.enrichment);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Analysis failed';
        setError(message);
        console.error('Asset intelligence analysis failed:', err);
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const enrichProfile = useCallback(async (asset: Asset) => {
    setIsEnriching(true);
    setError(null);

    try {
      const enrichment = await enrichAssetProfile(asset);
      setEnrichmentResult(enrichment);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Enrichment failed';
      setError(message);
      console.error('Asset profile enrichment failed:', err);
    } finally {
      setIsEnriching(false);
    }
  }, []);

  const applyEnrichment = useCallback(
    async (assetId: string, enrichment: AssetEnrichmentResult) => {
      if (!user?.uid) return;

      setIsApplying(true);
      setError(null);

      try {
        const updates: Record<string, unknown> = {};

        // Merge enriched specs with existing
        if (enrichment.specs && Object.keys(enrichment.specs).length > 0) {
          updates.specs = enrichment.specs;
        }
        if (enrichment.manualUrl) {
          updates.manualUrl = enrichment.manualUrl;
        }
        if (enrichment.productPageUrl) {
          updates.productPageUrl = enrichment.productPageUrl;
        }

        if (Object.keys(updates).length > 0) {
          await assetService.updateAsset(assetId, updates, user.uid);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to apply enrichment';
        setError(message);
        console.error('Failed to apply enrichment:', err);
      } finally {
        setIsApplying(false);
      }
    },
    [user?.uid]
  );

  return {
    result,
    enrichmentResult,
    isAnalyzing,
    isEnriching,
    isApplying,
    error,
    runAnalysis,
    enrichProfile,
    applyEnrichment,
  };
}
