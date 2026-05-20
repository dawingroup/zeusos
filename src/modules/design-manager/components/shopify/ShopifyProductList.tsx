/**
 * Shopify Product List Component
 * Displays products from connected Shopify store
 */

import { RefreshCw, ExternalLink, Package } from 'lucide-react';
import { useShopify } from './useShopify';

export function ShopifyProductList() {
  const { status, products, isLoading, refreshProducts } = useShopify();

  if (!status?.connected) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Shopify Products</h3>
          <p className="text-sm text-gray-500">{products.length} products in store</p>
        </div>
        <button
          onClick={refreshProducts}
          disabled={isLoading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Product List */}
      <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
        {products.length === 0 ? (
          <div className="p-6 text-center">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No products in Shopify yet</p>
          </div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
              {/* Image */}
              {product.images?.[0] ? (
                <img
                  src={product.images[0].src}
                  alt={product.title}
                  className="w-12 h-12 rounded-lg object-cover bg-gray-100"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-gray-400" />
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{product.title}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    product.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {product.status}
                  </span>
                  {product.variants?.[0]?.price && (
                    <span>${product.variants[0].price}</span>
                  )}
                </div>
              </div>

              {/* Link */}
              <a
                href={`https://${status.shopDomain}/admin/products/${product.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
