/**
 * useShopifySync Hook
 * React hook for Shopify sync operations in Launch Pipeline
 */

import { useState, useEffect, useCallback } from 'react';
import type { LaunchProduct } from '../types/product.types';
import type { ShopifySyncState } from '../types/shopify.types';
import * as shopifyService from '../services/shopifyService';
import * as pipelineService from '../services/pipelineService';

export interface UseShopifySyncReturn {
  // Status
  shopifyStatus: shopifyService.ShopifyStatus | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  publishProduct: (product: LaunchProduct) => Promise<PublishResult>;
  checkReadiness: (product: LaunchProduct) => ReadinessCheck;
  auditProduct: (product: LaunchProduct) => shopifyService.ShopifyAuditResult;
  refreshStatus: () => Promise<void>;
}

export interface PublishResult {
  success: boolean;
  shopifyProductId?: string;
  shopifyUrl?: string;
  error?: string;
}

export interface ReadinessCheck {
  ready: boolean;
  blockers: string[];
  score: number;
}

export function useShopifySync(): UseShopifySyncReturn {
  const [shopifyStatus, setShopifyStatus] = useState<shopifyService.ShopifyStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isConnected = shopifyStatus?.connected ?? false;

  // Load Shopify connection status
  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const status = await shopifyService.getShopifyStatus();
      setShopifyStatus(status);
    } catch (err) {
      console.error('Error loading Shopify status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Shopify status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  /**
   * Publish a product to Shopify
   */
  const publishProduct = useCallback(async (product: LaunchProduct): Promise<PublishResult> => {
    if (!isConnected) {
      return { success: false, error: 'Shopify is not connected' };
    }

    // Check readiness first
    const readiness = shopifyService.isReadyForPublish(product);
    if (!readiness.ready) {
      return { 
        success: false, 
        error: `Product not ready: ${readiness.blockers.join(', ')}` 
      };
    }

    try {
      // Publish to Shopify
      const result = await shopifyService.publishToShopify(product);
      
      if (result.success && result.shopifyProductId) {
        // Update product sync state
        const syncState: Partial<ShopifySyncState> = {
          shopifyProductId: result.shopifyProductId,
          status: 'synced',
          shopifyUrl: result.shopifyUrl,
        };
        
        await shopifyService.updateSyncState(product.id, syncState);
        
        // Auto-transition to Launched stage if in Documentation
        if (product.currentStage === 'documentation') {
          await pipelineService.moveProductToStage(
            product.id, 
            'launched', 
            'system',
            'Auto-transitioned after successful Shopify publish'
          );
        }
      }
      
      return result;
    } catch (err) {
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Publish failed' 
      };
    }
  }, [isConnected]);

  /**
   * Check if product is ready for Shopify publish
   */
  const checkReadiness = useCallback((product: LaunchProduct): ReadinessCheck => {
    const audit = shopifyService.auditProduct(product);
    const readiness = shopifyService.isReadyForPublish(product);
    
    return {
      ready: readiness.ready,
      blockers: readiness.blockers,
      score: audit.score,
    };
  }, []);

  /**
   * Audit product for Shopify readiness
   */
  const auditProduct = useCallback((product: LaunchProduct): shopifyService.ShopifyAuditResult => {
    return shopifyService.auditProduct(product);
  }, []);

  return {
    shopifyStatus,
    isConnected,
    isLoading,
    error,
    publishProduct,
    checkReadiness,
    auditProduct,
    refreshStatus,
  };
}
