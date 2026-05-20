/**
 * Shopify Hook
 * React hook for Shopify integration
 */

import { useState, useEffect, useCallback } from 'react';
import type { ShopifyProduct } from '../../types/shopify';
import * as shopifyService from '../../services/shopifyService';

interface ShopifyStatus {
  connected: boolean;
  status: string;
  shopName?: string;
  shopDomain?: string;
}

interface UseShopifyReturn {
  status: ShopifyStatus | null;
  products: ShopifyProduct[];
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: (shopDomain: string, accessToken: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  syncProduct: (roadmapProductId: string, productData: any) => Promise<{ success: boolean; shopifyProductId?: string }>;
}

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

export function useShopify(): UseShopifyReturn {
  const [status, setStatus] = useState<ShopifyStatus | null>(null);
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/shopify/status`);
      const data = await response.json();
      setStatus(data);
      
      if (data.connected) {
        await loadProducts();
      }
    } catch (err) {
      console.error('Error loading Shopify status:', err);
      setError('Failed to load Shopify status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProducts = async () => {
    try {
      const prods = await shopifyService.getShopifyProducts();
      setProducts(prods);
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const connect = async (shopDomain: string, accessToken: string): Promise<boolean> => {
    setIsConnecting(true);
    setError(null);
    
    try {
      const result = await shopifyService.connectShopify(shopDomain, accessToken);
      
      if (!result.success) {
        setError(result.error || 'Connection failed');
        return false;
      }
      
      await loadStatus();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
      return false;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await shopifyService.disconnectShopify();
      setStatus({ connected: false, status: 'disconnected' });
      setProducts([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const syncProduct = async (roadmapProductId: string, productData: any) => {
    try {
      const result = await shopifyService.syncProductToShopify(roadmapProductId, productData);
      if (result.success) {
        await loadProducts();
      }
      return result;
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Sync failed' };
    }
  };

  return {
    status,
    products,
    isLoading,
    isConnecting,
    error,
    connect,
    disconnect,
    refreshProducts: loadProducts,
    syncProduct,
  };
}
