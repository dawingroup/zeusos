/**
 * CommercePage - WhatsApp Commerce / Shopify product catalog
 * Browse products and share them with customers via WhatsApp
 */

import { useState, useEffect } from 'react';
import { ShoppingBag, Search, ExternalLink, Loader2, PackageSearch, Send } from 'lucide-react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  price: string;
  currency: string;
  status: string;
  vendor?: string;
  productType?: string;
  shopifyProductId?: string;
}

export default function CommercePage() {
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      // Try to load from shopifyProducts collection (synced from Shopify)
      const q = query(
        collection(db, 'shopifyProducts'),
        where('status', '==', 'active'),
        orderBy('title'),
        limit(100)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ShopifyProduct[];
      setProducts(items);
    } catch {
      // Fallback: try launchPipeline products
      try {
        const q = query(
          collection(db, 'products'),
          orderBy('title'),
          limit(100)
        );
        const snap = await getDocs(q);
        const items = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ShopifyProduct[];
        setProducts(items);
      } catch {
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = search
    ? products.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.description?.toLowerCase().includes(search.toLowerCase()) ||
          p.vendor?.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Commerce</h2>
          <p className="text-sm text-muted-foreground">
            Browse products and share with customers via WhatsApp
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500 border rounded-lg bg-gray-50">
          <PackageSearch className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium">No products found</p>
          <p className="text-xs mt-1">
            {products.length === 0
              ? 'Sync products from Shopify via the Launch Pipeline module'
              : 'Try a different search term'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({ product }: { product: ShopifyProduct }) {
  return (
    <div className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="aspect-square bg-gray-100 flex items-center justify-center">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <ShoppingBag className="w-10 h-10 text-gray-300" />
        )}
      </div>

      {/* Details */}
      <div className="p-3 space-y-2">
        <h3 className="font-medium text-sm line-clamp-2">{product.title}</h3>
        {product.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm text-green-700">
            {product.currency || 'UGX'} {product.price}
          </span>
          {product.vendor && (
            <span className="text-xs text-gray-400">{product.vendor}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            title="Share via WhatsApp (coming soon)"
          >
            <Send className="w-3 h-3" />
            Share
          </button>
          {product.shopifyProductId && (
            <button
              className="flex items-center justify-center px-2 py-1.5 text-xs text-gray-500 border rounded-lg hover:bg-gray-50"
              title="View on Shopify"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
