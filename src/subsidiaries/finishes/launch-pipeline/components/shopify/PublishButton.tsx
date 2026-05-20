/**
 * PublishButton Component
 * Button to publish a product to Shopify from the Launch Pipeline
 */

import { useState } from 'react';
import { Store, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import type { LaunchProduct } from '../../types/product.types';
import { useShopifySync } from '../../hooks/useShopifySync';

interface PublishButtonProps {
  product: LaunchProduct;
  onPublished?: () => void;
  variant?: 'default' | 'compact';
}

export function PublishButton({ product, onPublished, variant = 'default' }: PublishButtonProps) {
  const { isConnected, publishProduct, checkReadiness } = useShopifySync();
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Don't show if Shopify is not connected
  if (!isConnected) {
    return null;
  }

  // Check if already synced
  const isSynced = product.shopifySync?.status === 'synced';
  const shopifyUrl = product.shopifySync?.shopifyUrl;

  // Check readiness
  const readiness = checkReadiness(product);

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishResult(null);
    setErrorMessage(null);

    const result = await publishProduct(product);
    
    if (result.success) {
      setPublishResult('success');
      onPublished?.();
    } else {
      setPublishResult('error');
      setErrorMessage(result.error || 'Publish failed');
    }
    
    setIsPublishing(false);

    // Reset after 5 seconds
    setTimeout(() => {
      setPublishResult(null);
      setErrorMessage(null);
    }, 5000);
  };

  // Compact variant for ProductCard
  if (variant === 'compact') {
    if (isSynced) {
      return (
        <a
          href={shopifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
        >
          <Store className="w-3 h-3" />
          <span>Live</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    }

    if (!readiness.ready) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-500 rounded cursor-not-allowed">
          <Store className="w-3 h-3" />
          <span>Not Ready</span>
        </div>
      );
    }

    return (
      <button
        onClick={handlePublish}
        disabled={isPublishing}
        className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
          publishResult === 'success'
            ? 'bg-green-100 text-green-700'
            : publishResult === 'error'
            ? 'bg-red-100 text-red-700'
            : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
        }`}
      >
        {isPublishing ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : publishResult === 'success' ? (
          <CheckCircle className="w-3 h-3" />
        ) : publishResult === 'error' ? (
          <AlertCircle className="w-3 h-3" />
        ) : (
          <Store className="w-3 h-3" />
        )}
        <span>
          {isPublishing ? 'Publishing...' : publishResult === 'success' ? 'Published!' : publishResult === 'error' ? 'Failed' : 'Publish'}
        </span>
      </button>
    );
  }

  // Default variant - full button
  return (
    <div className="space-y-2">
      {isSynced ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Published to Shopify</span>
          </div>
          {shopifyUrl && (
            <a
              href={shopifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on Shopify
            </a>
          )}
        </div>
      ) : (
        <>
          {!readiness.ready && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-800 mb-1">Not ready for Shopify</p>
              <ul className="text-xs text-amber-700 space-y-0.5">
                {readiness.blockers.map((blocker, i) => (
                  <li key={i}>• {blocker}</li>
                ))}
              </ul>
            </div>
          )}
          
          <button
            onClick={handlePublish}
            disabled={isPublishing || !readiness.ready}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              !readiness.ready
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : publishResult === 'success'
                ? 'bg-green-600 text-white'
                : publishResult === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-[#95BF47] text-white hover:bg-[#7EA83D]'
            }`}
          >
            {isPublishing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : publishResult === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : publishResult === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Store className="w-5 h-5" />
            )}
            {isPublishing 
              ? 'Publishing to Shopify...' 
              : publishResult === 'success' 
              ? 'Published!' 
              : publishResult === 'error' 
              ? 'Publish Failed' 
              : 'Publish to Shopify'}
          </button>
          
          {errorMessage && (
            <p className="text-sm text-red-600">{errorMessage}</p>
          )}
          
          <p className="text-xs text-gray-500">
            Readiness score: {readiness.score}%
          </p>
        </>
      )}
    </div>
  );
}

export default PublishButton;
