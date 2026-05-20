/**
 * Shopify Product List Component for Launch Pipeline
 * Enhanced product list with sync status, link status, and import actions
 */

import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Package, Loader2, Link2, AlertTriangle, Download } from 'lucide-react';
import { useShopifySync } from '../../hooks/useShopifySync';
import { getUnlinkedShopifyProducts } from '../../services/shopifyService';
import { ShopifyImportDialog } from './ShopifyImportDialog';

interface ShopifyProduct {
  id: string;
  title: string;
  status: string;
  images?: { src: string }[];
  variants?: { price: string }[];
  updated_at?: string;
}

export function ShopifyProductList() {
  const { shopifyStatus, isConnected } = useShopifySync();
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const loadProducts = async () => {
    if (!isConnected) return;

    setIsLoading(true);
    try {
      const data = await getUnlinkedShopifyProducts();
      const allProducts: ShopifyProduct[] = [...data.linked, ...data.unlinked].map(p => ({
        id: p.id.toString(),
        title: p.title,
        status: p.status,
        images: p.images?.map(i => ({ src: i.src })),
        variants: p.variants?.map(v => ({ price: v.price })),
        updated_at: p.updated_at,
      }));
      setProducts(allProducts);
      setLinkedIds(new Set(data.linked.map(p => p.id.toString())));
    } catch (err) {
      console.error('Error loading Shopify products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      loadProducts();
    }
  }, [isConnected]);

  if (!isConnected) {
    return null;
  }

  const unlinkedCount = products.filter(p => !linkedIds.has(p.id.toString())).length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Shopify Products</h3>
          <p className="text-sm text-gray-500">{products.length} products in store</p>
        </div>
        <div className="flex items-center gap-2">
          {unlinkedCount > 0 && (
            <button
              onClick={() => setShowImportDialog(true)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Import Unlinked ({unlinkedCount})
            </button>
          )}
          <button
            onClick={loadProducts}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Product Table */}
      <div className="overflow-x-auto">
        {isLoading && products.length === 0 ? (
          <div className="p-6 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
          </div>
        ) : products.length === 0 ? (
          <div className="p-6 text-center">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No products in Shopify yet</p>
          </div>
        ) : (
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pipeline</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Updated</th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0].src}
                          alt={product.title}
                          className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                          <Package className="w-4 h-4 text-gray-400" />
                        </div>
                      )}
                      <span className="font-medium text-gray-900 truncate max-w-[200px]">{product.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {product.variants?.[0]?.price ? `$${product.variants[0].price}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {linkedIds.has(product.id.toString()) ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <Link2 className="w-3 h-3" />
                        Linked
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <AlertTriangle className="w-3 h-3" />
                        Unlinked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {product.updated_at
                      ? new Date(product.updated_at).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {shopifyStatus?.shopDomain && (
                      <a
                        href={`https://${shopifyStatus.shopDomain}/admin/products/${product.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-400 hover:text-gray-600 inline-flex"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Import Dialog */}
      {showImportDialog && (
        <ShopifyImportDialog
          onClose={() => setShowImportDialog(false)}
          onImportComplete={() => {
            setShowImportDialog(false);
            loadProducts();
          }}
        />
      )}
    </div>
  );
}

export default ShopifyProductList;
