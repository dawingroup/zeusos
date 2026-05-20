/**
 * Sync To Shopify Button Component
 * Button to sync a roadmap product to Shopify
 */

import { useState } from 'react';
import { Store, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import type { RoadmapProduct } from '../../types/roadmap';
import { useShopify } from './useShopify';

interface SyncToShopifyButtonProps {
  product: RoadmapProduct;
}

export function SyncToShopifyButton({ product }: SyncToShopifyButtonProps) {
  const { status, syncProduct } = useShopify();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<'success' | 'error' | null>(null);

  if (!status?.connected) {
    return null;
  }

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    const productData = {
      title: product.name,
      body_html: product.description || '',
      vendor: 'Dawin Group',
      product_type: 'Custom Furniture',
      status: product.stage === 'launched' ? 'active' : 'draft',
      tags: [product.stage, product.priority].filter(Boolean),
      variants: [{
        price: '0.00',
        sku: product.id,
      }],
    };

    const result = await syncProduct(product.id, productData);
    setSyncResult(result.success ? 'success' : 'error');
    setIsSyncing(false);

    // Reset after 3 seconds
    setTimeout(() => setSyncResult(null), 3000);
  };

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        syncResult === 'success'
          ? 'bg-green-100 text-green-700'
          : syncResult === 'error'
          ? 'bg-red-100 text-red-700'
          : 'bg-green-50 text-green-600 hover:bg-green-100'
      }`}
    >
      {isSyncing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : syncResult === 'success' ? (
        <CheckCircle className="w-4 h-4" />
      ) : syncResult === 'error' ? (
        <AlertCircle className="w-4 h-4" />
      ) : (
        <Store className="w-4 h-4" />
      )}
      {isSyncing ? 'Syncing...' : syncResult === 'success' ? 'Synced!' : syncResult === 'error' ? 'Failed' : 'Sync to Shopify'}
    </button>
  );
}
