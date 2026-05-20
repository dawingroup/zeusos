/**
 * Feature Library Hook
 * React hook for Feature Library CRUD operations
 */

import { useState, useEffect, useCallback } from 'react';
import type { 
  FeatureLibraryItem, 
  FeatureFormData, 
  FeatureSearchOptions,
  FeatureCategory 
} from '../types/featureLibrary';
import * as featureService from '../services/featureLibraryService';

interface UseFeatureLibraryReturn {
  features: FeatureLibraryItem[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  filters: FeatureSearchOptions;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: FeatureSearchOptions) => void;
  createFeature: (data: FeatureFormData) => Promise<FeatureLibraryItem>;
  updateFeature: (id: string, data: Partial<FeatureFormData>) => Promise<void>;
  deleteFeature: (id: string) => Promise<void>;
  refreshFeatures: () => Promise<void>;
  categoryCounts: Record<FeatureCategory, number>;
}

export function useFeatureLibrary(): UseFeatureLibraryReturn {
  const [features, setFeatures] = useState<FeatureLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FeatureSearchOptions>({});
  const [categoryCounts, setCategoryCounts] = useState<Record<FeatureCategory, number>>({
    joinery: 0,
    finishing: 0,
    hardware: 0,
    upholstery: 0,
    metalwork: 0,
    carving: 0,
    veneer: 0,
    laminate: 0,
    glass: 0,
    stone: 0,
  });

  const loadFeatures = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let loadedFeatures: FeatureLibraryItem[];
      
      if (searchQuery.trim()) {
        loadedFeatures = await featureService.searchFeatures(searchQuery);
      } else {
        loadedFeatures = await featureService.getFeatures(filters);
      }
      
      setFeatures(loadedFeatures);
      
      // Load category counts
      const counts = await featureService.getFeatureCountsByCategory();
      setCategoryCounts(counts);
    } catch (err) {
      console.error('Error loading features:', err);
      setError(err instanceof Error ? err.message : 'Failed to load features');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filters]);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const createFeature = async (data: FeatureFormData): Promise<FeatureLibraryItem> => {
    try {
      const newFeature = await featureService.createFeature(data);
      await loadFeatures();
      return newFeature;
    } catch (err) {
      console.error('Error creating feature:', err);
      throw err;
    }
  };

  const updateFeature = async (id: string, data: Partial<FeatureFormData>): Promise<void> => {
    try {
      await featureService.updateFeature(id, data);
      await loadFeatures();
    } catch (err) {
      console.error('Error updating feature:', err);
      throw err;
    }
  };

  const deleteFeature = async (id: string): Promise<void> => {
    try {
      await featureService.deleteFeature(id);
      await loadFeatures();
    } catch (err) {
      console.error('Error deleting feature:', err);
      throw err;
    }
  };

  return {
    features,
    isLoading,
    error,
    searchQuery,
    filters,
    setSearchQuery,
    setFilters,
    createFeature,
    updateFeature,
    deleteFeature,
    refreshFeatures: loadFeatures,
    categoryCounts,
  };
}

/**
 * Hook for single feature operations
 */
export function useFeature(featureId: string | null) {
  const [feature, setFeature] = useState<FeatureLibraryItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!featureId) {
      setFeature(null);
      return;
    }

    const loadFeature = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const loadedFeature = await featureService.getFeatureById(featureId);
        setFeature(loadedFeature);
      } catch (err) {
        console.error('Error loading feature:', err);
        setError(err instanceof Error ? err.message : 'Failed to load feature');
      } finally {
        setIsLoading(false);
      }
    };

    loadFeature();
  }, [featureId]);

  return { feature, isLoading, error };
}
