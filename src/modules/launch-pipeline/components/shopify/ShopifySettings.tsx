/**
 * Shopify Settings Component for Launch Pipeline
 * Connection and configuration UI
 */

import { useState } from 'react';
import { Store, Link2, Unlink, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { useShopifySync } from '../../hooks/useShopifySync';
import * as shopifyService from '../../services/shopifyService';

export function ShopifySettings() {
  const { shopifyStatus, isLoading, error, refreshStatus } = useShopifySync();
  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setConnectError(null);
    
    const result = await shopifyService.connectShopify(shopDomain, accessToken);
    
    if (result.success) {
      setShopDomain('');
      setAccessToken('');
      setShowForm(false);
      await refreshStatus();
    } else {
      setConnectError(result.error || 'Connection failed');
    }
    
    setIsConnecting(false);
  };

  const handleDisconnect = async () => {
    if (confirm('Are you sure you want to disconnect from Shopify?')) {
      await shopifyService.disconnectShopify();
      await refreshStatus();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <Store className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Shopify Integration</h3>
            <p className="text-sm text-gray-500">Sync products to your Shopify store</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {(error || connectError) && (
          <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error || connectError}
          </div>
        )}

        {shopifyStatus?.connected ? (
          <div className="space-y-4">
            {/* Connected Status */}
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="font-medium text-green-800">Connected to {shopifyStatus.shopName}</p>
                <p className="text-sm text-green-600">{shopifyStatus.shopDomain}</p>
              </div>
              <a
                href={`https://${shopifyStatus.shopDomain}/admin`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-green-600 hover:bg-green-100 rounded-lg"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            {/* Disconnect Button */}
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Unlink className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        ) : showForm ? (
          <form onSubmit={handleConnect} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shop Domain
              </label>
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="your-store.myshopify.com"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin API Access Token
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="shpat_..."
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">
                Create a custom app in Shopify Admin → Settings → Apps → Develop apps
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                Connect
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 mb-4">Connect your Shopify store to sync products</p>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 mx-auto"
            >
              <Link2 className="w-4 h-4" />
              Connect Shopify
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ShopifySettings;
