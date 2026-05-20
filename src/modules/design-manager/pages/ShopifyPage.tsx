/**
 * Shopify Integration Page
 * Settings and product management
 */

import { ShopifySettings, ShopifyProductList } from '../components/shopify';

export default function ShopifyPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shopify Integration</h1>
        <p className="text-gray-500">Connect your Shopify store to sync products</p>
      </div>

      {/* Settings */}
      <ShopifySettings />

      {/* Product List */}
      <ShopifyProductList />
    </div>
  );
}
