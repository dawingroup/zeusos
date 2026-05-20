/**
 * useProviderResearch Hook
 * Manages AI capital provider research state for search, enrichment, and matching.
 */

import { useState, useCallback } from 'react';
import {
  searchProviders,
  enrichProvider,
  enrichProduct,
  matchProviders,
  saveProductToCatalog,
  saveProviderProducts,
  type SearchProvidersParams,
  type BusinessMatchProfile,
} from '../services/providerResearchService';
import type {
  ProviderSearchResponse,
  ProviderSearchResult,
  EnrichedProviderProfile,
  EnrichedProductDetail,
  ProviderMatchResponse,
  CapitalNeed,
  CapitalProduct,
  CapitalProductType,
  ProviderType,
} from '../types/capital.types';

export interface UseProviderResearchReturn {
  searchResults: ProviderSearchResponse | null;
  enrichedProvider: EnrichedProviderProfile | null;
  enrichedProduct: EnrichedProductDetail | null;
  matchResults: ProviderMatchResponse | null;
  isSearching: boolean;
  isEnrichingProvider: boolean;
  isEnrichingProduct: boolean;
  isMatching: boolean;
  isSaving: boolean;
  error: string | null;
  search: (params: SearchProvidersParams) => Promise<void>;
  enrichProviderProfile: (provider: { name: string; providerType?: ProviderType; website?: string }) => Promise<void>;
  enrichProductDetail: (provider: string, product: string, productType?: CapitalProductType) => Promise<void>;
  findMatches: (businessProfile: BusinessMatchProfile, capitalNeed: Partial<CapitalNeed>) => Promise<void>;
  saveProduct: (companyId: string, provider: ProviderSearchResult | EnrichedProviderProfile, product: EnrichedProductDetail) => Promise<CapitalProduct | null>;
  saveAllProducts: (companyId: string, provider: ProviderSearchResult) => Promise<CapitalProduct[]>;
  clearResults: () => void;
}

export function useProviderResearch(): UseProviderResearchReturn {
  const [searchResults, setSearchResults] = useState<ProviderSearchResponse | null>(null);
  const [enrichedProvider, setEnrichedProvider] = useState<EnrichedProviderProfile | null>(null);
  const [enrichedProduct, setEnrichedProduct] = useState<EnrichedProductDetail | null>(null);
  const [matchResults, setMatchResults] = useState<ProviderMatchResponse | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [isEnrichingProvider, setIsEnrichingProvider] = useState(false);
  const [isEnrichingProduct, setIsEnrichingProduct] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (params: SearchProvidersParams) => {
    setIsSearching(true);
    setError(null);
    try {
      const results = await searchProviders(params);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provider search failed');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const enrichProviderProfile = useCallback(async (provider: { name: string; providerType?: ProviderType; website?: string }) => {
    setIsEnrichingProvider(true);
    setError(null);
    try {
      const result = await enrichProvider(provider);
      setEnrichedProvider(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provider enrichment failed');
    } finally {
      setIsEnrichingProvider(false);
    }
  }, []);

  const enrichProductDetail = useCallback(async (provider: string, product: string, productType?: CapitalProductType) => {
    setIsEnrichingProduct(true);
    setError(null);
    try {
      const result = await enrichProduct(provider, product, productType);
      setEnrichedProduct(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Product enrichment failed');
    } finally {
      setIsEnrichingProduct(false);
    }
  }, []);

  const findMatches = useCallback(async (businessProfile: BusinessMatchProfile, capitalNeed: Partial<CapitalNeed>) => {
    setIsMatching(true);
    setError(null);
    try {
      const results = await matchProviders(businessProfile, capitalNeed);
      setMatchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provider matching failed');
    } finally {
      setIsMatching(false);
    }
  }, []);

  const saveProduct = useCallback(async (
    companyId: string,
    provider: ProviderSearchResult | EnrichedProviderProfile,
    product: EnrichedProductDetail
  ): Promise<CapitalProduct | null> => {
    setIsSaving(true);
    setError(null);
    try {
      return await saveProductToCatalog(companyId, provider, product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const saveAllProducts = useCallback(async (
    companyId: string,
    provider: ProviderSearchResult
  ): Promise<CapitalProduct[]> => {
    setIsSaving(true);
    setError(null);
    try {
      return await saveProviderProducts(companyId, provider);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save products');
      return [];
    } finally {
      setIsSaving(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setSearchResults(null);
    setEnrichedProvider(null);
    setEnrichedProduct(null);
    setMatchResults(null);
    setError(null);
  }, []);

  return {
    searchResults,
    enrichedProvider,
    enrichedProduct,
    matchResults,
    isSearching,
    isEnrichingProvider,
    isEnrichingProduct,
    isMatching,
    isSaving,
    error,
    search,
    enrichProviderProfile,
    enrichProductDetail,
    findMatches,
    saveProduct,
    saveAllProducts,
    clearResults,
  };
}
