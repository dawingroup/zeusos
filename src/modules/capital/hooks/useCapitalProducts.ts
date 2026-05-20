import { useState, useEffect, useCallback } from 'react';
import type { CapitalProduct, CapitalProductFilters } from '../types/capital.types';
import type { CapitalProductInput } from '../schemas/capital.schemas';
import { capitalProductsService } from '../services/capitalProductsService';

export function useCapitalProducts(companyId: string, filters: CapitalProductFilters = {}) {
  const [products, setProducts] = useState<CapitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await capitalProductsService.getProducts(companyId, filters);
      setProducts(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(filters)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProduct = useCallback(
    async (input: CapitalProductInput) => {
      const product = await capitalProductsService.createProduct(companyId, input);
      setProducts(prev => [product, ...prev]);
      return product;
    },
    [companyId],
  );

  const updateProduct = useCallback(
    async (productId: string, updates: Partial<CapitalProductInput>) => {
      await capitalProductsService.updateProduct(companyId, productId, updates);
      await refresh();
    },
    [companyId, refresh],
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      await capitalProductsService.deleteProduct(companyId, productId);
      setProducts(prev => prev.filter(p => p.id !== productId));
    },
    [companyId],
  );

  return { products, loading, error, refresh, createProduct, updateProduct, deleteProduct };
}
