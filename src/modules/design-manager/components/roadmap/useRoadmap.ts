/**
 * Roadmap Hook
 * React hook for Product Roadmap operations
 */

import { useState, useEffect, useCallback } from 'react';
import type { 
  RoadmapProduct, 
  ProductFormData, 
  PipelineStage,
  PipelineColumn,
} from '../../types/roadmap';
import * as roadmapService from '../../services/roadmapService';

interface UseRoadmapReturn {
  columns: PipelineColumn[];
  products: RoadmapProduct[];
  isLoading: boolean;
  error: string | null;
  createProduct: (data: ProductFormData) => Promise<RoadmapProduct>;
  updateProduct: (id: string, data: Partial<ProductFormData>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  moveProduct: (productId: string, newStage: PipelineStage, newOrder: number) => Promise<void>;
  updateProgress: (id: string, progress: number) => Promise<void>;
  refreshProducts: () => Promise<void>;
}

export function useRoadmap(): UseRoadmapReturn {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [products, setProducts] = useState<RoadmapProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [loadedColumns, loadedProducts] = await Promise.all([
        roadmapService.getProductsByStage(),
        roadmapService.getProducts(),
      ]);
      setColumns(loadedColumns);
      setProducts(loadedProducts);
    } catch (err) {
      console.error('Error loading products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const createProduct = async (data: ProductFormData): Promise<RoadmapProduct> => {
    const newProduct = await roadmapService.createProduct(data);
    await loadProducts();
    return newProduct;
  };

  const updateProduct = async (id: string, data: Partial<ProductFormData>): Promise<void> => {
    await roadmapService.updateProduct(id, data);
    await loadProducts();
  };

  const deleteProduct = async (id: string): Promise<void> => {
    await roadmapService.deleteProduct(id);
    await loadProducts();
  };

  const moveProduct = async (productId: string, newStage: PipelineStage, newOrder: number): Promise<void> => {
    await roadmapService.moveProductToStage(productId, newStage, newOrder);
    await loadProducts();
  };

  const updateProgress = async (id: string, progress: number): Promise<void> => {
    await roadmapService.updateProductProgress(id, progress);
    await loadProducts();
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
    updateProgress,
    refreshProducts: loadProducts,
  };
}
