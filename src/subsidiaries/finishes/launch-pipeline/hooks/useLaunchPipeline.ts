/**
 * useLaunchPipeline Hook
 * React hook for Launch Pipeline operations with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import type { LaunchProduct } from '../types/product.types';
import type { PipelineStage } from '../types/stage.types';
import * as pipelineService from '../services/pipelineService';
import { PIPELINE_STAGES } from '../constants/stages';

export interface PipelineColumn {
  stage: PipelineStage;
  config: typeof PIPELINE_STAGES[0];
  products: LaunchProduct[];
}

interface UseLaunchPipelineReturn {
  columns: PipelineColumn[];
  products: LaunchProduct[];
  isLoading: boolean;
  error: string | null;
  createProduct: (data: Partial<LaunchProduct>) => Promise<LaunchProduct>;
  updateProduct: (id: string, data: Partial<LaunchProduct>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  moveProduct: (productId: string, newStage: PipelineStage, userId: string, notes?: string) => Promise<void>;
  refreshProducts: () => Promise<void>;
}

export function useLaunchPipeline(): UseLaunchPipelineReturn {
  const [products, setProducts] = useState<LaunchProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compute columns from products
  const columns: PipelineColumn[] = PIPELINE_STAGES.map(config => ({
    stage: config.id,
    config,
    products: products.filter(p => p.currentStage === config.id),
  }));

  // Load products on mount (no real-time for now to avoid permission issues)
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const loadedProducts = await pipelineService.getProducts();
        setProducts(loadedProducts);
      } catch (err) {
        console.error('Error loading products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  const refreshProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedProducts = await pipelineService.getProducts();
      setProducts(loadedProducts);
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProduct = async (data: Partial<LaunchProduct>): Promise<LaunchProduct> => {
    try {
      const newProduct = await pipelineService.createProduct(data);
      // Add to local state immediately
      setProducts(prev => [...prev, newProduct]);
      return newProduct;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create product';
      setError(message);
      throw err;
    }
  };

  const updateProduct = async (id: string, data: Partial<LaunchProduct>): Promise<void> => {
    try {
      await pipelineService.updateProduct(id, data);
      // Update local state
      setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update product';
      setError(message);
      throw err;
    }
  };

  const deleteProduct = async (id: string): Promise<void> => {
    try {
      await pipelineService.deleteProduct(id);
      // Remove from local state
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete product';
      setError(message);
      throw err;
    }
  };

  const moveProduct = async (
    productId: string, 
    newStage: PipelineStage, 
    userId: string,
    notes?: string
  ): Promise<void> => {
    try {
      await pipelineService.moveProductToStage(productId, newStage, userId, notes);
      // Update local state
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, currentStage: newStage } : p
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to move product';
      setError(message);
      throw err;
    }
  };

  return {
    columns,
    products,
    isLoading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    moveProduct,
    refreshProducts,
  };
}
